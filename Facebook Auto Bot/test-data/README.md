# 测试数据管理工具

## 概述
本目录包含Facebook Auto Bot项目的测试数据管理工具，用于生成、管理和清理测试数据。

## 目录结构
```
test-data/
├── generators/          # 测试数据生成器
│   ├── users.js        # 用户数据生成器
│   ├── accounts.js     # Facebook账号生成器
│   ├── tasks.js        # 任务数据生成器
│   └── scripts.js      # 对话剧本生成器
├── fixtures/           # 测试夹具数据
│   ├── users.json     # 测试用户数据
│   ├── accounts.json  # 测试账号数据
│   └── tasks.json     # 测试任务数据
├── scripts/           # 数据管理脚本
│   ├── setup.js       # 测试环境设置脚本
│   ├── cleanup.js     # 测试数据清理脚本
│   └── validate.js    # 数据验证脚本
└── schemas/           # 数据模式定义
    ├── user.schema.json
    ├── account.schema.json
    └── task.schema.json
```

## 使用方法

### 1. 生成测试数据
```bash
# 生成用户测试数据
node generators/users.js --count 10 --output fixtures/users.json

# 生成Facebook账号测试数据
node generators/accounts.js --count 20 --output fixtures/accounts.json

# 生成任务测试数据
node generators/tasks.js --count 15 --output fixtures/tasks.json
```

### 2. 设置测试环境
```bash
# 设置测试数据库和初始数据
node scripts/setup.js --env test --reset
```

### 3. 清理测试数据
```bash
# 清理测试数据
node scripts/cleanup.js --env test --all
```

## 数据生成器

### 用户数据生成器
生成测试用户数据，包括：
- 管理员用户
- 普通用户
- 测试用户

### Facebook账号生成器
生成测试Facebook账号数据，包括：
- 活跃账号
- 过期账号
- 被封禁账号
- 需要验证的账号

### 任务数据生成器
生成测试任务数据，包括：
- 立即执行任务
- 定时任务
- 重复任务
- 已禁用任务

## 数据模式

### 用户模式
```json
{
  "email": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "company": "string",
  "role": "ADMIN|USER",
  "status": "ACTIVE|INACTIVE|SUSPENDED"
}
```

### Facebook账号模式
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "cookies": "string",
  "status": "ACTIVE|EXPIRED|BANNED|NEEDS_VERIFICATION",
  "proxyType": "RESIDENTIAL|DATACENTER|MOBILE",
  "proxyHost": "string",
  "proxyPort": "number",
  "tags": "string[]",
  "notes": "string"
}
```

### 任务模式
```json
{
  "name": "string",
  "description": "string",
  "type": "POST|COMMENT|LIKE|SHARE|MESSAGE",
  "schedule": "IMMEDIATE|DAILY|WEEKLY|MONTHLY|CUSTOM",
  "scheduleTime": "string",
  "targetUrl": "string",
  "content": "string",
  "accounts": "string[]",
  "enabled": "boolean",
  "maxRetries": "number",
  "retryDelay": "number"
}
```

## 最佳实践

### 1. 数据隔离
- 每个测试用例使用独立的数据集
- 测试结束后清理所有测试数据
- 使用事务确保数据隔离

### 2. 数据真实性
- 使用真实的数据格式和约束
- 模拟真实业务场景
- 包含边界情况和异常数据

### 3. 数据可维护性
- 集中管理测试数据
- 版本控制测试数据
- 定期更新测试数据

### 4. 性能考虑
- 生成适量的测试数据
- 避免重复数据生成
- 缓存常用测试数据

## 集成指南

### 与测试框架集成
```javascript
// 在测试用例中使用测试数据
const testData = require('./fixtures/users.json');
const testUser = testData.users[0];

// 使用数据生成器
const UserGenerator = require('./generators/users');
const user = UserGenerator.generateUser({ role: 'ADMIN' });
```

### 与CI/CD集成
```yaml
# GitHub Actions配置
jobs:
  test:
    steps:
      - name: 生成测试数据
        run: node test-data/generators/users.js --count 5
      
      - name: 运行测试
        run: npm test
      
      - name: 清理测试数据
        run: node test-data/scripts/cleanup.js
```

## 故障排除

### 常见问题
1. **数据生成失败**: 检查数据模式定义
2. **数据库连接失败**: 检查环境变量配置
3. **数据验证失败**: 检查数据约束和格式

### 调试技巧
- 启用详细日志: `DEBUG=test-data* node script.js`
- 验证数据模式: `node scripts/validate.js --file data.json`
- 检查数据库状态: `node scripts/status.js --env test`

## 扩展开发

### 添加新的数据生成器
1. 在`generators/`目录创建新文件
2. 实现数据生成逻辑
3. 添加数据模式定义
4. 更新文档

### 添加新的数据管理脚本
1. 在`scripts/`目录创建新文件
2. 实现脚本逻辑
3. 添加命令行参数支持
4. 更新文档

## 安全注意事项
- 不要在生产环境中使用测试数据
- 测试数据中不要包含真实凭据
- 定期轮换测试数据中的敏感信息
- 测试结束后彻底清理测试数据