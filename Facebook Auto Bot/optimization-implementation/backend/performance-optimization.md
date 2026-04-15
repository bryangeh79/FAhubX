# Facebook Auto Bot 后端性能优化方案

## 1. 数据库优化

### 1.1 索引优化
```sql
-- 用户表索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- 账号表索引
CREATE INDEX idx_facebook_accounts_user_id ON facebook_accounts(user_id);
CREATE INDEX idx_facebook_accounts_status ON facebook_accounts(status);
CREATE INDEX idx_facebook_accounts_created_at ON facebook_accounts(created_at);
CREATE INDEX idx_facebook_accounts_health_status ON facebook_accounts(health_status);

-- 任务表索引
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_scheduled_at ON tasks(scheduled_at);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- 任务执行表索引
CREATE INDEX idx_task_executions_task_id ON task_executions(task_id);
CREATE INDEX idx_task_executions_status ON task_executions(status);
CREATE INDEX idx_task_executions_created_at ON task_executions(created_at);
CREATE INDEX idx_task_executions_duration ON task_executions(duration);

-- 复合索引
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_accounts_user_status ON facebook_accounts(user_id, status);
```

### 1.2 查询优化
```typescript
// 优化前
const accounts = await accountRepository.find({
  where: { userId, status: 'active' },
  relations: ['user']
});

// 优化后 - 使用查询构建器，只选择需要的字段
const accounts = await accountRepository
  .createQueryBuilder('account')
  .select([
    'account.id',
    'account.username',
    'account.status',
    'account.lastLoginAt'
  ])
  .leftJoin('account.user', 'user')
  .addSelect(['user.id', 'user.email'])
  .where('account.userId = :userId', { userId })
  .andWhere('account.status = :status', { status: 'active' })
  .orderBy('account.lastLoginAt', 'DESC')
  .limit(50)
  .getMany();
```

### 1.3 连接池优化
```typescript
// TypeORM 配置优化
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // 连接池配置
  poolSize: 20, // 最大连接数
  extra: {
    max: 30, // 最大连接数（包括备用）
    connectionTimeoutMillis: 5000, // 连接超时
    idleTimeoutMillis: 30000, // 空闲连接超时
    maxUses: 7500, // 连接最大使用次数
  },
  
  // 性能优化
  synchronize: false, // 生产环境关闭自动同步
  logging: ['error', 'warn'], // 只记录错误和警告
  maxQueryExecutionTime: 1000, // 查询执行超时时间（ms）
  
  // 缓存配置
  cache: {
    type: 'redis',
    options: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
    },
    duration: 30000, // 缓存时间（ms）
  },
});
```

## 2. API 性能优化

### 2.1 响应压缩
```typescript
// main.ts - 启用压缩
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 启用Gzip压缩
  app.use(compression({
    level: 6, // 压缩级别（1-9）
    threshold: 1024, // 最小压缩大小（字节）
  }));
  
  await app.listen(3000);
}
```

### 2.2 响应缓存
```typescript
// 使用缓存装饰器
import { CacheInterceptor, CacheTTL } from '@nestjs/common';
import { UseInterceptors } from '@nestjs/common';

@Controller('accounts')
@UseInterceptors(CacheInterceptor)
export class AccountController {
  
  @Get()
  @CacheTTL(60) // 缓存60秒
  async getAccounts() {
    return this.accountService.findAll();
  }
  
  @Get(':id')
  @CacheTTL(300) // 缓存5分钟
  async getAccount(@Param('id') id: string) {
    return this.accountService.findById(id);
  }
}

// Redis缓存配置
CacheModule.register({
  store: redisStore,
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  ttl: 60, // 默认缓存时间（秒）
  max: 1000, // 最大缓存项数
});
```

### 2.3 分页优化
```typescript
// 分页服务
@Injectable()
export class PaginationService {
  async paginate<T>(
    repository: Repository<T>,
    page: number = 1,
    limit: number = 20,
    where?: any,
    order?: any,
  ) {
    const skip = (page - 1) * limit;
    
    const [data, total] = await repository.findAndCount({
      where,
      order,
      skip,
      take: limit,
    });
    
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }
}

// 使用游标分页（性能更好）
async function cursorPaginate<T>(
  repository: Repository<T>,
  cursor: string,
  limit: number = 20,
  orderBy: string = 'createdAt',
) {
  const query = repository.createQueryBuilder('entity');
  
  if (cursor) {
    query.where(`entity.${orderBy} < :cursor`, { cursor });
  }
  
  const data = await query
    .orderBy(`entity.${orderBy}`, 'DESC')
    .limit(limit + 1) // 多取一个用于判断是否有下一页
    .getMany();
    
  const hasNextPage = data.length > limit;
  const items = hasNextPage ? data.slice(0, -1) : data;
  const nextCursor = items.length > 0 ? items[items.length - 1][orderBy] : null;
  
  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor,
    },
  };
}
```

## 3. 异步处理优化

### 3.1 Bull队列优化
```typescript
// 队列配置
BullModule.registerQueue({
  name: 'task-queue',
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3, // 重试次数
    backoff: {
      type: 'exponential',
      delay: 1000, // 重试延迟
    },
    removeOnComplete: 100, // 保留最近100个完成的任务
    removeOnFail: 1000, // 保留最近1000个失败的任务
  },
  limiter: {
    max: 100, // 每秒最大任务数
    duration: 1000,
  },
  settings: {
    lockDuration: 30000, // 任务锁定时间
    stalledInterval: 30000, // 检查停滞任务间隔
    maxStalledCount: 1, // 最大停滞次数
  },
});

// 处理器优化
@Processor('task-queue')
export class TaskProcessor {
  private readonly logger = new Logger(TaskProcessor.name);
  
  @Process('execute-task')
  async handleTaskExecution(job: Job) {
    const startTime = Date.now();
    
    try {
      // 处理任务
      const result = await this.executeTask(job.data);
      
      // 记录性能指标
      const duration = Date.now() - startTime;
      this.logger.log(`任务 ${job.id} 执行完成，耗时 ${duration}ms`);
      
      return result;
    } catch (error) {
      this.logger.error(`任务 ${job.id} 执行失败: ${error.message}`);
      throw error;
    }
  }
  
  private async executeTask(data: any) {
    // 任务执行逻辑
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }
}
```

### 3.2 批量操作优化
```typescript
// 批量插入优化
async function batchInsertAccounts(accounts: Account[]) {
  const batchSize = 100; // 每批插入数量
  const batches = [];
  
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);
    batches.push(batch);
  }
  
  // 并行处理批次
  const results = await Promise.all(
    batches.map(batch => 
      this.accountRepository.save(batch, { chunk: batchSize })
    )
  );
  
  return results.flat();
}

// 批量更新优化
async function batchUpdateAccounts(updates: { id: string; data: any }[]) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  
  try {
    for (const update of updates) {
      await queryRunner.manager.update(
        Account,
        { id: update.id },
        update.data
      );
    }
    
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

## 4. 内存管理优化

### 4.1 流式处理
```typescript
// 流式读取大数据集
async function streamLargeDataset() {
  const stream = await this.dataSource
    .createQueryBuilder()
    .select('*')
    .from('large_table', 'lt')
    .stream();
    
  return new Promise((resolve, reject) => {
    const results = [];
    
    stream.on('data', (chunk) => {
      results.push(chunk);
      // 处理每个数据块
      this.processChunk(chunk);
    });
    
    stream.on('end', () => {
      resolve(results);
    });
    
    stream.on('error', (error) => {
      reject(error);
    });
  });
}

// 分块处理
async function processInChunks<T>(
  items: T[],
  chunkSize: number,
  processor: (chunk: T[]) => Promise<void>
) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await processor(chunk);
    
    // 给事件循环机会处理其他任务
    if (i % (chunkSize * 10) === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}
```

### 4.2 内存监控
```typescript
// 内存使用监控
import * as os from 'os';

class MemoryMonitor {
  private readonly logger = new Logger(MemoryMonitor.name);
  private readonly warningThreshold = 0.8; // 80%内存使用警告
  private readonly criticalThreshold = 0.9; // 90%内存使用严重警告
  
  monitorMemory() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercentage = usedMem / totalMem;
    
    if (usagePercentage > this.criticalThreshold) {
      this.logger.error(`内存使用严重: ${(usagePercentage * 100).toFixed(1)}%`);
      // 触发紧急处理
      this.handleMemoryCritical();
    } else if (usagePercentage > this.warningThreshold) {
      this.logger.warn(`内存使用警告: ${(usagePercentage * 100).toFixed(1)}%`);
    }
    
    return {
      total: this.formatBytes(totalMem),
      used: this.formatBytes(usedMem),
      free: this.formatBytes(freeMem),
      usage: usagePercentage,
    };
  }
  
  private handleMemoryCritical() {
    // 清理缓存
    if (global.gc) {
      global.gc();
    }
    
    // 记录堆信息
    const heapUsed = process.memoryUsage().heapUsed;
    this.logger.warn(`堆内存使用: ${this.formatBytes(heapUsed)}`);
  }
  
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
```

## 5. 监控和日志优化

### 5.1 性能监控中间件
```typescript
// 性能监控中间件
@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger('Performance');
  
  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const originalSend = res.send;
    
    // 监控响应时间
    res.send = function(body) {
      const duration = Date.now() - startTime;
      const route = req.route?.path || req.url;
      
      // 记录慢请求
      if (duration > 1000) {
        this.logger.warn(`慢请求: ${req.method} ${route} - ${duration}ms`);
      }
      
      // 记录性能指标
      this.logger.log({
        method: req.method,
        route,
        duration,
        statusCode: res.statusCode,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      });
      
      return originalSend.call(this, body);
    }.bind(this);
    
    next();
  }
}

// 在模块中注册
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PerformanceMiddleware)
      .forRoutes('*');
  }
}
```

### 5.2 结构化日志
```typescript
// Winston配置优化
const winstonConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    // 错误日志单独文件
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
    // 控制台输出（开发环境）
    ...(process.env.NODE_ENV !== 'production'
      ? [new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        })]
      : []),
  ],
};
```

## 6. 部署优化

### 6.1 PM2配置
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'facebook-auto-bot',
    script: 'dist/main.js',
    instances: 'max', // 使用所有CPU核心
    exec_mode: 'cluster', // 集群模式
    max_memory_restart: '1G', // 内存超过1G重启
    env: {
      NODE_ENV: 'production',
    },
    env_production: {
      NODE_ENV: 'production',
    },
    // 日志配置
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // 监控配置
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    // 性能配置
    max_restarts: 10,
    min_uptime: '10s',
    listen_timeout: 5000,
    kill_timeout: 5000,
  }],
};
```

### 6.2 Docker优化
```dockerfile
# 使用多阶段构建
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# 生产镜像
FROM node:18-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# 优化安全设置
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# 非root用户运行
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if(r.statusCode !== 200) throw new Error()})"

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## 7. 测试优化

### 7.1 性能测试
```typescript
// 性能测试套件