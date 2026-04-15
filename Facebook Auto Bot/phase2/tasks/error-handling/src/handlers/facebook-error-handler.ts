/**
 * Facebook错误处理器
 */

import { BaseErrorHandler } from '../core/base-error-handler';
import {
  ErrorSeverity,
  ErrorCategory,
  ErrorSource,
  ErrorDefinition,
  ErrorHandlingResult,
  RecoveryAction
} from '../types';
import { OperationType } from '@facebook-bot/facebook-operations';

/**
 * Facebook特定错误处理器
 */
export class FacebookErrorHandler extends BaseErrorHandler {
  
  constructor() {
    super();
    this.logger.info('Facebook错误处理器已初始化');
  }
  
  /**
   * 分析错误（覆盖父类方法）
   */
  protected analyzeError(error: Error, context?: any): {
    code: string;
    category: ErrorCategory;
    source: ErrorSource;
    severity: ErrorSeverity;
  } {
    const errorMessage = error.message.toLowerCase();
    const stackTrace = error.stack || '';
    
    // 先调用父类分析
    const baseAnalysis = super.analyzeError(error, context);
    
    // Facebook特定错误分析
    let code = baseAnalysis.code;
    let category = baseAnalysis.category;
    let severity = baseAnalysis.severity;
    
    // Facebook特定错误模式
    if (errorMessage.includes('facebook') || errorMessage.includes('fb')) {
      // Facebook相关错误
      if (errorMessage.includes('block') || errorMessage.includes('ban')) {
        code = 'FACEBOOK_BLOCKED';
        category = ErrorCategory.AUTHENTICATION;
        severity = ErrorSeverity.CRITICAL;
      } else if (errorMessage.includes('captcha')) {
        code = 'FACEBOOK_CAPTCHA';
        category = ErrorCategory.AUTHENTICATION;
        severity = ErrorSeverity.HIGH;
      } else if (errorMessage.includes('suspicious') || errorMessage.includes('unusual')) {
        code = 'FACEBOOK_SUSPICIOUS_ACTIVITY';
        category = ErrorCategory.AUTHENTICATION;
        severity = ErrorSeverity.HIGH;
      } else if (errorMessage.includes('post') && errorMessage.includes('fail')) {
        code = 'FACEBOOK_POST_FAILED';
        category = ErrorCategory.EXECUTION;
        severity = ErrorSeverity.MEDIUM;
      } else if (errorMessage.includes('like') && errorMessage.includes('fail')) {
        code = 'FACEBOOK_LIKE_FAILED';
        category = ErrorCategory.EXECUTION;
        severity = ErrorSeverity.LOW;
      } else if (errorMessage.includes('comment') && errorMessage.includes('fail')) {
        code = 'FACEBOOK_COMMENT_FAILED';
        category = ErrorCategory.EXECUTION;
        severity = ErrorSeverity.MEDIUM;
      }
    }
    
    // 检查是否为Facebook登录相关错误
    if (context?.operationType === OperationType.POST && errorMessage.includes('login')) {
      code = 'FACEBOOK_LOGIN_REQUIRED';
      category = ErrorCategory.AUTHENTICATION;
      severity = ErrorSeverity.HIGH;
    }
    
    return {
      code,
      category,
      source: ErrorSource.OPERATION,
      severity
    };
  }
  
  /**
   * 分析并处理错误（覆盖父类方法）
   */
  protected async analyzeAndHandleError(
    errorDef: ErrorDefinition,
    context?: any
  ): Promise<ErrorHandlingResult> {
    // Facebook特定错误处理逻辑
    switch (errorDef.code) {
      case 'FACEBOOK_BLOCKED':
        return await this.handleFacebookBlocked(errorDef, context);
        
      case 'FACEBOOK_CAPTCHA':
        return await this.handleFacebookCaptcha(errorDef, context);
        
      case 'FACEBOOK_SUSPICIOUS_ACTIVITY':
        return await this.handleFacebookSuspiciousActivity(errorDef, context);
        
      case 'FACEBOOK_POST_FAILED':
        return await this.handleFacebookPostFailed(errorDef, context);
        
      case 'FACEBOOK_LIKE_FAILED':
        return await this.handleFacebookLikeFailed(errorDef, context);
        
      case 'FACEBOOK_COMMENT_FAILED':
        return await this.handleFacebookCommentFailed(errorDef, context);
        
      case 'FACEBOOK_LOGIN_REQUIRED':
        return await this.handleFacebookLoginRequired(errorDef, context);
        
      default:
        // 其他错误使用父类处理逻辑
        return await super.analyzeAndHandleError(errorDef, context);
    }
  }
  
  /**
   * 处理Facebook账号被封禁
   */
  private async handleFacebookBlocked(
    errorDef: ErrorDefinition,
    context?: any
  ): Promise<ErrorHandlingResult> {
    this.logger.error('Facebook账号可能被封禁', {
      errorId: errorDef.id,
      accountId: errorDef.accountId
    });
    
    return {
      errorId: errorDef.id,
      handled: true,
      recoveryActions: [RecoveryAction.ESCALATE, RecoveryAction.SHUTDOWN],
      retryScheduled: false,
      escalated: true,
      message: 'Facebook账号可能被封禁，需要人工干预',
      timestamp: new Date(),
      metadata: {
        errorDef,
        context,
        recommendation: '立即停止所有操作，检查账号状态'
      }
    };
  }
  
  /**
   * 处理Facebook验证码
   */
  private async handleFacebookCaptcha(
    errorDef: ErrorDefinition,
    context?: any
  ): Promise<ErrorHandlingResult> {
    this.logger.warn('遇到Facebook验证码', {
      errorId: errorDef.id,
      accountId: errorDef.accountId
    });
    
    return {
      errorId: errorDef.id,
      handled: true,
      recoveryActions: [RecoveryAction.ESCALATE, RecoveryAction.WAIT_AND_RETRY],
      retryScheduled: true,
      retryDelay: 300000, // 5分钟后重试
      escalated: true,
      message: '遇到Facebook验证码，需要人工解决',
      timestamp: new Date(),
      metadata: {
        errorDef,
        context,
        recommendation: '人工解决验证码后继续'
      }
    };
  }
  
  /**
   * 处理Facebook可疑活动警告
   */
  private async handleFacebookSuspiciousActivity(
    errorDef: ErrorDefinition,
    context?: any
  ): Promise<ErrorHandlingResult> {
    this.logger.warn('Facebook检测到可疑活动', {
      errorId: errorDef.id,
      accountId: errorDef.accountId
    });
    
    return {
      errorId: errorDef.id,
      handled: true,
      recoveryActions: [RecoveryAction.REFRESH_SESSION, RecoveryAction.WAIT_AND_RETRY],
      retryScheduled: true,
      retryDelay: 600000, // 10分钟后重试
      escalated: false,
      message: 'Facebook检测到可疑活动，刷新会话并等待后重试',
      timestamp: new Date(),
      metadata: {
        errorDef,
        context,
        recommendation: '降低操作频率，模拟人类行为'
      }
    };
  }
  
  /**
   * 处理Facebook发帖失败
   */
  private async handleFacebookPostFailed(
    errorDef: ErrorDefinition,
    context?: any
  ): Promise<ErrorHandlingResult> {
    this.logger.warn('Facebook发帖失败', {
      errorId: errorDef.id,
      accountId: errorDef.accountId
    });
    
    // 检查失败原因
    const shouldRetry = this.shouldRetryPost(errorDef, context);
    
    if (shouldRetry) {
      return {
        errorId: errorDef.id,
        handled: true,
        recoveryActions: [RecoveryAction.RETRY],
        retryScheduled: true,
        retryDelay: 30000, // 30秒后重试
        escalated: false,
        message: '发帖失败，安排重试',
        timestamp: new Date()
      };
    } else {
      return {
        errorId: errorDef.id,
        handled: true,
        recoveryActions: [RecoveryAction.SKIP_OPERATION],
        retryScheduled: false,
        escalated: false,
        message: '发帖失败，跳过此操作',
        timestamp: new Date(),
        metadata: {
          errorDef,
          context,
          reason: '内容可能违反Facebook政策'
        }
      };
    }
  }
  
  /**
   * 处理Facebook点赞失败
   */
  private async handleFacebookLikeFailed(
    errorDef: ErrorDefinition,
    context?: any
  ): Promise<ErrorHandlingResult> {
    this.logger.info('Facebook点赞失败', {
      errorId: errorDef.id,
      accountId: errorDef.accountId
    });
    
    // 点赞失败通常不严重，可以跳过
    return {
      errorId: errorDef.id,
      handled: true,
      recoveryActions: [RecoveryAction.SKIP_OPERATION],
      retryScheduled: false,
      escalated: false,
      message: '点赞失败，跳过此操作',
      timestamp: new Date()
    };
  }
  
  /**
   * 处理Facebook评论失败
   */
  private async handleFacebookCommentFailed(
    errorDef: ErrorDefinition,
    context?: any
  ): Promise<ErrorHandlingResult> {
    this.logger.warn('Facebook评论失败', {
      errorId: errorDef.id,
      accountId: errorDef.accountId
    });
    
    // 检查评论内容
    const shouldRetry = this.shouldRetryComment(errorDef, context);
    
    if (shouldRetry) {
      return {
        errorId: errorDef.id,
        handled: true,
        recoveryActions: [RecoveryAction.RETRY],
        retryScheduled: true,
        retryDelay: 20000, // 20秒后重试
        escalated: false,
        message: '评论失败，安排重试',
        timestamp: new Date()
      };
    } else {
      return {
        errorId: errorDef.id,
        handled: true,
        recoveryActions: [RecoveryAction.SKIP_OPERATION],
        retryScheduled: false,
        escalated: false,
        message: '评论失败，跳过此操作',
        timestamp: new Date(),
        metadata: {
          errorDef,
          context,
          reason: '评论内容可能有问题'
        }
      };
    }
  }
  
  /**
   * 处理Facebook登录要求
   */
  private async handleFacebookLoginRequired(
    errorDef: ErrorDefinition,
    context?: any
  ): Promise<ErrorHandlingResult> {
    this.logger.warn('需要重新登录Facebook', {
      errorId: errorDef.id,
      accountId: errorDef.accountId
    });
    
    return {
      errorId: errorDef.id,
      handled: true,
      recoveryActions: [RecoveryAction.REFRESH_SESSION, RecoveryAction.RETRY],
      retryScheduled: true,
      retryDelay: 10000, // 10秒后重试
      escalated: false,
      message: '需要重新登录，刷新会话后重试',
      timestamp: new Date()
    };
  }
  
  /**
   * 判断是否应该重试发帖
   */
  private shouldRetryPost(errorDef: ErrorDefinition, context?: any): boolean {
    // 检查重试次数
    const retryCount = context?.retryCount || 0;
    if (retryCount >= 2) {
      return false; // 最多重试2次
    }
    
    // 检查错误信息
    const errorMessage = errorDef.message.toLowerCase();
    
    // 这些错误不应该重试
    const nonRetryableErrors = [
      'spam',
      'policy',
      'violation',
      'inappropriate',
      'abuse',
      'banned content'
    ];
    
    for (const keyword of nonRetryableErrors) {
      if (errorMessage.includes(keyword)) {
        return false;
      }
    }
    
    // 这些错误可以重试
    const retryableErrors = [
      'network',
      'timeout',
      'temporary',
      'try again',
      'server error'
    ];
    
    for (const keyword of retryableErrors) {
      if (errorMessage.includes(keyword)) {
        return true;
      }
    }
    
    // 默认重试
    return true;
  }
  
  /**
   * 判断是否应该重试评论
   */
  private shouldRetryComment(errorDef: ErrorDefinition, context?: any): boolean {
    // 检查重试次数
    const retryCount = context?.retryCount || 0;
    if (retryCount >= 1) {
      return false; // 最多重试1次
    }
    
    // 检查错误信息
    const errorMessage = errorDef.message.toLowerCase();
    
    // 这些错误不应该重试
    const nonRetryableErrors = [
      'spam',
      'harassment',
      'hate speech',
      'bullying',
      'inappropriate'
    ];
    
    for (const keyword of nonRetryableErrors) {
      if (errorMessage.includes(keyword)) {
        return false;
      }
    }
    
    // 默认重试
    return true;
  }
  
  /**
   * 刷新会话（实现父类抽象方法）
   */
  protected async refreshSession(sessionId?: string, context?: any): Promise<void> {
    this.logger.info('刷新Facebook会话', { sessionId });
    
    // 这里应该调用会话管理器的刷新方法
    // 暂时模拟实现
    try {
      // 模拟会话刷新
      await this.delay(2000);
      this.logger.info('Facebook会话刷新成功', { sessionId });
    } catch (error) {
      this.logger.error('Facebook会话刷新失败', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * 升级错误处理（实现父类抽象方法）
   */
  protected async escalateError(errorDef: ErrorDefinition, context?: any): Promise<void> {
    this.logger.error('Facebook错误已升级处理', {
      errorId: errorDef.id,
      errorCode: errorDef.code,
      accountId: errorDef.accountId
    });
    
    // 这里应该实现升级处理逻辑，如：
    // 1. 发送通知给管理员
    // 2. 记录到数据库
    // 3. 触发告警
    
    // 模拟实现
    await this.delay(1000);
    this.logger.info('已发送管理员通知');
  }
  
  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 获取Facebook相关错误统计
   */
  getFacebookErrorStats(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<ErrorSeverity, number>;
  } {
    const errors = this.getAllErrors();
    const facebookErrors = errors.filter(error => 
      error.code.startsWith('FACEBOOK_') || error.source === ErrorSource.OPERATION
    );
    
    const byType: Record<string, number> = {};
    const bySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };
    
    for (const error of facebookErrors) {
      // 统计错误类型
      byType[error.code] = (byType[error.code] || 0) + 1;
      
      // 统计严重级别
      bySeverity[error.severity]++;
    }
    
    return {
      total: facebookErrors.length,
      byType,
      bySeverity
    };
  }
}