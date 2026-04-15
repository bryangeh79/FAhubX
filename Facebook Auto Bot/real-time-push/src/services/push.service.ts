import { Injectable, Logger } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import Redis from 'ioredis';
import Queue from 'bull';
import { 
  PushMessage, 
  PushMessageType, 
  MessagePriority,
  PushConfig,
  PushStats,
  ChannelSubscription,
  TaskUpdateData,
  AccountUpdateData,
  SystemAlertData,
  UserNotificationData,
  DashboardUpdateData,
} from '../types/push.types';

@Injectable()
export class PushService {
  private socket: Socket;
  private redis: Redis;
  private queue: Queue.Queue;
  private logger = new Logger(PushService.name);
  
  private config: PushConfig;
  private stats: PushStats = {
    messagesSent: 0,
    messagesFailed: 0,
    messagesQueued: 0,
    averageLatency: 0,
  };
  
  private subscriptions: Map<string, ChannelSubscription> = new Map();
  private batchBuffer: Map<string, PushMessage[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  
  constructor(config: Partial<PushConfig> = {}) {
    this.config = {
      websocketUrl: 'ws://localhost:3002',
      redisHost: 'localhost',
      redisPort: 6379,
      batchSize: 10,
      batchInterval: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      enableQueue: true,
      queueName: 'push-queue',
      enableMetrics: true,
      metricsInterval: 60000,
      ...config,
    };
    
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    try {
      // 初始化 Redis 连接
      this.redis = new Redis({
        host: this.config.redisHost,
        port: this.config.redisPort,
        password: this.config.redisPassword,
        db: this.config.redisDb || 0,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });
      
      // 初始化消息队列
      if (this.config.enableQueue) {
        this.queue = new Queue(this.config.queueName, {
          redis: {
            host: this.config.redisHost,
            port: this.config.redisPort,
            password: this.config.redisPassword,
            db: this.config.redisDb || 0,
          },
          defaultJobOptions: {
            attempts: this.config.maxRetries,
            backoff: {
              type: 'exponential',
              delay: this.config.retryDelay,
            },
            removeOnComplete: true,
            removeOnFail: false,
          },
        });
        
        // 设置队列处理器
        await this.setupQueueProcessor();
      }
      
      // 初始化 WebSocket 连接
      this.initializeWebSocket();
      
      // 启动指标收集
      if (this.config.enableMetrics) {
        this.startMetricsCollection();
      }
      
      this.logger.log('Push service initialized');
      
    } catch (error) {
      this.logger.error(`Failed to initialize push service: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  private initializeWebSocket(): void {
    this.socket = io(this.config.websocketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      timeout: 30000,
    });
    
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.logger.log('Connected to WebSocket server');
      
      // 重新订阅所有频道
      this.resubscribeAll();
    });
    
    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.logger.warn(`Disconnected from WebSocket server: ${reason}`);
    });
    
    this.socket.on('connect_error', (error) => {
      this.logger.error(`WebSocket connection error: ${error.message}`);
      this.reconnectAttempts++;
    });
    
    this.socket.on('channel_message', (data: any) => {
      this.handleIncomingMessage(data);
    });
    
    this.socket.on('error', (error) => {
      this.logger.error(`WebSocket error: ${error.message}`);
    });
  }
  
  private async setupQueueProcessor(): Promise<void> {
    if (!this.queue) return;
    
    this.queue.process(async (job) => {
      const { message, attempt } = job.data;
      
      try {
        await this.sendMessageInternal(message);
        this.logger.debug(`Queue job processed successfully: ${message.id}`);
        return { success: true };
      } catch (error) {
        this.logger.error(`Queue job failed: ${error.message}`, {
          messageId: message.id,
          attempt,
        });
        throw error;
      }
    });
    
    this.queue.on('completed', (job) => {
      this.stats.messagesSent++;
      this.logger.debug(`Queue job completed: ${job.id}`);
    });
    
    this.queue.on('failed', (job, error) => {
      this.stats.messagesFailed++;
      this.logger.error(`Queue job failed: ${error.message}`, {
        jobId: job.id,
        attempts: job.attemptsMade,
      });
    });
  }
  
  // 公共 API 方法
  
  async sendMessage(message: PushMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (this.config.enableQueue && this.queue) {
        // 使用队列发送
        await this.queue.add('push-message', {
          message,
          attempt: 1,
        }, {
          priority: this.getMessagePriorityValue(message.priority),
        });
        
        this.stats.messagesQueued++;
        this.logger.debug(`Message queued: ${message.id}`);
        
      } else {
        // 直接发送
        await this.sendMessageInternal(message);
        this.stats.messagesSent++;
      }
      
      const latency = Date.now() - startTime;
      this.updateAverageLatency(latency);
      
    } catch (error) {
      this.stats.messagesFailed++;
      this.stats.lastError = error.message;
      this.stats.lastErrorTime = new Date();
      
      this.logger.error(`Failed to send message: ${error.message}`, {
        messageId: message.id,
        error,
      });
      
      throw error;
    }
  }
  
  async subscribe(channel: string, handler: (message: PushMessage) => Promise<void>): Promise<void> {
    const subscription: ChannelSubscription = {
      channel,
      handler,
      options: {
        priority: MessagePriority.NORMAL,
        batch: false,
      },
    };
    
    this.subscriptions.set(channel, subscription);
    
    // 发送订阅请求到 WebSocket 服务器
    if (this.isConnected) {
      this.socket.emit('subscribe', { channel });
      this.logger.log(`Subscribed to channel: ${channel}`);
    }
  }
  
  async unsubscribe(channel: string): Promise<void> {
    this.subscriptions.delete(channel);
    
    // 发送取消订阅请求
    if (this.isConnected) {
      this.socket.emit('unsubscribe', { channel });
      this.logger.log(`Unsubscribed from channel: ${channel}`);
    }
    
    // 清理批处理缓冲区
    this.batchBuffer.delete(channel);
    const timer = this.batchTimers.get(channel);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(channel);
    }
  }
  
  async broadcast(channel: string, data: any, priority: MessagePriority = MessagePriority.NORMAL): Promise<void> {
    const message: PushMessage = {
      id: this.generateMessageId(),
      type: PushMessageType.BROADCAST,
      channel,
      data,
      timestamp: new Date(),
      priority,
    };
    
    await this.sendMessage(message);
  }
  
  // 特定类型消息的便捷方法
  
  async sendTaskUpdate(data: TaskUpdateData, priority: MessagePriority = MessagePriority.NORMAL): Promise<void> {
    const message: PushMessage = {
      id: this.generateMessageId(),
      type: PushMessageType.TASK_UPDATED,
      channel: `task:${data.taskId}`,
      data,
      timestamp: new Date(),
      priority,
    };
    
    await this.sendMessage(message);
  }
  
  async sendAccountUpdate(data: AccountUpdateData, priority: MessagePriority = MessagePriority.NORMAL): Promise<void> {
    const message: PushMessage = {
      id: this.generateMessageId(),
      type: PushMessageType.ACCOUNT_UPDATED,
      channel: `account:${data.accountId}`,
      data,
      timestamp: new Date(),
      priority,
    };
    
    await this.sendMessage(message);
  }
  
  async sendSystemAlert(data: SystemAlertData, priority: MessagePriority = MessagePriority.HIGH): Promise<void> {
    const message: PushMessage = {
      id: this.generateMessageId(),
      type: PushMessageType.SYSTEM_ALERT,
      channel: 'system:alerts',
      data,
      timestamp: new Date(),
      priority,
    };
    
    await this.sendMessage(message);
  }
  
  async sendUserNotification(data: UserNotificationData, priority: MessagePriority = MessagePriority.NORMAL): Promise<void> {
    const message: PushMessage = {
      id: this.generateMessageId(),
      type: PushMessageType.USER_NOTIFICATION,
      channel: `user:${data.userId}`,
      data,
      timestamp: new Date(),
      priority,
    };
    
    await this.sendMessage(message);
  }
  
  async sendDashboardUpdate(data: DashboardUpdateData, priority: MessagePriority = MessagePriority.LOW): Promise<void> {
    const message: PushMessage = {
      id: this.generateMessageId(),
      type: PushMessageType.DASHBOARD_UPDATE,
      channel: 'dashboard',
      data,
      timestamp: new Date(),
      priority,
    };
    
    await this.sendMessage(message);
  }
  
  // 统计和监控
  
  getStats(): PushStats {
    return { ...this.stats };
  }
  
  async getQueueStats(): Promise<any> {
    if (!this.queue) return null;
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }
  
  async getRedisStats(): Promise<any> {
    try {
      const info = await this.redis.info();
      const lines = info.split('\n');
      const stats: Record<string, string> = {};
      
      for (const line of lines) {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key.trim()] = value.trim();
        }
      }
      
      return {
        connectedClients: stats.connected_clients,
        usedMemory: stats.used_memory_human,
        totalConnections: stats.total_connections_received,
        commandsProcessed: stats.total_commands_processed,
        keyspaceHits: stats.keyspace_hits,
        keyspaceMisses: stats.keyspace_misses,
      };
      
    } catch (error) {
      this.logger.error(`Failed to get Redis stats: ${error.message}`);
      return null;
    }
  }
  
  // 清理和关闭
  
  async cleanup(): Promise<void> {
    // 清理所有订阅
    for (const [channel] of this.subscriptions) {
      await this.unsubscribe(channel);
    }
    
    // 清理批处理缓冲区
    this.batchBuffer.clear();
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();
    
    // 关闭 WebSocket 连接
    if (this.socket) {
      this.socket.disconnect();
    }
    
    // 关闭 Redis 连接
    if (this.redis) {
      await this.redis.quit();
    }
    
    // 关闭队列
    if (this.queue) {
      await this.queue.close();
    }
    
    this.logger.log('Push service cleaned up');
  }
  
  // 私有辅助方法
  
  private async sendMessageInternal(message: PushMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }
    
    const socketMessage = {
      type: 'message',
      channel: message.channel,
      data: message.data,
      metadata: {
        id: message.id,
        type: message.type,
        priority: message.priority,
        timestamp: message.timestamp.toISOString(),
        ...message.metadata,
      },
    };
    
    this.socket.emit('message', socketMessage);
    
    this.logger.debug(`Message sent: ${message.id} to channel ${message.channel}`);
  }
  
  private handleIncomingMessage(data: any): void {
    try {
      const message: PushMessage = {
        id: data.metadata?.id || this.generateMessageId(),
        type: data.metadata?.type || PushMessageType.BROADCAST,
        channel: data.channel,
        data: data.data,
        timestamp: new Date(data.metadata?.timestamp || Date.now()),
        priority: data.metadata?.priority || MessagePriority.NORMAL,
        metadata: data.metadata,
      };
      
      // 查找匹配的订阅
      for (const [channel, subscription] of this.subscriptions) {
        if (this.matchesChannel(message.channel, channel)) {
          this.processSubscription(message, subscription);
          break;
        }
      }
      
    } catch (error) {
      this.logger.error(`Failed to handle incoming message: ${error.message}`, {
        data,
        error,
      });
    }
  }
  
  private async processSubscription(message: PushMessage, subscription: ChannelSubscription): Promise<void> {
    try {
      if (subscription.options?.batch) {
        // 批处理模式
        await this.addToBatch(message, subscription);
      } else {
        // 立即处理模式
        await subscription.handler(message);
        this.logger.debug(`Message processed: ${message.id} by subscription ${subscription.channel}`);
      }
      
    } catch (error) {
      this.logger.error(`Failed to process subscription: ${error.message}`, {
        messageId: message.id,
        channel: subscription.channel,
        error,
      });
    }
  }
  
  private async addToBatch(message: PushMessage, subscription: ChannelSubscription): Promise<void> {
    const channel = subscription.channel;
    
    // 初始化缓冲区
    if (!this.batchBuffer.has(channel)) {
      this.batchBuffer.set(channel, []);
    }
    
    const buffer = this.batchBuffer.get(channel)!;
    buffer.push(message);
    
    // 检查是否达到批处理大小
    const batchSize = subscription.options?.batchSize || this.config.batchSize;
    if (buffer.length >= batchSize) {
      await this.flushBatch(channel, subscription);
      return;
    }
    
    // 设置/重置定时器
    const batchInterval = subscription.options?.batchInterval || this.config.batchInterval;
    const existingTimer = this.batchTimers.get(channel);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const timer = setTimeout(async () => {
      await this.flushBatch(channel, subscription);
    }, batchInterval);
    
    this.batchTimers.set(channel, timer);
  }
  
  private async flushBatch(channel: string, subscription: ChannelSubscription): Promise<void> {
    const buffer = this.batchBuffer.get(channel);
    if (!buffer || buffer.length === 0) return;
    
    try {
      // 创建批处理消息
      const batchMessage: PushMessage = {
        id: this.generateMessageId(),
        type: PushMessageType.BROADCAST,
        channel,
        data: {
          batch: true,
          count: buffer.length,
          messages: buffer,
        },
        timestamp: new Date(),
        priority: subscription.options?.priority || MessagePriority.NORMAL,
      };
      
      // 调用处理器
      await subscription.handler(batchMessage);
      
      this.logger.debug(`Batch processed: ${buffer.length} messages for channel ${channel}`);
      
      // 清空缓冲区
      this.batchBuffer.set(channel, []);
      
      // 清理定时器
      const timer = this.batchTimers.get(channel);
      if (timer) {
        clearTimeout(timer);
        this.batchTimers.delete(channel);
      }
      
    } catch (error) {
      this.logger.error(`Failed to flush batch: ${error.message}`, {
        channel,
        error,
      });
    }
  }
  
  private matchesChannel(messageChannel: string, subscriptionChannel: string): boolean {
    if (subscriptionChannel.includes('*')) {
      const pattern = subscriptionChannel.replace('*', '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(messageChannel);
    }
    
    return messageChannel === subscriptionChannel;
  }
  
  private resubscribeAll(): void {
    for (const [channel] of this.subscriptions) {
      this.socket.emit('subscribe', { channel });
    }
    this.logger.log('Resubscribed to all channels');
  }
  
  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
  }
  
  private async collectMetrics(): Promise<void> {
    try {
      const queueStats = await this.getQueueStats();
      const redisStats = await this.getRedisStats();
      
      this.logger.log('Push service metrics', {
        stats: this.stats,
        queueStats,
        redisStats,
        isConnected: this.isConnected,
        subscriptionCount: this.subscriptions.size,
      });
      
      // 存储指标到 Redis
      await this.storeMetrics();
      
    } catch (error) {
      this.logger.error(`Failed to collect metrics: ${error.message}`, { error });
    }
  }
  
  private async storeMetrics(): Promise  private async storeMetrics(): Promise<void> {
    try {
      const metricsKey = `push:metrics:${new Date().toISOString().split('T')[0]}`;
      const metrics = {
        timestamp: new Date().toISOString(),
        stats: this.stats,
        isConnected: this.isConnected,
        subscriptionCount: this.subscriptions.size,
      };
      
      await this.redis.lpush(metricsKey, JSON.stringify(metrics));
      await this.redis.ltrim(metricsKey, 0, 1439); // 保留24小时的数据（每分钟一条）
      await this.redis.expire(metricsKey, 172800); // 48小时过期
      
    } catch (error) {
      this.logger.error(`Failed to store metrics: ${error.message}`, { error });
    }
  }
  
  private updateAverageLatency(newLatency: number): void {
    if (this.stats.messagesSent === 1) {
      this.stats.averageLatency = newLatency;
    } else {
      // 指数移动平均
      const alpha = 0.1;
      this.stats.averageLatency = alpha * newLatency + (1 - alpha) * this.stats.averageLatency;
    }
  }
  
  private getMessagePriorityValue(priority: MessagePriority): number {
    switch (priority) {
      case MessagePriority.CRITICAL: return 1;
      case MessagePriority.HIGH: return 2;
      case MessagePriority.NORMAL: return 3;
      case MessagePriority.LOW: return 4;
      default: return 3;
    }
  }
  
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}