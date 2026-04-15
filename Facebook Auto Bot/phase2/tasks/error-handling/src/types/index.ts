/**
 * 智能错误处理系统类型定义
 */

import { OperationType, OperationResult } from '@facebook-bot/facebook-operations';
import { TaskResult, TaskEvent } from '@facebook-bot/task-engine';

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  LOW = 'low',        // 轻微错误，可以自动恢复
  MEDIUM = 'medium',  // 中等错误，可能需要人工干预
  HIGH = 'high',      // 严重错误，需要立即处理
  CRITICAL = 'critical' // 致命错误，系统可能无法继续运行
}

/**
 * 错误类别
 */
export enum ErrorCategory {
  NETWORK = 'network',          // 网络错误
  AUTHENTICATION = 'authentication', // 认证错误
  RATE_LIMIT = 'rate_limit',    // 频率限制错误
  VALIDATION = 'validation',    // 验证错误
  EXECUTION = 'execution',      // 执行错误
  TIMEOUT = 'timeout',         // 超时错误
  RESOURCE = 'resource',       // 资源错误
  UNKNOWN = 'unknown'          // 未知错误
}

/**
 * 错误来源
 */
export enum ErrorSource {
  PUPPETEER = 'puppeteer',     // Puppeteer执行器
  OPERATION = 'operation',     // Facebook操作
  TASK_ENGINE = 'task_engine', // 任务引擎
  SESSION = 'session',         // 会话管理
  VPN = 'vpn',                 // VPN管理
  DATABASE = 'database',       // 数据库
  EXTERNAL_API = 'external_api' // 外部API
}

/**
 * 错误定义
 */
export interface ErrorDefinition {
  id: string;
  code: string;
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  source: ErrorSource;
  operationType?: OperationType;
  taskId?: string;
  sessionId?: string;
  accountId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  stackTrace?: string;
}

/**
 * 重试策略
 */
export interface RetryStrategy {
  maxRetries: number;
  initialDelay: number; // 毫秒
  maxDelay: number; // 毫秒
  backoffMultiplier: number;
  jitter: boolean; // 是否添加随机抖动
  retryableErrors: string[]; // 可重试的错误代码
  nonRetryableErrors: string[]; // 不可重试的错误代码
}

/**
 * 恢复动作
 */
export enum RecoveryAction {
  RETRY = 'retry',            // 重试操作
  REFRESH_SESSION = 'refresh_session', // 刷新会话
  SWITCH_VPN = 'switch_vpn',  // 切换VPN
  WAIT_AND_RETRY = 'wait_and_retry', // 等待后重试
  SKIP_OPERATION = 'skip_operation', // 跳过操作
  ESCALATE = 'escalate',      // 升级到人工处理
  SHUTDOWN = 'shutdown'       // 关闭系统
}

/**
 * 恢复计划
 */
export interface RecoveryPlan {
  errorCode: string;
  actions: RecoveryAction[];
  priority: number;
  conditions?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * 错误处理结果
 */
export interface ErrorHandlingResult {
  errorId: string;
  handled: boolean;
  recoveryActions: RecoveryAction[];
  retryScheduled: boolean;
  retryDelay?: number;
  escalated: boolean;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * 监控指标
 */
export interface ErrorMetrics {
  totalErrors: number;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySource: Record<ErrorSource, number>;
  recoveryRate: number; // 恢复成功率
  averageRecoveryTime: number; // 平均恢复时间（毫秒）
  escalationRate: number; // 升级率
  timestamp: Date;
}

/**
 * 告警规则
 */
export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  severity: ErrorSeverity;
  actions: AlertAction[];
  enabled: boolean;
  cooldownPeriod: number; // 冷却时间（毫秒）
  metadata?: Record<string, any>;
}

/**
 * 告警条件
 */
export interface AlertCondition {
  errorCode?: string;
  errorCategory?: ErrorCategory;
  errorSeverity?: ErrorSeverity;
  errorSource?: ErrorSource;
  threshold?: number; // 错误数量阈值
  timeWindow?: number; // 时间窗口（毫秒）
  operationType?: OperationType;
}

/**
 * 告警动作
 */
export enum AlertAction {
  LOG = 'log',              // 记录日志
  NOTIFY = 'notify',        // 发送通知
  ESCALATE = 'escalate',    // 升级处理
  EXECUTE_SCRIPT = 'execute_script', // 执行脚本
  THROTTLE = 'throttle'     // 限流
}

/**
 * 告警
 */
export interface Alert {
  id: string;
  ruleId: string;
  errorId: string;
  severity: ErrorSeverity;
  message: string;
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  metadata?: Record<string, any>;
}

/**
 * 错误处理器接口
 */
export interface IErrorHandler {
  handleError(error: Error, context?: any): Promise<ErrorHandlingResult>;
  handleOperationError(result: OperationResult): Promise<ErrorHandlingResult>;
  handleTaskError(result: TaskResult): Promise<ErrorHandlingResult>;
  handleEventError(event: TaskEvent): Promise<ErrorHandlingResult>;
}

/**
 * 错误监控器接口
 */
export interface IErrorMonitor {
  recordError(error: ErrorDefinition): Promise<void>;
  getMetrics(timeRange?: { start: Date; end: Date }): Promise<ErrorMetrics>;
  getErrors(filter?: Partial<ErrorDefinition>): Promise<ErrorDefinition[]>;
  subscribe(callback: (error: ErrorDefinition) => void): void;
  unsubscribe(callback: (error: ErrorDefinition) => void): void;
}

/**
 * 恢复管理器接口
 */
export interface IRecoveryManager {
  getRecoveryPlan(errorCode: string, context?: any): Promise<RecoveryPlan | null>;
  executeRecovery(error: ErrorDefinition, plan: RecoveryPlan): Promise<ErrorHandlingResult>;
  addRecoveryPlan(plan: RecoveryPlan): Promise<void>;
  updateRecoveryPlan(errorCode: string, plan: RecoveryPlan): Promise<void>;
}

/**
 * 告警管理器接口
 */
export interface IAlertManager {
  evaluateAlert(error: ErrorDefinition): Promise<Alert[]>;
  acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void>;
  getActiveAlerts(): Promise<Alert[]>;
  addAlertRule(rule: AlertRule): Promise<void>;
  updateAlertRule(ruleId: string, rule: AlertRule): Promise<void>;
  enableAlertRule(ruleId: string): Promise<void>;
  disableAlertRule(ruleId: string): Promise<void>;
}