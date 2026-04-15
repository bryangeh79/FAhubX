        description: 'Analyzes behavior patterns for anomalies',
        detectedAt: new Date()
      },
      {
        type: 'network',
        name: 'Network Reputation',
        value: Math.random() * 100,
        weight: 0.25,
        description: 'Assesses IP and network reputation',
        detectedAt: new Date()
      },
      {
        type: 'content',
        name: 'Content Safety',
        value: Math.random() * 100,
        weight: 0.25,
        description: 'Evaluates posted content for policy violations',
        detectedAt: new Date()
      }
    ];
    
    return indicators;
  }

  /**
   * 检查是否需要告警
   */
  private async checkForAlerts(
    accountId: string,
    health: AccountHealth,
    checkResults: HealthCheckResult[]
  ): Promise<void> {
    const alerts: MonitoringAlert[] = [];
    
    // 检查健康状态告警
    if (health.healthStatus === 'critical') {
      alerts.push({
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        accountId,
        alertType: 'health_critical',
        severity: 'critical',
        message: `Account health is critical (score: ${health.healthScore})`,
        details: { healthScore: health.healthScore, checkResults },
        triggeredAt: new Date(),
        acknowledged: false,
        resolved: false
      });
    } else if (health.healthStatus === 'warning') {
      alerts.push({
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        accountId,
        alertType: 'health_warning',
        severity: 'warning',
        message: `Account health warning (score: ${health.healthScore})`,
        details: { healthScore: health.healthScore },
        triggeredAt: new Date(),
        acknowledged: false,
        resolved: false
      });
    }
    
    // 检查风险告警
    if (health.riskLevel === 'critical') {
      alerts.push({
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        accountId,
        alertType: 'risk_critical',
        severity: 'critical',
        message: `Critical ban risk detected (score: ${health.banRiskScore})`,
        details: { banRiskScore: health.banRiskScore },
        triggeredAt: new Date(),
        acknowledged: false,
        resolved: false
      });
    } else if (health.riskLevel === 'high') {
      alerts.push({
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        accountId,
        alertType: 'risk_high',
        severity: 'error',
        message: `High ban risk detected (score: ${health.banRiskScore})`,
        details: { banRiskScore: health.banRiskScore },
        triggeredAt: new Date(),
        acknowledged: false,
        resolved: false
      });
    }
    
    // 检查失败检查告警
    const failChecks = checkResults.filter(c => c.status === 'fail');
    if (failChecks.length > 0) {
      alerts.push({
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        accountId,
        alertType: 'check_failures',
        severity: failChecks.length > 2 ? 'error' : 'warning',
        message: `${failChecks.length} health checks failed`,
        details: { failedChecks: failChecks.map(c => c.checkName) },
        triggeredAt: new Date(),
        acknowledged: false,
        resolved: false
      });
    }
    
    // 保存告警
    for (const alert of alerts) {
      this.alerts.set(alert.id, alert);
      this.logger.warn(`Alert generated for account ${accountId}`, {
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message
      });
    }
  }

  /**
   * 考虑自动修复
   */
  private async considerAutoRepair(
    accountId: string,
    health: AccountHealth,
    checkResults: HealthCheckResult[]
  ): Promise<void> {
    // 只在健康状态为critical或风险等级为critical时考虑修复
    if (health.healthStatus !== 'critical' && health.riskLevel !== 'critical') {
      return;
    }
    
    this.logger.info(`Considering auto-repair for account ${accountId}`, {
      healthStatus: health.healthStatus,
      riskLevel: health.riskLevel
    });
    
    // 生成修复建议
    const repairActions = this.generateRepairActions(health, checkResults);
    
    for (const action of repairActions) {
      if (action.priority === 'critical' || action.priority === 'high') {
        this.logger.info(`Auto-repair recommended for account ${accountId}`, {
          action: action.type,
          priority: action.priority,
          estimatedTime: action.estimatedTime
        });
        
        // 这里可以触发自动修复流程
        // await this.executeRepairAction(accountId, action);
      }
    }
  }

  /**
   * 生成修复建议
   */
  private generateRepairActions(
    health: AccountHealth,
    checkResults: HealthCheckResult[]
  ): RepairAction[] {
    const actions: RepairAction[] = [];
    
    // 基于检查结果生成修复建议
    const failChecks = checkResults.filter(c => c.status === 'fail');
    
    for (const check of failChecks) {
      switch (check.checkType) {
        case 'login':
          actions.push({
            type: 'reconnect',
            priority: 'high',
            description: 'Reconnect to Facebook and verify login',
            steps: [
              {
                step: 1,
                action: 'Clear browser cookies and cache',
                expectedResult: 'Clean browser state',
                timeout: 30000,
                retryCount: 2
              },
              {
                step: 2,
                action: 'Attempt login with valid credentials',
                expectedResult: 'Successful login',
                timeout: 60000,
                retryCount: 3
              },
              {
                step: 3,
                action: 'Verify account access and permissions',
                expectedResult: 'Full account access restored',
                timeout: 30000,
                retryCount: 1
              }
            ],
            estimatedTime: 5,
            successRate: 70
          });
          break;
          
        case 'network':
          actions.push({
            type: 'change_ip',
            priority: 'medium',
            description: 'Change IP address to avoid network restrictions',
            steps: [
              {
                step: 1,
                action: 'Disconnect current VPN/proxy',
                expectedResult: 'Network connection terminated',
                timeout: 10000,
                retryCount: 2
              },
              {
                step: 2,
                action: 'Connect to alternative VPN server',
                expectedResult: 'New IP address assigned',
                timeout: 30000,
                retryCount: 3
              },
              {
                step: 3,
                action: 'Test network connectivity',
                expectedResult: 'Stable network connection established',
                timeout: 15000,
                retryCount: 2
              }
            ],
            estimatedTime: 3,
            successRate: 85
          });
          break;
          
        case 'risk':
          actions.push({
            type: 'reduce_activity',
            priority: 'high',
            description: 'Reduce account activity to lower risk',
            steps: [
              {
                step: 1,
                action: 'Pause all automated actions',
                expectedResult: 'Account activity stopped',
                timeout: 5000,
                retryCount: 1
              },
              {
                step: 2,
                action: 'Wait for cooldown period (1-2 hours)',
                expectedResult: 'Account cooling down',
                timeout: 7200000,
                retryCount: 0
              },
              {
                step: 3,
                action: 'Resume with reduced activity level',
                expectedResult: 'Lower risk activity pattern',
                timeout: 30000,
                retryCount: 1
              }
            ],
            estimatedTime: 120, // 2小时
            successRate: 90
          });
          break;
      }
    }
    
    return actions;
  }

  /**
   * 获取账号健康状态
   */
  getAccountHealth(accountId: string): AccountHealth | undefined {
    return this.healthData.get(accountId);
  }

  /**
   * 获取所有账号健康状态
   */
  getAllAccountHealth(): AccountHealth[] {
    return Array.from(this.healthData.values());
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): MonitoringAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved);
  }

  /**
   * 获取账号告警
   */
  getAccountAlerts(accountId: string): MonitoringAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.accountId === accountId && !alert.resolved);
  }

  /**
   * 确认告警
   */
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;
    
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    if (acknowledgedBy) {
      // 在实际实现中，这里可以记录确认者信息
    }
    
    this.alerts.set(alertId, alert);
    this.logger.info(`Alert acknowledged`, { alertId });
    
    return true;
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string, resolutionNotes?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;
    
    alert.resolved = true;
    alert.resolvedAt = new Date();
    if (resolutionNotes) {
      alert.details = { ...alert.details, resolutionNotes };
    }
    
    this.alerts.set(alertId, alert);
    this.logger.info(`Alert resolved`, { alertId });
    
    return true;
  }

  /**
   * 生成健康报告
   */
  generateHealthReport(accountId: string, days: number = 7): HealthReport {
    const health = this.healthData.get(accountId);
    if (!health) {
      throw new Error(`No health data found for account ${accountId}`);
    }
    
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    // 简化版本：基于当前数据生成报告
    // 实际实现应该查询历史数据
    
    const report: HealthReport = {
      accountId,
      period: { start: startDate, end: endDate },
      summary: {
        healthScore: health.healthScore,
        riskLevel: health.riskLevel,
        issuesCount: health.errors?.length || 0,
        warningsCount: health.warnings?.length || 0,
        uptime: 95 // 简化版本
      },
      checks: health.checkResults || [],
      warnings: health.warnings || [],
      errors: health.errors || [],
      recommendations: this.generateRecommendations(health),
      generatedAt: new Date()
    };
    
    return report;
  }

  /**
   * 生成建议
   */
  private generateRecommendations(health: AccountHealth): string[] {
    const recommendations: string[] = [];
    
    if (health.healthScore < 80) {
      recommendations.push('Improve account health score by addressing failed checks');
    }
    
    if (health.banRiskScore > 50) {
      recommendations.push('Reduce account activity to lower ban risk');
    }
    
    if (health.loginSuccessRate < 90) {
      recommendations.push('Verify login credentials and account status');
    }
    
    if (health.errorCount24h > 10) {
      recommendations.push('Investigate and fix recurring errors');
    }
    
    if (health.restrictionDetected) {
      recommendations.push('Check for account restrictions and appeal if necessary');
    }
    
    return recommendations;
  }

  /**
   * 获取统计信息
   */
  getStatistics(): typeof this.checkStatistics {
    return { ...this.checkStatistics };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    monitoring: boolean;
    accounts: number;
    alerts: number;
    message: string;
  }> {
    const monitoring = this.cronJobs.some(job => job.running);
    const accounts = this.healthData.size;
    const activeAlerts = this.getActiveAlerts().length;
    
    const healthy = monitoring && accounts > 0;
    
    return {
      healthy,
      monitoring,
      accounts,
      alerts: activeAlerts,
      message: healthy 
        ? `Health Monitor is healthy (monitoring ${accounts} accounts)` 
        : `Health Monitor issues: ${!monitoring ? 'Not monitoring' : 'No accounts'}`
    };
  }

  /**
   * 清理资源
   */
  async destroy(): Promise<void> {
    try {
      // 停止监控
      this.stopMonitoring();
      
      // 清理数据
      this.healthData.clear();
      this.alerts.clear();
      this.cronJobs = [];
      
      this.logger.info('Health Monitor destroyed');
    } catch (error) {
      this.logger.error('Error destroying Health Monitor', error as Error);
      throw error;
    }
  }
}

/**
 * 健康监控器工厂
 */
export class HealthMonitorFactory {
  private static instances: Map<string, HealthMonitor> = new Map();
  
  /**
   * 创建或获取健康监控器实例
   */
  static getInstance(
    config?: Partial<HealthCheckConfig>,
    instanceId: string = 'default'
  ): HealthMonitor {
    if (!this.instances.has(instanceId)) {
      const instance = new HealthMonitor(config);
      this.instances.set(instanceId, instance);
      
      // 注册清理钩子
      process.on('SIGTERM', () => instance.destroy());
      process.on('SIGINT', () => instance.destroy());
    }
    
    return this.instances.get(instanceId)!;
  }
  
  /**
   * 销毁所有实例
   */
  static async destroyAll(): Promise<void> {
    const destroyPromises = Array.from(this.instances.values()).map(instance =>
      instance.destroy().catch(error => {
        console.error('Error destroying Health Monitor instance:', error);
      })
    );
    
    await Promise.all(destroyPromises);
    this.instances.clear();
  }
}