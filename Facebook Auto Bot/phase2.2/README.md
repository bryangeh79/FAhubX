# Facebook Auto Bot - Phase 2.2

会话管理模块 + VPN/IP集成系统

## 项目概述

Phase 2.2在Phase 2.1（Puppeteer基础执行器）的基础上，增加了企业级的会话管理、网络隔离和健康监控功能。

## 核心功能

### 1. 加密会话存储模块
- **安全存储**: AES-256-GCM加密存储会话数据
- **自动恢复**: 智能会话恢复和验证
- **状态管理**: 会话状态跟踪和清理
- **统计分析**: 会话使用统计和分析

### 2. VPN/IP集成系统
- **多协议支持**: OpenVPN、WireGuard、代理
- **IP轮换**: 智能IP轮换策略
- **网络隔离**: Docker容器级网络隔离
- **性能监控**: 网络质量测试和优化

### 3. 账号健康监控系统
- **多维检查**: 登录状态、发布能力、速率限制等
- **风险评分**: 智能风险评分和等级评估
- **自动修复**: 常见问题自动修复
- **行为分析**: 账号行为模式分析

### 4. 监控告警增强
- **实时监控**: 指标收集和可视化
- **灵活告警**: 可配置的告警规则
- **多通道通知**: Slack、Email、Webhook等
- **SLA管理**: 服务级别协议监控

## 快速开始

### 环境要求
- Node.js 18+
- PostgreSQL 12+
- Docker 20+
- Redis 6+ (可选)

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/facebook-auto-bot/phase2.git
cd phase2.2
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑.env文件，设置必要的配置
```

4. **运行数据库迁移**
```bash
npm run migrate
```

5. **启动服务**
```bash
npm start
```

### 基本使用

```typescript
import { Phase2Integration } from './packages/phase2-integration';

async function main() {
  // 创建集成实例
  const integration = new Phase2Integration();
  
  // 初始化
  await integration.initialize();
  
  // 创建Facebook会话
  const result = await integration.createFacebookSession('account-123', {
    email: 'user@example.com',
    password: 'password123'
  });
  
  console.log('Session created:', result.sessionId);
  console.log('VPN connection:', result.vpnConnectionId);
  console.log('Container ID:', result.containerId);
  
  // 执行健康检查
  const health = await integration.performAccountHealthCheck('account-123');
  console.log('Health status:', health.overallStatus);
  
  // 获取系统状态
  const status = await integration.getSystemStatus();
  console.log('System health:', status.health);
  
  // 清理
  await integration.destroy();
}

main().catch(console.error);
```

## 模块说明

### Session Manager (会话管理器)
安全存储和恢复Facebook会话数据。

**主要功能**:
- 会话加密存储（AES-256-GCM）
- 自动会话恢复和验证
- 会话过期清理
- 会话统计和分析

### VPN Manager (VPN管理器)
管理VPN连接和IP轮换。

**主要功能**:
- 多VPN协议支持
- IP轮换策略
- 网络质量测试
- Docker网络集成

### Health Checker (健康检查器)
监控账号健康状态。

**主要功能**:
- 多维度健康检查
- 风险评分和预警
- 自动修复机制
- 行为模式分析

### Monitoring Manager (监控管理器)
系统监控和告警。

**主要功能**:
- 实时指标收集
- 可配置告警规则
- 多通道通知
- SLA合规监控

## API参考

### 会话管理API
```
GET    /api/sessions           # 获取会话列表
POST   /api/sessions           # 创建新会话
GET    /api/sessions/:id       # 获取会话详情
PUT    /api/sessions/:id       # 更新会话
DELETE /api/sessions/:id       # 删除会话
GET    /api/sessions/overview  # 会话概览
```

### VPN管理API
```
GET    /api/vpn/connections    # 获取VPN连接列表
POST   /api/vpn/connect        # 建立VPN连接
POST   /api/vpn/disconnect/:id # 断开VPN连接
POST   /api/vpn/rotate/:id     # 轮换IP地址
GET    /api/vpn/status         # VPN状态
```

### 健康检查API
```
GET    /api/health/accounts    # 获取账号列表
POST   /api/health/check       # 执行健康检查
GET    /api/health/stats       # 健康统计
POST   /api/health/fix         # 执行自动修复
```

### 监控API
```
GET    /api/monitoring/alerts  # 获取告警列表
POST   /api/monitoring/metrics # 提交指标数据
GET    /api/monitoring/stats   # 监控统计
GET    /api/monitoring/dashboard # 仪表板数据
```

## 配置说明

### 环境变量
```bash
# 应用配置
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=facebook_bot
DB_USER=postgres
DB_PASSWORD=your_password

# 会话加密
SESSION_ENCRYPTION_KEY=your_32_byte_base64_key
SESSION_ENCRYPTION_IV_LENGTH=12
SESSION_ENCRYPTION_SALT_LENGTH=16

# VPN配置
VPN_ROTATION_STRATEGY=round-robin
VPN_MIN_ROTATION_INTERVAL=60000
VPN_MAX_SESSIONS_PER_IP=1

# 健康检查
HEALTH_CHECK_INTERVAL=300000
RISK_THRESHOLD_WARNING=30
RISK_THRESHOLD_CRITICAL=60
AUTO_FIX_ENABLED=true

# 监控告警
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
```

### 配置文件
也可以使用JSON配置文件：
```json
{
  "app": {
    "environment": "production",
    "logLevel": "info",
    "port": 3000
  },
  "database": {
    "host": "localhost",
    "port": 5432,
    "database": "facebook_bot"
  }
}
```

## 部署指南

### Docker部署
```bash
# 构建镜像
docker build -t facebook-bot-phase2 .

# 运行容器
docker run -d \
  --name facebook-bot-phase2 \
  -p 3000:3000 \
  --env-file .env \
  facebook-bot-phase2
```

### Docker Compose部署
```yaml
version: '3.8'
services:
  phase2:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=facebook_bot
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes部署
参考 `kubernetes/` 目录下的配置文件。

## 监控和运维

### 健康检查端点
```
GET /health     # 应用健康状态
GET /ready      # 应用就绪状态
GET /metrics    # Prometheus指标
```

### 日志管理
- 结构化JSON日志
- 多级别日志控制
- 日志轮转和归档
- 远程日志收集

### 性能监控
- Prometheus指标收集
- Grafana仪表板
- 分布式追踪
- 错误跟踪

## 故障排除

### 常见问题

1. **数据库连接失败**
   ```bash
   # 检查数据库服务
   systemctl status postgresql
   
   # 检查连接参数
   psql -h localhost -U postgres -d facebook_bot
   ```

2. **加密失败**
   ```bash
   # 验证加密密钥格式
   echo $SESSION_ENCRYPTION_KEY | base64 -d | wc -c
   # 应该输出32
   ```

3. **Docker网络问题**
   ```bash
   # 检查Docker网络
   docker network ls
   
   # 检查容器网络配置
   docker inspect <container_id> | grep -A 10 NetworkSettings
   ```

4. **VPN连接失败**
   ```bash
   # 检查VPN配置文件
   ls -la /etc/openvpn/
   
   # 测试VPN连接
   openvpn --config /etc/openvpn/client.ovpn --test
   ```

### 调试模式
设置 `LOG_LEVEL=debug` 获取详细日志：
```bash
export LOG_LEVEL=debug
npm start
```

## 安全建议

### 生产环境部署
1. **使用强加密密钥**: 生成32字节的随机密钥
2. **启用SSL/TLS**: 配置HTTPS访问
3. **配置防火墙**: 限制访问来源
4. **定期备份**: 数据库和会话数据备份
5. **监控告警**: 设置关键指标告警

### 密钥管理
1. **环境变量管理**: 使用密钥管理服务
2. **定期轮换**: 定期更换加密密钥
3. **访问控制**: 限制密钥访问权限
4. **审计日志**: 记录密钥使用情况

## 开发指南

### 代码结构
```
src/
├── core/           # 核心功能
├── modules/        # 功能模块
├── utils/          # 工具函数
├── types/          # TypeScript类型定义
├── config/         # 配置管理
└── index.ts        # 主入口
```

### 开发命令
```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 测试
npm test

# 代码检查
npm run lint
npm run format

# 数据库迁移
npm run migrate
```

### 代码规范
- 使用TypeScript严格模式
- ESLint代码检查
- Prettier代码格式化
- 提交前代码检查

## 许可证

MIT License

## 支持

如有问题，请提交GitHub Issue或联系开发团队。

---

**版本**: v2.2.0  
**状态**: 生产就绪  
**最后更新**: 2026-04-12