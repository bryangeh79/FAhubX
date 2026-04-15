# 安全修复实施指南

## 概述

本指南提供Facebook Auto Bot项目安全漏洞的详细修复步骤。根据安全评估报告，发现1个严重漏洞需要立即修复。

## 紧急修复：硬编码密码

### 问题描述
在`/workspace/backend/.env`文件中发现硬编码的密码：
- 数据库密码: `password`
- 测试数据库密码: `password`  
- RabbitMQ密码: `password`

### 修复步骤

#### 步骤1: 创建安全的环境变量文件

1. **创建本地环境文件模板**:
   ```bash
   cd /workspace/backend
   cp .env.example .env.local.example
   ```

2. **更新模板文件**，移除硬编码密码:
   ```bash
   # 编辑.env.local.example文件
   # 将以下行:
   DB_PASSWORD=password
   TEST_DB_PASSWORD=password
   RABBITMQ_URL=amqp://admin:password@localhost:5672
   
   # 改为:
   DB_PASSWORD=your-strong-db-password-here
   TEST_DB_PASSWORD=your-strong-test-db-password-here
   RABBITMQ_URL=amqp://admin:your-rabbitmq-password-here@localhost:5672
   ```

3. **创建实际的本地环境文件**（不提交到版本控制）:
   ```bash
   cp .env.local.example .env.local
   # 编辑.env.local文件，设置实际的强密码
   ```

#### 步骤2: 更新.gitignore

确保`.gitignore`文件包含以下内容:
```gitignore
# 环境变量文件
.env
.env.local
.env.*.local
!.env.example
!.env.local.example
```

#### 步骤3: 更新部署文档

更新`DEPLOYMENT_GUIDE.md`，添加环境变量设置说明:

```markdown
## 环境变量配置

### 开发环境
1. 复制环境变量模板:
   ```bash
   cp backend/.env.local.example backend/.env.local
   ```

2. 编辑`.env.local`文件，设置实际值:
   ```bash
   # 使用强密码生成工具
   DB_PASSWORD=$(openssl rand -base64 32)
   TEST_DB_PASSWORD=$(openssl rand -base64 32)
   RABBITMQ_PASSWORD=$(openssl rand -base64 32)
   ```

### 生产环境
1. 使用密钥管理服务（如AWS Secrets Manager、HashiCorp Vault）
2. 或在部署脚本中设置环境变量
```

#### 步骤4: 验证修复

1. **运行安全检查**:
   ```bash
   node security-tests/simple-security-check.js
   ```

2. **测试应用功能**:
   ```bash
   cd backend
   npm run test
   ```

## 安全加固：CORS配置

### 问题描述
CORS配置允许所有来源或未明确限制，存在安全风险。

### 修复步骤

#### 步骤1: 更新CORS配置

编辑`/workspace/backend/src/main.ts`文件:

```typescript
// 更新CORS配置
app.enableCors({
  origin: (origin, callback) => {
    // 允许的域名列表
    const allowedOrigins = [
      'http://localhost:8080',  // 开发环境
      'https://fbautobot.com',   // 生产环境
      'https://app.fbautobot.com',
    ];
    
    // 允许没有origin的请求（如移动应用、curl等）
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // 检查origin是否在允许列表中
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('不允许的CORS请求'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'X-Total-Count',
  ],
  maxAge: 86400, // 24小时
});
```

#### 步骤2: 添加环境变量配置

在`.env.local.example`中添加:
```bash
# CORS配置
CORS_ALLOWED_ORIGINS=http://localhost:8080,https://fbautobot.com,https://app.fbautobot.com
```

#### 步骤3: 使用环境变量

更新main.ts中的CORS配置，使用环境变量:
```typescript
const allowedOrigins = configService.get<string[]>('CORS_ALLOWED_ORIGINS', [
  'http://localhost:8080',
]);
```

## 安全加固：CSRF保护

### 实施步骤

#### 步骤1: 安装依赖
```bash
cd backend
npm install csurf @types/csurf
```

#### 步骤2: 创建CSRF中间件

创建`/workspace/backend/src/common/middlewares/csrf.middleware.ts`:

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as csurf from 'csurf';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private csrfProtection: any;

  constructor() {
    this.csrfProtection = csurf({
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      },
      ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    // 仅对需要CSRF保护的端点应用
    if (this.shouldApplyCSRF(req)) {
      this.csrfProtection(req, res, next);
    } else {
      next();
    }
  }

  private shouldApplyCSRF(req: Request): boolean {
    // 仅对需要会话的非API路由应用CSRF
    const csrfPaths = [
      '/auth/login',
      '/auth/register',
      '/auth/logout',
    ];
    
    return csrfPaths.some(path => req.path.startsWith(path)) && 
           !req.path.startsWith('/api/');
  }
}
```

#### 步骤3: 注册中间件

在AppModule中注册CSRF中间件。

## 安全监控实施

### 步骤1: 创建安全监控配置

创建`/workspace/security-monitoring/`目录和配置文件。

### 步骤2: 实施安全日志

更新日志配置，添加安全事件日志:

```typescript
// 在logger配置中添加安全日志
new winston.transports.File({
  filename: 'logs/security.log',
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  maxsize: 10485760, // 10MB
  maxFiles: 10,
}),
```

### 步骤3: 添加安全事件记录

创建安全服务记录安全事件:

```typescript
// security.service.ts
logSecurityEvent(event: string, details: any) {
  this.logger.warn(`安全事件: ${event}`, {
    ...details,
    timestamp: new Date().toISOString(),
    ip: details.ip || 'unknown',
    userAgent: details.userAgent || 'unknown',
  });
}
```

## 测试验证

### 1. 单元测试
创建安全相关的单元测试:

```typescript
// security.service.spec.ts
describe('SecurityService', () => {
  it('应该验证密码强度', () => {
    const result = securityService.validatePassword('Weak123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('密码必须包含特殊字符');
  });
});
```

### 2. 集成测试
测试安全中间件和配置:

```typescript
// security.integration.spec.ts
describe('安全中间件', () => {
  it('应该添加安全头', async () => {
    const response = await request(app.getHttpServer())
      .get('/health');
    
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });
});
```

### 3. 端到端测试
测试完整的安全流程:

```typescript
// security.e2e-spec.ts
describe('安全端到端测试', () => {
  it('应该阻止SQL注入攻击', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send({ username: "admin'; DROP TABLE users; --" });
    
    expect(response.status).toBe(400);
  });
});
```

## 部署检查清单

### 预部署检查
- [ ] 所有硬编码密码已移除
- [ ] 环境变量文件已正确配置
- [ ] CORS配置已限制来源
- [ ] CSRF保护已启用
- [ ] 安全头配置完整
- [ ] 依赖漏洞已修复
- [ ] 安全测试全部通过

### 部署后验证
- [ ] 应用功能正常
- [ ] 安全头正确返回
- [ ] CORS限制生效
- [ ] 日志记录安全事件
- [ ] 监控系统正常工作

## 故障排除

### 常见问题

#### 问题1: 应用启动失败，缺少环境变量
**解决方案**:
```bash
# 检查环境变量文件
ls -la backend/.env.local

# 创建环境变量文件
cp backend/.env.local.example backend/.env.local
# 编辑文件设置实际值
```

#### 问题2: CORS阻止合法请求
**解决方案**:
1. 检查请求的Origin头
2. 更新CORS_ALLOWED_ORIGINS环境变量
3. 重启应用

#### 问题3: CSRF令牌验证失败
**解决方案**:
1. 确保前端发送CSRF令牌
2. 检查Cookie设置
3. 验证同源策略

## 维护计划

### 日常维护
- 监控安全日志
- 检查异常登录
- 更新依赖包

### 每周维护
- 运行安全扫描
- 审查安全事件
- 更新威胁情报

### 每月维护
- 安全审计
- 渗透测试
- 安全培训

## 联系支持

### 内部支持
- **安全团队**: security@fbautobot.com
- **技术团队**: tech@fbautobot.com
- **运维团队**: ops@fbautobot.com

### 外部资源
- OWASP安全指南: https://owasp.org
- NIST网络安全框架: https://www.nist.gov/cyberframework
- CVE漏洞数据库: https://cve.mitre.org

---

**文档版本**: 1.0  
**最后更新**: 2026-04-13  
**维护者**: 安全团队  

*安全是持续的过程，请定期审查和更新本指南。*