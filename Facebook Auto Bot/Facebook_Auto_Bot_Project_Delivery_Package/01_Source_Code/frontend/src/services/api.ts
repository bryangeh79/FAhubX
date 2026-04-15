import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 从localStorage获取token
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 如果是401错误且不是刷新token的请求，尝试刷新token
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh') {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('没有刷新令牌');
        }

        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/auth/refresh`,
          { refreshToken }
        );

        const { access_token, refresh_token: newRefreshToken } = response.data;

        // 更新本地存储
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', newRefreshToken);

        // 更新请求头
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        // 重试原始请求
        return api(originalRequest);
      } catch (refreshError) {
        // 刷新失败，清除本地存储并跳转到登录页面
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
        
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }

    // 处理其他错误
    if (error.response) {
      // 服务器返回错误
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          console.error('请求错误:', data.message || '参数错误');
          break;
        case 403:
          console.error('权限不足:', data.message || '没有访问权限');
          break;
        case 404:
          console.error('资源不存在:', data.message || '请求的资源不存在');
          break;
        case 500:
          console.error('服务器错误:', data.message || '服务器内部错误');
          break;
        default:
          console.error('请求失败:', data.message || '未知错误');
      }
    } else if (error.request) {
      // 请求发送但没有收到响应
      console.error('网络错误:', '无法连接到服务器');
    } else {
      // 请求配置错误
      console.error('请求配置错误:', error.message);
    }

    return Promise.reject(error);
  }
);

// API方法封装
export const authAPI = {
  // 登录
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  // 注册
  register: (data: {
    email: string;
    username: string;
    password: string;
    fullName: string;
  }) => api.post('/auth/register', data),
  
  // 获取用户信息
  getProfile: () => api.get('/auth/profile'),
  
  // 更新用户信息
  updateProfile: (data: any) => api.patch('/auth/profile', data),
  
  // 更改密码
  changePassword: (data: {
    currentPassword: string;
    newPassword: string;
  }) => api.post('/auth/change-password', data),
  
  // 登出
  logout: () => api.post('/auth/logout'),
  
  // 刷新token
  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
};

export const accountsAPI = {
  // 获取账号列表
  getAccounts: (params?: any) => api.get('/facebook-accounts', { params }),
  
  // 获取单个账号
  getAccount: (id: string) => api.get(`/facebook-accounts/${id}`),
  
  // 创建账号
  createAccount: (data: any) => api.post('/facebook-accounts', data),
  
  // 更新账号
  updateAccount: (id: string, data: any) => api.patch(`/facebook-accounts/${id}`, data),
  
  // 删除账号
  deleteAccount: (id: string) => api.delete(`/facebook-accounts/${id}`),
  
  // 测试连接
  testConnection: (id: string) => api.post(`/facebook-accounts/${id}/test-connection`),
  
  // 手动登录
  loginAccount: (id: string) => api.post(`/facebook-accounts/${id}/login`),
  
  // 获取账号统计
  getAccountStats: () => api.get('/facebook-accounts/stats'),
  
  // 获取即将过期的账号
  getExpiringAccounts: () => api.get('/facebook-accounts/expiring'),
};

export const tasksAPI = {
  // 获取任务列表
  getTasks: (params?: any) => api.get('/tasks', { params }),
  
  // 获取单个任务
  getTask: (id: string) => api.get(`/tasks/${id}`),
  
  // 创建任务
  createTask: (data: any) => api.post('/tasks', data),
  
  // 更新任务
  updateTask: (id: string, data: any) => api.put(`/tasks/${id}`, data),
  
  // 删除任务
  deleteTask: (id: string) => api.delete(`/tasks/${id}`),
  
  // 更新任务状态
  updateTaskStatus: (id: string, status: string) =>
    api.put(`/tasks/${id}/status`, { status }),
  
  // 立即执行任务
  executeTask: (id: string) => api.post(`/tasks/${id}/execute`),
  
  // 获取任务历史
  getTaskHistory: (id: string, params?: any) =>
    api.get(`/tasks/${id}/history`, { params }),
  
  // 获取最近任务
  getRecentTasks: () => api.get('/tasks/recent'),
};

export const conversationAPI = {
  // 获取对话剧本列表
  getScripts: (params?: any) => api.get('/conversation/scripts', { params }),
  
  // 获取单个剧本
  getScript: (id: string) => api.get(`/conversation/scripts/${id}`),
  
  // 创建剧本
  createScript: (data: any) => api.post('/conversation/scripts', data),
  
  // 更新剧本
  updateScript: (id: string, data: any) => api.put(`/conversation/scripts/${id}`, data),
  
  // 删除剧本
  deleteScript: (id: string) => api.delete(`/conversation/scripts/${id}`),
  
  // 运行剧本
  runScript: (id: string, data?: any) => api.post(`/conversation/scripts/${id}/run`, data),
};

export const dashboardAPI = {
  // 获取仪表板统计
  getStats: () => api.get('/dashboard/stats'),
  
  // 获取系统状态
  getSystemStatus: () => api.get('/dashboard/system-status'),
  
  // 获取活动日志
  getActivityLogs: (params?: any) => api.get('/dashboard/activity-logs', { params }),
};

export default api;