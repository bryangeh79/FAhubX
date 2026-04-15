import { Client } from 'pg';

export class DatabaseHelper {
  private client: Client;
  private connected: boolean = false;

  constructor() {
    this.client = new Client({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'facebook_bot_test',
      user: process.env.DATABASE_USERNAME || 'test_user',
      password: process.env.DATABASE_PASSWORD || 'test_password',
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      try {
        await this.client.connect();
        this.connected = true;
        console.log('Database connected successfully');
      } catch (error) {
        console.error('Database connection failed:', error);
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.end();
      this.connected = false;
      console.log('Database disconnected');
    }
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const result = await this.client.query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Database query failed:', error);
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<number> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const result = await this.client.query(sql, params);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Database execute failed:', error);
      throw error;
    }
  }

  async beginTransaction(): Promise<void> {
    await this.query('BEGIN');
  }

  async commitTransaction(): Promise<void> {
    await this.query('COMMIT');
  }

  async rollbackTransaction(): Promise<void> {
    await this.query('ROLLBACK');
  }

  async clearTable(tableName: string): Promise<number> {
    return await this.execute(`DELETE FROM ${tableName}`);
  }

  async truncateTable(tableName: string): Promise<void> {
    await this.execute(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
  }

  async resetDatabase(): Promise<void> {
    // 清空所有测试表
    const tables = ['users', 'facebook_accounts', 'tasks', 'task_executions', 'conversation_scripts'];
    
    for (const table of tables) {
      try {
        await this.truncateTable(table);
      } catch (error) {
        console.warn(`Failed to truncate table ${table}:`, error);
      }
    }
  }

  async getUserByEmail(email: string): Promise<any> {
    const users = await this.query('SELECT * FROM users WHERE email = $1', [email]);
    return users[0];
  }

  async createUser(userData: any): Promise<any> {
    const sql = `
      INSERT INTO users (email, password, first_name, last_name, phone, company, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;
    
    const params = [
      userData.email,
      userData.password,
      userData.firstName,
      userData.lastName,
      userData.phone,
      userData.company,
      userData.role || 'USER'
    ];
    
    const result = await this.query(sql, params);
    return result[0];
  }

  async getFacebookAccountByUsername(username: string): Promise<any> {
    const accounts = await this.query('SELECT * FROM facebook_accounts WHERE username = $1', [username]);
    return accounts[0];
  }

  async createFacebookAccount(accountData: any, userId: number): Promise<any> {
    const sql = `
      INSERT INTO facebook_accounts (
        user_id, username, email, password, cookies, status, last_login,
        proxy_type, proxy_host, proxy_port, proxy_username, proxy_password,
        user_agent, notes, tags, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      RETURNING *
    `;
    
    const params = [
      userId,
      accountData.username,
      accountData.email,
      accountData.password,
      accountData.cookies,
      accountData.status || 'ACTIVE',
      accountData.lastLogin ? new Date(accountData.lastLogin) : null,
      accountData.proxyType,
      accountData.proxyHost,
      accountData.proxyPort,
      accountData.proxyUsername,
      accountData.proxyPassword,
      accountData.userAgent,
      accountData.notes,
      JSON.stringify(accountData.tags || [])
    ];
    
    const result = await this.query(sql, params);
    return result[0];
  }

  async getTaskByName(name: string): Promise<any> {
    const tasks = await this.query('SELECT * FROM tasks WHERE name = $1', [name]);
    return tasks[0];
  }

  async createTask(taskData: any, userId: number): Promise<any> {
    const sql = `
      INSERT INTO tasks (
        user_id, name, description, type, schedule, schedule_time, target_url,
        content, accounts, enabled, max_retries, retry_delay, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *
    `;
    
    const params = [
      userId,
      taskData.name,
      taskData.description,
      taskData.type,
      taskData.schedule,
      taskData.scheduleTime ? new Date(taskData.scheduleTime) : null,
      taskData.targetUrl,
      taskData.content,
      JSON.stringify(taskData.accounts || []),
      taskData.enabled !== undefined ? taskData.enabled : true,
      taskData.maxRetries || 3,
      taskData.retryDelay || 60
    ];
    
    const result = await this.query(sql, params);
    return result[0];
  }

  async getTableCount(tableName: string): Promise<number> {
    const result = await this.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result[0].count);
  }

  async isTableEmpty(tableName: string): Promise<boolean> {
    const count = await this.getTableCount(tableName);
    return count === 0;
  }

  async getDatabaseSize(): Promise<string> {
    const result = await this.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    return result[0].size;
  }

  async getActiveConnections(): Promise<number> {
    const result = await this.query(`
      SELECT COUNT(*) as count FROM pg_stat_activity 
      WHERE datname = current_database() AND state = 'active'
    `);
    return parseInt(result[0].count);
  }
}