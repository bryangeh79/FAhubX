import { Injectable, Inject } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';
import { WebSocketMessage } from '../interfaces/websocket.interface';

@Injectable()
export class MessageService {
  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async logMessage(clientId: string, message: {
    type: string;
    channel?: string;
    data?: any;
    direction: 'incoming' | 'outgoing';
  }): Promise<void> {
    try {
      const logEntry = {
        clientId,
        ...message,
        timestamp: new Date().toISOString(),
      };
      
      // 存储到 Redis 列表（限制最近100条）
      const key = `message_log:${clientId}`;
      await this.redisService.lpush(key, JSON.stringify(logEntry));
      
      // 限制列表长度
      await this.redisService.ltrim(key, 0, 99);
      
      // 设置过期时间（24小时）
      await this.redisService.expire(key, 86400);
      
    } catch (error) {
      this.logger.error(`Failed to log message: ${error.message}`, { error });
    }
  }

  async logBroadcast(channel: string, message: any, recipientCount: number): Promise<void> {
    try {
      const logEntry = {
        channel,
        message,
        recipientCount,
        timestamp: new Date().toISOString(),
      };
      
      // 存储到 Redis 列表（限制最近100条）
      const key = `broadcast_log:${channel}`;
      await this.redisService.lpush(key, JSON.stringify(logEntry));
      
      // 限制列表长度
      await this.redisService.ltrim(key, 0, 99);
      
      // 设置过期时间（24小时）
      await this.redisService.expire(key, 86400);
      
      // 更新频道统计
      await this.updateChannelStats(channel, recipientCount);
      
    } catch (error) {
      this.logger.error(`Failed to log broadcast: ${error.message}`, { error });
    }
  }

  async processMessage(clientId: string, message: WebSocketMessage): Promise<any> {
    try {
      const { type, channel, data, requestId } = message;
      
      this.logger.info(`Processing message from ${clientId}`, {
        type,
        channel,
        requestId,
      });
      
      // 根据消息类型处理
      switch (type) {
        case 'echo':
          return {
            type: 'echo_response',
            data,
            requestId,
          };
          
        case 'get_stats':
          const stats = await this.getClientStats(clientId);
          return {
            type: 'stats_response',
            data: stats,
            requestId,
          };
          
        case 'get_subscriptions':
          const subscriptions = await this.getClientSubscriptions(clientId);
          return {
            type: 'subscriptions_response',
            data: { subscriptions },
            requestId,
          };
          
        default:
          return {
            type: 'unknown_message',
            message: `Unknown message type: ${type}`,
            requestId,
          };
      }
      
    } catch (error) {
      this.logger.error(`Failed to process message: ${error.message}`, { 
        error,
        clientId,
        message,
      });
      
      return {
        type: 'error',
        message: 'Failed to process message',
        requestId: message.requestId,
      };
    }
  }

  async getClientStats(clientId: string): Promise<any> {
    try {
      // 获取消息日志
      const messageLogKey = `message_log:${clientId}`;
      const messageLog = await this.redisService.lrange(messageLogKey, 0, 49);
      
      // 解析日志
      const parsedLog = messageLog.map(entry => JSON.parse(entry));
      
      // 统计消息类型
      const typeStats: Record<string, number> = {};
      parsedLog.forEach(entry => {
        typeStats[entry.type] = (typeStats[entry.type] || 0) + 1;
      });
      
      return {
        totalMessages: parsedLog.length,
        typeStats,
        recentMessages: parsedLog.slice(0, 10),
      };
      
    } catch (error) {
      this.logger.error(`Failed to get client stats: ${error.message}`, { error });
      return {
        totalMessages: 0,
        typeStats: {},
        recentMessages: [],
      };
    }
  }

  async getClientSubscriptions(clientId: string): Promise<string[]> {
    try {
      const clientKey = `client:${clientId}`;
      const subscriptionsJson = await this.redisService.hget(clientKey, 'subscriptions');
      
      if (subscriptionsJson) {
        return JSON.parse(subscriptionsJson);
      }
      
      return [];
      
    } catch (error) {
      this.logger.error(`Failed to get client subscriptions: ${error.message}`, { error });
      return [];
    }
  }

  async updateChannelStats(channel: string, messageCount: number): Promise<void> {
    try {
      const statsKey = `channel_stats:${channel}`;
      const today = new Date().toISOString().split('T')[0];
      const dailyKey = `channel_daily:${channel}:${today}`;
      
      // 更新总统计
      await this.redisService.hincrby(statsKey, 'totalMessages', 1);
      await this.redisService.hincrby(statsKey, 'totalRecipients', messageCount);
      await this.redisService.expire(statsKey, 604800); // 7天
      
      // 更新每日统计
      await this.redisService.hincrby(dailyKey, 'messages', 1);
      await this.redisService.hincrby(dailyKey, 'recipients', messageCount);
      await this.redisService.expire(dailyKey, 86400); // 24小时
      
    } catch (error) {
      this.logger.error(`Failed to update channel stats: ${error.message}`, { error });
    }
  }

  async getChannelStats(channel: string): Promise<any> {
    try {
      const statsKey = `channel_stats:${channel}`;
      const stats = await this.redisService.hgetall(statsKey);
      
      const today = new Date().toISOString().split('T')[0];
      const dailyKey = `channel_daily:${channel}:${today}`;
      const dailyStats = await this.redisService.hgetall(dailyKey);
      
      return {
        totalMessages: parseInt(stats.totalMessages || '0'),
        totalRecipients: parseInt(stats.totalRecipients || '0'),
        todayMessages: parseInt(dailyStats.messages || '0'),
        todayRecipients: parseInt(dailyStats.recipients || '0'),
      };
      
    } catch (error) {
      this.logger.error(`Failed to get channel stats: ${error.message}`, { error });
      return {
        totalMessages: 0,
        totalRecipients: 0,
        todayMessages: 0,
        todayRecipients: 0,
      };
    }
  }

  async getMessageHistory(clientId: string, limit: number = 50): Promise<any[]> {
    try {
      const key = `message_log:${clientId}`;
      const messages = await this.redisService.lrange(key, 0, limit - 1);
      
      return messages.map(msg => JSON.parse(msg)).reverse(); // 最新的在前
      
    } catch (error) {
      this.logger.error(`Failed to get message history: ${error.message}`, { error });
      return [];
    }
  }

  async cleanupOldLogs(): Promise<void> {
    try {
      // 清理超过7天的消息日志
      const pattern = 'message_log:*';
      const keys = await this.redisService.keys(pattern);
      
      for (const key of keys) {
        const ttl = await this.redisService.ttl(key);
        if (ttl === -1) { // 没有设置过期时间
          await this.redisService.expire(key, 604800); // 设置为7天
        }
      }
      
      this.logger.info(`Cleaned up message logs for ${keys.length} clients`);
      
    } catch (error) {
      this.logger.error(`Failed to cleanup old logs: ${error.message}`, { error });
    }
  }
}