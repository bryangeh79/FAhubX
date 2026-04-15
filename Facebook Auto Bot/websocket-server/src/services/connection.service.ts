import { Injectable, Inject } from '@nestjs/common';
import { Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';
import { WebSocketClient, ConnectionStats } from '../interfaces/websocket.interface';

@Injectable()
export class ConnectionService {
  private clients: Map<string, WebSocketClient> = new Map();
  private sockets: Map<string, Socket> = new Map();
  private stats: ConnectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    messagesPerSecond: 0,
    averageLatency: 0,
  };
  private messageCount = 0;
  private lastStatsTime = Date.now();

  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async addClient(clientId: string, socket: Socket): Promise<WebSocketClient> {
    const client: WebSocketClient = {
      id: clientId,
      sessionId: this.generateSessionId(),
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set(),
      metadata: {
        ipAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
      },
    };

    this.clients.set(clientId, client);
    this.sockets.set(clientId, socket);
    
    // 更新统计
    this.stats.activeConnections++;
    this.stats.totalConnections++;
    
    // 存储到 Redis
    await this.redisService.hset(`client:${clientId}`, 'sessionId', client.sessionId);
    await this.redisService.hset(`client:${clientId}`, 'connectedAt', client.connectedAt.toISOString());
    await this.redisService.hset(`client:${clientId}`, 'lastActivity', client.lastActivity.toISOString());
    await this.redisService.expire(`client:${clientId}`, 3600); // 1小时过期
    
    // 添加到活跃客户端集合
    await this.redisService.sadd('active_clients', clientId);
    
    this.logger.info(`Client added: ${clientId}`, {
      sessionId: client.sessionId,
      ipAddress: client.metadata?.ipAddress,
    });
    
    return client;
  }

  async removeClient(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    
    if (client) {
      this.clients.delete(clientId);
      this.sockets.delete(clientId);
      
      // 更新统计
      this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
      
      // 从 Redis 中移除
      await this.redisService.del(`client:${clientId}`);
      await this.redisService.srem('active_clients', clientId);
      
      this.logger.info(`Client removed: ${clientId}`, {
        sessionId: client.sessionId,
        connectedDuration: Date.now() - client.connectedAt.getTime(),
      });
    }
  }

  async getClient(clientId: string): Promise<WebSocketClient | null> {
    // 先从内存中获取
    const client = this.clients.get(clientId);
    if (client) {
      return client;
    }
    
    // 从 Redis 中恢复
    try {
      const clientData = await this.redisService.hgetall(`client:${clientId}`);
      if (!clientData || !clientData.sessionId) {
        return null;
      }
      
      const restoredClient: WebSocketClient = {
        id: clientId,
        sessionId: clientData.sessionId,
        userId: clientData.userId,
        connectedAt: new Date(clientData.connectedAt),
        lastActivity: new Date(clientData.lastActivity),
        subscriptions: new Set(JSON.parse(clientData.subscriptions || '[]')),
        metadata: clientData.metadata ? JSON.parse(clientData.metadata) : {},
      };
      
      return restoredClient;
    } catch (error) {
      this.logger.error(`Failed to get client from Redis: ${error.message}`, { error });
      return null;
    }
  }

  async updateClient(clientId: string, updates: Partial<WebSocketClient>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }
    
    // 更新内存中的客户端
    Object.assign(client, updates);
    client.lastActivity = new Date();
    
    // 更新 Redis
    const redisUpdates: Record<string, string> = {};
    
    if (updates.userId !== undefined) {
      redisUpdates.userId = updates.userId;
    }
    
    if (updates.metadata !== undefined) {
      redisUpdates.metadata = JSON.stringify(updates.metadata);
    }
    
    if (updates.subscriptions !== undefined) {
      redisUpdates.subscriptions = JSON.stringify(Array.from(updates.subscriptions));
    }
    
    redisUpdates.lastActivity = client.lastActivity.toISOString();
    
    if (Object.keys(redisUpdates).length > 0) {
      await this.redisService.hset(`client:${clientId}`, redisUpdates);
      await this.redisService.expire(`client:${clientId}`, 3600); // 续期
    }
  }

  async updateClientActivity(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = new Date();
      await this.redisService.hset(`client:${clientId}`, 'lastActivity', client.lastActivity.toISOString());
    }
  }

  async getSocket(clientId: string): Promise<Socket | null> {
    return this.sockets.get(clientId) || null;
  }

  async getAllClients(): Promise<WebSocketClient[]> {
    return Array.from(this.clients.values());
  }

  async getActiveClients(): Promise<string[]> {
    try {
      return await this.redisService.smembers('active_clients');
    } catch (error) {
      this.logger.error(`Failed to get active clients: ${error.message}`, { error });
      return Array.from(this.clients.keys());
    }
  }

  async getStats(): Promise<ConnectionStats> {
    const now = Date.now();
    const timeDiff = (now - this.lastStatsTime) / 1000; // 秒
    
    if (timeDiff > 0) {
      this.stats.messagesPerSecond = this.messageCount / timeDiff;
      this.messageCount = 0;
      this.lastStatsTime = now;
    }
    
    // 从 Redis 获取活跃连接数
    try {
      const activeClients = await this.getActiveClients();
      this.stats.activeConnections = activeClients.length;
    } catch (error) {
      this.logger.error(`Failed to get active connections from Redis: ${error.message}`, { error });
    }
    
    return { ...this.stats };
  }

  incrementMessageCount(): void {
    this.messageCount++;
    this.stats.totalMessages++;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async cleanupInactiveClients(): Promise<void> {
    try {
      const clients = await this.getAllClients();
      const now = Date.now();
      const inactiveThreshold = 5 * 60 * 1000; // 5分钟
      
      for (const client of clients) {
        const lastActivity = new Date(client.lastActivity).getTime();
        if (now - lastActivity > inactiveThreshold) {
          this.logger.warn(`Cleaning up inactive client: ${client.id}`);
          await this.removeClient(client.id);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup inactive clients: ${error.message}`, { error });
    }
  }
}