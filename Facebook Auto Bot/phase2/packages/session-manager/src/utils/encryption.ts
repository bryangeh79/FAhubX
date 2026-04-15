import CryptoJS from 'crypto-js';
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm' | 'aes-256-cbc';
  keyDerivation: 'scrypt' | 'pbkdf2';
  keyLength: number;
  ivLength: number;
  saltLength: number;
  tagLength: number;
}

export class EncryptionService {
  private config: EncryptionConfig;
  private masterKey: string;

  constructor(masterKey: string, config?: Partial<EncryptionConfig>) {
    if (!masterKey || masterKey.length < 32) {
      throw new Error('Master key must be at least 32 characters long');
    }

    this.masterKey = masterKey;
    this.config = {
      algorithm: 'aes-256-gcm',
      keyDerivation: 'scrypt',
      keyLength: 32, // 256 bits
      ivLength: 16,  // 128 bits
      saltLength: 32,
      tagLength: 16,
      ...config
    };
  }

  /**
   * 生成加密密钥
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    if (this.config.keyDerivation === 'scrypt') {
      return scryptSync(password, salt, this.config.keyLength, {
        N: 16384, // CPU/内存成本参数
        r: 8,     // 块大小参数
        p: 1      // 并行化参数
      });
    } else {
      // PBKDF2作为备选
      const crypto = require('crypto');
      return crypto.pbkdf2Sync(
        password,
        salt,
        100000, // 迭代次数
        this.config.keyLength,
        'sha256'
      );
    }
  }

  /**
   * 加密数据
   */
  encrypt(data: any): string {
    try {
      // 生成随机盐和IV
      const salt = randomBytes(this.config.saltLength);
      const iv = randomBytes(this.config.ivLength);

      // 派生加密密钥
      const key = this.deriveKey(this.masterKey, salt);

      // 准备要加密的数据
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const dataBuffer = Buffer.from(dataString, 'utf8');

      // 创建加密器
      const cipher = createCipheriv(this.config.algorithm, key, iv);
      
      // 加密数据
      let encrypted = cipher.update(dataBuffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // 获取认证标签（GCM模式）
      let authTag: Buffer | undefined;
      if (this.config.algorithm === 'aes-256-gcm') {
        authTag = cipher.getAuthTag();
      }

      // 组合所有部分：盐 + IV + 加密数据 + 认证标签
      const resultParts = [salt, iv, encrypted];
      if (authTag) {
        resultParts.push(authTag);
      }

      const result = Buffer.concat(resultParts);
      
      // 返回Base64编码的字符串
      return result.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * 解密数据
   */
  decrypt(encryptedData: string): any {
    try {
      // 解码Base64字符串
      const dataBuffer = Buffer.from(encryptedData, 'base64');
      
      // 提取各个部分
      let offset = 0;
      
      // 提取盐
      const salt = dataBuffer.slice(offset, offset + this.config.saltLength);
      offset += this.config.saltLength;
      
      // 提取IV
      const iv = dataBuffer.slice(offset, offset + this.config.ivLength);
      offset += this.config.ivLength;
      
      // 提取加密数据（剩余部分减去可能的认证标签）
      let encrypted: Buffer;
      let authTag: Buffer | undefined;
      
      if (this.config.algorithm === 'aes-256-gcm') {
        // GCM模式：最后部分是认证标签
        const encryptedLength = dataBuffer.length - offset - this.config.tagLength;
        encrypted = dataBuffer.slice(offset, offset + encryptedLength);
        offset += encryptedLength;
        authTag = dataBuffer.slice(offset, offset + this.config.tagLength);
      } else {
        // CBC模式：剩余部分都是加密数据
        encrypted = dataBuffer.slice(offset);
      }

      // 派生解密密钥
      const key = this.deriveKey(this.masterKey, salt);

      // 创建解密器
      const decipher = createDecipheriv(this.config.algorithm, key, iv);
      
      // 设置认证标签（GCM模式）
      if (authTag && this.config.algorithm === 'aes-256-gcm') {
        decipher.setAuthTag(authTag);
      }

      // 解密数据
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      // 解析解密后的数据
      const decryptedString = decrypted.toString('utf8');
      
      try {
        return JSON.parse(decryptedString);
      } catch {
        // 如果不是JSON，返回原始字符串
        return decryptedString;
      }
    } catch (error) {
      throw new Error(`Decryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * 加密对象（简化接口）
   */
  encryptObject<T>(obj: T): string {
    return this.encrypt(obj);
  }

  /**
   * 解密对象（简化接口）
   */
  decryptObject<T>(encrypted: string): T {
    return this.decrypt(encrypted) as T;
  }

  /**
   * 生成数据签名
   */
  sign(data: any): string {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.HmacSHA256(dataString, this.masterKey).toString();
  }

  /**
   * 验证数据签名
   */
  verify(data: any, signature: string): boolean {
    const expectedSignature = this.sign(data);
    return CryptoJS.timingSafeEqual(
      CryptoJS.enc.Hex.parse(signature),
      CryptoJS.enc.Hex.parse(expectedSignature)
    );
  }

  /**
   * 生成安全的随机字符串
   */
  generateRandomString(length: number = 32): string {
    return randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  /**
   * 哈希数据（不可逆）
   */
  hash(data: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
    if (algorithm === 'sha256') {
      return CryptoJS.SHA256(data).toString();
    } else {
      return CryptoJS.SHA512(data).toString();
    }
  }

  /**
   * 安全比较字符串（防止时序攻击）
   */
  secureCompare(a: string, b: string): boolean {
    return CryptoJS.timingSafeEqual(
      CryptoJS.enc.Utf8.parse(a),
      CryptoJS.enc.Utf8.parse(b)
    );
  }
}

/**
 * 会话数据加密器（专门用于会话数据）
 */
export class SessionEncryptor {
  private encryptionService: EncryptionService;

  constructor(masterKey: string) {
    this.encryptionService = new EncryptionService(masterKey, {
      algorithm: 'aes-256-gcm',
      keyDerivation: 'scrypt'
    });
  }

  /**
   * 加密会话数据
   */
  encryptSessionData(sessionData: SessionData): EncryptedSessionData {
    const { cookies, localStorage, ...metadata } = sessionData;
    
    // 分别加密敏感数据
    const encryptedCookies = cookies ? this.encryptionService.encrypt(cookies) : null;
    const encryptedLocalStorage = localStorage ? this.encryptionService.encrypt(localStorage) : null;
    
    // 生成数据完整性签名
    const dataToSign = {
      cookiesHash: cookies ? this.encryptionService.hash(JSON.stringify(cookies)) : null,
      localStorageHash: localStorage ? this.encryptionService.hash(JSON.stringify(localStorage)) : null,
      metadata
    };
    
    const signature = this.encryptionService.sign(dataToSign);

    return {
      encryptedCookies,
      encryptedLocalStorage,
      metadata,
      signature,
      encryptedAt: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * 解密密会话数据
   */
  decryptSessionData(encryptedData: EncryptedSessionData): SessionData {
    // 验证签名
    const dataToVerify = {
      cookiesHash: encryptedData.encryptedCookies 
        ? this.encryptionService.hash(JSON.stringify(
            this.encryptionService.decrypt(encryptedData.encryptedCookies)
          )) 
        : null,
      localStorageHash: encryptedData.encryptedLocalStorage
        ? this.encryptionService.hash(JSON.stringify(
            this.encryptionService.decrypt(encryptedData.encryptedLocalStorage)
          ))
        : null,
      metadata: encryptedData.metadata
    };

    if (!this.encryptionService.verify(dataToVerify, encryptedData.signature)) {
      throw new Error('Session data integrity check failed');
    }

    // 解密数据
    const cookies = encryptedData.encryptedCookies
      ? this.encryptionService.decrypt(encryptedData.encryptedCookies)
      : null;

    const localStorage = encryptedData.encryptedLocalStorage
      ? this.encryptionService.decrypt(encryptedData.encryptedLocalStorage)
      : null;

    return {
      ...encryptedData.metadata,
      cookies,
      localStorage
    };
  }

  /**
   * 验证会话数据完整性
   */
  verifySessionIntegrity(encryptedData: EncryptedSessionData): boolean {
    try {
      const dataToVerify = {
        cookiesHash: encryptedData.encryptedCookies 
          ? this.encryptionService.hash(JSON.stringify(
              this.encryptionService.decrypt(encryptedData.encryptedCookies)
            )) 
          : null,
        localStorageHash: encryptedData.encryptedLocalStorage
          ? this.encryptionService.hash(JSON.stringify(
              this.encryptionService.decrypt(encryptedData.encryptedLocalStorage)
            ))
          : null,
        metadata: encryptedData.metadata
      };

      return this.encryptionService.verify(dataToVerify, encryptedData.signature);
    } catch (error) {
      return false;
    }
  }
}

// 类型定义
export interface SessionData {
  cookies?: any[];
  localStorage?: Record<string, string>;
  [key: string]: any;
}

export interface EncryptedSessionData {
  encryptedCookies: string | null;
  encryptedLocalStorage: string | null;
  metadata: Record<string, any>;
  signature: string;
  encryptedAt: string;
  version: string;
}

/**
 * 密钥管理服务
 */
export class KeyManagementService {
  private keyStorage: Map<string, string> = new Map();
  private keyRotationInterval: number = 30 * 24 * 60 * 60 * 1000; // 30天

  constructor() {
    // 定期清理过期的密钥
    setInterval(() => this.cleanupExpiredKeys(), 24 * 60 * 60 * 1000);
  }

  /**
   * 生成新的加密密钥
   */
  generateKey(keyId: string, keyLength: number = 32): string {
    const key = randomBytes(keyLength).toString('hex');
    this.keyStorage.set(keyId, key);
    return key;
  }

  /**
   * 获取密钥
   */
  getKey(keyId: string): string | undefined {
    return this.keyStorage.get(keyId);
  }

  /**
   * 轮换密钥
   */
  rotateKey(keyId: string): string {
    const newKey = this.generateKey(keyId);
    // 这里可以添加旧密钥的迁移逻辑
    return newKey;
  }

  /**
   * 清理过期的密钥
   */
  private cleanupExpiredKeys(): void {
    // 实现密钥过期逻辑
    // 这里可以根据密钥的创建时间或其他元数据来清理
  }

  /**
   * 导出密钥（用于备份）
   */
  exportKeys(): Record<string, string> {
    return Object.fromEntries(this.keyStorage);
  }

  /**
   * 导入密钥（从备份恢复）
   */
  importKeys(keys: Record<string, string>): void {
    Object.entries(keys).forEach(([keyId, key]) => {
      this.keyStorage.set(keyId, key);
    });
  }
}