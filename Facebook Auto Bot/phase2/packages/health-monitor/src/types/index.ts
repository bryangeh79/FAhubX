export interface AccountHealth {
  id: string;
  accountId: string;
  sessionId?: string;
  
  // 健康状态
  healthStatus: 'healthy' | 'warning' | 'critical' | 'banned' | 'disabled';
  healthScore: number; // 0-100
  
  // 登录状态
  lastLoginStatus?: boolean;
  lastLoginTime?: Date;
  loginSuccessRate: number; // 0-100
  
  // 风险指标
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  banRiskScore: number; // 0-100
  restrictionDetected: boolean;
  suspiciousActivityDetected: boolean;
  
  // 性能指标
  avgResponseTime?: number; // 毫秒
  successRate: number; // 0-100
  errorCount24h: number;
  
  // 操作统计
  postsCount24h: number;
  likesCount24h: number;
  commentsCount24h: number;
  friendsAdded24h: number;
  
  // 检测详情
  checkResults?: HealthCheckResult[];
  warnings?: HealthWarning[];
  errors?: HealthError[];
  
  // 时间戳
  checkedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthCheckResult {
  checkType: string;
  checkName: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details?: any;
  timestamp: Date;
}

export interface HealthWarning {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  details?: any;
  detectedAt: Date;
  resolvedAt?: Date;
}

export interface HealthError {
  type: string;
  message: string;
  stackTrace?: string;
  context?: any;
  occurredAt: Date;
  resolvedAt?: Date;
}

export interface RiskIndicator {
  type: string;
  name: string;
  value: number; // 0-100
  weight: number; // 0-1
  description: string;
  detectedAt: Date;
}

export interface PerformanceMetrics {
  responseTime: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
  successRate: number;
  errorRate: number;
  throughput: number; // 请求/秒
  latency: {
    network: number;
    processing: number;
    total: number;
  };
}

export interface AccountBehavior {
  postingFrequency: number; // 帖子/天
  likingFrequency: number; // 点赞/天
  commentingFrequency: number; // 评论/天
  friendingFrequency: number; // 加好友/天
  activityPattern: 'normal' | 'aggressive' | 'conservative' | 'suspicious';
  timeDistribution: {
    morning: number; // 0-1
    afternoon: number;
    evening: number;
    night: number;
  };
}

export interface BanRiskFactors {
  accountAge: number; // 天
  verificationStatus: 'none' | 'partial' | 'full';
  previousBans: number;
  suspiciousActions: number;
  rateLimitHits: number;
  contentFlags: number;
  friendRequestRejections: number;
  reportCount: number;
}

export interface HealthCheckConfig {
  // 检查频率
  checkInterval: number; // 毫秒
  loginCheckInterval: number;
  riskCheckInterval: number;
  
  // 阈值配置
  thresholds: {
    healthScore: {
      healthy: number; // >= 80
      warning: number; // >= 60
      critical: number; // < 60
    };
    banRiskScore: {
      low: number; // < 30
      medium: number; // < 60
      high: number; // < 80
      critical: number; // >= 80
    };
    errorRate: number; // 错误率阈值
    responseTime: number; // 响应时间阈值（毫秒）
  };
  
  // 检查启用/禁用
  enabledChecks: {
    login: boolean;
    performance: boolean;
    behavior: boolean;
    risk: boolean;
    network: boolean;
  };
  
  // 自动修复
  autoRepair: {
    enabled: boolean;
    maxAttempts: number;
    cooldownPeriod: number;
  };
}

export interface RepairAction {
  type: 'reconnect' | 'clear_cache' | 'change_ip' | 'reduce_activity' | 'verify_account';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  steps: RepairStep[];
  estimatedTime: number; // 分钟
  successRate: number; // 0-100
}

export interface RepairStep {
  step: number;
  action: string;
  expectedResult: string;
  timeout: number; // 毫秒
  retryCount: number;
}

export interface MonitoringAlert {
  id: string;
  accountId: string;
  alertType: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: any;
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface HealthReport {
  accountId: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    healthScore: number;
    riskLevel: string;
    issuesCount: number;
    warningsCount: number;
    uptime: number; // 百分比
  };
  checks: HealthCheckResult[];
  warnings: HealthWarning[];
  errors: HealthError[];
  recommendations: string[];
  generatedAt: Date;
}