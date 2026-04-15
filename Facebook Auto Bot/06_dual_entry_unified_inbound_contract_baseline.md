# 双入口统一入站合约基线 - Facebook Auto Bot 项目

## 概述
本文档定义了Facebook Auto Bot项目的双入口统一入站合约基线，确保所有入站请求（用户消息、API调用、系统事件）都通过统一的合约接口处理，实现系统的松耦合、高可用和可扩展。

## 设计原则

### 1. 统一入口原则
- 所有外部请求通过统一的API网关入口
- 所有内部通信通过统一的消息总线
- 所有系统事件通过统一的事件系统

### 2. 合约驱动原则
- 基于合约（Contract）定义接口和行为
- 合约优先于实现
- 合约版本管理和兼容性保证

### 3. 双入口设计原则
- **同步入口**: RESTful API for 实时请求
- **异步入口**: Message Queue for 批量处理
- 双入口共享相同的合约定义
- 根据业务场景自动选择入口

## 合约定义

### 基础合约接口
```typescript
// 基础请求合约
interface BaseRequestContract {
  requestId: string;           // 请求唯一ID
  timestamp: Date;            // 请求时间戳
  source: RequestSource;      // 请求来源
  version: string;            // 合约版本
  metadata: Record<string, any>; // 元数据
}

// 基础响应合约
interface BaseResponseContract {
  requestId: string;          // 对应请求ID
  timestamp: Date;            // 响应时间戳
  status: ResponseStatus;     // 响应状态
  data?: any;                 // 响应数据
  error?: ErrorContract;      // 错误信息
  metadata: Record<string, any>; // 元数据
}

// 错误合约
interface ErrorContract {
  code: string;               // 错误代码
  message: string;            // 错误消息
  details?: any;              // 错误详情
  retryable: boolean;         // 是否可重试
}
```

### 请求来源枚举
```typescript
enum RequestSource {
  WEBHOOK = 'webhook',        // Facebook Webhook
  API = 'api',                // RESTful API
  MESSAGE_QUEUE = 'message_queue', // 消息队列
  INTERNAL_EVENT = 'internal_event', // 内部事件
  SCHEDULED_TASK = 'scheduled_task', // 定时任务
  USER_INTERFACE = 'user_interface', // 用户界面
}
```

### 响应状态枚举
```typescript
enum ResponseStatus {
  SUCCESS = 'success',        // 成功
  PARTIAL_SUCCESS = 'partial_success', // 部分成功
  FAILED = 'failed',          // 失败
  VALIDATION_ERROR = 'validation_error', // 验证错误
  AUTHORIZATION_ERROR = 'authorization_error', // 授权错误
  RATE_LIMIT_ERROR = 'rate_limit_error', // 频率限制错误
  SYSTEM_ERROR = 'system_error', // 系统错误
}
```

## 双入口实现

### 同步入口（RESTful API）
```typescript
// API网关配置
interface ApiGatewayConfig {
  port: number;               // 监听端口
  rateLimit: RateLimitConfig; // 频率限制
  authentication: AuthConfig; // 认证配置
  validation: ValidationConfig; // 验证配置
  logging: LoggingConfig;     // 日志配置
}

// API处理器
class ApiRequestHandler {
  async handleRequest(
    contract: BaseRequestContract,
    context: RequestContext
  ): Promise<BaseResponseContract> {
    // 1. 请求验证和认证
    await this.validateRequest(contract, context);
    
    // 2. 路由到对应的服务处理器
    const handler = this.routeToHandler(contract);
    
    // 3. 执行处理
    const result = await handler.process(contract);
    
    // 4. 构建响应
    return this.buildResponse(contract, result);
  }
}
```

### 异步入口（消息队列）
```typescript
// 消息队列配置
interface MessageQueueConfig {
  type: 'rabbitmq' | 'kafka' | 'redis'; // 队列类型
  connection: ConnectionConfig;         // 连接配置
  queues: QueueConfig[];                // 队列配置
  consumers: ConsumerConfig[];          // 消费者配置
  producers: ProducerConfig[];          // 生产者配置
}

// 消息队列处理器
class MessageQueueHandler {
  async publish(
    contract: BaseRequestContract,
    queue: string
  ): Promise<void> {
    // 1. 序列化合约
    const message = this.serializeContract(contract);
    
    // 2. 发布到队列
    await this.queueClient.publish(queue, message);
    
    // 3. 记录发布日志
    this.logPublish(contract, queue);
  }
  
  async consume(
    queue: string,
    handler: ContractHandler
  ): Promise<void> {
    // 1. 订阅队列
    await this.queueClient.subscribe(queue, async (message) => {
      // 2. 反序列化合约
      const contract = this.deserializeContract(message);
      
      // 3. 执行处理
      const result = await handler.process(contract);
      
      // 4. 确认消息处理
      await this.queueClient.ack(message);
    });
  }
}
```

## 统一入站处理器

### 处理器架构
```typescript
// 统一入站处理器
class UnifiedInboundProcessor {
  private apiHandler: ApiRequestHandler;
  private mqHandler: MessageQueueHandler;
  private contractRegistry: ContractRegistry;
  private serviceRouter: ServiceRouter;
  
  constructor(config: UnifiedProcessorConfig) {
    this.apiHandler = new ApiRequestHandler(config.api);
    this.mqHandler = new MessageQueueHandler(config.mq);
    this.contractRegistry = new ContractRegistry();
    this.serviceRouter = new ServiceRouter();
  }
  
  // 初始化处理器
  async initialize(): Promise<void> {
    // 1. 注册所有合约
    await this.registerContracts();
    
    // 2. 启动API网关
    await this.apiHandler.start();
    
    // 3. 启动消息队列消费者
    await this.mqHandler.startConsumers();
    
    // 4. 启动健康检查
    await this.startHealthChecks();
  }
  
  // 处理API请求
  async handleApiRequest(
    request: HttpRequest,
    response: HttpResponse
  ): Promise<void> {
    try {
      // 1. 解析请求为合约
      const contract = await this.parseApiRequest(request);
      
      // 2. 验证合约
      await this.validateContract(contract);
      
      // 3. 路由到服务
      const service = this.serviceRouter.route(contract);
      
      // 4. 执行服务
      const result = await service.execute(contract);
      
      // 5. 构建响应
      const responseContract = this.buildResponseContract(contract, result);
      
      // 6. 发送响应
      await this.sendApiResponse(response, responseContract);
      
    } catch (error) {
      // 错误处理
      const errorContract = this.buildErrorContract(error);
      await this.sendApiError(response, errorContract);
    }
  }
  
  // 处理消息队列消息
  async handleQueueMessage(
    message: QueueMessage,
    context: MessageContext
  ): Promise<void> {
    try {
      // 1. 解析消息为合约
      const contract = await this.parseQueueMessage(message);
      
      // 2. 验证合约
      await this.validateContract(contract);
      
      // 3. 根据合约类型选择处理策略
      if (this.shouldProcessAsync(contract)) {
        // 异步处理：放入工作队列
        await this.mqHandler.publishToWorkerQueue(contract);
      } else {
        // 同步处理：直接执行
        const service = this.serviceRouter.route(contract);
        await service.execute(contract);
      }
      
      // 4. 确认消息
      await context.ack();
      
    } catch (error) {
      // 错误处理
      this.logQueueError(message, error);
      
      // 根据错误类型决定是否重试
      if (this.shouldRetry(error)) {
        await context.nack({ requeue: true });
      } else {
        await context.nack({ requeue: false });
        await this.sendToDeadLetterQueue(message, error);
      }
    }
  }
}
```

### 合约注册表
```typescript
// 合约注册表
class ContractRegistry {
  private contracts: Map<string, ContractDefinition> = new Map();
  
  // 注册合约
  registerContract(definition: ContractDefinition): void {
    const key = this.generateContractKey(definition);
    if (this.contracts.has(key)) {
      throw new Error(`Contract already registered: ${key}`);
    }
    this.contracts.set(key, definition);
  }
  
  // 获取合约定义
  getContract(type: string, version: string): ContractDefinition {
    const key = `${type}:${version}`;
    const definition = this.contracts.get(key);
    if (!definition) {
      throw new Error(`Contract not found: ${key}`);
    }
    return definition;
  }
  
  // 验证合约
  validateContract(contract: BaseRequestContract): ValidationResult {
    const definition = this.getContract(contract.type, contract.version);
    return definition.validate(contract);
  }
  
  // 合约版本管理
  getLatestVersion(type: string): string {
    const versions = Array.from(this.contracts.keys())
      .filter(key => key.startsWith(`${type}:`))
      .map(key => key.split(':')[1])
      .sort(this.versionComparator);
    
    return versions[versions.length - 1];
  }
}
```

## 业务合约定义

### Facebook消息处理合约
```typescript
// Facebook Webhook消息合约
interface FacebookWebhookContract extends BaseRequestContract {
  type: 'facebook_webhook';
  data: {
    object: 'page' | 'user' | 'permissions';
    entry: FacebookWebhookEntry[];
  };
}

// Facebook消息处理请求合约
interface FacebookMessageRequestContract extends BaseRequestContract {
  type: 'facebook_message_request';
  data: {
    senderId: string;          // 发送者ID
    recipientId: string;       // 接收者ID
    message: FacebookMessage;  // 消息内容
    timestamp: number;         // 消息时间戳
  };
}

// Facebook消息处理响应合约
interface FacebookMessageResponseContract extends BaseResponseContract {
  type: 'facebook_message_response';
  data: {
    messageId: string;         // 消息ID
    recipientId: string;       // 接收者ID
    message: FacebookMessage;  // 回复消息
    timestamp: Date;           // 发送时间戳
    status: 'sent' | 'failed' | 'pending'; // 发送状态
  };
}
```

### 对话处理合约
```typescript
// 对话处理请求合约
interface DialogueProcessRequestContract extends BaseRequestContract {
  type: 'dialogue_process_request';
  data: {
    sessionId: string;         // 会话ID
    userId: string;           // 用户ID
    message: string;          // 用户消息
    context: DialogueContext; // 对话上下文
    metadata: Record<string, any>; // 元数据
  };
}

// 对话处理响应合约
interface DialogueProcessResponseContract extends BaseResponseContract {
  type: 'dialogue_process_response';
  data: {
    sessionId: string;         // 会话ID
    response: string;          // 回复消息
    intent: string;           // 识别意图
    entities: Entity[];       // 提取实体
    confidence: number;       // 置信度
    scriptId?: string;        // 使用的剧本ID
    metadata: Record<string, any>; // 元数据
  };
}
```

### 任务执行合约
```typescript
// 任务执行请求合约
interface TaskExecuteRequestContract extends BaseRequestContract {
  type: 'task_execute_request';
  data: {
    taskId: string;           // 任务ID
    taskType: TaskType;       // 任务类型
    accountId: string;        // 账号ID
    parameters: TaskParameters; // 任务参数
    priority: TaskPriority;   // 任务优先级
    scheduledTime?: Date;     // 计划执行时间
  };
}

// 任务执行响应合约
interface TaskExecuteResponseContract extends BaseResponseContract {
  type: 'task_execute_response';
  data: {
    taskId: string;           // 任务ID
    status: TaskStatus;       // 任务状态
    result?: any;             // 执行结果
    error?: TaskError;        // 错误信息
    executionTime: number;    // 执行时间（毫秒）
    metadata: Record<string, any>; // 元数据
  };
}
```

## 配置管理

### 统一配置
```typescript
// 统一入站处理器配置
interface UnifiedInboundConfig {
  api: ApiGatewayConfig;      // API网关配置
  mq: MessageQueueConfig;     // 消息队列配置
  contracts: ContractConfig[]; // 合约配置
  services: ServiceConfig[];  // 服务配置
  monitoring: MonitoringConfig; // 监控配置
  security: SecurityConfig;   // 安全配置
}

// 环境特定配置
const developmentConfig: UnifiedInboundConfig = {
  api: {
    port: 3000,
    rateLimit: { enabled: false },
    authentication: { enabled: false },
    // ... 其他配置
  },
  mq: {
    type: 'redis',
    connection: { host: 'localhost', port: 6379 },
    // ... 其他配置
  },
  // ... 其他配置
};

const productionConfig: UnifiedInboundConfig = {
  api: {
    port: 443,
    rateLimit: { enabled: true, requestsPerMinute: 1000 },
    authentication: { enabled: true, type: 'jwt' },
    // ... 其他配置
  },
  mq: {
    type: 'rabbitmq',
    connection: { host: 'rabbitmq.production', port: 5672 },
    // ... 其他配置
  },
  // ... 其他配置
};
```

## 监控和日志

### 监控指标
```typescript
// 监控指标定义
interface InboundMetrics {
  // 请求指标
  totalRequests: number;      // 总请求数
  successfulRequests: number; // 成功请求数
  failedRequests: number;     // 失败请求数
  averageResponseTime: number; // 平均响应时间
  
  // 队列指标
  queueSize: number;          // 队列大小
  processingRate: number;     // 处理速率
  backlogSize: number;        // 积压大小
  
  // 系统指标
  memoryUsage: number;        // 内存使用率
  cpuUsage: number;           // CPU使用率
  activeConnections: number;  // 活跃连接数
  
  // 业务指标
  byContractType: Record<string, ContractMetrics>; // 按合约类型统计
  bySource: Record<RequestSource, SourceMetrics>; // 按来源统计
}

// 合约监控
interface ContractMetrics {
  totalCalls: number;         // 总调用次数
  successRate: number;        // 成功率
  averageLatency: number;     // 平均延迟
  errorDistribution: Record<string, number>; // 错误分布
}
```

### 日志记录
```typescript
// 结构化日志
interface InboundLogEntry {
  timestamp: Date;            // 时间戳
  level: LogLevel;           // 日志级别
  requestId: string;         // 请求ID
  contractType: string;      // 合约类型
  source: RequestSource;     // 请求来源
  status: ResponseStatus;    // 响应状态
  duration: number;          // 处理时长（毫秒）
  metadata: Record<string, any>; // 元数据
  error?: ErrorContract;     // 错误信息
}

// 日志配置
interface LoggingConfig {
  level: LogLevel;           // 日志级别
  format: 'json' | 'text';   // 日志格式
  outputs: LogOutput[];      // 输出目标
  retention: RetentionPolicy; // 保留策略
  sampling: SamplingConfig;  // 采样配置
}
```

## 部署和运维

### 部署架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │◄───┤  Load Balancer  │◄───┤     Clients     │
│  (Nginx/Envoy)  │    │   (HAProxy)     │    │  (Web/Mobile)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Unified Inbound │    │  Message Queue  │
│    Processor    │    │  (RabbitMQ)     │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│          Backend Services               │
│  - Auth Service      - Task Service     │
│  - Dialogue Service  - Analytics Service│
└─────────────────────────────────────────┘
```

### 健康检查
```typescript
// 健康检查配置
interface HealthCheckConfig {
  endpoints: HealthCheckEndpoint[]; // 检查端点
  interval: number;                // 检查间隔（毫秒）
  timeout: number;                 // 超时时间（毫秒）
  thresholds: HealthThresholds;    // 健康阈值
}

// 健康检查结果
interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  components: HealthComponent[];
  timestamp: Date;
  details: Record<string, any>;
}

// 健康