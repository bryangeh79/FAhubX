/**
 * 单任务执行器
 */

import { BaseTaskExecutor } from '../core/base-task-executor';
import {
  TaskDefinition,
  TaskType,
  TaskStatus
} from '../types';
import {
  OperationResult,
  OperationType
} from '@facebook-bot/facebook-operations';

/**
 * 单任务执行器
 * 用于执行单个操作任务
 */
export class SingleTaskExecutor extends BaseTaskExecutor {
  
  constructor() {
    super();
    this.logger.info('单任务执行器已初始化');
  }
  
  /**
   * 执行单个操作任务
   */
  protected async executeTaskInternal(task: TaskDefinition): Promise<OperationResult[]> {
    const results: OperationResult[] = [];
    
    // 验证任务类型
    if (task.type !== TaskType.SINGLE_OPERATION) {
      throw new Error(`不支持的任務類型: ${task.type}，單任務執行器只支持 SINGLE_OPERATION`);
    }
    
    // 准备执行上下文
    const context = {
      sessionId: task.data.sessionId,
      accountId: task.data.accountId,
      metadata: task.metadata
    };
    
    this.logger.info('开始执行单个操作', {
      taskId: task.id,
      operationType: task.data.operationType,
      accountId: task.data.accountId
    });
    
    // 执行单个操作
    const result = await this.executeSingleOperation(
      task.data.operationType,
      task.data.operationParams,
      context
    );
    
    results.push(result);
    
    // 检查操作结果
    if (result.status !== 'success') {
      throw new Error(`操作执行失败: ${result.error || '未知错误'}`);
    }
    
    this.logger.info('单个操作执行完成', {
      taskId: task.id,
      operationType: task.data.operationType,
      resultStatus: result.status,
      duration: result.duration
    });
    
    return results;
  }
  
  /**
   * 验证任务（覆盖父类方法）
   */
  protected async validateTask(task: TaskDefinition): Promise<void> {
    await super.validateTask(task);
    
    // 单任务特定验证
    if (task.type !== TaskType.SINGLE_OPERATION) {
      throw new Error(`单任务执行器只支持 SINGLE_OPERATION 类型，当前类型: ${task.type}`);
    }
    
    // 验证操作类型
    if (!Object.values(OperationType).includes(task.data.operationType)) {
      throw new Error(`不支持的操作类型: ${task.data.operationType}`);
    }
  }
  
  /**
   * 创建单任务
   */
  static createTask(
    name: string,
    operationType: OperationType,
    operationParams: any,
    accountId: string,
    sessionId?: string,
    priority: number = 2
  ): TaskDefinition {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: taskId,
      name,
      type: TaskType.SINGLE_OPERATION,
      priority,
      config: {
        id: taskId,
        type: TaskType.SINGLE_OPERATION,
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
        accountId,
        sessionId
      },
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      tags: ['single', 'operation']
    };
  }
  
  /**
   * 批量创建单任务
   */
  static createBatchTasks(
    tasks: Array<{
      name: string;
      operationType: OperationType;
      operationParams: any;
      accountId: string;
      sessionId?: string;
      priority?: number;
    }>
  ): TaskDefinition[] {
    return tasks.map(task => 
      SingleTaskExecutor.createTask(
        task.name,
        task.operationType,
        task.operationParams,
        task.accountId,
        task.sessionId,
        task.priority
      )
    );
  }
  
  /**
   * 执行简单任务（快捷方法）
   */
  async executeSimpleTask(
    name: string,
    operationType: OperationType,
    operationParams: any,
    accountId: string,
    sessionId?: string
  ): Promise<OperationResult> {
    const task = SingleTaskExecutor.createTask(
      name,
      operationType,
      operationParams,
      accountId,
      sessionId
    );
    
    const result = await this.execute(task);
    
    if (result.operationResults.length === 0) {
      throw new Error('任务执行未返回操作结果');
    }
    
    return result.operationResults[0];
  }
}