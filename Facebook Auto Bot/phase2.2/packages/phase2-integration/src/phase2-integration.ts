import { Logger } from '../../shared/src/utils/logger';
import { ConfigManager, FullConfig } from '../../shared/src/config/config-manager';
import { SessionManager } from '../../session-manager/src/session-manager';
import { VPMManager } from '../../vpn-manager/src/vpn-manager';
import { HealthChecker } from '../../health-checker/src/health-checker';
import { MonitoringManager } from '../../monitoring/src/monitoring-manager';

export class Phase2Integration {
  private config: FullConfig;
  private logger: Logger;
  private configManager: ConfigManager;
  
  private sessionManager?: SessionManager;
  private vpnManager?: VPMManager;
  private healthChecker?: HealthChecker;
  private monitoringManager?: MonitoringManager;
  
  private isInitialized = false;

  constructor(configPath?: string) {
    this.logger = new Logger('Phase2Integration');
    this.configManager = new ConfigManager(configPath);
    this.config = this.configManager.getConfig();
  }

  /**
   * 初始化Phase 2.2集成
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const startTime = Date.now();
    this.logger.info('Initializing Phase 2.2 Integration');

    try {
      // 1. 初始化配置管理器
      this.logger.info('Step 1: Configuring system...');
      this.validateEnvironment();

      // 2. 初始化会话管理器
      this.logger.info('Step 2: Initializing Session Manager...');
      await this.initializeSessionManager();

      // 3. 初始化VPN管理器
      this.logger.info('Step 3: Initializing VPN Manager...');
      await this.initializeVPNManager();

      // 4. 初始化健康检查器
      this.logger.info('Step 4: Initializing Health Checker...');
      await this.initializeHealthChecker();

      // 5. 初始化监控管理器
      this.logger.info('Step 5: Initializing Monitoring Manager...');
      await this.initializeMonitoringManager();

      // 6. 设置模块间集成
      this.logger.info('Step 6: Setting up module integration...');
      await this.setupModuleIntegration();

      this.isInitialized = true;
      
      const duration = Date.now() - startTime;
      this.logger.info('Phase 2.2 Integration initialized successfully', {
        duration: `${duration}ms`,
        modules: ['SessionManager', 'VPNManager', 'HealthChecker', 'MonitoringManager']
      });

      // 记录启动指标
      this.recordStartupMetrics(duration);
    } catch (error) {
      this.logger.error('Failed to initialize Phase 2.2 Integration', error as Error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * 获取会话管理器
   */
  getSessionManager(): SessionManager {
    if (!this.sessionManager) {
      throw new Error('Session Manager not initialized');
    }
    return this.sessionManager;
  }

  /**
   * 获取VPN管理器
   */
  getVPNManager(): VPMManager {
    if (!this.vpnManager) {
      throw new Error('VPN Manager not initialized');
    }
    return this.vpnManager;
  }

  /**
   * 获取健康检查器
   */
  getHealthChecker(): HealthChecker {
    if (!this.healthChecker) {
      throw new Error('Health Checker not initialized');
    }
    return this.healthChecker;
  }

  /**
   * 获取监控管理器
   */
  getMonitoringManager(): MonitoringManager {
    if (!this.monitoringManager) {
      throw new Error('Monitoring Manager not initialized');
    }
    return this.monitoringManager;
  }

  /**
   * 创建Facebook会话
   */
  async createFacebookSession(accountId: string, credentials: any): Promise<{
    sessionId: string;
    vpnConnectionId: string;
    containerId: string;
  }> {
    this.validateInitialized();

    const logger = this.logger.child(`session:${accountId}`);
    const startTime = Date.now();

    try {
      logger.info('Creating Facebook session with Phase 2.2 integration');

      // 1. 获取VPN连接
      logger.debug('Step 1: Acquiring VPN connection');
      const vpnConnection = await this.acquireVPNConnection(accountId);
      
      // 2. 创建Docker容器
      logger.debug('Step 2: Creating Docker container');
      const containerId = await this.createFacebookContainer(accountId, vpnConnection.id);
      
      // 3. 执行Facebook登录
      logger.debug('Step 3: Performing Facebook login');
      const sessionData = await this.performFacebookLogin(containerId, credentials);
      
      // 4. 保存加密会话
      logger.debug('Step 4: Saving encrypted session');
      const savedSession = await this.sessionManager!.saveSession({
        sessionId: sessionData.sessionId,
        accountId,
        cookies: sessionData.cookies,
        localStorage: sessionData.localStorage,
        userAgent: sessionData.userAgent,
        viewport: { width: 1920, height: 1080 },
        stealthMode: true,
        humanBehavior: true
      }, {
        expiresAt: new Date(Date.now() + this.config.session.sessionTtl)
      });

      // 5. 注册健康检查
      logger.debug('Step 5: Registering health check');
      await this.healthChecker!.registerAccount({
        accountId,
        email: credentials.email,
        status: 'healthy',
        metadata: {
          sessionId: savedSession.sessionId,
          vpnConnectionId: vpnConnection.id,
          containerId
        }
      });

      const duration = Date.now() - startTime;
      logger.info('Facebook session created successfully', {
        sessionId: savedSession.sessionId,
        vpnConnectionId: vpnConnection.id,
        containerId,
        duration: `${duration}ms`
      });

      // 记录指标
      this.recordMetric('session_creation_success', 1, { accountId });
      this.recordMetric('session_creation_duration', duration, { accountId });

      return {
        sessionId: savedSession.sessionId,
        vpnConnectionId: vpnConnection.id,
        containerId
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to create Facebook session', error as Error, { duration });
      
      // 记录失败指标
      this.recordMetric('session_creation_failure', 1, { 
        accountId,
        error: (error as Error).message 
      });
      
      throw error;
    }
  }

  /**
   * 恢复Facebook会话
   */
  async restoreFacebookSession(sessionId: string): Promise<{
    sessionData: any;
    vpnConnectionId: string;
    containerId: string;
  }> {
    this.validateInitialized();

    const logger = this.logger.child(`restore:${sessionId}`);
    const startTime = Date.now();

    try {
      logger.info('Restoring Facebook session');

      // 1. 恢复加密会话
      logger.debug('Step 1: Restoring encrypted session');
      const sessionData = await this.sessionManager!.restoreSession(sessionId);
      
      // 2. 获取账号信息
      const accountId = sessionData.accountId;
      
      // 3. 获取VPN连接
      logger.debug('Step 2: Acquiring VPN connection');
      const vpnConnection = await this.acquireVPNConnection(accountId);
      
      // 4. 创建Docker容器
      logger.debug('Step 3: Creating Docker container');
      const containerId = await this.createFacebookContainer(accountId, vpnConnection.id);
      
      // 5. 恢复会话到容器
      logger.debug('Step 4: Restoring session to container');
      await this.restoreSessionToContainer(containerId, sessionData);
      
      // 6. 验证会话状态
      logger.debug('Step 5: Verifying session status');
      const isValid = await this.verifySessionStatus(containerId);
      
      if (!isValid) {
        throw new Error('Session validation failed');
      }

      const duration = Date.now() - startTime;
      logger.info('Facebook session restored successfully', {
        sessionId,
        accountId,
        vpnConnectionId: vpnConnection.id,
        containerId,
        duration: `${duration}ms`
      });

      // 记录指标
      this.recordMetric('session_restore_success', 1, { accountId, sessionId });
      this.recordMetric('session_restore_duration', duration, { accountId, sessionId });

      return {
        sessionData,
        vpnConnectionId: vpnConnection.id,
        containerId
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to restore Facebook session', error as Error, { duration });
      
      // 记录失败指标
      this.recordMetric('session_restore_failure', 1, { 
        sessionId,
        error: (error as Error).message 
      });
      
      throw error;
    }
  }

  /**
   * 执行健康检查
   */
  async performAccountHealthCheck(accountId: string): Promise<any> {
    this.validateInitialized();

    const logger = this.logger.child(`health:${accountId}`);

    try {
      logger.info('Performing account health check');
      
      const result = await this.healthChecker!.performHealthCheck(accountId);
      
      // 记录健康检查结果
      this.recordMetric('health_check_score', result.riskScore, { 
        accountId,
        status: result.overallStatus,
        riskLevel: result.riskLevel
      });
      
      // 如果状态不佳，触发警报
      if (result.overallStatus === 'critical' || result.riskLevel === 'critical') {
        await this.monitoringManager!.triggerAlert('account-health-critical', {
          accountId,
          riskScore: result.riskScore,
          status: result.overallStatus,
          failedChecks: result.checks.filter(c => c.status === 'failed').length,
          recommendations: result.recommendations
        });
      }
      
      logger.info('Account health check completed', {
        accountId,
        status: result.overallStatus,
        riskScore: Math.round(result.riskScore),
        riskLevel: result.riskLevel
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to perform account health check', error as Error);
      throw error;
    }
  }

  /**
   * 轮换IP地址
   */
  async rotateIPAddress(sessionId: string, reason?: string): Promise<{
    success: boolean;
    newIP?: string;
    newLocation?: string;
  }> {
    this.validateInitialized();

    const logger = this.logger.child(`rotate:${sessionId}`);

    try {
      logger.info('Rotating IP address', { reason });
      
      const result = await this.vpnManager!.rotateIP(sessionId, reason);
      
      if (result.success) {
        logger.info('IP rotation successful', {
          from: result.fromConnectionId,
          to: result.toConnectionId,
          newIP: result.ipAddress,
          location: result.location?.country
        });
        
        // 记录指标
        this.recordMetric('ip_rotation_success', 1, { sessionId, reason });
        
        return {
          success: true,
          newIP: result.ipAddress,
          newLocation: result.location?.country
        };
      } else {
        logger.warn('IP rotation failed', { error: result.error });
        
        // 记录指标
        this.recordMetric('ip_rotation_failure', 1, { 
          sessionId, 
          reason,
          error: result.error 
        });
        
        return {
          success: false
        };
      }
    } catch (error) {
      logger.error('IP rotation failed with exception', error as Error);
      
      // 记录指标
      this.recordMetric('ip_rotation_exception', 1, { 
        sessionId, 
        reason,
        error: (error as Error).message 
      });
      
      throw error;
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<{
    modules: Record<string, boolean>;
    stats: Record<string, any>;
    health: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    this.validateInitialized();

    try {
      const moduleStatus = {
        sessionManager: !!this.sessionManager,
        vpnManager: !!this.vpnManager,
        healthChecker: !!this.healthChecker,
        monitoringManager: !!this.monitoringManager
      };

      // 收集各个模块的统计信息
      const stats = {
        sessions: await this.getSessionStats(),
        vpn: await this.getVPNStats(),
        health: await this.getHealthStats(),
        monitoring: await this.getMonitoringStats()
      };

      // 确定整体健康状态
      let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      // 检查关键指标
      const criticalAlerts = stats.monitoring.criticalAlerts || 0;
      const failedSessions = stats.sessions.failedSessions || 0;
      const vpnFailures = stats.vpn.failedConnections || 0;
      
      if (criticalAlerts > 0 || failedSessions > 10 || vpnFailures > 5) {
        health = 'unhealthy';
      } else if (criticalAlerts === 0 && (failedSessions > 0 || vpnFailures > 0)) {
        health = 'degraded';
      }

      this.logger.debug('System status retrieved', { health });

      return {
        modules: moduleStatus,
        stats,
        health
      };
    } catch (error) {
      this.logger.error('Failed to get system status', error as Error);
      throw error;
    }
  }

  /**
   * 销毁集成
   */
  async destroy(): Promise<void> {
    this.logger.info('Destroying Phase 2.2 Integration');

    const destroyPromises = [
      this.sessionManager?.destroy(),
      this.vpnManager?.destroy(),
      this.healthChecker?.destroy(),
      this.monitoringManager?.destroy()
    ].filter(Boolean) as Promise<void>[];

    try {
      await Promise.allSettled(destroyPromises);
      this.isInitialized = false;
      this.logger.info('Phase 2.2 Integration destroyed');
    } catch (error) {
      this.logger.error('Error during destruction', error as Error);
      throw error;
    }
  }

  /**
   * 私有方法
   */

  private validateInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Phase 2.2 Integration not initialized. Call initialize() first.');
    }
  }

  private validateEnvironment(): void {
    const errors: string[] = [];

    // 检查必要的环境变量
    const requiredVars = [
      'SESSION_ENCRYPTION_KEY',
      'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'
    ];

    for (const envVar of requiredVars) {
      if (!process.env[envVar]) {
        errors.push(`Missing required environment variable: ${envVar}`);
      }
    }

    // 检查Docker可用性
    try {
      require('child_process').execSync('docker --version', { stdio: 'ignore' });
    } catch {
      errors.push('Docker is not available or not in PATH');
    }

    if (errors.length > 0) {
      throw new Error(`Environment validation failed:\\n${errors.join('\\n')}`);
    }

    this.logger.info('Environment validation passed');
  }

  private async initializeSessionManager(): Promise<void> {
    const sessionConfig = this.configManager.getSessionConfig();
    
    this.sessionManager = new SessionManager({
      encryption: sessionConfig.encryption,
      database: this.configManager.getDatabaseConfig(),
      cleanupInterval: sessionConfig.cleanupInterval,
      maxIdleTime: sessionConfig.maxIdleTime,
      sessionTtl: sessionConfig.sessionTtl
    });

    await this.sessionManager.initialize();
    this.logger.info('Session Manager initialized');
  }

  private async initializeVPNManager(): Promise<void> {
    const vpnConfig = this.configManager.getVPNConfig();
    
    // 这里需要从配置或数据库加载VPN配置
    const vpnConfigs = []; // 实际应从配置加载
    
    this.vpnManager = new VPMManager({
      vpnConfigs,
      ipRotation: {
        rotationStrategy: vpnConfig.rotationStrategy,
        minRotationInterval: vpnConfig.minRotationInterval,
        maxSessionsPerIP: vpnConfig.maxSessionsPerIP,
        geoRestrictions: vpnConfig.geoRestrictions,
        performanceThreshold: vpnConfig.performanceThreshold
      },
      healthCheckInterval: vpnConfig.healthCheckInterval
    });

    await this.vpnManager.initialize();
    this.logger.info('VPN Manager initialized');
  }

  private async initializeHealthChecker(): Promise<void> {
    const healthConfig = this.configManager.getHealthCheckConfig();
    
    this.healthChecker = new HealthChecker({
      checkInterval: healthConfig.checkInterval,
      facebookCheckInterval: healthConfig.facebookCheckInterval,
      riskThresholds: healthConfig.riskThresholds,
      autoFixEnabled: healthConfig.autoFixEnabled,
      notificationEnabled: healthConfig.notificationEnabled,
      checkTypes: healthConfig.checkTypes as any
    });

    await this.healthChecker.initialize();
    this.logger.info('Health Checker initialized');
  }

  private async initializeMonitoringManager(): Promise<void> {
    this.monitoringManager = new MonitoringManager();
    await this.monitoringManager.initialize();
    this.logger.info('Monitoring Manager initialized');
  }

  private async setupModuleIntegration(): Promise<void> {
    // 设置模块间的集成和事件监听
    // 例如：当健康检查失败时触发监控警报
    // 当VPN连接失败时记录指标等
    
    this.logger.info('Module integration setup completed');
  }

  private async acquireVPNConnection(accountId: string): Promise<any> {
    // 这里实现获取VPN连接的逻辑
    // 可以使用VPN管理器的getBestConnection方法
    
    const connection = await this.vpnManager!.getBestConnection({
      excludeCurrent: true,
      ...this.config.vpn.performanceThreshold
    });

    if (!connection) {
      throw new Error('No suitable VPN connection available');
    }

    return connection;
  }

  private async createFacebookContainer(accountId: string, vpnConnectionId: string): Promise<string> {
    // 创建Docker容器并连接到VPN网络
    // 这里需要实现Docker容器创建逻辑
    
    const containerId = `fb-${accountId}-${Date.now()}`;
    
    // 模拟容器创建
    this.logger.debug('Creating Facebook container', { containerId, vpnConnectionId });
    
    // 实际实现应该使用Docker API创建容器
    // 并连接到VPN管理器创建的网络
    
    return containerId;
  }

  private async performFacebookLogin(containerId: string, credentials: any): Promise<any> {
    // 在容器中执行Facebook登录
    // 这里需要调用Phase 2.1的Facebook登录模块
    
    this.logger.debug('Performing Facebook login', { containerId });
    
    // 模拟登录结果
    return {
      sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      cookies: [
        { name: 'c_user', value: '123456789', domain: '.facebook.com' },
        { name: 'xs', value: 'encrypted-token', domain: '.facebook.com' }
      ],
      localStorage: {
        'fb:session': 'encrypted-session-data'
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
  }

  private async restoreSessionToContainer(containerId: string, sessionData: any): Promise<void> {
    // 将恢复的会话数据应用到容器
    this.logger.debug('Restoring session to container', { 
      containerId,
      sessionId: sessionData.sessionId 
    });
    
    // 实际实现应该将cookies和localStorage注入到容器中的浏览器
  }

  private async verifySessionStatus(containerId: string): Promise<boolean> {
    // 验证会话状态是否有效
    this.logger.debug('Verifying session status', { containerId });
    
    // 模拟验证结果
    return Math.random() > 0.1; // 90%成功率
  }

  private async getSessionStats(): Promise<Record<string, any>> {
    if (!this.sessionManager) {
      return {};
    }

    try {
      const overview = await this.sessionManager.getSessionOverview();
      const stats = await this.sessionManager.getSessionStats();
      
      return {
        totalSessions: overview.length,
        activeSessions: overview.filter(s => s.status === 'active').length,
        failedSessions: overview.filter(s => s.status === 'error').length,
        recentStats: stats.slice(0, 5)
      };
    } catch (error) {
      this.logger.error('Failed to get session stats', error as Error);
      return {};
    }
  }

  private async getVPNStats(): Promise<Record<string, any>> {
    if (!this.vpnManager) {
      return {};
    }

    try {
      return this.vpnManager.getStats();
    } catch (error) {
      this.logger.error('Failed to get VPN stats', error as Error);
      return {};
    }
  }

  private async getHealthStats(): Promise<Record<string, any>> {
    if (!this.healthChecker) {
      return {};
    }

    try {
      return await this.healthChecker.getHealthStats();
    } catch (error) {
      this.logger.error('Failed to get health stats', error as Error);
      return {};
    }
  }

  private async getMonitoringStats(): Promise<Record<string, any>> {
    if (!this.monitoringManager) {
      return {};
    }

    try {
      return await this.monitoringManager.getMonitoringStats();
    } catch (error) {
      this.logger.error('Failed to get monitoring stats', error as Error);
      return {};
    }
  }

  private recordStartupMetrics(duration: number): void {
    this.recordMetric('system_startup_duration', duration);
    this.recordMetric('system_startup_success', 1);
    
    this.logger.info('Startup metrics recorded', { duration });
  }

  private recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.monitoringManager) {
      return;
    }

    this.monitoringManager.recordMetric({
      name,
      value,
      tags: tags || {},
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'phase2-integration'
      }
    });
  }

  private async cleanup(): Promise<void> {
    this.logger.info('Cleaning up after initialization failure');
    
    const cleanupPromises = [
      this.sessionManager?.destroy(),
      this.vpnManager?.destroy(),
      this.healthChecker?.destroy(),
      this.monitoringManager?.destroy()
    ].filter(Boolean) as Promise<void>[];

    await Promise.allSettled(cleanupPromises);
    
    this.sessionManager = undefined;
    this.vpnManager = undefined;
    this.healthChecker = undefined;
    this.monitoringManager = undefined;
  }

  /**
   * 从环境变量创建配置
   */
  static createConfigFromEnv() {
    return {
      // 配置参数
    };
  }
}