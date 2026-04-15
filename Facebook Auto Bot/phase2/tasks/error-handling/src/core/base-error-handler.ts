/**
 * 基础错误处理器
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import {
  ErrorSeverity,
  ErrorCategory,
  ErrorSource,
  ErrorDefinition,
  ErrorHandlingResult,
  RecoveryAction,
  IErrorHandler
} from '../types';
import { OperationResult } from '@facebook-bot/facebook-operations';
import { TaskResult, TaskEvent } from '@facebook-bot/task-engine';

/**
 * 抽象基础错误处理器
 */
export abstract class BaseErrorHandler implements IErrorHandler {
  protected readonly id: string;
  protected readonly logger: Logger;
  protected readonly errorRegistry: Map<string, ErrorDefinition>;
  
  constructor() {
    this.id = uuidv4();
    this.logger = createLogger(`error-handler:${this.id}`);
    this.errorRegistry = new Map();
  }
  
  /**
   * 处理错误
   */
  async handleError(error: Error, context?: any): Promise<ErrorHandlingResult> {
    const errorId = uuidv4();
    const timestamp = new Date();
    
    // 创建错误定义
    const errorDef = this.createErrorDefinition(error, context);
    errorDef.id = errorId;
    errorDef.timestamp = timestamp;
    
    // 记录错误
    this.errorRegistry.set(errorId, errorDef);
    
    this.logger.error('处理错误', {
      errorId,
      errorCode: errorDef.code,
      severity: errorDef.severity,
      category: errorDef.category,
      source: errorDef.source
    });
    
    // 分析错误并制定处理策略
    const handlingResult = await this.analyzeAndHandleError(errorDef, context);
    
    // 记录处理结果
    this.logger.info('错误处理完成', {
      errorId,
      handled: handlingResult.handled,
      recoveryActions: handlingResult.recoveryActions,
      retryScheduled: handlingResult.retryScheduled
    });
    
    return handlingResult;
  }
  
  /**
   * 处理操作错误
   */
  async handleOperationError(result: OperationResult): Promise<ErrorHandlingResult> {
    if (result.status === 'success') {
      return this.createSuccessResult('操作成功，无需处理');
    }
    
    const error = new Error(result.error || '操作执行失败');
    const context = {
      operationType: result.type,
      operationId: result.operationId,
      retryCount: result.retryCount,
      metadata: result.metadata
    };
    
    return await this.handleError(error, context);
  }
  
  /**
   * 处理任务错误
   */
  async handleTaskError(result: TaskResult): Promise<ErrorHandlingResult> {
    if (result.status !== 'failed') {
      return this.createSuccessResult('任务未失败，无需处理');
    }
    
    const error = new Error(result.error || '任务执行失败');
    const context = {
      taskId: result.taskId,
      retryCount: result.retryCount,
      metadata: result.metadata
    };
    
    return await this.handleError(error, context);
  }
  
  /**
   * 处理事件错误
   */
  async handleEventError(event: TaskEvent): Promise<ErrorHandlingResult> {
    if (event.type !== 'error_occurred' && event.type !== 'task_failed') {
      return this.createSuccessResult('事件未包含错误，无需处理');
    }
    
    const error = new Error(event.data?.error || '事件错误');
    const context = {
      eventType: event.type,
      taskId: event.taskId,
      timestamp: event.timestamp,
      metadata: event.metadata
    };
    
    return await this.handleError(error, context);
  }
  
  /**
   * 创建错误定义
   */
  protected createErrorDefinition(error: Error, context?: any): ErrorDefinition {
    // 分析错误信息
    const { code, category, source, severity } = this.analyzeError(error, context);
    
    return {
      id: '', // 将在调用处设置
      code,
      message: error.message,
      severity,
      category,
      source,
      operationType: context?.operationType,
      taskId: context?.taskId,
      sessionId: context?.sessionId,
      accountId: context?.accountId,
      timestamp: new Date(),
      metadata: context,
      stackTrace: error.stack
    };
  }
  
  /**
   * 分析错误
   */
  protected analyzeError(error: Error, context?: any): {
    code: string;
    category: ErrorCategory;
    source: ErrorSource;
    severity: ErrorSeverity;
  } {
    const errorMessage = error.message.toLowerCase();
    const stackTrace = error.stack || '';
    
    // 默认值
    let code = 'UNKNOWN_ERROR';
    let category = ErrorCategory.UNKNOWN;
    let source = ErrorSource.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    
    // 分析错误类型
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      code = 'TIMEOUT_ERROR';
      category = ErrorCategory.TIMEOUT;
      severity = ErrorSeverity.MEDIUM;
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      code = 'NETWORK_ERROR';
      category = ErrorCategory.NETWORK;
      severity = ErrorSeverity.MEDIUM;
    } else if (errorMessage.includes('authentication') || errorMessage.includes('login')) {
      code = 'AUTHENTICATION_ERROR';
      category = ErrorCategory.AUTHENTICATION;
      severity = ErrorSeverity.HIGH;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      code = 'RATE_LIMIT_ERROR';
      category = ErrorCategory.RATE_LIMIT;
      severity = ErrorSeverity.HIGH;
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      code = 'VALIDATION_ERROR';
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.LOW;
    } else if (errorMessage.includes('element') || errorMessage.includes('selector')) {
      code = 'ELEMENT_NOT_FOUND';
      category = ErrorCategory.EXECUTION;
      severity = ErrorSeverity.MEDIUM;
    }
    
    // 分析错误来源
    if (stackTrace.includes('puppeteer') || context?.source === 'puppeteer') {
      source = ErrorSource.PUPPETEER;
    } else if (context?.operationType) {
      source = ErrorSource.OPERATION;
    } else if (context?.taskId) {
      source = ErrorSource.TASK_ENGINE;
    } else if (context?.sessionId) {
      source = ErrorSource.SESSION;
    } else if (stackTrace.includes('vpn')) {
      source = ErrorSource.VPN;
    } else if (stackTrace.includes('database') || stackTrace.includes('db')) {
      source = ErrorSource.DATABASE;
    }
    
    // 根据上下文调整严重级别
    if (context?.retryCount >= 3) {
      severity = ErrorSeverity.HIGH;
    }
    
    if (context?.critical === true) {
      severity = ErrorSeverity.CRITICAL;
    }
    
    return { code, category, source, severity };
  }
  
  /**
   * 分析并处理错误
   */
  protected async analyzeAndHandleError(
    errorDef: ErrorDefinition,
    context?: any
  ): Promise<ErrorHandlingResult> {
    const handlingResult: ErrorHandlingResult = {
      errorId: errorDef.id,
      handled: false,
      recoveryActions: [],
      retryScheduled: false,
      escalated: false,
      message: '',
      timestamp: new Date(),
      metadata: { errorDef, context }
    };
    
    // 根据错误类型制定处理策略
    switch (errorDef.code) {
      case 'TIMEOUT_ERROR':
        handlingResult.recoveryActions = [RecoveryAction.WAIT_AND_RETRY, RecoveryAction.RETRY];
        handlingResult.retryScheduled = true;
        handlingResult.retryDelay = 10000; // 10秒后重试
        handlingResult.handled = true;
        handlingResult.message = '超时错误，已安排重试';
        break;
        
      case 'NETWORK_ERROR':
        handlingResult.recoveryActions = [RecoveryAction.SWITCH_VPN, RecoveryAction.RETRY];
        handlingResult.retryScheduled = true;
        handlingResult.retryDelay = 5000; // 5秒后重试
        handlingResult.handled = true;
        handlingResult.message = '网络错误，尝试切换VPN并重试';
        break;
        
      case 'AUTHENTICATION_ERROR':
        handlingResult.recoveryActions = [RecoveryAction.REFRESH_SESSION, RecoveryAction.RETRY];
        handlingResult.retryScheduled = true;
        handlingResult.retryDelay = 30000; // 30秒后重试
        handlingResult.handled = true;
        handlingResult.message = '认证错误，尝试刷新会话并重试';
        break;
        
      case 'RATE_LIMIT_ERROR':
        handlingResult.recoveryActions = [RecoveryAction.WAIT_AND_RETRY, RecoveryAction.SWITCH_VPN];
        handlingResult.retryScheduled = true;
        handlingResult.retryDelay = 60000; // 60秒后重试
        handlingResult.handled = true;
        handlingResult.message = '频率限制错误，等待后重试';
        break;
        
      case 'VALIDATION_ERROR':
        handlingResult.recoveryActions = [RecoveryAction.SKIP_OPERATION];
        handlingResult.handled = true;
        handlingResult.message = '验证错误，跳过此操作';
        break;
        
      case 'ELEMENT_NOT_FOUND':
        handlingResult.recoveryActions = [RecoveryAction.RETRY];
        handlingResult.retryScheduled = true;
        handlingResult.retryDelay = 2000; // 2秒后重试
        handlingResult.handled = true;
        handlingResult.message = '元素未找到错误，尝试重试';
        break;
        
      default:
        // 未知错误或严重错误，升级处理
        if (errorDef.severity === ErrorSeverity.CRITICAL || errorDef.severity === ErrorSeverity.HIGH) {
          handlingResult.recoveryActions = [RecoveryAction.ESCALATE];
          handlingResult.escalated = true;
          handlingResult.message = '严重错误，已升级处理';
        } else {
          handlingResult.recoveryActions = [RecoveryAction.RETRY];
          handlingResult.retryScheduled = true;
          handlingResult.retryDelay = 5000;
          handlingResult.handled = true;
          handlingResult.message = '未知错误，尝试重试';
        }
        break;
    }
    
    // 执行恢复动作
    if (handlingResult.handled && handlingResult.recoveryActions.length > 0) {
      await this.executeRecoveryActions(errorDef, handlingResult.recoveryActions, context);
    }
    
    return handlingResult;
  }
  
  /**
   * 执行恢复动作
   */
  protected async executeRecoveryActions(
    errorDef: ErrorDefinition,
    actions: RecoveryAction[],
    context?: any
  ): Promise<void> {
    for (const action of actions) {
      try {
        await this.executeRecoveryAction(action, errorDef, context);
        this.logger.info('恢复动作执行成功', {
          errorId: errorDef.id,
          action,
          errorCode: errorDef.code
        });
      } catch (error) {
        this.logger.error('恢复动作执行失败', {
          errorId: errorDef.id,
          action,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
  
  /**
   * 执行单个恢复动作
   */
  protected async executeRecoveryAction(
    action: RecoveryAction,
    errorDef: ErrorDefinition,
    context?: any
  ): Promise<void> {
    switch (action) {
      case RecoveryAction.RETRY:
        // 重试逻辑由调用方处理
        this.logger.debug('安排重试', { errorId: errorDef.id });
        break;
        
      case RecoveryAction.REFRESH_SESSION:
        await this.refreshSession(errorDef.sessionId, context);
        break;
        
      case RecoveryAction.SWITCH_VPN:
        await this.switchVpn(context);
        break;
        
      case RecoveryAction.WAIT_AND_RETRY:
        // 等待逻辑由调用方处理
        this.logger.debug('安排等待后重试', { errorId: errorDef.id });
        break;
        
      case RecoveryAction.SKIP_OPERATION:
        this.logger.info('跳过操作', { 
          errorId: errorDef.id,
          operationType: errorDef.operationType
        });
        break;
        
      case RecoveryAction.ESCALATE:
        await this.escalateError(errorDef, context);
        break;
        
      case RecoveryAction.SHUTDOWN:
        await this.initiateShutdown(errorDef, context);
        break;
        
      default:
        this.logger.warn('未知的恢复动作', { action });
        break;
    }
  }
  
  /**
   * 刷新会话（子类可以覆盖）
   */
  protected async refreshSession(sessionId?: string, context?: any): Promise<void> {
    this.logger.info('刷新会话', { sessionId });
    // 实际实现应由子类提供
  }
  
  /**
   * 切换VPN（子类可以覆盖）
   */
  protected async switchVpn(context?: any): Promise<void> {
    this.logger.info('切换VPN');
    // 实际实现应由子类提供
  }
  
  /**
   * 升级错误处理（子类可以覆盖）
   */
  protected async escalateError(errorDef: ErrorDefinition, context?: any): Promise<void> {
    this.logger.warn('错误已升级处理', {
      errorId: errorDef.id,
      errorCode: errorDef.code,
      severity: errorDef.severity
    });
    // 实际实现应由子类提供（如发送通知、记录到数据库等）
  }
  
  /**
   * 初始化关闭（子类可以覆盖）
   */
  protected async initiateShutdown(errorDef: ErrorDefinition, context?: any): Promise<void> {
    this.logger.error('初始化系统关闭', {
      errorId: errorDef.id,
      errorCode: errorDef.code,
      severity: errorDef.severity
    });
    // 实际实现应由子类提供
  }
  
  /**
   * 创建成功结果
   */
  protected createSuccessResult(message: string): ErrorHandlingResult {
    return {
      errorId: '',
      handled: true,
      recoveryActions: [],
      retryScheduled: false,
      escalated: false,
      message,
      timestamp: new Date()
    };
  }
  
  /**
   * 获取所有错误
   */
  getAllErrors(): ErrorDefinition[] {
    return Array.from(this.errorRegistry.values());
  }
  
  /**
   * 根据条件筛选错误
   */
  getErrorsByFilter(filter: Partial<ErrorDefinition>): ErrorDefinition[] {
    return this.getAllErrors().filter(error => {
      return Object.entries(filter).every(([key, value]) => {
        return (error as any)[key] === value;
      });
    });
  }
  
  /**
   * 清理旧错误
   */
  cleanupOldErrors(maxAgeHours: number = 24): void {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
    
    let cleanedCount = 0;
    
    for (const [errorId, error] of this.errorRegistry.entries()) {
      if (error.timestamp < cutoffTime) {
        this.errorRegistry.delete(errorId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.info(`清理了 ${cleanedCount} 个旧错误`);
    }
  }
}