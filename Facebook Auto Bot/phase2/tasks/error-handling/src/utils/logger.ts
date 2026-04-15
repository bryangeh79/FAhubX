/**
 * 错误处理日志工具
 */

import winston from 'winston';
import dayjs from 'dayjs';

/**
 * 创建日志器
 */
export function createLogger(scope: string): winston.Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({
        format: () => dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.printf(({ timestamp, level, message, scope: logScope, ...meta }) => {
        const scopeStr = logScope ? `[${logScope}]` : `[${scope}]`;
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level.toUpperCase()} ${scopeStr} ${message}${metaStr}`;
      })
    ),
    defaultMeta: { scope },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      new winston.transports.File({ 
        filename: `logs/error-handling-${dayjs().format('YYYY-MM-DD')}.log`,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 7 // 保留7天
      }),
      new winston.transports.File({
        filename: `logs/errors-${dayjs().format('YYYY-MM-DD')}.log`,
        level: 'error',
        maxsize: 10 * 1024 * 1024,
        maxFiles: 30 // 错误日志保留30天
      })
    ]
  });
}

/**
 * 错误处理日志器单例
 */
export class ErrorHandlingLogger {
  private static instance: winston.Logger;
  
  static getInstance(): winston.Logger {
    if (!ErrorHandlingLogger.instance) {
      ErrorHandlingLogger.instance = createLogger('error-handling');
    }
    return ErrorHandlingLogger.instance;
  }
  
  static info(message: string, meta?: any): void {
    ErrorHandlingLogger.getInstance().info(message, meta);
  }
  
  static error(message: string, meta?: any): void {
    ErrorHandlingLogger.getInstance().error(message, meta);
  }
  
  static warn(message: string, meta?: any): void {
    ErrorHandlingLogger.getInstance().warn(message, meta);
  }
  
  static debug(message: string, meta?: any): void {
    ErrorHandlingLogger.getInstance().debug(message, meta);
  }
}

/**
 * 错误分析日志器
 */
export class ErrorAnalysisLogger {
  private static instance: winston.Logger;
  
  static getInstance(): winston.Logger {
    if (!ErrorAnalysisLogger.instance) {
      ErrorAnalysisLogger.instance = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp({
            format: () => dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')
          }),
          winston.format.json()
        ),
        defaultMeta: { scope: 'error-analysis' },
        transports: [
          new winston.transports.File({ 
            filename: `logs/error-analysis-${dayjs().format('YYYY-MM-DD')}.log`,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 7
          })
        ]
      });
    }
    return ErrorAnalysisLogger.instance;
  }
  
  static logErrorAnalysis(
    errorId: string,
    errorCode: string,
    analysisResult: any,
    recommendations: string[]
  ): void {
    ErrorAnalysisLogger.getInstance().info('错误分析结果', {
      errorId,
      errorCode,
      analysisResult,
      recommendations,
      timestamp: new Date().toISOString()
    });
  }
  
  static logRecoveryPlan(
    errorId: string,
    errorCode: string,
    recoveryActions: string[],
    success: boolean,
    details?: any
  ): void {
    ErrorAnalysisLogger.getInstance().info('恢复计划执行', {
      errorId,
      errorCode,
      recoveryActions,
      success,
      details,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 告警日志器
 */
export class AlertLogger {
  private static instance: winston.Logger;
  
  static getInstance(): winston.Logger {
    if (!AlertLogger.instance) {
      AlertLogger.instance = winston.createLogger({
        level: 'warn',
        format: winston.format.combine(
          winston.format.timestamp({
            format: () => dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')
          }),
          winston.format.json()
        ),
        defaultMeta: { scope: 'alerts' },
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          }),
          new winston.transports.File({ 
            filename: `logs/alerts-${dayjs().format('YYYY-MM-DD')}.log`,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 30 // 告警日志保留30天
          })
        ]
      });
    }
    return AlertLogger.instance;
  }
  
  static logAlert(
    alertId: string,
    ruleId: string,
    severity: string,
    message: string,
    errorDetails?: any
  ): void {
    AlertLogger.getInstance().warn('告警触发', {
      alertId,
      ruleId,
      severity,
      message,
      errorDetails,
      timestamp: new Date().toISOString()
    });
  }
  
  static logAlertAcknowledgment(
    alertId: string,
    acknowledgedBy: string,
    notes?: string
  ): void {
    AlertLogger.getInstance().info('告警已确认', {
      alertId,
      acknowledgedBy,
      notes,
      timestamp: new Date().toISOString()
    });
  }
}