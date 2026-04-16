import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Task, TaskStatus, TaskType } from '../task-scheduler/entities/task.entity';
import { TaskExecutionLog, LogStatus } from '../task-scheduler/entities/task-execution-log.entity';

export interface ExecutionLogEntry {
  time: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

// In-memory log store per taskId
// Limits: max 500 tasks retained, max 1000 log entries per task
const MAX_LOG_TASKS = 500;
const MAX_LOG_ENTRIES_PER_TASK = 1000;
const executionLogs = new Map<string, ExecutionLogEntry[]>();

export function appendLog(taskId: string, level: ExecutionLogEntry['level'], message: string) {
  if (!executionLogs.has(taskId)) {
    // Evict oldest task if at capacity
    if (executionLogs.size >= MAX_LOG_TASKS) {
      const oldestKey = executionLogs.keys().next().value;
      if (oldestKey) executionLogs.delete(oldestKey);
    }
    executionLogs.set(taskId, []);
  }
  const logs = executionLogs.get(taskId)!;
  logs.push({
    time: new Date().toLocaleTimeString('zh-CN'),
    level,
    message,
  });
  // Trim oldest entries if over limit
  if (logs.length > MAX_LOG_ENTRIES_PER_TASK) {
    logs.splice(0, logs.length - MAX_LOG_ENTRIES_PER_TASK);
  }
}

export function getLogs(taskId: string): ExecutionLogEntry[] {
  return executionLogs.get(taskId) || [];
}

export function clearLogs(taskId: string) {
  executionLogs.delete(taskId);
}

// Map our levels to LogStatus enum
function toLogStatus(level: ExecutionLogEntry['level']): LogStatus {
  switch (level) {
    case 'success': return LogStatus.COMPLETED;
    case 'error':   return LogStatus.FAILED;
    case 'warn':    return LogStatus.WARNING;
    default:        return LogStatus.INFO;
  }
}

@Injectable()
export class SimpleTasksService {
  private readonly logger = new Logger(SimpleTasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly repo: Repository<Task>,
    @InjectRepository(TaskExecutionLog)
    private readonly logRepo: Repository<TaskExecutionLog>,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, body: any): Promise<Task> {
    // ── 任务数量配额校验 ──────────────────────────────────────────────────
    const [user] = await this.dataSource.query(
      `SELECT role, max_tasks AS "maxTasks" FROM users WHERE id = $1`,
      [userId],
    );
    if (user && user.role !== 'admin') {
      const [{ count }] = await this.dataSource.query(
        `SELECT COUNT(*) AS count FROM tasks WHERE "userId" = $1 AND status NOT IN ('completed', 'failed', 'cancelled')`,
        [userId],
      );
      const activeCount = parseInt(count, 10);
      if (activeCount >= user.maxTasks) {
        throw new ForbiddenException(
          `活跃任务已达上限（${activeCount}/${user.maxTasks}），请删除已完成的任务或升级配套`,
        );
      }
    }

    const task = this.repo.create({
      name: body.name,
      description: body.description,
      type: body.type || TaskType.IMMEDIATE,
      status: TaskStatus.PENDING,
      userId,
      taskAction: body.taskAction,
      accountId: body.accountId,
      scheduleConfig: body.scheduleConfig,
      executionData: body.executionData || {
        scriptId: body.taskAction || 'unknown',
        scriptType: 'dialogue',
        targets: [],
        parameters: body,
      },
      priority: body.priority || 3,
      maxRetries: body.maxRetries || 3,
      timeoutMinutes: body.timeoutMinutes || 30,
      scheduledAt: body.scheduleConfig?.scheduledAt
        ? new Date(body.scheduleConfig.scheduledAt)
        : new Date(),
    } as Partial<Task>);

    return this.repo.save(task);
  }

  async findAll(userId: string, query: any = {}): Promise<{ tasks: Task[]; total: number }> {
    const qb = this.repo.createQueryBuilder('task')
      .where('task.userId = :userId', { userId })
      .orderBy('task.createdAt', 'DESC');

    if (query.status) qb.andWhere('task.status = :status', { status: query.status });
    if (query.accountId) qb.andWhere('task.accountId = :accountId', { accountId: query.accountId });

    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    qb.take(limit).skip((page - 1) * limit);

    const [tasks, total] = await qb.getManyAndCount();
    return { tasks, total };
  }

  async findOne(userId: string, id: string): Promise<Task | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.logRepo.delete({ taskId: id });
    await this.repo.delete({ id, userId });
  }

  async updateStatus(userId: string, id: string, status: TaskStatus, errorReason?: string): Promise<Task | null> {
    const update: any = { status };
    if (status === TaskStatus.COMPLETED) {
      update.completedAt = new Date();
      update.result = { success: true, message: '执行成功' };
    }
    if (status === TaskStatus.FAILED && errorReason) {
      update.completedAt = new Date();
      update.result = { success: false, error: errorReason };
    }
    if (status === TaskStatus.RUNNING) {
      update.startedAt = new Date();
    }
    await this.repo.update({ id, userId }, update);

    // When task finishes, persist in-memory logs to DB
    if (status === TaskStatus.COMPLETED || status === TaskStatus.FAILED || status === TaskStatus.CANCELLED) {
      await this.persistLogsToDb(id);
    }

    return this.findOne(userId, id);
  }

  /** Save in-memory logs to task_execution_logs table */
  async persistLogsToDb(taskId: string): Promise<void> {
    const entries = getLogs(taskId);
    if (!entries.length) return;
    try {
      // Delete previous logs for this task first
      await this.logRepo.delete({ taskId });
      const rows = entries.map(e => this.logRepo.create({
        taskId,
        status: toLogStatus(e.level),
        message: `[${e.time}] ${e.message}`,
        details: { level: e.level, time: e.time },
      }));
      await this.logRepo.save(rows);
    } catch (err) {
      this.logger.warn(`日志持久化失败: ${err.message}`);
    }
  }

  /** Get logs: in-memory first, fall back to DB */
  async getExecutionLogs(taskId: string): Promise<ExecutionLogEntry[]> {
    const memLogs = getLogs(taskId);
    if (memLogs.length > 0) return memLogs;

    // Fall back to DB logs (e.g. after backend restart)
    try {
      const dbLogs = await this.logRepo.find({
        where: { taskId },
        order: { createdAt: 'ASC' },
      });
      return dbLogs.map(l => ({
        time: l.details?.time || new Date(l.createdAt).toLocaleTimeString('zh-CN'),
        level: (l.details?.level as ExecutionLogEntry['level']) || 'info',
        message: l.details?.time
          ? l.message.replace(`[${l.details.time}] `, '')
          : l.message,
      }));
    } catch {
      return [];
    }
  }
}
