# Facebook Auto Bot - API接口文档

## 文档版本
- **版本**: 1.0.0
- **更新日期**: 2026-04-13
- **OpenAPI版本**: 3.0.0
- **Base URL**: `https://api.fbautobot.com`

---

## 目录
1. [快速开始](#快速开始)
2. [认证和授权](#认证和授权)
3. [用户管理API](#用户管理api)
4. [Facebook账号管理API](#facebook账号管理api)
5. [任务调度API](#任务调度api)
6. [对话剧本API](#对话剧本api)
7. [系统监控API](#系统监控api)
8. [错误处理](#错误处理)
9. [API调用示例](#api调用示例)
10. [最佳实践](#最佳实践)

---

## 快速开始

### 环境端点
| 环境 | Base URL | 用途 |
|------|----------|------|
| 开发环境 | `http://localhost:3000` | 本地开发测试 |
| 测试环境 | `https://api.staging.fbautobot.com` | 预发布测试 |
| 生产环境 | `https://api.fbautobot.com` | 正式生产环境 |

### 认证流程
1. **注册账号** → 获取用户凭证
2. **登录系统** → 获取访问令牌
3. **调用API** → 使用令牌访问受保护接口
4. **刷新令牌** → 令牌过期时刷新

### 基本请求格式
```http
GET /api/endpoint HTTP/1.1
Host: api.fbautobot.com
Authorization: Bearer {access_token}
Content-Type: application/json
Accept: application/json
```

### 基本响应格式
```json
{
  "success": true,
  "data": { /* 响应数据 */ },
  "message": "操作成功",
  "timestamp": "2026-04-13T10:30:00Z"
}
```

---

## 认证和授权

### 认证方式
系统使用JWT（JSON Web Token）进行认证，支持以下方式：

#### 1. Bearer Token认证
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 2. API密钥认证（用于服务间调用）
```http
X-API-Key: sk_live_abc123def456
```

### 令牌管理

#### 获取访问令牌
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "token_type": "Bearer",
    "user": {
      "id": 123,
      "email": "user@example.com",
      "name": "张三",
      "role": "user"
    }
  },
  "message": "登录成功"
}
```

#### 刷新访问令牌
```http
POST /auth/refresh
Content-Type: application/json
Authorization: Bearer {refresh_token}

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 注销登录
```http
POST /auth/logout
Authorization: Bearer {access_token}
```

### 用户注册

#### 注册新用户
```http
POST /auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "name": "李四",
  "company": "示例公司"
}
```

**请求字段**:
| 字段 | 类型 | 必填 | 描述 | 验证规则 |
|------|------|------|------|----------|
| email | string | 是 | 用户邮箱 | 有效邮箱格式 |
| password | string | 是 | 用户密码 | 最少8位，包含大小写字母和数字 |
| name | string | 是 | 用户姓名 | 2-50个字符 |
| company | string | 否 | 公司名称 | 最多100个字符 |

### 用户资料管理

#### 获取用户资料
```http
GET /auth/profile
Authorization: Bearer {access_token}
```

#### 更新用户资料
```http
PATCH /auth/profile
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "新姓名",
  "avatar": "https://example.com/avatar.jpg",
  "timezone": "Asia/Shanghai"
}
```

#### 修改密码
```http
POST /auth/change-password
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "current_password": "old_password",
  "new_password": "NewSecurePass123!"
}
```

---

## 用户管理API

### 用户列表
```http
GET /users
Authorization: Bearer {access_token}
```

**查询参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| page | integer | 1 | 页码 |
| limit | integer | 20 | 每页数量 |
| search | string | - | 搜索关键词（邮箱/姓名） |
| role | string | - | 角色过滤 |
| status | string | active | 状态过滤 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 123,
        "email": "user1@example.com",
        "name": "张三",
        "role": "admin",
        "status": "active",
        "created_at": "2026-01-15T10:30:00Z",
        "last_login_at": "2026-04-13T09:15:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "pages": 8
    }
  }
}
```

### 用户详情
```http
GET /users/{id}
Authorization: Bearer {access_token}
```

### 创建用户（管理员）
```http
POST /users
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "email": "new@example.com",
  "password": "TempPass123!",
  "name": "新用户",
  "role": "user",
  "status": "active"
}
```

### 更新用户
```http
PATCH /users/{id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "更新后的姓名",
  "role": "manager",
  "status": "suspended"
}
```

### 删除用户
```http
DELETE /users/{id}
Authorization: Bearer {access_token}
```

---

## Facebook账号管理API

### 账号列表
```http
GET /facebook-accounts
Authorization: Bearer {access_token}
```

**查询参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| page | integer | 1 | 页码 |
| limit | integer | 20 | 每页数量 |
| status | string | - | 状态过滤 |
| group_id | string | - | 分组ID过滤 |
| search | string | - | 搜索关键词 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "acc_123",
        "name": "我的Facebook页面",
        "facebook_id": "1234567890",
        "status": "active",
        "health_score": 95,
        "last_login_at": "2026-04-13T08:30:00Z",
        "task_count": 15,
        "group": {
          "id": "grp_1",
          "name": "营销账号"
        },
        "vpn_config": {
          "id": "vpn_1",
          "name": "美国VPN"
        }
      }
    ],
    "stats": {
      "total": 8,
      "active": 7,
      "idle": 1,
      "error": 0
    }
  }
}
```

### 创建Facebook账号
```http
POST /facebook-accounts
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "新Facebook账号",
  "facebook_email": "fb_account@example.com",
  "facebook_password": "fb_password",
  "login_method": "web", // web 或 vpn
  "vpn_config_id": "vpn_1", // 可选，使用VPN登录时需要
  "group_id": "grp_1", // 可选
  "tags": ["营销", "主要"]
}
```

### 账号详情
```http
GET /facebook-accounts/{id}
Authorization: Bearer {access_token}
```

### 更新账号
```http
PATCH /facebook-accounts/{id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "更新后的名称",
  "status": "idle",
  "group_id": "grp_2",
  "tags": ["营销", "备用"]
}
```

### 测试账号连接
```http
POST /facebook-accounts/{id}/test-connection
Authorization: Bearer {access_token}
```

### 登录账号
```http
POST /facebook-accounts/{id}/login
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "force": false // 是否强制重新登录
}
```

### 批量操作
```http
POST /facebook-accounts/batch/start
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "account_ids": ["acc_1", "acc_2", "acc_3"],
  "operation": "start" // start, pause, stop, test
}
```

### 账号统计
```http
GET /facebook-accounts/stats
Authorization: Bearer {access_token}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_accounts": 10,
    "active_accounts": 8,
    "idle_accounts": 1,
    "error_accounts": 1,
    "avg_health_score": 92.5,
    "total_tasks_today": 156,
    "success_rate": 98.7,
    "by_status": {
      "active": 8,
      "idle": 1,
      "error": 1,
      "disabled": 0,
      "banned": 0
    },
    "by_group": {
      "营销账号": 5,
      "客服账号": 3,
      "未分组": 2
    }
  }
}
```

### 账号分组管理

#### 获取分组列表
```http
GET /account-groups
Authorization: Bearer {access_token}
```

#### 创建分组
```http
POST /account-groups
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "新分组",
  "description": "用于营销活动的账号分组",
  "color": "#FF6B6B",
  "account_ids": ["acc_1", "acc_2"]
}
```

#### 更新分组
```http
PATCH /account-groups/{id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "更新后的分组名",
  "description": "更新描述"
}
```

#### 删除分组
```http
DELETE /account-groups/{id}
Authorization: Bearer {access_token}
```

#### 分组添加账号
```http
POST /account-groups/{id}/accounts
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "account_ids": ["acc_3", "acc_4"]
}
```

#### 按组执行任务
```http
POST /account-groups/{id}/execute
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "task_type": "post",
  "content": "分组发布内容",
  "scheduled_at": "2026-04-13T15:00:00Z"
}
```

---

## 任务调度API

### 任务列表
```http
GET /tasks
Authorization: Bearer {access_token}
```

**查询参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| page | integer | 1 | 页码 |
| limit | integer | 20 | 每页数量 |
| status | string | - | 状态过滤 |
| type | string | - | 类型过滤 |
| account_id | string | - | 账号ID过滤 |
| start_date | string | - | 开始时间 |
| end_date | string | - | 结束时间 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task_123",
        "name": "每日问候",
        "type": "message",
        "status": "completed",
        "account": {
          "id": "acc_1",
          "name": "我的Facebook页面"
        },
        "scheduled_at": "2026-04-13T09:00:00Z",
        "executed_at": "2026-04-13T09:00:05Z",
        "result": {
          "success": true,
          "message": "消息发送成功",
          "data": {
            "post_id": "1234567890_987654321"
          }
        }
      }
    ],
    "pagination": {
      "total": 245,
      "page": 1,
      "limit": 20,
      "pages": 13
    }
  }
}
```

### 创建任务
```http
POST /tasks
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "发布新产品",
  "type": "post",
  "content": {
    "text": "新产品上线啦！🎉\n快来体验我们的最新功能！",
    "images": ["https://example.com/image1.jpg"],
    "link": "https://example.com/product"
  },
  "account_ids": ["acc_1", "acc_2", "acc_3"],
  "scheduled_at": "2026-04-13T14:00:00Z",
  "repeat": {
    "type": "daily",
    "interval": 1,
    "end_date": "2026-04-20T23:59:59Z"
  },
  "options": {
    "retry_count": 3,
    "timeout": 300,
    "priority": "high"
  }
}
```

**任务类型**:
- `post`: 发布内容
- `message`: 发送消息
- `comment`: 回复评论
- `like`: 点赞
- `share`: 分享
- `follow`: 关注
- `collect`: 收集数据

### 任务详情
```http
GET /tasks/{id}
Authorization: Bearer {access_token}
```

### 更新任务
```http
PATCH /tasks/{id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "更新后的任务名",
  "status": "paused",
  "scheduled_at": "2026-04-13T15:00:00Z"
}
```

### 删除任务
```http
DELETE /tasks/{id}
Authorization: Bearer {access_token}
```

### 立即执行任务
```http
POST /tasks/{id}/execute
Authorization: Bearer {access_token}
```

### 任务统计
```http
GET /tasks/stats
Authorization: Bearer {access_token}
```

**查询参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| period | string | today | 统计周期（today, week, month, year） |
| group_by | string | type | 分组方式（type, status, account） |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_tasks": 156,
    "completed_tasks": 150,
    "failed_tasks": 6,
    "success_rate": 96.15,
    "avg_execution_time": 2.5,
    "by_type": {
      "post": 80,
      "message": 45,
      "comment": 20,
      "like": 11
    },
    "by_status": {
      "completed": 150,
      "failed": 6,
      "pending": 15,
      "running": 5
    },
    "trend": {
      "daily": [45, 52, 48, 56, 49, 51, 55],
      "weekly": [320, 345, 312, 356],
      "monthly": [1250, 1320, 1280]
    }
  }
}
```

### 任务模板

#### 获取模板列表
```http
GET /task-templates
Authorization: Bearer {access_token}
```

#### 创建模板
```http
POST /task-templates
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "产品发布模板",
  "description": "用于新产品发布的标准化模板",
  "type": "post",
  "content": {
    "text": "🎉 新产品上线！\n{product_name} 现已发布！\n👉 点击了解更多：{product_link}",
    "variables": ["product_name", "product_link"]
  },
  "category": "marketing",
  "is_public": false
}
```

#### 使用模板创建任务
```http
POST /task-templates/{id}/create-task
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "account_ids": ["acc_1# API接口文档 - 续篇

## JavaScript/Node.js示例
```javascript
const axios = require('axios');

class FacebookAutoBotClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }
  
  async login(email, password) {
    try {
      const response = await this.client.post('/auth/login', {
        email,
        password
      });
      
      if (response.data.success) {
        const token = response.data.data.access_token;
        this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        return response.data.data;
      } else {
        throw new Error(response.data.error.message);
      }
    } catch (error) {
      console.error('登录失败:', error.message);
      throw error;
    }
  }
  
  async getAccounts(page = 1, limit = 20) {
    try {
      const response = await this.client.get('/facebook-accounts', {
        params: { page, limit }
      });
      return response.data.data;
    } catch (error) {
      console.error('获取账号列表失败:', error.message);
      throw error;
    }
  }
  
  async createTask(taskData) {
    try {
      const response = await this.client.post('/tasks', taskData);
      return response.data.data;
    } catch (error) {
      console.error('创建任务失败:', error.message);
      throw error;
    }
  }
  
  async getSystemHealth() {
    try {
      const response = await this.client.get('/health');
      return response.data.data;
    } catch (error) {
      console.error('获取系统健康状态失败:', error.message);
      throw error;
    }
  }
}

// 使用示例
async function main() {
  const client = new FacebookAutoBotClient('https://api.fbautobot.com');
  
  try {
    // 登录
    await client.login('your_email@example.com', 'your_password');
    console.log('登录成功');
    
    // 获取账号列表
    const accounts = await client.getAccounts();
    console.log(`账号数量: ${accounts.accounts.length}`);
    
    // 创建任务
    const taskData = {
      name: 'API测试任务',
      type: 'post',
      content: {
        text: '这是通过API创建的任务 📱',
        images: []
      },
      account_ids: ['acc_1', 'acc_2'],
      scheduled_at: new Date(Date.now() + 3600000).toISOString()
    };
    
    const task = await client.createTask(taskData);
    console.log(`任务创建成功: ${task.id}`);
    
    // 检查系统健康
    const health = await client.getSystemHealth();
    console.log(`系统状态: ${health.status}`);
    
  } catch (error) {
    console.error('操作失败:', error.message);
  }
}

main();
```

### cURL示例
```bash
#!/bin/bash

# 配置
BASE_URL="https://api.fbautobot.com"
EMAIL="user@example.com"
PASSWORD="your_password"

# 1. 登录获取令牌
echo "=== 登录获取访问令牌 ==="
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.access_token')
REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.refresh_token')

if [ "$ACCESS_TOKEN" = "null" ]; then
  echo "登录失败"
  exit 1
fi

echo "访问令牌获取成功"

# 2. 获取账号列表
echo "=== 获取账号列表 ==="
ACCOUNTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/facebook-accounts" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json")

echo $ACCOUNTS_RESPONSE | jq '.data.accounts[0:3]'

# 3. 创建任务
echo "=== 创建新任务 ==="
TASK_DATA='{
  "name": "cURL测试任务",
  "type": "post",
  "content": {
    "text": "通过cURL创建的任务 🚀",
    "images": []
  },
  "account_ids": ["acc_1"],
  "scheduled_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'

TASK_RESPONSE=$(curl -s -X POST "${BASE_URL}/tasks" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${TASK_DATA}")

TASK_ID=$(echo $TASK_RESPONSE | jq -r '.data.id')
echo "任务创建成功: ${TASK_ID}"

# 4. 获取系统健康状态
echo "=== 检查系统健康 ==="
HEALTH_RESPONSE=$(curl -s -X GET "${BASE_URL}/health" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo $HEALTH_RESPONSE | jq '.data.status'

# 5. 刷新令牌（如果需要）
echo "=== 刷新访问令牌 ==="
REFRESH_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"${REFRESH_TOKEN}\"}")

NEW_ACCESS_TOKEN=$(echo $REFRESH_RESPONSE | jq -r '.data.access_token')
echo "令牌刷新成功"
```

### Postman集合示例
```json
{
  "info": {
    "name": "Facebook Auto Bot API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "认证",
      "item": [
        {
          "name": "用户登录",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"{{email}}\",\n  \"password\": \"{{password}}\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/auth/login",
              "host": ["{{base_url}}"],
              "path": ["auth", "login"]
            }
          },
          "response": []
        },
        {
          "name": "获取用户资料",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/auth/profile",
              "host": ["{{base_url}}"],
              "path": ["auth", "profile"]
            }
          }
        }
      ]
    },
    {
      "name": "Facebook账号管理",
      "item": [
        {
          "name": "获取账号列表",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/facebook-accounts?page=1&limit=20",
              "host": ["{{base_url}}"],
              "path": ["facebook-accounts"],
              "query": [
                {
                  "key": "page",
                  "value": "1"
                },
                {
                  "key": "limit",
                  "value": "20"
                }
              ]
            }
          }
        },
        {
          "name": "创建Facebook账号",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"name\": \"测试账号\",\n  \"facebook_email\": \"fb_test@example.com\",\n  \"facebook_password\": \"fb_password\",\n  \"login_method\": \"web\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/facebook-accounts",
              "host": ["{{base_url}}"],
              "path": ["facebook-accounts"]
            }
          }
        }
      ]
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "https://api.fbautobot.com",
      "type": "string"
    },
    {
      "key": "access_token",
      "value": "",
      "type": "string"
    },
    {
      "key": "email",
      "value": "user@example.com",
      "type": "string"
    },
    {
      "key": "password",
      "value": "your_password",
      "type": "string"
    }
  ]
}
```

---

## 最佳实践

### 1. 认证和安全
- **令牌管理**: 定期刷新访问令牌，避免使用过期令牌
- **安全存储**: 不要将令牌硬编码在客户端代码中
- **权限控制**: 遵循最小权限原则，只请求必要的权限
- **HTTPS**: 始终使用HTTPS进行API通信

### 2. 错误处理
```javascript
// 良好的错误处理示例
async function callApiWithRetry(apiCall, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      // 如果是临时错误，等待后重试
      if (error.response?.status >= 500) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(`API调用失败，${delay}ms后重试 (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // 如果是客户端错误，不重试
      break;
    }
  }
  
  throw lastError;
}
```

### 3. 性能优化
- **批量操作**: 使用批量API减少请求次数
- **分页查询**: 对于大量数据使用分页
- **缓存响应**: 缓存不经常变化的数据
- **压缩传输**: 启用gzip压缩减少数据传输量

### 4. 监控和日志
```javascript
// API调用监控
class ApiMonitor {
  constructor() {
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalLatency: 0
    };
  }
  
  async trackApiCall(apiCall, endpoint) {
    const startTime = Date.now();
    this.metrics.totalCalls++;
    
    try {
      const result = await apiCall();
      const latency = Date.now() - startTime;
      
      this.metrics.successfulCalls++;
      this.metrics.totalLatency += latency;
      
      // 记录成功指标
      console.log(`API调用成功: ${endpoint}, 耗时: ${latency}ms`);
      
      return result;
    } catch (error) {
      this.metrics.failedCalls++;
      
      // 记录错误详情
      console.error(`API调用失败: ${endpoint}`, {
        error: error.message,
        status: error.response?.status,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalCalls > 0 
        ? (this.metrics.successfulCalls / this.metrics.totalCalls * 100).toFixed(2)
        : 0,
      avgLatency: this.metrics.successfulCalls > 0
        ? (this.metrics.totalLatency / this.metrics.successfulCalls).toFixed(2)
        : 0
    };
  }
}
```

### 5. 版本控制
- **API版本**: 在URL中包含版本号 `/v1/endpoint`
- **向后兼容**: 保持旧版本API的兼容性
- **弃用通知**: 提前通知API弃用计划
- **迁移指南**: 提供版本迁移文档

### 6. 限流处理
```javascript
// 限流处理示例
class RateLimiter {
  constructor(requestsPerMinute) {
    this.requestsPerMinute = requestsPerMinute;
    this.requests = [];
  }
  
  async waitIfNeeded() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // 清理过期的请求记录
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    
    // 检查是否超过限制
    if (this.requests.length >= this.requestsPerMinute) {
      const oldestRequest = this.requests[0];
      const waitTime = 60000 - (now - oldestRequest);
      
      if (waitTime > 0) {
        console.log(`达到速率限制，等待 ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // 记录本次请求
    this.requests.push(Date.now());
  }
  
  async callWithRateLimit(apiCall) {
    await this.waitIfNeeded();
    return await apiCall();
  }
}

// 使用示例
const limiter = new RateLimiter(60); // 60次/分钟

async function makeApiCall() {
  return await limiter.callWithRateLimit(() => {
    return fetch('https://api.fbautobot.com/endpoint');
  });
}
```

### 7. 数据验证
```javascript
// 请求数据验证
class RequestValidator {
  static validateCreateTaskRequest(data) {
    const errors = [];
    
    // 验证必填字段
    if (!data.name || data.name.trim().length < 2) {
      errors.push('任务名称必须至少2个字符');
    }
    
    if (!data.type || !['post', 'message', 'comment', 'like', 'share'].includes(data.type)) {
      errors.push('无效的任务类型');
    }
    
    if (!data.content || typeof data.content !== 'object') {
      errors.push('内容不能为空');
    }
    
    if (!data.account_ids || !Array.isArray(data.account_ids) || data.account_ids.length === 0) {
      errors.push('必须指定至少一个账号');
    }
    
    // 验证时间格式
    if (data.scheduled_at) {
      const scheduledTime = new Date(data.scheduled_at);
      if (isNaN(scheduledTime.getTime())) {
        errors.push('计划时间格式无效');
      } else if (scheduledTime < new Date()) {
        errors.push('计划时间不能是过去时间');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// 使用示例
const taskData = {
  name: '测试任务',
  type: 'post',
  content: { text: 'Hello' },
  account_ids: ['acc_1'],
  scheduled_at: '2026-04-13T15:00:00Z'
};

const validation = RequestValidator.validateCreateTaskRequest(taskData);
if (!validation.isValid) {
  console.error('验证失败:', validation.errors);
}
```

---

## 附录

### A. API端点汇总
| 类别 | 端点 | 方法 | 描述 |
|------|------|------|------|
| 认证 | `/auth/login` | POST | 用户登录 |
| 认证 | `/auth/register` | POST | 用户注册 |
| 认证 | `/auth/refresh` | POST | 刷新令牌 |
| 认证 | `/auth/profile` | GET | 获取用户资料 |
| 用户 | `/users` | GET | 获取用户列表 |
| 用户 | `/users/{id}` | GET | 获取用户详情 |
| 账号 | `/facebook-accounts` | GET | 获取账号列表 |
| 账号 | `/facebook-accounts` | POST | 创建账号 |
| 账号 | `/facebook-accounts/{id}` | GET | 获取账号详情 |
| 账号 | `/facebook-accounts/stats` | GET | 账号统计 |
| 任务 | `/tasks` | GET | 获取任务列表 |
| 任务 | `/tasks` | POST | 创建任务 |
| 任务 | `/tasks/{id}` | GET | 获取任务详情 |
| 任务 | `/tasks/stats` | GET | 任务统计 |
| 剧本 | `/conversation/scripts` | GET | 获取剧本列表 |
| 剧本 | `/conversation/scripts` | POST | 创建剧本 |
| 监控 | `/health` | GET | 系统健康检查 |
| 监控 | `/metrics` | GET | 系统指标 |
| 监控 | `/alerts` | GET | 告警列表 |

### B. 数据模型参考
#### 用户模型
```typescript
interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user';
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
  last_login_at: string;
}
```

#### Facebook账号模型
```typescript
interface FacebookAccount {
  id: string;
  name: string;
  facebook_id: string;
  status: 'active' | 'idle' | 'error' | 'disabled' | 'banned';
  health_score: number;
  last_login_at: string;
  task_success_rate: number;
  group_id?: string;
  vpn_config_id?: string;
  created_at: string;
  updated_at: string;
}
```

#### 任务模型
```typescript
interface Task {
  id: