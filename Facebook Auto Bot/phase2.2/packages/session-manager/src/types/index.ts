export interface SessionData {
  sessionId: string;
  accountId: string;
  cookies: any[];
  localStorage: Record<string, string>;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  stealthMode: boolean;
  humanBehavior: boolean;
  metadata?: Record<string, any>;
}

export interface EncryptedSessionData {
  sessionId: string;
  accountId: string;
  encryptedCookies: string;
  encryptedLocalStorage?: string;
  encryptionIv: string;
  encryptionTag: string;
  userAgent?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  stealthMode: boolean;
  humanBehavior: boolean;
  status: SessionStatus;
  lastActivity: Date;
  errorCount: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export type SessionStatus = 'active' | 'idle' | 'busy' | 'error' | 'expired' | 'deleted';

export interface SessionQueryOptions {
  accountId?: string;
  sessionId?: string;
  status?: SessionStatus;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'lastActivity' | 'updatedAt';
  orderDirection?: 'ASC' | 'DESC';
}

export interface SessionActivity {
  sessionId: string;
  accountId: string;
  activityType: 'login' | 'task' | 'error' | 'cleanup' | 'save' | 'restore';
  activityData?: Record<string, any>;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

export interface SessionStats {
  accountId: string;
  totalSessions: number;
  activeSessions: number;
  failedSessions: number;
  totalDurationMs: number;
  avgDurationMs: number;
  statDate: Date;
  statHour?: number;
}

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm';
  key: string; // 32字节的密钥（base64编码）
  ivLength: number; // 初始化向量长度
  saltLength: number; // 盐值长度
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeout?: number;
}

export interface SessionManagerConfig {
  encryption: EncryptionConfig;
  database: DatabaseConfig;
  cleanupInterval?: number; // 清理间隔（毫秒）
  maxIdleTime?: number; // 最大空闲时间（毫秒）
  sessionTtl?: number; // 会话TTL（毫秒）
}

export interface SaveSessionOptions {
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface RestoreSessionOptions {
  validateSession?: boolean;
  updateActivity?: boolean;
}

export interface CleanupResult {
  deletedCount: number;
  expiredCount: number;
  idleCount: number;
}

export interface SessionOverview {
  id: string;
  accountId: string;
  sessionId: string;
  status: SessionStatus;
  lastActivity: Date;
  errorCount: number;
  createdAt: Date;
  expiresAt?: Date;
  updatedAt: Date;
  ageMinutes: number;
  idleMinutes: number;
  activityCount: number;
  recentActivityType?: string;
}