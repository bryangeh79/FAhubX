import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../utils/api.client';
import { DatabaseHelper } from '../utils/db.helper';

export type AuthFixtures = {
  apiClient: ApiClient;
  dbHelper: DatabaseHelper;
  adminUser: { email: string; password: string };
  regularUser: { email: string; password: string };
  authToken: string;
};

export const test = base.extend<AuthFixtures>({
  apiClient: async ({}, use) => {
    const apiClient = new ApiClient();
    await use(apiClient);
  },

  dbHelper: async ({}, use) => {
    const dbHelper = new DatabaseHelper();
    await dbHelper.connect();
    await use(dbHelper);
    await dbHelper.disconnect();
  },

  adminUser: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'Admin123!',
  },

  regularUser: {
    email: process.env.TEST_USER_EMAIL || 'user@test.com',
    password: process.env.TEST_USER_PASSWORD || 'User123!',
  },

  authToken: async ({ apiClient, adminUser }, use) => {
    // 登录获取token
    const response = await apiClient.login(adminUser.email, adminUser.password);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('access_token');
    
    const token = response.data.access_token;
    await use(token);
    
    // 测试结束后登出
    await apiClient.logout(token);
  },
});

export { expect };