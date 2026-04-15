export interface PushMessage {
  id: string;
  type: PushMessageType;
  channel: string;
  data: any;
  timestamp: Date;
  priority: MessagePriority;
  ttl?: number; // Time to live in seconds
  metadata?: Record<string, any>;
}

export enum PushMessageType {
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  TASK_PROGRESS = 'task.progress',
  
  ACCOUNT_UPDATED = 'account.updated',
  ACCOUNT_STATUS_CHANGED = 'account.status_changed',
  ACCOUNT_HEALTH_UPDATE = 'account.health_update',
  
  SYSTEM_ALERT = 'system.alert',
  SYSTEM_WARNING = 'system.warning',
  SYSTEM_INFO = 'system.info',
  
  USER_NOTIFICATION = 'user.notification',
  USER_OPERATION_RESULT = 'user.operation_result',
  
  DASHBOARD_UPDATE = 'dashboard.update',
  BROADCAST = 'broadcast',
}

export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface TaskUpdateData {
  taskId: string;
  status: TaskStatus;
  progress?: number;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface AccountUpdateData {
  accountId: string;
  status: AccountStatus;
  health: AccountHealth;
  lastActivity?: Date;
  metadata?: Record<string, any>;
}

export enum AccountStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  BUSY = 'busy',
  ERROR = 'error',
}

export interface AccountHealth {
  score: number; // 0-100
  issues?: string[];
  lastCheck?: Date;
}

export interface SystemAlertData {
  level: AlertLevel;
  message: string;
  component?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface UserNotificationData {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  actionUrl?: string;
  read: boolean;
  timestamp: Date;
}

export enum NotificationType {
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface DashboardUpdateData {
  metrics: DashboardMetrics;
  timestamp: Date;
}

export interface DashboardMetrics {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  
  totalAccounts: number;
  onlineAccounts: number;
  offlineAccounts: number;
  
  systemLoad: number; // 0-100
  memoryUsage: number; // 0-100
  diskUsage: number; // 0-100
  
  queueLength: number;
  averageResponseTime: number;
}

export interface PushConfig {
  websocketUrl: string;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  redisDb?: number;
  
  batchSize: number;
  batchInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  
  enableQueue: boolean;
  queueName: string;
  
  enableMetrics: boolean;
  metricsInterval: number; // milliseconds
}

export interface PushStats {
  messagesSent: number;
  messagesFailed: number;
  messagesQueued: number;
  averageLatency: number;
  lastError?: string;
  lastErrorTime?: Date;
}

export interface ChannelSubscription {
  channel: string;
  pattern?: string;
  handler: (message: PushMessage) => Promise<void>;
  options?: {
    priority?: MessagePriority;
    batch?: boolean;
    batchSize?: number;
    batchInterval?: number;
  };
}