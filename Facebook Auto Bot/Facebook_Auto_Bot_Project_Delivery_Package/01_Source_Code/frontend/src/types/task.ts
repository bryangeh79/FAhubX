// 任务类型定义
export type TaskType = 'conversation' | 'post' | 'like' | 'share' | 'friend' | 'group' | 'comment' | 'message';

// 任务状态
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';

// 调度类型
export type ScheduleType = 'immediate' | 'scheduled' | 'recurring' | 'cron';

// 重复频率
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

// 任务优先级
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

// 账号选择
export interface AccountSelection {
  id: string;
  displayName: string;
  username: string;
  avatar?: string;
  status: 'active' | 'inactive' | 'error';
}

// 调度配置
export interface ScheduleConfig {
  type: ScheduleType;
  // 立即执行
  immediate?: boolean;
  // 定时执行
  scheduledAt?: string; // ISO 8601
  // 重复执行
  recurring?: {
    frequency: RecurringFrequency;
    interval?: number; // 间隔天数/周数/月数
    timeOfDay?: string; // HH:mm
    daysOfWeek?: number[]; // 0-6, 0=周日
    daysOfMonth?: number[]; // 1-31
    startDate?: string; // ISO 8601
    endDate?: string; // ISO 8601
  };
  // Cron表达式
  cronExpression?: string;
}

// 对话剧本
export interface ConversationScript {
  id: string;
  name: string;
  description: string;
  category: 'marketing' | 'customer_service' | 'social' | 'engagement' | 'lead_generation' | 'other';
  content: string;
  variables?: Record<string, string>;
  tags: string[];
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// 高级配置
export interface AdvancedConfig {
  // 并发控制
  maxConcurrentAccounts: number;
  // 失败重试
  retryOnFailure: boolean;
  maxRetries: number;
  retryDelay: number; // 秒
  // 超时设置
  executionTimeout: number; // 秒
  // 通知设置
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    onCompletion: boolean;
    channels: ('email' | 'webhook' | 'telegram')[];
  };
}

// 任务详情
export interface Task {
  id: string;
  name: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  
  // 账号选择
  accountIds: string[];
  accounts: AccountSelection[];
  
  // 调度配置
  schedule: ScheduleConfig;
  
  // 对话任务特定配置
  scriptId?: string;
  script?: ConversationScript;
  customScript?: string;
  
  // 高级配置
  advancedConfig: AdvancedConfig;
  
  // 执行统计
  executionStats: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    lastExecution?: string;
    nextExecution?: string;
    averageDuration?: number; // 秒
  };
  
  // 元数据
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

// 执行日志
export interface ExecutionLog {
  id: string;
  taskId: string;
  accountId: string;
  status: 'success' | 'failure' | 'partial';
  startedAt: string;
  completedAt?: string;
  duration?: number; // 秒
  result?: any;
  error?: string;
  logs: string[];
}

// 批量任务操作
export interface BatchOperation {
  taskIds: string[];
  action: 'start' | 'pause' | 'stop' | 'delete' | 'duplicate';
}

// 任务模板
export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  type: TaskType;
  config: Partial<Task>;
  tags: string[];
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// 任务监控数据
export interface TaskMonitorData {
  activeTasks: number;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  recentExecutions: ExecutionLog[];
  performanceByHour: Array<{
    hour: number;
    executions: number;
    successRate: number;
  }>;
}