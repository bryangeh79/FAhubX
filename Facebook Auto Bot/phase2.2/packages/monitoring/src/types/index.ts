export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed';
export type NotificationChannel = 'email' | 'slack' | 'discord' | 'webhook' | 'sms' | 'telegram';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: AlertSeverity;
  
  // 条件配置
  conditions: AlertCondition[];
  conditionOperator: 'AND' | 'OR';
  
  // 触发配置
  triggerThreshold: number;
  triggerWindow: number; // 毫秒
  cooldownPeriod: number; // 毫秒
  
  // 通知配置
  notificationChannels: NotificationChannel[];
  notificationTemplate?: string;
  
  // 标签和元数据
  tags: string[];
  metadata?: Record<string, any>;
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '>=' | '<' | '<=' | '==' | '!=' | 'contains' | 'matches';
  value: any;
  duration?: number; // 条件持续时间（毫秒）
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  
  // 警报内容
  title: string;
  message: string;
  summary?: string;
  
  // 数据
  data: Record<string, any>;
  metrics: Record<string, number>;
  
  // 时间信息
  triggeredAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  lastUpdatedAt: Date;
  
  // 关联信息
  entityId?: string;
  entityType?: string;
  correlationId?: string;
  
  // 通知状态
  notificationsSent: number;
  lastNotificationAt?: Date;
  
  // 标签
  tags: string[];
}

export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface MetricDefinition {
  name: string;
  description: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  unit?: string;
  labels?: string[];
  aggregation?: {
    window: number;
    function: 'sum' | 'avg' | 'min' | 'max' | 'count';
  };
}

export interface DashboardConfig {
  id: string;
  name: string;
  description: string;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  refreshInterval: number;
  accessControl: {
    view: string[];
    edit: string[];
  };
}

export interface DashboardLayout {
  type: 'grid' | 'freeform';
  columns: number;
  rows?: number;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'alert' | 'log';
  title: string;
  position: WidgetPosition;
  size: WidgetSize;
  config: WidgetConfig;
  dataSource: DataSource;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface WidgetConfig {
  // 通用配置
  refreshInterval?: number;
  timeRange?: TimeRange;
  
  // 图表特定配置
  chartType?: 'line' | 'bar' | 'pie' | 'area';
  metrics?: string[];
  aggregation?: string;
  
  // 表格特定配置
  columns?: TableColumn[];
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  
  // 日志特定配置
  logLevels?: string[];
  searchQuery?: string;
}

export interface TableColumn {
  field: string;
  header: string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  formatter?: string;
}

export interface TimeRange {
  from: Date;
  to: Date;
  relative?: string; // e.g., '1h', '24h', '7d'
}

export interface DataSource {
  type: 'metric' | 'log' | 'alert' | 'custom';
  query: string;
  filters?: Record<string, any>;
  parameters?: Record<string, any>;
}

export interface NotificationConfig {
  channel: NotificationChannel;
  enabled: boolean;
  config: Record<string, any>;
  templates: NotificationTemplate[];
  rateLimit?: {
    maxPerHour: number;
    maxPerDay: number;
  };
}

export interface NotificationTemplate {
  name: string;
  subject?: string;
  title?: string;
  message: string;
  severity: AlertSeverity[];
  variables: string[];
  format: 'text' | 'html' | 'markdown';
}

export interface Notification {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message: string;
  severity: AlertSeverity;
  alertId?: string;
  sentAt: Date;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  error?: string;
  retryCount: number;
}

export interface MonitoringStats {
  // 警报统计
  totalAlerts: number;
  activeAlerts: number;
  criticalAlerts: number;
  alertsBySeverity: Record<AlertSeverity, number>;
  
  // 指标统计
  metricsCollected: number;
  metricsRate: number; // 指标/秒
  
  // 通知统计
  notificationsSent: number;
  notificationsFailed: number;
  notificationsByChannel: Record<NotificationChannel, number>;
  
  // 性能统计
  processingLatency: number; // 毫秒
  ruleEvaluationTime: number; // 毫秒
  
  // 时间窗口
  timeWindow: {
    start: Date;
    end: Date;
  };
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  logger: string;
  message: string;
  data?: Record<string, any>;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  error?: string;
  duration?: number;
}

export interface ReportConfig {
  id: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  schedule: string; // cron表达式
  format: 'pdf' | 'html' | 'csv' | 'json';
  recipients: string[];
  template: string;
  dataSources: DataSource[];
  filters?: Record<string, any>;
  retentionDays: number;
}

export interface Report {
  id: string;
  configId: string;
  name: string;
  period: {
    start: Date;
    end: Date;
  };
  format: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  fileUrl?: string;
  fileSize?: number;
  generatedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface HealthCheck {
  name: string;
  description: string;
  check: () => Promise<HealthCheckResult>;
  interval: number;
  timeout: number;
  severity: AlertSeverity;
}

export interface HealthCheckResult {
  healthy: boolean;
  name: string;
  duration: number;
  timestamp: Date;
  error?: string;
  details?: Record<string, any>;
}

export interface SLAConfig {
  id: string;
  name: string;
  description: string;
  metric: string;
  target: number; // 目标值，如0.99表示99%
  window: number; // 时间窗口（毫秒）
  severity: AlertSeverity;
  notificationChannels: NotificationChannel[];
}

export interface SLAMetric {
  slaId: string;
  timestamp: Date;
  value: number;
  breaches: number;
  totalChecks: number;
  compliance: number; // 合规率
}