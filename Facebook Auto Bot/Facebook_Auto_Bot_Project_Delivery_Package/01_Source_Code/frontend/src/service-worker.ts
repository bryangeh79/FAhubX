/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// 让 Service Worker 立即接管控制权
clientsClaim();

// 预缓存所有由 Vite 构建的资源
precacheAndRoute(self.__WB_MANIFEST);

// 设置 App Shell 回退路由
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  // 返回 false 以排除基于文件扩展名的导航请求
  ({ request, url }: { request: Request; url: URL }) => {
    // 如果是导航请求（HTML 页面）
    if (request.mode === 'navigate') {
      // 如果是 API 请求或特定路径，排除
      if (url.pathname.startsWith('/api/') || 
          url.pathname.startsWith('/auth/') ||
          url.pathname.startsWith('/socket.io/') ||
          url.pathname.startsWith('/ws/')) {
        return false;
      }
      
      // 如果是文件扩展名，排除
      if (fileExtensionRegexp.test(url.pathname)) {
        return false;
      }
      
      return true;
    }
    return false;
  },
  createHandlerBoundToURL('/index.html')
);

// 缓存策略：API 请求使用 NetworkFirst
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24, // 24小时
      }),
    ],
    networkTimeoutSeconds: 10,
  })
);

// 缓存策略：静态资源使用 StaleWhileRevalidate
registerRoute(
  ({ request }) => request.destination === 'style' || 
                  request.destination === 'script' ||
                  request.destination === 'worker',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7天
      }),
    ],
  })
);

// 缓存策略：图片使用 CacheFirst
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30天
      }),
    ],
  })
);

// 缓存策略：字体使用 CacheFirst
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1年
      }),
    ],
  })
);

// 处理推送通知
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options: NotificationOptions = {
    body: data.body || 'New notification from Facebook Auto Bot',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.tag || 'default',
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Facebook Auto Bot', options)
  );
});

// 处理通知点击
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || '/';

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      // 检查是否有打开的窗口
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // 如果没有打开的窗口，打开一个新窗口
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// 处理后台同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-operations') {
    event.waitUntil(syncOfflineOperations());
  }
});

// 处理定期同步
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

// 处理消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_INFO') {
    getCacheInfo().then(info => {
      event.ports[0].postMessage(info);
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    clearCache(event.data.cacheName).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

// 同步离线操作
async function syncOfflineOperations() {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('operations', 'readonly');
    const store = tx.objectStore('operations');
    const operations = await store.getAll();
    
    for (const operation of operations) {
      if (operation.status === 'pending') {
        await processOperation(operation);
      }
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('Failed to sync offline operations:', error);
    return Promise.reject(error);
  }
}

// 更新缓存
async function updateCache() {
  try {
    const cacheNames = await self.caches.keys();
    const updatePromises = cacheNames.map(async (cacheName) => {
      const cache = await self.caches.open(cacheName);
      const requests = await cache.keys();
      
      for (const request of requests) {
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(request, response);
          }
        } catch (error) {
          console.warn(`Failed to update cache for ${request.url}:`, error);
        }
      }
    });
    
    await Promise.all(updatePromises);
    return Promise.resolve();
  } catch (error) {
    console.error('Failed to update cache:', error);
    return Promise.reject(error);
  }
}

// 获取缓存信息
async function getCacheInfo() {
  const cacheNames = await self.caches.keys();
  const cacheInfo = [];
  
  for (const cacheName of cacheNames) {
    const cache = await self.caches.open(cacheName);
    const keys = await cache.keys();
    const size = await calculateCacheSize(cache, keys);
    
    cacheInfo.push({
      name: cacheName,
      entries: keys.length,
      size: size,
    });
  }
  
  return cacheInfo;
}

// 计算缓存大小
async function calculateCacheSize(cache: Cache, keys: Request[]) {
  let totalSize = 0;
  
  for (const key of keys) {
    const response = await cache.match(key);
    if (response) {
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        totalSize += parseInt(contentLength, 10);
      } else {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }
  
  return totalSize;
}

// 清理缓存
async function clearCache(cacheName?: string) {
  if (cacheName) {
    return self.caches.delete(cacheName);
  } else {
    const cacheNames = await self.caches.keys();
    return Promise.all(cacheNames.map(name => self.caches.delete(name)));
  }
}

// 打开离线数据库
async function openOfflineDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('offline-operations', 1);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('operations')) {
        const store = db.createObjectStore('operations', { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
    
    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// 处理操作
async function processOperation(operation: any) {
  // 这里实现具体的操作处理逻辑
  // 例如：发送 API 请求、更新数据等
  console.log('Processing operation:', operation);
  
  // 模拟处理
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return { success: true };
}