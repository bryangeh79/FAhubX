import { test, expect } from '../../fixtures/auth.fixture';
import { LoginPage } from '../../pages/login.page';
import { DashboardPage } from '../../pages/dashboard.page';

test.describe('用户登录流程测试', () => {
  test('TC-AUTH-009: 用户使用正确凭据成功登录', async ({ page, regularUser }) => {
    // 访问登录页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 验证登录页面加载
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('h1:has-text("登录")')).toBeVisible();
    
    // 填写登录表单
    await loginPage.login(regularUser.email, regularUser.password);
    
    // 验证登录成功
    await loginPage.waitForLoginSuccess();
    await expect(page).toHaveURL(/.*dashboard/);
    
    // 验证仪表板加载
    const dashboardPage = new DashboardPage(page);
    await expect(dashboardPage.welcomeMessage).toBeVisible();
  });

  test('TC-AUTH-010: 错误密码登录失败', async ({ page, regularUser }) => {
    // 访问登录页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 使用错误密码登录
    await loginPage.login(regularUser.email, 'WrongPassword123!');
    
    // 验证登录失败
    await loginPage.waitForLoginError();
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('密码错误');
    
    // 验证仍然在登录页面
    await expect(page).toHaveURL(/.*login/);
  });

  test('TC-AUTH-011: 不存在的用户登录失败', async ({ page }) => {
    // 访问登录页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 使用不存在的用户登录
    await loginPage.login('nonexistent@test.com', 'Password123!');
    
    // 验证登录失败
    await loginPage.waitForLoginError();
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('用户不存在');
    
    // 验证仍然在登录页面
    await expect(page).toHaveURL(/.*login/);
  });

  test('TC-AUTH-012: 空凭据登录失败', async ({ page }) => {
    // 访问登录页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 不填写任何字段直接提交
    await loginPage.loginButton.click();
    
    // 验证表单验证错误
    const errorMessages = await page.locator('.ant-form-item-explain-error').all();
    expect(errorMessages.length).toBeGreaterThan(0);
    
    // 验证邮箱和密码字段都有错误提示
    await expect(loginPage.emailInput).toHaveClass(/ant-input-status-error/);
    await expect(loginPage.passwordInput).toHaveClass(/ant-input-status-error/);
    
    // 验证仍然在登录页面
    await expect(page).toHaveURL(/.*login/);
  });

  test('TC-AUTH-013: 记住我功能', async ({ page, regularUser }) => {
    // 访问登录页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 勾选"记住我"
    await page.locator('input[type="checkbox"][name="rememberMe"]').check();
    
    // 登录
    await loginPage.login(regularUser.email, regularUser.password);
    
    // 验证登录成功
    await loginPage.waitForLoginSuccess();
    
    // 登出
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.logout();
    
    // 再次访问登录页面，验证邮箱是否被记住
    await loginPage.goto();
    const emailValue = await loginPage.emailInput.inputValue();
    expect(emailValue).toBe(regularUser.email);
    
    // 验证"记住我"是否被勾选
    const isChecked = await page.locator('input[type="checkbox"][name="rememberMe"]').isChecked();
    expect(isChecked).toBe(true);
  });

  test('TC-AUTH-014: 登录后会话管理', async ({ page, regularUser, apiClient }) => {
    // 访问登录页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 登录
    await loginPage.login(regularUser.email, regularUser.password);
    await loginPage.waitForLoginSuccess();
    
    // 获取当前token
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoProfile();
    
    // 验证可以访问受保护页面
    await expect(page).toHaveURL(/.*profile/);
    
    // 模拟token过期（通过API测试）
    // 这里可以添加token过期测试逻辑
    
    // 返回仪表板
    await dashboardPage.goto();
    await expect(dashboardPage.isDashboardLoaded()).toBeTruthy();
  });

  test('TC-AUTH-015: 连续多次登录失败锁定', async ({ page, regularUser }) => {
    // 访问登录页面
    const loginPage = new LoginPage(page);
    
    // 连续多次使用错误密码登录
    for (let i = 0; i < 5; i++) {
      await loginPage.goto();
      await loginPage.login(regularUser.email, 'WrongPassword123!');
      await loginPage.waitForLoginError();
    }
    
    // 第六次尝试应该被锁定
    await loginPage.goto();
    await loginPage.login(regularUser.email, 'WrongPassword123!');
    
    // 验证账户被锁定
    await loginPage.waitForLoginError();
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('账户已锁定');
    
    // 使用正确密码也应该失败
    await loginPage.goto();
    await loginPage.login(regularUser.email, regularUser.password);
    await loginPage.waitForLoginError();
    const lockedMessage = await loginPage.getErrorMessage();
    expect(lockedMessage).toContain('账户已锁定');
  });

  test('TC-AUTH-016: 登录页面链接功能', async ({ page }) => {
    // 访问登录页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 测试注册链接
    await loginPage.gotoRegister();
    await expect(page).toHaveURL(/.*register/);
    
    // 返回登录页面
    await loginPage.goto();
    
    // 测试忘记密码链接
    await loginPage.gotoForgotPassword();
    await expect(page).toHaveURL(/.*forgot-password/);
    
    // 返回登录页面
    await loginPage.goto();
    
    // 测试服务条款链接
    const termsLink = page.locator('a:has-text("服务条款")');
    await expect(termsLink).toHaveAttribute('href', /.*terms/);
    
    // 测试隐私政策链接
    const privacyLink = page.locator('a:has-text("隐私政策")');
    await expect(privacyLink).toHaveAttribute('href', /.*privacy/);
  });

  test('TC-AUTH-017: 登录后重定向到原请求页面', async ({ page, regularUser }) => {
    // 直接访问受保护页面（如账号管理）
    await page.goto('/accounts');
    
    // 验证被重定向到登录页面
    await expect(page).toHaveURL(/.*login/);
    
    // 登录
    const loginPage = new LoginPage(page);
    await loginPage.login(regularUser.email, regularUser.password);
    
    // 验证登录后重定向到原请求页面（账号管理）
    await expect(page).toHaveURL(/.*accounts/);
  });

  test('TC-AUTH-018: 不同角色用户登录', async ({ page, adminUser, regularUser }) => {
    // 管理员登录
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(adminUser.email, adminUser.password);
    await loginPage.waitForLoginSuccess();
    
    // 验证管理员权限（如访问系统设置）
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoSettings();
    await expect(page).toHaveURL(/.*settings/);
    
    // 登出
    await dashboardPage.logout();
    
    // 普通用户登录
    await loginPage.goto();
    await loginPage.login(regularUser.email, regularUser.password);
    await loginPage.waitForLoginSuccess();
    
    // 验证普通用户权限（可能无法访问某些页面）
    await page.goto('/admin');
    // 这里应该被重定向或无权限访问
    await expect(page).not.toHaveURL(/.*admin/);
  });

  test('TC-AUTH-019: 登录表单输入验证', async ({ page }) => {
    // 访问登录页面
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 测试无效邮箱格式
    await loginPage.emailInput.fill('invalid-email');
    await loginPage.passwordInput.fill('Password123!');
    await page.keyboard.press('Tab'); // 触发验证
    
    await expect(page.locator('.ant-form-item-explain-error')).toContainText('邮箱格式不正确');
    
    // 测试有效邮箱格式
    await loginPage.emailInput.fill('valid@email.com');
    await page.keyboard.press('Tab');
    
    await expect(page.locator('.ant-form-item-explain-error')).not.toContainText('邮箱格式不正确');
    
    // 测试密码为空
    await loginPage.passwordInput.fill('');
    await page.keyboard.press('Tab');
    
    await expect(page.locator('.ant-form-item-explain-error')).toContainText('请输入密码');
    
    // 测试密码有值
    await loginPage.passwordInput.fill('Password123!');
    await page.keyboard.press('Tab');
    
    await expect(page.locator('.ant-form-item-explain-error')).not.toContainText('请输入密码');
  });
});