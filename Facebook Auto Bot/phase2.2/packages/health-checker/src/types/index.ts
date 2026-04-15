export type AccountStatus = 'healthy' | 'warning' | 'critical' | 'banned' | 'limited';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AccountInfo {
  accountId: string;
  username?: string;
  email?: string;
  phone?: string;
  createdAt?: Date;
  lastLogin?: Date;
  status: AccountStatus;
  metadata?: Record<string, any>;
}

export interface HealthCheckConfig {
  checkInterval: number; // 毫秒
  facebookCheckInterval: number; // 毫秒
  riskThresholds: {
    warning: number;
    critical: number;
    ban: number;
  };
  autoFixEnabled: boolean;
  notificationEnabled: boolean;
  checkTypes: HealthCheckType[];
}

export type HealthCheckType = 
  | 'login_status'
  | 'post_ability'
  | 'message_ability'
  | 'friend_request_ability'
  | 'group_join_ability'
  | 'rate_limit'
  | 'ip_reputation'
  | 'behavior_analysis'
  | 'security_check';

export interface HealthCheckResult {
  accountId: string;
  timestamp: Date;
  overallStatus: AccountStatus;
  riskScore: number;
  riskLevel: RiskLevel;
  checks: IndividualCheckResult[];
  recommendations: string[];
  autoFixAttempted: boolean;
  autoFixResult?: AutoFixResult;
}

export interface IndividualCheckResult {
  checkType: HealthCheckType;
  status: 'passed' | 'warning' | 'failed';
  score: number; // 0-100
  details: Record<string, any>;
  message: string;
  timestamp: Date;
}

export interface RiskIndicator {
  type: string;
  level: RiskLevel;
  description: string;
  detectedAt: Date;
  metadata?: Record<string, any>;
}

export interface AutoFixResult {
  success: boolean;
  action: string;
  details: Record<string, any>;
  error?: string;
  timestamp: Date;
}

export interface FacebookCheckResult {
  canLogin: boolean;
  canPost: boolean;
  canMessage: boolean;
  canAddFriend: boolean;
  canJoinGroup: boolean;
  rateLimited: boolean;
  restrictions: string[];
  errorMessages: string[];
  checkpointRequired: boolean;
  checkpointType?: string;
}

export interface BehaviorAnalysis {
  sessionPattern: SessionPattern;
  actionFrequency: ActionFrequency;
  geographicPattern: GeographicPattern;
  devicePattern: DevicePattern;
  anomalyScore: number;
  anomalies: Anomaly[];
}

export interface SessionPattern {
  avgSessionDuration: number;
  sessionsPerDay: number;
  loginTimes: string[];
  logoutTimes: string[];
  consistencyScore: number;
}

export interface ActionFrequency {
  postsPerDay: number;
  messagesPerDay: number;
  friendRequestsPerDay: number;
  likesPerDay: number;
  commentsPerDay: number;
  sharesPerDay: number;
  actionDistribution: Record<string, number>;
}

export interface GeographicPattern {
  countries: string[];
  cities: string[];
  timezones: string[];
  locationChanges: number;
  vpnUsage: boolean;
  proxyUsage: boolean;
}

export interface DevicePattern {
  userAgents: string[];
  browsers: string[];
  platforms: string[];
  screenResolutions: string[];
  languageSettings: string[];
}

export interface Anomaly {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  detectedAt: Date;
  confidence: number;
  metadata: Record<string, any>;
}

export interface SecurityCheckResult {
  passwordStrength: number;
  twoFactorEnabled: boolean;
  recoveryEmailSet: boolean;
  recoveryPhoneSet: boolean;
  trustedDevices: number;
  loginAlertsEnabled: boolean;
  suspiciousLogins: number;
  securityScore: number;
  recommendations: string[];
}

export interface IPReputationCheck {
  ipAddress: string;
  isVPN: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;
  blacklisted: boolean;
  reputationScore: number;
  country: string;
  isp: string;
  threats: string[];
}

export interface RateLimitCheck {
  endpoint: string;
  currentRequests: number;
  maxRequests: number;
  resetTime: Date;
  limited: boolean;
  limitType?: string;
  waitTime?: number;
}

export interface MonitoringAlert {
  id: string;
  accountId: string;
  alertType: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  data: Record<string, any>;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export interface HealthHistory {
  accountId: string;
  date: Date;
  status: AccountStatus;
  riskScore: number;
  checksCount: number;
  passedChecks: number;
  warnings: number;
  failures: number;
}

export interface HealthStats {
  totalAccounts: number;
  healthyAccounts: number;
  warningAccounts: number;
  criticalAccounts: number;
  bannedAccounts: number;
  avgRiskScore: number;
  checksPerformed: number;
  autoFixesAttempted: number;
  autoFixesSuccessful: number;
  alertsGenerated: number;
}

export interface FixAction {
  type: string;
  name: string;
  description: string;
  conditions: string[];
  actions: string[];
  successCriteria: string[];
  riskLevel: RiskLevel;
  timeout: number;
  retryCount: number;
}

export interface FixStrategy {
  accountId: string;
  issueType: string;
  actions: FixAction[];
  priority: number;
  estimatedTime: number;
  successProbability: number;
  risks: string[];
}