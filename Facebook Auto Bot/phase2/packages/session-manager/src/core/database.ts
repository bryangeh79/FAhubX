import { Pool, PoolClient, QueryResult } from 'pg';
import { SessionLogger } from '@facebook-bot/puppeteer-executor';
import { EncryptionService, SessionEncryptor } from '../utils/encryption';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface SessionRecord {
  id: string;
  session_id: string;
  account_id: string;
  user_id?: string;
  cookies_encrypted: Buffer;
  localStorage_encrypted?: Buffer;
  session_data_encrypted?: Buffer;
  user_agent?: string;
  viewport_width?: number;
  viewport_height?: number;
  stealth_mode: boolean;
  human_behavior: boolean;
  status: string;
  last_activity: Date;
  error_count: number;
  vpn_config_id?: string;
  ip_address?: string;
  country_code?: string;
  city?: string;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

export class DatabaseService {
  private pool: Pool;
  private logger: SessionLogger;
  private encryptionService: EncryptionService;
  private sessionEncryptor: SessionEncryptor;

  constructor(config: DatabaseConfig, masterKey: string) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.maxConnections,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    this.logger = new SessionLogger('DATABASE');
    this.encryptionService = new EncryptionService(masterKey);
    this.sessionEncryptor = new SessionEncryptor(masterKey);

    // 设置连接池事件监听
    this.pool.on('connect', (client) => {
      this.logger.debug('Database client connected');
    });

    this.pool.on('error', (err) => {
      this.logger.error('Database pool error', err);
    });

    // 测试连接
    this.testConnection();
  }

  /**
   * 测试数据库连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as time');
      client.release();
      
      this.logger.info('Database connection test successful', {
        time: result.rows[0].time
      });
      
      return true;
    } catch (error) {
      this.logger.error('Database connection test failed', error as Error);
      return false;
    }
  }

  /**
   * 获取数据库连接
   */
  async getClient(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      this.logger.error('Failed to get database client', error as Error);
      throw error;
    }
  }

  /**
   * 执行查询
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const startTime = Date.now();
    
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - startTime;
      
      this.logger.debug('Database query executed', {
        query: text,
        params: params || [],
        duration,
        rowCount: result.rowCount
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Database query failed', error as Error, {
        query: text,
        params: params || [],
        duration
      });
      
      throw error;
    }
  }

  /**
   * 使用事务执行操作
   */
  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 保存会话到数据库
   */
  async saveSession(sessionData: {
    sessionId: string;
    accountId: string;
    userId?: string;
    cookies?: any[];
    localStorage?: Record<string, string>;
    userAgent?: string;
    viewport?: { width: number; height: number };
    stealthMode?: boolean;
    humanBehavior?: boolean;
    vpnConfigId?: string;
    ipAddress?: string;
    countryCode?: string;
    city?: string;
  }): Promise<string> {
    return this.withTransaction(async (client) => {
      // 加密会话数据
      const encryptedData = this.sessionEncryptor.encryptSessionData({
        cookies: sessionData.cookies,
        localStorage: sessionData.localStorage,
        metadata: {
          userAgent: sessionData.userAgent,
          viewport: sessionData.viewport
        }
      });

      // 检查会话是否已存在
      const existingSession = await client.query(
        'SELECT id FROM browser_sessions WHERE session_id = $1',
        [sessionData.sessionId]
      );

      if (existingSession.rows.length > 0) {
        // 更新现有会话
        await client.query(
          `UPDATE browser_sessions SET
            cookies_encrypted = $1,
            localStorage_encrypted = $2,
            session_data_encrypted = $3,
            user_agent = $4,
            viewport_width = $5,
            viewport_height = $6,
            stealth_mode = $7,
            human_behavior = $8,
            vpn_config_id = $9,
            ip_address = $10,
            country_code = $11,
            city = $12,
            status = 'active',
            last_activity = CURRENT_TIMESTAMP,
            expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days',
            updated_at = CURRENT_TIMESTAMP
          WHERE session_id = $13
          RETURNING id`,
          [
            Buffer.from(encryptedData.encryptedCookies || '', 'utf8'),
            encryptedData.encryptedLocalStorage 
              ? Buffer.from(encryptedData.encryptedLocalStorage, 'utf8')
              : null,
            Buffer.from(JSON.stringify(encryptedData), 'utf8'),
            sessionData.userAgent,
            sessionData.viewport?.width,
            sessionData.viewport?.height,
            sessionData.stealthMode ?? true,
            sessionData.humanBehavior ?? true,
            sessionData.vpnConfigId,
            sessionData.ipAddress,
            sessionData.countryCode,
            sessionData.city,
            sessionData.sessionId
          ]
        );

        this.logger.info('Session updated in database', {
          sessionId: sessionData.sessionId,
          accountId: sessionData.accountId
        });

        return existingSession.rows[0].id;
      } else {
        // 创建新会话
        const result = await client.query(
          `INSERT INTO browser_sessions (
            session_id, account_id, user_id,
            cookies_encrypted, localStorage_encrypted, session_data_encrypted,
            user_agent, viewport_width, viewport_height,
            stealth_mode, human_behavior,
            vpn_config_id, ip_address, country_code, city,
            status, last_activity, expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING id`,
          [
            sessionData.sessionId,
            sessionData.accountId,
            sessionData.userId,
            Buffer.from(encryptedData.encryptedCookies || '', 'utf8'),
            encryptedData.encryptedLocalStorage 
              ? Buffer.from(encryptedData.encryptedLocalStorage, 'utf8')
              : null,
            Buffer.from(JSON.stringify(encryptedData), 'utf8'),
            sessionData.userAgent,
            sessionData.viewport?.width,
            sessionData.viewport?.height,
            sessionData.stealthMode ?? true,
            sessionData.humanBehavior ?? true,
            sessionData.vpnConfigId,
            sessionData.ipAddress,
            sessionData.countryCode,
            sessionData.city,
            'active',
            new Date(),
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天后过期
          ]
        );

        this.logger.info('Session saved to database', {
          sessionId: sessionData.sessionId,
          accountId: sessionData.accountId,
          sessionDbId: result.rows[0].id
        });

        return result.rows[0].id;
      }
    });
  }

  /**
   * 从数据库加载会话
   */
  async loadSession(sessionId: string): Promise<{
    sessionData: any;
    metadata: {
      accountId: string;
      userId?: string;
      userAgent?: string;
      viewport?: { width: number; height: number };
      stealthMode: boolean;
      humanBehavior: boolean;
      vpnConfigId?: string;
      ipAddress?: string;
      countryCode?: string;
      city?: string;
      status: string;
      lastActivity: Date;
      errorCount: number;
    };
  }> {
    try {
      const result = await this.query(
        `SELECT 
          session_id, account_id, user_id,
          cookies_encrypted, localStorage_encrypted, session_data_encrypted,
          user_agent, viewport_width, viewport_height,
          stealth_mode, human_behavior,
          vpn_config_id, ip_address, country_code, city,
          status, last_activity, error_count, created_at, updated_at, expires_at
        FROM browser_sessions 
        WHERE session_id = $1 AND status != 'expired'`,
        [sessionId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const row = result.rows[0];

      // 解密会话数据
      const encryptedData = JSON.parse(row.session_data_encrypted?.toString() || '{}');
      
      if (!this.sessionEncryptor.verifySessionIntegrity(encryptedData)) {
        throw new Error('Session data integrity check failed');
      }

      const sessionData = this.sessionEncryptor.decryptSessionData(encryptedData);

      // 更新最后活动时间
      await this.query(
        'UPDATE browser_sessions SET last_activity = CURRENT_TIMESTAMP WHERE session_id = $1',
        [sessionId]
      );

      this.logger.info('Session loaded from database', {
        sessionId,
        accountId: row.account_id,
        status: row.status
      });

      return {
        sessionData,
        metadata: {
          accountId: row.account_id,
          userId: row.user_id,
          userAgent: row.user_agent,
          viewport: row.viewport_width && row.viewport_height 
            ? { width: row.viewport_width, height: row.viewport_height }
            : undefined,
          stealthMode: row.stealth_mode,
          humanBehavior: row.human_behavior,
          vpnConfigId: row.vpn_config_id,
          ipAddress: row.ip_address,
          countryCode: row.country_code,
          city: row.city,
          status: row.status,
          lastActivity: row.last_activity,
          errorCount: row.error_count
        }
      };
    } catch (error) {
      this.logger.error('Failed to load session from database', error as Error, {
        sessionId
      });
      throw error;
    }
  }

  /**
   * 更新会话状态
   */
  async updateSessionStatus(
    sessionId: string, 
    status: 'active' | 'inactive' | 'expired' | 'error',
    errorCount?: number
  ): Promise<void> {
    try {
      const updates: string[] = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
      const params: any[] = [sessionId, status];

      if (errorCount !== undefined) {
        updates.push('error_count = $3');
        params.push(errorCount);
      }

      if (status === 'error' && errorCount !== undefined) {
        updates.push('last_activity = CURRENT_TIMESTAMP');
      }

      const query = `
        UPDATE browser_sessions 
        SET ${updates.join(', ')}
        WHERE session_id = $1
      `;

      await this.query(query, params);

      this.logger.info('Session status updated', {
        sessionId,
        status,
        errorCount
      });
    } catch (error) {
      this.logger.error('Failed to update session status', error as Error, {
        sessionId,
        status
      });
      throw error;
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const result = await this.query(
        'DELETE FROM browser_sessions WHERE session_id = $1 RETURNING id',
        [sessionId]
      );

      const deleted = result.rows.length > 0;
      
      if (deleted) {
        this.logger.info('Session deleted from database', { sessionId });
      } else {
        this.logger.warn('Session not found for deletion', { sessionId });
      }

      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete session', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * 获取账号的所有会话
   */
  async getSessionsByAccount(accountId: string): Promise<SessionRecord[]> {
    try {
      const result = await this.query(
        `SELECT * FROM browser_sessions 
         WHERE account_id = $1 AND status != 'expired'
         ORDER BY last_activity DESC`,
        [accountId]
      );

      this.logger.debug('Retrieved sessions for account', {
        accountId,
        count: result.rows.length
      });

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get sessions by account', error as Error, {
        accountId
      });
      throw error;
    }
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.query(
        `UPDATE browser_sessions 
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE expires_at < CURRENT_TIMESTAMP 
            OR (status = 'inactive' AND last_activity < CURRENT_TIMESTAMP - INTERVAL '7 days')
         RETURNING id`
      );

      const cleanedCount = result.rows.length;
      
      if (cleanedCount > 0) {
        this.logger.info('Expired sessions cleaned up', { count: cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions', error as Error);
      throw error;
    }
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    error: number;
    expired: number;
    avgErrorCount: number;
  }> {
    try {
      const result = await this.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as error,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
          AVG(error_count) as avg_error_count
        FROM browser_sessions
      `);

      const row = result.rows[0];
      
      return {
        total: parseInt(row.total) || 0,
        active: parseInt(row.active) || 0,
        inactive: parseInt(row.inactive) || 0,
        error: parseInt(row.error) || 0,
        expired: parseInt(row.expired) || 0,
        avgErrorCount: parseFloat(row.avg_error_count) || 0
      };
    } catch (error) {
      this.logger.error('Failed to get session statistics', error as Error);
      throw error;
    }
  }

  /**
   * 关闭数据库连接池
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      this.logger.info('Database connection pool closed');
    } catch (error) {
      this.logger.error('Failed to close database connection pool', error as Error);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    message: string;
    connections: { total: number; idle: number; waiting: number };
  }> {
    try {
      // 检查连接池状态
      const poolState = this.pool as any;
      const connections = {
        total: poolState.totalCount || 0,
        idle: poolState.idleCount || 0,
        waiting: poolState.waitingCount || 0
      };

      // 执行简单查询测试
      await this.query('SELECT 1 as test');
      
      return {
        healthy: true,
        message: 'Database is healthy',
        connections
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Database health check failed: ${(error as Error).message}`,
        connections: { total: 0, idle: 0, waiting: 0 }
      };
    }
  }
}