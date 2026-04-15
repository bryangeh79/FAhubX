import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeout?: number;
  connectionTimeout?: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  tls?: boolean;
}

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm';
  key: string;
  ivLength: number;
  saltLength: number;
}

export interface SessionConfig {
  cleanupInterval: number;
  maxIdleTime: number;
  sessionTtl: number;
  encryption: EncryptionConfig;
}

export interface VPNConfig {
  rotationStrategy: 'round-robin' | 'random' | 'sticky' | 'performance';
  minRotationInterval: number;
  maxSessionsPerIP: number;
  healthCheckInterval: number;
  geoRestrictions?: {
    allowedCountries: string[];
    blockedCountries: string[];
  };
  performanceThreshold?: {
    minDownloadSpeed: number;
    maxPing: number;
    maxPacketLoss: number;
  };
}

export interface HealthCheckConfig {
  checkInterval: number;
  facebookCheckInterval: number;
  riskThresholds: {
    warning: number;
    critical: number;
    ban: number;
  };
  autoFixEnabled: boolean;
  notificationEnabled: boolean;
  checkTypes: string[];
}

export interface MonitoringConfig {
  alertRules: Array<{
    name: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    conditions: Array<{
      metric: string;
      operator: string;
      value: any;
    }>;
    notificationChannels: string[];
  }>;
  notification: {
    slack?: {
      webhookUrl: string;
      channel: string;
    };
    email?: {
      smtpHost: string;
      smtpPort: number;
      username: string;
      password: string;
      from: string;
      to: string[];
    };
  };
}

export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  port: number;
  host: string;
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export interface FullConfig {
  app: AppConfig;
  database: DatabaseConfig;
  redis?: RedisConfig;
  session: SessionConfig;
  vpn: VPNConfig;
  healthCheck: HealthCheckConfig;
  monitoring: MonitoringConfig;
}

export class ConfigManager {
  private config: FullConfig;
  private logger: Logger;
  private configPath: string;

  constructor(configPath?: string) {
    this.logger = new Logger('ConfigManager');
    this.configPath = configPath || this.findConfigFile();
    this.config = this.loadConfig();
  }

  /**
   * 查找配置文件
   */
  private findConfigFile(): string {
    const possiblePaths = [
      process.env.CONFIG_PATH,
      join(process.cwd(), 'config.json'),
      join(process.cwd(), 'config', 'config.json'),
      join(__dirname, '../../../config.json'),
      join(__dirname, '../../../../config.json')
    ].filter(Boolean) as string[];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        this.logger.info(`Found config file: ${path}`);
        return path;
      }
    }

    this.logger.warn('No config file found, using environment variables');
    return '';
  }

  /**
   * 加载配置
   */
  private loadConfig(): FullConfig {
    let fileConfig = {};
    
    if (this.configPath && existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf8');
        fileConfig = JSON.parse(content);
        this.logger.info('Config loaded from file');
      } catch (error) {
        this.logger.error('Failed to load config file', error as Error);
      }
    }

    // 合并文件配置和环境变量
    const config = this.mergeConfigs(fileConfig, this.loadFromEnv());
    
    // 验证配置
    this.validateConfig(config);
    
    return config;
  }

  /**
   * 从环境变量加载配置
   */
  private loadFromEnv(): Partial<FullConfig> {
    return {
      app: {
        environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
        logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || '0.0.0.0',
        corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
        rateLimit: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15分钟
          max: parseInt(process.env.RATE_LIMIT_MAX || '100')
        }
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'facebook_bot',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'true',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000')
      },
      redis: process.env.REDIS_HOST ? {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'fb:',
        tls: process.env.REDIS_TLS === 'true'
      } : undefined,
      session: {
        cleanupInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL || '3600000'),
        maxIdleTime: parseInt(process.env.SESSION_MAX_IDLE_TIME || '86400000'),
        sessionTtl: parseInt(process.env.SESSION_TTL || '604800000'),
        encryption: {
          algorithm: 'aes-256-gcm',
          key: process.env.SESSION_ENCRYPTION_KEY || this.generateDefaultKey(),
          ivLength: parseInt(process.env.SESSION_ENCRYPTION_IV_LENGTH || '12'),
          saltLength: parseInt(process.env.SESSION_ENCRYPTION_SALT_LENGTH || '16')
        }
      },
      vpn: {
        rotationStrategy: (process.env.VPN_ROTATION_STRATEGY as any) || 'round-robin',
        minRotationInterval: parseInt(process.env.VPN_MIN_ROTATION_INTERVAL || '60000'),
        maxSessionsPerIP: parseInt(process.env.VPN_MAX_SESSIONS_PER_IP || '1'),
        healthCheckInterval: parseInt(process.env.VPN_HEALTH_CHECK_INTERVAL || '300000'),
        geoRestrictions: process.env.VPN_GEO_RESTRICTIONS ? JSON.parse(process.env.VPN_GEO_RESTRICTIONS) : undefined,
        performanceThreshold: process.env.VPN_PERFORMANCE_THRESHOLD ? JSON.parse(process.env.VPN_PERFORMANCE_THRESHOLD) : undefined
      },
      healthCheck: {
        checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '300000'),
        facebookCheckInterval: parseInt(process.env.FACEBOOK_CHECK_INTERVAL || '600000'),
        riskThresholds: {
          warning: parseInt(process.env.RISK_THRESHOLD_WARNING || '30'),
          critical: parseInt(process.env.RISK_THRESHOLD_CRITICAL || '60'),
          ban: parseInt(process.env.RISK_THRESHOLD_BAN || '80')
        },
        autoFixEnabled: process.env.AUTO_FIX_ENABLED !== 'false',
        notificationEnabled: process.env.NOTIFICATION_ENABLED !== 'false',
        checkTypes: (process.env.HEALTH_CHECK_TYPES || 'login_status,post_ability,rate_limit,ip_reputation,behavior_analysis').split(',')
      },
      monitoring: {
        alertRules: process.env.MONITORING_ALERT_RULES ? JSON.parse(process.env.MONITORING_ALERT_RULES) : [],
        notification: {
          slack: process.env.SLACK_WEBHOOK_URL ? {
            webhookUrl: process.env.SLACK_WEBHOOK_URL,
            channel: process.env.SLACK_CHANNEL || '#alerts'
          } : undefined,
          email: process.env.SMTP_HOST ? {
            smtpHost: process.env.SMTP_HOST,
            smtpPort: parseInt(process.env.SMTP_PORT || '587'),
            username: process.env.SMTP_USERNAME || '',
            password: process.env.SMTP_PASSWORD || '',
            from: process.env.EMAIL_FROM || 'monitoring@example.com',
            to: process.env.EMAIL_TO ? process.env.EMAIL_TO.split(',') : ['admin@example.com']
          } : undefined
        }
      }
    };
  }

  /**
   * 合并配置
   */
  private mergeConfigs(fileConfig: any, envConfig: any): FullConfig {
    const merge = (target: any, source: any): any => {
      for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) {
            target[key] = {};
          }
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    };

    // 深度合并
    const result = JSON.parse(JSON.stringify(fileConfig));
    return merge(result, envConfig);
  }

  /**
   * 验证配置
   */
  private validateConfig(config: FullConfig): void {
    const errors: string[] = [];

    // 验证数据库配置
    if (!config.database.host) {
      errors.push('Database host is required');
    }
    if (!config.database.password && config.app.environment === 'production') {
      errors.push('Database password is required in production');
    }

    // 验证会话加密密钥
    if (!config.session.encryption.key || config.session.encryption.key === 'default-key') {
      this.logger.warn('Using default encryption key - not secure for production!');
    } else {
      try {
        const keyBuffer = Buffer.from(config.session.encryption.key, 'base64');
        if (keyBuffer.length !== 32) {
          errors.push('Encryption key must be 32 bytes when base64 decoded');
        }
      } catch {
        errors.push('Encryption key must be valid base64');
      }
    }

    // 验证VPN配置
    if (config.vpn.maxSessionsPerIP < 1) {
      errors.push('VPN maxSessionsPerIP must be at least 1');
    }

    // 验证健康检查配置
    if (config.healthCheck.riskThresholds.warning >= config.healthCheck.riskThresholds.critical) {
      errors.push('Health check risk thresholds: warning must be less than critical');
    }
    if (config.healthCheck.riskThresholds.critical >= config.healthCheck.riskThresholds.ban) {
      errors.push('Health check risk thresholds: critical must be less than ban');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\\n${errors.join('\\n')}`);
    }

    this.logger.info('Configuration validated successfully');
  }

  /**
   * 生成默认加密密钥
   */
  private generateDefaultKey(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * 获取配置
   */
  getConfig(): FullConfig {
    return this.config;
  }

  /**
   * 获取应用配置
   */
  getAppConfig(): AppConfig {
    return this.config.app;
  }

  /**
   * 获取数据库配置
   */
  getDatabaseConfig(): DatabaseConfig {
    return this.config.database;
  }

  /**
   * 获取Redis配置
   */
  getRedisConfig(): RedisConfig | undefined {
    return this.config.redis;
  }

  /**
   * 获取会话配置
   */
  getSessionConfig(): SessionConfig {
    return this.config.session;
  }

  /**
   * 获取VPN配置
   */
  getVPNConfig(): VPNConfig {
    return this.config.vpn;
  }

  /**
   * 获取健康检查配置
   */
  getHealthCheckConfig(): HealthCheckConfig {
    return this.config.healthCheck;
  }

  /**
   * 获取监控配置
   */
  getMonitoringConfig(): MonitoringConfig {
    return this.config.monitoring;
  }

  /**
   * 重新加载配置
   */
  reload(): void {
    this.logger.info('Reloading configuration');
    this.config = this.loadConfig();
  }

  /**
   * 获取环境特定的配置
   */
  getEnvironmentConfig(): Record<string, any> {
    const env = this.config.app.environment;
    
    const envConfigs: Record<string, any> = {
      development: {
        debug: true,
        verboseLogging: true,
        disableRateLimit: true
      },
      staging: {
        debug: false,
        verboseLogging: false,
        enableMetrics: true
      },
      production: {
        debug: false,
        verboseLogging: false,
        enableMetrics: true,
        enableAudit: true,
        strictValidation: true
      }
    };

    return envConfigs[env] || {};
  }

  /**
   * 检查功能是否启用
   */
  isFeatureEnabled(feature: string): boolean {
    const featureFlags = process.env.FEATURE_FLAGS ? JSON.parse(process.env.FEATURE_FLAGS) : {};
    return featureFlags[feature] === true;
  }

  /**
   * 获取功能配置
   */
  getFeatureConfig(feature: string): any {
    const featureConfigs = process.env.FEATURE_CONFIGS ? JSON.parse(process.env.FEATURE_CONFIGS) : {};
    return featureConfigs[feature];
  }

  /**
   * 创建默认配置模板
   */
  static createDefaultConfig(): FullConfig {
    const crypto = require('crypto');
    
    return {
      app: {
        environment: 'development',
        logLevel: 'info',
        port: 3000,
        host: '0.0.0.0',
        corsOrigins: ['http://localhost:3000'],
        rateLimit: {
          windowMs: 900000,
          max: 100
        }
      },
      database: {
        host: 'localhost',
        port: 5432,
        database: 'facebook_bot',
        user: 'postgres',
        password: 'password',
        ssl: false,
        maxConnections: 20,
        idleTimeout: 30000,
        connectionTimeout: 10000
      },
      session: {
        cleanupInterval: 3600000,
        maxIdleTime: 86400000,
        sessionTtl: 604800000,
        encryption: {
          algorithm: 'aes-256-gcm',
          key: crypto.randomBytes(32).toString('base64'),
          ivLength: 12,
          saltLength: 16
        }
      },
      vpn: {
        rotationStrategy: 'round-robin',
        minRotationInterval: 60000,
        maxSessionsPerIP: 1,
        healthCheckInterval: 300000,
        geoRestrictions: {
          allowedCountries: ['US', 'CA', 'GB', 'DE', 'FR'],
          blockedCountries: ['RU', 'CN', 'KP', 'IR']
        },
        performanceThreshold: {
          minDownloadSpeed: 10,
          maxPing: 200,
          maxPacketLoss: 5
        }
      },
      healthCheck: {
        checkInterval: 300000,
        facebookCheckInterval: 600000,
        riskThresholds: {
          warning: 30,
          critical: 60,
          ban: 80
        },
        autoFixEnabled: true,
        notificationEnabled: true,
        checkTypes: ['login_status', 'post_ability', 'rate_limit', 'ip_reputation', 'behavior_analysis']
      },
      monitoring: {
        alertRules: [
          {
            name: 'High Error Rate',
            severity: 'error',
            conditions: [
              {
                metric: 'error_rate',
                operator: '>',
                value: 0.1
              }
            ],
            notificationChannels: ['slack']
          }
        ],
        notification: {
          slack: {
            webhookUrl: 'https://hooks.slack.com/services/...',
            channel: '#alerts'
          }
        }
      }
    };
  }
}