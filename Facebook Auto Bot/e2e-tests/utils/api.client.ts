import axios, { AxiosInstance, AxiosResponse } from 'axios';

export interface ApiResponse<T = any> {
  status: number;
  data: T;
  message?: string;
}

export class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.BACKEND_URL || 'http://localhost:3001';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: parseInt(process.env.BACKEND_TIMEOUT || '30000'),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        // 可以在这里添加认证token
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

  private async request<T>(
    method: string,
    url: string,
    data?: any,
    token?: string
  ): Promise<ApiResponse<T>> {
    const config: any = {
      method,
      url,
    };

    if (data) {
      config.data = data;
    }

    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    try {
      const response: AxiosResponse = await this.client.request(config);
      return {
        status: response.status,
        data: response.data,
      };
    } catch (error: any) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { message: 'Network error' },
        message: error.message,
      };
    }
  }

  // 认证相关API
  async login(email: string, password: string): Promise<ApiResponse> {
    return this.request('POST', '/auth/login', { email, password });
  }

  async register(userData: any): Promise<ApiResponse> {
    return this.request('POST', '/auth/register', userData);
  }

  async logout(token: string): Promise<ApiResponse> {
    return this.request('POST', '/auth/logout', {}, token);
  }

  async getProfile(token: string): Promise<ApiResponse> {
    return this.request('GET', '/auth/profile', {}, token);
  }

  async updateProfile(userData: any, token: string): Promise<ApiResponse> {
    return this.request('PATCH', '/auth/profile', userData, token);
  }

  async changePassword(oldPassword: string, newPassword: string, token: string): Promise<ApiResponse> {
    return this.request('POST', '/auth/change-password', { oldPassword, newPassword }, token);
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse> {
    return this.request('POST', '/auth/refresh', { refreshToken });
  }

  // Facebook账号管理API
  async getFacebookAccounts(token: string, params?: any): Promise<ApiResponse> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request('GET', `/facebook-accounts${query}`, {}, token);
  }

  async getFacebookAccount(id: string, token: string): Promise<ApiResponse> {
    return this.request('GET', `/facebook-accounts/${id}`, {}, token);
  }

  async createFacebookAccount(accountData: any, token: string): Promise<ApiResponse> {
    return this.request('POST', '/facebook-accounts', accountData, token);
  }

  async updateFacebookAccount(id: string, accountData: any, token: string): Promise<ApiResponse> {
    return this.request('PATCH', `/facebook-accounts/${id}`, accountData, token);
  }

  async deleteFacebookAccount(id: string, token: string): Promise<ApiResponse> {
    return this.request('DELETE', `/facebook-accounts/${id}`, {}, token);
  }

  async testFacebookAccountConnection(id: string, token: string): Promise<ApiResponse> {
    return this.request('POST', `/facebook-accounts/${id}/test-connection`, {}, token);
  }

  async loginFacebookAccount(id: string, token: string): Promise<ApiResponse> {
    return this.request('POST', `/facebook-accounts/${id}/login`, {}, token);
  }

  async getFacebookAccountStats(token: string): Promise<ApiResponse> {
    return this.request('GET', '/facebook-accounts/stats', {}, token);
  }

  async getExpiringFacebookAccounts(token: string): Promise<ApiResponse> {
    return this.request('GET', '/facebook-accounts/expiring', {}, token);
  }

  // 任务调度API（如果已实现）
  async getTasks(token: string, params?: any): Promise<ApiResponse> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request('GET', `/tasks${query}`, {}, token);
  }

  async getTask(id: string, token: string): Promise<ApiResponse> {
    return this.request('GET', `/tasks/${id}`, {}, token);
  }

  async createTask(taskData: any, token: string): Promise<ApiResponse> {
    return this.request('POST', '/tasks', taskData, token);
  }

  async updateTask(id: string, taskData: any, token: string): Promise<ApiResponse> {
    return this.request('PUT', `/tasks/${id}`, taskData, token);
  }

  async deleteTask(id: string, token: string): Promise<ApiResponse> {
    return this.request('DELETE', `/tasks/${id}`, {}, token);
  }

  async updateTaskStatus(id: string, status: string, token: string): Promise<ApiResponse> {
    return this.request('PATCH', `/tasks/${id}/status`, { status }, token);
  }

  async executeTask(id: string, token: string): Promise<ApiResponse> {
    return this.request('POST', `/tasks/${id}/execute`, {}, token);
  }

  async getTaskHistory(id: string, token: string): Promise<ApiResponse> {
    return this.request('GET', `/tasks/${id}/history`, {}, token);
  }

  async getRecentTasks(token: string): Promise<ApiResponse> {
    return this.request('GET', '/tasks/recent', {}, token);
  }

  // 系统健康检查
  async healthCheck(): Promise<ApiResponse> {
    return this.request('GET', '/health');
  }

  // 系统状态
  async getSystemStatus(token: string): Promise<ApiResponse> {
    return this.request('GET', '/system/status', {}, token);
  }

  // 批量操作
  async importAccounts(fileData: any, token: string): Promise<ApiResponse> {
    return this.request('POST', '/batch/import/accounts', fileData, token);
  }

  async exportAccounts(params: any, token: string): Promise<ApiResponse> {
    return this.request('POST', '/batch/export/accounts', params, token);
  }
}