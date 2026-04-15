/**
 * 基础任务执行器
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import {
  TaskStatus,
  TaskResult,
  TaskDefinition,
  ITaskExecutor
} from '../types';
import {
  executeOperation,
  OperationResult,
  OperationType,
  BaseOperationParams
} from '@facebook-bot/facebook-operations';

/**
 * 抽象基础任务执行器
 */
export abstract class BaseTaskExecutor implements ITaskExecutor {
  protected readonly id: string;
  protected readonly logger: Logger;
  protected readonly taskRegistry: Map<string, TaskDefinition>;
  protected readonly resultRegistry: Map<string, TaskResult>;
  
  constructor() {
    this.id = uuidv4();
    this.logger = createLogger(`task-executor:${this.id}`);
    this.taskRegistry = new Map();
    this.resultRegistry = new Map();
  }
  
  /**
   * 执行任务
   */
  async execute(task: TaskDefinition): Promise<TaskResult> {
    const startTime = new Date();
    let retryCount = 0;
    let lastError: Error | undefined;
    
    // 更新任务状态
    task.status = TaskStatus.PROCESSING;
    task.startedAt = new Date();
    this.taskRegistry.set(task.id, task);
    
    this.logger.info(`开始执行任务: ${task.name}`, { 
      taskId: task.id,
      type: task.type,
      priority: task.priority
    });
    
    // 验证任务
    try {
      await this.validateTask(task);
    } catch (error) {
      this.logger.error('任务验证失败', { 
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return this.createErrorResult(
        task.id,
        'TASK_VALIDATION_FAILED',
        error instanceof Error ? error.message : '任务验证失败',
        startTime,
        new Date()
      );
    }
    
    // 重试逻辑
    const maxRetries = task.config.maxRetries || 3;
    
    while (retryCount <= maxRetries) {
      try {
        const operationResults = await this.executeTaskInternal(task);
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        // 创建成功结果
        const result: TaskResult = {
          taskId: task.id,
          status: TaskStatus.COMPLETED,
          operationResults,
          startTime,
          endTime,
          duration,
          retryCount,
          metadata: {
            taskName: task.name,
            taskType: task.type,
            priority: task.priority
          }
        };
        
        // 更新任务状态
        task.status = TaskStatus.COMPLETED;
        task.completedAt = endTime;
        this.taskRegistry.set(task.id, task);
        this.resultRegistry.set(task.id, result);
        
        this.logger.info(`任务执行成功`, {
          taskId: task.id,
          duration,
          operationCount: operationResults.length,
          retryCount
        });
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;
        
        this.logger.warn(`任务执行失败，准备重试`, {
          taskId: task.id,
          error: lastError.message,
          retryCount,
          maxRetries
        });
        
        if (retryCount <= maxRetries) {
          // 更新任务状态为重试中
          task.status = TaskStatus.RETRYING;
          this.taskRegistry.set(task.id, task);
          
          // 等待重试延迟
          const retryDelay = task.config.retryDelay || 5000;
          await this.delay(retryDelay);
          continue;
        }
      }
    }
    
    // 所有重试都失败
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    // 更新任务状态为失败
    task.status = TaskStatus.FAILED;
    this.taskRegistry.set(task.id, task);
    
    this.logger.error(`任务执行失败，已达到最大重试次数`, {
      taskId: task.id,
      error: lastError?.message,
      retryCount,
      duration
    });
    
    const errorResult = this.createErrorResult(
      task.id,
      'TASK_EXECUTION_FAILED',
      lastError?.message || '任务执行失败',
      startTime,
      endTime,
      retryCount
    );
    
    this.resultRegistry.set(task.id, errorResult);
    return errorResult;
  }
  
  /**
   * 取消任务
   */
  async cancel(taskId: string): Promise<boolean> {
    const task = this.taskRegistry.get(taskId);
    
    if (!task) {
      this.logger.warn(`任务不存在，无法取消`, { taskId });
      return false;
    }
    
    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
      this.logger.warn(`任务已结束，无法取消`, { 
        taskId,
        status: task.status 
      });
      return false;
    }
    
    // 更新任务状态
    task.status = TaskStatus.CANCELLED;
    task.updatedAt = new Date();
    this.taskRegistry.set(taskId, task);
    
    this.logger.info(`任务已取消`, { taskId });
    
    // 执行取消逻辑
    await this.cancelTaskInternal(taskId);
    
    return true;
  }
  
  /**
   * 获取任务状态
   */
  async getStatus(taskId: string): Promise<TaskStatus> {
    const task = this.taskRegistry.get(taskId);
    
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }
    
    return task.status;
  }
  
  /**
   * 获取任务结果
   */
  async getResult(taskId: string): Promise<TaskResult | null> {
    return this.resultRegistry.get(taskId) || null;
  }
  
  /**
   * 验证任务
   */
  protected async validateTask(task: TaskDefinition): Promise<void> {
    // 基础验证
    if (!task.id) {
      throw new Error('任务ID不能为空');
    }
    
    if (!task.name || task.name.trim().length === 0) {
      throw new Error('任务名称不能为空');
    }
    
    if (!task.data || !task.data.operationType) {
      throw new Error('任务数据不完整，缺少操作类型');
    }
    
    if (task.config.requireSession && !task.data.sessionId) {
      throw new Error('任务需要会话ID');
    }
    
    if (!task.data.accountId) {
      throw new Error('任务需要账户ID');
    }
    
    // 验证操作参数
    await this.validateOperationParams(task.data.operationType, task.data.operationParams);
  }
  
  /**
   * 验证操作参数
   */
  protected async validateOperationParams(
    operationType: OperationType,
    operationParams: any
  ): Promise<void> {
    // 这里可以添加具体的操作参数验证逻辑
    // 目前只做基础检查
    
    if (!operationParams) {
      throw new Error('操作参数不能为空');
    }
    
    // 可以根据不同的操作类型添加特定的验证
    switch (operationType) {
      case OperationType.POST:
        if (!operationParams.content) {
          throw new Error('发帖操作需要内容');
        }
        break;
        
      case OperationType.LIKE:
        if (!operationParams.postUrl) {
          throw new Error('点赞操作需要帖子URL');
        }
        break;
        
      case OperationType.COMMENT:
        if (!operationParams.postUrl || !operationParams.content) {
          throw new Error('评论操作需要帖子URL和内容');
        }
        break;
        
      default:
        // 其他操作类型的验证可以在这里添加
        break;
    }
  }
  
  /**
   * 执行单个操作
   */
  protected async executeSingleOperation(
    operationType: OperationType,
    operationParams: any,
    context: any
  ): Promise<OperationResult> {
    const params: BaseOperationParams = {
      type: operationType,
      ...operationParams,
      context
    };
    
    return await executeOperation(params);
  }
  
  /**
   * 创建错误结果
   */
  protected createErrorResult(
    taskId: string,
    errorCode: string,
    errorMessage: string,
    startTime: Date,
    endTime: Date,
    retryCount: number = 0
  ): TaskResult {
    const duration = endTime.getTime() - startTime.getTime();
    
    return {
      taskId,
      status: TaskStatus.FAILED,
      operationResults: [],
      startTime,
      endTime,
      duration,
      error: errorMessage,
      errorCode,
      retryCount,
      metadata: {
        errorTime: endTime.toISOString()
      }
    };
  }
  
  /**
   * 延迟函数
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 获取所有任务
   */
  getAllTasks(): TaskDefinition[] {
    return Array.from(this.taskRegistry.values());
  }
  
  /**
   * 获取所有结果
   */
  getAllResults(): TaskResult[] {
    return Array.from(this.resultRegistry.values());
  }
  
  /**
   * 清理已完成的任务
   */
  cleanupCompletedTasks(maxAgeHours: number = 24): void {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
    
    let cleanedCount = 0;
    
    for (const [taskId, task] of this.taskRegistry.entries()) {
      if (
        (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) &&
        task.completedAt && task.completedAt < cutoffTime
      ) {
        this.taskRegistry.delete(taskId);
        this.resultRegistry.delete(taskId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.info(`清理了 ${cleanedCount} 个旧任务`);
    }
  }
  
  /**
   * 内部执行方法（子类必须实现）
   */
  protected abstract executeTaskInternal(task: TaskDefinition): Promise<OperationResult[]>;
  
  /**
   * 内部取消方法（子类可以覆盖）
   */
  protected async cancelTaskInternal(taskId: string): Promise<void> {
    // 默认实现，子类可以覆盖以添加特定的取消逻辑
    this.logger.debug(`执行任务取消逻辑`, { taskId });
  }
}