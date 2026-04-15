      // 检查数据库
      const dbHealth = await this.database.healthCheck();
      
      // 检查加密服务（简单测试）
      const encryptionHealthy = (() => {
        try {
          const testData = { test: 'data' };
          const encrypted = this.sessionEncryptor.encryptSessionData({
            cookies: [],
            localStorage: {},
            metadata: testData
          });
          const decrypted = this.sessionEncryptor.decryptSessionData(encrypted);
          return JSON.stringify(decrypted.metadata) === JSON.stringify(testData);
        } catch {
          return false;
        }
      })();
      
      // 检查缓存
      const cacheHealthy = !this.config.cache.enabled || this.sessionCache !== undefined;
      
      const healthy = dbHealth.healthy && encryptionHealthy && cacheHealthy;
      
      return {
        healthy,
        components: {
          database: dbHealth.healthy,
          encryption: encryptionHealthy,
          cache: cacheHealthy
        },
        message: healthy 
          ? 'Session Manager is healthy' 
          : `Health check failed: ${[
              !dbHealth.healthy && 'Database',
              !encryptionHealthy && 'Encryption',
              !cacheHealthy && 'Cache'
            ].filter(Boolean).join(', ')}`
      };
    } catch (error) {
      return {
        healthy: false,
        components: {
          database: false,
          encryption: false,
          cache: false
        },
        message: `Health check error: ${(error as Error).message}`
      };
    }
  }

  /**
   * 导出会话数据（用于备份）
   */
  async exportSession(sessionId: string): Promise<{
    sessionId: string;
    data: any;
    metadata: any;
    exportedAt: string;
  }> {
    try {
      const { sessionData, metadata } = await this.loadBrowserSession(sessionId);
      
      return {
        sessionId,
        data: sessionData,
        metadata,
        exportedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to export session', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * 导入会话数据（从备份恢复）
   */
  async importSession(
    sessionData: {
      sessionId: string;
      data: any;
      metadata: any;
    },
    options?: {
      overwrite?: boolean;
      userId?: string;
    }
  ): Promise<string> {
    try {
      // 检查会话是否已存在
      if (!options?.overwrite) {
        try {
          await this.database.loadSession(sessionData.sessionId);
          throw new Error(`Session ${sessionData.sessionId} already exists. Use overwrite option to replace.`);
        } catch {
          // 会话不存在，可以继续导入
        }
      }

      // 保存到数据库
      const dbId = await this.database.saveSession({
        sessionId: sessionData.sessionId,
        accountId: sessionData.metadata.accountId,
        userId: options?.userId,
        cookies: sessionData.data.cookies,
        localStorage: sessionData.data.localStorage,
        userAgent: sessionData.metadata.userAgent,
        viewport: sessionData.metadata.viewport,
        stealthMode: sessionData.metadata.stealthMode,
        humanBehavior: sessionData.metadata.humanBehavior,
        vpnConfigId: sessionData.metadata.vpnConfigId,
        ipAddress: sessionData.metadata.ipAddress,
        countryCode: sessionData.metadata.countryCode,
        city: sessionData.metadata.city
      });

      this.logger.info('Session imported', {
        sessionId: sessionData.sessionId,
        accountId: sessionData.metadata.accountId,
        dbId
      });

      return dbId;
    } catch (error) {
      this.logger.error('Failed to import session', error as Error, {
        sessionId: sessionData.sessionId
      });
      throw error;
    }
  }

  /**
   * 迁移会话数据（例如升级加密算法时）
   */
  async migrateSession(
    sessionId: string,
    migration: (data: any) => Promise<any>
  ): Promise<boolean> {
    try {
      const { sessionData, metadata } = await this.loadBrowserSession(sessionId);
      
      // 应用迁移函数
      const migratedData = await migration(sessionData);
      
      // 重新保存会话
      await this.database.saveSession({
        sessionId,
        accountId: metadata.accountId,
        userId: metadata.userId,
        cookies: migratedData.cookies,
        localStorage: migratedData.localStorage,
        userAgent: metadata.userAgent,
        viewport: metadata.viewport,
        stealthMode: metadata.stealthMode,
        humanBehavior: metadata.humanBehavior,
        vpnConfigId: metadata.vpnConfigId,
        ipAddress: metadata.ipAddress,
        countryCode: metadata.countryCode,
        city: metadata.city
      });

      this.logger.info('Session migrated', { sessionId });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to migrate session', error as Error, { sessionId });
      return false;
    }
  }

  /**
   * 获取会话审计日志
   */
  async getSessionAuditLog(
    sessionId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<Array<{
    action: string;
    timestamp: Date;
    details: any;
    performedBy?: string;
  }>> {
    // 这里可以实现审计日志查询
    // 实际实现可能需要额外的审计日志表
    
    this.logger.debug('Session audit log requested', { sessionId });
    
    return [
      {
        action: 'loaded',
        timestamp: new Date(),
        details: { source: 'database' },
        performedBy: 'system'
      }
    ];
  }

  /**
   * 清理资源
   */
  async destroy(): Promise<void> {
    try {
      // 停止清理任务
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      if (this.cacheCleanupInterval) {
        clearInterval(this.cacheCleanupInterval);
      }
      
      // 清理缓存
      this.sessionCache.clear();
      
      // 关闭数据库连接
      await this.database.close();
      
      this.logger.info('Session Manager destroyed');
    } catch (error) {
      this.logger.error('Error destroying Session Manager', error as Error);
      throw error;
    }
  }
}

/**
 * 会话管理器工厂
 */
export class SessionManagerFactory {
  private static instances: Map<string, SessionManager> = new Map();
  
  /**
   * 创建或获取会话管理器实例
   */
  static getInstance(
    config: SessionManagerConfig,
    instanceId: string = 'default'
  ): SessionManager {
    if (!this.instances.has(instanceId)) {
      const instance = new SessionManager(config);
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
        console.error('Error destroying Session Manager instance:', error);
      })
    );
    
    await Promise.all(destroyPromises);
    this.instances.clear();
  }
}