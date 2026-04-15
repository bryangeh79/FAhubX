# 任务调度模块文档

## 概述
任务调度系统是 Facebook Auto Bot 的核心组件，负责管理10个Facebook账号的自动化任务执行。系统支持多种调度类型、优先级管理、并发控制和实时监控。

## 架构设计

### 核心组件
1. **任务调度器 (Task Scheduler)** - 负责任务调度逻辑
2. **任务队列 (Task Queue)** - 使用 Bull/Redis 管理任务队列
3. **任务执行器 (Task Executor)** - 集成浏览器自动化和对话剧本
4. **账号管理器 (Account Manager)** - 管理10个Facebook账号资源
5. **监控系统 (Monitor System)** - 实时任务状态监控和告警

### 数据流
```
任务创建 → 任务队列 → 调度器 → 账号分配 → 执行器 → 结果处理 → 监控
```

## 模块结构

### 1. 任务调度模块 (task-scheduler)
- `task-scheduler.module.ts` - 模块定义
- `task-scheduler.service.ts` - 调度逻辑服务
- `task-scheduler.controller.ts` - REST API 控制器
- `entities/` - 数据实体
- `dto/` - 数据传输对象
- `interfaces/` - 接口定义

### 2. 任务队列模块 (task-queue)
- `task-queue.module.ts` - Bull队列模块
- `task-queue.service.ts` - 队列管理服务
- `processors/` - 任务处理器

### 3. 任务执行模块 (task-executor)
- `task-executor.module.ts` - 执行器模块
- `task-executor.service.ts` - 执行逻辑服务
- `integrations/` - 集成组件（浏览器自动化、对话剧本）

### 4. 账号管理模块 (account-manager)
- `account-manager.module.ts` - 账号管理模块
- `account-manager.service.ts` - 账号调度服务
- `entities/` - 账号状态实体

### 5. 监控模块 (task-monitor)
- `task-monitor.module.ts` - 监控模块
- `task-monitor.gateway.ts` - WebSocket网关
- `task-monitor.service.ts` - 监控逻辑服务

## 数据库设计

### 任务表 (tasks)
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'immediate', 'scheduled', 'recurring', 'cron'
  schedule_config JSONB, -- 调度配置
  priority INTEGER DEFAULT 3, -- 1:紧急, 2:高, 3:中, 4:低
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'queued', 'running', 'completed', 'failed', 'cancelled'
  account_id UUID REFERENCES facebook_accounts(id),
  execution_data JSONB, -- 执行数据（剧本、目标等）
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  timeout_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  result JSONB -- 执行结果
);
```

### 任务执行日志表 (task_execution_logs)
```sql
CREATE TABLE task_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id),
  account_id UUID REFERENCES facebook_accounts(id),
  status VARCHAR(50) NOT NULL,
  message TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 账号状态表 (account_status)
```sql
CREATE TABLE account_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES facebook_accounts(id) UNIQUE,
  status VARCHAR(50) DEFAULT 'idle', -- 'idle', 'busy', 'error', 'maintenance'
  current_task_id UUID REFERENCES tasks(id),
  last_heartbeat TIMESTAMP,
  health_score INTEGER DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API 接口

### 任务管理
- `POST /api/tasks` - 创建任务
- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks/:id` - 获取任务详情
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务
- `POST /api/tasks/:id/start` - 手动启动任务
- `POST /api/tasks/:id/pause` - 暂停任务
- `POST /api/tasks/:id/resume` - 恢复任务
- `POST /api/tasks/:id/cancel` - 取消任务

### 批量操作
- `POST /api/tasks/batch` - 批量创建任务
- `POST /api/tasks/batch/start` - 批量启动任务
- `POST /api/tasks/batch/pause` - 批量暂停任务
- `POST /api/tasks/batch/cancel` - 批量取消任务
- `POST /api/tasks/import` - 导入任务模板

### 监控接口
- `GET /api/tasks/stats` - 任务统计
- `GET /api/tasks/realtime` - WebSocket实时监控
- `GET /api/tasks/history` - 执行历史查询
- `GET /api/accounts/status` - 账号状态监控

## 调度类型

### 1. 立即执行 (Immediate)
- 任务创建后立即进入队列
- 优先级最高

### 2. 定时执行 (Scheduled)
- 指定具体执行时间
- 支持时区设置

### 3. 重复执行 (Recurring)
- 每天重复：每天固定时间执行
- 每周重复：每周固定星期几执行
- 每月重复：每月固定日期执行

### 4. Cron表达式
- 支持标准Cron表达式
- 示例：`0 9 * * *` 每天9点执行

## 并发控制

### 账号并发限制
- 最多10个账号同时执行任务
- 每个账号同时只能执行一个任务
- 账号健康检查机制

### 任务优先级
1. **紧急 (Emergency)** - 立即执行，抢占资源
2. **高 (High)** - 优先执行
3. **中 (Medium)** - 普通优先级
4. **低 (Low)** - 低优先级

### 队列管理
- Bull队列支持优先级
- 公平调度算法
- 负载均衡

## 可靠性保证

### 失败重试
- 最大重试次数：3次
- 指数退避重试策略
- 重试间隔：5s, 30s, 5min

### 任务超时
- 默认超时时间：30分钟
- 可配置超时时间
- 超时自动取消并记录失败

### 持久化存储
- 任务状态持久化到PostgreSQL
- Redis队列持久化
- 定期备份

### 故障恢复
- 系统重启后恢复未完成任务
- 账号故障自动转移
- 健康检查自动恢复

## 监控和告警

### 实时监控
- WebSocket实时推送任务状态
- 执行进度可视化
- 账号状态监控

### 告警机制
- 任务失败告警
- 账号异常告警
- 系统资源告警
- 告警方式：邮件、推送通知

### 统计报表
- 任务执行统计
- 账号使用统计
- 成功率统计
- 性能指标统计

## 安全性

### 数据安全
- 任务数据加密存储
- 敏感信息脱敏
- 访问日志记录

### 权限控制
- 基于角色的访问控制
- API权限验证
- 操作审计

## 性能要求

### 响应时间
- API响应时间 < 200ms
- 任务调度延迟 < 1s
- 实时监控延迟 < 100ms

### 并发能力
- 支持10个账号并发
- 支持1000+任务队列
- 支持100+并发WebSocket连接

### 可用性
- 系统可用性 > 99.5%
- 任务成功率 > 95%
- 平均恢复时间 < 5分钟

## 部署配置

### 环境变量
```env
# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/fbautobot

# 调度配置
MAX_CONCURRENT_ACCOUNTS=10
DEFAULT_TASK_TIMEOUT=1800
MAX_RETRY_COUNT=3

# 监控配置
ENABLE_ALERTS=true
ALERT_EMAIL=admin@example.com
```

### Docker配置
```yaml
services:
  task-scheduler:
    build: ./task-scheduler
    environment:
      - REDIS_HOST=redis
      - DATABASE_URL=postgresql://user:password@postgres:5432/fbautobot
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=fbautobot
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

## 测试策略

### 单元测试
- 调度逻辑测试
- 队列管理测试
- 执行器测试

### 集成测试
- 端到端任务流程测试
- 账号并发测试
- 故障恢复测试

### 性能测试
- 并发压力测试
- 响应时间测试
- 可靠性测试

## 扩展性设计

### 水平扩展
- 支持多调度器实例
- 分布式队列
- 负载均衡

### 插件架构
- 可扩展的任务类型
- 自定义执行器
- 第三方集成

## 维护指南

### 日常维护
- 监控系统状态
- 检查任务队列
- 查看执行日志

### 故障排查
- 任务失败排查
- 账号异常排查
- 系统性能排查

### 备份恢复
- 定期备份任务数据
- 灾难恢复计划
- 数据迁移指南