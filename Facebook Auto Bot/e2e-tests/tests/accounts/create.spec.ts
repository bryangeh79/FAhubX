import { test, expect } from '../../fixtures/auth.fixture';
import { test as accountsTest } from '../../fixtures/accounts.fixture';
import { DashboardPage } from '../../pages/dashboard.page';
import { AccountsPage } from '../../pages/accounts.page';
import { DataFactory } from '../../fixtures/data.factory';

test.describe('Facebook账号创建流程测试', () => {
  test('TC-ACCOUNT-001: 成功创建Facebook账号', async ({ page, authToken }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    await expect(accountsPage.isLoaded()).toBeTruthy();
    
    // 获取当前账号数量
    const initialCount = await accountsPage.getAccountCount();
    
    // 创建新账号
    const accountData = DataFactory.createFacebookAccount();
    await accountsPage.createAccount(accountData);
    
    // 验证账号创建成功
    await expect(page.locator('.ant-message-success')).toBeVisible();
    await expect(page.locator('.ant-message-success')).toContainText('创建成功');
    
    // 验证账号数量增加
    await accountsPage.searchAccount(accountData.username);
    const finalCount = await accountsPage.getAccountCount();
    expect(finalCount).toBeGreaterThan(initialCount);
    
    // 验证账号信息显示正确
    const accountInfo = await accountsPage.getAccountInfo(0);
    expect(accountInfo.username).toBe(accountData.username);
    expect(accountInfo.email).toBe(accountData.email);
    expect(accountInfo.status).toBe('ACTIVE');
  });

  test('TC-ACCOUNT-002: 创建账号时必填字段验证', async ({ page, authToken }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    await accountsPage.openCreateAccountModal();
    
    // 不填写任何字段直接提交
    await page.locator('button[type="submit"]').click();
    
    // 验证所有必填字段都有验证错误
    const errorMessages = await page.locator('.ant-form-item-explain-error').all();
    expect(errorMessages.length).toBeGreaterThan(0);
    
    // 验证必填字段
    const requiredFields = ['username', 'email', 'password'];
    for (const field of requiredFields) {
      await expect(page.locator(`input[name="${field}"]`)).toHaveClass(/ant-input-status-error/);
    }
    
    // 关闭模态框
    await page.locator('.ant-modal-close').click();
  });

  test('TC-ACCOUNT-003: 创建重复账号失败', async ({ page, authToken, testAccount }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    
    // 尝试创建重复账号
    const duplicateData = {
      username: testAccount.username,
      email: 'different@email.com',
      password: 'Password123!'
    };
    
    await accountsPage.createAccount(duplicateData);
    
    // 验证创建失败
    await expect(page.locator('.ant-message-error')).toBeVisible();
    await expect(page.locator('.ant-message-error')).toContainText('已存在');
  });

  test('TC-ACCOUNT-004: 创建账号时代理配置可选', async ({ page, authToken }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    await accountsPage.openCreateAccountModal();
    
    // 只填写必填字段，不填写代理配置
    const accountData = DataFactory.createFacebookAccount();
    
    await page.locator('input[name="username"]').fill(accountData.username);
    await page.locator('input[name="email"]').fill(accountData.email);
    await page.locator('input[name="password"]').fill(accountData.password);
    
    // 提交表单
    await page.locator('button[type="submit"]').click();
    
    // 验证创建成功
    await expect(page.locator('.ant-message-success')).toBeVisible();
    await expect(accountsPage.createAccountModal).not.toBeVisible();
  });

  test('TC-ACCOUNT-005: 创建账号时完整代理配置', async ({ page, authToken }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    
    // 创建带完整代理配置的账号
    const accountData = DataFactory.createFacebookAccount();
    
    await accountsPage.createAccount(accountData);
    
    // 验证创建成功
    await expect(page.locator('.ant-message-success')).toBeVisible();
    
    // 搜索并验证账号
    await accountsPage.searchAccount(accountData.username);
    const accountInfo = await accountsPage.getAccountInfo(0);
    expect(accountInfo.username).toBe(accountData.username);
  });

  test('TC-ACCOUNT-006: 创建账号时标签配置', async ({ page, authToken }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    await accountsPage.openCreateAccountModal();
    
    // 填写基本信息和标签
    const accountData = DataFactory.createFacebookAccount();
    
    await page.locator('input[name="username"]').fill(accountData.username);
    await page.locator('input[name="email"]').fill(accountData.email);
    await page.locator('input[name="password"]').fill(accountData.password);
    
    // 添加标签
    const tagsInput = page.locator('input[placeholder="添加标签"]');
    await tagsInput.fill('test-tag');
    await tagsInput.press('Enter');
    await tagsInput.fill('automation');
    await tagsInput.press('Enter');
    
    // 提交表单
    await page.locator('button[type="submit"]').click();
    
    // 验证创建成功
    await expect(page.locator('.ant-message-success')).toBeVisible();
  });

  test('TC-ACCOUNT-007: 创建账号时备注信息', async ({ page, authToken }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    await accountsPage.openCreateAccountModal();
    
    // 填写基本信息和备注
    const accountData = DataFactory.createFacebookAccount();
    
    await page.locator('input[name="username"]').fill(accountData.username);
    await page.locator('input[name="email"]').fill(accountData.email);
    await page.locator('input[name="password"]').fill(accountData.password);
    
    // 填写备注
    await page.locator('textarea[name="notes"]').fill('这是测试账号，用于自动化测试');
    
    // 提交表单
    await page.locator('button[type="submit"]').click();
    
    // 验证创建成功
    await expect(page.locator('.ant-message-success')).toBeVisible();
  });

  test('TC-ACCOUNT-008: 创建账号时用户代理配置', async ({ page, authToken }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    await accountsPage.openCreateAccountModal();
    
    // 填写基本信息和用户代理
    const accountData = DataFactory.createFacebookAccount();
    
    await page.locator('input[name="username"]').fill(accountData.username);
    await page.locator('input[name="email"]').fill(accountData.email);
    await page.locator('input[name="password"]').fill(accountData.password);
    
    // 填写用户代理
    await page.locator('input[name="userAgent"]').fill(accountData.userAgent);
    
    // 提交表单
    await page.locator('button[type="submit"]').click();
    
    // 验证创建成功
    await expect(page.locator('.ant-message-success')).toBeVisible();
  });

  test('TC-ACCOUNT-009: 创建账号时Cookie配置', async ({ page, authToken }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    await accountsPage.openCreateAccountModal();
    
    // 填写基本信息和Cookie
    const accountData = DataFactory.createFacebookAccount();
    
    await page.locator('input[name="username"]').fill(accountData.username);
    await page.locator('input[name="email"]').fill(accountData.email);
    await page.locator('input[name="password"]').fill(accountData.password);
    
    // 切换到Cookie标签页
    await page.locator('.ant-tabs-tab:has-text("Cookie")').click();
    
    // 填写Cookie（如果有相关字段）
    const cookieInput = page.locator('textarea[name="cookies"]');
    if (await cookieInput.isVisible()) {
      await cookieInput.fill(accountData.cookies);
    }
    
    // 提交表单
    await page.locator('button[type="submit"]').click();
    
    // 验证创建成功
    await expect(page.locator('.ant-message-success')).toBeVisible();
  });

  test('TC-ACCOUNT-010: 创建账号时取消操作', async ({ page, authToken }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    await accountsPage.openCreateAccountModal();
    
    // 填写一些信息
    const accountData = DataFactory.createFacebookAccount();
    
    await page.locator('input[name="username"]').fill(accountData.username);
    await page.locator('input[name="email"]').fill(accountData.email);
    
    // 点击取消按钮
    await page.locator('button:has-text("取消")').click();
    
    // 验证模态框关闭
    await expect(accountsPage.createAccountModal).not.toBeVisible();
    
    // 验证账号没有创建
    await accountsPage.searchAccount(accountData.username);
    const accountInfo = await accountsPage.getAccountInfo(0).catch(() => null);
    expect(accountInfo).toBeNull();
  });

  test('TC-ACCOUNT-011: 批量创建账号', async ({ page, authToken }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    const initialCount = await accountsPage.getAccountCount();
    
    // 点击导入按钮
    await accountsPage.importButton.click();
    
    // 验证导入模态框打开
    await expect(page.locator('.import-modal')).toBeVisible();
    
    // 这里可以添加文件上传测试
    // 由于文件上传的复杂性，这里只验证UI流程
    
    // 关闭导入模态框
    await page.locator('.ant-modal-close').click();
  });

  test('TC-ACCOUNT-012: 创建账号后自动刷新列表', async ({ page, authToken }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    const initialCount = await accountsPage.getAccountCount();
    
    // 创建新账号
    const accountData = DataFactory.createFacebookAccount();
    await accountsPage.createAccount(accountData);
    
    // 验证成功消息
    await expect(page.locator('.ant-message-success')).toBeVisible();
    
    // 验证列表自动刷新（账号数量增加）
    await page.waitForTimeout(1000); // 等待列表刷新
    const finalCount = await accountsPage.getAccountCount();
    expect(finalCount).toBeGreaterThan(initialCount);
    
    // 验证新账号在列表中
    await accountsPage.searchAccount(accountData.username);
    const accountInfo = await accountsPage.getAccountInfo(0);
    expect(accountInfo.username).toBe(accountData.username);
  });

  test('TC-ACCOUNT-013: 创建账号时表单字段验证', async ({ page, authToken }) => {
    // 访问账号管理页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.gotoAccounts();
    
    const accountsPage = new AccountsPage(page);
    await accountsPage.openCreateAccountModal();
    
    // 测试无效邮箱格式
    await page.locator('input[name="email"]').fill('invalid-email');
    await page.locator('input[name="username"]').fill('testuser');
    await page.keyboard.press('Tab');
    
    await expect(page.locator('.ant-form-item-explain-error')).toContainText('邮箱格式不正确');
    
    // 测试有效邮箱格式
    await page.locator('input[name="email"]').fill('valid@email.com');
    await page.keyboard.press('Tab');
    
    await expect(page.locator('.ant-form-item-explain-error')).not.toContainText('邮箱格式不正确');
    
    // 测试无效代理端口
    await page.locator('input[name="proxyPort"]').fill('99999');
    await page.keyboard.press('Tab');
    
    await expect(page.locator('.ant-form-item-explain-error')).toContainText('端口号');
    
    // 测试有效代理端口
    await page.locator('input[name="proxyPort"]').fill('8080');
    await page.keyboard.press('Tab');
    
    await expect(page.locator('.ant-form-item-explain-error')).not.toContainText('端口号');
    
    // 关闭模态框
    await page.locator('.ant-modal-close').click();
  });
});