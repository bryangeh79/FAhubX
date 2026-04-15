export { SessionManager } from './session-manager';
export { EncryptionService } from './utils/encryption';
export { DatabaseClient } from './database/client';
export { Logger } from './utils/logger';

export * from './types';

/**
 * 创建默认的SessionManager实例
 */
export async function createSessionManager(): Promise<SessionManager> {
  const config = SessionManager.createConfigFromEnv();
  const sessionManager = new SessionManager(config);
  await sessionManager.initialize();
  return sessionManager;
}

/**
 * 工具函数：验证环境变量
 */
export function validateEnvironment(): string[] {
  const errors: string[] = [];

  // 检查必要的环境变量
  const requiredEnvVars = [
    'SESSION_ENCRYPTION_KEY',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // 验证加密密钥长度
  const encryptionKey = process.env.SESSION_ENCRYPTION_KEY;
  if (encryptionKey) {
    try {
      const keyBuffer = Buffer.from(encryptionKey, 'base64');
      if (keyBuffer.length !== 32) {
        errors.push('SESSION_ENCRYPTION_KEY must be 32 bytes when base64 decoded');
      }
    } catch {
      errors.push('SESSION_ENCRYPTION_KEY must be valid base64');
    }
  }

  return errors;
}

/**
 * 工具函数：生成加密密钥
 */
export function generateEncryptionKey(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('base64');
}

/**
 * 工具函数：创建默认配置
 */
export function createDefaultConfig() {
  return {
    encryption: {
      algorithm: 'aes-256-gcm' as const,
      key: generateEncryptionKey(),
      ivLength: 12,
      saltLength: 16
    },
    database: {
      host: 'localhost',
      port: 5432,
      database: 'facebook_bot',
      user: 'postgres',
      password: '',
      ssl: false,
      maxConnections: 20,
      idleTimeout: 30000
    },
    cleanupInterval: 3600000, // 1小时
    maxIdleTime: 86400000, // 24小时
    sessionTtl: 604800000 // 7天
  };
}

// 默认导出
export default {
  SessionManager,
  EncryptionService,
  DatabaseClient,
  Logger,
  createSessionManager,
  validateEnvironment,
  generateEncryptionKey,
  createDefaultConfig
};