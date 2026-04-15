import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import UserPreferencesPlugin from 'puppeteer-extra-plugin-user-preferences';
import UserDataDirPlugin from 'puppeteer-extra-plugin-user-data-dir';
import { v4 as uuidv4 } from 'uuid';
import { SessionLogger } from '../utils/logger';
import { HumanBehaviorSimulator } from '../utils/human-behavior';
import {
  PuppeteerConfig,
  SessionConfig,
  BrowserSession,
  LoginCredentials,
  LoginResult,
  ExecutionResult,
  HumanBehaviorOptions
} from '../types';

export class PuppeteerExecutor {
  private config: PuppeteerConfig;
  private sessions: Map<string, BrowserSession> = new Map();
  private logger: SessionLogger;
  private humanBehavior: HumanBehaviorSimulator;

  constructor(config?: Partial<PuppeteerConfig>) {
    // 配置puppeteer-extra插件
    puppeteer.use(StealthPlugin());
    puppeteer.use(RecaptchaPlugin({
      provider: {
        id: '2captcha',
        token: process.env.TWO_CAPTCHA_API_KEY || ''
      }
    }));
    puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
    puppeteer.use(UserPreferencesPlugin({
      userPreferences: {
        'download.default_directory': '/tmp/downloads',
        'profile.default_content_setting_values.notifications': 2
      }
    }));
    puppeteer.use(UserDataDirPlugin());

    this.config = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      },
      ignoreHTTPSErrors: true,
      ...config
    };

    this.logger = new SessionLogger('SYSTEM');
    this.humanBehavior = new HumanBehaviorSimulator();
  }

  /**
   * 创建新的浏览器会话
   */
  async createSession(sessionConfig: Partial<SessionConfig> = {}): Promise<BrowserSession> {
    const sessionId = sessionConfig.sessionId || uuidv4();
    const logger = new SessionLogger(sessionId);

    try {
      logger.info('Starting new browser session');

      // 创建浏览器实例
      const browser = await puppeteer.launch({
        ...this.config,
        headless: sessionConfig.stealthMode ? false : this.config.headless,
        args: [
          ...this.config.args,
          ...(sessionConfig.userAgent ? [`--user-agent=${sessionConfig.userAgent}`] : [])
        ]
      });

      // 创建页面
      const page = await browser.newPage();

      // 设置视口
      if (sessionConfig.viewport) {
        await page.setViewport(sessionConfig.viewport);
      }

      // 设置User-Agent
      if (sessionConfig.userAgent) {
        await page.setUserAgent(sessionConfig.userAgent);
      }

      // 启用JavaScript
      await page.setJavaScriptEnabled(true);

      // 设置额外的HTTP头
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      // 注入stealth脚本
      await this.injectStealthScripts(page);

      const session: BrowserSession = {
        id: sessionId,
        browser,
        page,
        config: {
          sessionId,
          accountId: sessionConfig.accountId || '',
          cookies: sessionConfig.cookies || [],
          localStorage: sessionConfig.localStorage || {},
          userAgent: sessionConfig.userAgent,
          viewport: sessionConfig.viewport,
          stealthMode: sessionConfig.stealthMode !== false,
          humanBehavior: sessionConfig.humanBehavior !== false
        },
        status: 'idle',
        lastActivity: new Date(),
        errorCount: 0
      };

      this.sessions.set(sessionId, session);
      logger.info('Browser session created successfully');

      return session;
    } catch (error) {
      logger.error('Failed to create browser session', error as Error);
      throw error;
    }
  }

  /**
   * 注入反检测脚本
   */
  private async injectStealthScripts(page: any): Promise<void> {
    // 隐藏WebDriver属性
    await page.evaluateOnNewDocument(() => {
      // 隐藏navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });

      // 隐藏chrome属性
      Object.defineProperty(window, 'chrome', {
        get: () => undefined
      });

      // 修改plugins长度
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // 修改languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
    });
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 关闭会话
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const logger = new SessionLogger(sessionId);
    try {
      logger.info('Closing browser session');
      
      // 保存会话数据（如果需要）
      await this.saveSessionData(session);
      
      // 关闭浏览器
      await session.browser.close();
      
      this.sessions.delete(sessionId);
      logger.info('Browser session closed successfully');
    } catch (error) {
      logger.error('Failed to close browser session', error as Error);
      throw error;
    }
  }

  /**
   * 保存会话数据
   */
  private async saveSessionData(session: BrowserSession): Promise<void> {
    try {
      // 保存cookies
      const cookies = await session.page.cookies();
      session.config.cookies = cookies;

      // 保存localStorage
      const localStorage = await session.page.evaluate(() => {
        const items = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            items[key] = localStorage.getItem(key);
          }
        }
        return items;
      });
      session.config.localStorage = localStorage;

      // 这里可以添加将数据保存到数据库的逻辑
    } catch (error) {
      // 保存失败不影响主流程
      const logger = new SessionLogger(session.id);
      logger.warn('Failed to save session data', { error: (error as Error).message });
    }
  }

  /**
   * 恢复会话
   */
  async restoreSession(sessionConfig: SessionConfig): Promise<BrowserSession> {
    const logger = new SessionLogger(sessionConfig.sessionId);
    
    try {
      logger.info('Restoring browser session');

      // 创建新会话
      const session = await this.createSession(sessionConfig);

      // 恢复cookies
      if (sessionConfig.cookies && sessionConfig.cookies.length > 0) {
        await session.page.setCookie(...sessionConfig.cookies);
      }

      // 恢复localStorage
      if (sessionConfig.localStorage && Object.keys(sessionConfig.localStorage).length > 0) {
        await session.page.evaluate((storage) => {
          for (const [key, value] of Object.entries(storage)) {
            localStorage.setItem(key, value as string);
          }
        }, sessionConfig.localStorage);
      }

      logger.info('Browser session restored successfully');
      return session;
    } catch (error) {
      logger.error('Failed to restore browser session', error as Error);
      throw error;
    }
  }

  /**
   * 执行任务
   */
  async executeTask<T>(
    sessionId: string,
    task: (page: any, session: BrowserSession) => Promise<T>,
    options?: {
      timeout?: number;
      retryCount?: number;
      captureScreenshot?: boolean;
    }
  ): Promise<ExecutionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const logger = new SessionLogger(sessionId);
    const startTime = Date.now();
    const timeout = options?.timeout || 30000;
    const retryCount = options?.retryCount || 3;
    const captureScreenshot = options?.captureScreenshot !== false;

    let lastError: Error | undefined;
    let screenshots: string[] = [];

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        logger.info(`Executing task (attempt ${attempt}/${retryCount})`);

        // 更新会话状态
        session.status = 'busy';
        session.lastActivity = new Date();

        // 设置超时
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Task timeout after ${timeout}ms`)), timeout);
        });

        // 执行任务
        const data = await Promise.race([
          task(session.page, session),
          timeoutPromise
        ]);

        // 更新会话状态
        session.status = 'idle';
        session.errorCount = 0;

        const duration = Date.now() - startTime;
        logger.info(`Task completed successfully in ${duration}ms`);

        return {
          success: true,
          data,
          duration,
          screenshots
        };
      } catch (error) {
        lastError = error as Error;
        session.errorCount++;
        logger.error(`Task failed on attempt ${attempt}`, error as Error);

        // 捕获截图（如果启用）
        if (captureScreenshot) {
          try {
            const screenshot = await this.captureScreenshot(session);
            screenshots.push(screenshot);
          } catch (screenshotError) {
            logger.warn('Failed to capture screenshot', { error: (screenshotError as Error).message });
          }
        }

        // 如果不是最后一次尝试，等待后重试
        if (attempt < retryCount) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          logger.info(`Waiting ${retryDelay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // 所有尝试都失败
    session.status = 'error';
    const duration = Date.now() - startTime;
    
    logger.error(`Task failed after ${retryCount} attempts`, lastError);

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      duration,
      screenshots
    };
  }

  /**
   * 捕获截图
   */
  private async captureScreenshot(session: BrowserSession): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${session.id}-${timestamp}.png`;
    const filepath = `/app/data/screenshots/${filename}`;

    await session.page.screenshot({
      path: filepath,
      fullPage: true
    });

    return filepath;
  }

  /**
   * 获取所有活动会话
   */
  getActiveSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 清理空闲会话
   */
  async cleanupIdleSessions(maxIdleTime: number = 30 * 60 * 1000): Promise<void> {
    const now = new Date();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const idleTime = now.getTime() - session.lastActivity.getTime();
      
      if (session.status === 'idle' && idleTime > maxIdleTime) {
        const logger = new SessionLogger(sessionId);
        logger.info(`Cleaning up idle session (idle for ${Math.floor(idleTime / 1000)}s)`);
        
        try {
          await this.closeSession(sessionId);
        } catch (error) {
          logger.error('Failed to cleanup idle session', error as Error);
        }
      }
    }
  }

  /**
   * 销毁所有会话
   */
  async destroy(): Promise<void> {
    const logger = new SessionLogger('SYSTEM');
    logger.info('Destroying all browser sessions');

    const closePromises = Array.from(this.sessions.keys()).map(sessionId =>
      this.closeSession(sessionId).catch(error => {
        logger.error(`Failed to close session ${sessionId}`, error as Error);
      })
    );

    await Promise.all(closePromises);
    this.sessions.clear();
    
    logger.info('All browser sessions destroyed');
  }
}