/**
 * PWA 服务
 * 处理 PWA 相关功能：安装提示、推送通知、离线功能等
 */

import { 
  BeforeInstallPromptEvent, 
  PushSubscriptionData, 
  NotificationOptions,
  ServiceWorkerUpdateInfo,
  PWACapabilities,
  OfflineOperation,
  OfflineQueueConfig,
  PWAMetrics
} from '../types/pwa';

class PWAService {
  private static instance: PWAService;
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isAppInstalled = false;
  private notificationPermission: NotificationPermission = 'default';
  private offlineQueue: OfflineOperation[] = [];
  private offlineQueueConfig: OfflineQueueConfig = {
    maxRetries: 3,
    retryDelay: 5000,
    maxQueueSize: 100,
    syncInterval: 30000
  };
  private metrics: PWAMetrics = {
    installs: 0,
    notificationsSent: 0,
    notificationsClicked: 0,
    offlineOperations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    storageUsage: 0,
    lastUpdateCheck: Date.now()
  };

  private constructor() {
    this.init();
  }

  static getInstance(): PWAService {
    if (!PWAService.instance) {
      PWAService.instance = new PWAService();
    }
    return PWAService.instance;
  }

  private async init(): Promise<void> {
    this.setupInstallPrompt();
    this.checkAppInstalled();
    this.checkNotificationPermission();
    this.setupServiceWorker();
    this.setupOfflineQueue();
    this.loadMetrics();
  }

  // ========== 安装提示功能 ==========

  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      console.log('PWA install prompt available');
      
      // 保存安装提示事件
      this.saveInstallPrompt();
    });

    window.addEventListener('appinstalled', () => {
      this.isAppInstalled = true;
      this.deferredPrompt = null;
      this.metrics.installs++;
      this.saveMetrics();
      console.log('PWA installed successfully');
    });
  }

  private saveInstallPrompt(): void {
    if (this.deferredPrompt) {
      localStorage.setItem('pwa_install_prompt_available', 'true');
      localStorage.setItem('pwa_install_prompt_time', Date.now().toString());
    }
  }

  async showInstallPrompt(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.warn('No install prompt available');
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        this.metrics.installs++;
        this.saveMetrics();
        return true;
      } else {
        console.log('User dismissed the install prompt');
        return false;
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
      return false;
    }
  }

  canShowInstallPrompt(): boolean {
    return !!this.deferredPrompt && !this.isAppInstalled;
  }

  private checkAppInstalled(): void {
    // 检查是否已安装
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isAppInstalled = true;
    }
    
    // 检查 navigator.standalone (iOS)
    if ('standalone' in navigator && (navigator as any).standalone) {
      this.isAppInstalled = true;
    }
  }

  isPWAInstalled(): boolean {
    return this.isAppInstalled;
  }

  // ========== 推送通知功能 ==========

  private checkNotificationPermission(): void {
    this.notificationPermission = Notification.permission;
  }

  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (this.notificationPermission === 'default') {
      const permission = await Notification.requestPermission();
      this.notificationPermission = permission;
      return permission;
    }

    return this.notificationPermission;
  }

  async sendNotification(options: NotificationOptions): Promise<Notification | null> {
    if (this.notificationPermission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    try {
      const serviceWorker = await navigator.serviceWorker.ready;
      const notification = await serviceWorker.showNotification(
        options.title,
        options
      );
      
      this.metrics.notificationsSent++;
      this.saveMetrics();
      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      
      // 回退到普通通知
      if ('Notification' in window) {
        const notification = new Notification(options.title, options);
        this.metrics.notificationsSent++;
        this.saveMetrics();
        return notification;
      }
      
      return null;
    }
  }

  async subscribeToPushNotifications(publicKey: string): Promise<PushSubscriptionData | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return null;
    }

    try {
      const serviceWorker = await navigator.serviceWorker.ready;
      const subscription = await serviceWorker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey)
      });

      return {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
          auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
        }
      };
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  // ========== Service Worker 功能 ==========

  private async setupServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      console.log('Service Worker registered:', registration);

      // 监听更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New content is available; please refresh.');
              this.showUpdateNotification();
            }
          });
        }
      });

      // 检查更新
      setInterval(() => {
        registration.update();
        this.metrics.lastUpdateCheck = Date.now();
        this.saveMetrics();
      }, 60 * 60 * 1000); // 每小时检查一次更新

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async checkForUpdates(): Promise<ServiceWorkerUpdateInfo> {
    if (!('serviceWorker' in navigator)) {
      return { waiting: false, updateAvailable: false };
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const updateInfo: ServiceWorkerUpdateInfo = {
        waiting: false,
        updateAvailable: false,
        registration
      };

      if (registration.waiting) {
        updateInfo.waiting = true;
        updateInfo.updateAvailable = true;
      } else if (registration.installing) {
        updateInfo.updateAvailable = true;
      }

      return updateInfo;
    } catch (error) {
      console.error('Error checking for updates:', error);
      return { waiting: false, updateAvailable: false };
    }
  }

  async updateServiceWorker(): Promise<boolean> {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating service worker:', error);
      return false;
    }
  }

  private showUpdateNotification(): void {
    this.sendNotification({
      title: '更新可用',
      body: '新版本已就绪，点击刷新页面',
      tag: 'update',
      requireInteraction: true,
      actions: [
        {
          action: 'refresh',
          title: '刷新'
        },
        {
          action: 'dismiss',
          title: '忽略'
        }
      ],
      data: {
        url: window.location.href
      }
    });
  }

  // ========== 离线功能 ==========

  private setupOfflineQueue(): void {
    this.loadOfflineQueue();
    
    // 定期同步离线操作
    setInterval(() => {
      this.syncOfflineOperations();
    }, this.offlineQueueConfig.syncInterval);

    // 监听网络状态
    window.addEventListener('online', () => {
      console.log('Network is online, syncing offline operations');
      this.syncOfflineOperations();
    });

    window.addEventListener('offline', () => {
      console.log('Network is offline');
    });
  }

  private loadOfflineQueue(): void {
    try {
      const queue = localStorage.getItem('offline_queue');
      if (queue) {
        this.offlineQueue = JSON.parse(queue);
        this.metrics.offlineOperations = this.offlineQueue.length;
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
      this.offlineQueue = [];
    }
  }

  private saveOfflineQueue(): void {
    try {
      localStorage.setItem('offline_queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  addOfflineOperation(type: string, data: any): string {
    if (this.offlineQueue.length >= this.offlineQueueConfig.maxQueueSize) {
      throw new Error('Offline queue is full');
    }

    const operation: OfflineOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    this.offlineQueue.push(operation);
    this.metrics.offlineOperations++;
    this.saveOfflineQueue();
    this.saveMetrics();

    return operation.id;
  }

  private async syncOfflineOperations(): Promise<void> {
    if (!navigator.onLine || this.offlineQueue.length === 0) {
      return;
    }

    const pendingOperations = this.offlineQueue.filter(op => op.status === 'pending');
    
    for (const operation of pendingOperations) {
      try {
        operation.status = 'processing';
        this.saveOfflineQueue();

        // 这里实现具体的操作同步逻辑
        // 例如：发送 API 请求
        const response = await this.processOperation(operation);
        
        if (response.success) {
          operation.status = 'completed';
          this.offlineQueue = this.offlineQueue.filter(op => op.id !== operation.id);
        } else {
          operation.retryCount++;
          if (operation.retryCount >= this.offlineQueueConfig.maxRetries) {
            operation.status = 'failed';
          } else {
            operation.status = 'pending';
          }
        }
      } catch (error) {
        console.error(`Error syncing operation ${operation.id}:`, error);
        operation.retryCount++;
        if (operation.retryCount >= this.offlineQueueConfig.maxRetries) {
          operation.status = 'failed';
        } else {
          operation.status = 'pending';
        }
      }

      this.saveOfflineQueue();
    }
  }

  private async processOperation(operation: OfflineOperation): Promise<{ success: boolean }> {
    // 这里实现具体的操作处理逻辑
    // 例如：发送 API 请求
    console.log('Processing offline operation:', operation);
    
    // 模拟 API 调用
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return { success: true };
  }

  getOfflineQueue(): OfflineOperation[] {
    return [...this.offlineQueue];
  }

  clearOfflineQueue(): void {
    this.offlineQueue = [];
    this.saveOfflineQueue();
  }

  // ========== 缓存管理 ==========

  async getCacheInfo(): Promise<any[]> {
    if (!('serviceWorker' in navigator)) {
      return [];
    }

    try {
      return new Promise((resolve, reject) => {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };

        navigator.serviceWorker.controller?.postMessage(
          { type: 'GET_CACHE_INFO' },
          [messageChannel.port2]
        );
      });
    } catch (error) {
      console.error('Error getting cache info:', error);
      return [];
    }
  }

  async clearCache(cacheName?: string): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    try {
      return new Promise((resolve, reject) => {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.success);
        };

        navigator.serviceWorker.controller?.postMessage(
          { type: 'CLEAR_CACHE', cacheName },
          [messageChannel.port2]
        );
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  // ========== 能力检测 ==========

  async getCapabilities(): Promise<PWACapabilities> {
    const capabilities: PWACapabilities = {
      installable: this.canShowInstallPrompt(),
      pushEnabled: 'PushManager' in window && 'serviceWorker' in navigator,
      backgroundSync: 'SyncManager' in window,
      periodicSync: 'PeriodicSyncManager' in window,
      storageQuota: 0,
      storageUsage: 0,
      offlineSupport: 'serviceWorker' in navigator
    };

    // 获取存储配额信息
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        capabilities.storageQuota = estimate.quota || 0;
        capabilities.storageUsage = estimate.usage || 0;
      } catch (error) {
        console.error('Error getting storage estimate:', error);
      }
    }

    return capabilities;
  }

  // ========== 指标管理 ==========

  private loadMetrics(): void {
    try {
      const metrics = localStorage.getItem('pwa_metrics');
      if (metrics) {
        this.metrics = JSON.parse(metrics);
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  }

  private saveMetrics(): void {
    try {
      localStorage.setItem('pwa_metrics', JSON.stringify(this.metrics));
    } catch (error) {
      console.error('Error saving metrics:', error);
    }
  }

  getMetrics(): PWAMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      installs: 0,
      notificationsSent: 0,
      notificationsClicked: 0,
      offlineOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      storageUsage: 0,
      lastUpdateCheck: Date.now()
    };
    this.saveMetrics();
  }

  // ========== 工具方法 ==========

  isOnline(): boolean {
    return navigator.onLine;
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-store'
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      return Promise.resolve(null);
    }

    return navigator.serviceWorker.ready;
  }
}

export default PWAService.getInstance();