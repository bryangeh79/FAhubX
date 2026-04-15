import { Pool, PoolClient, QueryResult } from 'pg';
import { DatabaseConfig } from '../types';
import { Logger } from '../utils/logger';

export class DatabaseClient {
  private pool: Pool;
  private logger: Logger;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.logger = new Logger('DatabaseClient');
    
    // 创建连接池
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeout || 30000,
      connectionTimeoutMillis: 10000,
    });

    // 设置连接池事件监听
    this.setupPoolEventListeners();
  }

  /**
   * 设置连接池事件监听
   */
  private setupPoolEventListeners(): void {
    this.pool.on('connect', (client) => {
      this.logger.debug('New database connection established');
    });

    this.pool.on('acquire', (client) => {
      this.logger.debug('Client acquired from pool');
    });

    this.pool.on('release', (client) => {
      this.logger.debug('Client released back to pool');
    });

    this.pool.on('error', (err, client) => {
      this.logger.error('Unexpected error on idle client', err);
    });
  }

  /**
   * 执行查询
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Executing query', { 
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        params: params ? JSON.stringify(params) : 'none'
      });

      const result = await this.pool.query<T>(text, params);
      
      const duration = Date.now() - startTime;
      this.logger.debug('Query completed', { 
        duration: `${duration}ms`,
        rowCount: result.rowCount
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Query failed', {
        error: (error as Error).message,
        query: text.substring(0, 200),
        params: params ? JSON.stringify(params) : 'none',
        duration: `${duration}ms`
      });
      throw error;
    }
  }

  /**
   * 获取客户端（用于事务）
   */
  async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      this.logger.debug('Client acquired for transaction');
      return client;
    } catch (error) {
      this.logger.error('Failed to acquire client', error as Error);
      throw error;
    }
  }

  /**
   * 执行事务
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      this.logger.debug('Transaction started');

      const result = await callback(client);
      
      await client.query('COMMIT');
      this.logger.debug('Transaction committed');

      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(rollbackError => {
        this.logger.error('Failed to rollback transaction', rollbackError as Error);
      });
      
      this.logger.error('Transaction failed, rolled back', error as Error);
      throw error;
    } finally {
      client.release();
      this.logger.debug('Client released after transaction');
    }
  }

  /**
   * 批量插入
   */
  async batchInsert<T extends Record<string, any>>(
    table: string,
    data: T[],
    conflictStrategy: 'ignore' | 'update' = 'ignore'
  ): Promise<number> {
    if (data.length === 0) {
      return 0;
    }

    const columns = Object.keys(data[0]);
    const placeholders = data.map((_, rowIndex) => 
      `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
    ).join(', ');

    const values = data.flatMap(row => columns.map(col => row[col]));
    const columnList = columns.map(col => `"${col}"`).join(', ');

    let query = `INSERT INTO "${table}" (${columnList}) VALUES ${placeholders}`;
    
    if (conflictStrategy === 'ignore') {
      query += ' ON CONFLICT DO NOTHING';
    } else if (conflictStrategy === 'update') {
      const updateClause = columns
        .filter(col => col !== 'id')
        .map(col => `"${col}" = EXCLUDED."${col}"`)
        .join(', ');
      query += ` ON CONFLICT (id) DO UPDATE SET ${updateClause}`;
    }

    const result = await this.query(query, values);
    return result.rowCount || 0;
  }

  /**
   * 检查数据库连接
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      this.logger.info('Database connection check passed');
      return true;
    } catch (error) {
      this.logger.error('Database connection check failed', error as Error);
      return false;
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getStats(): Promise<{
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
    connectionPool: any;
  }> {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
      connectionPool: {
        max: this.pool.options.max,
        idleTimeoutMillis: this.pool.options.idleTimeoutMillis,
        connectionTimeoutMillis: this.pool.options.connectionTimeoutMillis
      }
    };
  }

  /**
   * 执行迁移
   */
  async runMigration(sql: string): Promise<void> {
    try {
      this.logger.info('Running database migration');
      
      await this.transaction(async (client) => {
        // 分割SQL语句（按分号）
        const statements = sql
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0);

        for (const statement of statements) {
          await client.query(statement);
        }
      });

      this.logger.info('Database migration completed successfully');
    } catch (error) {
      this.logger.error('Database migration failed', error as Error);
      throw error;
    }
  }

  /**
   * 清理连接池
   */
  async close(): Promise<void> {
    try {
      this.logger.info('Closing database connection pool');
      await this.pool.end();
      this.logger.info('Database connection pool closed');
    } catch (error) {
      this.logger.error('Failed to close database connection pool', error as Error);
      throw error;
    }
  }

  /**
   * 从环境变量创建数据库配置
   */
  static createConfigFromEnv(): DatabaseConfig {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'facebook_bot',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000')
    };
  }
}