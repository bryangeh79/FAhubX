/**
 * PWA 相关类型定义
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface ServiceWorkerMessage {
  type: string;
  payload?: any;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  renotify?: boolean;
  silent?: boolean;
  requireInteraction?: boolean;
  data?: any;
  actions?: NotificationAction[];
  timestamp?: number;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface CacheStorageInfo {
  name: string;
  size: number;
  entries: number;
}

export interface OfflineOperation {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ServiceWorkerRegistrationExtended extends ServiceWorkerRegistration {
  update?: () => Promise<void>;
  unregister?: () => Promise<boolean>;
}

export interface PWAInstallPromptOptions {
  title?: string;
  description?: string;
  installButtonText?: string;
  cancelButtonText?: string;
  showOnLoad?: boolean;
  rememberChoice?: boolean;
}

export interface PWACapabilities {
  installable: boolean;
  pushEnabled: boolean;
  backgroundSync: boolean;
  periodicSync: boolean;
  storageQuota: number;
  storageUsage: number;
  offlineSupport: boolean;
}

export interface ServiceWorkerUpdateInfo {
  waiting: boolean;
  updateAvailable: boolean;
  registration?: ServiceWorkerRegistration;
}

export interface OfflineQueueConfig {
  maxRetries: number;
  retryDelay: number;
  maxQueueSize: number;
  syncInterval: number;
}

export interface CacheConfig {
  name: string;
  maxAge: number;
  maxEntries: number;
  strategy: 'CacheFirst' | 'NetworkFirst' | 'StaleWhileRevalidate' | 'NetworkOnly' | 'CacheOnly';
}

export interface PWAMetrics {
  installs: number;
  notificationsSent: number;
  notificationsClicked: number;
  offlineOperations: number;
  cacheHits: number;
  cacheMisses: number;
  storageUsage: number;
  lastUpdateCheck: number;
}

declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent;
    workbox?: any;
  }

  interface Navigator {
    standalone?: boolean;
    getInstalledRelatedApps?: () => Promise<any[]>;
  }
}