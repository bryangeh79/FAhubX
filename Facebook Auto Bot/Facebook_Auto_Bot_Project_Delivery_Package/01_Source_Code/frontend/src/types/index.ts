// 账号相关类型
export interface Account {
  id: string;
  username: string;
  displayName: string;
  email: string;
  status: 'active' | 'disabled' | 'banned' | 'suspended';
  tags: string[];
  lastActivityAt: string;
  lastStatusCheck: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  vpnConfig?: VPNConfig;
  loginMethod: 'manual' | 'auto' | 'cookie';
  twoFactorEnabled: boolean;
  lastLoginAt: string;
  createdAt: string;
  updatedAt: string;
  performanceStats?: {
    daily: Array<{ date: string; successRate: number; tasks: number }>;
    weekly: Array<{ week: string; successRate: number; tasks: number }>;
  };
  activityLogs?: Array<{
    id: string;
    action: string;
    details: string;
    timestamp: string;
    status: 'success' | 'error' | 'warning';
  }>;
}

export interface VPNConfig {
  id: string;
  name: string;
  provider: string;
  location: string;
  ipAddress: string;
  isConnected: boolean;
  latency?: number;
  bandwidth?: number;
  lastConnection: string;
  credentials?: {
    username?: string;
    password?: string;
  };
  rotationStrategy: 'random' | 'round-robin' | 'least-used' | 'fixed';
  rotationInterval: number;
  maxConnections: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VPNTestResult {
  configId: string;
  success: boolean;
  latency?: number;
  bandwidth?: number;
  error?: string;
  timestamp: string;
}

// 批量操作类型
export interface BatchOperation {
  id: string;
  type: 'start' | 'pause' | 'delete' | 'export' | 'test';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  completed: number;
  failed: number;
  startTime?: string;
  endTime?: string;
}

// 表单数据类型
export interface AccountFormData {
  username: string;
  password?: string;
  displayName: string;
  email: string;
  tags?: string[];
  loginMethod: 'manual' | 'auto' | 'cookie';
  twoFactorEnabled?: boolean;
  twoFactorCode?: string;
  vpnConfig?: {
    provider?: string;
    location?: string;
    ipAddress?: string;
    credentials?: {
      username?: string;
      password?: string;
    };
  };
  notes?: string;
}

export interface VPNConfigFormData {
  name: string;
  provider: string;
  location: string;
  ipAddress: string;
  username?: string;
  password?: string;
  rotationStrategy: 'random' | 'round-robin' | 'least-used' | 'fixed';
  rotationInterval: number;
  maxConnections: number;
  tags?: string[];
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 任务相关类型
export interface Task {
  id: string;
  name: string;
  description?: string;
  type: 'message' | 'friend_request' | 'group_join' | 'post' | 'comment';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  accountId: string;
  schedule?: {
    type: 'once' | 'daily' | 'weekly' | 'monthly';
    cronExpression?: string;
    startAt: string;
    endAt?: string;
  };
  config: Record<string, any>;
  result?: {
    success: boolean;
    message?: string;
    data?: any;
    executedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

// 对话剧本类型
export interface ConversationScript {
  id: string;
  name: string;
  description?: string;
  steps: ConversationStep[];
  tags: string[];
  isActive: boolean;
  successRate: number;
  totalRuns: number;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationStep {
  id: string;
  type: 'message' | 'wait' | 'condition' | 'action';
  content?: string;
  delay?: number; // 毫秒
  conditions?: Condition[];
  actions?: Action[];
  nextStepId?: string;
}

export interface Condition {
  type: 'keyword' | 'time' | 'user_status';
  operator: 'contains' | 'equals' | 'greater_than' | 'less_than';
  value: any;
}

export interface Action {
  type: 'send_message' | 'add_friend' | 'join_group' | 'update_profile';
  config: Record<string, any>;
}

// 仪表板统计类型
export interface DashboardStats {
  totalAccounts: number;
  activeAccounts: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  successRate: number;
  todayTasks: number;
  systemStatus: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    user?: string;
  }>;
}

// 用户类型
export interface User {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  avatar?: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 设置类型
export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  language: 'zh-CN' | 'en-US';
  notifications: {
    email: boolean;
    push: boolean;
    sound: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    sessionTimeout: number; // 分钟
    loginNotifications: boolean;
  };
  preferences: {
    defaultPageSize: number;
    autoRefresh: boolean;
    timezone: string;
  };
}