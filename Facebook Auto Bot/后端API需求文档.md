# Facebook Auto Bot 后端API需求文档

## 📋 概述

本文档定义了Facebook Auto Bot系统所需的后端API接口。前端已实现完整的管理界面，需要后端提供相应的API支持。

## 🏗️ 系统架构

```
前端界面 (React)
    ↓
API调用 (RESTful)
    ↓
后端服务 (Node.js/Express)
    ↓
    ├── 账号管理服务
    ├── VPN管理服务
    ├── 反检测配置服务
    ├── 登录状态服务
    ├── 任务调度服务
    └── Puppeteer自动化服务
```

## 🔑 认证和授权

### 基础认证
所有API（除登录外）需要JWT token认证。

### 权限模型
- **管理员**: 所有操作权限
- **操作员**: 只读和有限操作权限

## 📊 API接口列表

### 1. 认证相关

#### 1.1 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

响应:
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_123",
    "username": "admin",
    "role": "admin"
  }
}
```

#### 1.2 用户登出
```http
POST /api/auth/logout
Authorization: Bearer {token}
```

### 2. 账号管理

#### 2.1 获取账号列表
```http
GET /api/facebook-accounts
参数: page, limit, status, search
Authorization: Bearer {token}

响应:
{
  "data": {
    "accounts": [FacebookAccount[]],
    "meta": {
      "total": 100,
      "page": 1,
      "limit": 10
    }
  }
}
```

#### 2.2 创建账号
```http
POST /api/facebook-accounts
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "账号显示名称",
  "email": "facebook@email.com",
  "password": "facebook_password",
  "type": "personal" | "business",
  "notes": "备注信息",
  "loginConfig": {
    "vpnAssociationId": "vpn_123",
    "antiDetectionConfigId": "anti_456"
  }
}
```

#### 2.3 更新账号
```http
PUT /api/facebook-accounts/{id}
Authorization: Bearer {token}
```

#### 2.4 删除账号
```http
DELETE /api/facebook-accounts/{id}
Authorization: Bearer {token}
```

#### 2.5 测试账号登录
```http
POST /api/facebook-accounts/{id}/test-login
Authorization: Bearer {token}
Content-Type: application/json

{
  "vpnId": "vpn_123",
  "antiDetectionConfigId": "anti_456",
  "saveSession": true,
  "timeout": 60
}

响应:
{
  "success": true,
  "sessionId": "browser_session_789",
  "cookiesCount": 15,
  "duration": 4520,
  "ipAddress": "104.20.45.67",
  "steps": [
    { "name": "初始化浏览器", "success": true, "duration": 1200 },
    { "name": "加载登录页面", "success": true, "duration": 1800 },
    { "name": "输入账号密码", "success": true, "duration": 800 },
    { "name": "提交登录表单", "success": true, "duration": 400 },
    { "name": "验证登录成功", "success": true, "duration": 320 }
  ],
  "warnings": ["使用了默认的反检测配置"],
  "errors": []
}
```

### 3. VPN管理

#### 3.1 获取VPN列表
```http
GET /api/vpns
参数: page, limit, status, country
Authorization: Bearer {token}
```

#### 3.2 创建VPN配置
```http
POST /api/vpns
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "美国洛杉矶节点",
  "type": "OpenVPN" | "WireGuard" | "Shadowsocks" | "Other",
  "serverAddress": "vpn.example.com",
  "port": 1194,
  "username": "vpn_user",
  "password": "vpn_password",
  "country": "美国",
  "city": "洛杉矶"
}
```

#### 3.3 连接/断开VPN
```http
POST /api/vpns/{id}/connect
POST /api/vpns/{id}/disconnect
Authorization: Bearer {token}
```

#### 3.4 测试VPN连接
```http
POST /api/vpns/{id}/test
Authorization: Bearer {token}

响应:
{
  "latency": 120,
  "bandwidth": 85,
  "success": true
}
```

#### 3.5 账号-VPN关联
```http
POST /api/vpn-associations
Authorization: Bearer {token}
Content-Type: application/json

{
  "accountId": "account_123",
  "vpnId": "vpn_456",
  "priority": 1
}
```

### 4. 反检测配置

#### 4.1 获取反检测配置列表
```http
GET /api/anti-detection-configs
参数: page, limit, deviceType, browser
Authorization: Bearer {token}
```

#### 4.2 创建反检测配置
```http
POST /api/anti-detection-configs
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Chrome桌面标准配置",
  "browserFingerprint": {
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "screenWidth": 1920,
    "screenHeight": 1080,
    "timezone": "Asia/Shanghai",
    "language": "zh-CN",
    // ... 其他指纹字段
  },
  "humanBehavior": {
    "mouseMovement": {
      "enabled": true,
      "speedVariation": 0.3,
      "pauseProbability": 0.1
    },
    // ... 其他行为字段
  },
  "deviceSimulation": {
    "deviceType": "desktop",
    "os": "windows",
    "osVersion": "10.0",
    "browser": "chrome",
    "browserVersion": "96.0.4664.110"
  },
  "enabled": true
}
```

#### 4.3 测试反检测配置
```http
POST /api/anti-detection-configs/{id}/test
Authorization: Bearer {token}

响应:
{
  "success": true,
  "fingerprintScore": 0.85,
  "behaviorScore": 0.92,
  "deviceScore": 0.88,
  "overallScore": 0.88,
  "warnings": ["Canvas指纹可能被检测"],
  "recommendations": ["建议调整User-Agent"]
}
```

### 5. 登录状态监控

#### 5.1 获取所有账号状态
```http
GET /api/login-status
参数: refresh (强制刷新)
Authorization: Bearer {token}

响应:
{
  "data": {
    "accounts": [AccountLoginStatus[]],
    "stats": {
      "total": 10,
      "online": 8,
      "offline": 1,
      "error": 1,
      "averageHealthScore": 85
    },
    "lastUpdated": "2026-04-13T09:30:00Z"
  }
}
```

#### 5.2 获取单个账号详细状态
```http
GET /api/login-status/{accountId}
Authorization: Bearer {token}

响应:
{
  "accountId": "account_123",
  "loginStatus": "online",
  "lastLogin": "2026-04-13T09:25:00Z",
  "sessionAge": 5, // 小时
  "vpnStatus": {
    "connected": true,
    "ipAddress": "104.20.45.67",
    "latency": 120,
    "country": "美国"
  },
  "healthScore": 92,
  "issues": [],
  "currentSession": {
    "sessionId": "session_789",
    "createdAt": "2026-04-13T09:25:00Z",
    "expiresAt": "2026-04-14T09:25:00Z"
  }
}
```

#### 5.3 手动重试登录
```http
POST /api/login-status/{accountId}/retry
Authorization: Bearer {token}
```

#### 5.4 获取状态历史
```http
GET /api/login-status/{accountId}/history
参数: startDate, endDate, limit
Authorization: Bearer {token}
```

### 6. 任务调度

#### 6.1 获取任务列表
```http
GET /api/tasks
参数: page, limit, status
Authorization: Bearer {token}
```

#### 6.2 创建任务
```http
POST /api/tasks
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "日常问候任务",
  "type": "chat",
  "scriptId": "script_123",
  "accountIds": ["account_1", "account_2"],
  "schedule": {
    "type": "daily",
    "time": "09:00",
    "timezone": "Asia/Shanghai"
  },
  "enabled": true
}
```

#### 6.3 执行任务
```http
POST /api/tasks/{id}/execute
Authorization: Bearer {token}
```

### 7. 实时通知 (WebSocket)

#### 7.1 连接WebSocket
```http
WS /ws
参数: token (JWT)

事件:
- login_status_update: 登录状态更新
- task_progress: 任务执行进度
- vpn_status_change: VPN状态变化
- system_alert: 系统告警
```

## 🗄️ 数据模型

### Facebook账号 (FacebookAccount)
```typescript
interface FacebookAccount {
  id: string;
  name: string;
  email: string;
  password?: string; // 加密存储
  type: 'personal' | 'business';
  status: 'active' | 'inactive' | 'banned';
  loginStatus?: boolean;
  loginConfig?: {
    vpnAssociationId?: string;
    antiDetectionConfigId?: string;
    lastTested?: string;
    lastSuccess?: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

### VPN配置 (VPNConfig)
```typescript
interface VPNConfig {
  id: string;
  name: string;
  type: 'OpenVPN' | 'WireGuard' | 'Shadowsocks' | 'Other';
  status: 'connected' | 'disconnecting' | 'disconnected' | 'error' | 'connecting';
  ipAddress: string;
  serverAddress: string;
  port: number;
  username?: string;
  password?: string; // 加密存储
  country?: string;
  city?: string;
  latency?: number;
  bandwidth?: number;
  lastConnectedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 反检测配置 (AntiDetectionConfig)
```typescript
interface AntiDetectionConfig {
  id: string;
  name: string;
  browserFingerprint: BrowserFingerprint;
  humanBehavior: HumanBehaviorParams;
  deviceSimulation: DeviceSimulation;
  enabled: boolean;
  accounts: string[]; // 关联的账号ID
  createdAt: string;
  updatedAt: string;
}
```

## 🔒 安全要求

### 数据加密
1. **密码存储**: 使用bcrypt加密存储
2. **敏感数据**: VPN密码、Facebook密码需要加密
3. **传输加密**: 所有API使用HTTPS

### 输入验证
1. **SQL注入防护**: 使用参数化查询
2. **XSS防护**: 输入输出过滤
3. **速率限制**: API调用频率限制

### 审计日志
1. **操作日志**: 记录所有重要操作
2. **登录日志**: 记录登录尝试
3. **错误日志**: 记录系统错误

## 🚀 部署要求

### 环境要求
- Node.js 18+
- MySQL/PostgreSQL数据库
- Redis (用于会话和缓存)
- Docker (可选)

### 配置文件
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=facebook_bot
DB_USER=root
DB_PASSWORD=password

# JWT配置
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# Puppeteer配置
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=60000
```

## 📅 开发计划

### Phase 1: 基础API (1-2周)
- 认证和授权系统
- 账号管理API
- VPN管理API
- 基础数据库设计

### Phase 2: 核心功能 (2-3周)
- 反检测配置API
- 登录状态监控API
- Puppeteer集成
- WebSocket实时通知

### Phase 3: 高级功能 (2-3周)
- 任务调度系统
- 批量操作优化
- 性能监控
- 系统告警

### Phase 4: 测试和优化 (1-2周)
- 集成测试
- 性能测试
- 安全审计
- 文档完善

## 📞 联系和协调

### 前端依赖
- 所有类型定义在 `frontend/src/types/facebook-login.ts`
- API服务定义在 `frontend/src/services/` 目录
- 需要与前端开发保持接口一致性

### 测试数据
开发阶段可以使用模拟数据，但需要逐步替换为真实实现。

### 问题反馈
发现接口不一致或需要调整时，及时与前端团队沟通。

---

**文档版本**: 1.0
**更新日期**: 2026-04-13
**状态**: 待后端开发开始