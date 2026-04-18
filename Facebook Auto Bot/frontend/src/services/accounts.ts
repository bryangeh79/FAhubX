import api from './api';
import { ExtendedFacebookAccount } from '../types/facebook-login';

export interface FacebookAccount {
  id: string;
  name: string;
  facebookId?: string;
  email?: string;
  remarks?: string;
  accountType: 'user' | 'page' | 'business';
  verified?: boolean;
  loginStatus?: boolean;
  status?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AccountStats {
  totalAccounts: number;
  activeAccounts: number;
  expiredAccounts: number;
  [key: string]: number;
}

export interface AccountsResponse {
  data: {
    accounts: FacebookAccount[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface GetAccountsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateAccountData {
  name: string;
  facebookId: string;
  email?: string;
  facebookPassword?: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
  accountType: 'user' | 'page' | 'business';
  verified?: boolean;
  remarks?: string;
}

export const accountsService = {
  async getAccounts(params?: GetAccountsParams): Promise<AccountsResponse> {
    const response = await api.get<AccountsResponse>('/facebook-accounts', { params });
    return response.data;
  },

  async getStats(): Promise<{ data: AccountStats }> {
    const response = await api.get<{ data: AccountStats }>('/facebook-accounts/stats');
    return response.data;
  },

  async createAccount(data: CreateAccountData): Promise<{ data: FacebookAccount }> {
    const response = await api.post<{ data: FacebookAccount }>('/facebook-accounts', data);
    return response.data;
  },

  async updateAccount(id: string, data: Partial<CreateAccountData>): Promise<{ data: FacebookAccount }> {
    const response = await api.patch<{ data: FacebookAccount }>(`/facebook-accounts/${id}`, data);
    return response.data;
  },

  async deleteAccount(id: string): Promise<void> {
    await api.delete(`/facebook-accounts/${id}`);
  },

  async syncAccount(id: string): Promise<{ data: FacebookAccount }> {
    const response = await api.post<{ data: FacebookAccount }>(`/facebook-accounts/${id}/sync`);
    return response.data;
  },

  // 新增接口
  async getExtendedAccount(id: string): Promise<{ data: ExtendedFacebookAccount }> {
    const response = await api.get<{ data: ExtendedFacebookAccount }>(`/facebook-accounts/${id}/extended`);
    return response.data;
  },

  async getAccountLoginConfig(id: string): Promise<{ data: ExtendedFacebookAccount['loginConfig'] }> {
    const response = await api.get<{ data: ExtendedFacebookAccount['loginConfig'] }>(`/facebook-accounts/${id}/login-config`);
    return response.data;
  },

  async updateAccountLoginConfig(id: string, data: Partial<ExtendedFacebookAccount['loginConfig']>): Promise<{ data: ExtendedFacebookAccount }> {
    const response = await api.patch<{ data: ExtendedFacebookAccount }>(`/facebook-accounts/${id}/login-config`, data);
    return response.data;
  },

  async getAccountSessions(id: string): Promise<{ data: any[] }> {
    const response = await api.get<{ data: any[] }>(`/facebook-accounts/${id}/sessions`);
    return response.data;
  },

  async clearAccountSessions(id: string): Promise<void> {
    await api.delete(`/facebook-accounts/${id}/sessions`);
  },

  // ─── 半自动注册新账号 ──────────────────────────────────────────────
  async startRegistration(data: {
    firstName: string;
    lastName: string;
    email: string;
    facebookPassword: string;
    vpnConfigId: string;
    name?: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female' | 'custom';
    accountType?: 'user' | 'page' | 'business';
    remarks?: string;
  }): Promise<{ accountId: string; status: string }> {
    const response = await api.post<{ accountId: string; status: string }>(
      '/facebook-accounts/start-registration',
      data,
    );
    return response.data;
  },

  async getRegistrationStatus(accountId: string): Promise<{
    status: 'registering' | 'idle' | 'registration_failed';
    facebookId?: string;
    error?: string;
  }> {
    const response = await api.get<{
      status: 'registering' | 'idle' | 'registration_failed';
      facebookId?: string;
      error?: string;
    }>(`/facebook-accounts/${accountId}/registration-status`);
    return response.data;
  },

  async cancelRegistration(accountId: string): Promise<void> {
    await api.post(`/facebook-accounts/${accountId}/cancel-registration`);
  },
};
