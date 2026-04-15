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
}

export class Logger {
  private name: string;
  private config: LoggerConfig;

  constructor(name: string, config?: Partial<LoggerConfig>) {
    this.name = name;
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      enableConsole: true,
      enableFile: false,
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
        'cookies', 'localStorage', 'encrypted', 'iv', 'tag'
      ];

      const sanitizeObject = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        }

        if (obj && typeof obj === 'object') {
          const result: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
              result[key] = '[REDACTED]';
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
    const loggerStr = `[${entry.logger}]`.padEnd(20);

    const color = colors[entry.level];
    const prefix = `${timestamp} ${color}${levelStr}${reset} ${loggerStr}`;

    console.log(`${prefix} ${entry.message}`);

    if (entry.data) {
      console.log(`${' '.repeat(40)}${JSON.stringify(entry.data, null, 2)}`);
    }
  }

  /**
   * 输出到文件
   */
  private writeToFile(entry: LogEntry): void {
    // 这里可以实现文件日志记录
    // 由于时间关系，暂时不实现完整的文件日志
    // 可以使用winston、pino等成熟的日志库
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
      maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'), // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '10')
    };
  }
}