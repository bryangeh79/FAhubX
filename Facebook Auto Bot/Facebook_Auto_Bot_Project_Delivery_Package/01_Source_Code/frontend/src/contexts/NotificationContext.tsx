import React, { createContext, useContext, useState, ReactNode } from 'react';
import { notification } from 'antd';

// 通知类型
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// 通知上下文类型
interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (type: Notification['type'], title: string, message: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

// 创建上下文
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// 通知提供者组件
interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'info',
      title: '欢迎使用 Facebook Auto Bot',
      message: '系统已准备就绪，您可以开始添加Facebook账号了。',
      timestamp: new Date(),
      read: false,
    },
    {
      id: '2',
      type: 'success',
      title: '系统更新完成',
      message: '系统已更新到最新版本 v1.0.0',
      timestamp: new Date(Date.now() - 3600000), // 1小时前
      read: true,
    },
  ]);

  // 计算未读数量
  const unreadCount = notifications.filter(n => !n.read).length;

  // 添加通知
  const addNotification = (type: Notification['type'], title: string, message: string) => {
    const id = Date.now().toString();
    const newNotification: Notification = {
      id,
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);

    // 显示Ant Design通知
    notification[type]({
      message: title,
      description: message,
      placement: 'topRight',
    });
  };

  // 标记为已读
  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  // 标记所有为已读
  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  // 移除通知
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  // 清除所有通知
  const clearAll = () => {
    setNotifications([]);
  };

  const value = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// 自定义hook使用通知上下文
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications必须在NotificationProvider内部使用');
  }
  return context;
};