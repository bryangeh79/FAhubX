/**
 * 日志工具类
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: any;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number;
  format: 'json' | 'text';
}

export class Logger {
  private name: string;
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  
  constructor(name: string, config?: Partial<LoggerConfig>) {
    this.name = name;
    
    // 默认配置
    this.config = {
      level: 'info',
      enableConsole: true,
      enableFile: false,
      format: 'text',
      ...config
    };
  }
  
  /**
   * 调试日志
   */
  debug(message: string, context?: any): void {
    this.log('debug', message, context);
  }
  
  /**
   * 信息日志
   */
  info(message: string, context?: any): void {
    this.log('info', message, context);
  }
  
  /**
   * 警告日志
   */
  warn(message: string, context?: any): void {
    this.log('warn', message, context);
  }
  
  /**
   * 错误日志
   */
  error(message: string, error?: Error, context?: any): void {
    this.log('error', message, context, error);
  }
  
  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, context?: any, error?: Error): void {
    // 检查日志级别
    if (!this.shouldLog(level)) {
      return;
    }
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error
    };
    
    // 添加到缓冲区
    this.logBuffer.push(entry);
    
    // 输出到控制台
    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }
    
    // 写入文件
    if (this.config.enableFile && this.config.filePath) {
      this.writeToFile(entry);
    }
    
    // 清理缓冲区
    if (this.logBuffer.length > 1000) {
      this.logBuffer = this.logBuffer.slice(-500);
    }
  }
  
  /**
   * 检查是否应该记录该级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levelOrder = { debug: 0, info: 1, warn: 2, error: 3 };
    return levelOrder[level] >= levelOrder[this.config.level];
  }
  
  /**
   * 写入控制台
   */
  private writeToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const name = this.name.padEnd(20);
    
    let logMessage = `[${timestamp}] ${level} ${name} ${entry.message}`;
    
    if (entry.context) {
      logMessage += ` ${JSON.stringify(entry.context, null, 0)}`;
    }
    
    if (entry.error) {
      logMessage += `\n${entry.error.stack}`;
    }
    
    // 根据级别使用不同的控制台方法
    switch (entry.level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }
  
  /**
   * 写入文件
   */
  private writeToFile(entry: LogEntry): void {
    // 简化实现 - 实际应该异步写入文件
    // 这里只记录到缓冲区，实际文件写入需要额外实现
    console.warn('File logging not fully implemented');
  }
  
  /**
   * 获取日志缓冲区
   */
  getLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }
  
  /**
   * 清理日志缓冲区
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }
  
  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
  
  /**
   * 创建子日志器
   */
  createChild(childName: string): Logger {
    return new Logger(`${this.name}:${childName}`, this.config);
  }
}