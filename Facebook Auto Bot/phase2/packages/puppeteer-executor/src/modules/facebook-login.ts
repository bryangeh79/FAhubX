import { SessionLogger } from '../utils/logger';
import { HumanBehaviorSimulator } from '../utils/human-behavior';
import { LoginCredentials, LoginResult } from '../types';

export class FacebookLoginModule {
  private logger: SessionLogger;
  private humanBehavior: HumanBehaviorSimulator;

  constructor(sessionId: string) {
    this.logger = new SessionLogger(sessionId);
    this.humanBehavior = new HumanBehaviorSimulator();
  }

  /**
   * 执行Facebook登录
   */
  async login(
    page: any,
    credentials: LoginCredentials
  ): Promise<LoginResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting Facebook login process');

      // 导航到Facebook登录页面
      await page.goto('https://www.facebook.com/login', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 等待页面加载
      await page.waitForSelector('#email, input[name="email"]', { timeout: 10000 });
      await this.humanBehavior.randomDelay(1000, 2000);

      // 检查是否需要处理cookie同意
      await this.handleCookieConsent(page);

      // 输入邮箱
      await this.humanBehavior.simulateHumanTyping(page, '#email', credentials.email);
      await this.humanBehavior.randomDelay(500, 1500);

      // 输入密码
      await this.humanBehavior.simulateHumanTyping(page, '#pass', credentials.password);
      await this.humanBehavior.randomDelay(500, 1500);

      // 点击登录按钮
      await this.humanBehavior.simulateHumanClick(page, 'button[name="login"]');
      await this.humanBehavior.randomDelay(2000, 4000);

      // 检查登录结果
      const loginResult = await this.checkLoginResult(page, credentials);

      const duration = Date.now() - startTime;
      this.logger.info(`Login process completed in ${duration}ms`, {
        success: loginResult.success,
        requiresTwoFactor: loginResult.requiresTwoFactor,
        requiresCaptcha: loginResult.requiresCaptcha
      });

      return loginResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Login process failed after ${duration}ms`, error as Error);
      
      return {
        success: false,
        error: (error as Error).message,
        duration
      };
    }
  }

  /**
   * 处理cookie同意
   */
  private async handleCookieConsent(page: any): Promise<void> {
    try {
      // 检查是否有cookie同意弹窗
      const cookieSelectors = [
        'button[data-testid="cookie-policy-manage-dialog-accept-button"]',
        'button[data-cookiebanner="accept_button"]',
        'button[title="Allow all cookies"]',
        'button:contains("Allow all cookies")',
        'button:contains("Accept all")'
      ];

      for (const selector of cookieSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            this.logger.info('Found cookie consent dialog, accepting');
            await this.humanBehavior.simulateHumanClick(page, selector);
            await this.humanBehavior.randomDelay(1000, 2000);
            break;
          }
        } catch (error) {
          // 继续尝试下一个选择器
        }
      }
    } catch (error) {
      // 处理cookie同意失败不影响主流程
      this.logger.debug('No cookie consent dialog found or failed to handle');
    }
  }

  /**
   * 检查登录结果
   */
  private async checkLoginResult(
    page: any,
    credentials: LoginCredentials
  ): Promise<LoginResult> {
    const currentUrl = page.url();
    this.logger.debug(`Current URL after login attempt: ${currentUrl}`);

    // 检查是否登录成功（重定向到主页）
    if (currentUrl.includes('facebook.com/?sk=welcome') || 
        currentUrl === 'https://www.facebook.com/' ||
        currentUrl.includes('facebook.com/home.php')) {
      
      this.logger.info('Login successful, redirected to homepage');
      
      // 获取cookies
      const cookies = await page.cookies();
      
      return {
        success: true,
        cookies,
        duration: 0 // 将在外层计算
      };
    }

    // 检查是否需要2FA
    if (currentUrl.includes('checkpoint') || 
        await this.isTwoFactorRequired(page)) {
      
      this.logger.info('Two-factor authentication required');
      
      if (credentials.twoFactorCode) {
        return await this.handleTwoFactor(page, credentials.twoFactorCode);
      } else {
        return {
          success: false,
          requiresTwoFactor: true,
          error: 'Two-factor authentication required but no code provided',
          duration: 0
        };
      }
    }

    // 检查是否需要验证码
    if (await this.isCaptchaRequired(page)) {
      this.logger.info('Captcha verification required');
      return {
        success: false,
        requiresCaptcha: true,
        error: 'Captcha verification required',
        duration: 0
      };
    }

    // 检查登录错误
    const errorMessage = await this.getLoginErrorMessage(page);
    if (errorMessage) {
      this.logger.warn(`Login failed with error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        duration: 0
      };
    }

    // 未知状态
    this.logger.warn(`Login status unknown, current URL: ${currentUrl}`);
    return {
      success: false,
      error: 'Unknown login status',
      duration: 0
    };
  }

  /**
   * 检查是否需要2FA
   */
  private async isTwoFactorRequired(page: any): Promise<boolean> {
    try {
      // 检查2FA页面的常见元素
      const twoFactorSelectors = [
        'input[name="approvals_code"]',
        'input[placeholder="Enter code"]',
        'input#approvals_code',
        'div:contains("Enter login code")',
        'div:contains("Two-factor authentication")'
      ];

      for (const selector of twoFactorSelectors) {
        const element = await page.$(selector);
        if (element) {
          return true;
        }
      }

      // 检查URL中的checkpoint
      const currentUrl = page.url();
      return currentUrl.includes('checkpoint') && 
             (currentUrl.includes('twofactor') || 
              currentUrl.includes('approvals'));
    } catch (error) {
      return false;
    }
  }

  /**
   * 处理2FA验证
   */
  private async handleTwoFactor(page: any, code: string): Promise<LoginResult> {
    try {
      this.logger.info('Processing two-factor authentication');

      // 等待2FA输入框
      await page.waitForSelector('input[name="approvals_code"], input[placeholder="Enter code"]', {
        timeout: 10000
      });

      // 输入2FA代码
      await this.humanBehavior.simulateHumanTyping(
        page, 
        'input[name="approvals_code"], input[placeholder="Enter code"]',
        code
      );
      await this.humanBehavior.randomDelay(500, 1000);

      // 点击继续按钮
      const continueButton = await page.$('button[name="submit[Continue]"], button#checkpointSubmitButton');
      if (continueButton) {
        await this.humanBehavior.simulateHumanClick(page, 'button[name="submit[Continue]"], button#checkpointSubmitButton');
      } else {
        await page.keyboard.press('Enter');
      }

      await this.humanBehavior.randomDelay(3000, 5000);

      // 检查是否登录成功
      const currentUrl = page.url();
      if (currentUrl.includes('facebook.com/?sk=welcome') || 
          currentUrl === 'https://www.facebook.com/' ||
          currentUrl.includes('facebook.com/home.php')) {
        
        const cookies = await page.cookies();
        
        return {
          success: true,
          cookies,
          duration: 0
        };
      }

      // 检查是否需要信任设备
      if (await this.isTrustDevicePage(page)) {
        return await this.handleTrustDevice(page);
      }

      return {
        success: false,
        error: 'Two-factor authentication failed',
        duration: 0
      };
    } catch (error) {
      this.logger.error('Two-factor authentication failed', error as Error);
      return {
        success: false,
        error: `Two-factor authentication failed: ${(error as Error).message}`,
        duration: 0
      };
    }
  }

  /**
   * 检查是否需要信任设备
   */
  private async isTrustDevicePage(page: any): Promise<boolean> {
    try {
      const trustDeviceSelectors = [
        'input[name="name_action_selected"][value="dont_save"]',
        'input[value="dont_save"]',
        'div:contains("Save this browser?")',
        'div:contains("Trust this device?")'
      ];

      for (const selector of trustDeviceSelectors) {
        const element = await page.$(selector);
        if (element) {
          return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 处理信任设备页面
   */
  private async handleTrustDevice(page: any): Promise<LoginResult> {
    try {
      this.logger.info('Handling trust device page');

      // 选择不保存设备（更安全）
      const dontSaveButton = await page.$('input[name="name_action_selected"][value="dont_save"]');
      if (dontSaveButton) {
        await this.humanBehavior.simulateHumanClick(page, 'input[name="name_action_selected"][value="dont_save"]');
      }

      // 点击继续
      const continueButton = await page.$('button[name="submit[Continue]"], button#checkpointSubmitButton');
      if (continueButton) {
        await this.humanBehavior.simulateHumanClick(page, 'button[name="submit[Continue]"], button#checkpointSubmitButton');
      }

      await this.humanBehavior.randomDelay(3000, 5000);

      // 检查最终登录状态
      const currentUrl = page.url();
      if (currentUrl.includes('facebook.com/?sk=welcome') || 
          currentUrl === 'https://www.facebook.com/' ||
          currentUrl.includes('facebook.com/home.php')) {
        
        const cookies = await page.cookies();
        
        return {
          success: true,
          cookies,
          duration: 0
        };
      }

      return {
        success: false,
        error: 'Failed to complete trust device flow',
        duration: 0
      };
    } catch (error) {
      this.logger.error('Failed to handle trust device', error as Error);
      return {
        success: false,
        error: `Trust device flow failed: ${(error as Error).message}`,
        duration: 0
      };
    }
  }

  /**
   * 检查是否需要验证码
   */
  private async isCaptchaRequired(page: any): Promise<boolean> {
    try {
      const captchaSelectors = [
        'div#captcha',
        'iframe[src*="captcha"]',
        'div:contains("Security check")',
        'div:contains("Enter the text you see")'
      ];

      for (const selector of captchaSelectors) {
        const element = await page.$(selector);
        if (element) {
          return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取登录错误信息
   */
  private async getLoginErrorMessage(page: any): Promise<string | null> {
    try {
      const errorSelectors = [
        'div#error_box',
        'div.uiContextualLayerPositioner:has(div[role="alert"])',
        'div[data-testid="error_message"]',
        'div:contains("The password you entered is incorrect")',
        'div:contains("Invalid username or password")',
        'div:contains("Your account has been locked")'
      ];

      for (const selector of errorSelectors) {
        try {
          const errorElement = await page.$(selector);
          if (errorElement) {
            const errorText = await page.evaluate(el => el.textContent, errorElement);
            if (errorText && errorText.trim()) {
              return errorText.trim();
            }
          }
        } catch (error) {
          // 继续尝试下一个选择器
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 检查登录状态
   */
  async checkLoginStatus(page: any): Promise<boolean> {
    try {
      // 导航到Facebook主页
      await page.goto('https://www.facebook.com/', {
        waitUntil: 'networkidle2',
        timeout: 15000
      });

      // 检查登录状态元素
      const loggedInSelectors = [
        'div[aria-label="Create a post"]',
        'div[data-pagelet="LeftRail"]',
        'a[aria-label="Home"][href="/"]',
        'div[role="navigation"]'
      ];

      for (const selector of loggedInSelectors) {
        const element = await page.$(selector);
        if (element) {
          return true;
        }
      }

      // 检查URL是否在登录状态
      const currentUrl = page.url();
      return !currentUrl.includes('login') && 
             !currentUrl.includes('checkpoint');
    } catch (error) {
      this.logger.error('Failed to check login status', error as Error);
      return false;
    }
  }

  /**
   * 安全登出
   */
  async logout(page: any): Promise<boolean> {
    try {
      this.logger.info('Starting logout process');

      // 导航到设置页面
      await page.goto('https://www.facebook.com/settings', {
        waitUntil: 'networkidle2',
        timeout: 15000
      });

      // 查找登出选项
      await this.humanBehavior.randomDelay(1000, 2000);

      // 尝试通过URL直接登出
      await page.goto('https://www.facebook.com/logout', {
        waitUntil: 'networkidle2',
        timeout: 15000
      });

      // 确认登出
      const logoutButton = await page.$('a[href*="logout"]');
      if (logoutButton) {
        await this.humanBehavior.simulateHumanClick(page, 'a[href*="logout"]');
      }

      await this.humanBehavior.randomDelay(2000, 3000);

      // 验证已登出
      const currentUrl = page.url();
      const isLoggedOut = currentUrl.includes('login') || 
                         currentUrl.includes('logout');

      if (isLoggedOut) {
        this.logger.info('Logout successful');
        return true;
      } else {
        this.logger.warn('Logout may not have been successful');
        return false;
      }
    } catch (error) {
      this.logger.error('Logout failed', error as Error);
      return false;
    }
  }
}