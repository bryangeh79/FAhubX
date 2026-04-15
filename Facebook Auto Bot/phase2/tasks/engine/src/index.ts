/**
 * 任务执行引擎主入口
 */

// 导出核心类
export { BaseTaskExecutor } from './core/base-task-executor';

// 导出执行器
export { SingleTaskExecutor } from './executors/single-task-executor';
export { BatchTaskExecutor } from './executors/batch-task-executor';

// 导出队列
export { TaskQueue } from './queues/task-queue';

// 导出调度器
export { TaskScheduler } from './schedulers/task-scheduler';

// 导出工具类
export { TaskEngineLogger, PerformanceLogger, createLogger } from './utils/logger';

// 导出类型
export * from './types';

// 导出常量
export { TaskStatus, TaskType, TaskPriority, TaskEventType } from './types';

/**
 * 任务执行引擎版本
 */
export const VERSION = '1.0.0';

/**
 * 初始化任务引擎
 */
export function initializeTaskEngine(): void {
  console.log(`任务执行引擎 v${VERSION} 已初始化`);
  console.log('支持的任务类型:', Object.values(TaskType).join(', '));
  console.log('支持的事件类型:', Object.values(TaskEventType).join(', '));
}

/**
 * 创建单任务执行器实例
 */
export function createSingleTaskExecutor(): SingleTaskExecutor {
  return new SingleTaskExecutor();
}

/**
 * 创建批量任务执行器实例
 */
export function createBatchTaskExecutor(maxConcurrency: number = 3): BatchTaskExecutor {
  return new BatchTaskExecutor(maxConcurrency);
}

/**
 * 创建任务队列实例
 */
export function createTaskQueue(config: any): TaskQueue {
  return new TaskQueue(config);
}

/**
 * 创建任务调度器实例
 */
export function createTaskScheduler(): TaskScheduler {
  return new TaskScheduler();
}

/**
 * 执行单任务（快捷方法）
 */
export async function executeSingleTask(
  name: string,
  operationType: any,
  operationParams: any,
  accountId: string,
  sessionId?: string
): Promise<any> {
  const executor = createSingleTaskExecutor();
  return await executor.executeSimpleTask(
    name,
    operationType,
    operationParams,
    accountId,
    sessionId
  );
}

/**
 * 执行批量任务（快捷方法）
 */
export async function executeBatchTasks(
  name: string,
  operations: Array<{
    type: any;
    params: any;
  }>,
  accountId: string,
  sessionId?: string,
  concurrency: number = 3
): Promise<any> {
  const executor = createBatchTaskExecutor(concurrency);
  const task = BatchTaskExecutor.createBatchTask(
    name,
    operations,
    accountId,
    sessionId,
    2,
    concurrency
  );
  
  const result = await executor.execute(task);
  return result;
}

/**
 * 调度任务（快捷方法）
 */
export async function scheduleTask(
  name: string,
  operationType: any,
  operationParams: any,
  schedule: any,
  accountId: string,
  sessionId?: string
): Promise<string> {
  const scheduler = createTaskScheduler();
  const task = TaskScheduler.createScheduledTask(
    name,
    operationType,
    operationParams,
    schedule,
    accountId,
    sessionId
  );
  
  return await scheduler.schedule(task);
}

/**
 * 任务引擎管理器
 */
export class TaskEngineManager {
  private singleExecutor: SingleTaskExecutor;
  private batchExecutor: BatchTaskExecutor;
  private scheduler: TaskScheduler;
  private queues: Map<string, TaskQueue>;
  
  constructor() {
    this.singleExecutor = new SingleTaskExecutor();
    this.batchExecutor = new BatchTaskExecutor();
    this.scheduler = new TaskScheduler();
    this.queues = new Map();
    
    TaskEngineLogger.info('任务引擎管理器已初始化');
  }
  
  /**
   * 获取单任务执行器
   */
  getSingleExecutor(): SingleTaskExecutor {
    return this.singleExecutor;
  }
  
  /**
   * 获取批量任务执行器
   */
  getBatchExecutor(): BatchTaskExecutor {
    return this.batchExecutor;
  }
  
  /**
   * 获取任务调度器
   */
  getScheduler(): TaskScheduler {
    return this.scheduler;
  }
  
  /**
   * 创建队列
   */
  createQueue(queueName: string, config?: any): TaskQueue {
    const queueConfig = config || TaskQueue.createDefaultConfig(queueName);
    const queue = new TaskQueue(queueConfig);
    this.queues.set(queueName, queue);
    return queue;
  }
  
  /**
   * 获取队列
   */
  getQueue(queueName: string): TaskQueue | undefined {
    return this.queues.get(queueName);
  }
  
  /**
   * 关闭所有队列
   */
  async closeAllQueues(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(closePromises);
    this.queues.clear();
    
    TaskEngineLogger.info('所有队列已关闭');
  }
  
  /**
   * 停止所有调度任务
   */
  async stopAllScheduledTasks(): Promise<void> {
    await this.scheduler.stopAll();
  }
  
  /**
   * 获取引擎状态
   */
  getEngineStatus(): any {
    return {
      version: VERSION,
      singleExecutor: {
        totalTasks: this.singleExecutor.getAllTasks().length,
        totalResults: this.singleExecutor.getAllResults().length
      },
      batchExecutor: {
        totalTasks: this.batchExecutor.getAllTasks().length,
        totalResults: this.batchExecutor.getAllResults().length,
        maxConcurrency: this.batchExecutor.getMaxConcurrency()
      },
      scheduler: {
        scheduledTasks: this.scheduler.getScheduledTasks().length,
        activeJobs: this.scheduler.getActiveJobs().size
      },
      queues: {
        count: this.queues.size,
        queueNames: Array.from(this.queues.keys())
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 创建任务引擎管理器实例
 */
export function createTaskEngineManager(): TaskEngineManager {
  return new TaskEngineManager();
}