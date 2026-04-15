import { Injectable, Inject } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';

export interface TokenPayload {
  userId: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  exp?: number;
  iat?: number;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly tokenExpiry: string;

  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.tokenExpiry = process.env.JWT_EXPIRY || '7d';
  }

  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      // 检查令牌是否在黑名单中
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        this.logger.warn('Token is blacklisted');
        return null;
      }

      // 验证 JWT
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      
      // 检查令牌是否过期
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        this.logger.warn('Token has expired');
        return null;
      }

      // 验证用户是否存在（可选）
      if (payload.userId) {
        const userExists = await this.checkUserExists(payload.userId);
        if (!userExists) {
          this.logger.warn(`User not found: ${payload.userId}`);
          return null;
        }
      }

      this.logger.info(`Token verified for user: ${payload.userId}`);
      return payload;

    } catch (error) {
      this.logger.error(`Token verification failed: ${error.message}`, { error });
      return null;
    }
  }

  async generateToken(payload: Omit<TokenPayload, 'exp' | 'iat'>): Promise<string> {
    try {
      const tokenPayload: TokenPayload = {
        ...payload,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = jwt.sign(tokenPayload, this.jwtSecret, {
        expiresIn: this.tokenExpiry,
      });

      // 记录令牌生成
      await this.recordTokenGeneration(payload.userId, token);

      this.logger.info(`Token generated for user: ${payload.userId}`);
      return token;

    } catch (error) {
      this.logger.error(`Token generation failed: ${error.message}`, { error });
      throw error;
    }
  }

  async blacklistToken(token: string, reason: string = 'logout'): Promise<void> {
    try {
      // 解码令牌获取过期时间
      const decoded = jwt.decode(token) as TokenPayload;
      if (!decoded || !decoded.exp) {
        throw new Error('Invalid token');
      }

      // 计算剩余时间（秒）
      const now = Math.floor(Date.now() / 1000);
      const ttl = Math.max(0, decoded.exp - now);

      if (ttl > 0) {
        // 将令牌加入黑名单
        const blacklistKey = `token_blacklist:${this.getTokenHash(token)}`;
        await this.redisService.set(blacklistKey, reason, ttl);

        this.logger.info(`Token blacklisted`, {
          userId: decoded.userId,
          reason,
          ttl,
        });
      }

    } catch (error) {
      this.logger.error(`Failed to blacklist token: ${error.message}`, { error });
      throw error;
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const blacklistKey = `token_blacklist:${this.getTokenHash(token)}`;
      const exists = await this.redisService.exists(blacklistKey);
      return exists > 0;

    } catch (error) {
      this.logger.error(`Failed to check token blacklist: ${error.message}`, { error });
      return false;
    }
  }

  async checkUserExists(userId: string): Promise<boolean> {
    try {
      // 这里可以添加实际的用户存在性检查
      // 例如：查询数据库或调用用户服务
      // 暂时返回 true
      return true;

    } catch (error) {
      this.logger.error(`Failed to check user existence: ${error.message}`, { error });
      return false;
    }
  }

  async validatePermissions(userId: string, requiredPermissions: string[]): Promise<boolean> {
    try {
      // 这里可以添加实际的权限验证逻辑
      // 例如：查询用户角色和权限
      // 暂时返回 true
      return true;

    } catch (error) {
      this.logger.error(`Failed to validate permissions: ${error.message}`, { error });
      return false;
    }
  }

  async validateChannelAccess(userId: string, channel: string): Promise<boolean> {
    try {
      // 根据频道模式验证访问权限
      if (channel.startsWith('user:')) {
        // user:{userId} 频道只允许对应的用户访问
        const channelUserId = channel.split(':')[1];
        return channelUserId === userId;
      }

      if (channel.startsWith('account:')) {
        // 验证用户是否有权访问该账号
        // 这里可以添加实际的账号访问验证
        return true;
      }

      if (channel.startsWith('task:')) {
        // 验证用户是否有权访问该任务
        // 这里可以添加实际的任务访问验证
        return true;
      }

      // 公共频道允许访问
      const publicChannels = ['dashboard', 'broadcast', 'system:*', 'notification:*'];
      return publicChannels.some(publicChannel => 
        SubscriptionService.matchesPattern(channel, publicChannel)
      );

    } catch (error) {
      this.logger.error(`Failed to validate channel access: ${error.message}`, { error });
      return false;
    }
  }

  async recordTokenGeneration(userId: string, token: string): Promise<void> {
    try {
      const tokenHash = this.getTokenHash(token);
      const key = `user_tokens:${userId}`;
      
      // 记录令牌哈希和生成时间
      await this.redisService.hset(key, tokenHash, new Date().toISOString());
      
      // 设置过期时间（30天）
      await this.redisService.expire(key, 2592000);
      
      // 限制每个用户的令牌数量（最多20个）
      const tokens = await this.redisService.hgetall(key);
      if (Object.keys(tokens).length > 20) {
        // 删除最旧的令牌
        const oldestToken = Object.entries(tokens)
          .sort(([, dateA], [, dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())[0];
        
        if (oldestToken) {
          await this.redisService.hdel(key, oldestToken[0]);
        }
      }

    } catch (error) {
      this.logger.error(`Failed to record token generation: ${error.message}`, { error });
    }
  }

  async getUserActiveTokens(userId: string): Promise<Array<{ hash: string; createdAt: string }>> {
    try {
      const key = `user_tokens:${userId}`;
      const tokens = await this.redisService.hgetall(key);
      
      return Object.entries(tokens).map(([hash, createdAt]) => ({
        hash,
        createdAt,
      }));

    } catch (error) {
      this.logger.error(`Failed to get user active tokens: ${error.message}`, { error });
      return [];
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      // 获取用户的所有活跃令牌
      const activeTokens = await this.getUserActiveTokens(userId);
      
      // 将所有令牌加入黑名单
      for (const tokenInfo of activeTokens) {
        // 注意：这里我们只有令牌哈希，无法直接加入黑名单
        // 实际实现中需要存储完整的令牌或使用不同的机制
        this.logger.info(`Would revoke token for user: ${userId}`, {
          tokenHash: tokenInfo.hash,
        });
      }
      
      // 删除用户的令牌记录
      const key = `user_tokens:${userId}`;
      await this.redisService.del(key);
      
      this.logger.info(`All tokens revoked for user: ${userId}`);

    } catch (error) {
      this.logger.error(`Failed to revoke all user tokens: ${error.message}`, { error });
      throw error;
    }
  }

  private getTokenHash(token: string): string {
    // 使用简单的哈希函数（实际应用中应该使用更安全的哈希）
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(16);
  }

  // 验证 WebSocket 握手请求
  async validateHandshake(query: any): Promise<TokenPayload | null> {
    try {
      const token = query.token;
      if (!token) {
        return null;
      }

      return await this.verifyToken(token);

    } catch (error) {
      this.logger.error(`Handshake validation failed: ${error.message}`, { error });
      return null;
    }
  }

  // 获取用户信息
  async getUserInfo(userId: string): Promise<any> {
    try {
      // 这里可以添加获取用户信息的逻辑
      // 例如：从数据库或用户服务获取
      return {
        userId,
        email: `user${userId}@example.com`,
        roles: ['user'],
        permissions: ['read', 'write'],
      };

    } catch (error) {
      this.logger.error(`Failed to get user info: ${error.message}`, { error });
      return null;
    }
  }
}