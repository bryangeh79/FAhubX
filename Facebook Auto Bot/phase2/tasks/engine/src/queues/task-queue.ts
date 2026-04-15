/**
 * 任务队列（基于Bull）
 */

import Queue from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import {
  TaskDefinition,
  TaskStatus,
  TaskEvent,
  TaskEventType,
  QueueConfig,
  ITaskQueue
} from '../types';

/**
 * 基于Bull的任务队列
 */
export class TaskQueue implements ITaskQueue {
  private readonly queue: Queue.Queue;
  private readonly logger: Logger;
  private readonly eventCallbacks: Map<TaskEventType, Array<(event: TaskEvent) => void>>;
  
  constructor(config: QueueConfig) {
    this.logger = createLogger(`task-queue:${config.name}`);
    this.eventCallbacks = new Map();
    
    // 初始化Redis连接
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      ...config.redisOptions
    };
    
    // 创建队列
    this.queue = new Queue(config.name, {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100, // 保留最近100个完成的任务
        removeOnFail: 50, // 保留最近50个失败的任务
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        ...config.defaultJobOptions
      },
      limiter: config.limiter,
      settings: config.settings
    });
    
    // 设置队列事件监听
    this.setupEventListeners();
    
    this.logger.info('任务队列已初始化', {
      queueName: config.name,
      redisHost: redisConfig.host,
      redisPort: redisConfig.port
    });
  }
  
  /**
   * 入队任务
   */
  async enqueue(task: TaskDefinition): Promise<string> {
    // 确保任务有ID
    if (!task.id) {
      task.id = `task_${Date.now()}_${uuidv4().substr(0, 8)}`;
    }
    
    // 更新任务状态
    task.status = TaskStatus.QUEUED;
    task.updatedAt = new Date();
    
    this.logger.info('任务入队', {
      taskId: task.id,
      taskName: task.name,
      priority: task.priority
    });
    
    // 添加到队列
    const job = await this.queue.add(task, {
      jobId: task.id,
      priority: task.priority,
      delay: 0
    });
    
    // 触发任务入队事件
    this.emitEvent({
      type: TaskEventType.TASK_QUEUED,
      taskId: task.id,
      timestamp: new Date(),
      data: { taskName: task.name }
    });
    
    return job.id.toString();
  }
  
  /**
   * 出队任务
   */
  async dequeue(): Promise<TaskDefinition | null> {
    // Bull是工作器驱动的，不直接提供dequeue方法
    // 这里实现一个简单的轮询机制
    const job = await this.queue.getNextJob();
    
    if (!job) {
      return null;
    }
    
    // 获取任务数据
    const task = job.data as TaskDefinition;
    
    // 更新任务状态
    task.status = TaskStatus.PROCESSING;
    task.updatedAt = new Date();
    
    this.logger.debug('任务出队', { taskId: task.id });
    
    // 触发任务开始事件
    this.emitEvent({
      type: TaskEventType.TASK_STARTED,
      taskId: task.id,
      timestamp: new Date(),
      data: { taskName: task.name }
    });
    
    return task;
  }
  
  /**
   * 查看队列中的下一个任务
   */
  async peek(): Promise<TaskDefinition | null> {
    // Bull不直接提供peek方法
    // 这里通过获取等待中的任务来实现
    const jobs = await this.queue.getWaiting(0, 1);
    
    if (jobs.length === 0) {
      return null;
    }
    
    return jobs[0].data as TaskDefinition;
  }
  
  /**
   * 获取队列大小
   */
  async size(): Promise<number> {
    const counts = await this.queue.getJobCounts();
    return counts.waiting + counts.active + counts.delayed;
  }
  
  /**
   * 清空队列
   */
  async clear(): Promise<void> {
    await this.queue.empty();
    this.logger.info('队列已清空');
    
    // 触发队列清空事件
    this.emitEvent({
      type: TaskEventType.QUEUE_EMPTY,
      timestamp: new Date(),
      data: { queueName: this.queue.name }
    });
  }
  
  /**
   * 移除任务
   */
  async remove(taskId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(taskId);
      
      if (!job) {
        this.logger.warn('任务不存在，无法移除', { taskId });
        return false;
      }
      
      await job.remove();
      
      this.logger.info('任务已从队列移除', { taskId });
      
      // 触发任务取消事件
      this.emitEvent({
        type: TaskEventType.TASK_CANCELLED,
        taskId,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      this.logger.error('移除任务时发生错误', { taskId, error });
      return false;
    }
  }
  
  /**
   * 获取队列统计信息
   */
  async getStats(): Promise<any> {
    const counts = await this.queue.getJobCounts();
    const isPaused = await this.queue.isPaused();
    
    return {
      queueName: this.queue.name,
      counts,
      isPaused,
      timestamp: new Date()
    };
  }
  
  /**
   * 暂停队列
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    this.logger.info('队列已暂停');
  }
  
  /**
   * 恢复队列
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    this.logger.info('队列已恢复');
  }
  
  /**
   * 关闭队列
   */
  async close(): Promise<void> {
    await this.queue.close();
    this.logger.info('队列已关闭');
  }
  
  /**
   * 获取队列实例
   */
  getQueue(): Queue.Queue {
    return this.queue;
  }
  
  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 任务完成事件
    this.queue.on('completed', (job, result) => {
      this.logger.info('任务完成', {
        taskId: job.id,
        result: typeof result === 'object' ? JSON.stringify(result) : result
      });
      
      this.emitEvent({
        type: TaskEventType.TASK_COMPLETED,
        taskId: job.id?.toString(),
        timestamp: new Date(),
        data: { result }
      });
    });
    
    // 任务失败事件
    this.queue.on('failed', (job, error) => {
      this.logger.error('任务失败', {
        taskId: job?.id,
        error: error.message
      });
      
      this.emitEvent({
        type: TaskEventType.TASK_FAILED,
        taskId: job?.id?.toString(),
        timestamp: new Date(),
        data: { error: error.message }
      });
    });
    
    // 任务重试事件
    this.queue.on('retrying', (job, error) => {
      this.logger.warn('任务重试', {
        taskId: job.id,
        attempt: job.attemptsMade,
        error: error.message
      });
      
      this.emitEvent({
        type: TaskEventType.TASK_RETRYING,
        taskId: job.id?.toString(),
        timestamp: new Date(),
        data: { 
          attempt: job.attemptsMade,
          error: error.message 
        }
      });
    });
    
    // 队列空事件
    this.queue.on('drained', () => {
      this.logger.info('队列已空');
      
      this.emitEvent({
        type: TaskEventType.QUEUE_EMPTY,
        timestamp: new Date(),
        data: { queueName: this.queue.name }
      });
    });
    
    // 错误事件
    this.queue.on('error', (error) => {
      this.logger.error('队列错误', { error: error.message });
      
      this.emitEvent({
        type: TaskEventType.ERROR_OCCURRED,
        timestamp: new Date(),
        data: { error: error.message }
      });
    });
  }
  
  /**
   * 触发事件
   */
  private emitEvent(event: TaskEvent): void {
    const callbacks = this.eventCallbacks.get(event.type) || [];
    
    callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('事件回调执行错误', { 
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }
  
  /**
   * 订阅事件
   */
  subscribe(eventType: TaskEventType, callback: (event: TaskEvent) => void): void {
    if (!this.eventCallbacks.has(eventType)) {
      this.eventCallbacks.set(eventType, []);
    }
    
    const callbacks = this.eventCallbacks.get(eventType)!;
    
    // 避免重复订阅
    if (!callbacks.includes(callback)) {
      callbacks.push(callback);
      this.logger.debug('事件订阅已添加', { eventType });
    }
  }
  
  /**
   * 取消订阅
   */
  unsubscribe(eventType: TaskEventType, callback: (event: TaskEvent) => void): void {
    const callbacks = this.eventCallbacks.get(eventType);
    
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
        this.logger.debug('事件订阅已移除', { eventType });
      }
    }
  }
  
  /**
   * 创建默认队列配置
   */
  static createDefaultConfig(queueName: string): QueueConfig {
    return {
      name: queueName,
      redisUrl: process.env.REDIS_URL,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      },
      limiter: {
        max: 10, // 每秒最大任务数
        duration: 1000
      },
      settings: {
        lockDuration: 30000,
        lockRenewTime: 15000,
        stalledInterval: 30000,
        maxStalledCount: 1,
        guardInterval: 5000,
        retryProcessDelay: 5000,
        drainDelay: 5000
      }
    };
  }
}