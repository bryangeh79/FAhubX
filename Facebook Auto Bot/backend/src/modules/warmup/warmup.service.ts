import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WarmupProgress } from './entities/warmup-progress.entity';
import { FacebookAccount } from '../facebook-accounts/entities/facebook-account.entity';
import { Task, TaskStatus, TaskType } from '../task-scheduler/entities/task.entity';
import {
  findActiveWindow,
  findJustMissedWindow,
  getPackageInfo,
  getWarmupWindowHours,
  localDateKey,
  pickWarmupActions,
  PackageInfo,
  WarmupAction,
} from './warmup-windows.util';

const MISSED_RED_THRESHOLD = 6; // 每日错过 ≥ 6 个窗口 → 红色警告（用户指定）

/**
 * v1.2.0 Phase 2 —— 暖化调度服务
 *
 * 职责：
 * 1. schema 初始化（onModuleInit）
 * 2. 每 5 分钟 cron 检查所有 active 暖化账号：
 *    - 如果当前处于某窗口内 且 本窗口今日未触发 → 创建 simple_tasks PENDING 记录
 *    - 如果某窗口刚过期（未触发）→ missed++
 * 3. API 层调用：start / retire / resume / status
 *
 * 决策不在这里：actions 的具体执行交给现有 task-auto-runner + facebook-login.service
 */
@Injectable()
export class WarmupService implements OnModuleInit {
  private readonly logger = new Logger(WarmupService.name);

  constructor(
    @InjectRepository(WarmupProgress)
    private readonly progressRepo: Repository<WarmupProgress>,
    @InjectRepository(FacebookAccount)
    private readonly accountRepo: Repository<FacebookAccount>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      // 项目没开 migrationsRun，自行 ensure 表
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS warmup_progress (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" UUID NOT NULL,
          "accountId" UUID NOT NULL UNIQUE,
          "startedAt" TIMESTAMPTZ NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          "lastFiredWindow" VARCHAR(20),
          "lastCheckedAt" TIMESTAMPTZ,
          "missedToday" INT NOT NULL DEFAULT 0,
          "missedDateKey" VARCHAR(10),
          "missedTotal" INT NOT NULL DEFAULT 0,
          "firedTotal" INT NOT NULL DEFAULT 0,
          "retiredAt" TIMESTAMPTZ,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_warmup_progress_user_id
          ON warmup_progress ("userId")
      `);
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_warmup_progress_status
          ON warmup_progress (status)
      `);
      this.logger.log('✅ warmup_progress schema ensured (v1.2.0 Phase 2)');
    } catch (err: any) {
      this.logger.error(`warmup schema init failed: ${err.message}`);
    }
  }

  // ─── 对外 API（由 controller 调用）─────────────────────────────────

  /** 启动某账号的暖化（Day 1 = 现在） */
  async startWarmup(userId: string, accountId: string): Promise<WarmupProgress> {
    const account = await this.accountRepo.findOne({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException(`账号 ${accountId} 不存在`);
    if (account.warmupGroupNumber == null) {
      throw new NotFoundException('账号尚未分配分组，请先设置分组');
    }

    const existing = await this.progressRepo.findOne({ where: { accountId } });
    if (existing) {
      // 已存在 → 如果是 retired 的，重置为 active 并重开 Day 1
      if (existing.status === 'retired') {
        existing.status = 'active';
        existing.startedAt = new Date();
        existing.retiredAt = null;
        existing.lastFiredWindow = null;
        existing.missedToday = 0;
        existing.missedDateKey = null;
        return this.progressRepo.save(existing);
      }
      return existing; // already active
    }

    const progress = this.progressRepo.create({
      userId,
      accountId,
      startedAt: new Date(),
      status: 'active',
    });
    return this.progressRepo.save(progress);
  }

  /** 停用暖化（保留记录，不再触发动作） */
  async retireWarmup(userId: string, accountId: string): Promise<WarmupProgress> {
    const p = await this.progressRepo.findOne({ where: { accountId, userId } });
    if (!p) throw new NotFoundException(`账号尚未启动暖化`);
    p.status = 'retired';
    p.retiredAt = new Date();
    return this.progressRepo.save(p);
  }

  /** 重新激活（从上次 startedAt 继续，不重置天数） */
  async resumeWarmup(userId: string, accountId: string): Promise<WarmupProgress> {
    const p = await this.progressRepo.findOne({ where: { accountId, userId } });
    if (!p) throw new NotFoundException(`账号尚未启动暖化`);
    p.status = 'active';
    p.retiredAt = null;
    return this.progressRepo.save(p);
  }

  /** 暖化状态（单账号） —— 包含下次窗口、进度百分比 */
  async getStatus(userId: string, accountId: string): Promise<{
    progress: WarmupProgress | null;
    packageInfo: PackageInfo | null;
    nextWindowHour: number | null;
    activeWindowIndex: number | null;
    missedThresholdReached: boolean;
  }> {
    const p = await this.progressRepo.findOne({ where: { accountId, userId } });
    if (!p) return {
      progress: null, packageInfo: null, nextWindowHour: null,
      activeWindowIndex: null, missedThresholdReached: false,
    };

    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    const groupNumber = account?.warmupGroupNumber ?? 1;
    const now = new Date();
    const packageInfo = getPackageInfo(p.startedAt, now);
    const activeWindowIndex = findActiveWindow(groupNumber, now);
    // 计算下一个窗口小时（今天剩余的第一个）
    const hours = getWarmupWindowHours(groupNumber).sort((a, b) => a - b);
    const currentHour = now.getHours();
    let nextWindowHour: number | null = hours.find(h => h > currentHour) ?? hours[0];

    return {
      progress: p,
      packageInfo,
      nextWindowHour,
      activeWindowIndex: activeWindowIndex >= 0 ? activeWindowIndex : null,
      missedThresholdReached: p.missedToday >= MISSED_RED_THRESHOLD,
    };
  }

  /** 当前用户所有暖化进度（仪表板用） */
  async listForUser(userId: string): Promise<WarmupProgress[]> {
    return this.progressRepo.find({
      where: { userId },
      order: { startedAt: 'ASC' },
    });
  }

  // ─── 定时调度器 ─────────────────────────────────────────────────────

  /**
   * 每 5 分钟跑一次（窗口是 30 分钟，足够覆盖）
   * - 遍历所有 active 暖化账号
   * - 检查当前窗口并决定是否 enqueue 动作
   * - 检查是否有刚错过的窗口，更新 missed 计数
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduleTick(): Promise<void> {
    const now = new Date();
    const activeList = await this.progressRepo.find({ where: { status: 'active' } });
    if (activeList.length === 0) return;

    this.logger.debug(`Warmup tick: checking ${activeList.length} accounts`);

    for (const p of activeList) {
      try {
        await this.tickOne(p, now);
      } catch (err: any) {
        this.logger.warn(`[warmup:${p.accountId}] tick failed: ${err.message}`);
      }
    }
  }

  /**
   * 为 auto_chat 动作找同组配对账号
   * 规则：
   * - 必须同组（warmupGroupNumber 相同）
   * - 必须也在 active 暖化中
   * - 优先选 VPN IP 不同的账号（更安全）
   * - 如果没法找到不同 IP 的，退而求其次用同 IP 的（警告但允许）
   * - 如果同组只有自己一个 → 返回 null，调用方降级到 simulate
   */
  private async findChatPartner(
    selfAccount: FacebookAccount,
  ): Promise<{ partner: FacebookAccount; sameIp: boolean } | null> {
    if (selfAccount.warmupGroupNumber == null) return null;

    // 找同组 + 同租户 + active 暖化 + 未删除的其他账号
    const candidates: FacebookAccount[] = await this.accountRepo
      .createQueryBuilder('a')
      .innerJoin(
        'warmup_progress',
        'w',
        'w."accountId" = a.id AND w.status = :warmupStatus',
        { warmupStatus: 'active' },
      )
      .where('a."userId" = :userId', { userId: selfAccount.userId })
      .andWhere('a."warmupGroupNumber" = :g', { g: selfAccount.warmupGroupNumber })
      .andWhere('a.id != :selfId', { selfId: selfAccount.id })
      .andWhere('a."deletedAt" IS NULL')
      .getMany();

    if (candidates.length === 0) return null;

    // 优先选 VPN 不同的
    const differentIp = candidates.filter(c => c.vpnConfigId !== selfAccount.vpnConfigId);
    if (differentIp.length > 0) {
      const pick = differentIp[Math.floor(Math.random() * differentIp.length)];
      return { partner: pick, sameIp: false };
    }

    // 退而求其次：同 IP 的（警告但允许）
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return { partner: pick, sameIp: true };
  }

  /** 单账号的一次调度检查 */
  private async tickOne(p: WarmupProgress, now: Date): Promise<void> {
    const account = await this.accountRepo.findOne({
      where: { id: p.accountId },
    });
    if (!account || account.warmupGroupNumber == null) {
      // 账号被删或分组被清空 —— 自动退役
      p.status = 'retired';
      p.retiredAt = now;
      await this.progressRepo.save(p);
      return;
    }

    const groupNumber = account.warmupGroupNumber;
    const todayKey = localDateKey(now);

    // 1. 日期变化 → 重置 missedToday
    if (p.missedDateKey !== todayKey) {
      p.missedDateKey = todayKey;
      p.missedToday = 0;
    }

    // 2. 检查「刚刚错过的窗口」（在上次检查和现在之间过期）
    const lastChecked = p.lastCheckedAt ?? new Date(now.getTime() - 6 * 60 * 1000);
    const missedIdx = findJustMissedWindow(groupNumber, lastChecked, now);
    if (missedIdx >= 0) {
      const windowKey = `${todayKey}:${missedIdx}`;
      if (p.lastFiredWindow !== windowKey) {
        p.missedToday += 1;
        p.missedTotal += 1;
        this.logger.warn(
          `[warmup] 账号 ${p.accountId} (G${groupNumber}) 错过窗口 ${missedIdx} (今日累计 ${p.missedToday})`,
        );
      }
    }

    // 3. 检查当前是否处于窗口内
    const activeIdx = findActiveWindow(groupNumber, now);
    if (activeIdx >= 0) {
      const windowKey = `${todayKey}:${activeIdx}`;
      if (p.lastFiredWindow !== windowKey) {
        // 在窗口内 + 今天此窗口未触发 → enqueue 动作
        const info = getPackageInfo(p.startedAt, now);
        await this.dispatchAction(p, account, info, activeIdx as 0 | 1 | 2);
        p.lastFiredWindow = windowKey;
        p.firedTotal += 1;
      }
    }

    p.lastCheckedAt = now;
    await this.progressRepo.save(p);
  }

  /**
   * 创建一个 simple_tasks PENDING 记录 —— 现有 auto-runner 会立即执行
   * 任务 name 带 [Warmup] 前缀，便于在任务列表里识别
   */
  private async dispatchAction(
    p: WarmupProgress,
    account: FacebookAccount,
    info: PackageInfo,
    windowIndex: 0 | 1 | 2,
  ): Promise<void> {
    const candidates = pickWarmupActions(info.packageNumber, windowIndex);
    let action = candidates[Math.floor(Math.random() * candidates.length)];

    const accountTag = account.accountNumber != null ? `#${String(account.accountNumber).padStart(2, '0')}` : account.email ?? '';
    const pkgTag = `P${info.packageNumber}D${info.dayInPackage}`;
    const windowLabel = ['早', '午', '晚'][windowIndex];

    // ─── auto_chat 需要配对 ────────────────────────────────────────
    let partnerAccount: FacebookAccount | null = null;
    let sameIpWarning = false;
    if (action === 'auto_chat') {
      const pair = await this.findChatPartner(account);
      if (!pair) {
        // 同组没人可配对 → 降级为 simulate
        this.logger.warn(`[warmup] ${accountTag} 同组无可配对账号，降级为 simulate_human_behavior`);
        action = 'simulate_human_behavior';
      } else {
        partnerAccount = pair.partner;
        sameIpWarning = pair.sameIp;
      }
    }

    const parameters: Record<string, any> = {
      taskAction: action,
      accountAId: account.id,
      accountName: accountTag,
      headless: false,
      warmupMeta: {
        packageNumber: info.packageNumber,
        dayInPackage: info.dayInPackage,
        windowIndex,
        groupNumber: account.warmupGroupNumber,
      },
    };

    // auto_chat：带上 B 账号 + IP 警告
    if (action === 'auto_chat' && partnerAccount) {
      const partnerTag = partnerAccount.accountNumber != null
        ? `#${String(partnerAccount.accountNumber).padStart(2, '0')}`
        : partnerAccount.email ?? '';
      parameters.accountBId = partnerAccount.id;
      parameters.accountName = `${accountTag} ↔ ${partnerTag}`;
      parameters.warmupMeta.partnerAccountId = partnerAccount.id;
      parameters.warmupMeta.sameIpWarning = sameIpWarning;
      if (sameIpWarning) {
        this.logger.warn(
          `[warmup:IP⚠️] ${accountTag} ↔ ${partnerTag} 处于同一 VPN IP（风控风险升高，但按策略允许执行）`,
        );
      }
    }

    // simulate 动作需要 durationMinutes + warmingActions
    if (action === 'simulate_human_behavior') {
      parameters.durationMinutes = info.packageNumber === 1 ? 30 : 20;
      parameters.warmingActions = ['scroll_feed', 'watch_video', 'like_post', 'view_profile', 'view_stories'];
    }

    // auto_join_group：注入租户的加群设置（关键词/上限/策略/AI 回答）
    if (action === 'auto_join_group') {
      try {
        const [row] = await this.dataSource.query(
          `SELECT preferences FROM users WHERE id = $1`,
          [p.userId],
        );
        const gj = row?.preferences?.warmup?.groupJoin;
        if (gj && Array.isArray(gj.keywords) && gj.keywords.length > 0) {
          parameters.groupJoinSettings = {
            keywords: gj.keywords,
            dailyLimit: gj.dailyLimit ?? 3,
            strategy: gj.strategy ?? 'random',
            aiAnswerEnabled: !!gj.aiAnswerEnabled,
            aiAnswerPrompt: gj.aiAnswerPrompt ?? '',
          };
        } else {
          // 没设关键词 → 降级到 simulate（避免盲目加群）
          this.logger.warn(`[warmup] ${accountTag} 未配置加群关键词，降级为 simulate_human_behavior`);
          action = 'simulate_human_behavior';
          parameters.taskAction = action;
          parameters.durationMinutes = 20;
          parameters.warmingActions = ['scroll_feed', 'watch_video', 'like_post'];
        }
      } catch (err: any) {
        this.logger.warn(`[warmup] 读取加群设置失败: ${err.message}，降级为 simulate`);
        action = 'simulate_human_behavior';
        parameters.taskAction = action;
        parameters.durationMinutes = 20;
        parameters.warmingActions = ['scroll_feed', 'watch_video', 'like_post'];
      }
    }

    this.logger.log(
      `[warmup] ${parameters.accountName} (G${account.warmupGroupNumber}) ${pkgTag} ${windowLabel}窗口 → ${action}${sameIpWarning ? ' [IP⚠️]' : ''}`,
    );

    const taskNameSuffix = sameIpWarning ? ' [IP⚠️]' : '';
    const task = this.taskRepo.create({
      name: `[Warmup${taskNameSuffix}] ${parameters.accountName} ${pkgTag} ${windowLabel}`,
      description: `暖化自动任务 · ${account.warmupGroupNumber ? `G${account.warmupGroupNumber}` : ''} · ${info.packageName}${sameIpWarning ? ' · 同 IP 警告' : ''}`,
      type: TaskType.IMMEDIATE,
      status: TaskStatus.PENDING,
      userId: p.userId,
      taskAction: action,
      accountId: account.id,
      executionData: {
        scriptId: action,
        scriptType: 'browser', // 复用现有枚举（'browser' | 'dialogue'），warmup 识别靠 [Warmup] 任务名前缀
        targets: [],
        parameters,
      },
      priority: 3,
      maxRetries: 1, // 暖化任务失败不重试，下次窗口再试
      timeoutMinutes: 45,
      scheduledAt: new Date(),
    } as Partial<Task>);

    await this.taskRepo.save(task);
  }
}
