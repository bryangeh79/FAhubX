# Facebook Auto Bot 安全修复方案

## 1. 发现的安全问题

### 1.1 严重问题（需要立即修复）

1. **硬编码的数据库密码**
   - 位置: `/workspace/backend/.env`
   - 问题: `DB_PASSWORD=password`
   - 风险: 使用弱密码，容易被暴力破解

2. **硬编码的测试数据库密码**
   - 位置: `/workspace/backend/.env`
   - 问题: `TEST_DB_PASSWORD=password`
   - 风险: 测试环境使用与生产环境相同的弱密码

3. **硬编码的RabbitMQ密码**
   - 位置: `/workspace/backend/.env`
   - 问题: `RABBITMQ_URL=amqp://admin:password@localhost:5672`
   - 风险: 消息队列使用弱密码

### 1.2 依赖漏洞问题

根据 `npm audit` 扫描结果：

**前端依赖漏洞:**
- `@tootallnate/once` <3.0.1 - 控制流范围错误
- `esbuild` <=0.24.2 - 开发服务器SSRF漏洞
- `minimatch` 9.0.0-9.0.6 - ReDoS漏洞
- `path-to-regexp` 8.0.0-8.3.0 - DoS漏洞
- `serialize-javascript` <=7.0.4 - RCE漏洞

**后端依赖漏洞:**
- `tar` <6.2.1 - 路径遍历漏洞
- `tmp` <=0.2.3 - 符号链接漏洞
- `webpack` 5.49.0-5.104.0 - SSRF漏洞
- `bcrypt` 5.0.1-5.1.1 - 依赖链漏洞

## 2. 修复方案

### 2.1 密码安全修复

#### 方案1：使用环境变量管理密码
```bash
# 创建 .env.local 文件（不提交到版本控制）
cp backend/.env.example backend/.env.local

# 在 .env.local 中设置强密码
DB_PASSWORD=$(openssl rand -base64 32)
TEST_DB_PASSWORD=$(openssl rand -base64 32)
RABBITMQ_PASSWORD=$(openssl rand -base64 32)
```

#### 方案2：使用密钥管理服务
- 开发环境: 使用 `.env.local` + gitignore
- 生产环境: 使用 AWS Secrets Manager / Azure Key Vault / HashiCorp Vault

### 2.2 依赖漏洞修复

#### 前端修复:
```bash
cd frontend
# 修复非破坏性更新
npm audit fix
# 检查剩余漏洞
npm audit
```

#### 后端修复:
```bash
cd backend
# 修复非破坏性更新
npm audit fix
# 检查剩余漏洞
npm audit
```

### 2.3 安全配置加固

#### 1. 添加安全HTTP头
```javascript
// 在 main.ts 中增强 helmet 配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',
  },
  noSniff: true,
  xssFilter: true,
}));
```

#### 2. 增强CORS配置
```javascript
app.enableCors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24小时
});
```

#### 3. 添加速率限制
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100个请求
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

## 3. 实施步骤

### 阶段1：立即修复（1小时内完成）
1. [ ] 创建安全的 `.env.local` 文件
2. [ ] 更新 `.gitignore` 排除敏感文件
3. [ ] 修复前端依赖漏洞
4. [ ] 修复后端依赖漏洞

### 阶段2：配置加固（2小时内完成）
1. [ ] 增强安全HTTP头配置
2. [ ] 配置CORS安全策略
3. [ ] 添加速率限制
4. [ ] 添加输入验证中间件

### 阶段3：监控和审计（持续进行）
1. [ ] 设置安全监控
2. [ ] 定期运行安全扫描
3. [ ] 更新依赖包
4. [ ] 安全日志记录

## 4. 验证方法

### 4.1 修复验证
```bash
# 运行安全检查脚本
node security-tests/security-config-check.js

# 运行依赖漏洞扫描
cd frontend && npm audit
cd backend && npm audit

# 运行代码安全检查
npm run lint:security
```

### 4.2 渗透测试验证
- 使用 OWASP ZAP 进行API安全测试
- 使用 Burp Suite 进行Web应用测试
- 使用 sqlmap 进行SQL注入测试

## 5. 回滚计划

如果安全修复导致系统问题：

1. **立即回滚**：恢复之前的 `.env` 文件
2. **依赖回滚**：使用 `package-lock.json` 恢复依赖版本
3. **配置回滚**：注释掉新增的安全配置
4. **测试验证**：确保系统功能正常

## 6. 成功标准

- [ ] 所有硬编码密码被移除
- [ ] 高危依赖漏洞修复率100%
- [ ] 安全HTTP头配置完整
- [ ] 速率限制生效
- [ ] 安全扫描通过率>95%

## 7. 责任人

- **安全负责人**: 项目技术负责人
- **实施人员**: 开发团队
- **验证人员**: QA团队
- **监控人员**: 运维团队

## 8. 时间表

- **开始时间**: 立即
- **阶段1完成**: 1小时后
- **阶段2完成**: 3小时后
- **最终验证**: 4小时后

---

*本修复方案将根据实际情况进行调整*