/**
 * 任务执行引擎类型定义
 */

import { OperationType, OperationPriority, OperationResult } from '@facebook-bot/facebook-operations';

/**
 * 任务状态
 */
export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying'
}

/**
 * 任务类型
 */
export enum TaskType {
  SINGLE_OPERATION = 'single_operation',
  BATCH_OPERATIONS = 'batch_operations',
  SCHEDULED_OPERATION = 'scheduled_operation',
  RECURRING_OPERATION = 'recurring_operation'
}

/**
 * 任务优先级
 */
export enum TaskPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

/**
 * 任务配置
 */
export interface TaskConfig {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  concurrency: number;
  requireSession: boolean;
  metadata?: Record<string, any>;
}

/**
 * 任务数据
 */
export interface TaskData {
  operationType: OperationType;
  operationParams: any;
  accountId?: string;
  sessionId?: string;
  schedule?: TaskSchedule;
  metadata?: Record<string, any>;
}

/**
 * 任务计划
 */
export interface TaskSchedule {
  cronExpression?: string;
  startAt?: Date;
  endAt?: Date;
  repeatCount?: number;
  repeatInterval?: number; // 毫秒
}

/**
 * 任务结果
 */
export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  operationResults: OperationResult[];
  startTime: Date;
  endTime: Date;
  duration: number;
  error?: string;
  errorCode?: string;
  retryCount: number;
  metadata?: Record<string, any>;
}

/**
 * 任务定义
 */
export interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  config: TaskConfig;
  data: TaskData;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy?: string;
  tags?: string[];
}

/**
 * 队列配置
 */
export interface QueueConfig {
  name: string;
  redisUrl?: string;
  redisOptions?: any;
  defaultJobOptions?: any;
  limiter?: {
    max: number;
    duration: number;
  };
  settings?: {
    lockDuration: number;
    lockRenewTime: number;
    stalledInterval: number;
    maxStalledCount: number;
    guardInterval: number;
    retryProcessDelay: number;
    drainDelay: number;
  };
}

/**
 * 工作器配置
 */
export interface WorkerConfig {
  name: string;
  concurrency: number;
  lockDuration: number;
  lockRenewTime: number;
  stalledInterval: number;
  maxStalledCount: number;
  settings?: any;
}

/**
 * 监控指标
 */
export interface TaskMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  processingTasks: number;
  averageProcessingTime: number;
  successRate: number;
  throughput: number; // 任务/分钟
  queueLength: number;
  workerCount: number;
  timestamp: Date;
}

/**
 * 事件类型
 */
export enum TaskEventType {
  TASK_CREATED = 'task_created',
  TASK_QUEUED = 'task_queued',
  TASK_STARTED = 'task_started',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  TASK_RETRYING = 'task_retrying',
  TASK_CANCELLED = 'task_cancelled',
  WORKER_STARTED = 'worker_started',
  WORKER_STOPPED = 'worker_stopped',
  QUEUE_EMPTY = 'queue_empty',
  ERROR_OCCURRED = 'error_occurred'
}

/**
 * 事件数据
 */
export interface TaskEvent {
  type: TaskEventType;
  taskId?: string;
  workerId?: string;
  queueName?: string;
  data?: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * 任务执行器接口
 */
export interface ITaskExecutor {
  execute(task: TaskDefinition): Promise<TaskResult>;
  cancel(taskId: string): Promise<boolean>;
  getStatus(taskId: string): Promise<TaskStatus>;
  getResult(taskId: string): Promise<TaskResult | null>;
}

/**
 * 任务调度器接口
 */
export interface ITaskScheduler {
  schedule(task: TaskDefinition): Promise<string>;
  unschedule(taskId: string): Promise<boolean>;
  getScheduledTasks(): Promise<TaskDefinition[]>;
  reschedule(taskId: string, schedule: TaskSchedule): Promise<boolean>;
}

/**
 * 任务队列接口
 */
export interface ITaskQueue {
  enqueue(task: TaskDefinition): Promise<string>;
  dequeue(): Promise<TaskDefinition | null>;
  peek(): Promise<TaskDefinition | null>;
  size(): Promise<number>;
  clear(): Promise<void>;
  remove(taskId: string): Promise<boolean>;
}

/**
 * 任务监控器接口
 */
export interface ITaskMonitor {
  getMetrics(): Promise<TaskMetrics>;
  getEvents(since?: Date): Promise<TaskEvent[]>;
  subscribe(eventTypes: TaskEventType[], callback: (event: TaskEvent) => void): void;
  unsubscribe(eventTypes: TaskEventType[], callback: (event: TaskEvent) => void): void;
}

/**
 * 工作器接口
 */
export interface IWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  isRunning(): boolean;
  getStats(): any;
}