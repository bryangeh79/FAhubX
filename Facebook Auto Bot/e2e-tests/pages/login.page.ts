import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerLink: Locator;
  readonly forgotPasswordLink: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.loginButton = page.locator('button[type="submit"]');
    this.registerLink = page.locator('a[href="/register"]');
    this.forgotPasswordLink = page.locator('a[href="/forgot-password"]');
    this.errorMessage = page.locator('.ant-alert-error');
    this.successMessage = page.locator('.ant-alert-success');
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async gotoRegister() {
    await this.registerLink.click();
  }

  async gotoForgotPassword() {
    await this.forgotPasswordLink.click();
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }

  async getSuccessMessage() {
    return await this.successMessage.textContent();
  }

  async isLoggedIn() {
    // 检查是否重定向到仪表板
    return this.page.url().includes('/dashboard');
  }

  async waitForLoginSuccess() {
    await this.page.waitForURL('**/dashboard');
  }

  async waitForLoginError() {
    await this.page.waitForSelector('.ant-alert-error', { state: 'visible' });
  }
}