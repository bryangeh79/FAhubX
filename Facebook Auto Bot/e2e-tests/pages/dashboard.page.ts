import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly welcomeMessage: Locator;
  readonly totalAccountsCard: Locator;
  readonly activeTasksCard: Locator;
  readonly systemStatusCard: Locator;
  readonly recentActivityTable: Locator;
  readonly accountsLink: Locator;
  readonly tasksLink: Locator;
  readonly scriptsLink: Locator;
  readonly settingsLink: Locator;
  readonly logoutButton: Locator;
  readonly userMenu: Locator;
  readonly profileLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = page.locator('.welcome-message');
    this.totalAccountsCard = page.locator('.stat-card:has-text("总账号数")');
    this.activeTasksCard = page.locator('.stat-card:has-text("活跃任务")');
    this.systemStatusCard = page.locator('.stat-card:has-text("系统状态")');
    this.recentActivityTable = page.locator('.recent-activity-table');
    this.accountsLink = page.locator('a[href="/accounts"]');
    this.tasksLink = page.locator('a[href="/tasks"]');
    this.scriptsLink = page.locator('a[href="/scripts"]');
    this.settingsLink = page.locator('a[href="/settings"]');
    this.logoutButton = page.locator('button:has-text("退出登录")');
    this.userMenu = page.locator('.user-menu');
    this.profileLink = page.locator('a[href="/profile"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async getTotalAccounts(): Promise<number> {
    const text = await this.totalAccountsCard.locator('.stat-value').textContent();
    return parseInt(text || '0');
  }

  async getActiveTasks(): Promise<number> {
    const text = await this.activeTasksCard.locator('.stat-value').textContent();
    return parseInt(text || '0');
  }

  async getSystemStatus(): Promise<string> {
    return await this.systemStatusCard.locator('.stat-value').textContent() || '';
  }

  async gotoAccounts() {
    await this.accountsLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  async gotoTasks() {
    await this.tasksLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  async gotoScripts() {
    await this.scriptsLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  async gotoSettings() {
    await this.settingsLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  async openUserMenu() {
    await this.userMenu.click();
  }

  async gotoProfile() {
    await this.openUserMenu();
    await this.profileLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  async logout() {
    await this.openUserMenu();
    await this.logoutButton.click();
    await this.page.waitForURL('**/login');
  }

  async getRecentActivityCount(): Promise<number> {
    const rows = await this.recentActivityTable.locator('tbody tr').count();
    return rows;
  }

  async isDashboardLoaded(): Promise<boolean> {
    try {
      await this.page.waitForSelector('.welcome-message', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async refreshDashboard() {
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
  }
}