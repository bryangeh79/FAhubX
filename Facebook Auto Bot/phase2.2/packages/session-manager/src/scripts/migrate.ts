import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseClient } from '../database/client';
import { Logger } from '../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = new Logger('Migration');

async function runMigration() {
  try {
    logger.info('Starting database migration');

    // 从环境变量创建数据库配置
    const dbConfig = DatabaseClient.createConfigFromEnv();
    const dbClient = new DatabaseClient(dbConfig);

    // 检查数据库连接
    const isConnected = await dbClient.checkConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }

    // 读取迁移文件
    const migrationPath = join(__dirname, '../../migrations/001_create_sessions_table.sql');
    const migrationSql = readFileSync(migrationPath, 'utf8');

    // 执行迁移
    await dbClient.runMigration(migrationSql);

    logger.info('Database migration completed successfully');
    
    // 关闭数据库连接
    await dbClient.close();
    
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed', error as Error);
    process.exit(1);
  }
}

// 运行迁移
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export { runMigration };