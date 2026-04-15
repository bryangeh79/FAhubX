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
        filename: `logs/task-engine-${dayjs().format('YYYY-MM-DD')}.log`,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 7 // 保留7天
      })
    ]
  });
}

/**
 * 任务引擎日志器单例
 */
export class TaskEngineLogger {
  private static instance: winston.Logger;
  
  static getInstance(): winston.Logger {
    if (!TaskEngineLogger.instance) {
      TaskEngineLogger.instance = createLogger('task-engine');
    }
    return TaskEngineLogger.instance;
  }
  
  static info(message: string, meta?: any): void {
    TaskEngineLogger.getInstance().info(message, meta);
  }
  
  static error(message: string, meta?: any): void {
    TaskEngineLogger.getInstance().error(message, meta);
  }
  
  static warn(message: string, meta?: any): void {
    TaskEngineLogger.getInstance().warn(message, meta);
  }
  
  static debug(message: string, meta?: any): void {
    TaskEngineLogger.getInstance().debug(message, meta);
  }
}

/**
 * 性能监控日志器
 */
export class PerformanceLogger {
  private static instance: winston.Logger;
  
  static getInstance(): winston.Logger {
    if (!PerformanceLogger.instance) {
      PerformanceLogger.instance = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp({
            format: () => dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')
          }),
          winston.format.json()
        ),
        defaultMeta: { scope: 'performance' },
        transports: [
          new winston.transports.File({ 
            filename: `logs/performance-${dayjs().format('YYYY-MM-DD')}.log`,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 7
          })
        ]
      });
    }
    return PerformanceLogger.instance;
  }
  
  static logTaskPerformance(
    taskId: string,
    taskName: string,
    duration: number,
    status: string,
    metadata?: any
  ): void {
    PerformanceLogger.getInstance().info('任务性能指标', {
      taskId,
      taskName,
      duration,
      status,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }
  
  static logQueuePerformance(
    queueName: string,
    queueSize: number,
    processingTime: number,
    throughput: number
  ): void {
    PerformanceLogger.getInstance().info('队列性能指标', {
      queueName,
      queueSize,
      processingTime,
      throughput,
      timestamp: new Date().toISOString()
    });
  }
  
  static logWorkerPerformance(
    workerId: string,
    tasksProcessed: number,
    avgProcessingTime: number,
    errorRate: number
  ): void {
    PerformanceLogger.getInstance().info('工作器性能指标', {
      workerId,
      tasksProcessed,
      avgProcessingTime,
      errorRate,
      timestamp: new Date().toISOString()
    });
  }
}