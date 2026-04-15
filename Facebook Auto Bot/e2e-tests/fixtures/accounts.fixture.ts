import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../utils/api.client';
import { DataFactory } from './data.factory';

export type AccountsFixtures = {
  testAccount: any;
  testAccounts: any[];
  createTestAccount: () => Promise<any>;
  cleanupTestAccounts: () => Promise<void>;
};

export const test = base.extend<AccountsFixtures>({
  testAccount: async ({ apiClient, authToken }, use) => {
    // 创建测试账号
    const accountData = DataFactory.createFacebookAccount();
    const response = await apiClient.createFacebookAccount(accountData, authToken);
    
    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('id');
    
    const account = response.data;
    await use(account);
    
    // 测试结束后清理
    await apiClient.deleteFacebookAccount(account.id, authToken);
  },

  testAccounts: async ({ apiClient, authToken }, use) => {
    // 创建多个测试账号
    const accounts = [];
    for (let i = 0; i < 3; i++) {
      const accountData = DataFactory.createFacebookAccount({ 
        username: `testuser${i}`,
        email: `test${i}@facebook.com`
      });
      
      const response = await apiClient.createFacebookAccount(accountData, authToken);
      expect(response.status).toBe(201);
      accounts.push(response.data);
    }
    
    await use(accounts);
    
    // 测试结束后清理所有账号
    for (const account of accounts) {
      await apiClient.deleteFacebookAccount(account.id, authToken).catch(() => {});
    }
  },

  createTestAccount: async ({ apiClient, authToken }, use) => {
    const createAccount = async (overrides = {}) => {
      const accountData = DataFactory.createFacebookAccount(overrides);
      const response = await apiClient.createFacebookAccount(accountData, authToken);
      expect(response.status).toBe(201);
      return response.data;
    };
    
    await use(createAccount);
  },

  cleanupTestAccounts: async ({ apiClient, authToken }, use) => {
    const cleanup = async () => {
      // 获取所有测试账号并删除
      const response = await apiClient.getFacebookAccounts(authToken);
      if (response.status === 200 && response.data) {
        const accounts = Array.isArray(response.data) ? response.data : response.data.items || [];
        for (const account of accounts) {
          if (account.username?.includes('testuser') || account.email?.includes('test')) {
            await apiClient.deleteFacebookAccount(account.id, authToken).catch(() => {});
          }
        }
      }
    };
    
    await use(cleanup);
  },
});