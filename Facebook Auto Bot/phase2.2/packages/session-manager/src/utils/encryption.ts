import crypto from 'crypto';
import { EncryptionConfig } from '../types';

export class EncryptionService {
  private config: EncryptionConfig;

  constructor(config: EncryptionConfig) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * 验证加密配置
   */
  private validateConfig(): void {
    if (!this.config.key) {
      throw new Error('Encryption key is required');
    }

    if (this.config.algorithm !== 'aes-256-gcm') {
      throw new Error(`Unsupported algorithm: ${this.config.algorithm}`);
    }

    // 验证密钥长度
    const keyBuffer = Buffer.from(this.config.key, 'base64');
    if (keyBuffer.length !== 32) {
      throw new Error(`Invalid key length: expected 32 bytes, got ${keyBuffer.length}`);
    }
  }

  /**
   * 加密数据
   */
  encrypt(data: string): { encrypted: string; iv: string; tag: string } {
    try {
      // 生成随机初始化向量
      const iv = crypto.randomBytes(this.config.ivLength || 12);
      
      // 创建加密器
      const cipher = crypto.createCipheriv(
        this.config.algorithm,
        Buffer.from(this.config.key, 'base64'),
        iv,
        { authTagLength: 16 }
      );

      // 加密数据
      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // 获取认证标签
      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('base64'),
        tag: tag.toString('base64')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * 解密数据
   */
  decrypt(encrypted: string, iv: string, tag: string): string {
    try {
      // 验证参数
      if (!encrypted || !iv || !tag) {
        throw new Error('Missing required encryption parameters');
      }

      // 创建解密器
      const decipher = crypto.createDecipheriv(
        this.config.algorithm,
        Buffer.from(this.config.key, 'base64'),
        Buffer.from(iv, 'base64'),
        { authTagLength: 16 }
      );

      // 设置认证标签
      decipher.setAuthTag(Buffer.from(tag, 'base64'));

      // 解密数据
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      if ((error as Error).message.includes('bad decrypt')) {
        throw new Error('Decryption failed: invalid key or corrupted data');
      }
      throw new Error(`Decryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * 加密JSON对象
   */
  encryptObject<T>(obj: T): { encrypted: string; iv: string; tag: string } {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString);
  }

  /**
   * 解密JSON对象
   */
  decryptObject<T>(encrypted: string, iv: string, tag: string): T {
    const jsonString = this.decrypt(encrypted, iv, tag);
    return JSON.parse(jsonString) as T;
  }

  /**
   * 生成加密密钥
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * 生成随机盐值
   */
  static generateSalt(length: number = 16): string {
    return crypto.randomBytes(length).toString('base64');
  }

  /**
   * 计算数据哈希（用于验证）
   */
  static hashData(data: string, algorithm: string = 'sha256'): string {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * 验证数据完整性
   */
  static verifyIntegrity(data: string, expectedHash: string, algorithm: string = 'sha256'): boolean {
    const actualHash = this.hashData(data, algorithm);
    return crypto.timingSafeEqual(
      Buffer.from(actualHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  }

  /**
   * 创建安全的加密配置
   */
  static createSecureConfig(): EncryptionConfig {
    return {
      algorithm: 'aes-256-gcm',
      key: this.generateKey(),
      ivLength: 12,
      saltLength: 16
    };
  }

  /**
   * 从环境变量创建加密配置
   */
  static createConfigFromEnv(): EncryptionConfig {
    const key = process.env.SESSION_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('SESSION_ENCRYPTION_KEY environment variable is required');
    }

    return {
      algorithm: 'aes-256-gcm',
      key,
      ivLength: parseInt(process.env.SESSION_ENCRYPTION_IV_LENGTH || '12'),
      saltLength: parseInt(process.env.SESSION_ENCRYPTION_SALT_LENGTH || '16')
    };
  }

  /**
   * 验证加密数据格式
   */
  static validateEncryptedData(encrypted: string, iv: string, tag: string): boolean {
    try {
      // 检查base64格式
      const isBase64 = (str: string) => {
        try {
          return Buffer.from(str, 'base64').toString('base64') === str;
        } catch {
          return false;
        }
      };

      return isBase64(encrypted) && isBase64(iv) && isBase64(tag);
    } catch {
      return false;
    }
  }

  /**
   * 安全地比较两个字符串（防止时序攻击）
   */
  static secureCompare(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(a, 'utf8'),
        Buffer.from(b, 'utf8')
      );
    } catch {
      return false;
    }
  }
}