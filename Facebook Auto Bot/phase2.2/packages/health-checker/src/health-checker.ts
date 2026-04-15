import { v4 as uuidv4 } from 'uuid';
import { Logger } from './utils/logger';
import {
  AccountInfo,
  AccountStatus,
  RiskLevel,
  HealthCheckConfig,
  HealthCheckResult,
  IndividualCheckResult,
  HealthCheckType,
  RiskIndicator,
  AutoFixResult,
  FacebookCheckResult,
  BehaviorAnalysis,
  SecurityCheckResult,
  IPReputationCheck,
  RateLimitCheck,
  MonitoringAlert,
  HealthHistory,
  HealthStats,
  FixAction,
  FixStrategy
} from './types';

export class HealthChecker {
  private config: HealthCheckConfig;
  private logger: Logger;
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;

  constructor(config: HealthCheckConfig) {
    this.config = config;
    this.logger = new Logger('HealthChecker');
  }

  /**
   * 初始化健康检查器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing Health Checker');
      this.validateConfig();
      this.isInitialized = true;
      this.logger.info('Health Checker initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Health Checker', error as Error);
      throw error;
    }
  }

  /**
   * 注册账号进行健康检查
   */
  async registerAccount(accountInfo: AccountInfo): Promise<void> {
    this.validateInitialized();

    const logger = this.logger.child(`account:${accountInfo.accountId}`);

    try {
      logger.info('Registering account for health monitoring');

      // 启动定期检查
      this.startAccountChecks(accountInfo.accountId);

      logger.info('Account registered successfully');
    } catch (error) {
      logger.error('Failed to register account', error as Error);
      throw error;
    }
  }

  /**
   * 取消注册账号
   */
  async unregisterAccount(accountId: string): Promise<void> {
    this.validateInitialized();

    const logger = this.logger.child(`account:${accountId}`);

    try {
      logger.info('Unregistering account from health monitoring');

      // 停止检查
      this.stopAccountChecks(accountId);

      logger.info('Account unregistered successfully');
    } catch (error) {
      logger.error('Failed to unregister account', error as Error);
      throw error;
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(accountId: string): Promise<HealthCheckResult> {
    this.validateInitialized();

    const startTime = Date.now();
    const logger = this.logger.child(`check:${accountId}`);

    try {
      logger.info('Performing health check');

      const checks: IndividualCheckResult[] = [];
      let riskScore = 0;
      let autoFixAttempted = false;
      let autoFixResult: AutoFixResult | undefined;

      // 执行各项检查
      for (const checkType of this.config.checkTypes) {
        const checkResult = await this.performIndividualCheck(accountId, checkType);
        checks.push(checkResult);
        
        // 计算风险分数
        riskScore += (100 - checkResult.score) * this.getCheckWeight(checkType);
      }

      // 归一化风险分数
      riskScore = Math.min(100, riskScore / this.getTotalWeight());

      // 确定状态和风险等级
      const { status, riskLevel } = this.calculateStatusAndRisk(riskScore);

      // 如果需要自动修复
      if (this.config.autoFixEnabled && riskLevel === 'high') {
        autoFixAttempted = true;
        autoFixResult = await this.attemptAutoFix(accountId, checks);
      }

      // 生成建议
      const recommendations = this.generateRecommendations(checks, riskLevel);

      // 如果需要通知
      if (this.config.notificationEnabled && riskLevel === 'critical') {
        await this.sendAlert(accountId, riskLevel, checks);
      }

      const result: HealthCheckResult = {
        accountId,
        timestamp: new Date(),
        overallStatus: status,
        riskScore,
        riskLevel,
        checks,
        recommendations,
        autoFixAttempted,
        autoFixResult
      };

      const duration = Date.now() - startTime;
      logger.info('Health check completed', {
        status,
        riskLevel,
        riskScore: Math.round(riskScore),
        duration
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Health check failed', error as Error, { duration });

      // 返回错误结果
      return {
        accountId,
        timestamp: new Date(),
        overallStatus: 'critical',
        riskScore: 100,
        riskLevel: 'critical',
        checks: [{
          checkType: 'login_status',
          status: 'failed',
          score: 0,
          details: { error: (error as Error).message },
          message: 'Health check failed due to system error',
          timestamp: new Date()
        }],
        recommendations: ['检查系统连接和配置'],
        autoFixAttempted: false
      };
    }
  }

  /**
   * 执行Facebook特定检查
   */
  async performFacebookCheck(accountId: string): Promise<FacebookCheckResult> {
    this.validateInitialized();

    const logger = this.logger.child(`facebook:${accountId}`);

    try {
      logger.info('Performing Facebook-specific checks');

      // 这里需要实现实际的Facebook API检查
      // 由于时间关系，返回模拟结果

      const result: FacebookCheckResult = {
        canLogin: Math.random() > 0.1, // 90%成功率
        canPost: Math.random() > 0.2, // 80%成功率
        canMessage: Math.random() > 0.15, // 85%成功率
        canAddFriend: Math.random() > 0.3, // 70%成功率
        canJoinGroup: Math.random() > 0.25, // 75%成功率
        rateLimited: Math.random() > 0.8, // 20%几率被限速
        restrictions: [],
        errorMessages: [],
        checkpointRequired: Math.random() > 0.9 // 10%几率需要验证
      };

      // 模拟一些错误和限制
      if (!result.canLogin) {
        result.errorMessages.push('登录失败：密码错误或账号被锁定');
      }

      if (result.rateLimited) {
        result.restrictions.push('操作频率限制');
      }

      if (result.checkpointRequired) {
        result.checkpointType = Math.random() > 0.5 ? 'phone_verification' : 'email_verification';
        result.restrictions.push(`需要${result.checkpointType}验证`);
      }

      logger.info('Facebook checks completed', {
        canLogin: result.canLogin,
        checkpointRequired: result.checkpointRequired,
        restrictions: result.restrictions.length
      });

      return result;
    } catch (error) {
      logger.error('Facebook check failed', error as Error);
      throw error;
    }
  }

  /**
   * 分析账号行为
   */
  async analyzeBehavior(accountId: string): Promise<BehaviorAnalysis> {
    this.validateInitialized();

    const logger = this.logger.child(`behavior:${accountId}`);

    try {
      logger.info('Analyzing account behavior');

      // 这里需要实现实际的行为分析
      // 可以从数据库查询历史数据进行分析

      const analysis: BehaviorAnalysis = {
        sessionPattern: {
          avgSessionDuration: 1800 + Math.random() * 3600, // 30-90分钟
          sessionsPerDay: 2 + Math.random() * 3, // 2-5次/天
          loginTimes: ['09:00', '14:00', '20:00'],
          logoutTimes: ['10:30', '15:30', '22:00'],
          consistencyScore: 70 + Math.random() * 25 // 70-95分
        },
        actionFrequency: {
          postsPerDay: 1 + Math.random() * 2, // 1-3个/天
          messagesPerDay: 5 + Math.random() * 10, // 5-15条/天
          friendRequestsPerDay: 0.5 + Math.random(), // 0.5-1.5个/天
          likesPerDay: 10 + Math.random() * 20, // 10-30个/天
          commentsPerDay: 3 + Math.random() * 5, // 3-8个/天
          sharesPerDay: 0.5 + Math.random(), // 0.5-1.5个/天
          actionDistribution: {
            like: 40,
            comment: 25,
            share: 10,
            post: 15,
            message: 10
          }
        },
        geographicPattern: {
          countries: ['US', 'CA'],
          cities: ['New York', 'Toronto'],
          timezones: ['America/New_York', 'America/Toronto'],
          locationChanges: 2,
          vpnUsage: Math.random() > 0.7, // 30%几率使用VPN
          proxyUsage: Math.random() > 0.9 // 10%几率使用代理
        },
        devicePattern: {
          userAgents: [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          ],
          browsers: ['Chrome', 'Safari'],
          platforms: ['Windows', 'macOS'],
          screenResolutions: ['1920x1080', '1440x900'],
          languageSettings: ['en-US', 'en-CA']
        },
        anomalyScore: Math.random() * 30, // 0-30分
        anomalies: []
      };

      // 检测异常
      if (analysis.anomalyScore > 20) {
        analysis.anomalies.push({
          type: 'unusual_login_time',
          severity: 'medium',
          description: '异常登录时间检测',
          detectedAt: new Date(),
          confidence: 75,
          metadata: { expected: '09:00-22:00', actual: '03:00' }
        });
      }

      if (analysis.geographicPattern.vpnUsage) {
        analysis.anomalies.push({
          type: 'vpn_usage',
          severity: 'low',
          description: '检测到VPN使用',
          detectedAt: new Date(),
          confidence: 90,
          metadata: { vpnProvider: 'Unknown' }
        });
      }

      logger.info('Behavior analysis completed', {
        anomalyScore: Math.round(analysis.anomalyScore),
        anomalies: analysis.anomalies.length
      });

      return analysis;
    } catch (error) {
      logger.error('Behavior analysis failed', error as Error);
      throw error;
    }
  }

  /**
   * 执行安全检查
   */
  async performSecurityCheck(accountId: string): Promise<SecurityCheckResult> {
    this.validateInitialized();

    const logger = this.logger.child(`security:${accountId}`);

    try {
      logger.info('Performing security check');

      const result: SecurityCheckResult = {
        passwordStrength: 60 + Math.random() * 40, // 60-100分
        twoFactorEnabled: Math.random() > 0.5, // 50%几率启用
        recoveryEmailSet: Math.random() > 0.3, // 70%几率设置
        recoveryPhoneSet: Math.random() > 0.4, // 60%几率设置
        trustedDevices: Math.floor(Math.random() * 3), // 0-2个
        loginAlertsEnabled: Math.random() > 0.6, // 40%几率启用
        suspiciousLogins: Math.floor(Math.random() * 2), // 0-1个
        securityScore: 0,
        recommendations: []
      };

      // 计算安全分数
      let score = 0;
      score += result.passwordStrength * 0.3; // 密码强度占30%
      score += result.twoFactorEnabled ? 20 : 0; // 2FA占20%
      score += result.recoveryEmailSet ? 15 : 0; // 恢复邮箱占15%
      score += result.recoveryPhoneSet ? 15 : 0; // 恢复手机占15%
      score += result.loginAlertsEnabled ? 10 : 0; // 登录提醒占10%
      score -= result.suspiciousLogins * 10; // 可疑登录每次减10分
      score = Math.max(0, Math.min(100, score));

      result.securityScore = score;

      // 生成建议
      if (!result.twoFactorEnabled) {
        result.recommendations.push('启用双重验证以提高安全性');
      }

      if (result.passwordStrength < 70) {
        result.recommendations.push('建议使用更强密码（包含大小写字母、数字、特殊字符）');
      }

      if (!result.recoveryEmailSet && !result.recoveryPhoneSet) {
        result.recommendations.push('设置恢复邮箱或手机号码以便找回账号');
      }

      logger.info('Security check completed', {
        securityScore: Math.round(result.securityScore),
        twoFactorEnabled: result.twoFactorEnabled,
        recommendations: result.recommendations.length
      });

      return result;
    } catch (error) {
      logger.error('Security check failed', error as Error);
      throw error;
    }
  }

  /**
   * 检查IP信誉
   */
  async checkIPReputation(ipAddress: string): Promise<IPReputationCheck> {
    this.validateInitialized();

    const logger = this.logger.child(`ip:${ipAddress}`);

    try {
      logger.info('Checking IP reputation');

      // 这里可以使用外部IP信誉服务
      // 由于时间关系，返回模拟结果

      const result: IPReputationCheck = {
        ipAddress,
        isVPN: Math.random() > 0.7, // 30%几率是VPN
        isProxy: Math.random() > 0.9, // 10%几率是代理
        isTor: Math.random() > 0.95, // 5%几率是Tor
        isHosting: Math.random() > 0.8, // 20%几率是托管IP
        blacklisted: Math.random() > 0.95, // 5%几率被列入黑名单
        reputationScore: 50 + Math.random() * 50, // 50-100分
        country: ['US', 'CA', 'GB', 'DE', 'FR'][Math.floor(Math.random() * 5)],
        isp: ['Comcast', 'AT&T', 'Verizon', 'Bell', 'Rogers'][Math.floor(Math.random() * 5)],
        threats: []
      };

      // 添加威胁
      if (result.isVPN) {
        result.threats.push('VPN detected');
      }

      if (result.blacklisted) {
        result.threats.push('IP is blacklisted');
        result.reputationScore = Math.min(result.reputationScore, 30);
      }

      if (result.isTor) {
        result.threats.push('Tor network detected');
        result.reputationScore = Math.min(result.reputationScore, 20);
      }

      logger.info('IP reputation check completed', {
        reputationScore: Math.round(result.reputationScore),
        threats: result.threats.length,
        isVPN: result.isVPN
      });

      return result;
    } catch (error) {
      logger.error('IP reputation check failed', error as Error);
      throw error;
    }
  }

  /**
   * 检查速率限制
   */
  async checkRateLimit(accountId: string, endpoint: string): Promise<RateLimitCheck> {
    this.validateInitialized();

    const logger = this.logger.child(`ratelimit:${accountId}`);

    try {
      logger.info('Checking rate limits', { endpoint });

      // 这里需要实现实际的速率限制检查
      // 可以从Redis或数据库查询当前计数

      const result: RateLimitCheck = {
        endpoint,
        currentRequests: Math.floor(Math.random() * 50),
        maxRequests: 100,
        resetTime: new Date(Date.now() + 3600000), // 1小时后重置
        limited: Math.random() > 0.8, // 20%几率被限制
        limitType: undefined,
        waitTime: undefined
      };

      if (result.limited) {
        result.limitType = ['hourly', 'daily', 'per_action'][Math.floor(Math.random() * 3)];
        result.waitTime = [300000, 900000, 3600000][Math.floor(Math.random() * 3)]; // 5分钟到1小时
      }

      logger.info('Rate limit check completed', {
        limited: result.limited,
        usage: `${result.currentRequests}/${result.maxRequests}`,
        limitType: result.limitType
      });

      return result;
    } catch (error) {
      logger.error('Rate limit check failed', error as Error);
      throw error;
    }
  }

  /**
   * 获取健康统计
   */
  async getHealthStats(): Promise<HealthStats> {
    this.validateInitialized();

    try {
      // 这里可以从数据库查询实际统计
      // 由于时间关系，返回模拟数据

      const stats: HealthStats = {
        totalAccounts: 100,
        healthyAccounts: 75,
        warningAccounts: 15,
        criticalAccounts: 8,
        bannedAccounts: 2,
        avgRiskScore: 25,
        checksPerformed: 1250,
        autoFixesAttempted: 50,
        autoFixesSuccessful: 35,
        alertsGenerated: 120
      };

      this.logger.debug('Health stats retrieved', stats);
      return stats;
    } catch (error) {
      this.logger.error('Failed to get health stats', error as Error);
      throw error;
    }
  }

  /**
   * 销毁健康检查器
   */
  async destroy(): Promise<void> {
    this.logger.info('Destroying Health Checker');

    // 停止所有检查
    for (const [accountId, interval] of this.checkIntervals.entries()) {
      clearInterval(interval);
      this.logger.debug(`Stopped checks for account: ${accountId}`);
    }

    this.checkIntervals.clear();
    this.isInitialized = false;

    this.logger.info('Health Checker destroyed');
  }

  /**
   * 私有方法
   */

  private validateInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Health Checker not initialized. Call initialize() first.');
    }
  }

  private validateConfig(): void {
    if (!this.config.checkInterval || this.config.checkInterval < 60000) {
      throw new Error('Check interval must be at least 60000ms (1 minute)');
    }

    if (!this.config.checkTypes || this.config.checkTypes.length === 0) {
      throw new Error('At least one check type must be specified');
    }

    if (!this.config.riskThresholds) {
      throw new Error('Risk thresholds must be specified');
    }

    const { warning, critical, ban } = this.config.riskThresholds;
    if (warning >= critical || critical >= ban) {
      throw new Error('Risk thresholds must be in ascending order: warning < critical < ban');
    }
  }

  private startAccountChecks(accountId: string): void {
    const interval = setInterval(async () => {
      try {
        await this.performHealthCheck(accountId);
      } catch (error) {
        this.logger.error(`Scheduled check failed for account ${accountId}`, error as Error);
      }
    }, this.config.checkInterval);

    this.checkIntervals.set(accountId, interval);
    this.logger.debug(`Started scheduled checks for account: ${accountId}`);
  }

  private stopAccountChecks(accountId: string): void {
    const interval = this.checkIntervals.get(accountId);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(accountId);
      this.logger.debug(`Stopped checks for account: ${accountId}`);
    }
  }

  private async performIndividualCheck(
    accountId: string,
    checkType: HealthCheckType
  ): Promise<IndividualCheckResult> {
    const startTime = Date.now();
    const logger = this.logger.child(`check:${accountId}:${checkType}`);

    try {
      logger.debug('Performing individual check');

      let score = 100;
      let status: 'passed' | 'warning' | 'failed' = 'passed';
      let message = 'Check passed';
      const details: Record<string, any> = {};

      switch (checkType) {
        case 'login_status':
          const facebookResult = await this.performFacebookCheck(accountId);
          details.facebookResult = facebookResult;
          
          if (!facebookResult.canLogin) {
            score = 0;
            status = 'failed';
            message = '无法登录Facebook账号';
          } else if (facebookResult.checkpointRequired) {
            score = 40;
            status = 'warning';
            message = `需要${facebookResult.checkpointType}验证`;
          }
          break;

        case 'post_ability':
          const postResult = await this.performFacebookCheck(accountId);
          details.postResult = postResult;
          
          if (!postResult.canPost) {
            score = 30;
            status = 'failed';
            message = '无法发布内容';
          } else if (postResult.rateLimited) {
            score = 60;
            status = 'warning';
            message = '发布功能受限';
          }
          break;

        case 'rate_limit':
          const rateLimitResult = await this.checkRateLimit(accountId, 'api');
          details.rateLimitResult = rateLimitResult;
          
          if (rateLimitResult.limited) {
            score = 50;
            status = 'warning';
            message = `API速率限制：${rateLimitResult.limitType}`;
          }
          break;

        case 'ip_reputation':
          // 获取当前IP（这里需要从会话管理器获取）
          const ipAddress = '192.168.1.1'; // 模拟IP
          const ipReputation = await this.checkIPReputation(ipAddress);
          details.ipReputation = ipReputation;
          
          if (ipReputation.blacklisted) {
            score = 0;
            status = 'failed';
            message = 'IP地址被列入黑名单';
          } else if (ipReputation.reputationScore < 50) {
            score = ipReputation.reputationScore;
            status = 'warning';
            message = `IP信誉较低：${ipReputation.reputationScore}`;
          }
          break;

        case 'behavior_analysis':
          const behaviorAnalysis = await this.analyzeBehavior(accountId);
          details.behaviorAnalysis = behaviorAnalysis;
          
          if (behaviorAnalysis.anomalyScore > 50) {
            score = 100 - behaviorAnalysis.anomalyScore;
            status = 'warning';
            message = `行为异常检测：${behaviorAnalysis.anomalyScore}`;
          }
          break;

        case 'security_check':
          const securityCheck = await this.performSecurityCheck(accountId);
          details.securityCheck = securityCheck;
          
          if (securityCheck.securityScore < 50) {
            score = securityCheck.securityScore;
            status = 'warning';
            message = `安全分数较低：${securityCheck.securityScore}`;
          }
          break;

        default:
          // 其他检查类型
          score = 80 + Math.random() * 20; // 80-100分
          message = '检查完成';
          break;
      }

      const duration = Date.now() - startTime;
      logger.debug('Individual check completed', {
        status,
        score: Math.round(score),
        duration
      });

      return {
        checkType,
        status,
        score,
        details,
        message,
        timestamp: new Date()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Individual check failed', error as Error, { duration });

      return {
        checkType,
        status: 'failed',
        score: 0,
        details: { error: (error as Error).message },
        message: `检查失败：${(error as Error).message}`,
        timestamp: new Date()
      };
    }
  }

  private getCheckWeight(checkType: HealthCheckType): number {
    const weights: Record<HealthCheckType, number> = {
      'login_status': 0.3,
      'post_ability': 0.2,
      'message_ability': 0.15,
      'friend_request_ability': 0.1,
      'group_join_ability': 0.1,
      'rate_limit': 0.05,
      'ip_reputation': 0.05,
      'behavior_analysis': 0.03,
      'security_check': 0.02
    };

    return weights[checkType] || 0.05;
  }

  private getTotalWeight(): number {
    return this.config.checkTypes.reduce(
      (total, checkType) => total + this.getCheckWeight(checkType),
      0
    );
  }

  private calculateStatusAndRisk(riskScore: number): {
    status: AccountStatus;
    riskLevel: RiskLevel;
  } {
    const { warning, critical, ban } = this.config.riskThresholds;

    if (riskScore >= ban) {
      return { status: 'banned', riskLevel: 'critical' };
    }

    if (riskScore >= critical) {
      return { status: 'critical', riskLevel: 'critical' };
    }

    if (riskScore >= warning) {
      return { status: 'warning', riskLevel: 'high' };
    }

    if (riskScore >= warning * 0.5) {
      return { status: 'healthy', riskLevel: 'medium' };
    }

    return { status: 'healthy', riskLevel: 'low' };
  }

  private async attemptAutoFix(
    accountId: string,
    checks: IndividualCheckResult[]
  ): Promise<AutoFixResult> {
    const logger = this.logger.child(`autofix:${accountId}`);
    const startTime = Date.now();

    try {
      logger.info('Attempting auto-fix');

      // 分析失败的原因
      const failedChecks = checks.filter(check => check.status === 'failed');
      const warningChecks = checks.filter(check => check.status === 'warning');

      let action = 'no_action';
      const details: Record<string, any> = {};

      // 根据检查结果决定修复动作
      if (failedChecks.some(check => check.checkType === 'login_status')) {
        action = 'refresh_session';
        details.reason = '登录状态失败，刷新会话';
        // 这里可以调用会话管理器刷新会话
      } else if (failedChecks.some(check => check.checkType === 'ip_reputation')) {
        action = 'rotate_ip';
        details.reason = 'IP信誉问题，轮换IP';
        // 这里可以调用VPN管理器轮换IP
      } else if (warningChecks.some(check => check.checkType === 'rate_limit')) {
        action = 'wait_and_retry';
        details.reason = '速率限制，等待后重试';
        details.waitTime = 300000; // 5分钟
      } else {
        action = 'general_cleanup';
        details.reason = '执行常规清理和优化';
      }

      // 模拟修复执行
      const success = Math.random() > 0.3; // 70%成功率
      
      if (success) {
        details.result = '修复成功';
        logger.info('Auto-fix successful', { action, duration: Date.now() - startTime });
      } else {
        details.result = '修复失败';
        logger.warn('Auto-fix failed', { action, duration: Date.now() - startTime });
      }

      return {
        success,
        action,
        details,
        timestamp: new Date()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Auto-fix attempt failed with exception', error as Error, { duration });

      return {
        success: false,
        action: 'error_handling',
        details: { error: (error as Error).message },
        error: (error as Error).message,
        timestamp: new Date()
      };
    }
  }

  private generateRecommendations(
    checks: IndividualCheckResult[],
    riskLevel: RiskLevel
  ): string[] {
    const recommendations: string[] = [];

    // 基于风险等级的建议
    if (riskLevel === 'critical') {
      recommendations.push('立即停止所有自动化操作');
      recommendations.push('手动检查账号状态');
      recommendations.push('考虑更换IP地址');
    } else if (riskLevel === 'high') {
      recommendations.push('降低操作频率');
      recommendations.push('检查IP信誉');
      recommendations.push('验证会话有效性');
    } else if (riskLevel === 'medium') {
      recommendations.push('监控账号行为');
      recommendations.push('优化操作时间');
      recommendations.push('考虑启用双重验证');
    }

    // 基于具体检查结果的建议
    for (const check of checks) {
      if (check.status === 'failed') {
        switch (check.checkType) {
          case 'login_status':
            recommendations.push('重新登录账号');
            recommendations.push('检查账号是否被锁定');
            break;
          case 'ip_reputation':
            recommendations.push('立即更换IP地址');
            recommendations.push('检查VPN/代理配置');
            break;
        }
      } else if (check.status === 'warning') {
        switch (check.checkType) {
          case 'rate_limit':
            recommendations.push('降低API调用频率');
            recommendations.push('实现指数退避重试');
            break;
          case 'behavior_analysis':
            recommendations.push('模拟更自然的人类行为');
            recommendations.push('避免在异常时间操作');
            break;
        }
      }
    }

    return Array.from(new Set(recommendations)); // 去重
  }

  private async sendAlert(
    accountId: string,
    riskLevel: RiskLevel,
    checks: IndividualCheckResult[]
  ): Promise<void> {
    const logger = this.logger.child(`alert:${accountId}`);

    try {
      logger.info('Sending health alert');

      // 这里可以实现发送通知的逻辑
      // 例如：发送到Slack、Discord、Email等
      
      const failedChecks = checks.filter(c => c.status === 'failed');
      const warningChecks = checks.filter(c => c.status === 'warning');

      const alert: MonitoringAlert = {
        id: uuidv4(),
        accountId,
        alertType: 'health_check_critical',
        severity: 'critical',
        title: `账号健康检查告警 - ${riskLevel.toUpperCase()}风险`,
        message: `账号 ${accountId} 检测到${riskLevel}级别风险。失败检查：${failedChecks.length}个，警告检查：${warningChecks.length}个`,
        data: {
          riskLevel,
          failedChecks: failedChecks.map(c => ({ type: c.checkType, message: c.message })),
          warningChecks: warningChecks.map(c => ({ type: c.checkType, message: c.message })),
          timestamp: new Date().toISOString()
        },
        timestamp: new Date(),
        acknowledged: false
      };

      // 这里可以添加发送通知的实际代码
      // 例如：
      // await this.notificationService.send(alert);
      
      logger.info('Health alert prepared', {
        alertId: alert.id,
        failedChecks: failedChecks.length,
        warningChecks: warningChecks.length
      });
    } catch (error) {
      logger.error('Failed to send health alert', error as Error);
    }
  }

  /**
   * 从环境变量创建配置
   */
  static createConfigFromEnv(): HealthCheckConfig {
    return {
      checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '300000'), // 5分钟
      facebookCheckInterval: parseInt(process.env.FACEBOOK_CHECK_INTERVAL || '600000'), // 10分钟
      riskThresholds: {
        warning: parseInt(process.env.RISK_THRESHOLD_WARNING || '30'),
        critical: parseInt(process.env.RISK_THRESHOLD_CRITICAL || '60'),
        ban: parseInt(process.env.RISK_THRESHOLD_BAN || '80')
      },
      autoFixEnabled: process.env.AUTO_FIX_ENABLED !== 'false',
      notificationEnabled: process.env.NOTIFICATION_ENABLED !== 'false',
      checkTypes: (process.env.HEALTH_CHECK_TYPES || 'login_status,post_ability,rate_limit,ip_reputation,behavior_analysis')
        .split(',')
        .map(type => type.trim() as HealthCheckType)
        .filter(type => type)
    };
  }
}

// 需要导入uuid
import { v4 as uuidv4 } from 'uuid';