/**
 * v1.2.0 Phase 2 — 暖化时间矩阵工具
 *
 * 每个分组固定 3 个窗口（早 / 下午 / 晚），组号越大起始时间越晚。
 * 窗口持续 30 分钟（在此期间调度器触发 enqueue；过了 30 分钟还没触发就算错过）。
 */

export const WINDOW_DURATION_MIN = 30;

/**
 * 获取某个分组的 3 个窗口小时
 *   G{n}: [8 + (n-1), 14 + (n-1), 20 + (n-1)]，跨 24 小时时取模
 */
export function getWarmupWindowHours(groupNumber: number): number[] {
  const offset = groupNumber - 1;
  return [(8 + offset) % 24, (14 + offset) % 24, (20 + offset) % 24];
}

/**
 * 计算某个时间点是否处于某个分组的某个窗口内
 * 返回 windowIndex (0/1/2) 或 -1（不在窗口）
 */
export function findActiveWindow(
  groupNumber: number,
  now: Date = new Date(),
): number {
  const hours = getWarmupWindowHours(groupNumber);
  const h = now.getHours();
  const m = now.getMinutes();
  for (let i = 0; i < hours.length; i++) {
    if (h === hours[i] && m < WINDOW_DURATION_MIN) return i;
  }
  return -1;
}

/**
 * 计算某个时间点「刚错过」的窗口索引（时间已过窗口结束但不到 24 小时）
 * 用于 missed-window 统计
 */
export function findJustMissedWindow(
  groupNumber: number,
  lastCheckedAt: Date,
  now: Date = new Date(),
): number {
  const hours = getWarmupWindowHours(groupNumber);
  // 当前时刻每个窗口的 "过了" 临界时间
  for (let i = 0; i < hours.length; i++) {
    const windowEnd = new Date(now);
    windowEnd.setHours(hours[i], WINDOW_DURATION_MIN, 0, 0);
    // 如果 windowEnd 在 lastCheckedAt 和 now 之间 → 意味着在本次 tick 之间该窗口刚刚过期
    if (windowEnd > lastCheckedAt && windowEnd <= now) {
      return i;
    }
  }
  return -1;
}

/**
 * v1.3.0 —— 暖化包模式 + 进度计算
 *
 * 租户创建养号任务时选择 packageMode：
 *   P1      — 只孵化（Day 1-7，跑完自动转 P3）
 *   P2      — 只激活（Day 1-7 用 P2 动作，跑完自动转 P3）
 *   P1+P2   — 完整养号（Day 1-14：前 7 天 P1，后 7 天 P2，跑完自动转 P3）
 *   P3      — 立即进入维护模式（无限运行）
 *
 * 注意 P2 单独时，Day 1 就用激活期动作，而不是等到 Day 8。
 * 从 startedAt 开始算 Day 1。
 *
 * 跑完自动转 P3 的时机：
 *   - P1 跑完 = day > 7：packageMode 改为 'P3'，startedAt 重置为 now（Day 1 of P3）
 *   - P2 跑完 = day > 7：同上
 *   - P1+P2 跑完 = day > 14：同上
 */
export type PackageMode = 'P1' | 'P2' | 'P1+P2' | 'P3';

export interface PackageInfo {
  /** 当前真实的包（调度器用这个决定动作）：1 孵化 / 2 激活 / 3 运营 */
  packageNumber: 1 | 2 | 3;
  packageName: 'incubation' | 'activation' | 'operation';
  /** 当前包内的天数（1-7 或 1+） */
  dayInPackage: number;
  /** 整个养号任务的累计天数 */
  overallDay: number;
  /** 相对 packageMode 总天数的进度 0-100；P3 始终 100 */
  progressPercent: number;
  /** 总天数（7 / 14 / 0=无限） */
  totalDays: number;
  isMaintenance: boolean;
  /** 是否已经跑完当前 packageMode 需要升级到 P3 */
  shouldTransitionToP3: boolean;
}

export function getPackageInfo(
  startedAt: Date,
  packageMode: PackageMode = 'P1+P2',
  now: Date = new Date(),
): PackageInfo {
  const msPerDay = 86_400_000;
  const day = Math.floor((now.getTime() - startedAt.getTime()) / msPerDay) + 1;

  // P3 无限维护
  if (packageMode === 'P3') {
    return {
      packageNumber: 3, packageName: 'operation',
      dayInPackage: day, overallDay: day,
      progressPercent: 100, totalDays: 0,
      isMaintenance: true, shouldTransitionToP3: false,
    };
  }

  // P1 单独：Day 1-7 用 P1 动作 —— 超过自动转 P3
  if (packageMode === 'P1') {
    if (day > 7) {
      return {
        packageNumber: 1, packageName: 'incubation',
        dayInPackage: 7, overallDay: day,
        progressPercent: 100, totalDays: 7,
        isMaintenance: false, shouldTransitionToP3: true,
      };
    }
    return {
      packageNumber: 1, packageName: 'incubation',
      dayInPackage: day, overallDay: day,
      progressPercent: Math.round((day / 7) * 100),
      totalDays: 7, isMaintenance: false, shouldTransitionToP3: false,
    };
  }

  // P2 单独：Day 1-7 用 P2 动作
  if (packageMode === 'P2') {
    if (day > 7) {
      return {
        packageNumber: 2, packageName: 'activation',
        dayInPackage: 7, overallDay: day,
        progressPercent: 100, totalDays: 7,
        isMaintenance: false, shouldTransitionToP3: true,
      };
    }
    return {
      packageNumber: 2, packageName: 'activation',
      dayInPackage: day, overallDay: day,
      progressPercent: Math.round((day / 7) * 100),
      totalDays: 7, isMaintenance: false, shouldTransitionToP3: false,
    };
  }

  // P1+P2 完整养号：Day 1-7 → P1，Day 8-14 → P2，Day 15+ → 转 P3
  if (day <= 7) {
    return {
      packageNumber: 1, packageName: 'incubation',
      dayInPackage: day, overallDay: day,
      progressPercent: Math.round((day / 14) * 100),
      totalDays: 14, isMaintenance: false, shouldTransitionToP3: false,
    };
  }
  if (day <= 14) {
    return {
      packageNumber: 2, packageName: 'activation',
      dayInPackage: day - 7, overallDay: day,
      progressPercent: Math.round((day / 14) * 100),
      totalDays: 14, isMaintenance: false, shouldTransitionToP3: false,
    };
  }
  // 超过 14 天 → 需转 P3
  return {
    packageNumber: 2, packageName: 'activation',
    dayInPackage: 7, overallDay: day,
    progressPercent: 100, totalDays: 14,
    isMaintenance: false, shouldTransitionToP3: true,
  };
}

/**
 * 根据包 + 窗口索引决定该触发什么动作
 *
 * Package 1 (孵化)：所有窗口都做 simulate_human_behavior（被动浏览）
 *
 * Package 2 (激活)：按窗口轮转
 *   - 窗口 0（早）：simulate + 加好友
 *   - 窗口 1（下午）：接受好友申请
 *   - 窗口 2（晚）：聊天 / 加群 / 发图文（轮流）
 *
 * Package 3 (运营)：全自由，按窗口轮转更多种类
 */
export type WarmupAction =
  | 'simulate_human_behavior'
  | 'auto_add_friend'
  | 'auto_accept_friend'
  | 'auto_chat'
  | 'auto_join_group'
  | 'auto_post_image'
  | 'auto_post_video'
  | 'auto_follow'
  | 'auto_comment';

/** 返回候选动作数组；调度器会根据账号配对/剧本可用性挑一个 */
export function pickWarmupActions(packageNumber: 1 | 2 | 3, windowIndex: 0 | 1 | 2): WarmupAction[] {
  if (packageNumber === 1) {
    return ['simulate_human_behavior'];
  }
  if (packageNumber === 2) {
    if (windowIndex === 0) return ['simulate_human_behavior', 'auto_add_friend'];
    if (windowIndex === 1) return ['auto_accept_friend', 'simulate_human_behavior'];
    return ['auto_chat', 'auto_join_group', 'auto_post_image'];
  }
  // Package 3 —— 运营期，每个窗口更丰富
  if (windowIndex === 0) return ['auto_chat', 'auto_add_friend', 'auto_comment'];
  if (windowIndex === 1) return ['auto_accept_friend', 'auto_follow', 'auto_join_group'];
  return ['auto_chat', 'auto_post_image', 'auto_post_video'];
}

/**
 * 格式化本地日期 YYYY-MM-DD（用于唯一标识「今天」，避免跨时区重复触发）
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
