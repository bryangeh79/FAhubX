import { 
  SessionData, 
  EncryptedSessionData, 
  SessionStatus, 
  SessionQueryOptions,
  SessionActivity,
  SessionStats,
  SessionManagerConfig,
  SaveSessionOptions,
  RestoreSessionOptions,
  CleanupResult,
  SessionOverview
} from './types';
import { EncryptionService } from './utils/encryption';
import { DatabaseClient } from './database/client';
import { Logger } from './utils/logger';

export class SessionManager {
  private encryptionService: EncryptionService;
  private dbClient: DatabaseClient;
  private logger: Logger;
  private config: SessionManagerConfig;

  private cleanupInterval?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: SessionManagerConfig) {
    this.config = config;
    this.logger = new Logger('SessionManager');
    this.encryptionService = new EncryptionService(config.encryption);
    this.dbClient = new DatabaseClient(config.database);
  }

  /**
   * 初始化SessionManager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing SessionManager');

      // 检查数据库连接
      const isConnected = await this.dbClient.checkConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to database');
      }

      // 启动清理任务
      this.startCleanupTask();

      this.isInitialized = true;
      this.logger.info('SessionManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SessionManager', error as Error);
      throw error;
    }
  }

  /**
   * 保存会话
   */
  async saveSession(
    sessionData: SessionData,
    options: SaveSessionOptions = {}
  ): Promise<EncryptedSessionData> {
    this.validateInitialized();

    const startTime = Date.now();
    const logger = this.logger.child(`save:${sessionData.sessionId}`);

    try {
      logger.info('Saving session');

      // 加密cookies
      const cookiesJson = JSON.stringify(sessionData.cookies);
      const encryptedCookies = this.encryptionService.encrypt(cookiesJson);

      // 加密localStorage（如果有）
      let encryptedLocalStorage: { encrypted: string; iv: string; tag: string } | undefined;
      if (sessionData.localStorage && Object.keys(sessionData.localStorage).length > 0) {
        const localStorageJson = JSON.stringify(sessionData.localStorage);
        encryptedLocalStorage = this.encryptionService.encrypt(localStorageJson);
      }

      // 计算过期时间
      const expiresAt = options.expiresAt || this.calculateExpirationTime();

      // 构建加密的会话数据
      const encryptedSession: Omit<EncryptedSessionData, 'id' | 'createdAt' | 'updatedAt'> = {
        sessionId: sessionData.sessionId,
        accountId: sessionData.accountId,
        encryptedCookies: encryptedCookies.encrypted,
        encryptedLocalStorage: encryptedLocalStorage?.encrypted,
        encryptionIv: encryptedCookies.iv,
        encryptionTag: encryptedCookies.tag,
        userAgent: sessionData.userAgent,
        viewportWidth: sessionData.viewport?.width,
        viewportHeight: sessionData.viewport?.height,
        stealthMode: sessionData.stealthMode,
        humanBehavior: sessionData.humanBehavior,
        status: 'active' as SessionStatus,
        lastActivity: new Date(),
        errorCount: 0,
        expiresAt
      };

      // 保存到数据库
      const result = await this.dbClient.query<EncryptedSessionData>(
        `INSERT INTO sessions (
          session_id, account_id, encrypted_cookies, encrypted_local_storage,
          encryption_iv, encryption_tag, user_agent, viewport_width, viewport_height,
          stealth_mode, human_behavior, status, last_activity, error_count, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          encryptedSession.sessionId,
          encryptedSession.accountId,
          encryptedSession.encryptedCookies,
          encryptedSession.encryptedLocalStorage,
          encryptedSession.encryptionIv,
          encryptedSession.encryptionTag,
          encryptedSession.userAgent,
          encryptedSession.viewportWidth,
          encryptedSession.viewportHeight,
          encryptedSession.stealthMode,
          encryptedSession.humanBehavior,
          encryptedSession.status,
          encryptedSession.lastActivity,
          encryptedSession.errorCount,
          encryptedSession.expiresAt
        ]
      );

      const savedSession = result.rows[0];

      // 记录活动
      await this.logActivity({
        sessionId: sessionData.sessionId,
        accountId: sessionData.accountId,
        activityType: 'save',
        activityData: { metadata: options.metadata },
        durationMs: Date.now() - startTime,
        success: true
      });

      logger.info('Session saved successfully');
      return savedSession;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to save session', error as Error, { duration });

      await this.logActivity({
        sessionId: sessionData.sessionId,
        accountId: sessionData.accountId,
        activityType: 'save',
        activityData: { error: (error as Error).message },
        durationMs: duration,
        success: false,
        errorMessage: (error as Error).message
      });

      throw error;
    }
  }

  /**
   * 恢复会话
   */
  async restoreSession(
    sessionId: string,
    options: RestoreSessionOptions = {}
  ): Promise<SessionData> {
    this.validateInitialized();

    const startTime = Date.now();
    const logger = this.logger.child(`restore:${sessionId}`);

    try {
      logger.info('Restoring session');

      // 从数据库获取会话
      const result = await this.dbClient.query<EncryptedSessionData>(
        `SELECT * FROM sessions 
         WHERE session_id = $1 AND status != 'deleted'
         LIMIT 1`,
        [sessionId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const encryptedSession = result.rows[0];

      // 验证会话状态
      if (encryptedSession.status === 'expired') {
        throw new Error(`Session expired: ${sessionId}`);
      }

      if (encryptedSession.expiresAt && new Date(encryptedSession.expiresAt) < new Date()) {
        // 标记为过期
        await this.markSessionAsExpired(sessionId);
        throw new Error(`Session expired: ${sessionId}`);
      }

      // 解密cookies
      const cookiesJson = this.encryptionService.decrypt(
        encryptedSession.encryptedCookies,
        encryptedSession.encryptionIv,
        encryptedSession.encryptionTag
      );
      const cookies = JSON.parse(cookiesJson);

      // 解密localStorage（如果有）
      let localStorage: Record<string, string> = {};
      if (encryptedSession.encryptedLocalStorage) {
        const localStorageJson = this.encryptionService.decrypt(
          encryptedSession.encryptedLocalStorage,
          encryptedSession.encryptionIv,
          encryptedSession.encryptionTag
        );
        localStorage = JSON.parse(localStorageJson);
      }

      // 构建恢复的会话数据
      const sessionData: SessionData = {
        sessionId: encryptedSession.sessionId,
        accountId: encryptedSession.accountId,
        cookies,
        localStorage,
        userAgent: encryptedSession.userAgent || undefined,
        viewport: encryptedSession.viewportWidth && encryptedSession.viewportHeight
          ? { width: encryptedSession.viewportWidth, height: encryptedSession.viewportHeight }
          : undefined,
        stealthMode: encryptedSession.stealthMode,
        humanBehavior: encryptedSession.humanBehavior
      };

      // 更新最后活动时间
      if (options.updateActivity !== false) {
        await this.updateSessionActivity(sessionId);
      }

      // 记录活动
      await this.logActivity({
        sessionId,
        accountId: encryptedSession.accountId,
        activityType: 'restore',
        durationMs: Date.now() - startTime,
        success: true
      });

      logger.info('Session restored successfully');
      return sessionData;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to restore session', error as Error, { duration });

      await this.logActivity({
        sessionId,
        accountId: 'unknown',
        activityType: 'restore',
        activityData: { error: (error as Error).message },
        durationMs: duration,
        success: false,
        errorMessage: (error as Error).message
      });

      throw error;
    }
  }

  /**
   * 查询会话
   */
  async querySessions(options: SessionQueryOptions = {}): Promise<EncryptedSessionData[]> {
    this.validateInitialized();

    const logger = this.logger.child('query');
    const startTime = Date.now();

    try {
      logger.debug('Querying sessions', { options });

      const conditions: string[] = ['status != $1'];
      const params: any[] = ['deleted'];
      let paramIndex = 2;

      // 构建查询条件
      if (options.accountId) {
        conditions.push(`account_id = $${paramIndex}`);
        params.push(options.accountId);
        paramIndex++;
      }

      if (options.sessionId) {
        conditions.push(`session_id = $${paramIndex}`);
        params.push(options.sessionId);
        paramIndex++;
      }

      if (options.status) {
        conditions.push(`status = $${paramIndex}`);
        params.push(options.status);
        paramIndex++;
      }

      // 构建排序
      const orderBy = options.orderBy || 'lastActivity';
      const orderDirection = options.orderDirection || 'DESC';
      const orderClause = `ORDER BY ${orderBy} ${orderDirection}`;

      // 构建分页
      const limit = options.limit || 100;
      const offset = options.offset || 0;
      const paginationClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      // 执行查询
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT * FROM sessions 
        ${whereClause}
        ${orderClause}
        ${paginationClause}
      `;

      const result = await this.dbClient.query<EncryptedSessionData>(query, params);

      const duration = Date.now() - startTime;
      logger.debug('Sessions query completed', { 
        count: result.rows.length,
        duration: `${duration}ms`
      });

      return result.rows;
    } catch (error) {
      logger.error('Failed to query sessions', error as Error);
      throw error;
    }
  }

  /**
   * 获取会话概览
   */
  async getSessionOverview(): Promise<SessionOverview[]> {
    this.validateInitialized();

    try {
      const result = await this.dbClient.query<SessionOverview>(
        'SELECT * FROM session_overview'
      );
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get session overview', error as Error);
      throw error;
    }
  }

  /**
   * 更新会话状态
   */
  async updateSessionStatus(
    sessionId: string, 
    status: SessionStatus,
    errorCount?: number
  ): Promise<void> {
    this.validateInitialized();

    const logger = this.logger.child(`update:${sessionId}`);

    try {
      logger.info('Updating session status', { status, errorCount });

      const updates: string[] = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
      const params: any[] = [status];
      let paramIndex = 2;

      if (errorCount !== undefined) {
        updates.push(`error_count = $${paramIndex}`);
        params.push(errorCount);
        paramIndex++;
      }

      if (status === 'active') {
        updates.push(`last_activity = CURRENT_TIMESTAMP`);
      }

      const query = `
        UPDATE sessions 
        SET ${updates.join(', ')}
        WHERE session_id = $${paramIndex}
      `;
      params.push(sessionId);

      await this.dbClient.query(query, params);
      logger.info('Session status updated successfully');
    } catch (error) {
      logger.error('Failed to update session status', error as Error);
      throw error;
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string, permanent: boolean = false): Promise<boolean> {
    this.validateInitialized();

    const logger = this.logger.child(`delete:${sessionId}`);

    try {
      logger.info('Deleting session', { permanent });

      if (permanent) {
        // 永久删除
        await this.dbClient.query(
          'DELETE FROM sessions WHERE session_id = $1',
          [sessionId]
        );
      } else {
        // 软删除
        await this.dbClient.query(
          `UPDATE sessions 
           SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
           WHERE session_id = $1`,
          [sessionId]
        );
      }

      logger.info('Session deleted successfully');
      return true;
    } catch (error) {
      logger.error('Failed to delete session', error as Error);
      return false;
    }
  }

  /**
   * 清理会话
   */
  async cleanupSessions(): Promise<CleanupResult> {
    this.validateInitialized();

    const logger = this.logger.child('cleanup');
    const startTime = Date.now();

    try {
      logger.info('Starting session cleanup');

      const result = await this.dbClient.transaction(async (client) => {
        // 标记过期会话
        const expiredResult = await client.query(
          `UPDATE sessions 
           SET status = 'expired', updated_at = CURRENT_TIMESTAMP
           WHERE expires_at IS NOT NULL 
             AND expires_at < CURRENT_TIMESTAMP
             AND status = 'active'
           RETURNING session_id`
        );

        // 删除过期的会话
        const deletedResult = await client.query(
          `DELETE FROM sessions 
           WHERE status = 'expired' 
             AND last_activity < CURRENT_TIMESTAMP - INTERVAL '7 days'
           RETURNING session_id`
        );

        // 标记长时间空闲的会话
        const maxIdleTime = this.config.maxIdleTime || 24 * 60 * 60 * 1000; // 24小时
        const idleResult = await client.query(
          `UPDATE sessions 
           SET status = 'idle', updated_at = CURRENT_TIMESTAMP
           WHERE status = 'active' 
             AND last_activity < CURRENT_TIMESTAMP - INTERVAL '${maxIdleTime} milliseconds'
           RETURNING session_id`
        );

        return {
          expiredCount: expiredResult.rowCount || 0,
          deletedCount: deletedResult.rowCount || 0,
          idleCount: idleResult.rowCount || 0
        };
      });

      const duration = Date.now() - startTime;
      logger.info('Session cleanup completed', { 
        ...result,
        duration: `${duration}ms`
      });

      // 记录清理活动
      await this.logActivity({
        sessionId: 'system',
        accountId: 'system',
        activityType: 'cleanup',
        activityData: result,
        durationMs: duration,
        success: true
      });

      return result;
    } catch (error) {
      logger.error('Session cleanup failed', error as Error);
      throw error;
    }
  }

  /**
   * 获取会话统计
   */
  async getSessionStats(accountId?: string): Promise<SessionStats[]> {
    this.validateInitialized();

    try {
      let query = 'SELECT * FROM session_stats';
      const params: any[] = [];

      if (accountId) {
        query += ' WHERE account_id = $1 ORDER BY stat_date DESC, stat_hour DESC';
        params.push(accountId);
      } else {
        query += ' ORDER BY stat_date DESC, stat_hour DESC LIMIT 100';
      }

      const result = await this.dbClient.query<SessionStats>(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get session stats', error as Error);
      throw error;
    }
  }

  /**
   * 销毁SessionManager
   */
  async destroy(): Promise<void> {
    this.logger.info('Destroying SessionManager');

    // 停止清理任务
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // 关闭数据库连接
    await this.dbClient.close();

    this.isInitialized = false;
    this.logger.info('SessionManager destroyed');
  }

  /**
   * 私有方法
   */

  private validateInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('SessionManager not initialized. Call initialize() first.');
    }
  }

  private calculateExpirationTime(): Date {
    const ttl = this.config.sessionTtl || 7 * 24 * 60 * 60 * 1000; // 7天
    return new Date(Date.now() + ttl);
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await this.dbClient.query(
        `UPDATE sessions 
         SET last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $1`,
        [sessionId]
      );
    } catch (error) {
      this.logger.warn('Failed to update session activity', error as Error);
    }
  }

  private async markSessionAsExpired(sessionId: string): Promise<void> {
    try {
      await this.dbClient.query(
        `UPDATE sessions 
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $1`,
        [sessionId]
      );
    } catch (error) {
      this.logger.warn('Failed to mark session as expired', error as Error);
    }
  }

  private async logActivity(activity: Omit<SessionActivity, 'createdAt'>): Promise<void> {
    try {
      await this.dbClient.query(
        `INSERT INTO session_activities (
          session_id, account_id, activity_type, activity_data,
          duration_ms, success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          activity.sessionId,
          activity.accountId,
          activity.activityType,
          activity.activityData ? JSON.stringify(activity.activityData) : null,
          activity.durationMs,
          activity.success,
          activity.errorMessage
        ]
      );
    } catch (error) {
      this.logger.warn('Failed to log activity', error as Error);
    }
  }

  private startCleanupTask(): void {
    const interval = this.config.cleanupInterval || 60 * 60 * 1000; // 1小时
    
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupSessions();
      } catch (error) {
        this.logger.error('Cleanup task failed', error as Error);
      }
    }, interval);

    this.logger.info(`Started cleanup task with interval: ${interval}ms`);
  }

  /**
   * 从环境变量创建配置
   */
  static createConfigFromEnv(): SessionManagerConfig {
    return {
      encryption: EncryptionService.createConfigFromEnv(),
      database: DatabaseClient.createConfigFromEnv(),
      cleanupInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL || '3600000'),
      maxIdleTime: parseInt(process.env.SESSION_MAX_IDLE_TIME || '86400000'),
      sessionTtl: parseInt(process.env.SESSION_TTL || '604800000')
    };
  }
}