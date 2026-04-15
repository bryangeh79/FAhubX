import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LoggerService } from '../logger/logger.service';
import { ConnectionService } from '../services/connection.service';
import { MessageService } from '../services/message.service';
import { SubscriptionService } from '../services/subscription.service';
import { AuthService } from '../services/auth.service';
import { WebSocketMessageDto, AuthDto, SubscribeDto, UnsubscribeDto, PingDto } from '../dto/message.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: 'ws',
  transports: ['websocket', 'polling'],
  pingInterval: 30000, // 30秒心跳间隔
  pingTimeout: 60000, // 60秒超时
  maxHttpBufferSize: 1e6, // 1MB最大消息大小
})
export class WebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly logger: LoggerService,
    private readonly connectionService: ConnectionService,
    private readonly messageService: MessageService,
    private readonly subscriptionService: SubscriptionService,
    private readonly authService: AuthService,
  ) {}

  afterInit(server: Server) {
    this.logger.info('WebSocket server initialized');
    
    // 设置连接限制
    server.engine.maxHttpBufferSize = 1e6;
    server.engine.pingTimeout = 60000;
    server.engine.pingInterval = 30000;
    
    // 启动心跳监控
    this.startHeartbeatMonitoring();
    
    // 启动统计监控
    this.startStatsMonitoring();
  }

  async handleConnection(client: Socket) {
    try {
      const clientId = client.id;
      const ipAddress = client.handshake.address;
      
      this.logger.info(`Client connected: ${clientId} from ${ipAddress}`);
      
      // 初始化客户端连接
      await this.connectionService.addClient(clientId, client);
      
      // 发送欢迎消息
      client.emit('connected', {
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
        message: 'Connected to WebSocket server',
      });
      
      // 发送服务器信息
      client.emit('server_info', {
        type: 'server_info',
        heartbeatInterval: 30000,
        maxPayloadSize: 1e6,
        supportedEvents: [
          'auth',
          'subscribe',
          'unsubscribe',
          'ping',
          'message',
        ],
      });
      
    } catch (error) {
      this.logger.error(`Failed to handle connection: ${error.message}`, { error });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const clientId = client.id;
      
      this.logger.info(`Client disconnected: ${clientId}`);
      
      // 清理客户端连接
      await this.connectionService.removeClient(clientId);
      
      // 清理订阅
      await this.subscriptionService.removeAllSubscriptions(clientId);
      
    } catch (error) {
      this.logger.error(`Failed to handle disconnect: ${error.message}`, { error });
    }
  }

  @SubscribeMessage('auth')
  async handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AuthDto,
  ) {
    try {
      const clientId = client.id;
      const { token } = data;
      
      // 验证 token
      const payload = await this.authService.verifyToken(token);
      if (!payload) {
        client.emit('auth_error', {
          type: 'auth_error',
          message: 'Invalid token',
        });
        return;
      }
      
      // 更新客户端信息
      await this.connectionService.updateClient(clientId, {
        userId: payload.userId,
        metadata: payload,
      });
      
      client.emit('auth_success', {
        type: 'auth_success',
        userId: payload.userId,
        timestamp: new Date().toISOString(),
      });
      
      this.logger.info(`Client authenticated: ${clientId} as user ${payload.userId}`);
      
    } catch (error) {
      this.logger.error(`Auth error: ${error.message}`, { error });
      client.emit('auth_error', {
        type: 'auth_error',
        message: 'Authentication failed',
      });
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscribeDto,
  ) {
    try {
      const clientId = client.id;
      const { channel } = data;
      
      // 验证订阅权限
      const clientInfo = await this.connectionService.getClient(clientId);
      if (!clientInfo) {
        client.emit('error', {
          type: 'error',
          message: 'Client not found',
        });
        return;
      }
      
      // 添加订阅
      await this.subscriptionService.addSubscription(clientId, channel);
      
      client.emit('subscribed', {
        type: 'subscribed',
        channel,
        timestamp: new Date().toISOString(),
      });
      
      this.logger.info(`Client ${clientId} subscribed to channel: ${channel}`);
      
    } catch (error) {
      this.logger.error(`Subscribe error: ${error.message}`, { error });
      client.emit('error', {
        type: 'error',
        message: 'Failed to subscribe',
      });
    }
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnsubscribeDto,
  ) {
    try {
      const clientId = client.id;
      const { channel } = data;
      
      // 移除订阅
      await this.subscriptionService.removeSubscription(clientId, channel);
      
      client.emit('unsubscribed', {
        type: 'unsubscribed',
        channel,
        timestamp: new Date().toISOString(),
      });
      
      this.logger.info(`Client ${clientId} unsubscribed from channel: ${channel}`);
      
    } catch (error) {
      this.logger.error(`Unsubscribe error: ${error.message}`, { error });
      client.emit('error', {
        type: 'error',
        message: 'Failed to unsubscribe',
      });
    }
  }

  @SubscribeMessage('ping')
  async handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PingDto,
  ) {
    try {
      const clientId = client.id;
      const timestamp = data.timestamp || new Date().toISOString();
      
      // 更新客户端活动时间
      await this.connectionService.updateClientActivity(clientId);
      
      // 发送 pong 响应
      client.emit('pong', {
        type: 'pong',
        timestamp,
        serverTime: new Date().toISOString(),
      });
      
    } catch (error) {
      this.logger.error(`Ping error: ${error.message}`, { error });
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: WebSocketMessageDto,
  ) {
    try {
      const clientId = client.id;
      const { type, channel, data: messageData, requestId } = data;
      
      // 记录消息
      await this.messageService.logMessage(clientId, {
        type,
        channel,
        data: messageData,
        direction: 'incoming',
      });
      
      // 处理消息
      const response = await this.messageService.processMessage(clientId, {
        type,
        channel,
        data: messageData,
        requestId,
      });
      
      // 发送响应
      if (response) {
        client.emit('message_response', {
          ...response,
          requestId,
          timestamp: new Date().toISOString(),
        });
      }
      
    } catch (error) {
      this.logger.error(`Message error: ${error.message}`, { error });
      client.emit('error', {
        type: 'error',
        message: 'Failed to process message',
        requestId: data.requestId,
      });
    }
  }

  // 广播消息到频道
  async broadcastToChannel(channel: string, message: any) {
    try {
      // 获取订阅该频道的所有客户端
      const subscribers = await this.subscriptionService.getChannelSubscribers(channel);
      
      // 发送消息给每个订阅者
      for (const clientId of subscribers) {
        const client = await this.connectionService.getSocket(clientId);
        if (client) {
          client.emit('channel_message', {
            type: 'channel_message',
            channel,
            data: message,
            timestamp: new Date().toISOString(),
          });
        }
      }
      
      // 记录消息
      await this.messageService.logBroadcast(channel, message, subscribers.length);
      
    } catch (error) {
      this.logger.error(`Broadcast error: ${error.message}`, { error });
    }
  }

  // 发送消息给特定客户端
  async sendToClient(clientId: string, message: any) {
    try {
      const client = await this.connectionService.getSocket(clientId);
      if (client) {
        client.emit('direct_message', {
          type: 'direct_message',
          data: message,
          timestamp: new Date().toISOString(),
        });
        
        // 记录消息
        await this.messageService.logMessage(clientId, {
          type: 'direct_message',
          data: message,
          direction: 'outgoing',
        });
      }
    } catch (error) {
      this.logger.error(`Send to client error: ${error.message}`, { error });
    }
  }

  // 获取连接统计
  async getConnectionStats() {
    return this.connectionService.getStats();
  }

  // 启动心跳监控
  private startHeartbeatMonitoring() {
    setInterval(async () => {
      try {
        const clients = await this.connectionService.getAllClients();
        const now = Date.now();
        
        for (const client of clients) {
          const lastActivity = new Date(client.lastActivity).getTime();
          const inactiveTime = now - lastActivity;
          
          // 如果超过90秒没有活动，断开连接
          if (inactiveTime > 90000) {
            const socket = await this.connectionService.getSocket(client.id);
            if (socket) {
              this.logger.warn(`Disconnecting inactive client: ${client.id} (inactive for ${inactiveTime}ms)`);
              socket.disconnect(true);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Heartbeat monitoring error: ${error.message}`, { error });
      }
    }, 30000); // 每30秒检查一次
  }

  // 启动统计监控
  private startStatsMonitoring() {
    setInterval(async () => {
      try {
        const stats = await this.connectionService.getStats();
        
        this.logger.info('Connection statistics', {
          totalConnections: stats.totalConnections,
          activeConnections: stats.activeConnections,
          totalMessages: stats.totalMessages,
          messagesPerSecond: stats.messagesPerSecond,
        });
        
        // 广播统计信息（可选）
        this.server.emit('stats_update', {
          type: 'stats_update',
          data: stats,
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        this.logger.error(`Stats monitoring error: ${error.message}`, { error });
      }
    }, 60000); // 每60秒更新一次
  }
}