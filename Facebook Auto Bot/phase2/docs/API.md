# Puppeteer Executor API 文档

## 概述

Puppeteer Executor 是一个基于 Puppeteer 的浏览器自动化执行引擎，专门为 Facebook 自动化任务设计。它提供了会话管理、反检测、人类行为模拟等功能。

## 安装

```bash
# 从npm安装
npm install @facebook-bot/puppeteer-executor

# 或从源码构建
git clone <repository-url>
cd phase2/packages/puppeteer-executor
npm install
npm run build
```

## 快速开始

### 基本使用

```typescript
import { PuppeteerExecutor, FacebookLoginModule } from '@facebook-bot/puppeteer-executor';

async function main() {
  // 创建执行器实例
  const executor = new PuppeteerExecutor({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // 创建会话
  const session = await executor.createSession({
    sessionId: 'my-session',
    stealthMode: true,
    humanBehavior: true
  });

  // 执行任务
  const result = await executor.executeTask(
    session.id,
    async (page) => {
      await page.goto('https://www.facebook.com');
      return await page.title();
    }
  );

  // 关闭会话
  await executor.closeSession(session.id);
}
```

### Facebook 登录

```typescript
async function loginToFacebook() {
  const executor = new PuppeteerExecutor();
  const session = await executor.createSession({
    sessionId: 'login-session'
  });

  const loginModule = new FacebookLoginModule(session.id);
  
  const result = await executor.executeTask(
    session.id,
    async (page) => {
      return await loginModule.login(page, {
        email: 'your-email@example.com',
        password: 'your-password',
        twoFactorCode: '123456' // 如果需要2FA
      });
    }
  );

  if (result.success) {
    console.log('Login successful! Cookies:', result.data?.cookies);
  } else {
    console.error('Login failed:', result.error);
  }

  await executor.closeSession(session.id);
}
```

## API 参考

### PuppeteerExecutor 类

#### 构造函数

```typescript
new PuppeteerExecutor(config?: Partial<PuppeteerConfig>)
```

**配置选项：**

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `headless` | boolean \| 'new' | 'new' | 是否使用无头模式 |
| `args` | string[] | 见下文 | Chrome启动参数 |
| `defaultViewport` | object | { width: 1920, height: 1080 } | 默认视口大小 |
| `ignoreHTTPSErrors` | boolean | true | 是否忽略HTTPS错误 |
| `executablePath` | string | undefined | Chrome可执行文件路径 |
| `userDataDir` | string | undefined | 用户数据目录 |
| `slowMo` | number | undefined | 操作延迟（毫秒） |

**默认启动参数：**
- `--no-sandbox`
- `--disable-setuid-sandbox`
- `--disable-dev-shm-usage`
- `--disable-accelerated-2d-canvas`
- `--disable-gpu`
- `--window-size=1920,1080`
- `--disable-web-security`
- `--disable-features=IsolateOrigins,site-per-process`
- `--disable-blink-features=AutomationControlled`

#### 方法

##### `createSession(config?: Partial<SessionConfig>): Promise<BrowserSession>`

创建新的浏览器会话。

**参数：**
- `config`: 会话配置（可选）

**返回值：** `Promise<BrowserSession>`

**示例：**
```typescript
const session = await executor.createSession({
  sessionId: 'unique-session-id',
  accountId: 'facebook-account-1',
  stealthMode: true,
  humanBehavior: true,
  viewport: { width: 1366, height: 768 }
});
```

##### `getSession(sessionId: string): BrowserSession | undefined`

获取指定ID的会话。

##### `closeSession(sessionId: string): Promise<void>`

关闭指定ID的会话。

##### `executeTask<T>(sessionId: string, task: Function, options?: ExecuteOptions): Promise<ExecutionResult<T>>`

在指定会话中执行任务。

**参数：**
- `sessionId`: 会话ID
- `task`: 任务函数，接收 `(page, session)` 参数
- `options`: 执行选项（可选）

**执行选项：**
```typescript
interface ExecuteOptions {
  timeout?: number;          // 超时时间（毫秒），默认30000
  retryCount?: number;       // 重试次数，默认3
  captureScreenshot?: boolean; // 失败时是否捕获截图，默认true
}
```

**示例：**
```typescript
const result = await executor.executeTask(
  session.id,
  async (page, session) => {
    await page.goto('https://www.facebook.com');
    const title = await page.title();
    return { title, sessionId: session.id };
  },
  {
    timeout: 60000,
    retryCount: 2
  }
);
```

##### `restoreSession(config: SessionConfig): Promise<BrowserSession>`

从配置恢复会话（包括cookies和localStorage）。

##### `getActiveSessions(): BrowserSession[]`

获取所有活动会话。

##### `cleanupIdleSessions(maxIdleTime?: number): Promise<void>`

清理空闲时间超过指定毫秒数的会话。

##### `destroy(): Promise<void>`

销毁所有会话并清理资源。

### FacebookLoginModule 类

#### 构造函数

```typescript
new FacebookLoginModule(sessionId: string)
```

#### 方法

##### `login(page: any, credentials: LoginCredentials): Promise<LoginResult>`

执行Facebook登录。

**参数：**
- `page`: Puppeteer页面对象
- `credentials`: 登录凭据

**返回值：** `Promise<LoginResult>`

**登录结果：**
```typescript
interface LoginResult {
  success: boolean;
  sessionId?: string;
  cookies?: any[];
  error?: string;
  requiresTwoFactor?: boolean;
  requiresCaptcha?: boolean;
  duration: number;
}
```

##### `checkLoginStatus(page: any): Promise<boolean>`

检查当前登录状态。

##### `logout(page: any): Promise<boolean>`

安全登出。

### HumanBehaviorSimulator 类

#### 构造函数

```typescript
new HumanBehaviorSimulator(options?: Partial<HumanBehaviorOptions>)
```

**选项：**
```typescript
interface HumanBehaviorOptions {
  minDelay: number;          // 最小延迟（毫秒）
  maxDelay: number;          // 最大延迟（毫秒）
  mouseMovement: boolean;    // 是否模拟鼠标移动
  randomScroll: boolean;     // 是否随机滚动
  typingSpeed: 'slow' | 'normal' | 'fast'; // 打字速度
}
```

#### 方法

##### `randomDelay(min?: number, max?: number): Promise<void>`

随机延迟。

##### `simulateMouseMovement(page, fromX, fromY, toX, toY): Promise<void>`

模拟人类鼠标移动。

##### `simulateHumanClick(page, selector): Promise<void>`

模拟人类点击。

##### `simulateHumanTyping(page, selector, text): Promise<void>`

模拟人类输入。

##### `simulateRandomScroll(page): Promise<void>`

模拟随机滚动。

##### `simulateBrowsingBehavior(page): Promise<void>`

模拟人类浏览行为。

## 类型定义

### PuppeteerConfig

浏览器配置。

### SessionConfig

会话配置。

### BrowserSession

浏览器会话对象。

### LoginCredentials

登录凭据。

### ExecutionResult

任务执行结果。

### HumanBehaviorOptions

人类行为模拟选项。

## 错误处理

### 常见错误

1. **会话不存在错误**
   ```typescript
   try {
     await executor.executeTask('non-existent-session', ...);
   } catch (error) {
     console.error('Session not found:', error.message);
   }
   ```

2. **任务超时错误**
   ```typescript
   const result = await executor.executeTask(sessionId, task, { timeout: 10000 });
   if (!result.success && result.error?.includes('timeout')) {
     console.log('Task timed out');
   }
   ```

3. **登录失败错误**
   ```typescript
   const loginResult = await loginModule.login(page, credentials);
   if (!loginResult.success) {
     if (loginResult.requiresTwoFactor) {
       console.log('2FA required');
     } else if (loginResult.requiresCaptcha) {
       console.log('Captcha required');
     } else {
       console.error('Login failed:', loginResult.error);
     }
   }
   ```

### 重试机制

执行器内置了重试机制，可以通过 `retryCount` 选项配置：

```typescript
const result = await executor.executeTask(
  sessionId,
  task,
  { retryCount: 3 } // 最多重试3次
);
```

## 最佳实践

### 1. 会话管理

```typescript
// 正确：及时关闭不再使用的会话
const session = await executor.createSession({ sessionId: 'temp' });
try {
  // 使用会话
  await executor.executeTask(session.id, ...);
} finally {
  await executor.closeSession(session.id);
}

// 错误：不关闭会话会导致资源泄漏
const session = await executor.createSession({ sessionId: 'temp' });
// 使用后不关闭
```

### 2. 错误处理

```typescript
// 正确：全面处理错误
const result = await executor.executeTask(sessionId, task);
if (!result.success) {
  console.error('Task failed:', result.error);
  if (result.screenshots?.length) {
    console.log('Screenshots captured:', result.screenshots);
  }
}

// 错误：忽略错误信息
const result = await executor.executeTask(sessionId, task);
if (!result.success) {
  console.error('Task failed'); // 没有具体错误信息
}
```

### 3. 性能优化

```typescript
// 正确：合理配置超时和重试
const result = await executor.executeTask(
  sessionId,
  task,
  {
    timeout: 30000, // 根据任务复杂度设置
    retryCount: 2,  // 根据网络稳定性设置
    captureScreenshot: true // 生产环境建议开启
  }
);

// 错误：不合理的配置
const result = await executor.executeTask(
  sessionId,
  simpleTask,
  {
    timeout: 600000, // 10分钟太长
    retryCount: 10   // 重试次数太多
  }
);
```

## 示例项目

完整的示例项目可以在 `examples/` 目录中找到：

- `basic-usage.ts` - 基本使用示例
- `facebook-automation.ts` - Facebook自动化示例
- `multi-session.ts` - 多会话管理示例

## 故障排除

### 常见问题

1. **Chrome启动失败**
   - 检查系统是否安装了Chrome
   - 检查Docker容器是否有足够的权限
   - 尝试添加 `--no-sandbox` 参数

2. **登录被检测为机器人**
   - 确保启用了 `stealthMode`
   - 启用 `humanBehavior` 模拟
   - 使用真实的User-Agent

3. **内存泄漏**
   - 定期调用 `cleanupIdleSessions()`
   - 确保所有会话都被正确关闭
   - 监控Docker容器内存使用情况

### 调试技巧

1. **启用详细日志**
   ```typescript
   const executor = new PuppeteerExecutor({
     headless: false, // 可视化调试
     slowMo: 100      // 慢动作模式，便于观察
   });
   ```

2. **捕获截图**
   ```typescript
   const result = await executor.executeTask(
     sessionId,
     task,
     { captureScreenshot: true }
   );
   
   if (!result.success && result.screenshots) {
     // 分析失败时的截图
   }
   ```

3. **检查网络请求**
   ```typescript
   page.on('request', request => {
     console.log('Request:', request.url());
   });
   
   page.on('response', response => {
     console.log('Response:', response.status(), response.url());
   });
   ```

## 安全注意事项

1. **凭据安全**
   - 不要硬编码凭据
   - 使用环境变量或密钥管理服务
   - 加密存储会话数据

2. **合规性**
   - Facebook自动化可能违反服务条款
   - 仅在测试环境或获得授权的情况下使用
   - 尊重速率限制和反滥用机制

3. **数据保护**
   - 清理临时文件和截图
   - 加密敏感数据
   - 定期审计日志文件