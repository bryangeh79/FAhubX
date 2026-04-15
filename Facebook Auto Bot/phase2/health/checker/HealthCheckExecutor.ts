/**
 * 健康检查执行器
 * 
 * 负责多类型检查支持、并行执行优化和结果收集分析
 */

import { Logger } from '../../utils/Logger';
import { 
  HealthCheckResult, 
  HealthCheckConfig,
  AccountHealth,
  HealthWarning,
  HealthError
} from '../../types';
import { CheckItems } from './CheckItems';

export interface ExecutionContext {
  accountId: string;
  sessionId?: string;
  vpnConnectionId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CheckExecutionResult {
  result: HealthCheckResult;
  warnings?: HealthWarning[];
  errors?: HealthError[];
  metrics?: Record<string, any>;
  executionTime: number;
}

export class HealthCheckExecutor {
  private logger: Logger;
  private checkItems: CheckItems;
  private config: HealthCheckConfig;
  
  private activeExecutions: Map<string, Promise<CheckExecutionResult>> = new Map();
  private executionHistory: Map<string, CheckExecutionResult[]> = new Map();
  
  constructor(config?: Partial<HealthCheckConfig>) {
    this.logger = new Logger('HealthCheckExecutor');
    this.checkItems = new CheckItems();
    
    // 默认配置
    this.config = {
      checkInterval: 300000, // 5分钟
      loginCheckInterval: 600000, // 10分钟
      riskCheckInterval: 900000, // 15分钟
      thresholds: {
        healthScore: {
          healthy: 80,
          warning: 60,
          critical: 60
        },
        banRiskScore: {
          low: 30,
          medium: 60,
          high: 80,
          critical: 80
        },
        errorRate: 10, // 10%
        responseTime: 5000 // 5秒
      },
      enabledChecks: {
        login: true,
        performance: true,
        behavior: true,
        risk: true,
        network: true
      },
      autoRepair: {
        enabled: true,
        maxAttempts: 3,
        cooldownPeriod: 300000 // 5分钟
      },
      ...config
    };
  }
  
  /**
   * 执行检查
   */
  async executeCheck(
    accountId: string, 
    checkType: string, 
    data?: any
  ): Promise<HealthCheckResult> {
    const executionId = `${accountId}-${checkType}-${Date.now()}`;
    const startTime = Date.now();
    
    this.logger.debug('Starting check execution', {
      executionId,
      accountId,
      checkType
    });
    
    try {
      // 创建执行上下文
      const context: ExecutionContext = {
        accountId,
        timestamp: new Date(),
        metadata: data
      };
      
      // 执行具体检查
      const executionResult = await this.executeCheckType(checkType, context);
      
      // 记录执行历史
      this.recordExecution(accountId, executionResult);
      
      const executionTime = Date.now() - startTime;
      this.logger.debug('Check execution completed', {
        executionId,
        accountId,
        checkType,
        status: executionResult.result.status,
        executionTime
      });
      
      return executionResult.result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error('Check execution failed', error as Error, {
        executionId,
        accountId,
        checkType,
        executionTime
      });
      
      // 返回失败结果
      return {
        checkType,
        checkName: `${checkType}_check`,
        status: 'fail',
        message: `Execution failed: ${(error as Error).message}`,
        details: { error: (error as Error).stack },
        timestamp: new Date()
      };
    }
  }
  
  /**
   * 执行特定类型的检查
   */
  private async executeCheckType(
    checkType: string, 
    context: ExecutionContext
  ): Promise<CheckExecutionResult> {
    const startTime = Date.now();
    
    switch (checkType) {
      case 'login':
        return await this.executeLoginCheck(context);
        
      case 'session':
        return await this.executeSessionCheck(context);
        
      case 'permissions':
        return await this.executePermissionsCheck(context);
        
      case 'restrictions':
        return await this.executeRestrictionsCheck(context);
        
      case 'performance':
        return await this.executePerformanceCheck(context);
        
      case 'risk':
        return await this.executeRiskCheck(context);
        
      case 'network':
        return await this.executeNetworkCheck(context);
        
      case 'periodic':
        return await this.executePeriodicCheck(context);
        
      default:
        throw new Error(`Unknown check type: ${checkType}`);
    }
  }
  
  /**
   * 执行登录状态检查
   */
  private async executeLoginCheck(context: ExecutionContext): Promise<CheckExecutionResult> {
    const startTime = Date.now();
    
    try {
      // 调用CheckItems中的登录检查
      const result = await this.checkItems.checkLoginStatus(context);
      
      const executionTime = Date.now() - startTime;
      return {
        result,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        result: {
          checkType: 'login',
          checkName: 'login_status_check',
          status: 'fail',
          message: `Login check failed: ${(error as Error).message}`,
          details: { error: (error as Error).stack },
          timestamp: new Date()
        },
        executionTime
      };
    }
  }
  
  /**
   * 执行会话有效性检查
   */
  private async executeSessionCheck(context: ExecutionContext): Promise<CheckExecutionResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.checkItems.checkSessionValidity(context);
      
      const executionTime = Date.now() - startTime;
      return {
        result,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        result: {
          checkType: 'session',
          checkName: 'session_validity_check',
          status: 'fail',
          message: `Session check failed: ${(error as Error).message}`,
          details: { error: (error as Error).stack },
          timestamp: new Date()
        },
        executionTime
      };
    }
  }
  
  /**
   * 执行账号权限检查
   */
  private async executePermissionsCheck(context: ExecutionContext): Promise<CheckExecutionResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.checkItems.checkAccountPermissions(context);
      
      const executionTime = Date.now() - startTime;
      return {
        result,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        result: {
          checkType: 'permissions',
          checkName: 'account_permissions_check',
          status: 'fail',
          message: `Permissions check failed: ${(error as Error).message}`,
          details: { error: (error as Error).stack },
          timestamp: new Date()
        },
        executionTime
      };
    }
  }
  
  /**
   * 执行操作限制检查
   */
  private async executeRestrictionsCheck(context: ExecutionContext): Promise<CheckExecutionResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.checkItems.checkOperationRestrictions(context);
      
      const executionTime = Date.now() - startTime;
      return {
        result,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        result: {
          checkType: 'restrictions',
          checkName: 'operation_restrictions_check',
          status: 'fail',
          message: `Restrictions check failed: ${(error as Error).message}`,
          details: { error: (error as Error).stack },
          timestamp: new Date()
        },
        executionTime
      };
    }
  }
  
  /**
   * 执行性能指标检查
   */
  private async executePerformanceCheck(context: ExecutionContext): Promise<CheckExecutionResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.checkItems.checkPerformanceMetrics(context);
      
      const executionTime = Date.now() - startTime;
      return {
        result,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        result: {
          checkType: 'performance',
          checkName: 'performance_metrics_check',
          status: 'fail',
          message: `Performance check failed: ${(error as Error).message}`,
          details: { error: (error as Error).stack },
          timestamp: new Date()
        },
        executionTime
      };
    }
  }
  
  /**
   * 执行风险检查
   */
  private async executeRiskCheck(context: ExecutionContext): Promise<CheckExecutionResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.checkItems.checkRiskIndicators(context);
      
      const executionTime = Date.now() - startTime;
      return {
        result,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        result: {
          checkType: 'risk',
          checkName: 'risk_indicators_check',
          status: 'fail',
          message: `Risk check failed: ${(error as Error).message}`,
          details: { error: (error as Error).stack },
          timestamp: new Date()
        },
        executionTime
      };
    }
  }
  
  /**
   * 执行网络检查
   */
  private async executeNetworkCheck(context: ExecutionContext): Promise<CheckExecutionResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.checkItems.checkNetworkStatus(context);
      
      const executionTime = Date.now() - startTime;
      return {
        result,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        result: {
          checkType: 'network',
          checkName: 'network_status_check',
          status: 'fail',
          message: `Network check failed: ${(error as Error).message}`,
          details: { error: (error as Error).stack },
          timestamp: new Date()
        },
        executionTime
      };
    }
  }
  
  /**
   * 执行定期综合检查
   */
  private async executePeriodicCheck(context: ExecutionContext): Promise<CheckExecutionResult> {
    const startTime = Date.now();
    
    try {
      // 并行执行多个检查
      const checkPromises = [
        this.executeLoginCheck(context),
        this.executeSessionCheck(context),
        this.executePerformanceCheck(context),
        this.executeRiskCheck(context)
      ];
      
      const results = await Promise.allSettled(checkPromises);
      
      // 分析结果
      const successfulResults = results
        .filter((r): r is PromiseFulfilledResult<CheckExecutionResult> => r.status === 'fulfilled')
        .map(r => r.value);
      
      const failedResults = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason);
      
      // 确定整体状态
      let overallStatus: 'pass' | 'warning' | 'fail' = 'pass';
      const resultMessages: string[] = [];
      
      for (const result of successfulResults) {
        if (result.result.status === 'fail') {
          overallStatus = 'fail';
          resultMessages.push(result.result.message);
        } else if (result.result.status === 'warning' && overallStatus !== 'fail') {
          overallStatus = 'warning';
          resultMessages.push(result.result.message);
        }
      }
      
      if (failedResults.length > 0) {
        overallStatus = 'fail';
        resultMessages.push(`${failedResults.length} checks failed to execute`);
      }
      
      const executionTime = Date.now() - startTime;
      return {
        result: {
          checkType: 'periodic',
          checkName: 'periodic_comprehensive_check',
          status: overallStatus,
          message: resultMessages.join('; '),
          details: {
            successfulChecks: successfulResults.length,
            failedChecks: failedResults.length,
            individualResults: successfulResults.map(r => ({
              checkType: r.result.checkType,
              status: r.result.status,
              message: r.result.message
            }))
          },
          timestamp: new Date()
        },
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        result: {
          checkType: 'periodic',
          checkName: 'periodic_comprehensive_check',
          status: 'fail',
          message: `Periodic check failed: ${(error as Error).message}`,
          details: { error: (error as Error).stack },
          timestamp: new Date()
        },
        executionTime
      };
    }
  }
  
  /**
   * 批量执行检查
   */
  async executeBatchChecks(
    accountIds: string[],
    checkType: string,
    concurrency: number = 3
  ): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    
    this.logger.info('Starting batch checks', {
      accountCount: accountIds.length,
      checkType,
      concurrency
    });
    
    // 使用并发控制执行检查
    const batches = [];
    for (let i = 0; i < accountIds.length; i += concurrency) {
      batches.push(accountIds.slice(i, i + concurrency));
    }
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      this.logger.debug('Processing batch', {
        batchIndex: batchIndex + 1,
        totalBatches: batches.length,
        batchSize: batch.length
      });
      
      // 并行执行批次中的检查
      const batchPromises = batch.map(accountId =>
        this.executeCheck(accountId, checkType).then(result => ({ accountId, result }))
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // 处理批次结果
      for (const batchResult of batchResults) {
        if (batchResult.status === 'fulfilled') {
          results.set(batchResult.value.accountId, batchResult.value.result);
        } else {
          this.logger.error('Batch check failed', batchResult.reason);
        }
      }
      
      // 批次间延迟，避免过载
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    this.logger.info('Batch checks completed', {
      successful: results.size,
      total: accountIds.length
    });
    
    return results;
  }
  
  /**
   * 记录执行历史
   */
  private recordExecution(accountId: string, executionResult: CheckExecutionResult): void {
    if (!this.executionHistory.has(accountId)) {
      this.executionHistory.set(accountId, []);
    }
    
    const history = this.executionHistory.get(accountId)!;
    history.push(executionResult);
    
    // 保持历史记录大小
    if (history.length > 100) {
      history.shift();
    }
  }
  
  /**
   * 获取执行历史
   */
  getExecutionHistory(accountId: string, limit: number = 50): CheckExecutionResult[] {
    const history = this.executionHistory.get(accountId) || [];
    return history.slice(-limit);
  }
  
  /**
   * 获取执行统计
   */
  getExecutionStatistics(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgExecutionTime: number;
    byCheckType: Record<string, {
      count: number;
      successRate: number;
      avgTime: number;
    }>;
  } {
    const stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTime: 0,
      byCheckType: {} as Record<string, {
        count: number;
        successCount: number;
        totalTime: number;
      }>
    };
    
    // 收集所有执行历史
    for (const history of this.executionHistory.values()) {
      for (const execution of history) {
        stats.totalExecutions++;
        stats.totalExecutionTime += execution.executionTime;
        
        const checkType = execution.result.checkType;
        if (!stats.byCheckType[checkType]) {
          stats.byCheckType[checkType] = { count: 0, successCount: 0, totalTime: 0 };
        }
        
        stats.byCheckType[checkType].count++;
        stats.byCheckType[checkType].totalTime += execution.executionTime;
        
        if (execution.result.status !== 'fail') {
          stats.successfulExecutions++;
          stats.byCheckType[checkType].successCount++;
        } else {
          stats.failedExecutions++;
        }
      }
    }
    
    // 计算聚合统计
    const avgExecutionTime = stats.totalExecutions > 0 
      ? stats.totalExecutionTime / stats.totalExecutions 
      : 0;
    
    const byCheckTypeResult: Record<string, {
      count: number;
      successRate: number;
      avgTime: number;
    }> = {};
    
    for (const [checkType, typeStats] of Object.entries(stats.byCheckType)) {
      byCheckTypeResult[checkType] = {
        count: typeStats.count,
        successRate: typeStats.count > 0 ? (typeStats.successCount / typeStats.count) * 100 : 0,
        avgTime: typeStats.count > 0 ? typeStats.totalTime / typeStats.count : 0
      };
    }
    
    return {
      totalExecutions: stats.totalExecutions,
      successfulExecutions: stats.successfulExecutions,
      failedExecutions: stats.failedExecutions,
      avgExecutionTime,
      byCheckType: byCheckTypeResult
    };
  }
  
  /**
   * 清理历史记录
   */
  clearHistory(olderThan?: Date): void {
