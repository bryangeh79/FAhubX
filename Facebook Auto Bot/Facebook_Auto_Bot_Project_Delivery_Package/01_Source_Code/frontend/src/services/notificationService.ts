/**
 * 推送通知服务
 * 处理应用内的通知功能
 */

import pwaService from './pwaService';
import { NotificationOptions } from '../types/pwa';

export enum NotificationType {
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  ACCOUNT_ALERT = 'account_alert',
  SYSTEM_ALERT = 'system_alert',
  MESSAGE_RECEIVED = 'message_received',
  PERFORMANCE_ALERT = 'performance_alert',
  UPDATE_AVAILABLE = 'update_available'
}

export interface NotificationData {
  type: NotificationType;
  title: string;
  body: string;
  icon?: string;
  data?: any;
  timestamp?: number;
  read?: boolean;
  actionUrl?: string;
}

class NotificationService {
  private static instance: NotificationService;
  private notifications: NotificationData[] = [];
  private publicKey: string = ''; // Web Push 公钥
  private notificationSound: HTMLAudioElement | null = null;
  private notificationPermission: NotificationPermission = 'default';
  private maxStoredNotifications = 100;

  private constructor() {
    this.loadNotifications();
    this.loadPublicKey();
    this.setupNotificationSound();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async loadPublicKey(): Promise<void> {
    // 这里应该从后端获取公钥
    // 暂时使用一个示例公钥
    this.publicKey = 'BP4z9Ks4qYQ8vW6p6w8Q6Y7X2v1w3z4x5c6v7b8n9m0q1w2e3r4t5y6u7i8o9p0';
  }

  private setupNotificationSound(): void {
    try {
      this.notificationSound = new Audio('/sounds/notification.mp3');
      this.notificationSound.preload = 'auto';
    } catch (error) {
      console.warn('Could not load notification sound:', error);
    }
  }

  private loadNotifications(): void {
    try {
      const stored = localStorage.getItem('notifications');
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      this.notifications = [];
    }
  }

  private saveNotifications(): void {
    try {
      localStorage.setItem('notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  }

  private playNotificationSound(): void {
    if (this.notificationSound) {
      this.notificationSound.currentTime = 0;
      this.notificationSound.play().catch(error => {
        console.warn('Could not play notification sound:', error);
      });
    }
  }

  private getNotificationIcon(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      [NotificationType.TASK_COMPLETED]: '/icons/task-completed.png',
      [NotificationType.TASK_FAILED]: '/icons/task-failed.png',
      [NotificationType.ACCOUNT_ALERT]: '/icons/account-alert.png',
      [NotificationType.SYSTEM_ALERT]: '/icons/system-alert.png',
      [NotificationType.MESSAGE_RECEIVED]: '/icons/message-received.png',
      [NotificationType.PERFORMANCE_ALERT]: '/icons/performance-alert.png',
      [NotificationType.UPDATE_AVAILABLE]: '/icons/update-available.png'
    };

    return icons[type] || '/pwa-192x192.png';
  }

  private getNotificationBadge(type: NotificationType): string {
    const badges: Record<NotificationType, string> = {
      [NotificationType.TASK_COMPLETED]: '/badges/success-72x72.png',
      [NotificationType.TASK_FAILED]: '/badges/error-72x72.png',
      [NotificationType.ACCOUNT_ALERT]: '/badges/warning-72x72.png',
      [NotificationType.SYSTEM_ALERT]: '/badges/alert-72x72.png',
      [NotificationType.MESSAGE_RECEIVED]: '/badges/message-72x72.png',
      [NotificationType.PERFORMANCE_ALERT]: '/badges/performance-72x72.png',
      [NotificationType.UPDATE_AVAILABLE]: '/badges/update-72x72.png'
    };

    return badges[type] || '/badge-72x72.png';
  }

  async sendNotification(
    type: NotificationType,
    title: string,
    body: string,
    data?: any,
    actionUrl?: string
  ): Promise<boolean> {
    const notificationData: NotificationData = {
      type,
      title,
      body,
      icon: this.getNotificationIcon(type),
      data,
      timestamp: Date.now(),
      read: false,
      actionUrl
    };

    // 存储通知
    this.notifications.unshift(notificationData);
    
    // 限制存储数量
    if (this.notifications.length > this.maxStoredNotifications) {
      this.notifications = this.notifications.slice(0, this.maxStoredNotifications);
    }
    
    this.saveNotifications();

    // 播放声音
    this.playNotificationSound();

    // 发送推送通知
    const notificationOptions: NotificationOptions = {
      title,
      body,
      icon: this.getNotificationIcon(type),
      badge: this.getNotificationBadge(type),
      tag: type,
      renotify: true,
      requireInteraction: type === NotificationType.SYSTEM_ALERT || 
                         type === NotificationType.ACCOUNT_ALERT,
      data: {
        ...data,
        url: actionUrl || '/notifications',
        notificationId: notificationData.timestamp
      },
      actions: this.getNotificationActions(type, actionUrl)
    };

    try {
      await pwaService.sendNotification(notificationOptions);
      return true;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      
      // 回退到浏览器通知
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: this.getNotificationIcon(type)
        });
        return true;
      }
      
      return false;
    }
  }

  private getNotificationActions(type: NotificationType, actionUrl?: string): any[] {
    const actions = [];
    
    switch (type) {
      case NotificationType.TASK_COMPLETED:
        actions.push({
          action: 'view_task',
          title: '查看任务'
        });
        break;
        
      case NotificationType.MESSAGE_RECEIVED:
        actions.push({
          action: 'view_message',
          title: '查看消息'
        });
        break;
        
      case NotificationType.UPDATE_AVAILABLE:
        actions.push({
          action: 'refresh',
          title: '刷新页面'
        });
        break;
    }
    
    if (actionUrl) {
      actions.push({
        action: 'open_url',
        title: '打开'
      });
    }
    
    return actions;
  }

  // ========== 特定类型的通知方法 ==========

  async sendTaskCompletedNotification(
    taskId: string,
    taskName: string,
    result?: any
  ): Promise<boolean> {
    return this.sendNotification(
      NotificationType.TASK_COMPLETED,
      '任务完成',
      `任务 "${taskName}" 已成功完成`,
      { taskId, taskName, result },
      `/tasks/${taskId}`
    );
  }

  async sendTaskFailedNotification(
    taskId: string,
    taskName: string,
    error: string
  ): Promise<boolean> {
    return this.sendNotification(
      NotificationType.TASK_FAILED,
      '任务失败',
      `任务 "${taskName}" 执行失败: ${error}`,
      { taskId, taskName, error },
      `/tasks/${taskId}`
    );
  }

  async sendAccountAlertNotification(
    accountId: string,
    accountName: string,
    alertType: string,
    message: string
  ): Promise<boolean> {
    return this.sendNotification(
      NotificationType.ACCOUNT_ALERT,
      '账号告警',
      `账号 "${accountName}" ${alertType}: ${message}`,
      { accountId, accountName, alertType, message },
      `/accounts/${accountId}`
    );
  }

  async sendSystemAlertNotification(
    alertType: string,
    message: string,
    severity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<boolean> {
    return this.sendNotification(
      NotificationType.SYSTEM_ALERT,
      '系统告警',
      `${alertType}: ${message}`,
      { alertType, message, severity },
      '/system/alerts'
    );
  }

  async sendMessageReceivedNotification(
    messageId: string,
    sender: string,
    preview: string
  ): Promise<boolean> {
    return this.sendNotification(
      NotificationType.MESSAGE_RECEIVED,
      '新消息',
      `${sender}: ${preview}`,
      { messageId, sender, preview },
      `/messages/${messageId}`
    );
  }

  async sendPerformanceAlertNotification(
    metric: string,
    value: number,
    threshold: number
  ): Promise<boolean> {
    return this.sendNotification(
      NotificationType.PERFORMANCE_ALERT,
      '性能告警',
      `${metric} 达到 ${value}，超过阈值 ${threshold}`,
      { metric, value, threshold },
      '/dashboard/performance'
    );
  }

  async sendUpdateAvailableNotification(version: string): Promise<boolean> {
    return this.sendNotification(
      NotificationType.UPDATE_AVAILABLE,
      '更新可用',
      `新版本 ${version} 已就绪，点击刷新页面`,
      { version },
      window.location.href
    );
  }

  // ========== 通知管理方法 ==========

  getNotifications(): NotificationData[] {
    return [...this.notifications];
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  markAsRead(notificationId: number): void {
    const notification = this.notifications.find(n => n.timestamp === notificationId);
    if (notification) {
      notification.read = true;
      this.saveNotifications();
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
    this.saveNotifications();
  }

  deleteNotification(notificationId: number): void {
    this.notifications = this.notifications.filter(n => n.timestamp !== notificationId);
    this.saveNotifications();
  }

  clearAllNotifications(): void {
    this.notifications = [];
    this.saveNotifications();
  }

  // ========== 推送订阅管理 ==========

  async subscribeToPushNotifications(): Promise<boolean> {
    try {
      const subscription = await pwaService.subscribeToPushNotifications(this.publicKey);
      
      if (subscription) {
        // 将订阅信息发送到后端
        await this.sendSubscriptionToBackend(subscription);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return false;
    }
  }

  private async sendSubscriptionToBackend(subscription: any): Promise<void> {
    try {
      // 这里实现将订阅信息发送到后端的逻辑
      console.log('Sending subscription to backend:', subscription);
      
      // 示例：发送到后端 API
      // await fetch('/api/push/subscribe', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(subscription),
      // });
    } catch (error) {
      console.error('Failed to send subscription to backend:', error);
    }
  }

  async checkNotificationPermission(): Promise<NotificationPermission> {
    return await pwaService.requestNotificationPermission();
  }

  getNotificationPermission(): NotificationPermission {
    return this.notificationPermission;
  }

  // ========== 工具方法 ==========

  formatNotificationTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    
    return new Date(timestamp).toLocaleDateString();
  }

  groupNotificationsByDate(): Record<string, NotificationData[]> {
    const groups: Record<string, NotificationData[]> = {};
    
    this.notifications.forEach(notification => {
      if (!notification.timestamp) return;
      
      const date = new Date(notification.timestamp);
      const dateKey = date.toLocaleDateString();
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      
      groups[dateKey].push(notification);
    });
    
    return groups;
  }

  // ========== 测试方法 ==========

  async testNotification(type: NotificationType = NotificationType.TASK_COMPLETED): Promise<boolean> {
    const testData: Record<NotificationType, { title: string; body: string }> = {
      [NotificationType.TASK_COMPLETED]: {
        title: '测试通知 - 任务完成',
        body: '这是一个测试通知，模拟任务完成的情况'
      },
      [NotificationType.TASK_FAILED]: {
        title: '测试通知 - 任务失败',
        body: '这是一个测试通知，模拟任务失败的情况'
      },
      [NotificationType.ACCOUNT_ALERT]: {
        title: '测试通知 - 账号告警',
        body: '这是一个测试通知，模拟账号异常的情况'
      },
      [NotificationType.SYSTEM_ALERT]: {
        title: '测试通知 - 系统告警',
        body: '这是一个测试通知，模拟系统告警的情况'
      },
      [NotificationType.MESSAGE_RECEIVED]: {
        title: '测试通知 - 新消息',
        body: '这是一个测试通知，模拟收到新消息的情况'
      },
      [NotificationType.PERFORMANCE_ALERT]: {
        title: '测试通知 - 性能告警',
        body: '这是一个测试通知，模拟性能告警的情况'
      },
      [NotificationType.UPDATE_AVAILABLE]: {
        title: '测试通知 - 更新可用',
        body: '这是一个测试通知，模拟有新版本可用的情况'
      }
    };

    const test = testData[type];
    return this.sendNotification(type, test.title, test.body, { test: true });
  }
}

export default NotificationService.getInstance();