export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  logger: string;
  message: string;
  data?: any;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile?: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableRemote?: boolean;
  remoteEndpoint?: string;
}

export class Logger {
  private name: string;
  private config: LoggerConfig;

  constructor(name: string, config?: Partial<LoggerConfig>) {
    this.name = name;
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      enableConsole: process.env.LOG_CONSOLE !== 'false',
      enableFile: process.env.LOG_FILE === 'true',
      filePath: process.env.LOG_FILE_PATH,
      maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'), // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
      enableRemote: process.env.LOG_REMOTE === 'true',
      remoteEndpoint: process.env.LOG_REMOTE_ENDPOINT,
      ...config
    };
  }

  /**
   * 记录调试日志
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * 记录信息日志
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * 记录警告日志
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * 记录错误日志
   */
  error(message: string, error?: Error | any, data?: any): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.log('error', message, { ...data, error: errorObj.message, stack: errorObj.stack });
  }

  /**
   * 记录性能日志
   */
  perf(operation: string, duration: number, data?: any): void {
    this.log('info', `Performance: ${operation} took ${duration}ms`, {
      ...data,
      operation,
      duration,
      type: 'performance'
    });
  }

  /**
   * 记录审计日志
   */
  audit(action: string, resource: string, userId?: string, data?: any): void {
    this.log('info', `Audit: ${action} on ${resource}`, {
      ...data,
      action,
      resource,
      userId,
      type: 'audit'
    });
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, data?: any): void {
    // 检查日志级别
    if (!this.shouldLog(level)) {
      return;
    }

    // 创建日志条目
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      logger: this.name,
      message,
      data: this.sanitizeData(data)
    };

    // 输出到控制台
    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }

    // 输出到文件
    if (this.config.enableFile && this.config.filePath) {
      this.writeToFile(entry);
    }

    // 发送到远程
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.sendToRemote(entry).catch(error => {
        // 避免递归错误
        if (this.config.enableConsole) {
          console.error('Failed to send log to remote:', error);
        }
      });
    }
  }

  /**
   * 检查是否应该记录该级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.config.level];
  }

  /**
   * 清理数据（移除敏感信息）
   */
  private sanitizeData(data: any): any {
    if (!data) return data;

    try {
      const sanitized = JSON.parse(JSON.stringify(data));
      
      // 移除敏感字段
      const sensitiveFields = [
        'password', 'token', 'key', 'secret', 'auth',
        'cookies', 'localStorage', 'encrypted', 'iv', 'tag',
        'privateKey', 'publicKey', 'certificate', 'sshKey'
      ];

      const sanitizeObject = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        }

        if (obj && typeof obj === 'object') {
          const result: any = {};
          for (const [key, value] of Object.entries(obj)) {
            const keyLower = key.toLowerCase();
            if (sensitiveFields.some(field => keyLower.includes(field))) {
              result[key] = '[REDACTED]';
            } else if (key === 'error' && value && typeof value === 'object') {
              // 处理错误对象
              result[key] = {
                message: value.message,
                stack: value.stack,
                name: value.name
              };
            } else {
              result[key] = sanitizeObject(value);
            }
          }
          return result;
        }

        return obj;
      };

      return sanitizeObject(sanitized);
    } catch {
      return '[Cannot serialize data]';
    }
  }

  /**
   * 输出到控制台
   */
  private writeToConsole(entry: LogEntry): void {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m'  // Red
    };

    const reset = '\x1b[0m';
    const timestamp = entry.timestamp.substring(11, 23); // HH:MM:SS.mmm
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const loggerStr = `[${entry.logger}]`.padEnd(25);

    const color = colors[entry.level];
    const prefix = `${timestamp} ${color}${levelStr}${reset} ${loggerStr}`;

    console.log(`${prefix} ${entry.message}`);

    if (entry.data) {
      console.log(`${' '.repeat(45)}${JSON.stringify(entry.data, null, 2)}`);
    }

    if (entry.error) {
      console.log(`${' '.repeat(45)}Error: ${entry.error.message}`);
      if (entry.error.stack) {
        console.log(`${' '.repeat(45)}${entry.error.stack.split('\\n').join('\\n' + ' '.repeat(45))}`);
      }
    }
  }

  /**
   * 输出到文件
   */
  private writeToFile(entry: LogEntry): void {
    // 这里可以实现文件日志记录
    // 可以使用winston、pino等成熟的日志库
    // 由于时间关系，暂时不实现
  }

  /**
   * 发送到远程
   */
  private async sendToRemote(entry: LogEntry): Promise<void> {
    try {
      const response = await fetch(this.config.remoteEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry)
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.statusText}`);
      }
    } catch (error) {
      // 错误已在调用处处理
      throw error;
    }
  }

  /**
   * 创建子日志器
   */
  child(childName: string): Logger {
    return new Logger(`${this.name}:${childName}`, this.config);
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
   * 从环境变量创建日志配置
   */
  static createConfigFromEnv(): LoggerConfig {
    return {
      level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      enableConsole: process.env.LOG_CONSOLE !== 'false',
      enableFile: process.env.LOG_FILE === 'true',
      filePath: process.env.LOG_FILE_PATH,
      maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'),
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
      enableRemote: process.env.LOG_REMOTE === 'true',
      remoteEndpoint: process.env.LOG_REMOTE_ENDPOINT
    };
  }

  /**
   * 创建性能监控器
   */
  static createPerfMonitor(logger: Logger, operation: string) {
    const startTime = Date.now();
    
    return {
      end: (data?: any) => {
        const duration = Date.now() - startTime;
        logger.perf(operation, duration, data);
        return duration;
      },
      mark: (stage: string) => {
        const elapsed = Date.now() - startTime;
        logger.debug(`Perf mark: ${stage}`, { operation, stage, elapsed });
      }
    };
  }
}