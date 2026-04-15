# Facebook Auto Bot - WebSocket Server

高性能实时通信服务器，为 Facebook Auto Bot 提供实时数据同步功能。

## 功能特性

- ✅ 基于 Socket.io 的高性能 WebSocket 服务器
- ✅ 连接管理和心跳机制
- ✅ 频道订阅和消息路由
- ✅ JWT 认证和权限控制
- ✅ Redis 支持的消息持久化
- ✅ 连接状态监控和统计
- ✅ 自动重连和故障恢复
- ✅ 批量消息推送优化

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- Redis >= 6.0.0

### 安装依赖

```bash
cd /workspace/websocket-server
npm install
```

### 配置环境变量

复制环境变量示例文件并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，根据你的环境修改配置。

### 启动服务器

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm run build
npm start
```

### 测试连接

使用 WebSocket 客户端连接到服务器：

```bash
# 使用 wscat 测试
npm install -g wscat
wscat -c ws://localhost:3002/ws
```

## API 文档

### 连接建立

```
ws://localhost:3002/ws
```

### 消息格式

所有消息都使用 JSON 格式：

```json
{
  "type": "message_type",
  "channel": "channel_name",
  "data": {...},
  "timestamp": "2024-01-01T00:00:00Z",
  "requestId": "optional_request_id"
}
```

### 支持的消息类型

#### 认证
```json
{
  "type": "auth",
  "token": "jwt_token"
}
```

响应：
```json
{
  "type": "auth_success",
  "userId": "user_id",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### 订阅频道
```json
{
  "type": "subscribe",
  "channel": "channel_name"
}
```

响应：
```json
{
  "type": "subscribed",
  "channel": "channel_name",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### 取消订阅
```json
{
  "type": "unsubscribe",
  "channel": "channel_name"
}
```

响应：
```json
{
  "type": "unsubscribed",
  "channel": "channel_name",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### 心跳
```json
{
  "type": "ping",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

响应：
```json
{
  "type": "pong",
  "timestamp": "2024-01-01T00:00:00Z",
  "serverTime": "2024-01-01T00:00:00Z"
}
```

#### 发送消息
```json
{
  "type": "message",
  "channel": "channel_name",
  "data": {...},
  "requestId": "optional_request_id"
}
```

### 频道模式

系统支持以下频道模式：

1. **任务相关**
   - `task:*` - 特定任务更新
   - `task:all` - 所有任务更新

2. **账号相关**
   - `account:*` - 特定账号更新
   - `account:all` - 所有账号更新

3. **系统相关**
   - `system:*` - 系统通知
   - `system:alerts` - 系统告警
   - `system:stats` - 系统统计

4. **用户相关**
   - `user:*` - 用户特定通知
   - `notification:*` - 通用通知

5. **仪表板**
   - `dashboard` - 仪表板更新
   - `broadcast` - 广播消息

### 接收消息

当订阅的频道有更新时，服务器会推送消息：

```json
{
  "type": "channel_message",
  "channel": "channel_name",
  "data": {...},
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 客户端示例

### JavaScript/TypeScript

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3002/ws', {
  transports: ['websocket', 'polling']
});

// 连接事件
socket.on('connect', () => {
  console.log('Connected to WebSocket server');
  
  // 认证
  socket.emit('auth', { token: 'your_jwt_token' });
  
  // 订阅频道
  socket.emit('subscribe', { channel: 'dashboard' });
  socket.emit('subscribe', { channel: 'task:all' });
});

// 接收消息
socket.on('channel_message', (data) => {
  console.log('Received message:', data);
});

// 发送消息
socket.emit('message', {
  type: 'echo',
  data: { message: 'Hello, World!' },
  requestId: '123'
});

// 断开连接
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
```

### React Hook 示例

```typescript
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useWebSocket = (url: string, token?: string) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    // 创建连接
    const socket = io(url, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
    });

    socketRef.current = socket;

    // 连接事件
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    });

    // 接收消息
    socket.on('channel_message', (data) => {
      setLastMessage(data);
    });

    // 清理函数
    return () => {
      socket.disconnect();
    };
  }, [url, token]);

  const subscribe = (channel: string) => {
    if (socketRef.current) {
      socketRef.current.emit('subscribe', { channel });
    }
  };

  const unsubscribe = (channel: string) => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe', { channel });
    }
  };

  const sendMessage = (type: string, data: any, channel?: string) => {
    if (socketRef.current) {
      socketRef.current.emit('message', { type, data, channel });
    }
  };

  return {
    isConnected,
    lastMessage,
    subscribe,
    unsubscribe,
    sendMessage,
  };
};
```

## 监控和管理

### 连接统计

服务器会定期输出连接统计信息：

```json
{
  "totalConnections": 150,
  "activeConnections": 120,
  "totalMessages": 12500,
  "messagesPerSecond": 25.5,
  "averageLatency": 45.2
}
```

### Redis 键空间

服务器使用以下 Redis 键：

- `client:*` - 客户端连接信息
- `client_subs:*` - 客户端订阅列表
- `channel_subs:*` - 频道订阅者列表
- `message_log:*` - 消息日志
- `token_blacklist:*` - 令牌黑名单
- `active_clients` - 活跃客户端集合
- `channel_stats:*` - 频道统计信息

## 性能优化

### 连接管理

- 心跳机制：30秒间隔，60秒超时
- 连接池管理
- 自动清理不活跃连接

### 消息优化

- 批量消息推送
- 消息压缩支持
- 优先级队列

### 资源限制

- 最大连接数：1000
- 最大消息大小：1MB
- 内存使用监控

## 部署指南

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问地址
# WebSocket: ws://localhost:3002/ws
# 管理界面: http://localhost:3002/admin (可选)
```

### 生产环境

```bash
# 构建项目
npm run build

# 设置环境变量
export NODE_ENV=production
export JWT_SECRET=your-secure-secret
export REDIS_HOST=redis-host
export REDIS_PASSWORD=redis-password

# 启动服务器
npm start

# 使用 PM2 管理进程
pm2 start dist/main.js --name "websocket-server"
```

### Docker 部署

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3002

CMD ["node", "dist/main.js"]
```

## 故障排除

### 常见问题

1. **连接失败**
   - 检查 Redis 服务是否运行
   - 检查端口是否被占用
   - 检查防火墙设置

2. **认证失败**
   - 检查 JWT 令牌是否有效
   - 检查令牌是否过期
   - 检查令牌是否在黑名单中

3. **消息丢失**
   - 检查客户端重连机制
   - 检查网络连接稳定性
   - 检查消息队列配置

### 日志查看

```bash
# 查看错误日志
tail -f logs/websocket-error.log

# 查看综合日志
tail -f logs/websocket-combined.log

# 查看实时日志
npm run dev  # 开发模式输出到控制台
```

## 安全建议

1. **使用 HTTPS/WSS**
   ```javascript
   // 生产环境使用 WSS
   const socket = io('wss://your-domain.com/ws');
   ```

2. **令牌安全**
   - 使用强密钥生成 JWT
   - 设置合理的过期时间
   - 实现令牌刷新机制

3. **访问控制**
   - 验证用户权限
   - 限制频道访问
   - 记录操作日志

4. **DDoS 防护**
   - 配置连接限制
   - 使用速率限制
   - 启用 IP 黑名单

## 扩展开发

### 添加新的消息处理器

1. 在 `src/services/message.service.ts` 中添加新的消息类型处理
2. 在 `src/types/message.types.ts` 中定义消息类型
3. 更新客户端文档

### 添加新的认证方式

1. 扩展 `src/services/auth.service.ts`
2. 实现新的认证策略
3. 更新网关认证逻辑

### 集成其他服务

1. 创建新的服务模块
2. 在 `src/app.module.ts` 中注册
3. 实现服务间通信

## 许可证

MIT License