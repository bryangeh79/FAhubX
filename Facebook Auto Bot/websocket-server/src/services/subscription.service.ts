import { Injectable, Inject } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async addSubscription(clientId: string, channel: string): Promise<void> {
    try {
      // 验证频道格式
      if (!this.isValidChannel(channel)) {
        throw new Error(`Invalid channel format: ${channel}`);
      }
      
      // 添加到客户端订阅集合
      const clientSubKey = `client_subs:${clientId}`;
      await this.redisService.sadd(clientSubKey, channel);
      await this.redisService.expire(clientSubKey, 3600); // 1小时过期
      
      // 添加到频道订阅者集合
      const channelSubKey = `channel_subs:${channel}`;
      await this.redisService.sadd(channelSubKey, clientId);
      await this.redisService.expire(channelSubKey, 3600); // 1小时过期
      
      // 更新客户端信息中的订阅列表
      const clientKey = `client:${clientId}`;
      const subscriptionsJson = await this.redisService.hget(clientKey, 'subscriptions');
      let subscriptions: string[] = [];
      
      if (subscriptionsJson) {
        subscriptions = JSON.parse(subscriptionsJson);
      }
      
      if (!subscriptions.includes(channel)) {
        subscriptions.push(channel);
        await this.redisService.hset(clientKey, 'subscriptions', JSON.stringify(subscriptions));
        await this.redisService.expire(clientKey, 3600); // 续期
      }
      
      this.logger.info(`Subscription added: ${clientId} -> ${channel}`);
      
    } catch (error) {
      this.logger.error(`Failed to add subscription: ${error.message}`, { 
        error,
        clientId,
        channel,
      });
      throw error;
    }
  }

  async removeSubscription(clientId: string, channel: string): Promise<void> {
    try {
      // 从客户端订阅集合移除
      const clientSubKey = `client_subs:${clientId}`;
      await this.redisService.srem(clientSubKey, channel);
      
      // 从频道订阅者集合移除
      const channelSubKey = `channel_subs:${channel}`;
      await this.redisService.srem(channelSubKey, clientId);
      
      // 更新客户端信息中的订阅列表
      const clientKey = `client:${clientId}`;
      const subscriptionsJson = await this.redisService.hget(clientKey, 'subscriptions');
      
      if (subscriptionsJson) {
        let subscriptions: string[] = JSON.parse(subscriptionsJson);
        subscriptions = subscriptions.filter(sub => sub !== channel);
        await this.redisService.hset(clientKey, 'subscriptions', JSON.stringify(subscriptions));
      }
      
      this.logger.info(`Subscription removed: ${clientId} -> ${channel}`);
      
    } catch (error) {
      this.logger.error(`Failed to remove subscription: ${error.message}`, { 
        error,
        clientId,
        channel,
      });
      throw error;
    }
  }

  async removeAllSubscriptions(clientId: string): Promise<void> {
    try {
      // 获取客户端的所有订阅
      const clientSubKey = `client_subs:${clientId}`;
      const subscriptions = await this.redisService.smembers(clientSubKey);
      
      // 从所有频道中移除该客户端
      for (const channel of subscriptions) {
        const channelSubKey = `channel_subs:${channel}`;
        await this.redisService.srem(channelSubKey, clientId);
      }
      
      // 删除客户端订阅集合
      await this.redisService.del(clientSubKey);
      
      // 清空客户端信息中的订阅列表
      const clientKey = `client:${clientId}`;
      await this.redisService.hset(clientKey, 'subscriptions', JSON.stringify([]));
      
      this.logger.info(`All subscriptions removed for client: ${clientId}`, {
        subscriptionCount: subscriptions.length,
      });
      
    } catch (error) {
      this.logger.error(`Failed to remove all subscriptions: ${error.message}`, { 
        error,
        clientId,
      });
      throw error;
    }
  }

  async getClientSubscriptions(clientId: string): Promise<string[]> {
    try {
      const clientSubKey = `client_subs:${clientId}`;
      return await this.redisService.smembers(clientSubKey);
      
    } catch (error) {
      this.logger.error(`Failed to get client subscriptions: ${error.message}`, { error });
      return [];
    }
  }

  async getChannelSubscribers(channel: string): Promise<string[]> {
    try {
      const channelSubKey = `channel_subs:${channel}`;
      return await this.redisService.smembers(channelSubKey);
      
    } catch (error) {
      this.logger.error(`Failed to get channel subscribers: ${error.message}`, { error });
      return [];
    }
  }

  async getSubscriptionStats(): Promise<{
    totalSubscriptions: number;
    topChannels: Array<{ channel: string; subscribers: number }>;
  }> {
    try {
      // 获取所有频道
      const channelKeys = await this.redisService.keys('channel_subs:*');
      const stats: Array<{ channel: string; subscribers: number }> = [];
      let totalSubscriptions = 0;
      
      for (const key of channelKeys) {
        const channel = key.replace('channel_subs:', '');
        const subscribers = await this.redisService.smembers(key);
        const subscriberCount = subscribers.length;
        
        stats.push({ channel, subscribers: subscriberCount });
        totalSubscriptions += subscriberCount;
      }
      
      // 按订阅者数量排序
      stats.sort((a, b) => b.subscribers - a.subscribers);
      
      return {
        totalSubscriptions,
        topChannels: stats.slice(0, 10), // 返回前10个频道
      };
      
    } catch (error) {
      this.logger.error(`Failed to get subscription stats: ${error.message}`, { error });
      return {
        totalSubscriptions: 0,
        topChannels: [],
      };
    }
  }

  async isSubscribed(clientId: string, channel: string): Promise<boolean> {
    try {
      const clientSubKey = `client_subs:${clientId}`;
      const subscriptions = await this.redisService.smembers(clientSubKey);
      return subscriptions.includes(channel);
      
    } catch (error) {
      this.logger.error(`Failed to check subscription: ${error.message}`, { error });
      return false;
    }
  }

  async cleanupOrphanedSubscriptions(): Promise<void> {
    try {
      // 获取所有客户端订阅键
      const clientSubKeys = await this.redisService.keys('client_subs:*');
      
      for (const key of clientSubKeys) {
        const clientId = key.replace('client_subs:', '');
        
        // 检查客户端是否仍然活跃
        const clientExists = await this.redisService.exists(`client:${clientId}`);
        if (!clientExists) {
          // 客户端不存在，清理其订阅
          await this.removeAllSubscriptions(clientId);
          this.logger.info(`Cleaned up orphaned subscriptions for client: ${clientId}`);
        }
      }
      
      // 清理空的频道订阅集合
      const channelSubKeys = await this.redisService.keys('channel_subs:*');
      
      for (const key of channelSubKeys) {
        const subscribers = await this.redisService.smembers(key);
        if (subscribers.length === 0) {
          await this.redisService.del(key);
          this.logger.info(`Cleaned up empty channel: ${key}`);
        }
      }
      
    } catch (error) {
      this.logger.error(`Failed to cleanup orphaned subscriptions: ${error.message}`, { error });
    }
  }

  private isValidChannel(channel: string): boolean {
    // 基本验证：不能为空，长度限制，允许的字符
    if (!channel || channel.length > 255) {
      return false;
    }
    
    // 允许的字符：字母、数字、下划线、冒号、点、连字符
    const validPattern = /^[a-zA-Z0-9_:.\-]+$/;
    return validPattern.test(channel);
  }

  // 预定义频道模式
  static readonly CHANNEL_PATTERNS = {
    TASK: 'task:*',
    ACCOUNT: 'account:*',
    SYSTEM: 'system:*',
    USER: 'user:*',
    NOTIFICATION: 'notification:*',
    DASHBOARD: 'dashboard',
    BROADCAST: 'broadcast',
  };

  // 检查频道是否匹配模式
  static matchesPattern(channel: string, pattern: string): boolean {
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2);
      return channel.startsWith(prefix + ':');
    }
    return channel === pattern;
  }
}