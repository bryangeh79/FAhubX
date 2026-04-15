import { PuppeteerExecutor, FacebookLoginModule } from '../src';

async function main() {
  console.log('Starting Facebook Auto Bot Puppeteer Executor...');

  // 创建Puppeteer执行器实例
  const executor = new PuppeteerExecutor({
    headless: false, // 开发时设置为false以便观察
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080'
    ]
  });

  try {
    // 创建新的浏览器会话
    const session = await executor.createSession({
      sessionId: 'test-session-1',
      accountId: 'test-account-1',
      stealthMode: true,
      humanBehavior: true
    });

    console.log(`Session created: ${session.id}`);

    // 创建Facebook登录模块
    const loginModule = new FacebookLoginModule(session.id);

    // 执行登录任务
    const loginResult = await executor.executeTask(
      session.id,
      async (page) => {
        return await loginModule.login(page, {
          email: process.env.FB_EMAIL || '',
          password: process.env.FB_PASSWORD || ''
        });
      },
      {
        timeout: 60000,
        retryCount: 2,
        captureScreenshot: true
      }
    );

    if (loginResult.success) {
      console.log('Login successful!');
      console.log('Cookies saved:', loginResult.data?.cookies?.length || 0);

      // 检查登录状态
      const statusResult = await executor.executeTask(
        session.id,
        async (page) => {
          return await loginModule.checkLoginStatus(page);
        }
      );

      if (statusResult.success && statusResult.data) {
        console.log('Login status verified: Logged in');
      } else {
        console.log('Login status verification failed');
      }

      // 执行一些简单的操作示例
      console.log('Performing some actions...');
      
      // 导航到个人主页
      const navigateResult = await executor.executeTask(
        session.id,
        async (page) => {
          await page.goto('https://www.facebook.com/me', {
            waitUntil: 'networkidle2',
            timeout: 15000
          });
          
          // 获取页面标题
          const title = await page.title();
          return { title, url: page.url() };
        }
      );

      if (navigateResult.success) {
        console.log('Navigation successful:', navigateResult.data);
      }

      // 等待一段时间观察
      console.log('Waiting 10 seconds before closing...');
      await new Promise(resolve => setTimeout(resolve, 10000));

    } else {
      console.error('Login failed:', loginResult.error);
      
      if (loginResult.requiresTwoFactor) {
        console.log('Two-factor authentication required');
      }
      
      if (loginResult.requiresCaptcha) {
        console.log('Captcha verification required');
      }
    }

    // 关闭会话
    await executor.closeSession(session.id);
    console.log('Session closed');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // 清理所有会话
    await executor.destroy();
    console.log('Executor destroyed');
  }
}

// 运行示例
if (require.main === module) {
  // 检查环境变量
  if (!process.env.FB_EMAIL || !process.env.FB_PASSWORD) {
    console.error('Please set FB_EMAIL and FB_PASSWORD environment variables');
    console.log('Example:');
    console.log('  export FB_EMAIL="your-email@example.com"');
    console.log('  export FB_PASSWORD="your-password"');
    console.log('  node dist/examples/basic-usage.js');
    process.exit(1);
  }

  main().catch(console.error);
}

export default main;