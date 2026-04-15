/**
 * 智能错误处理系统主入口
 */

// 导出核心类
export { BaseErrorHandler } from './core/base-error-handler';

// 导出处理器
export { FacebookErrorHandler } from './handlers/facebook-error-handler';

// 导出工具类
export { 
  ErrorHandlingLogger, 
  ErrorAnalysisLogger, 
  AlertLogger, 
  createLogger 
} from './utils/logger';

// 导出类型
export * from './types';

// 导出常量
export { 
  ErrorSeverity, 
  ErrorCategory, 
  ErrorSource, 
  RecoveryAction, 
  AlertAction 
} from './types';

/**
 * 错误处理系统版本
 */
export const VERSION = '1.0.0';

/**
 * 初始化错误处理系统
 */
export function initializeErrorHandling(): void {
  console.log(`智能错误处理系统 v${VERSION} 已初始化`);
  console.log('支持的错误类别:', Object.values(ErrorCategory).join(', '));
  console.log('支持的恢复动作:', Object.values(RecoveryAction).join(', '));
}

/**
 * 创建Facebook错误处理器实例
 */
export function createFacebookErrorHandler(): FacebookErrorHandler {
  return new FacebookErrorHandler();
}

/**
 * 处理错误（快捷方法）
 */
export async function handleError(
  error: Error,
  context?: any
): Promise<any> {
  const handler = createFacebookErrorHandler();
  return await handler.handleError(error, context);
}

/**
 * 处理操作错误（快捷方法）
 */
export async function handleOperationError(
  operationResult: any
): Promise<any> {
  const handler = createFacebookErrorHandler();
  return await handler.handleOperationError(operationResult);
}

/**
 * 处理任务错误（快捷方法）
 */
export async function handleTaskError(
  taskResult: any
): Promise<any> {
  const handler = createFacebookErrorHandler();
  return await handler.handleTaskError(taskResult);
}

/**
 * 错误处理系统管理器
 */
export class ErrorHandlingManager {
  private facebookHandler: FacebookErrorHandler;
  
  constructor() {
    this.facebookHandler = new FacebookErrorHandler();
    ErrorHandlingLogger.info('错误处理系统管理器已初始化');
  }
  
  /**
   * 获取Facebook错误处理器
   */
  getFacebookHandler(): FacebookErrorHandler {
    return this.facebookHandler;
  }
  
  /**
   * 处理错误（统一入口）
   */
  async handleError(error: Error, context?: any): Promise<any> {
    // 根据错误来源选择处理器
    if (context?.source === 'facebook' || context?.operationType) {
      return await this.facebookHandler.handleError(error, context);
    }
    
    // 默认使用Facebook处理器
    return await this.facebookHandler.handleError(error, context);
  }
  
  /**
   * 批量处理错误
   */
  async handleErrors(errors: Error[], context?: any): Promise<any[]> {
    const results = [];
    
    for (const error of errors) {
      try {
        const result = await this.handleError(error, context);
        results.push(result);
      } catch (handleError) {
        ErrorHandlingLogger.error('处理错误时发生异常', {
          error: error.message,
          handleError: handleError instanceof Error ? handleError.message : String(handleError)
        });
        results.push({
          handled: false,
          error: '处理错误时发生异常',
          originalError: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * 获取错误统计
   */
  getErrorStats(): {
    totalErrors: number;
    facebookErrors: any;
    recentErrors: any[];
  } {
    const facebookErrors = this.facebookHandler.getAllErrors();
    const facebookStats = this.facebookHandler.getFacebookErrorStats();
    
    return {
      totalErrors: facebookErrors.length,
      facebookErrors: facebookStats,
      recentErrors: facebookErrors
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10) // 最近10个错误
    };
  }
  
  /**
   * 清理旧错误
   */
  cleanupOldErrors(maxAgeHours: number = 24): void {
    this.facebookHandler.cleanupOldErrors(maxAgeHours);
    ErrorHandlingLogger.info('已清理旧错误', { maxAgeHours });
  }
  
  /**
   * 获取系统状态
   */
  getSystemStatus(): any {
    const stats = this.getErrorStats();
    
    return {
      version: VERSION,
      handlers: {
        facebook: {
          initialized: true,
          errorCount: stats.totalErrors
        }
      },
      stats: {
        totalErrors: stats.totalErrors,
        bySeverity: stats.facebookErrors.bySeverity,
        recentErrorCount: stats.recentErrors.length
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 创建错误处理系统管理器实例
 */
export function createErrorHandlingManager(): ErrorHandlingManager {
  return new ErrorHandlingManager();
}