import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { message } from 'antd';

// API基础URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// 用户类型定义
export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  emailVerified: boolean;
  avatarUrl?: string;
  preferences: Record<string, any>;
}

// 认证上下文类型
interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

// 创建上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 认证提供者组件
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 初始化时检查本地存储的token
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      const userData = localStorage.getItem('user_data');

      if (token && userData) {
        try {
          // 验证token是否有效
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // 尝试获取用户信息
          const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          setUser(response.data);
          setIsAuthenticated(true);
        } catch (error) {
          // token无效，清除本地存储
          localStorage.removeItem('access_token');
          localStorage.removeItem('user_data');
          localStorage.removeItem('refresh_token');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
      
      setLoading(false);
    };

    initAuth();
  }, []);

  // 登录函数
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      const { access_token, refresh_token, user: userData } = response.data;

      // 保存token和用户数据
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user_data', JSON.stringify(userData));

      // 设置axios默认header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // 更新状态
      setUser(userData);
      setIsAuthenticated(true);

      message.success('登录成功！');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '登录失败，请检查邮箱和密码';
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 注册函数
  const register = async (email: string, username: string, password: string, fullName: string) => {
    try {
      setLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        email,
        username,
        password,
        fullName,
      });

      message.success('注册成功！请检查邮箱验证邮件。');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '注册失败，请稍后重试';
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 登出函数
  const logout = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('登出时出错:', error);
    } finally {
      // 清除本地存储
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_data');
      localStorage.removeItem('refresh_token');
      delete axios.defaults.headers.common['Authorization'];

      // 更新状态
      setUser(null);
      setIsAuthenticated(false);

      message.success('已成功登出');
    }
  };

  // 刷新token函数
  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('没有刷新令牌');
      }

      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;

      // 更新本地存储
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', newRefreshToken);

      // 更新axios默认header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      return access_token;
    } catch (error) {
      // 刷新失败，强制登出
      await logout();
      throw error;
    }
  };

  // 更新用户信息函数
  const updateUser = async (userData: Partial<User>) => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/auth/profile`, userData);
      
      const updatedUser = { ...user, ...response.data };
      setUser(updatedUser);
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
      
      message.success('用户信息更新成功');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '更新失败';
      throw new Error(errorMessage);
    }
  };

  // 设置axios拦截器处理token过期
  useEffect(() => {
    // 请求拦截器
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // 如果是401错误且不是刷新token的请求，尝试刷新token
        if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh') {
          originalRequest._retry = true;

          try {
            const newToken = await refreshToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axios(originalRequest);
          } catch (refreshError) {
            // 刷新失败，跳转到登录页面
            await logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    // 清理函数
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [refreshToken, logout]);

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshToken,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 自定义hook使用认证上下文
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
};