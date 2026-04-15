import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server } from 'socket.io';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../app.module';
import { WebSocketGateway } from '../gateways/websocket.gateway';

describe('WebSocket Integration Tests', () => {
  let app: INestApplication;
  let ioServer: Server;
  let clientSocket: Socket;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // 使用 WebSocket 适配器
    app.useWebSocketAdapter(new IoAdapter(app));
    
    await app.init();
    await app.listen(0); // 使用随机端口
    
    const httpServer = app.getHttpServer();
    ioServer = new Server(httpServer, {
      cors: {
        origin: '*',
        credentials: true,
      },
    });
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (ioServer) {
      ioServer.close();
    }
    await app.close();
  });

  beforeEach(() => {
    // 在每个测试前创建新的客户端连接
    const port = app.getHttpServer().address().port;
    clientSocket = io(`http://localhost:${port}`, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  });

  afterEach(() => {
    // 在每个测试后断开客户端连接
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection Management', () => {
    test('should connect to WebSocket server', (done) => {
      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.connect();
    });

    test('should receive welcome message on connect', (done) => {
      clientSocket.on('connected', (data) => {
        expect(data.type).toBe('connected');
        expect(data.clientId).toBeDefined();
        expect(data.message).toBe('Connected to WebSocket server');
        done();
      });

      clientSocket.connect();
    });

    test('should receive server info on connect', (done) => {
      clientSocket.on('server_info', (data) => {
        expect(data.type).toBe('server_info');
        expect(data.heartbeatInterval).toBe(30000);
        expect(data.supportedEvents).toContain('auth');
        expect(data.supportedEvents).toContain('subscribe');
        done();
      });

      clientSocket.connect();
    });
  });

  describe('Authentication', () => {
    test('should authenticate with valid token', (done) => {
      clientSocket.on('connect', () => {
        clientSocket.emit('auth', { token: 'valid-test-token' });
      });

      clientSocket.on('auth_success', (data) => {
        expect(data.type).toBe('auth_success');
        expect(data.userId).toBeDefined();
        done();
      });

      clientSocket.connect();
    });

    test('should reject invalid token', (done) => {
      clientSocket.on('connect', () => {
        clientSocket.emit('auth', { token: 'invalid-token' });
      });

      clientSocket.on('auth_error', (data) => {
        expect(data.type).toBe('auth_error');
        expect(data.message).toBe('Invalid token');
        done();
      });

      clientSocket.connect();
    });
  });

  describe('Subscription Management', () => {
    test('should subscribe to channel', (done) => {
      clientSocket.on('connect', () => {
        // 先认证
        clientSocket.emit('auth', { token: 'valid-test-token' });
      });

      clientSocket.on('auth_success', () => {
        clientSocket.emit('subscribe', { channel: 'test-channel' });
      });

      clientSocket.on('subscribed', (data) => {
        expect(data.type).toBe('subscribed');
        expect(data.channel).toBe('test-channel');
        done();
      });

      clientSocket.connect();
    });

    test('should unsubscribe from channel', (done) => {
      clientSocket.on('connect', () => {
        clientSocket.emit('auth', { token: 'valid-test-token' });
      });

      clientSocket.on('auth_success', () => {
        // 先订阅
        clientSocket.emit('subscribe', { channel: 'test-channel' });
      });

      clientSocket.on('subscribed', () => {
        // 然后取消订阅
        clientSocket.emit('unsubscribe', { channel: 'test-channel' });
      });

      clientSocket.on('unsubscribed', (data) => {
        expect(data.type).toBe('unsubscribed');
        expect(data.channel).toBe('test-channel');
        done();
      });

      clientSocket.connect();
    });
  });

  describe('Message Handling', () => {
    test('should send and receive ping-pong', (done) => {
      const testTimestamp = new Date().toISOString();

      clientSocket.on('connect', () => {
        clientSocket.emit('ping', { timestamp: testTimestamp });
      });

      clientSocket.on('pong', (data) => {
        expect(data.type).toBe('pong');
        expect(data.timestamp).toBe(testTimestamp);
        expect(data.serverTime).toBeDefined();
        done();
      });

      clientSocket.connect();
    });

    test('should send message and receive response', (done) => {
      const testRequestId = 'test-request-123';

      clientSocket.on('connect', () => {
        clientSocket.emit('message', {
          type: 'echo',
          data: { message: 'Hello, World!' },
          requestId: testRequestId,
        });
      });

      clientSocket.on('message_response', (data) => {
        expect(data.type).toBe('echo_response');
        expect(data.data.message).toBe('Hello, World!');
        expect(data.requestId).toBe(testRequestId);
        done();
      });

      clientSocket.connect();
    });
  });

  describe('Channel Broadcasting', () => {
    test('should receive broadcast messages for subscribed channel', (done) => {
      const testChannel = 'broadcast-test';
      const testMessage = { content: 'Test broadcast message' };

      clientSocket.on('connect', () => {
        clientSocket.emit('auth', { token: 'valid-test-token' });
      });

      clientSocket.on('auth_success', () => {
        clientSocket.emit('subscribe', { channel: testChannel });
      });

      clientSocket.on('subscribed', () => {
        // 模拟服务器广播消息
        setTimeout(() => {
          ioServer.to(testChannel).emit('channel_message', {
            type: 'channel_message',
            channel: testChannel,
            data: testMessage,
            timestamp: new Date().toISOString(),
          });
        }, 100);
      });

      clientSocket.on('channel_message', (data) => {
        expect(data.type).toBe('channel_message');
        expect(data.channel).toBe(testChannel);
        expect(data.data).toEqual(testMessage);
        done();
      });

      clientSocket.connect();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid message format', (done) => {
      clientSocket.on('connect', () => {
        // 发送无效格式的消息
        clientSocket.emit('invalid_event', { invalid: 'data' });
      });

      clientSocket.on('error', (data) => {
        expect(data.type).toBe('error');
        expect(data.message).toBeDefined();
        done();
      });

      clientSocket.connect();
    });

    test('should handle disconnection and reconnection', (done) => {
      let disconnectCount = 0;
      let reconnectCount = 0;

      clientSocket.on('connect', () => {
        reconnectCount++;
        
        if (reconnectCount === 1) {
          // 第一次连接后立即断开
          setTimeout(() => {
            clientSocket.disconnect();
          }, 100);
        } else if (reconnectCount === 2) {
          // 重新连接成功
          expect(disconnectCount).toBe(1);
          done();
        }
      });

      clientSocket.on('disconnect', () => {
        disconnectCount++;
        
        if (disconnectCount === 1) {
          // 断开后重新连接
          setTimeout(() => {
            clientSocket.connect();
          }, 100);
        }
      });

      clientSocket.connect();
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple concurrent connections', async () => {
      const connectionCount = 10;
      const connections: Socket[] = [];
      const connectedPromises: Promise<void>[] = [];

      // 创建多个并发连接
      for (let i = 0; i < connectionCount; i++) {
        const socket = io(`http://localhost:${app.getHttpServer().address().port}`, {
          transports: ['websocket'],
          autoConnect: false,
        });

        connections.push(socket);

        const connectPromise = new Promise<void>((resolve) => {
          socket.on('connect', () => {
            resolve();
          });
        });

        connectedPromises.push(connectPromise);
        socket.connect();
      }

      // 等待所有连接建立
      await Promise.all(connectedPromises);

      // 验证所有连接都成功
      connections.forEach((socket) => {
        expect(socket.connected).toBe(true);
      });

      // 清理所有连接
      connections.forEach((socket) => {
        socket.disconnect();
      });
    }, 10000); // 增加超时时间

    test('should handle high message throughput', (done) => {
      const messageCount = 100;
      let receivedCount = 0;

      clientSocket.on('connect', () => {
        clientSocket.emit('auth', { token: 'valid-test-token' });
      });

      clientSocket.on('auth_success', () => {
        clientSocket.emit('subscribe', { channel: 'performance-test' });
      });

      clientSocket.on('subscribed', () => {
        // 发送大量消息
        for (let i = 0; i < messageCount; i++) {
          clientSocket.emit('message', {
            type: 'echo',
            data: { index: i, message: `Message ${i}` },
            requestId: `req-${i}`,
          });
        }
      });

      clientSocket.on('message_response', (data) => {
        receivedCount++;
        
        if (receivedCount === messageCount) {
          expect(receivedCount).toBe(messageCount);
          done();
        }
      });

      clientSocket.connect();
    }, 15000); // 增加超时时间
  });
});