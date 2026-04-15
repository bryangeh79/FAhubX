# Session Manager

加密的会话存储管理器，用于Facebook Auto Bot项目。

## 功能特性

- 🔒 **AES-256-GCM加密**：安全存储敏感会话数据
- 🗄️ **PostgreSQL存储**：可靠的数据库存储
- 📊 **会话管理**：创建、读取、更新、删除会话
- 🕒 **自动清理**：定期清理过期和空闲会话
- 📈 **监控统计**：详细的会话统计和活动日志
- 🛡️ **安全设计**：非对称加密、防时序攻击

## 安装

```bash
npm install @facebook-bot/session-manager
```

## 快速开始

### 1. 环境变量配置

```bash
# 加密配置
export SESSION_ENCRYPTION_KEY="your-32-byte-base64-encryption-key"
export SESSION_ENCRYPTION_IV_LENGTH="12"
export SESSION_ENCRYPTION_SALT_LENGTH="16"

# 数据库配置
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="facebook_bot"
export DB_USER="postgres"
export DB_PASSWORD="your-password"
export DB_SSL="false"
export DB_MAX_CONNECTIONS="20"
export DB_IDLE_TIMEOUT="30000"

# 会话配置
export SESSION_CLEANUP_INTERVAL="3600000"
export SESSION_MAX_IDLE_TIME="86400000"
export SESSION_TTL="604800000"

# 日志配置
export LOG_LEVEL="info"
export LOG_CONSOLE="true"
export LOG_FILE="false"
```

### 2. 生成加密密钥

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. 数据库迁移

```bash
npm run migrate
```

### 4. 基本使用

```typescript
import { createSessionManager } from '@facebook-bot/session-manager';

async function main() {
  // 创建SessionManager实例
  const sessionManager = await createSessionManager();

  // 保存会话
  const sessionData = {
    sessionId: 'session-123',
    accountId: 'account-456',
    cookies: [{ name: 'c_user', value: '123456789', domain: '.facebook.com' }],
    localStorage: { 'fb:session': 'encrypted-session-data' },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 },
    stealthMode: true,
    humanBehavior: true
  };

  const savedSession = await sessionManager.saveSession(sessionData, {
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后过期
  });

  console.log('Session saved:', savedSession.sessionId);

  // 恢复会话
  const restoredSession = await sessionManager.restoreSession('session-123');
  console.log('Session restored:', restoredSession.cookies.length, 'cookies');

  // 查询会话
  const sessions = await sessionManager.querySessions({
    accountId: 'account-456',
    status: 'active',
    limit: 10
  });
  console.log('Active sessions:', sessions.length);

  // 获取会话概览
  const overview = await sessionManager.getSessionOverview();
  console.log('Session overview:', overview);

  // 清理会话
  const cleanupResult = await sessionManager.cleanupSessions();
  console.log('Cleanup result:', cleanupResult);

  // 销毁SessionManager
  await sessionManager.destroy();
}

main().catch(console.error);
```

## API 参考

### SessionManager

#### 构造函数

```typescript
new SessionManager(config: SessionManagerConfig)
```

#### 方法

| 方法 | 描述 | 返回类型 |
|------|------|----------|
| `initialize()` | 初始化SessionManager | `Promise<void>` |
| `saveSession(sessionData, options)` | 保存会话 | `Promise<EncryptedSessionData>` |
| `restoreSession(sessionId, options)` | 恢复会话 | `Promise<SessionData>` |
| `querySessions(options)` | 查询会话 | `Promise<EncryptedSessionData[]>` |
| `getSessionOverview()` | 获取会话概览 | `Promise<SessionOverview[]>` |
| `updateSessionStatus(sessionId, status, errorCount)` | 更新会话状态 | `Promise<void>` |
| `deleteSession(sessionId, permanent)` | 删除会话 | `Promise<boolean>` |
| `cleanupSessions()` | 清理会话 | `Promise<CleanupResult>` |
| `getSessionStats(accountId)` | 获取会话统计 | `Promise<SessionStats[]>` |
| `destroy()` | 销毁SessionManager | `Promise<void>` |

### 工具函数

| 函数 | 描述 | 返回类型 |
|------|------|----------|
| `createSessionManager()` | 创建默认SessionManager实例 | `Promise<SessionManager>` |
| `validateEnvironment()` | 验证环境变量 | `string[]` |
| `generateEncryptionKey()` | 生成加密密钥 | `string` |
| `createDefaultConfig()` | 创建默认配置 | `object` |

## 数据库架构

### sessions 表

存储加密的会话数据。

| 字段 | 类型 | 描述 |
|------|------|------|
| id | UUID | 主键 |
| account_id | VARCHAR(255) | 账号ID |
| session_id | VARCHAR(255) | 会话ID（唯一） |
| encrypted_cookies | TEXT | 加密的cookies数据 |
| encrypted_local_storage | TEXT | 加密的localStorage数据 |
| encryption_iv | VARCHAR(64) | 加密初始化向量 |
| encryption_tag | VARCHAR(64) | GCM认证标签 |
| user_agent | TEXT | 用户代理 |
| viewport_width | INTEGER | 视口宽度 |
| viewport_height | INTEGER | 视口高度 |
| stealth_mode | BOOLEAN | 隐身模式 |
| human_behavior | BOOLEAN | 人类行为模拟 |
| status | VARCHAR(50) | 会话状态 |
| last_activity | TIMESTAMP | 最后活动时间 |
| error_count | INTEGER | 错误计数 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |
| expires_at | TIMESTAMP | 过期时间 |

### session_activities 表

记录会话活动日志。

### session_stats 表

存储会话统计信息。

### session_overview 视图

提供会话概览视图。

## 安全考虑

### 加密

- 使用AES-256-GCM进行加密和认证
- 每个会话使用唯一的初始化向量（IV）
- 密钥通过环境变量管理，不在代码中硬编码
- 支持密钥轮换

### 数据保护

- 敏感数据在存储前加密
- 日志中的敏感信息被脱敏
- 使用防时序攻击的字符串比较
- 会话数据有TTL，自动过期

### 数据库安全

- 使用参数化查询防止SQL注入
- 连接池管理，防止连接泄露
- SSL/TLS加密数据库连接
- 定期清理过期数据

## 开发

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 测试

```bash
npm test
```

### 代码检查

```bash
npm run lint
npm run format
```

### 运行迁移

```bash
npm run migrate
```

### 运行清理

```bash
npm run cleanup
```

## 部署

### Docker

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# 设置环境变量
ENV NODE_ENV=production

# 运行迁移
RUN npm run migrate

CMD ["node", "dist/index.js"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: session-manager
spec:
  replicas: 3
  selector:
    matchLabels:
      app: session-manager
  template:
    metadata:
      labels:
        app: session-manager
    spec:
      containers:
      - name: session-manager
        image: your-registry/session-manager:latest
        env:
        - name: SESSION_ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: session-secrets
              key: encryption-key
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: password
        ports:
        - containerPort: 3000
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查数据库服务是否运行
   - 验证连接参数（主机、端口、凭据）
   - 检查防火墙设置

2. **加密失败**
   - 验证加密密钥格式（必须是32字节的base64）
   - 检查环境变量是否正确设置
   - 确保Node.js版本支持所需的加密算法

3. **会话恢复失败**
   - 检查会话是否已过期
   - 验证会话ID是否存在
   - 检查数据库连接状态

### 日志

设置 `LOG_LEVEL=debug` 获取详细日志：

```bash
export LOG_LEVEL=debug
```

## 许可证

MIT

## 支持

如有问题，请提交 [GitHub Issue](https://github.com/facebook-auto-bot/session-manager/issues)。