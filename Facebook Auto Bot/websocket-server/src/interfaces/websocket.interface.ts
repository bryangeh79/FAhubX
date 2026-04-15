export interface WebSocketClient {
  id: string;
  userId?: string;
  sessionId: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
  metadata?: Record<string, any>;
}

export interface WebSocketMessage {
  type: string;
  channel?: string;
  data?: any;
  timestamp?: string;
  requestId?: string;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  totalMessages: number;
  messagesPerSecond: number;
  averageLatency: number;
}

export interface Subscription {
  clientId: string;
  channel: string;
  subscribedAt: Date;
}

export interface HeartbeatConfig {
  interval: number; // 心跳间隔（毫秒）
  timeout: number; // 超时时间（毫秒）
  maxMissed: number; // 最大丢失心跳次数
}

export interface WebSocketConfig {
  port: number;
  heartbeat: HeartbeatConfig;
  maxConnections: number;
  maxPayloadSize: number;
  corsOrigin: string;
}