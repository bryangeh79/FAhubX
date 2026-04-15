/**
 * 批量任务执行器
 */

import { BaseTaskExecutor } from '../core/base-task-executor';
import {
  TaskDefinition,
  TaskType,
  TaskStatus
} from '../types';
import {
  OperationResult,
  OperationType,
  BaseOperationParams
} from '@facebook-bot/facebook-operations';

/**
 * 批量任务执行器
 * 用于执行批量操作任务
 */
export class BatchTaskExecutor extends BaseTaskExecutor {
  private readonly maxConcurrency: number;
  
  constructor(maxConcurrency: number = 3) {
    super();
    this.maxConcurrency = Math.max(1, Math.min(maxConcurrency, 10)); // 限制在1-10之间
    this.logger.info('批量任务执行器已初始化', { maxConcurrency: this.maxConcurrency });
  }
  
  /**
   * 执行批量操作任务
   */
  protected async executeTaskInternal(task: TaskDefinition): Promise<OperationResult[]> {
    const results: OperationResult[] = [];
    
    // 验证任务类型
    if (task.type !== TaskType.BATCH_OPERATIONS) {
      throw new Error(`不支持的任務類型: ${task.type}，批量任務執行器只支持 BATCH_OPERATIONS`);
    }
    
    // 获取批量操作数据
    const batchData = task.data.operationParams;
    
    if (!Array.isArray(batchData)) {
      throw new Error('批量任务数据必须是数组');
    }
    
    if (batchData.length === 0) {
      throw new Error('批量任务数据不能为空');
    }
    
    this.logger.info('开始执行批量操作', {
      taskId: task.id,
      operationCount: batchData.length,
      accountId: task.data.accountId,
      concurrency: this.maxConcurrency
    });
    
    // 准备执行上下文
    const context = {
      sessionId: task.data.sessionId,
      accountId: task.data.accountId,
      metadata: task.metadata
    };
    
    // 并发执行批量操作
    const batchResults = await this.executeBatchWithConcurrency(
      batchData,
      context,
      this.maxConcurrency
    );
    
    results.push(...batchResults);
    
    // 统计结果
    const successCount = batchResults.filter(r => r.status === 'success').length;
    const failedCount = batchResults.filter(r => r.status === 'failed').length;
    
    this.logger.info('批量操作执行完成', {
      taskId: task.id,
      total: batchResults.length,
      success: successCount,
      failed: failedCount,
      successRate: ((successCount / batchResults.length) * 100).toFixed(2) + '%'
    });
    
    // 如果有失败的操作，抛出错误
    if (failedCount > 0) {
      const errorMessages = batchResults
        .filter(r => r.status === 'failed')
        .map(r => r.error)
        .filter(Boolean)
        .join('; ');
      
      throw new Error(`批量操作执行有失败: ${errorMessages || '未知错误'}`);
    }
    
    return results;
  }
  
  /**
   * 并发执行批量操作
   */
  private async executeBatchWithConcurrency(
    batchData: any[],
    context: any,
    concurrency: number
  ): Promise<OperationResult[]> {
    const results: OperationResult[] = [];
    let currentIndex = 0;
    
    // 执行一批任务
    const executeBatch = async (): Promise<void> => {
      while (currentIndex < batchData.length) {
        const index = currentIndex++;
        const operationData = batchData[index];
        
        try {
          // 验证操作数据
          if (!operationData.type || !operationData.params) {
            throw new Error(`操作数据格式错误，索引: ${index}`);
          }
          
          const operationType = operationData.type as OperationType;
          const operationParams = operationData.params;
          
          this.logger.debug('执行批量中的单个操作', {
            index,
            operationType,
            total: batchData.length
          });
          
          // 执行单个操作
          const result = await this.executeSingleOperation(
            operationType,
            operationParams,
            context
          );
          
          results[index] = result;
          
        } catch (error) {
          // 记录错误但继续执行其他操作
          const errorResult: OperationResult = {
            id: `error_${Date.now()}_${index}`,
            operationId: `batch_${index}`,
            type: operationData.type || OperationType.POST,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            errorCode: 'BATCH_OPERATION_FAILED',
            retryCount: 0,
            startTime: new Date(),
            endTime: new Date(),
            duration: 0,
            metadata: { index }
          };
          
          results[index] = errorResult;
          this.logger.error('批量操作执行失败', { index, error: errorResult.error });
        }
      }
    };
    
    // 创建并发任务
    const workers = Array(concurrency).fill(null).map(() => executeBatch());
    
    // 等待所有任务完成
    await Promise.all(workers);
    
    return results;
  }
  
  /**
   * 验证任务（覆盖父类方法）
   */
  protected async validateTask(task: TaskDefinition): Promise<void> {
    await super.validateTask(task);
    
    // 批量任务特定验证
    if (task.type !== TaskType.BATCH_OPERATIONS) {
      throw new Error(`批量任务执行器只支持 BATCH_OPERATIONS 类型，当前类型: ${task.type}`);
    }
    
    // 验证批量数据
    const batchData = task.data.operationParams;
    
    if (!Array.isArray(batchData)) {
      throw new Error('批量任务数据必须是数组');
    }
    
    if (batchData.length === 0) {
      throw new Error('批量任务数据不能为空');
    }
    
    if (batchData.length > 100) {
      throw new Error('批量任务数据过多，最大支持100个操作');
    }
    
    // 验证每个操作数据
    for (let i = 0; i < batchData.length; i++) {
      const operationData = batchData[i];
      
      if (!operationData || typeof operationData !== 'object') {
        throw new Error(`操作数据格式错误，索引: ${i}`);
      }
      
      if (!operationData.type || !Object.values(OperationType).includes(operationData.type)) {
        throw new Error(`不支持的操作类型，索引: ${i}, 类型: ${operationData.type}`);
      }
      
      if (!operationData.params || typeof operationData.params !== 'object') {
        throw new Error(`操作参数格式错误，索引: ${i}`);
      }
    }
  }
  
  /**
   * 创建批量任务
   */
  static createBatchTask(
    name: string,
    operations: Array<{
      type: OperationType;
      params: any;
    }>,
    accountId: string,
    sessionId?: string,
    priority: number = 2,
    concurrency: number = 3
  ): TaskDefinition {
    const taskId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: taskId,
      name,
      type: TaskType.BATCH_OPERATIONS,
      priority,
      config: {
        id: taskId,
        type: TaskType.BATCH_OPERATIONS,
        priority,
        maxRetries: 2,
        retryDelay: 10000,
        timeout: 300000, // 5分钟（批量操作需要更长时间）
        concurrency,
        requireSession: true,
        metadata: {}
      },
      data: {
        operationType: OperationType.POST, // 批量任务使用POST作为占位符
        operationParams: operations,
        accountId,
        sessionId
      },
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      tags: ['batch', 'operations']
    };
  }
  
  /**
   * 获取最大并发数
   */
  getMaxConcurrency(): number {
    return this.maxConcurrency;
  }
  
  /**
   * 设置最大并发数
   */
  setMaxConcurrency(concurrency: number): void {
    this.maxConcurrency = Math.max(1, Math.min(concurrency, 10));
    this.logger.info('更新最大并发数', { maxConcurrency: this.maxConcurrency });
  }
}