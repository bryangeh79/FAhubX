# Facebook Auto Bot - 端到端测试套件

## 概述
这是Facebook Auto Bot项目的端到端测试套件，基于Playwright框架构建，提供完整的自动化测试覆盖。

## 快速开始

### 1. 环境准备
```bash
# 安装依赖
cd /workspace/e2e-tests
npm install

# 安装Playwright浏览器
npx playwright install --with-deps
```

### 2. 运行测试
```bash
# 使用脚本运行测试（推荐）
./run-e2e-tests.sh

# 或直接使用Playwright
npx playwright test
```

### 3. 查看报告
```bash
# 生成Allure报告
npm run report:generate

# 打开报告
npm run report:open
```

## 测试结构

### 目录结构
```
e2e-tests/
├── fixtures/          # 测试夹具
│   ├── auth.fixture.ts      # 认证测试夹具
│   ├── accounts.fixture.ts  # 账号管理夹具
│   └── data.factory.ts      # 测试数据工厂
├── pages/             # 页面对象模型
│   ├── login.page.ts        # 登录页面
│   ├── dashboard.page.ts    # 仪表板页面
│   └── accounts.page.ts     # 账号管理页面
├── tests/             # 测试用例
│   ├── auth/                # 认证测试
│   │   ├── register.spec.ts # 注册测试
│   │   └── login.spec.ts    # 登录测试
│   └── accounts/            # 账号管理测试
│       └── create.spec.ts   # 创建账号测试
├── utils/             # 测试工具
│   ├── api.client.ts        # API客户端
│   └── db.helper.ts         # 数据库助手
└── reports/           # 测试报告
```

### 测试夹具
测试夹具提供了可重用的测试上下文：
- `auth.fixture.ts`: 用户认证相关夹具
- `accounts.fixture.ts`: Facebook账号管理夹具
- `data.factory.ts`: 测试数据生成工厂

### 页面对象模型
页面对象封装了页面交互逻辑：
- `LoginPage`: 登录页面操作
- `DashboardPage`: 仪表板页面操作  
- `AccountsPage`: 账号管理页面操作

### 测试工具
- `ApiClient`: 封装所有API调用
- `DatabaseHelper`: 数据库操作助手

## 测试用例

### 认证测试 (`tests/auth/`)
1. **注册测试** (`register.spec.ts`)
   - TC-AUTH-001: 新用户成功注册
   - TC-AUTH-002: 邮箱已存在时注册失败
   - TC-AUTH-003: 密码不符合要求时注册失败
   - TC-AUTH-004: 密码确认不匹配时注册失败
   - TC-AUTH-005: 必填字段为空时注册失败
   - TC-AUTH-006: 注册后自动跳转到登录页面
   - TC-AUTH-007: 注册表单字段验证
   - TC-AUTH-008: 注册页面链接功能

2. **登录测试** (`login.spec.ts`)
   - TC-AUTH-009: 用户使用正确凭据成功登录
   - TC-AUTH-010: 错误密码登录失败
   - TC-AUTH-011: 不存在的用户登录失败
   - TC-AUTH-012: 空凭据登录失败
   - TC-AUTH-013: 记住我功能
   - TC-AUTH-014: 登录后会话管理
   - TC-AUTH-015: 连续多次登录失败锁定
   - TC-AUTH-016: 登录页面链接功能
   - TC-AUTH-017: 登录后重定向到原请求页面
   - TC-AUTH-018: 不同角色用户登录
   - TC-AUTH-019: 登录表单输入验证

### 账号管理测试 (`tests/accounts/`)
1. **创建账号测试** (`create.spec.ts`)
   - TC-ACCOUNT-001: 成功创建Facebook账号
   - TC-ACCOUNT-002: 创建账号时必填字段验证
   - TC-ACCOUNT-003: 创建重复账号失败
   - TC-ACCOUNT-004: 创建账号时代理配置可选
   - TC-ACCOUNT-005: 创建账号时完整代理配置
   - TC-ACCOUNT-006: 创建账号时标签配置
   - TC-ACCOUNT-007: 创建账号时备注信息
   - TC-ACCOUNT-008: 创建账号时用户代理配置
   - TC-ACCOUNT-009: 创建账号时Cookie配置
   - TC-ACCOUNT-010: 创建账号时取消操作
   - TC-ACCOUNT-011: 批量创建账号
   - TC-ACCOUNT-012: 创建账号后自动刷新列表
   - TC-ACCOUNT-013: 创建账号时表单字段验证

## 配置说明

### 环境变量 (`.env.test`)
```bash
# 后端服务配置
BACKEND_URL=http://localhost:3001
BACKEND_TIMEOUT=30000

# 前端服务配置
FRONTEND_URL=http://localhost:5173
FRONTEND_TIMEOUT=30000

# 数据库配置
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=facebook_bot_test
DATABASE_USERNAME=test_user
DATABASE_PASSWORD=test_password

# 测试用户配置
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=Admin123!
TEST_USER_EMAIL=user@test.com
TEST_USER_PASSWORD=User123!
```

### Playwright配置 (`playwright.config.ts`)
- 支持多浏览器: Chromium, Firefox, Webkit, 移动端
- 并行测试执行
- 自动重试机制
- 详细的测试报告

## 测试执行脚本

### 基本用法
```bash
# 运行所有测试
./run-e2e-tests.sh

# 指定浏览器
./run-e2e-tests.sh -b firefox

# 运行特定测试
./run-e2e-tests.sh -t tests/auth/login.spec.ts

# 并行运行测试
./run-e2e-tests.sh -p

# 调试模式
./run-e2e-tests.sh -d --headed
```

### 高级选项
```bash
# 清理测试环境
./run-e2e-tests.sh --clean

# 只设置环境
./run-e2e-tests.sh --setup-only

# 只清理环境
./run-e2e-tests.sh --teardown-only

# 不生成报告
./run-e2e-tests.sh --no-report
```

## CI/CD集成

### GitHub Actions
测试套件已配置GitHub Actions工作流：
- 自动运行端到端测试
- 多浏览器矩阵测试
- 测试报告生成和上传
- Slack通知集成

### 本地CI
```bash
# 运行完整的CI流程
./run-e2e-tests.sh --clean
./run-e2e-tests.sh -b all -p
```

## 测试报告

### 报告类型
1. **Allure报告**: 交互式HTML报告，支持图表和筛选
2. **Playwright HTML报告**: 简单的HTML报告
3. **JUnit报告**: 机器可读的XML格式
4. **控制台输出**: 实时测试进度和结果

### 查看报告
```bash
# 生成Allure报告
npm run report:generate

# 本地查看报告
npm run report:serve

# 或直接打开
npx allure open reports/allure-report
```

## 开发指南

### 添加新测试
1. 在`tests/`目录创建新的测试文件
2. 使用现有的夹具和页面对象
3. 遵循测试命名规范
4. 添加详细的测试描述

### 添加新页面对象
1. 在`pages/`目录创建新的页面类
2. 封装页面元素和交互
3. 添加必要的等待和验证
4. 导出类供测试使用

### 添加新夹具
1. 在`fixtures/`目录创建新的夹具
2. 定义夹具类型和实现
3. 提供清理和初始化逻辑
4. 导出供测试使用

## 故障排除

### 常见问题
1. **测试失败**: 检查测试环境和服务状态
2. **浏览器启动失败**: 重新安装Playwright浏览器
3. **数据库连接失败**: 检查数据库配置和状态
4. **API调用失败**: 检查后端服务是否运行

### 调试技巧
```bash
# 启用调试模式
./run-e2e-tests.sh -d --headed

# 查看详细日志
./run-e2e-tests.sh -v

# 检查环境状态
curl http://localhost:3001/health
curl http://localhost:5173
```

## 最佳实践

### 测试设计
1. **原子性**: 每个测试独立运行
2. **可重复性**: 测试结果一致
3. **可维护性**: 清晰的代码结构
4. **可读性**: 有意义的测试名称

### 测试数据
1. **隔离性**: 每个测试使用独立数据
2. **真实性**: 使用真实的数据格式
3. **可管理性**: 集中管理测试数据
4. **可清理性**: 测试后自动清理

### 测试执行
1. **稳定性**: 使用重试和等待机制
2. **性能**: 优化测试执行时间
3. **并行性**: 支持并行执行
4. **报告**: 生成详细的测试报告

## 扩展计划

### 短期计划
1. 补充任务调度测试
2. 添加系统监控测试
3. 集成性能测试
4. 添加安全测试

### 长期计划
1. 实现测试数据版本控制
2. 添加AI测试生成
3. 集成混沌工程测试
4. 实现合规性测试

## 支持

如有问题或建议，请：
1. 查看详细文档: `E2E_TEST_SUITE.md`
2. 检查测试报告: `reports/`目录
3. 查看日志文件: `logs/`目录
4. 联系测试团队

---

**版本**: 1.0.0  
**最后更新**: 2026-04-13  
**维护者**: Facebook Auto Bot测试团队