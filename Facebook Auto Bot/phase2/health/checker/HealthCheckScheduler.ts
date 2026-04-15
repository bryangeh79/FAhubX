/**
 * 健康检查调度器
 * 
 * 负责定时任务调度、优先级管理和并发控制
 */

import { Logger } from '../../utils/Logger';
import { HealthCheckExecutor } from './HealthCheckExecutor';
import { HealthCheckConfig, HealthCheckResult, AccountHealth } from '../../types';

export interface ScheduledCheck {
  accountId: string;
  checkType: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  scheduledAt: Date;
  executeAt: Date;
  retryCount: number;
  maxRetries: number;
  data?: any;
}

export interface SchedulerConfig {
  maxConcurrentChecks: number;
  defaultPriority: 'low' | 'medium' | 'high';
  retryPolicy: {
    maxRetries: number;
    retryDelay: number; // 毫秒
    exponentialBackoff: boolean;
  };
  scheduling: {
    checkInterval: number; // 毫秒
    batchSize: number;
    maxQueueSize: number;
  };
}

export class HealthCheckScheduler {
  private logger: Logger;
  private executor: HealthCheckExecutor;
  private config: SchedulerConfig;
  
  private queue: ScheduledCheck[] = [];
  private runningChecks: Map<string, ScheduledCheck> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private checkHistory: Map<string, HealthCheckResult[]> = new Map();
  
  private isRunning = false;
  private lastCheckTime: Date = new Date();
  
  constructor(
    executor: HealthCheckExecutor,
    config?: Partial<SchedulerConfig>
  ) {
    this.logger = new Logger('HealthCheckScheduler');
    this.executor = executor;
    
    // 默认配置
    this.config = {
      maxConcurrentChecks: 5,
      defaultPriority: 'medium',
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 5000,
        exponentialBackoff: true
      },
      scheduling: {
        checkInterval: 300000, // 5分钟
        batchSize: 10,
        maxQueueSize: 1000
      },
      ...config
    };
  }
  
  /**
   * 启动调度器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Scheduler is already running');
      return;
    }
    
    this.isRunning = true;
    this.logger.info('Health Check Scheduler started', {
      config: this.config
    });
    
    // 启动定期检查
    this.startPeriodicScheduling();
    
    // 启动队列处理器
    this.startQueueProcessor();
  }
  
  /**
   * 停止调度器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    // 清除所有定时任务
    for (const [jobId, timeout] of this.scheduledJobs) {
      clearTimeout(timeout);
    }
    this.scheduledJobs.clear();
    
    // 等待运行中的检查完成
    await this.waitForRunningChecks();
    
    this.logger.info('Health Check Scheduler stopped');
  }
  
  /**
   * 等待运行中的检查完成
   */
  private async waitForRunningChecks(): Promise<void> {
    const maxWaitTime = 30000; // 30秒
    const startTime = Date.now();
    
    while (this.runningChecks.size > 0 && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.logger.debug(`Waiting for ${this.runningChecks.size} checks to complete...`);
    }
    
    if (this.runningChecks.size > 0) {
      this.logger.warn(`Force stopping with ${this.runningChecks.size} checks still running`);
    }
  }
  
  /**
   * 启动定期调度
   */
  private startPeriodicScheduling(): void {
    const scheduleNext = () => {
      if (!this.isRunning) return;
      
      try {
        this.schedulePeriodicChecks();
      } catch (error) {
        this.logger.error('Error in periodic scheduling', error as Error);
      }
      
      // 安排下一次调度
      const timeout = setTimeout(scheduleNext, this.config.scheduling.checkInterval);
      this.scheduledJobs.set('periodic-scheduler', timeout);
    };
    
    // 立即开始第一次调度
    scheduleNext();
  }
  
  /**
   * 启动队列处理器
   */
  private startQueueProcessor(): void {
    const processQueue = async () => {
      if (!this.isRunning) return;
      
      try {
        await this.processQueueBatch();
      } catch (error) {
        this.logger.error('Error processing queue', error as Error);
      }
      
      // 安排下一次处理
      if (this.isRunning) {
        setTimeout(processQueue, 1000); // 每秒处理一次
      }
    };
    
    processQueue();
  }
  
  /**
   * 安排定期检查
   */
  private async schedulePeriodicChecks(): Promise<void> {
    this.logger.debug('Scheduling periodic checks');
    
    // 这里应该从数据库获取需要检查的账号
    // 暂时使用模拟数据
    const accountsToCheck = await this.getAccountsForPeriodicCheck();
    
    for (const accountId of accountsToCheck) {
      this.scheduleCheck({
        accountId,
        checkType: 'periodic',
        priority: this.config.defaultPriority
      });
    }
    
    this.lastCheckTime = new Date();
  }
  
  /**
   * 获取需要定期检查的账号
   */
  private async getAccountsForPeriodicCheck(): Promise<string[]> {
    // 模拟实现 - 实际应该从数据库查询
    return ['account-1', 'account-2', 'account-3'];
  }
  
  /**
   * 安排检查
   */
  scheduleCheck(check: Omit<ScheduledCheck, 'scheduledAt' | 'executeAt' | 'retryCount'>): string {
    if (this.queue.length >= this.config.scheduling.maxQueueSize) {
      throw new Error('Queue is full');
    }
    
    const scheduledCheck: ScheduledCheck = {
      ...check,
      scheduledAt: new Date(),
      executeAt: new Date(), // 立即执行
      retryCount: 0,
      maxRetries: this.config.retryPolicy.maxRetries,
      data: check.data || {}
    };
    
    // 根据优先级插入队列
    this.insertIntoQueue(scheduledCheck);
    
    this.logger.debug('Check scheduled', {
      accountId: check.accountId,
      checkType: check.checkType,
      priority: check.priority,
      queueSize: this.queue.length
    });
    
    return `${check.accountId}-${check.checkType}-${Date.now()}`;
  }
  
  /**
   * 将检查插入队列（按优先级排序）
   */
  private insertIntoQueue(check: ScheduledCheck): void {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    // 找到插入位置
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[check.priority] < priorityOrder[this.queue[i].priority]) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, check);
  }
  
  /**
   * 处理队列批次
   */
  private async processQueueBatch(): Promise<void> {
    if (this.queue.length === 0) return;
    
    // 计算可运行的检查数量
    const availableSlots = this.config.maxConcurrentChecks - this.runningChecks.size;
    if (availableSlots <= 0) return;
    
    // 从队列中取出检查
    const checksToRun = this.queue.splice(0, Math.min(availableSlots, this.config.scheduling.batchSize));
    
    for (const check of checksToRun) {
      this.executeCheck(check);
    }
  }
  
  /**
   * 执行检查
   */
  private async executeCheck(check: ScheduledCheck): Promise<void> {
    const checkId = `${check.accountId}-${check.checkType}-${check.scheduledAt.getTime()}`;
    
    // 标记为运行中
    this.runningChecks.set(checkId, check);
    
    try {
      this.logger.debug('Executing check', {
        checkId,
        accountId: check.accountId,
        checkType: check.checkType
      });
      
      // 执行检查
      const result = await this.executor.executeCheck(check.accountId, check.checkType, check.data);
      
      // 记录历史
      this.recordCheckResult(check.accountId, result);
      
      // 从运行中移除
      this.runningChecks.delete(checkId);
      
      this.logger.debug('Check completed', {
        checkId,
        accountId: check.accountId,
        status: result.status
      });
      
    } catch (error) {
      this.logger.error('Check execution failed', error as Error, {
        checkId,
        accountId: check.accountId
      });
      
      // 处理重试
      await this.handleCheckFailure(check, checkId, error as Error);
    }
  }
  
  /**
   * 处理检查失败
   */
  private async handleCheckFailure(
    check: ScheduledCheck,
    checkId: string,
    error: Error
  ): Promise<void> {
    // 从运行中移除
    this.runningChecks.delete(checkId);
    
    // 检查是否需要重试
    if (check.retryCount < check.maxRetries) {
      check.retryCount++;
      
      // 计算重试延迟
      let retryDelay = this.config.retryPolicy.retryDelay;
      if (this.config.retryPolicy.exponentialBackoff) {
        retryDelay *= Math.pow(2, check.retryCount - 1);
      }
      
      // 安排重试
      check.executeAt = new Date(Date.now() + retryDelay);
      this.insertIntoQueue(check);
      
      this.logger.warn('Check scheduled for retry', {
        accountId: check.accountId,
        checkType: check.checkType,
        retryCount: check.retryCount,
        retryDelay,
        error: error.message
      });
    } else {
      this.logger.error('Check failed after max retries', {
        accountId: check.accountId,
        checkType: check.checkType,
        maxRetries: check.maxRetries,
        error: error.message
      });
      
      // 记录失败
      this.recordCheckFailure(check.accountId, check.checkType, error);
    }
  }
  
  /**
   * 记录检查结果
   */
  private recordCheckResult(accountId: string, result: HealthCheckResult): void {
    if (!this.checkHistory.has(accountId)) {
      this.checkHistory.set(accountId, []);
    }
    
    const history = this.checkHistory.get(accountId)!;
    history.push(result);
    
    // 保持历史记录大小
    if (history.length > 100) {
      history.shift();
    }
  }
  
  /**
   * 记录检查失败
   */
  private recordCheckFailure(accountId: string, checkType: string, error: Error): void {
    const failureResult: HealthCheckResult = {
      checkType,
      checkName: `${checkType}_check`,
      status: 'fail',
      message: `Check failed: ${error.message}`,
      details: { error: error.stack },
      timestamp: new Date()
    };
    
    this.recordCheckResult(accountId, failureResult);
  }
  
  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueSize: number;
    runningChecks: number;
    lastCheckTime: Date;
    checkHistorySize: number;
  } {
    return {
      queueSize: this.queue.length,
      runningChecks: this.runningChecks.size,
      lastCheckTime: this.lastCheckTime,
      checkHistorySize: this.checkHistory.size
    };
  }
  
  /**
   * 获取账号检查历史
   */
  getAccountCheckHistory(accountId: string, limit: number = 50): HealthCheckResult[] {
    const history = this.checkHistory.get(accountId) || [];
    return history.slice(-limit);
  }
  
  /**
   * 清理历史记录
   */
  clearHistory(olderThan?: Date): void {
    if (!olderThan) {
      this.checkHistory.clear();
      this.logger.info('All check history cleared');
      return;
    }
    
    let clearedCount = 0;
    for (const [accountId, history] of this.checkHistory) {
      const filtered = history.filter(result => result.timestamp >= olderThan);
      if (filtered.length !== history.length) {
        clearedCount += history.length - filtered.length;
        this.checkHistory.set(accountId, filtered);
      }
    }
    
    this.logger.info('Check history cleared', {
      clearedCount,
      olderThan
    });
  }
  
  /**
   * 获取调度器健康状态
   */
  getHealthStatus(): {
    running: boolean;
    queueSize: number;
    runningChecks: number;
    scheduledJobs: number;
    lastCheckTime: Date;
  } {
    return {
      running: this.isRunning,
      queueSize: this.queue.length,
      runningChecks: this.runningChecks.size,
      scheduledJobs: this.scheduledJobs.size,
      lastCheckTime: this.lastCheckTime
    };
  }
}