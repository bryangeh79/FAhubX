import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import pwaService from '../services/pwaService';
import notificationService, { NotificationType } from '../services/notificationService';
import { PWACapabilities, ServiceWorkerUpdateInfo, OfflineOperation } from '../types/pwa';

interface PWAContextType {
  // 安装状态
  isPWAInstalled: boolean;
  canInstallPWA: boolean;
  installPWA: () => Promise<boolean>;
  
  // 网络状态
  isOnline: boolean;
  networkQuality: 'good' | 'poor' | 'offline';
  
  // 通知状态
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  sendNotification: (type: NotificationType, title: string, body: string, data?: any) => Promise<boolean>;
  
  // 离线功能
  offlineQueue: OfflineOperation[];
  addOfflineOperation: (type: string, data: any) => string;
  clearOfflineQueue: () => void;
  
  // Service Worker
  updateAvailable: boolean;
  updateWaiting: boolean;
  checkForUpdates: () => Promise<ServiceWorkerUpdateInfo>;
  updateServiceWorker: () => Promise<boolean>;
  
  // 能力检测
  capabilities: PWACapabilities | null;
  refreshCapabilities: () => Promise<void>;
  
  // 缓存管理
  cacheInfo: any[];
  clearCache: (cacheName?: string) => Promise<boolean>;
  refreshCacheInfo: () => Promise<void>;
  
  // 指标
  metrics: any;
  resetMetrics: () => void;
  
  // 工具方法
  checkConnectivity: () => Promise<boolean>;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

interface PWAProviderProps {
  children: ReactNode;
  autoCheckUpdates?: boolean;
  updateCheckInterval?: number;
}

export const PWAProvider: React.FC<PWAProviderProps> = ({
  children,
  autoCheckUpdates = true,
  updateCheckInterval = 300000 // 5分钟
}) => {
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [canInstallPWA, setCanInstallPWA] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [networkQuality, setNetworkQuality] = useState<'good' | 'poor' | 'offline'>('good');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [offlineQueue, setOfflineQueue] = useState<OfflineOperation[]>([]);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateWaiting, setUpdateWaiting] = useState(false);
  const [capabilities, setCapabilities] = useState<PWACapabilities | null>(null);
  const [cacheInfo, setCacheInfo] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({});

  useEffect(() => {
    initializePWA();
    
    if (autoCheckUpdates) {
      const interval = setInterval(checkForUpdates, updateCheckInterval);
      return () => clearInterval(interval);
    }
  }, []);

  const initializePWA = async () => {
    // 检查安装状态
    const installed = pwaService.isPWAInstalled();
    setIsPWAInstalled(installed);
    
    const canInstall = pwaService.canShowInstallPrompt();
    setCanInstallPWA(canInstall);
    
    // 检查网络状态
    checkNetworkStatus();
    
    // 检查通知权限
    const permission = notificationService.getNotificationPermission();
    setNotificationPermission(permission);
    
    // 加载离线队列
    loadOfflineQueue();
    
    // 检查更新
    await checkForUpdates();
    
    // 加载能力信息
    await refreshCapabilities();
    
    // 加载缓存信息
    await refreshCacheInfo();
    
    // 加载指标
    loadMetrics();
    
    // 设置事件监听器
    setupEventListeners();
  };

  const setupEventListeners = () => {
    // 网络状态监听
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Service Worker 更新监听
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }
    
    // 安装状态监听
    window.addEventListener('appinstalled', handleAppInstalled);
  };

  const checkNetworkStatus = () => {
    const online = pwaService.isOnline();
    setIsOnline(online);
    setNetworkQuality(online ? 'good' : 'offline');
    
    // 检查网络质量
    if (online) {
      checkNetworkQuality();
    }
  };

  const checkNetworkQuality = async () => {
    try {
      const startTime = Date.now();
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-store'
      });
      const endTime = Date.now();
      
      const latency = endTime - startTime;
      setNetworkQuality(latency < 500 ? 'good' : 'poor');
    } catch (error) {
      setNetworkQuality('poor');
    }
  };

  const handleOnline = () => {
    setIsOnline(true);
    setNetworkQuality('good');
    checkNetworkQuality();
  };

  const handleOffline = () => {
    setIsOnline(false);
    setNetworkQuality('offline');
  };

  const handleControllerChange = () => {
    window.location.reload();
  };

  const handleAppInstalled = () => {
    setIsPWAInstalled(true);
    setCanInstallPWA(false);
  };

  const loadOfflineQueue = () => {
    const queue = pwaService.getOfflineQueue();
    setOfflineQueue(queue);
  };

  const loadMetrics = () => {
    const metricsData = pwaService.getMetrics();
    setMetrics(metricsData);
  };

  const installPWA = async (): Promise<boolean> => {
    const installed = await pwaService.showInstallPrompt();
    if (installed) {
      setIsPWAInstalled(true);
      setCanInstallPWA(false);
    }
    return installed;
  };

  const requestNotificationPermission = async (): Promise<NotificationPermission> => {
    const permission = await notificationService.checkNotificationPermission();
    setNotificationPermission(permission);
    return permission;
  };

  const sendNotification = async (
    type: NotificationType,
    title: string,
    body: string,
    data?: any
  ): Promise<boolean> => {
    return notificationService.sendNotification(type, title, body, data);
  };

  const addOfflineOperation = (type: string, data: any): string => {
    const id = pwaService.addOfflineOperation(type, data);
    loadOfflineQueue();
    return id;
  };

  const clearOfflineQueue = () => {
    pwaService.clearOfflineQueue();
    loadOfflineQueue();
  };

  const checkForUpdates = async (): Promise<ServiceWorkerUpdateInfo> => {
    const updateInfo = await pwaService.checkForUpdates();
    setUpdateAvailable(updateInfo.updateAvailable);
    setUpdateWaiting(updateInfo.waiting);
    return updateInfo;
  };

  const updateServiceWorker = async (): Promise<boolean> => {
    const updated = await pwaService.updateServiceWorker();
    if (updated) {
      setUpdateAvailable(false);
      setUpdateWaiting(false);
    }
    return updated;
  };

  const refreshCapabilities = async (): Promise<void> => {
    const caps = await pwaService.getCapabilities();
    setCapabilities(caps);
  };

  const refreshCacheInfo = async (): Promise<void> => {
    const info = await pwaService.getCacheInfo();
    setCacheInfo(info);
  };

  const clearCache = async (cacheName?: string): Promise<boolean> => {
    const cleared = await pwaService.clearCache(cacheName);
    if (cleared) {
      await refreshCacheInfo();
    }
    return cleared;
  };

  const resetMetrics = () => {
    pwaService.resetMetrics();
    loadMetrics();
  };

  const checkConnectivity = async (): Promise<boolean> => {
    return pwaService.checkConnectivity();
  };

  const contextValue: PWAContextType = {
    isPWAInstalled,
    canInstallPWA,
    installPWA,
    isOnline,
    networkQuality,
    notificationPermission,
    requestNotificationPermission,
    sendNotification,
    offlineQueue,
    addOfflineOperation,
    clearOfflineQueue,
    updateAvailable,
    updateWaiting,
    checkForUpdates,
    updateServiceWorker,
    capabilities,
    refreshCapabilities,
    cacheInfo,
    clearCache,
    refreshCacheInfo,
    metrics,
    resetMetrics,
    checkConnectivity
  };

  return (
    <PWAContext.Provider value={contextValue}>
      {children}
    </PWAContext.Provider>
  );
};

export const usePWA = (): PWAContextType => {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
};

// 高阶组件
export const withPWA = <P extends object>(Component: React.ComponentType<P>) => {
  const WithPWA: React.FC<P> = (props) => (
    <PWAProvider>
      <Component {...props} />
    </PWAProvider>
  );
  
  WithPWA.displayName = `WithPWA(${Component.displayName || Component.name})`;
  return WithPWA;
};