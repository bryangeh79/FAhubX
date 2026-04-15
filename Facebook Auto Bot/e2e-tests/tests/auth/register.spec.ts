import { test, expect } from '../../fixtures/auth.fixture';
import { LoginPage } from '../../pages/login.page';
import { DataFactory } from '../../fixtures/data.factory';

test.describe('用户注册流程测试', () => {
  test('TC-AUTH-001: 新用户成功注册', async ({ page, apiClient, dbHelper }) => {
    // 准备测试数据
    const userData = DataFactory.createUser();
    
    // 访问注册页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.gotoRegister();
    
    // 验证注册页面加载
    await expect(page).toHaveURL(/.*register/);
    await expect(page.locator('h1:has-text("注册")')).toBeVisible();
    
    // 填写注册表单
    await page.locator('input[name="email"]').fill(userData.email);
    await page.locator('input[name="password"]').fill(userData.password);
    await page.locator('input[name="confirmPassword"]').fill(userData.password);
    await page.locator('input[name="firstName"]').fill(userData.firstName);
    await page.locator('input[name="lastName"]').fill(userData.lastName);
    
    // 提交表单
    await page.locator('button[type="submit"]').click();
    
    // 验证注册成功
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('.ant-alert-success')).toBeVisible();
    await expect(page.locator('.ant-alert-success')).toContainText('注册成功');
    
    // 验证数据库中的用户
    const dbUser = await dbHelper.getUserByEmail(userData.email);
    expect(dbUser).toBeDefined();
    expect(dbUser.email).toBe(userData.email);
    expect(dbUser.first_name).toBe(userData.firstName);
    expect(dbUser.last_name).toBe(userData.lastName);
    
    // 清理测试数据
    await dbHelper.query('DELETE FROM users WHERE email = $1', [userData.email]);
  });

  test('TC-AUTH-002: 邮箱已存在时注册失败', async ({ page, apiClient, regularUser }) => {
    // 访问注册页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.gotoRegister();
    
    // 使用已存在的邮箱注册
    await page.locator('input[name="email"]').fill(regularUser.email);
    await page.locator('input[name="password"]').fill('NewPassword123!');
    await page.locator('input[name="confirmPassword"]').fill('NewPassword123!');
    await page.locator('input[name="firstName"]').fill('Test');
    await page.locator('input[name="lastName"]').fill('User');
    
    // 提交表单
    await page.locator('button[type="submit"]').click();
    
    // 验证注册失败
    await expect(page.locator('.ant-alert-error')).toBeVisible();
    await expect(page.locator('.ant-alert-error')).toContainText('邮箱已存在');
    await expect(page).toHaveURL(/.*register/);
  });

  test('TC-AUTH-003: 密码不符合要求时注册失败', async ({ page }) => {
    // 访问注册页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.gotoRegister();
    
    // 使用弱密码注册
    const userData = DataFactory.createUser();
    
    await page.locator('input[name="email"]').fill(userData.email);
    await page.locator('input[name="password"]').fill('weak');
    await page.locator('input[name="confirmPassword"]').fill('weak');
    await page.locator('input[name="firstName"]').fill(userData.firstName);
    await page.locator('input[name="lastName"]').fill(userData.lastName);
    
    // 提交表单
    await page.locator('button[type="submit"]').click();
    
    // 验证表单验证错误
    await expect(page.locator('.ant-form-item-explain-error')).toBeVisible();
    await expect(page.locator('.ant-form-item-explain-error')).toContainText('密码');
    await expect(page).toHaveURL(/.*register/);
  });

  test('TC-AUTH-004: 密码确认不匹配时注册失败', async ({ page }) => {
    // 访问注册页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.gotoRegister();
    
    // 使用不匹配的密码
    const userData = DataFactory.createUser();
    
    await page.locator('input[name="email"]').fill(userData.email);
    await page.locator('input[name="password"]').fill('Password123!');
    await page.locator('input[name="confirmPassword"]').fill('Different123!');
    await page.locator('input[name="firstName"]').fill(userData.firstName);
    await page.locator('input[name="lastName"]').fill(userData.lastName);
    
    // 提交表单
    await page.locator('button[type="submit"]').click();
    
    // 验证表单验证错误
    await expect(page.locator('.ant-form-item-explain-error')).toBeVisible();
    await expect(page.locator('.ant-form-item-explain-error')).toContainText('密码不匹配');
    await expect(page).toHaveURL(/.*register/);
  });

  test('TC-AUTH-005: 必填字段为空时注册失败', async ({ page }) => {
    // 访问注册页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.gotoRegister();
    
    // 不填写任何字段直接提交
    await page.locator('button[type="submit"]').click();
    
    // 验证所有必填字段都有验证错误
    const errorMessages = await page.locator('.ant-form-item-explain-error').all();
    expect(errorMessages.length).toBeGreaterThan(0);
    
    // 验证每个必填字段都有错误提示
    const requiredFields = ['email', 'password', 'confirmPassword', 'firstName', 'lastName'];
    for (const field of requiredFields) {
      await expect(page.locator(`input[name="${field}"]`)).toHaveClass(/ant-input-status-error/);
    }
    
    await expect(page).toHaveURL(/.*register/);
  });

  test('TC-AUTH-006: 注册后自动跳转到登录页面', async ({ page, dbHelper }) => {
    // 准备测试数据
    const userData = DataFactory.createUser();
    
    // 访问注册页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.gotoRegister();
    
    // 填写注册表单
    await page.locator('input[name="email"]').fill(userData.email);
    await page.locator('input[name="password"]').fill(userData.password);
    await page.locator('input[name="confirmPassword"]').fill(userData.password);
    await page.locator('input[name="firstName"]').fill(userData.firstName);
    await page.locator('input[name="lastName"]').fill(userData.lastName);
    
    // 提交表单
    await page.locator('button[type="submit"]').click();
    
    // 验证自动跳转到登录页面
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('h1:has-text("登录")')).toBeVisible();
    
    // 验证成功消息
    await expect(page.locator('.ant-alert-success')).toBeVisible();
    await expect(page.locator('.ant-alert-success')).toContainText('注册成功');
    
    // 清理测试数据
    await dbHelper.query('DELETE FROM users WHERE email = $1', [userData.email]);
  });

  test('TC-AUTH-007: 注册表单字段验证', async ({ page }) => {
    // 访问注册页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.gotoRegister();
    
    // 测试无效邮箱格式
    await page.locator('input[name="email"]').fill('invalid-email');
    await page.locator('input[name="password"]').fill('Password123!');
    await page.keyboard.press('Tab'); // 触发验证
    
    await expect(page.locator('.ant-form-item-explain-error')).toContainText('邮箱格式不正确');
    
    // 测试有效邮箱格式
    await page.locator('input[name="email"]').fill('valid@email.com');
    await page.locator('input[name="password"]').fill('Password123!');
    await page.keyboard.press('Tab');
    
    await expect(page.locator('.ant-form-item-explain-error')).not.toContainText('邮箱格式不正确');
    
    // 测试密码强度验证
    await page.locator('input[name="password"]').fill('weak');
    await page.keyboard.press('Tab');
    
    await expect(page.locator('.ant-form-item-explain-error')).toContainText('密码');
    
    // 测试强密码
    await page.locator('input[name="password"]').fill('StrongPassword123!');
    await page.keyboard.press('Tab');
    
    await expect(page.locator('.ant-form-item-explain-error')).not.toContainText('密码');
  });

  test('TC-AUTH-008: 注册页面链接功能', async ({ page }) => {
    // 访问注册页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.gotoRegister();
    
    // 测试返回登录页面链接
    await page.locator('a:has-text("返回登录")').click();
    await expect(page).toHaveURL(/.*login/);
    
    // 再次访问注册页面
    await loginPage.gotoRegister();
    
    // 测试服务条款链接
    const termsLink = page.locator('a:has-text("服务条款")');
    await expect(termsLink).toHaveAttribute('href', /.*terms/);
    
    // 测试隐私政策链接
    const privacyLink = page.locator('a:has-text("隐私政策")');
    await expect(privacyLink).toHaveAttribute('href', /.*privacy/);
  });
});