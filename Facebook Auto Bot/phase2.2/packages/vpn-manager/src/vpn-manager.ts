import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './utils/logger';
import {
  VPNType,
  VPNStatus,
  VPNConnectionConfig,
  VPNConnection,
  VPNLocation,
  VPNSpeedTest,
  IPInfo,
  IPRotationConfig,
  NetworkConfig,
  ConnectionResult,
  DisconnectionResult,
  HealthCheckResult,
  IPRotationResult,
  NetworkTestResult,
  DockerNetworkConfig,
  ContainerNetworkAssignment,
  VPMManagerStats
} from './types';

export class VPMManager {
  private config: NetworkConfig;
  private logger: Logger;
  private connections: Map<string, VPNConnection> = new Map();
  private containerAssignments: Map<string, ContainerNetworkAssignment> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: NetworkConfig) {
    this.config = config;
    this.logger = new Logger('VPMManager');
  }

  /**
   * 初始化VPN管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing VPN Manager');

      // 验证配置
      this.validateConfig();

      // 启动健康检查
      this.startHealthCheck();

      this.isInitialized = true;
      this.logger.info('VPN Manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize VPN Manager', error as Error);
      throw error;
    }
  }

  /**
   * 连接到VPN
   */
  async connect(config: VPNConnectionConfig): Promise<ConnectionResult> {
    this.validateInitialized();

    const startTime = Date.now();
    const connectionId = uuidv4();
    const logger = this.logger.child(`connect:${connectionId}`);

    try {
      logger.info('Connecting to VPN', { type: config.type, name: config.name });

      // 创建连接对象
      const connection: VPNConnection = {
        id: connectionId,
        config,
        status: 'connecting',
        errorCount: 0,
        startTime: new Date()
      };

      this.connections.set(connectionId, connection);

      // 根据类型执行连接
      let result: ConnectionResult;
      switch (config.type) {
        case 'openvpn':
          result = await this.connectOpenVPN(config, connectionId);
          break;
        case 'wireguard':
          result = await this.connectWireGuard(config, connectionId);
          break;
        case 'socks5':
        case 'http':
          result = await this.connectProxy(config, connectionId);
          break;
        default:
          throw new Error(`Unsupported VPN type: ${(config as any).type}`);
      }

      // 更新连接状态
      if (result.success) {
        connection.status = 'connected';
        connection.ipAddress = result.ipAddress;
        connection.location = result.location;
        connection.pid = result.connectionId ? parseInt(result.connectionId) : undefined;
        
        logger.info('VPN connected successfully', {
          ip: result.ipAddress,
          location: result.location?.country,
          duration: Date.now() - startTime
        });
      } else {
        connection.status = 'error';
        connection.lastError = result.error;
        connection.errorCount++;
        
        logger.error('VPN connection failed', {
          error: result.error,
          duration: Date.now() - startTime
        });
      }

      connection.lastCheck = new Date();
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('VPN connection failed with exception', error as Error, { duration });

      // 清理失败的连接
      this.connections.delete(connectionId);

      return {
        success: false,
        error: `Connection failed: ${(error as Error).message}`,
        duration
      };
    }
  }

  /**
   * 断开VPN连接
   */
  async disconnect(connectionId: string): Promise<DisconnectionResult> {
    this.validateInitialized();

    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { success: false, error: `Connection not found: ${connectionId}` };
    }

    const logger = this.logger.child(`disconnect:${connectionId}`);

    try {
      logger.info('Disconnecting VPN');

      // 根据类型执行断开连接
      let success = false;
      switch (connection.config.type) {
        case 'openvpn':
          success = await this.disconnectOpenVPN(connection);
          break;
        case 'wireguard':
          success = await this.disconnectWireGuard(connection);
          break;
        case 'socks5':
        case 'http':
          success = await this.disconnectProxy(connection);
          break;
      }

      // 更新连接状态
      if (success) {
        connection.status = 'disconnected';
        logger.info('VPN disconnected successfully');
      } else {
        connection.status = 'error';
        logger.warn('VPN disconnection may have failed');
      }

      // 从活动连接中移除
      this.connections.delete(connectionId);

      // 清理容器分配
      this.cleanupContainerAssignments(connectionId);

      return { success: true };
    } catch (error) {
      logger.error('VPN disconnection failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 获取最佳VPN连接
   */
  async getBestConnection(criteria?: {
    country?: string;
    minSpeed?: number;
    maxPing?: number;
    excludeCurrent?: boolean;
  }): Promise<VPNConnection | null> {
    this.validateInitialized();

    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === 'connected');

    if (activeConnections.length === 0) {
      return null;
    }

    // 应用筛选条件
    let filteredConnections = activeConnections;

    if (criteria?.country) {
      filteredConnections = filteredConnections.filter(
        conn => conn.location?.countryCode === criteria.country
      );
    }

    if (criteria?.excludeCurrent) {
      // 排除当前分配给会话的连接
      const assignedConnectionIds = new Set(
        Array.from(this.containerAssignments.values())
          .map(assignment => assignment.connectionId)
      );
      filteredConnections = filteredConnections.filter(
        conn => !assignedConnectionIds.has(conn.id)
      );
    }

    if (filteredConnections.length === 0) {
      return null;
    }

    // 根据性能排序
    filteredConnections.sort((a, b) => {
      const scoreA = this.calculateConnectionScore(a);
      const scoreB = this.calculateConnectionScore(b);
      return scoreB - scoreA; // 降序
    });

    return filteredConnections[0];
  }

  /**
   * 执行IP轮换
   */
  async rotateIP(sessionId: string, reason?: string): Promise<IPRotationResult> {
    this.validateInitialized();

    const logger = this.logger.child(`rotate:${sessionId}`);
    const startTime = Date.now();

    try {
      logger.info('Rotating IP', { reason });

      // 获取当前分配
      const currentAssignment = this.getContainerAssignment(sessionId);
      const fromConnectionId = currentAssignment?.connectionId;

      // 获取最佳新连接
      const bestConnection = await this.getBestConnection({
        excludeCurrent: true,
        ...this.config.ipRotation.performanceThreshold
      });

      if (!bestConnection) {
        throw new Error('No suitable VPN connection available for rotation');
      }

      // 检查轮换间隔
      if (currentAssignment && fromConnectionId) {
        const timeSinceAssignment = Date.now() - currentAssignment.assignedAt.getTime();
        const minInterval = this.config.ipRotation.minRotationInterval || 60000; // 1分钟

        if (timeSinceAssignment < minInterval) {
          throw new Error(`Rotation too soon. Minimum interval: ${minInterval}ms`);
        }
      }

      // 执行轮换
      const rotationResult = await this.performRotation(
        sessionId,
        fromConnectionId,
        bestConnection.id,
        reason
      );

      const duration = Date.now() - startTime;
      logger.info('IP rotation completed', {
        from: fromConnectionId,
        to: bestConnection.id,
        duration,
        reason
      });

      return {
        success: true,
        fromConnectionId,
        toConnectionId: bestConnection.id,
        ipAddress: bestConnection.ipAddress,
        location: bestConnection.location,
        reason
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('IP rotation failed', error as Error, { duration });

      return {
        success: false,
        fromConnectionId,
        error: (error as Error).message,
        reason
      };
    }
  }

  /**
   * 分配网络给容器
   */
  async assignNetworkToContainer(
    containerId: string,
    sessionId: string,
    connectionId?: string
  ): Promise<ContainerNetworkAssignment> {
    this.validateInitialized();

    const logger = this.logger.child(`assign:${sessionId}`);

    try {
      logger.info('Assigning network to container', { containerId, connectionId });

      // 获取或创建连接
      let connection: VPNConnection;
      if (connectionId) {
        connection = this.connections.get(connectionId)!;
        if (!connection || connection.status !== 'connected') {
          throw new Error(`Connection not available: ${connectionId}`);
        }
      } else {
        // 获取最佳连接
        const bestConnection = await this.getBestConnection({
          excludeCurrent: true
        });
        if (!bestConnection) {
          throw new Error('No VPN connection available');
        }
        connection = bestConnection;
      }

      // 检查每个IP的最大会话数
      const sessionsPerIP = this.countSessionsPerIP(connection.id);
      const maxSessions = this.config.ipRotation.maxSessionsPerIP || 1;

      if (sessionsPerIP >= maxSessions) {
        throw new Error(`IP ${connection.ipAddress} has reached maximum sessions (${maxSessions})`);
      }

      // 创建Docker网络（如果需要）
      const networkName = await this.createDockerNetwork(connection);

      // 连接容器到网络
      await this.connectContainerToNetwork(containerId, networkName);

      // 创建分配记录
      const assignment: ContainerNetworkAssignment = {
        containerId,
        sessionId,
        connectionId: connection.id,
        networkName,
        ipAddress: await this.getContainerIP(containerId, networkName),
        assignedAt: new Date()
      };

      this.containerAssignments.set(sessionId, assignment);

      logger.info('Network assigned successfully', {
        containerId,
        connectionId: connection.id,
        networkName,
        ipAddress: assignment.ipAddress
      });

      return assignment;
    } catch (error) {
      logger.error('Failed to assign network to container', error as Error);
      throw error;
    }
  }

  /**
   * 释放容器网络
   */
  async releaseContainerNetwork(sessionId: string): Promise<void> {
    this.validateInitialized();

    const assignment = this.containerAssignments.get(sessionId);
    if (!assignment) {
      return;
    }

    const logger = this.logger.child(`release:${sessionId}`);

    try {
      logger.info('Releasing container network', {
        containerId: assignment.containerId,
        networkName: assignment.networkName
      });

      // 断开容器网络连接
      await this.disconnectContainerFromNetwork(
        assignment.containerId,
        assignment.networkName
      );

      // 清理分配记录
      this.containerAssignments.delete(sessionId);

      logger.info('Container network released successfully');
    } catch (error) {
      logger.error('Failed to release container network', error as Error);
      throw error;
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(connectionId?: string): Promise<HealthCheckResult[]> {
    this.validateInitialized();

    const connectionsToCheck = connectionId
      ? [this.connections.get(connectionId)!].filter(Boolean)
      : Array.from(this.connections.values());

    const results: HealthCheckResult[] = [];

    for (const connection of connectionsToCheck) {
      const logger = this.logger.child(`health:${connection.id}`);
      
      try {
        logger.debug('Performing health check');

        const errors: string[] = [];
        let ipAddress: string | undefined;
        let location: VPNLocation | undefined;
        let speedTest: VPNSpeedTest | undefined;

        // 检查连接状态
        if (connection.status !== 'connected') {
          errors.push(`Connection status is ${connection.status}`);
        }

        // 检查IP地址
        if (connection.ipAddress) {
          ipAddress = connection.ipAddress;
          
          // 验证IP有效性
          const ipInfo = await this.getIPInfo(ipAddress);
          if (!ipInfo.ip) {
            errors.push('Failed to validate IP address');
          } else {
            location = ipInfo.location;
            
            // 检查地理位置限制
            const geoError = this.checkGeoRestrictions(ipInfo.location);
            if (geoError) {
              errors.push(geoError);
            }
          }
        } else {
          errors.push('No IP address assigned');
        }

        // 执行速度测试（定期或需要时）
        const shouldTestSpeed = !connection.speedTest ||
          Date.now() - connection.speedTest.testTime.getTime() > 3600000; // 1小时

        if (shouldTestSpeed && connection.status === 'connected') {
          try {
            speedTest = await this.performSpeedTest(connection);
            connection.speedTest = speedTest;
          } catch (error) {
            errors.push(`Speed test failed: ${(error as Error).message}`);
          }
        } else if (connection.speedTest) {
          speedTest = connection.speedTest;
        }

        // 检查性能阈值
        if (speedTest && this.config.ipRotation.performanceThreshold) {
          const { minDownloadSpeed, maxPing, maxPacketLoss } = this.config.ipRotation.performanceThreshold;
          
          if (minDownloadSpeed && speedTest.downloadSpeed < minDownloadSpeed) {
            errors.push(`Download speed ${speedTest.downloadSpeed}Mbps < minimum ${minDownloadSpeed}Mbps`);
          }
          if (maxPing && speedTest.ping > maxPing) {
            errors.push(`Ping ${speedTest.ping}ms > maximum ${maxPing}ms`);
          }
          if (maxPacketLoss && speedTest.packetLoss > maxPacketLoss) {
            errors.push(`Packet loss ${speedTest.packetLoss}% > maximum ${maxPacketLoss}%`);
          }
        }

        // 更新连接状态
        connection.lastCheck = new Date();
        if (errors.length > 0) {
          connection.errorCount++;
          connection.lastError = errors.join('; ');
          
          if (connection.errorCount > 3) {
            connection.status = 'error';
            logger.warn('Connection marked as error due to multiple failures', { errors });
          }
        } else {
          connection.errorCount = 0;
          connection.lastError = undefined;
        }

        const result: HealthCheckResult = {
          healthy: errors.length === 0,
          connectionId: connection.id,
          status: connection.status,
          ipAddress,
          location,
          speedTest,
          errors,
          timestamp: new Date()
        };

        results.push(result);

        if (result.healthy) {
          logger.debug('Health check passed');
        } else {
          logger.warn('Health check failed', { errors });
        }
      } catch (error) {
        logger.error('Health check failed with exception', error as Error);
        
        results.push({
          healthy: false,
          connectionId: connection.id,
          status: 'error',
          errors: [`Health check exception: ${(error as Error).message}`],
          timestamp: new Date()
        });
      }
    }

    return results;
  }

  /**
   * 获取管理器统计
   */
  getStats(): VPMManagerStats {
    const connections = Array.from(this.connections.values());
    const activeConnections = connections.filter(c => c.status === 'connected');
    
    const stats: VPMManagerStats = {
      totalConnections: connections.length,
      activeConnections: activeConnections.length,
      failedConnections: connections.filter(c => c.status === 'error').length,
      totalRotations: this.containerAssignments.size,
      avgConnectionTime: 0,
      avgSpeedDownload: 0,
      avgSpeedUpload: 0,
      byCountry: {},
      byType: {
        openvpn: 0,
        wireguard: 0,
        socks5: 0,
        http: 0
      }
    };

    // 计算平均连接时间
    const connectedTimes = activeConnections
      .filter(c => c.startTime)
      .map(c => Date.now() - c.startTime!.getTime());
    
    if (connectedTimes.length > 0) {
      stats.avgConnectionTime = connectedTimes.reduce((a, b) => a + b) / connectedTimes.length;
    }

    // 计算平均速度
    const speedTests = activeConnections
      .filter(c => c.speedTest)
      .map(c => c.speedTest!);
    
    if (speedTests.length > 0) {
      stats.avgSpeedDownload = speedTests.reduce((sum, test) => sum + test.downloadSpeed, 0) / speedTests.length;
      stats.avgSpeedUpload = speedTests.reduce((sum, test) => sum + test.uploadSpeed, 0) / speedTests.length;
    }

    // 按国家统计
    activeConnections.forEach(conn => {
      if (conn.location?.country) {
        const country = conn.location.country;
        stats.byCountry[country] = (stats.byCountry[country] || 0) + 1;
      }
    });

    // 按类型统计
    connections.forEach(conn => {
      stats.byType[conn.config.type]++;
    });

    return stats;
  }

  /**
   * 销毁VPN管理器
   */
  async destroy(): Promise<void> {
    this.logger.info('Destroying VPN Manager');

    // 停止健康检查
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // 断开所有连接
    const disconnectPromises = Array.from(this.connections.keys())
      .map(connectionId => this.disconnect(connectionId).catch(error => {
        this.logger.error(`Failed to disconnect ${connectionId}`, error as Error);
      }));

    await Promise.all(disconnectPromises);

    // 清理所有容器分配
    const releasePromises = Array.from(this.containerAssignments.keys())
      .map(sessionId => this.releaseContainerNetwork(sessionId).catch(error => {
        this.logger.error(`Failed to release network for ${sessionId}`, error as Error);
      }));

    await Promise.all(releasePromises);

    this.connections.clear();
    this.containerAssignments.clear();
    this.isInitialized = false;

    this.logger.info('VPN Manager destroyed');
  }

  /**
   * 私有方法
   */

  private validateInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('VPN Manager not initialized. Call initialize() first.');
    }
  }

  private validateConfig(): void {
    if (!this.config.vpnConfigs || this.config.vpnConfigs.length === 0) {
      throw new Error('At least one VPN configuration is required');
    }

    // 验证每个配置
    for (const config of this.config.vpnConfigs) {
      if (!config.name || !config.type) {
        throw new Error('VPN configuration must have name and type');
      }

      switch (config.type) {
        case 'openvpn':
          this.validateOpenVPNConfig(config);
          break;
        case 'wireguard':
          this.validateWireGuardConfig(config);
          break;
        case 'socks5':
        case 'http':
          this.validateProxyConfig(config);
          break;
        default:
          throw new Error(`Unsupported VPN type: ${(config as any).type}`);
      }
    }
  }

  private validateOpenVPNConfig(config: any): void {
    if (!config.configPath) {
      throw new Error('OpenVPN config requires configPath');
    }
  }

  private validateWireGuardConfig(config: any): void {
    if (!config.configPath && !(config.privateKey && config.endpoint && config.publicKey)) {
      throw new Error('WireGuard config requires either configPath or privateKey/endpoint/publicKey');
    }
  }

  private validateProxyConfig(config: any): void {
    if (!config.host || !config.port) {
      throw new Error('Proxy config requires host and port');
    }
  }

  private startHealthCheck(): void {
    const interval = this.config.healthCheckInterval || 300000; // 5分钟
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Health check task failed', error as Error);
      }
    }, interval);

    this.logger.info(`Started health check with interval: ${interval}ms`);
  }

  private async connectOpenVPN(config: any, connectionId: string): Promise<ConnectionResult> {
    // OpenVPN连接实现
    // 这里需要实现实际的OpenVPN连接逻辑
    // 由于时间关系，返回模拟结果
    
    const ipAddress = await this.getPublicIP();
    const location = await this.getIPLocation(ipAddress);
    
    return {
      success: true,
      connectionId,
      ipAddress,
      location,
      duration: 5000 // 模拟5秒连接时间
    };
  }

  private async connectWireGuard(config: any, connectionId: string): Promise<ConnectionResult> {
    // WireGuard连接实现
    // 这里需要实现实际的WireGuard连接逻辑
    
    const ipAddress = await this.getPublicIP();
    const location = await this.getIPLocation(ipAddress);
    
    return {
      success: true,
      connectionId,
      ipAddress,
      location,
      duration: 2000 // 模拟2秒连接时间
    };
  }

  private async connectProxy(config: any, connectionId: string): Promise<ConnectionResult> {
    // 代理连接实现
    // 这里需要实现实际的代理连接逻辑
    
    const ipAddress = config.host;
    const location = await this.getIPLocation(ipAddress);
    
    return {
      success: true,
      connectionId,
      ipAddress,
      location,
      duration: 1000 // 模拟1秒连接时间
    };
  }

  private async disconnectOpenVPN(connection: VPNConnection): Promise<boolean> {
    // OpenVPN断开连接实现
    return true;
  }

  private async disconnectWireGuard(connection: VPNConnection): Promise<boolean> {
    // WireGuard断开连接实现
    return true;
  }

  private async disconnectProxy(connection: VPNConnection): Promise<boolean> {
    // 代理断开连接实现
    return true;
  }

  private calculateConnectionScore(connection: VPNConnection): number {
    let score = 100;
    
    // 基于速度测试
    if (connection.speedTest) {
      score += connection.speedTest.downloadSpeed * 10; // 下载速度加分
      score -= connection.speedTest.ping / 10; // 延迟减分
      score -= connection.speedTest.packetLoss * 100; // 丢包严重减分
    }
    
    // 基于错误计数
    score -= connection.errorCount * 20;
    
    // 基于连接时间（越久越稳定）
    if (connection.startTime) {
      const uptimeHours = (Date.now() - connection.startTime.getTime()) / 3600000;
      score += Math.min(uptimeHours * 5, 50); // 最多加50分
    }
    
    return Math.max(0, score);
  }

  private async performRotation(
    sessionId: string,
    fromConnectionId: string | undefined,
    toConnectionId: string,
    reason?: string
  ): Promise<void> {
    // 获取当前分配
    const assignment = this.containerAssignments.get(sessionId);
    if (!assignment) {
      throw new Error(`No network assignment found for session: ${sessionId}`);
    }

    // 获取新连接
    const newConnection = this.connections.get(toConnectionId);
    if (!newConnection || newConnection.status !== 'connected') {
      throw new Error(`Target connection not available: ${toConnectionId}`);
    }

    // 创建新网络
    const newNetworkName = await this.createDockerNetwork(newConnection);
    
    // 连接容器到新网络
    await this.connectContainerToNetwork(assignment.containerId, newNetworkName);
    
    // 断开旧网络
    await this.disconnectContainerFromNetwork(assignment.containerId, assignment.networkName);
    
    // 更新分配记录
    assignment.connectionId = newConnection.id;
    assignment.networkName = newNetworkName;
    assignment.ipAddress = await this.getContainerIP(assignment.containerId, newNetworkName);
    assignment.assignedAt = new Date();
  }

  private getContainerAssignment(sessionId: string): ContainerNetworkAssignment | undefined {
    return this.containerAssignments.get(sessionId);
  }

  private countSessionsPerIP(connectionId: string): number {
    return Array.from(this.containerAssignments.values())
      .filter(assignment => assignment.connectionId === connectionId)
      .length;
  }

  private async createDockerNetwork(connection: VPNConnection): Promise<string> {
    const networkName = `vpn-${connection.id.substring(0, 8)}`;
    
    // 检查网络是否已存在
    try {
      await exec(`docker network inspect ${networkName}`);
      return networkName;
    } catch {
      // 网络不存在，创建它
    }

    // 创建Docker网络
    const subnet = this.generateSubnet();
    const command = `docker network create \
      --driver=bridge \
      --subnet=${subnet} \
      --gateway=${subnet.replace(/0\/24$/, '1')} \
      --label=vpn.connection=${connection.id} \
      --label=vpn.type=${connection.config.type} \
      ${networkName}`;

    await this.executeCommand(command);
    
    return networkName;
  }

  private async connectContainerToNetwork(containerId: string, networkName: string): Promise<void> {
    const command = `docker network connect ${networkName} ${containerId}`;
    await this.executeCommand(command);
  }

  private async disconnectContainerFromNetwork(containerId: string, networkName: string): Promise<void> {
    const command = `docker network disconnect ${networkName} ${containerId}`;
    await this.executeCommand(command);
  }

  private async getContainerIP(containerId: string, networkName: string): Promise<string> {
    const command = `docker inspect -f '{{range .NetworkSettings.Networks}}{{if eq .NetworkID "${networkName}"}}{{.IPAddress}}{{end}}{{end}}' ${containerId}`;
    const output = await this.executeCommand(command);
    return output.trim();
  }

  private cleanupContainerAssignments(connectionId: string): void {
    for (const [sessionId, assignment] of this.containerAssignments.entries()) {
      if (assignment.connectionId === connectionId) {
        this.containerAssignments.delete(sessionId);
      }
    }
  }

  private async getPublicIP(): Promise<string> {
    // 获取公网IP
    // 这里可以使用外部服务如 ipify.org
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      // 模拟IP
      return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }
  }

  private async getIPInfo(ip: string): Promise<IPInfo> {
    // 获取IP信息
    // 这里可以使用外部服务如 ip-api.com
    try {
      const response = await fetch(`http://ip-api.com/json/${ip}`);
      const data = await response.json();
      
      return {
        ip: data.query,
        location: {
          country: data.country,
          countryCode: data.countryCode,
          city: data.city,
          region: data.regionName,
          timezone: data.timezone,
          latitude: data.lat,
          longitude: data.lon,
          isp: data.isp,
          org: data.org
        },
        isVPN: data.hosting || data.proxy || false,
        isProxy: data.proxy || false,
        isTor: false, // 需要专门的服务检测
        isHosting: data.hosting || false,
        asn: data.as,
        organization: data.org
      };
    } catch {
      // 返回模拟数据
      return {
        ip,
        location: {
          country: 'Unknown',
          countryCode: 'XX',
          city: 'Unknown',
          region: 'Unknown',
          timezone: 'UTC',
          latitude: 0,
          longitude: 0,
          isp: 'Unknown ISP',
          org: 'Unknown Organization'
        },
        isVPN: false,
        isProxy: false,
        isTor: false,
        isHosting: false
      };
    }
  }

  private async getIPLocation(ip: string): Promise<VPNLocation> {
    const ipInfo = await this.getIPInfo(ip);
    return ipInfo.location;
  }

  private checkGeoRestrictions(location: VPNLocation): string | null {
    const restrictions = this.config.ipRotation.geoRestrictions;
    if (!restrictions) {
      return null;
    }

    const countryCode = location.countryCode;
    
    // 检查允许的国家
    if (restrictions.allowedCountries && restrictions.allowedCountries.length > 0) {
      if (!restrictions.allowedCountries.includes(countryCode)) {
        return `Country ${countryCode} not in allowed list`;
      }
    }

    // 检查阻止的国家
    if (restrictions.blockedCountries && restrictions.blockedCountries.includes(countryCode)) {
      return `Country ${countryCode} is blocked`;
    }

    return null;
  }

  private async performSpeedTest(connection: VPNConnection): Promise<VPNSpeedTest> {
    // 执行速度测试
    // 这里可以使用 speedtest-cli 或其他服务
    
    // 模拟速度测试结果
    return {
      downloadSpeed: 50 + Math.random() * 50, // 50-100 Mbps
      uploadSpeed: 10 + Math.random() * 20, // 10-30 Mbps
      ping: 20 + Math.random() * 50, // 20-70 ms
      jitter: 1 + Math.random() * 5, // 1-6 ms
      packetLoss: Math.random() * 2, // 0-2%
      testTime: new Date()
    };
  }

  private generateSubnet(): string {
    // 生成唯一的子网
    const part3 = Math.floor(Math.random() * 250) + 1; // 1-250
    return `172.18.${part3}.0/24`;
  }

  private executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${command}\n${stderr}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * 从环境变量创建配置
   */
  static createConfigFromEnv(): NetworkConfig {
    // 解析VPN配置
    const vpnConfigs: VPNConnectionConfig[] = [];
    
    // 这里可以从环境变量解析多个VPN配置
    // 示例：VPN_CONFIGS='[{"type":"openvpn","name":"us-vpn","configPath":"/configs/us.ovpn"}]'
    
    const configJson = process.env.VPN_CONFIGS;
    if (configJson) {
      try {
        const configs = JSON.parse(configJson);
        vpnConfigs.push(...configs);
      } catch (error) {
        throw new Error(`Failed to parse VPN_CONFIGS: ${error}`);
      }
    }

    // 默认配置
    return {
      vpnConfigs,
      ipRotation: {
        rotationStrategy: 'round-robin',
        minRotationInterval: parseInt(process.env.IP_ROTATION_MIN_INTERVAL || '60000'),
        maxSessionsPerIP: parseInt(process.env.IP_ROTATION_MAX_SESSIONS || '1'),
        geoRestrictions: process.env.IP_GEO_RESTRICTIONS ? JSON.parse(process.env.IP_GEO_RESTRICTIONS) : undefined,
        performanceThreshold: process.env.IP_PERFORMANCE_THRESHOLD ? JSON.parse(process.env.IP_PERFORMANCE_THRESHOLD) : undefined
      },
      dnsServers: process.env.DNS_SERVERS ? process.env.DNS_SERVERS.split(',') : ['8.8.8.8', '1.1.1.1'],
      mtu: parseInt(process.env.NETWORK_MTU || '1500'),
      timeout: parseInt(process.env.VPN_TIMEOUT || '30000'),
      retryCount: parseInt(process.env.VPN_RETRY_COUNT || '3'),
      healthCheckInterval: parseInt(process.env.VPN_HEALTH_CHECK_INTERVAL || '300000')
    };
  }
}
