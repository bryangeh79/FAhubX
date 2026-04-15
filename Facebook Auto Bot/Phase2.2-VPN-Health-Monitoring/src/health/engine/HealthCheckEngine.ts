import { EventEmitter } from 'events';
import cron from 'node-cron';
import { HealthCheckResult, RiskAssessment } from '../../shared/types';
import { HealthLogger } from '../../shared/utils/logger';
import { config } from '../../shared/config';

export interface HealthCheckConfig {
  checkInterval: number; // milliseconds
  enabledChecks: string[];
  thresholds: {
    warning: number; // 0-100
    critical: number; // 0-100
  };
}

export interface CheckResult {
  name: string;
  passed: boolean;
  score: number; // 0-100
  details: Record<string, any>;
  timestamp: Date;
}

export class HealthCheckEngine extends EventEmitter {
  private logger: HealthLogger;
  private config: HealthCheckConfig;
  private checkResults: Map<string, CheckResult[]> = new Map();
  private scheduledTask: cron.ScheduledTask | null = null;
  private isRunning = false;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    super();
    this.logger = new HealthLogger('HealthCheckEngine');
    
    this.config = {
      checkInterval: config.health.checkInterval,
      enabledChecks: ['login', 'apiAccess', 'rateLimit', 'sessionValid', 'ipReputation'],
      thresholds: {
        warning: 70,
        critical: 50,
      },
      ...config,
    };

    this.logger.info('Health Check Engine initialized', this.config);
  }

  /**
   * Start health check scheduler
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Health check engine already running');
      return;
    }

    // Convert milliseconds to cron expression (every X minutes)
    const minutes = Math.max(1, Math.floor(this.config.checkInterval / 60000));
    const cronExpression = `*/${minutes} * * * *`;

    this.scheduledTask = cron.schedule(cronExpression, () => {
      this.runAllChecks().catch(error => {
        this.logger.error('Failed to run health checks', error);
      });
    });

    this.isRunning = true;
    this.logger.info(`Health check engine started (every ${minutes} minutes)`);
    this.emit('started');
  }

  /**
   * Stop health check scheduler
   */
  stop(): void {
    if (!this.isRunning || !this.scheduledTask) {
      this.logger.warn('Health check engine not running');
      return;
    }

    this.scheduledTask.stop();
    this.scheduledTask = null;
    this.isRunning = false;

    this.logger.info('Health check engine stopped');
    this.emit('stopped');
  }

  /**
   * Run all enabled health checks
   */
  async runAllChecks(accountId?: string): Promise<HealthCheckResult[]> {
    this.logger.info('Running all health checks', { accountId });
    
    const results: HealthCheckResult[] = [];
    const timestamp = new Date();

    try {
      // Run each enabled check
      for (const checkName of this.config.enabledChecks) {
        try {
          const checkResult = await this.runCheck(checkName, accountId);
          
          if (checkResult) {
            results.push(checkResult);
            
            // Store check result
            const key = accountId || 'global';
            if (!this.checkResults.has(key)) {
              this.checkResults.set(key, []);
            }
            this.checkResults.get(key)!.push({
              name: checkName,
              passed: checkResult.status !== 'critical',
              score: checkResult.score,
              details: checkResult.details,
              timestamp,
            });
          }
        } catch (error) {
          this.logger.error(`Health check failed: ${checkName}`, error as Error, { accountId });
        }
      }

      // Calculate overall health score
      if (results.length > 0) {
        const overallResult = this.calculateOverallHealth(results, accountId, timestamp);
        this.emit('healthCheckComplete', overallResult);
        
        this.logger.info('Health checks completed', {
          accountId,
          totalChecks: results.length,
          overallScore: overallResult.score,
          status: overallResult.status,
        });
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to run health checks', error as Error, { accountId });
      throw error;
    }
  }

  /**
   * Run specific health check
   */
  private async runCheck(checkName: string, accountId?: string): Promise<HealthCheckResult | null> {
    const timestamp = new Date();
    
    switch (checkName) {
      case 'login':
        return await this.checkLoginStatus(accountId, timestamp);
      case 'apiAccess':
        return await this.checkAPIAccess(accountId, timestamp);
      case 'rateLimit':
        return await this.checkRateLimit(accountId, timestamp);
      case 'sessionValid':
        return await this.checkSessionValidity(accountId, timestamp);
      case 'ipReputation':
        return await this.checkIPReputation(accountId, timestamp);
      default:
        this.logger.warn(`Unknown health check: ${checkName}`);
        return null;
    }
  }

  /**
   * Check login status
   */
  private async checkLoginStatus(accountId?: string, timestamp?: Date): Promise<HealthCheckResult> {
    // TODO: Implement actual login status check
    // This would check if the account can still log in to the target service
    
    const passed = Math.random() > 0.2; // 80% chance of passing for demo
    const score = passed ? 100 : 0;
    
    return {
      id: `login_${Date.now()}`,
      accountId: accountId || 'global',
      timestamp: timestamp || new Date(),
      status: passed ? 'healthy' : 'critical',
      score,
      checks: {
        login: passed,
        apiAccess: false,
        rateLimit: false,
        sessionValid: false,
        ipReputation: false,
      },
      details: {
        canLogin: passed,
        lastLoginAttempt: new Date(Date.now() - 3600000).toISOString(),
        loginFailures: passed ? 0 : 3,
      },
      recommendations: passed ? [] : ['Reset password', 'Check account status'],
    };
  }

  /**
   * Check API access
   */
  private async checkAPIAccess(accountId?: string, timestamp?: Date): Promise<HealthCheckResult> {
    // TODO: Implement actual API access check
    // This would test if API endpoints are accessible
    
    const passed = Math.random() > 0.1; // 90% chance of passing for demo
    const score = passed ? 100 : 0;
    
    return {
      id: `api_${Date.now()}`,
      accountId: accountId || 'global',
      timestamp: timestamp || new Date(),
      status: passed ? 'healthy' : 'critical',
      score,
      checks: {
        login: false,
        apiAccess: passed,
        rateLimit: false,
        sessionValid: false,
        ipReputation: false,
      },
      details: {
        endpointsTested: ['/api/v1/user', '/api/v1/data'],
        successRate: passed ? 100 : 0,
        responseTime: passed ? 150 : 5000,
      },
      recommendations: passed ? [] : ['Check API credentials', 'Verify network connectivity'],
    };
  }

  /**
   * Check rate limit status
   */
  private async checkRateLimit(accountId?: string, timestamp?: Date): Promise<HealthCheckResult> {
    // TODO: Implement actual rate limit check
    // This would check if the account is接近 rate limits
    
    const usage = Math.random() * 100; // Random usage percentage for demo
    const passed = usage < 80; // Pass if usage < 80%
    const score = Math.max(0, 100 - usage);
    
    return {
      id: `ratelimit_${Date.now()}`,
      accountId: accountId || 'global',
      timestamp: timestamp || new Date(),
      status: usage > 90 ? 'critical' : usage > 70 ? 'warning' : 'healthy',
      score,
      checks: {
        login: false,
        apiAccess: false,
        rateLimit: passed,
        sessionValid: false,
        ipReputation: false,
      },
      details: {
        usagePercentage: Math.round(usage),
        limitRemaining: Math.round(100 - usage),
        resetTime: new Date(Date.now() + 3600000).toISOString(),
      },
      recommendations: usage > 70 ? ['Reduce request frequency', 'Implement backoff strategy'] : [],
    };
  }

  /**
   * Check session validity
   */
  private async checkSessionValidity(accountId?: string, timestamp?: Date): Promise<HealthCheckResult> {
    // TODO: Implement actual session validity check
    
    const sessionAge = Math.random() * 48 * 3600000; // Random age up to 48 hours
    const passed = sessionAge < 24 * 3600000; // Pass if session < 24 hours old
    const score = Math.max(0, 100 - (sessionAge / (24 * 3600000)) * 100);
    
    return {
      id: `session_${Date.now()}`,
      accountId: accountId || 'global',
      timestamp: timestamp || new Date(),
      status: sessionAge > 36 * 3600000 ? 'critical' : sessionAge > 24 * 3600000 ? 'warning' : 'healthy',
      score,
      checks: {
        login: false,
        apiAccess: false,
        rateLimit: false,
        sessionValid: passed,
        ipReputation: false,
      },
      details: {
        sessionAgeHours: Math.round(sessionAge / 3600000),
        lastActivity: new Date(Date.now() - sessionAge).toISOString(),
        sessionId: `session_${Math.random().toString(36).substr(2, 9)}`,
      },
      recommendations: sessionAge > 24 * 3600000 ? ['Refresh session', 'Re-authenticate'] : [],
    };
  }

  /**
   * Check IP reputation
   */
  private async checkIPReputation(accountId?: string, timestamp?: Date): Promise<HealthCheckResult> {
    // TODO: Implement actual IP reputation check
    // This would check if the current IP has good reputation
    
    const reputationScore = Math.random() * 100; // Random reputation score for demo
    const passed = reputationScore > 30; // Pass if reputation > 30
    const score = reputationScore;
    
    return {
      id: `ipreputation_${Date.now()}`,
      accountId: accountId || 'global',
      timestamp: timestamp || new Date(),
      status: reputationScore < 20 ? 'critical' : reputationScore < 40 ? 'warning' : 'healthy',
      score,
      checks: {
        login: false,
        apiAccess: false,
        rateLimit: false,
        sessionValid: false,
        ipReputation: passed,
      },
      details: {
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        reputationScore: Math.round(reputationScore),
        isBlacklisted: reputationScore < 10,
        country: 'US',
        isp: 'Example ISP',
      },
      recommendations: reputationScore < 40 ? ['Change IP address', 'Use VPN'] : [],
    };
  }

  /**
   * Calculate overall health from individual check results
   */
  private calculateOverallHealth(
    results: HealthCheckResult[],
    accountId?: string,
    timestamp?: Date
  ): HealthCheckResult {
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    const averageScore = totalScore / results.length;
    
    // Determine overall status based on thresholds
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (averageScore < this.config.thresholds.critical) {
      status = 'critical';
    } else if (averageScore < this.config.thresholds.warning) {
      status = 'warning';
    }

    // Combine all checks
    const combinedChecks = results.reduce((acc, result) => ({
      login: acc.login || result.checks.login,
      apiAccess: acc.apiAccess || result.checks.apiAccess,
      rateLimit: acc.rateLimit || result.checks.rateLimit,
      sessionValid: acc.sessionValid || result.checks.sessionValid,
      ipReputation: acc.ipReputation || result.checks.ipReputation,
    }), {
      login: false,
      apiAccess: false,
      rateLimit: false,
      sessionValid: false,
      ipReputation: false,
    });

    // Combine details
    const combinedDetails = results.reduce((acc, result) => ({
      ...acc,
      [result.id.split('_')[0]]: result.details,
    }), {});

    // Collect all recommendations
    const allRecommendations = results.flatMap(result => result.recommendations);
    const uniqueRecommendations = [...new Set(allRecommendations)];

    return {
      id: `overall_${Date.now()}`,
      accountId: accountId || 'global',
      timestamp: timestamp || new Date(),
      status,
      score: Math.round(averageScore),
      checks: combinedChecks,
      details: combinedDetails,
      recommendations: uniqueRecommendations,
    };
  }

  /**
   * Get health check history
   */
  getHealthHistory(accountId?: string, limit: number = 100): CheckResult[] {
    const key = accountId || 'global';
    const history = this.checkResults.get(key) || [];
    
    // Return most recent results
    return history
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get health check statistics
   */
  getHealthStatistics(accountId?: string): {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    averageScore: number;
    lastCheck: Date | null;
  } {
    const history = this.getHealthHistory(accountId);
    
    if (history.length === 0) {
      return {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        averageScore: 0,
        lastCheck: null,
      };
    }

    const passedChecks = history.filter(check => check.passed).length;
    const totalScore = history.reduce((sum, check) => sum + check.score, 0);
    
    return {
      totalChecks: history.length,
      passedChecks,
      failedChecks: history.length - passedChecks,
      averageScore: Math.round(totalScore / history.length),
      lastCheck: history[0]?.timestamp || null,
    };
  }

  /**
   * Add custom health check
   */
  addCustomCheck(
    name: string,
    checkFunction: (accountId?: string) => Promise<CheckResult>
  ): void {
    // TODO: Implement custom check registration
    this.logger.info(`Custom health check added: ${name}`);
  }

  /**
   * Update health check configuration
   */
  updateConfig(newConfig: Partial<HealthCheckConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Restart scheduler if interval changed
    if (newConfig.checkInterval && newConfig.checkInterval !== oldConfig.checkInterval) {
      if (this.isRunning) {
        this.stop();
        this.start();
      }
    }
    
    this.logger.info('Health check configuration updated', newConfig);
    this.emit('configUpdated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  /**
   * Check if engine is running
   */
  isEngineRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stop();
    this.checkResults.clear();
    this.removeAllListeners();
    
    this.logger.info('Health check engine cleaned up');
  }
}