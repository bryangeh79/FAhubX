# 健康检查引擎

健康检查引擎是Facebook账号健康监控系统的核心组件，负责账号健康状态的定期检查、风险评估和问题检测。

## 架构概述

健康检查引擎采用模块化设计，包含三个主要组件：

1. **检查调度器 (HealthCheckScheduler)** - 定时任务调度和优先级管理
2. **检查执行器 (HealthCheckExecutor)** - 多类型检查执行和结果分析
3. **检查项目定义 (CheckItems)** - 具体检查项目的实现

## 快速开始

### 安装依赖

```bash
cd phase2/health/checker
npm install
```

### 基本使用

```typescript
import { HealthCheckEngineManager } from './index';

// 创建引擎管理器
const manager = new HealthCheckEngineManager();

// 创建并启动引擎
const engine = manager.createEngine('my-engine', {
  scheduler: {
    maxConcurrentChecks: 5,
    scheduling: {
      checkInterval: 300000, // 5分钟
      batchSize: 10
    }
  }
});

await manager.startEngine('my-engine');

// 安排检查
engine.scheduler.scheduleCheck({
  accountId: 'account-123',
  checkType: 'login',
  priority: 'high'
});

// 获取状态
const status = manager.getEngineStatus('my-engine');
console.log('引擎状态:', status);

// 停止引擎
await manager.stopEngine('my-engine');
```

## 核心组件

### 1. 检查调度器 (HealthCheckScheduler)

#### 功能特性
- **定时调度**: 定期执行健康检查
- **优先级管理**: 支持低、中、高、关键四个优先级
- **并发控制**: 限制同时运行的检查数量
- **重试机制**: 失败检查自动重试
- **队列管理**: 先进先出，按优先级排序

#### 配置选项
```typescript
interface SchedulerConfig {
  maxConcurrentChecks: number;      // 最大并发检查数
  defaultPriority: 'low' | 'medium' | 'high'; // 默认优先级
  retryPolicy: {
    maxRetries: number;             // 最大重试次数
    retryDelay: number;             // 重试延迟（毫秒）
    exponentialBackoff: boolean;    // 是否指数退避
  };
  scheduling: {
    checkInterval: number;          // 检查间隔（毫秒）
    batchSize: number;              // 批次大小
    maxQueueSize: number;           // 最大队列大小
  };
}
```

### 2. 检查执行器 (HealthCheckExecutor)

#### 支持的检查类型
- **login**: 登录状态检查
- **session**: 会话有效性检查
- **permissions**: 账号权限检查
- **restrictions**: 操作限制检查
- **performance**: 性能指标检查
- **risk**: 风险指标检查
- **network**: 网络状态检查
- **periodic**: 定期综合检查

#### 批量执行
```typescript
// 批量执行检查
const results = await executor.executeBatchChecks(
  ['account-1', 'account-2', 'account-3'],
  'login',
  3 // 并发数
);
```

### 3. 检查项目定义 (CheckItems)

#### 检查项目实现
每个检查项目都包含：
- 检查逻辑实现
- 阈值配置
- 结果评估
- 警告生成

#### 自定义检查
可以通过扩展 `CheckItems` 类来添加自定义检查项目。

## 集成示例

### 与现有系统集成

```typescript
import { HealthCheckEngineManager } from './health/checker';
import { SessionManager } from '../session-manager';
import { VpnManager } from '../vpn-manager';

class HealthMonitoringSystem {
  private engineManager = new HealthCheckEngineManager();
  private sessionManager: SessionManager;
  private vpnManager: VpnManager;
  
  constructor() {
    // 初始化引擎
    this.engineManager.createEngine('main', {
      scheduler: {
        maxConcurrentChecks: 10,
        scheduling: {
          checkInterval: 300000 // 5分钟
        }
      }
    });
    
    // 集成其他模块
    this.sessionManager = new SessionManager();
    this.vpnManager = new VpnManager();
  }
  
  async start() {
    // 启动引擎
    await this.engineManager.startEngine('main');
    
    // 注册账号检查
    await this.registerAccountsForMonitoring();
    
    console.log('健康监控系统已启动');
  }
  
  private async registerAccountsForMonitoring() {
    // 从数据库获取需要监控的账号
    const accounts = await this.getActiveAccounts();
    
    for (const account of accounts) {
      // 安排定期检查
      this.engineManager.getEngine('main').scheduler.scheduleCheck({
        accountId: account.id,
        checkType: 'periodic',
        priority: 'medium',
        data: {
          sessionId: account.sessionId,
          vpnConnectionId: account.vpnConnectionId
        }
      });
    }
  }
}
```

## 监控和告警

### 健康状态监控

```typescript
// 监控引擎健康状态
setInterval(async () => {
  const status = manager.getEngineStatus('main');
  
  if (!status.scheduler.running) {
    console.error('调度器停止运行！');
    // 触发告警
  }
  
  if (status.executor.failedExecutions > 10) {
    console.warn('检查失败率过高！');
    // 触发警告
  }
}, 60000); // 每分钟检查一次
```

### 检查结果分析

```typescript
// 分析检查结果
function analyzeCheckResults(results: HealthCheckResult[]) {
  const stats = {
    pass: 0,
    warning: 0,
    fail: 0,
    byType: {} as Record<string, { pass: number, warning: number, fail: number }>
  };
  
  for (const result of results) {
    stats[result.status]++;
    
    if (!stats.byType[result.checkType]) {
      stats.byType[result.checkType] = { pass: 0, warning: 0, fail: 0 };
    }
    stats.byType[result.checkType][result.status]++;
  }
  
  return stats;
}
```

## 性能优化

### 并发控制
- 根据系统资源调整 `maxConcurrentChecks`
- 使用批次处理减少上下文切换
- 合理设置检查间隔避免过载

### 内存管理
- 限制历史记录大小
- 定期清理旧数据
- 使用流式处理大数据集

### 错误处理
- 完善的异常捕获
- 自动重试机制
- 错误分类和记录

## 测试

### 运行单元测试
```bash
npm test
```

### 手动测试
```bash
node test.js
```

## 部署建议

### 开发环境
- 使用较低的并发限制
- 启用详细日志
- 缩短检查间隔以便调试

### 生产环境
- 根据服务器配置调整并发数
- 使用适当的日志级别
- 配置监控和告警
- 定期备份检查历史

## 故障排除

### 常见问题

1. **队列积压**
   - 增加 `maxConcurrentChecks`
   - 优化检查执行时间
   - 减少检查频率

2. **检查失败率高**
   - 检查网络连接
   - 验证账号凭证
   - 调整检查阈值

3. **内存使用过高**
   - 减少历史记录保留
   - 增加清理频率
   - 检查内存泄漏

### 日志分析
检查日志文件中的错误和警告信息，重点关注：
- 检查执行失败原因
- 网络连接问题
- 资源使用情况

## API 参考

详细API文档请参考：
- [HealthCheckScheduler API](./docs/HealthCheckScheduler.md)
- [HealthCheckExecutor API](./docs/HealthCheckExecutor.md)
- [CheckItems API](./docs/CheckItems.md)

## 贡献指南

1. 遵循TypeScript编码规范
2. 添加单元测试
3. 更新相关文档
4. 提交Pull Request

## 许可证

MIT License