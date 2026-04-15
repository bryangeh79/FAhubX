import { Page, Locator } from '@playwright/test';

export class AccountsPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly addAccountButton: Locator;
  readonly importButton: Locator;
  readonly exportButton: Locator;
  readonly searchInput: Locator;
  readonly filterDropdown: Locator;
  readonly accountsTable: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly testConnectionButton: Locator;
  readonly bulkActionsDropdown: Locator;
  readonly selectAllCheckbox: Locator;
  readonly pagination: Locator;
  readonly emptyState: Locator;
  readonly createAccountModal: Locator;
  readonly editAccountModal: Locator;
  readonly deleteConfirmModal: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1:has-text("账号管理")');
    this.addAccountButton = page.locator('button:has-text("添加账号")');
    this.importButton = page.locator('button:has-text("导入")');
    this.exportButton = page.locator('button:has-text("导出")');
    this.searchInput = page.locator('input[placeholder="搜索账号"]');
    this.filterDropdown = page.locator('.filter-dropdown');
    this.accountsTable = page.locator('.accounts-table');
    this.editButton = page.locator('button:has-text("编辑")').first();
    this.deleteButton = page.locator('button:has-text("删除")').first();
    this.testConnectionButton = page.locator('button:has-text("测试连接")').first();
    this.bulkActionsDropdown = page.locator('.bulk-actions-dropdown');
    this.selectAllCheckbox = page.locator('th .ant-checkbox');
    this.pagination = page.locator('.ant-pagination');
    this.emptyState = page.locator('.empty-state');
    this.createAccountModal = page.locator('.create-account-modal');
    this.editAccountModal = page.locator('.edit-account-modal');
    this.deleteConfirmModal = page.locator('.delete-confirm-modal');
  }

  async goto() {
    await this.page.goto('/accounts');
    await this.page.waitForLoadState('networkidle');
  }

  async isLoaded(): Promise<boolean> {
    try {
      await this.pageTitle.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async getAccountCount(): Promise<number> {
    const rows = await this.accountsTable.locator('tbody tr').count();
    return rows;
  }

  async searchAccount(keyword: string) {
    await this.searchInput.fill(keyword);
    await this.page.keyboard.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  async filterByStatus(status: string) {
    await this.filterDropdown.click();
    await this.page.locator(`.ant-dropdown-menu-item:has-text("${status}")`).click();
    await this.page.waitForLoadState('networkidle');
  }

  async openCreateAccountModal() {
    await this.addAccountButton.click();
    await this.createAccountModal.waitFor({ state: 'visible' });
  }

  async createAccount(accountData: any) {
    await this.openCreateAccountModal();
    
    // 填写表单
    await this.page.locator('input[name="username"]').fill(accountData.username);
    await this.page.locator('input[name="email"]').fill(accountData.email);
    await this.page.locator('input[name="password"]').fill(accountData.password);
    
    if (accountData.proxyHost) {
      await this.page.locator('input[name="proxyHost"]').fill(accountData.proxyHost);
    }
    
    if (accountData.proxyPort) {
      await this.page.locator('input[name="proxyPort"]').fill(accountData.proxyPort.toString());
    }
    
    // 提交表单
    await this.page.locator('button[type="submit"]').click();
    await this.createAccountModal.waitFor({ state: 'hidden' });
    await this.page.waitForLoadState('networkidle');
  }

  async openEditAccountModal(rowIndex = 0) {
    const editButtons = await this.page.locator('button:has-text("编辑")').all();
    await editButtons[rowIndex].click();
    await this.editAccountModal.waitFor({ state: 'visible' });
  }

  async editAccount(updatedData: any) {
    // 假设已经在编辑模态框中
    if (updatedData.username) {
      await this.page.locator('input[name="username"]').fill(updatedData.username);
    }
    
    if (updatedData.email) {
      await this.page.locator('input[name="email"]').fill(updatedData.email);
    }
    
    // 提交表单
    await this.page.locator('button[type="submit"]').click();
    await this.editAccountModal.waitFor({ state: 'hidden' });
    await this.page.waitForLoadState('networkidle');
  }

  async deleteAccount(rowIndex = 0, confirm = true) {
    const deleteButtons = await this.page.locator('button:has-text("删除")').all();
    await deleteButtons[rowIndex].click();
    
    await this.deleteConfirmModal.waitFor({ state: 'visible' });
    
    if (confirm) {
      await this.page.locator('.delete-confirm-modal button:has-text("确认")').click();
    } else {
      await this.page.locator('.delete-confirm-modal button:has-text("取消")').click();
    }
    
    await this.deleteConfirmModal.waitFor({ state: 'hidden' });
    await this.page.waitForLoadState('networkidle');
  }

  async testConnection(rowIndex = 0) {
    const testButtons = await this.page.locator('button:has-text("测试连接")').all();
    await testButtons[rowIndex].click();
    
    // 等待测试结果
    await this.page.waitForTimeout(3000);
  }

  async selectAccount(rowIndex = 0) {
    const checkboxes = await this.page.locator('tbody tr .ant-checkbox').all();
    await checkboxes[rowIndex].click();
  }

  async selectAllAccounts() {
    await this.selectAllCheckbox.click();
  }

  async performBulkAction(action: string) {
    await this.bulkActionsDropdown.click();
    await this.page.locator(`.ant-dropdown-menu-item:has-text("${action}")`).click();
    
    if (action === '删除') {
      await this.deleteConfirmModal.waitFor({ state: 'visible' });
      await this.page.locator('.delete-confirm-modal button:has-text("确认")').click();
      await this.deleteConfirmModal.waitFor({ state: 'hidden' });
    }
    
    await this.page.waitForLoadState('networkidle');
  }

  async getAccountInfo(rowIndex = 0): Promise<any> {
    const rows = await this.accountsTable.locator('tbody tr').all();
    const row = rows[rowIndex];
    
    const username = await row.locator('td:nth-child(2)').textContent();
    const email = await row.locator('td:nth-child(3)').textContent();
    const status = await row.locator('td:nth-child(4)').textContent();
    
    return {
      username: username?.trim() || '',
      email: email?.trim() || '',
      status: status?.trim() || ''
    };
  }

  async goToNextPage() {
    await this.pagination.locator('.ant-pagination-next').click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToPreviousPage() {
    await this.pagination.locator('.ant-pagination-prev').click();
    await this.page.waitForLoadState('networkidle');
  }
}