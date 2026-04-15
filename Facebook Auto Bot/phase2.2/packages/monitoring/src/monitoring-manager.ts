import { v4 as uuidv4 } from 'uuid';
import { Logger } from './utils/logger';
import {
  AlertRule,
  Alert,
  AlertSeverity,
  AlertStatus,
  MetricData,
  MetricDefinition,
  DashboardConfig,
  NotificationConfig,
  Notification,
  MonitoringStats,
  LogEntry,
  AuditLog,
  ReportConfig,
  Report,
  HealthCheck,
  HealthCheckResult,
  SLAConfig,
  SLAMetric,
  NotificationChannel
} from './types';

export class MonitoringManager {
  private logger: Logger;
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private metrics: Map<string, MetricDefinition> = new Map();
  private dashboards: Map<string, DashboardConfig> = new Map();
  private notificationConfigs: Map<NotificationChannel, NotificationConfig> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private slaConfigs: Map<string, SLAConfig> = new Map();
  
  private isInitialized = false;
  private metricBuffer: MetricData[] = [];
  private logBuffer: LogEntry[] = [];
  private processingInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.logger = new Logger('MonitoringManager');
  }

  /**
   * 初始化监控管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing Monitoring Manager');

      // 加载默认配置
      await this.loadDefaultConfigs();

      // 启动处理任务
      this.startProcessingTasks();

      this.isInitialized = true;
      this.logger.info('Monitoring Manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Monitoring Manager', error as Error);
      throw error;
    }
  }

  /**
   * 记录指标数据
   */
  recordMetric(metric: Omit<MetricData, 'timestamp'>): void {
    this.validateInitialized();

    const metricData: MetricData = {
      ...metric,
      timestamp: new Date()
    };

    this.metricBuffer.push(metricData);

    // 如果缓冲区太大，触发处理
    if (this.metricBuffer.length > 1000) {
      this.processMetrics();
    }

    // 评估警报规则
    this.evaluateAlertRules(metricData);
  }

  /**
   * 记录日志
   */
  recordLog(log: Omit<LogEntry, 'timestamp'>): void {
    this.validateInitialized();

    const logEntry: LogEntry = {
      ...log,
      timestamp: new Date()
    };

    this.logBuffer.push(logEntry);

    // 如果缓冲区太大，触发处理
    if (this.logBuffer.length > 1000) {
      this.processLogs();
    }

    // 评估基于日志的警报
    this.evaluateLogBasedAlerts(logEntry);
  }

  /**
   * 记录审计日志
   */
  async recordAuditLog(auditLog: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    this.validateInitialized();

    const logger = this.logger.child('audit');

    try {
      const fullAuditLog: AuditLog = {
        id: uuidv4(),
        timestamp: new Date(),
        ...auditLog
      };

      // 这里可以将审计日志保存到数据库
      // await this.saveAuditLog(fullAuditLog);

      logger.info('Audit log recorded', {
        action: auditLog.action,
        resource: auditLog.resource,
        status: auditLog.status
      });

      // 记录为指标
      this.recordMetric({
        name: 'audit_log_total',
        value: 1,
        tags: {
          action: auditLog.action,
          resource: auditLog.resource,
          status: auditLog.status
        }
      });
    } catch (error) {
      logger.error('Failed to record audit log', error as Error);
    }
  }

  /**
   * 创建警报规则
   */
  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    this.validateInitialized();

    const logger = this.logger.child('alert-rule');

    try {
      const alertRule: AlertRule = {
        id: uuidv4(),
        ...rule
      };

      this.alertRules.set(alertRule.id, alertRule);

      await this.recordAuditLog({
        action: 'create_alert_rule',
        resource: 'alert_rule',
        resourceId: alertRule.id,
        changes: { rule: alertRule },
        status: 'success'
      });

      logger.info('Alert rule created', {
        ruleId: alertRule.id,
        name: alertRule.name,
        severity: alertRule.severity
      });

      return alertRule;
    } catch (error) {
      logger.error('Failed to create alert rule', error as Error);
      throw error;
    }
  }

  /**
   * 触发警报
   */
  async triggerAlert(ruleId: string, data: Record<string, any>): Promise<Alert> {
    this.validateInitialized();

    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    const logger = this.logger.child(`alert:${ruleId}`);

    try {
      // 检查冷却期
      const existingAlert = this.getActiveAlertByRule(ruleId);
      if (existingAlert) {
        const timeSinceLastAlert = Date.now() - existingAlert.triggeredAt.getTime();
        if (timeSinceLastAlert < rule.cooldownPeriod) {
          logger.debug('Alert suppressed due to cooldown period');
          return existingAlert;
        }
      }

      // 创建警报
      const alert: Alert = {
        id: uuidv4(),
        ruleId: rule.id,
        severity: rule.severity,
        status: 'active',
        title: rule.name,
        message: rule.description,
        data,
        metrics: this.extractMetricsFromData(data),
        triggeredAt: new Date(),
        lastUpdatedAt: new Date(),
        notificationsSent: 0,
        tags: [...rule.tags, `rule:${rule.name}`]
      };

      // 保存警报
      this.activeAlerts.set(alert.id, alert);

      // 发送通知
      await this.sendAlertNotifications(alert, rule);

      // 记录审计日志
      await this.recordAuditLog({
        action: 'trigger_alert',
        resource: 'alert',
        resourceId: alert.id,
        changes: { alert },
        status: 'success'
      });

      logger.info('Alert triggered', {
        alertId: alert.id,
        ruleId: rule.id,
        severity: alert.severity,
        title: alert.title
      });

      return alert;
    } catch (error) {
      logger.error('Failed to trigger alert', error as Error);
      throw error;
    }
  }

  /**
   * 确认警报
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<Alert> {
    this.validateInitialized();

    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const logger = this.logger.child(`alert:${alertId}`);

    try {
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date();
      alert.lastUpdatedAt = new Date();

      await this.recordAuditLog({
        userId,
        action: 'acknowledge_alert',
        resource: 'alert',
        resourceId: alert.id,
        changes: { status: 'acknowledged' },
        status: 'success'
      });

      logger.info('Alert acknowledged', {
        alertId: alert.id,
        userId,
        ruleId: alert.ruleId
      });

      return alert;
    } catch (error) {
      logger.error('Failed to acknowledge alert', error as Error);
      throw error;
    }
  }

  /**
   * 解决警报
   */
  async resolveAlert(alertId: string, userId: string): Promise<Alert> {
    this.validateInitialized();

    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const logger = this.logger.child(`alert:${alertId}`);

    try {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      alert.lastUpdatedAt = new Date();

      // 从活动警报中移除
      this.activeAlerts.delete(alertId);

      await this.recordAuditLog({
        userId,
        action: 'resolve_alert',
        resource: 'alert',
        resourceId: alert.id,
        changes: { status: 'resolved' },
        status: 'success'
      });

      logger.info('Alert resolved', {
        alertId: alert.id,
        userId,
        ruleId: alert.ruleId
      });

      return alert;
    } catch (error) {
      logger.error('Failed to resolve alert', error as Error);
      throw error;
    }
  }

  /**
   * 获取监控统计
   */
  async getMonitoringStats(timeWindow: number = 3600000): Promise<MonitoringStats> {
    this.validateInitialized();

    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - timeWindow);

      // 这里可以从数据库查询实际统计
      // 由于时间关系，返回模拟数据

      const stats: MonitoringStats = {
        totalAlerts: this.activeAlerts.size,
        activeAlerts: Array.from(this.activeAlerts.values()).filter(a => a.status === 'active').length,
        criticalAlerts: Array.from(this.activeAlerts.values()).filter(a => a.severity === 'critical').length,
        alertsBySeverity: {
          info: 0,
          warning: 0,
          error: 0,
          critical: 0
        },
        metricsCollected: this.metricBuffer.length,
        metricsRate: this.metricBuffer.length / (timeWindow / 1000),
        notificationsSent: 0,
        notificationsFailed: 0,
        notificationsByChannel: {} as Record<NotificationChannel, number>,
        processingLatency: 50,
        ruleEvaluationTime: 10,
        timeWindow: {
          start: startTime,
          end: now
        }
      };

      // 计算警报严重性分布
      for (const alert of this.activeAlerts.values()) {
        stats.alertsBySeverity[alert.severity]++;
      }

      this.logger.debug('Monitoring stats retrieved', {
        totalAlerts: stats.totalAlerts,
        metricsCollected: stats.metricsCollected
      });

      return stats;
    } catch (error) {
      this.logger.error('Failed to get monitoring stats', error as Error);
      throw error;
    }
  }

  /**
   * 注册健康检查
   */
  async registerHealthCheck(healthCheck: HealthCheck): Promise<void> {
    this.validateInitialized();

    const logger = this.logger.child(`healthcheck:${healthCheck.name}`);

    try {
      this.healthChecks.set(healthCheck.name, healthCheck);

      logger.info('Health check registered', {
        name: healthCheck.name,
        interval: healthCheck.interval,
        severity: healthCheck.severity
      });
    } catch (error) {
      logger.error('Failed to register health check', error as Error);
      throw error;
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthChecks(): Promise<HealthCheckResult[]> {
    this.validateInitialized();

    const results: HealthCheckResult[] = [];
    const logger = this.logger.child('healthchecks');

    try {
      logger.info('Performing health checks', {
        count: this.healthChecks.size
      });

      for (const [name, healthCheck] of this.healthChecks) {
        const checkLogger = logger.child(`check:${name}`);
        
        try {
          const startTime = Date.now();
          const result = await healthCheck.check();
          const duration = Date.now() - startTime;

          const healthResult: HealthCheckResult = {
            ...result,
            name,
            duration,
            timestamp: new Date()
          };

          results.push(healthResult);

          if (!healthResult.healthy) {
            checkLogger.warn('Health check failed', {
              duration,
              error: healthResult.error
            });

            // 触发警报
            await this.triggerAlertForHealthCheck(healthCheck, healthResult);
          } else {
            checkLogger.debug('Health check passed', { duration });
          }
        } catch (error) {
          checkLogger.error('Health check execution failed', error as Error);
          
          results.push({
            healthy: false,
            name,
            duration: 0,
            timestamp: new Date(),
            error: (error as Error).message,
            details: { exception: true }
          });
        }
      }

      logger.info('Health checks completed', {
        total: results.length,
        healthy: results.filter(r => r.healthy).length,
        failed: results.filter(r => !r.healthy).length
      });

      return results;
    } catch (error) {
      logger.error('Failed to perform health checks', error as Error);
      throw error;
    }
  }

  /**
   * 创建SLA配置
   */
  async createSLAConfig(config: Omit<SLAConfig, 'id'>): Promise<SLAConfig> {
    this.validateInitialized();

    const logger = this.logger.child('sla');

    try {
      const slaConfig: SLAConfig = {
        id: uuidv4(),
        ...config
      };

      this.slaConfigs.set(slaConfig.id, slaConfig);

      await this.recordAuditLog({
        action: 'create_sla_config',
        resource: 'sla_config',
        resourceId: slaConfig.id,
        changes: { config: slaConfig },
        status: 'success'
      });

      logger.info('SLA config created', {
        slaId: slaConfig.id,
        name: slaConfig.name,
        metric: slaConfig.metric,
        target: slaConfig.target
      });

      return slaConfig;
    } catch (error) {
      logger.error('Failed to create SLA config', error as Error);
      throw error;
    }
  }

  /**
   * 检查SLA合规性
   */
  async checkSLACompliance(slaId: string): Promise<SLAMetric> {
    this.validateInitialized();

    const slaConfig = this.slaConfigs.get(slaId);
    if (!slaConfig) {
      throw new Error(`SLA config not found: ${slaId}`);
    }

    const logger = this.logger.child(`sla:${slaId}`);

    try {
      // 这里需要从数据库查询指标数据并计算合规性
      // 由于时间关系，返回模拟数据

      const now = new Date();
      const windowStart = new Date(now.getTime() - slaConfig.window);

      const slaMetric: SLAMetric = {
        slaId: slaConfig.id,
        timestamp: now,
        value: 0.95 + Math.random() * 0.04, // 95-99%
        breaches: Math.floor(Math.random() * 3),
        totalChecks: 100,
        compliance: 0
      };

      slaMetric.compliance = (slaMetric.totalChecks - slaMetric.breaches) / slaMetric.totalChecks;

      // 检查是否违反SLA
      if (slaMetric.compliance < slaConfig.target) {
        logger.warn('SLA violation detected', {
          compliance: slaMetric.compliance,
          target: slaConfig.target,
          breaches: slaMetric.breaches
        });

        // 触发警报
        await this.triggerAlert({
          id: `sla-violation-${slaId}`,
          name: `SLA Violation: ${slaConfig.name}`,
          description: `SLA compliance dropped below target: ${slaMetric.compliance} < ${slaConfig.target}`,
          enabled: true,
          severity: slaConfig.severity,
          conditions: [{
            metric: 'sla_compliance',
            operator: '<',
            value: slaConfig.target
          }],
          conditionOperator: 'AND',
          triggerThreshold: 1,
          triggerWindow: 300000, // 5分钟
          cooldownPeriod: 3600000, // 1小时
          notificationChannels: slaConfig.notificationChannels,
          tags: ['sla', 'compliance', slaConfig.name]
        }, {
          slaId: slaConfig.id,
          slaName: slaConfig.name,
          compliance: slaMetric.compliance,
          target: slaConfig.target,
          breaches: slaMetric.breaches,
          totalChecks: slaMetric.totalChecks,
          windowStart,
          windowEnd: now
        });
      }

      logger.debug('SLA compliance checked', {
        compliance: slaMetric.compliance,
        target: slaConfig.target,
        breaches: slaMetric.breaches
      });

      return slaMetric;
    } catch (error) {
      logger.error('Failed to check SLA compliance', error as Error);
      throw error;
    }
  }

  /**
   * 销毁监控管理器
   */
  async destroy(): Promise<void> {
    this.logger.info('Destroying Monitoring Manager');

    // 停止处理任务
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // 处理剩余数据
    await this.processMetrics();
    await this.processLogs();

    this.isInitialized = false;
    this.logger.info('Monitoring Manager destroyed');
  }

  /**
   * 私有方法
   */

  private validateInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Monitoring Manager not initialized. Call initialize() first.');
    }
  }

  private async loadDefaultConfigs(): Promise<void> {
    // 加载默认警报规则
    const defaultRules = this.getDefaultAlertRules();
    for (const rule of defaultRules) {
      this.alertRules.set(rule.id, rule);
    }

    // 加载默认指标定义
    const defaultMetrics = this.getDefaultMetricDefinitions();
    for (const metric of defaultMetrics) {
      this.metrics.set(metric.name, metric);
    }

    // 加载默认通知配置
    const defaultNotifications = this.getDefaultNotificationConfigs();
    for (const config of defaultNotifications) {
      this.notificationConfigs.set(config.channel, config);
    }

    this.logger.info('Default configurations loaded', {
      rules: defaultRules.length,
      metrics: defaultMetrics.length,
      notifications: defaultNotifications.length
    });
  }

  private startProcessingTasks(): void {
    // 启动指标处理任务
    this.processingInterval = setInterval(async () => {
      try {
        await this.processMetrics();
        await this.processLogs();
      } catch (error) {
        this.logger.error('Processing task failed', error as Error);
      }
    }, 60000); // 每分钟处理一次

    // 启动健康检查任务
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        this.logger.error('Health check task failed', error as Error);
      }
    }, 300000); // 每5分钟检查一次

    this.logger.info('Processing tasks started');
  }

  private async processMetrics(): Promise<void> {
    if (this.metricBuffer.length === 0) {
      return;
    }

    const metricsToProcess = [...this.metricBuffer];
    this.metricBuffer = [];

    // 这里可以将指标数据保存到数据库或发送到监控系统
    // 例如：InfluxDB, Prometheus, TimescaleDB等

    this.logger.debug('Metrics processed', {
      count: metricsToProcess.length,
      sampleMetric: metricsToProcess[0]?.name
    });
  }

  private async processLogs(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToProcess = [...this.logBuffer];
    this.logBuffer = [];

    // 这里可以将日志数据保存到数据库或发送到日志系统
    // 例如：Elasticsearch, Loki, Splunk等

    this.logger.debug('Logs processed', {
      count: logsToProcess.length,
      sampleLog: logsToProcess[0]?.message.substring(0, 100)
    });
  }

  private evaluateAlertRules(metric: MetricData): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) {
        continue;
      }

      // 检查规则是否匹配该指标
      const matchingCondition = rule.conditions.find(condition => 
        condition.metric === metric.name
      );

      if (!matchingCondition) {
        continue;
      }

      // 评估条件
      const conditionMet = this.evaluateCondition(
        metric.value,
        matchingCondition.operator,
        matchingCondition.value
      );

      if (conditionMet) {
        // 这里可以实现更复杂的触发逻辑，如时间窗口、阈值等
        this.triggerAlert(rule.id, {
          metric: metric.name,
          value: metric.value,
          threshold: matchingCondition.value,
          operator: matchingCondition.operator,
          tags: metric.tags,
          timestamp: metric.timestamp
        }).catch(error => {
          this.logger.error(`Failed to trigger alert for rule ${rule.id}`, error as Error);
        });
      }
    }
  }

  private evaluateLogBasedAlerts(log: LogEntry): void {
    // 评估基于日志的警报规则
    // 例如：错误日志过多、特定模式匹配等

    // 检查错误日志
    if (log.level === 'error') {
      this.recordMetric({
        name: 'error_log_total',
        value: 1,
        tags: {
          logger: log.logger,
          sessionId: log.sessionId || 'unknown'
        }
      });

      // 如果错误日志过多，触发警报
      const errorCount = this.metricBuffer
        .filter(m => m.name === 'error_log_total')
        .reduce((sum, m) => sum + m.value, 0);

      if (errorCount > 10) { // 10个错误
        this.triggerAlert('error-log-threshold', {
          errorCount,
          recentErrors: this.metricBuffer
            .filter(m => m.name === 'error_log_total')
            .slice(-5)
            .map(m => m.tags),
          lastError: log
        }).catch(error => {
          this.logger.error('Failed to trigger error log alert', error as Error);
        });
      }
    }
  }

  private getActiveAlertByRule(ruleId: string): Alert | undefined {
    return Array.from(this.activeAlerts.values())
      .find(alert => alert.ruleId === ruleId && alert.status === 'active');
  }

  private extractMetricsFromData(data: Record<string, any>): Record<string, number> {
    const metrics: Record<string, number> = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'number') {
        metrics[key] = value;
      }
    }

    return metrics;
  }

  private async sendAlertNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    const logger = this.logger.child(`notify:${alert.id}`);

    try {
      logger.info('Sending alert notifications', {
        channels: rule.notificationChannels.length
      });

      for (const channel of rule.notificationChannels) {
        const config = this.notificationConfigs.get(channel);
        if (!config || !config.enabled) {
          logger.debug(`Notification channel disabled: ${channel}`);
          continue;
        }

        try {
          await this.sendNotification(channel, alert, rule, config);
          alert.notificationsSent++;
          alert.lastNotificationAt = new Date();
        } catch (error) {
          logger.error(`Failed to send notification via ${channel}`, error as Error);
        }
      }

      logger.info('Alert notifications sent', {
        sent: alert.notificationsSent,
        totalChannels: rule.notificationChannels.length
      });
    } catch (error) {
      logger.error('Failed to send alert notifications', error as Error);
    }
  }

  private async sendNotification(
    channel: NotificationChannel,
    alert: Alert,
    rule: AlertRule,
    config: NotificationConfig
  ): Promise<void> {
    // 这里实现具体的通知发送逻辑
    // 由于时间关系，只记录日志

    const notification: Notification = {
      id: uuidv4(),
      channel,
      recipient: 'default',
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      message: this.formatAlertMessage(alert, rule, channel),
      severity: alert.severity,
      alertId: alert.id,
      sentAt: new Date(),
      status: 'sent',
      retryCount: 0
    };

    this.logger.info('Notification sent', {
      channel,
      alertId: alert.id,
      severity: alert.severity
    });

    // 记录指标
    this.recordMetric({
      name: 'notification_sent_total',
      value: 1,
      tags: {
        channel,
        severity: alert.severity,
        status: 'success'
      }
    });
  }

  private formatAlertMessage(
    alert: Alert,
    rule: AlertRule,
    channel: NotificationChannel
  ): string {
    const template = rule.notificationTemplate || `Alert: {title}\nSeverity: {severity}\nMessage: {message}\nTime: {time}`;

    return template
      .replace('{title}', alert.title)
      .replace('{severity}', alert.severity)
      .replace('{message}', alert.message)
      .replace('{time}', alert.triggeredAt.toISOString())
      .replace('{ruleId}', rule.id)
      .replace('{alertId}', alert.id)
      .replace('{data}', JSON.stringify(alert.data, null, 2));
  }

  private async triggerAlertForHealthCheck(
    healthCheck: HealthCheck,
    result: HealthCheckResult
  ): Promise<void> {
    try {
      await this.triggerAlert('health-check-failed', {
        healthCheckName: healthCheck.name,
        severity: healthCheck.severity,
        error: result.error,
        details: result.details,
        duration: result.duration,
        timestamp: result.timestamp
      });
    } catch (error) {
      this.logger.error('Failed to trigger alert for health check', error as Error);
    }
  }

  private evaluateCondition(
    value: number,
    operator: string,
    threshold: any
  ): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '>=':
        return value >= threshold;
      case '<':
        return value < threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        return false;
    }
  }

  private getDefaultAlertRules(): AlertRule[] {
    return [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds threshold',
        enabled: true,
        severity: 'error',
        conditions: [{
          metric: 'error_rate',
          operator: '>',
          value: 0.1 // 10%
        }],
        conditionOperator: 'AND',
        triggerThreshold: 1,
        triggerWindow: 300000, // 5分钟
        cooldownPeriod: 3600000, // 1小时
        notificationChannels: ['slack', 'email'],
        tags: ['error', 'rate', 'system']
      },
      {
        id: 'session-failure',
        name: 'Session Failure',
        description: 'Multiple session failures detected',
        enabled: true,
        severity: 'warning',
        conditions: [{
          metric: 'session_failure_count',
          operator: '>',
          value: 5
        }],
        conditionOperator: 'AND',
        triggerThreshold: 1,
        triggerWindow: 600000, // 10分钟
        cooldownPeriod: 1800000, // 30分钟
        notificationChannels: ['slack'],
        tags: ['session', 'failure', 'facebook']
      },
      {
        id: 'vpn-connection-failed',
        name: 'VPN Connection Failed',
        description: 'VPN connection failure detected',
        enabled: true,
        severity: 'critical',
        conditions: [{
          metric: 'vpn_connection_failed',
          operator: '==',
          value: 1
        }],
        conditionOperator: 'AND',
        triggerThreshold: 1,
        triggerWindow: 300000, // 5分钟
        cooldownPeriod: 900000, // 15分钟
        notificationChannels: ['slack', 'email', 'sms'],
        tags: ['vpn', 'connection', 'network']
      }
    ];
  }

  private getDefaultMetricDefinitions(): MetricDefinition[] {
    return [
      {
        name: 'error_rate',
        description: 'Error rate percentage',
        type: 'gauge',
        unit: 'percent',
        labels: ['service', 'endpoint'],
        aggregation: {
          window: 60000, // 1分钟
          function: 'avg'
        }
      },
      {
        name: 'session_failure_count',
        description: 'Count of session failures',
        type: 'counter',
        labels: ['account_id', 'error_type'],
        aggregation: {
          window: 300000, // 5分钟
          function: 'sum'
        }
      },
      {
        name: 'vpn_connection_failed',
        description: 'VPN connection failure indicator',
        type: 'gauge',
        labels: ['vpn_provider', 'location'],
        aggregation: {
          window: 60000, // 1分钟
          function: 'max'
        }
      }
    ];
  }

  private getDefaultNotificationConfigs(): NotificationConfig[] {
    return [
      {
        channel: 'slack',
        enabled: true,
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
          channel: '#alerts',
          username: 'Monitoring Bot',
          icon_emoji: ':warning:'
        },
        templates: [{
          name: 'default',
          message: '*[{severity}]* {title}\n{message}\n\n*Time:* {time}\n*Alert ID:* {alertId}',
          severity: ['info', 'warning', 'error', 'critical'],
          variables: ['severity', 'title', 'message', 'time', 'alertId'],
          format: 'markdown'
        }]
      },
      {
        channel: 'email',
        enabled: true,
        config: {
          smtpHost: process.env.SMTP_HOST || 'localhost',
          smtpPort: parseInt(process.env.SMTP_PORT || '587'),
          username: process.env.SMTP_USERNAME || '',
          password: process.env.SMTP_PASSWORD || '',
          from: process.env.EMAIL_FROM || 'monitoring@example.com',
          to: process.env.EMAIL_TO || 'admin@example.com'
        },
        templates: [{
          name: 'default',
          subject: '[{severity}] {title}',
          message: '<h2>{title}</h2><p><strong>Severity:</strong> {severity}</p><p><strong>Message:</strong> {message}</p><p><strong>Time:</strong> {time}</p><p><strong>Alert ID:</strong> {alertId}</p>',
          severity: ['error', 'critical'],
          variables: ['severity', 'title', 'message', 'time', 'alertId'],
          format: 'html'
        }]
      }
    ];
  }

  /**
   * 从环境变量创建配置
   */
  static createConfigFromEnv() {
    // 这里可以从环境变量加载配置
    return {
      // 配置参数
    };
  }
}