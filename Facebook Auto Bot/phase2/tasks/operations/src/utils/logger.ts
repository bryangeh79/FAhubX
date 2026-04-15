/**
 * 日志工具
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
        filename: `logs/operations-${dayjs().format('YYYY-MM-DD')}.log`,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 7 // 保留7天
      })
    ]
  });
}

/**
 * 操作日志器单例
 */
export class OperationLogger {
  private static instance: winston.Logger;
  
  static getInstance(): winston.Logger {
    if (!OperationLogger.instance) {
      OperationLogger.instance = createLogger('operations');
    }
    return OperationLogger.instance;
  }
  
  static info(message: string, meta?: any): void {
    OperationLogger.getInstance().info(message, meta);
  }
  
  static error(message: string, meta?: any): void {
    OperationLogger.getInstance().error(message, meta);
  }
  
  static warn(message: string, meta?: any): void {
    OperationLogger.getInstance().warn(message, meta);
  }
  
  static debug(message: string, meta?: any): void {
    OperationLogger.getInstance().debug(message, meta);
  }
}