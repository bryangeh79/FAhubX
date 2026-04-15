/**
 * 任务调度器
 */

import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import {
  TaskDefinition,
  TaskType,
  TaskStatus,
  TaskSchedule,
  TaskEvent,
  TaskEventType,
  ITaskScheduler
} from '../types';

/**
 * 任务调度器
 */
export class TaskScheduler implements ITaskScheduler {
  private readonly logger: Logger;
  private readonly scheduledJobs: Map<string, CronJob>;
  private readonly taskRegistry: Map<string, TaskDefinition>;
  private readonly eventCallbacks: Map<TaskEventType, Array<(event: TaskEvent) => void>>;
  
  constructor() {
    this.logger = createLogger('task-scheduler');
    this.scheduledJobs = new Map();
    this.taskRegistry = new Map();
    this.eventCallbacks = new Map();
    
    this.logger.info('任务调度器已初始化');
  }
  
  /**
   * 调度任务
   */
  async schedule(task: TaskDefinition): Promise<string> {
    // 验证任务
    await this.validateTaskForScheduling(task);
    
    // 确保任务有ID
    if (!task.id) {
      task.id = `scheduled_${Date.now()}_${uuidv4().substr(0, 8)}`;
    }
    
    // 获取调度配置
    const schedule = task.data.schedule;
    
    if (!schedule) {
      throw new Error('任务缺少调度配置');
    }
    
    // 创建Cron作业
    const cronExpression = schedule.cronExpression;
    
    if (!cronExpression) {
      throw new Error('调度任务需要cron表达式');
    }
    
    // 创建CronJob
    const job = new CronJob(
      cronExpression,
      () => {
        this.executeScheduledTask(task);
      },
      null, // onComplete
      true, // start immediately
      'UTC' // timezone
    );
    
    // 存储作业和任务
    this.scheduledJobs.set(task.id, job);
    this.taskRegistry.set(task.id, task);
    
    // 设置任务状态
    task.status = TaskStatus.PENDING;
    task.scheduledAt = new Date();
    task.updatedAt = new Date();
    
    this.logger.info('任务已调度', {
      taskId: task.id,
      taskName: task.name,
      cronExpression,
      startAt: schedule.startAt,
      endAt: schedule.endAt
    });
    
    // 触发任务创建事件
    this.emitEvent({
      type: TaskEventType.TASK_CREATED,
      taskId: task.id,
      timestamp: new Date(),
      data: { 
        taskName: task.name,
        cronExpression,
        type: TaskType.SCHEDULED_OPERATION
      }
    });
    
    return task.id;
  }
  
  /**
   * 取消调度任务
   */
  async unschedule(taskId: string): Promise<boolean> {
    const job = this.scheduledJobs.get(taskId);
    
    if (!job) {
      this.logger.warn('调度任务不存在，无法取消', { taskId });
      return false;
    }
    
    // 停止Cron作业
    job.stop();
    
    // 从注册表中移除
    this.scheduledJobs.delete(taskId);
    
    // 更新任务状态
    const task = this.taskRegistry.get(taskId);
    if (task) {
      task.status = TaskStatus.CANCELLED;
      task.updatedAt = new Date();
    }
    
    this.logger.info('调度任务已取消', { taskId });
    
    // 触发任务取消事件
    this.emitEvent({
      type: TaskEventType.TASK_CANCELLED,
      taskId,
      timestamp: new Date()
    });
    
    return true;
  }
  
  /**
   * 获取所有调度任务
   */
  async getScheduledTasks(): Promise<TaskDefinition[]> {
    return Array.from(this.taskRegistry.values());
  }
  
  /**
   * 重新调度任务
   */
  async reschedule(taskId: string, schedule: TaskSchedule): Promise<boolean> {
    // 先取消现有调度
    const unscheduled = await this.unschedule(taskId);
    
    if (!unscheduled) {
      return false;
    }
    
    // 获取任务
    const task = this.taskRegistry.get(taskId);
    
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }
    
    // 更新调度配置
    task.data.schedule = schedule;
    task.updatedAt = new Date();
    
    // 重新调度
    await this.schedule(task);
    
    this.logger.info('任务已重新调度', { taskId });
    
    return true;
  }
  
  /**
   * 执行调度任务
   */
  private async executeScheduledTask(task: TaskDefinition): Promise<void> {
    this.logger.info('执行调度任务', {
      taskId: task.id,
      taskName: task.name,
      executionTime: new Date().toISOString()
    });
    
    // 触发任务开始事件
    this.emitEvent({
      type: TaskEventType.TASK_STARTED,
      taskId: task.id,
      timestamp: new Date(),
      data: { taskName: task.name }
    });
    
    try {
      // 这里应该调用任务执行器来执行任务
      // 目前只是记录日志
      this.logger.info('调度任务执行逻辑待实现', { taskId: task.id });
      
      // 模拟任务执行
      await this.delay(1000);
      
      // 触发任务完成事件
      this.emitEvent({
        type: TaskEventType.TASK_COMPLETED,
        taskId: task.id,
        timestamp: new Date(),
        data: { taskName: task.name }
      });
      
    } catch (error) {
      this.logger.error('调度任务执行失败', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // 触发任务失败事件
      this.emitEvent({
        type: TaskEventType.TASK_FAILED,
        taskId: task.id,
        timestamp: new Date(),
        data: { 
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
  
  /**
   * 验证调度任务
   */
  private async validateTaskForScheduling(task: TaskDefinition): Promise<void> {
    // 基础验证
    if (!task.name || task.name.trim().length === 0) {
      throw new Error('任务名称不能为空');
    }
    
    if (!task.data || !task.data.schedule) {
      throw new Error('调度任务需要调度配置');
    }
    
    const schedule = task.data.schedule;
    
    // 验证cron表达式
    if (schedule.cronExpression) {
      try {
        // 尝试创建CronJob来验证表达式
        new CronJob(schedule.cronExpression, () => {}, null, false);
      } catch (error) {
        throw new Error(`无效的cron表达式: ${schedule.cronExpression}`);
      }
    } else if (schedule.startAt) {
      // 验证开始时间
      const startTime = new Date(schedule.startAt);
      if (isNaN(startTime.getTime())) {
        throw new Error('无效的开始时间');
      }
      
      // 检查开始时间是否在未来
      if (startTime <= new Date()) {
        throw new Error('开始时间必须在未来');
      }
    } else {
      throw new Error('调度任务需要cron表达式或开始时间');
    }
    
    // 验证结束时间（如果提供）
    if (schedule.endAt) {
      const endTime = new Date(schedule.endAt);
      if (isNaN(endTime.getTime())) {
        throw new Error('无效的结束时间');
      }
      
      if (schedule.startAt) {
        const startTime = new Date(schedule.startAt);
        if (endTime <= startTime) {
          throw new Error('结束时间必须在开始时间之后');
        }
      }
    }
    
    // 验证重复次数和间隔
    if (schedule.repeatCount !== undefined && schedule.repeatCount < 1) {
      throw new Error('重复次数必须大于0');
    }
    
    if (schedule.repeatInterval !== undefined && schedule.repeatInterval < 1000) {
      throw new Error('重复间隔必须至少1000毫秒');
    }
  }
  
  /**
   * 创建调度任务
   */
  static createScheduledTask(
    name: string,
    operationType: any,
    operationParams: any,
    schedule: TaskSchedule,
    accountId: string,
    sessionId?: string,
    priority: number = 2
  ): TaskDefinition {
    const taskId = `scheduled_${Date.now()}_${uuidv4().substr(0, 8)}`;
    
    return {
      id: taskId,
      name,
      type: TaskType.SCHEDULED_OPERATION,
      priority,
      config: {
        id: taskId,
        type: TaskType.SCHEDULED_OPERATION,
        priority,
        maxRetries: 3,
        retryDelay: 5000,
        timeout: 30000,
        concurrency: 1,
        requireSession: true,
        metadata: {}
      },
      data: {
        operationType,
        operationParams,
        schedule,
        accountId,
        sessionId
      },
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      tags: ['scheduled', 'operation']
    };
  }
  
  /**
   * 创建重复任务
   */
  static createRecurringTask(
    name: string,
    operationType: any,
    operationParams: any,
    intervalMs: number,
    repeatCount: number,
    accountId: string,
    sessionId?: string,
    priority: number = 2
  ): TaskDefinition {
    const taskId = `recurring_${Date.now()}_${uuidv4().substr(0, 8)}`;
    
    return {
      id: taskId,
      name,
      type: TaskType.RECURRING_OPERATION,
      priority,
      config: {
        id: taskId,
        type: TaskType.RECURRING_OPERATION,
        priority,
        maxRetries: 2,
        retryDelay: 3000,
        timeout: 60000,
        concurrency: 1,
        requireSession: true,
        metadata: {}
      },
      data: {
        operationType,
        operationParams,
        schedule: {
          repeatInterval: intervalMs,
          repeatCount
        },
        accountId,
        sessionId
      },
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      tags: ['recurring', 'operation']
    };
  }
  
  /**
   * 获取所有活动的Cron作业
   */
  getActiveJobs(): Map<string, CronJob> {
    return new Map(this.scheduledJobs);
  }
  
  /**
   * 停止所有调度任务
   */
  async stopAll(): Promise<void> {
    let stoppedCount = 0;
    
    for (const [taskId, job] of this.scheduledJobs.entries()) {
      job.stop();
      stoppedCount++;
      
      // 更新任务状态
      const task = this.taskRegistry.get(taskId);
      if (task) {
        task.status = TaskStatus.CANCELLED;
        task.updatedAt = new Date();
      }
    }
    
    this.scheduledJobs.clear();
    
    this.logger.info('所有调度任务已停止', { stoppedCount });
  }
  
  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
}