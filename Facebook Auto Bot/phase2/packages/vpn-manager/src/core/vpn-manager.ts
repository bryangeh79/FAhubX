      const startTime = Date.now();
      await execAsync('curl -s -o /dev/null https://speedtest.net');
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // 秒
      
      // 假设下载了100KB数据
      const dataSize = 100; // KB
      return dataSize / duration;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 测试上传速度
   */
  private async testUploadSpeed(): Promise<number> {
    // 简化版本
    return 50; // 假设50KB/s
  }

  /**
   * 获取公网IP
   */
  async getPublicIP(connectionId?: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('curl -s https://api.ipify.org');
      return stdout.trim();
    } catch (error) {
      this.logger.error('Failed to get public IP', error as Error);
      return null;
    }
  }

  /**
   * 获取IP详细信息
   */
  async getIPInfo(connectionId?: string): Promise<IPInfo | null> {
    try {
      const { stdout } = await execAsync('curl -s http://ip-api.com/json/');
      const data = JSON.parse(stdout);
      
      return {
        ip: data.query,
        country: data.country,
        countryCode: data.countryCode,
        region: data.region,
        regionName: data.regionName,
        city: data.city,
        zip: data.zip,
        lat: data.lat,
        lon: data.lon,
        timezone: data.timezone,
        isp: data.isp,
        org: data.org,
        as: data.as,
        query: data.query
      };
    } catch (error) {
      this.logger.error('Failed to get IP info', error as Error);
      return null;
    }
  }

  /**
   * 监控所有连接
   */
  private async monitorConnections(): Promise<void> {
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === 'connected');
    
    if (activeConnections.length === 0) return;
    
    for (const connection of activeConnections) {
      try {
        // 测试连接状态
        const metrics = await this.testConnection(connection.id);
        connection.metrics = metrics;
        
        // 更新流量统计（简化版本）
        connection.bytesSent += Math.floor(Math.random() * 1024); // 模拟流量
        connection.bytesReceived += Math.floor(Math.random() * 1024);
        
        // 检查连接健康
        if (metrics.latency > 1000 || metrics.downloadSpeed < 10) {
          this.logger.warn('VPN connection health issue detected', {
            connectionId: connection.id,
            latency: metrics.latency,
            downloadSpeed: metrics.downloadSpeed
          });
        }
      } catch (error) {
        this.logger.error('VPN connection monitoring failed', error as Error, {
          connectionId: connection.id
        });
        
        // 标记连接为错误状态
        connection.status = 'error';
        connection.error = (error as Error).message;
      }
    }
  }

  /**
   * 获取所有VPN配置
   */
  getVPNConfigs(): VPNConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * 获取VPN配置
   */
  getVPNConfig(configId: string): VPNConfig | undefined {
    return this.configs.get(configId);
  }

  /**
   * 删除VPN配置
   */
  async removeVPNConfig(configId: string): Promise<boolean> {
    try {
      const config = this.configs.get(configId);
      if (!config) {
        return false;
      }
      
      // 检查是否有活跃连接使用此配置
      const activeConnections = Array.from(this.connections.values())
        .filter(conn => conn.vpnConfigId === configId && conn.status === 'connected');
      
      if (activeConnections.length > 0) {
        throw new Error(`Cannot remove VPN config with ${activeConnections.length} active connections`);
      }
      
      // 删除配置文件
      const configPath = path.join(this.workDir, 'configs', `${configId}.*`);
      try {
        await execAsync(`rm -f ${configPath}`);
      } catch (error) {
        // 忽略文件删除错误
      }
      
      // 从内存中删除
      this.configs.delete(configId);
      
      this.logger.info('VPN configuration removed', { configId });
      return true;
    } catch (error) {
      this.logger.error('Failed to remove VPN configuration', error as Error, { configId });
      throw error;
    }
  }

  /**
   * 获取所有连接
   */
  getConnections(): VPNConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * 获取连接
   */
  getConnection(connectionId: string): VPNConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * 轮换IP（重新连接）
   */
  async rotateIP(connectionId: string): Promise<VPNConnection> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new Error(`VPN connection not found: ${connectionId}`);
      }
      
      this.logger.info('Rotating IP address', { connectionId });
      
      // 断开当前连接
      await this.disconnect(connectionId);
      
      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 重新连接
      const newConnection = await this.connect(connection.vpnConfigId, {
        sessionId: connection.sessionId,
        timeout: 30000
      });
      
      this.logger.info('IP rotation completed', {
        oldConnectionId: connectionId,
        newConnectionId: newConnection.id,
        oldIP: connection.publicIp,
        newIP: newConnection.publicIp
      });
      
      return newConnection;
    } catch (error) {
      this.logger.error('IP rotation failed', error as Error, { connectionId });
      throw error;
    }
  }

  /**
   * 获取最佳VPN配置（基于性能）
   */
  getBestVPNConfig(): VPNConfig | null {
    const configs = this.getVPNConfigs();
    if (configs.length === 0) return null;
    
    // 简化版本：返回第一个配置
    // 实际实现应该基于性能指标选择
    return configs[0];
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    connections: {
      total: number;
      connected: number;
      error: number;
    };
    message: string;
  }> {
    try {
      const connections = this.getConnections();
      const connected = connections.filter(c => c.status === 'connected').length;
      const error = connections.filter(c => c.status === 'error').length;
      
      // 测试基本网络连接
      const publicIp = await this.getPublicIP();
      const networkHealthy = !!publicIp;
      
      const healthy = networkHealthy && connected > 0;
      
      return {
        healthy,
        connections: {
          total: connections.length,
          connected,
          error
        },
        message: healthy 
          ? `VPN Manager is healthy (${connected} connections active)` 
          : `VPN Manager health check failed: ${!networkHealthy ? 'No network connection' : 'No active VPN connections'}`
      };
    } catch (error) {
      return {
        healthy: false,
        connections: { total: 0, connected: 0, error: 0 },
        message: `VPN Manager health check error: ${(error as Error).message}`
      };
    }
  }

  /**
   * 清理资源
   */
  async destroy(): Promise<void> {
    try {
      // 停止监控
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      
      // 断开所有连接
      const disconnectPromises = Array.from(this.connections.values())
        .filter(conn => conn.status === 'connected')
        .map(conn => this.disconnect(conn.id).catch(error => {
          this.logger.error('Error disconnecting VPN during cleanup', error as Error, {
            connectionId: conn.id
          });
        }));
      
      await Promise.all(disconnectPromises);
      
      // 清理进程
      this.vpnProcesses.forEach(process => {
        try {
          process.kill('SIGTERM');
        } catch (error) {
          // 忽略进程终止错误
        }
      });
      
      this.vpnProcesses.clear();
      this.connections.clear();
      this.configs.clear();
      
      this.logger.info('VPN Manager destroyed');
    } catch (error) {
      this.logger.error('Error destroying VPN Manager', error as Error);
      throw error;
    }
  }
}

/**
 * VPN管理器工厂
 */
export class VPNManagerFactory {
  private static instances: Map<string, VPNManager> = new Map();
  
  /**
   * 创建或获取VPN管理器实例
   */
  static getInstance(
    workDir?: string,
    instanceId: string = 'default'
  ): VPNManager {
    if (!this.instances.has(instanceId)) {
      const instance = new VPNManager(workDir);
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
        console.error('Error destroying VPN Manager instance:', error);
      })
    );
    
    await Promise.all(destroyPromises);
    this.instances.clear();
  }
}