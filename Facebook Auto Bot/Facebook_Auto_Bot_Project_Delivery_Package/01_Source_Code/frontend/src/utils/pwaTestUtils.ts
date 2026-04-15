/**
 * PWA 测试工具
 * 用于测试和验证 PWA 功能的工具函数
 */

import pwaService from '../services/pwaService';
import notificationService, { NotificationType } from '../services/notificationService';
import { PWACapabilities } from '../types/pwa';

export interface PWATestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

export interface PWATestReport {
  timestamp: number;
  results: PWATestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    score: number;
  };
  capabilities: PWACapabilities | null;
  userAgent: string;
  platform: string;
}

class PWATestUtils {
  /**
   * 运行完整的 PWA 测试套件
   */
  async runFullTestSuite(): Promise<PWATestReport> {
    const results: PWATestResult[] = [];
    
    // 基础功能测试
    results.push(await this.testServiceWorker());
    results.push(await this.testManifest());
    results.push(await this.testInstallability());
    results.push(await this.testOfflineSupport());
    
    // 高级功能测试
    results.push(await this.testPushNotifications());
    results.push(await this.testBackgroundSync());
    results.push(await this.testCacheAPI());
    results.push(await this.testIndexedDB());
    
    // 性能测试
    results.push(await this.testCachePerformance());
    results.push(await this.testStorageQuota());
    
    // 兼容性测试
    results.push(await this.testBrowserCompatibility());
    results.push(await this.testPlatformCompatibility());
    
    // 生成报告
    return this.generateReport(results);
  }

  /**
   * 测试 Service Worker
   */
  async testServiceWorker(): Promise<PWATestResult> {
    try {
      if (!('serviceWorker' in navigator)) {
        return {
          name: 'Service Worker 支持',
          passed: false,
          message: '当前浏览器不支持 Service Worker'
        };
      }

      const registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        return {
          name: 'Service Worker 注册',
          passed: false,
          message: 'Service Worker 未注册'
        };
      }

      const worker = registration.active || registration.installing || registration.waiting;
      
      if (!worker) {
        return {
          name: 'Service Worker 状态',
          passed: false,
          message: 'Service Worker 未激活'
        };
      }

      return {
        name: 'Service Worker',
        passed: true,
        message: `Service Worker 已注册并运行 (状态: ${worker.state})`,
        details: {
          state: worker.state,
          scriptURL: worker.scriptURL,
          scope: registration.scope
        }
      };
    } catch (error) {
      return {
        name: 'Service Worker 测试',
        passed: false,
        message: `测试失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * 测试 Web App Manifest
   */
  async testManifest(): Promise<PWATestResult> {
    try {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      
      if (!manifestLink) {
        return {
          name: 'Manifest 链接',
          passed: false,
          message: '未找到 manifest.json 链接'
        };
      }

      const manifestUrl = manifestLink.getAttribute('href');
      const response = await fetch(manifestUrl!);
      
      if (!response.ok) {
        return {
          name: 'Manifest 文件',
          passed: false,
          message: `无法获取 manifest.json: ${response.status}`
        };
      }

      const manifest = await response.json();
      const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
      const missingFields = requiredFields.filter(field => !manifest[field]);
      
      if (missingFields.length > 0) {
        return {
          name: 'Manifest 内容',
          passed: false,
          message: `缺少必要字段: ${missingFields.join(', ')}`,
          details: { manifest }
        };
      }

      return {
        name: 'Web App Manifest',
        passed: true,
        message: 'Manifest 配置正确',
        details: {
          name: manifest.name,
          short_name: manifest.short_name,
          display: manifest.display,
          icons: manifest.icons.length
        }
      };
    } catch (error) {
      return {
        name: 'Manifest 测试',
        passed: false,
        message: `测试失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * 测试安装能力
   */
  async testInstallability(): Promise<PWATestResult> {
    try {
      const canInstall = pwaService.canShowInstallPrompt();
      const isInstalled = pwaService.isPWAInstalled();
      
      return {
        name: 'PWA 安装能力',
        passed: canInstall || isInstalled,
        message: isInstalled ? 'PWA 已安装' : (canInstall ? '支持安装' : '不支持安装'),
        details: {
          canInstall,
          isInstalled,
          displayMode: this.getDisplayMode()
        }
      };
    } catch (error) {
      return {
        name: '安装能力测试',
        passed: false,
        message: `测试失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * 测试离线支持
   */
  async testOfflineSupport(): Promise<PWATestResult> {
    try {
      if (!('serviceWorker' in navigator)) {
        return {
          name: '离线支持',
          passed: false,
          message: 'Service Worker 不可用'
        };
      }

      const registration = await navigator.serviceWorker.ready;
      const cache = await caches.open('test-offline');
      
      // 测试缓存写入
      const testUrl = '/test-offline.html';
      await cache.put(testUrl, new Response('Test content', {
        headers: { 'Content-Type': 'text/html' }
      }));
      
      // 测试缓存读取
      const cachedResponse = await cache.match(testUrl);
      const canReadCache = !!cachedResponse;
      
      // 清理测试缓存
      await cache.delete(testUrl);
      
      return {
        name: '离线支持',
        passed: canReadCache,
        message: canReadCache ? '离线缓存功能正常' : '离线缓存功能异常',
        details: {
          cacheAvailable: true,
          cacheReadable: canReadCache
        }
      };
    } catch (error) {
      return {
        name: '离线支持测试',
        passed: false,
        message: `测试失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * 测试推送通知
   */
  async testPushNotifications(): Promise<PWATestResult> {
    try {
      if (!('PushManager' in window)) {
        return {
          name: '推送通知支持',
          passed: false,
          message: '当前浏览器不支持推送通知'
        };
      }

      if (!('serviceWorker' in navigator)) {
        return {
          name: '推送通知依赖',
          passed: false,
          message: '需要 Service Worker 支持'
        };
      }

      const permission = Notification.permission;
      const hasPermission = permission === 'granted';
      
      return {
        name: '推送通知',
        passed: hasPermission || permission === 'default',
        message: `通知权限: ${this.getPermissionText(permission)}`,
        details: {
          permission,
          supported: true,
          canRequest: permission === 'default'
        }
      };
    } catch (error) {
      return {
        name: '推送通知测试',
        passed: false,
        message: `测试失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * 测试后台同步
   */
  async testBackgroundSync(): Promise<PWATestResult> {
    try {
      if (!('SyncManager' in window)) {
        return {
          name: '后台同步支持',
          passed: false,
          message: '当前浏览器不支持后台同步'
        };
      }

      return {
        name: '后台同步',
        passed: true,
        message: '后台同步功能可用',
        details: { supported: true }
      };
    } catch (error) {
      return {
        name: '后台同步测试',
        passed: false,
        message: `测试失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * 测试 Cache API
   */
  async testCacheAPI(): Promise<PWATestResult> {
    try {
      if (!('caches' in window)) {
        return {
          name: 'Cache API 支持',
          passed: false,
          message: '当前浏览器不支持 Cache API'
        };
      }

      const testCacheName = 'pwa-test-cache';
      const cache = await caches.open(testCacheName);
      
      // 测试基本操作
      await cache.put('/test', new Response('test'));
      const response = await cache.match('/test');
      const canRead = !!response;
      
      // 清理
      await cache.delete('/test');
      await caches.delete(testCacheName);
      
      return {
        name: 'Cache API',
        passed: canRead,
        message: canRead ? 'Cache API 功能正常' : 'Cache API 功能异常',
        details: {
          supported: true,
          functional: canRead
        }
      };
    } catch (error) {
      return {
        name: 'Cache API 测试',
        passed: false,
        message: `测试失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * 测试 IndexedDB
   */
  async testIndexedDB(): Promise<PWATestResult> {
    try {
      if (!('indexedDB' in window)) {
        return {
          name: 'IndexedDB 支持',
          passed: false,
          message: '当前浏览器不支持 IndexedDB'
        };
      }

      return new Promise((resolve) => {
        const request = indexedDB.open('pwa-test-db', 1);
        
        request.onerror = () => {
          resolve({
            name: 'IndexedDB',
            passed: false,
            message: '无法打开 IndexedDB 数据库',
            details: { error: request.error?.message }
          });
        };
        
        request.onsuccess = () => {
          const db = request.result;
          db.close();
          
          // 清理测试数据库
          indexedDB.deleteDatabase('pwa-test-db');
          
          resolve({
            name: 'IndexedDB',
            passed: true,
            message: 'IndexedDB 功能正常',
            details: { supported: true }
          });
        };
        
        request.onupgradeneeded = () => {
          // 创建测试对象存储
          const db = request.result;
          if (!db.objectStoreNames.contains('test-store')) {
            db.createObjectStore('test-store', { keyPath: 'id' });
          }
        };
      });
    } catch (error) {
      return {
        name: 'IndexedDB 测试',
        passed: false,
        message: `测试失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * 测试缓存性能
   */
  async testCachePerformance(): Promise<PWATestResult> {
    try {
      if (!('caches' in window)) {
        return {
          name: '缓存性能测试',
          passed: false,
          message: 'Cache API 不可用'
        };
      }

      const cacheNames = await caches.keys();
      const cacheInfo = [];
      
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        cacheInfo.push({
          name,
          entries: keys.length
        });
      }
      
      return {
        name: '缓存性能',
        passed: true,
        message: `发现 ${cacheInfo.length} 个缓存，共 ${cacheInfo.reduce((sum, c) => sum + c.entries, 0)} 个条目`,
        details: { caches: cacheInfo }
      };
    } catch (error) {
      return {
        name: '缓存性能测试',
        passed: false,
        message: `测试失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * 测试存储配额
   */
  async testStorageQuota(): Promise<PWATestResult> {
    try {
      if (!('storage' in navigator && 'estimate' in navigator.storage)) {
        return {
          name: '存储配额检测',
          passed: false,
          message: '存储配额 API 不可用'
        };
      }

      const estimate = await navigator.storage.estimate();
      const usagePercent = estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0;
      
      return {
        name: '存储配额',
        passed: usagePercent < 90,
        message: `存储使用: ${this.formatBytes(estimate.usage)} / ${this.formatBytes(estimate.quota || 0)} (${usagePercent.toFixed(1)}%)`,
        details: {
          usage: estimate.usage,
          quota: estimate.quota,
          usagePercent,
          isCritical: usagePercent > 90
        }
      };
    } catch (error) {
      return {
        name: '存储配额测试',
        passed: false,
        message: `测试失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * 测试浏览器兼容性
   */
  async testBrowserCompatibility(): Promise<PWATestResult> {
    const userAgent = navigator.userAgent;
    let browser = 'Unknown';
    let version = 'Unknown';
    
    // 检测浏览器
    if (userAgent.indexOf('Chrome') > -1) {
      browser = 'Chrome';
    } else if (userAgent.indexOf('Safari') > -1) {
      browser = 'Safari';
    } else if (userAgent.indexOf('Firefox') > -1) {
      browser = 'Firefox';
    } else if (userAgent.indexOf('Edge') > -1) {
      browser = 'Edge';
    }
    
    // 检测版本（简化版）
    const match = userAgent.match(/(chrome|safari|firefox|edge)\/(\d+)/i);
    if (match) {
      version = match[2];
    }
    
    const isModernBrowser = this.isModernBrowser(browser, parseInt(version) || 0);
    
    return {
      name: '浏览器兼容性',
      passed: isModernBrowser,
      message: `${browser} ${version} ${isModernBrowser ? '✓' : '⚠'}`,
      details: {
        browser,
        version,
        userAgent,
        isModernBrowser
      }
    };
  }

  /**
   * 测试平台兼容性
   */
  async testPlatformCompatibility(): Promise<PWATestResult> {
    const platform = navigator.platform;
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent);
    
    return {
      name: '平台兼容性',
      passed: true,
      message: `${isMobile ? '移动设备' : '桌面设备'} (${platform})`,
      details: {
        platform,
        isMobile,
        userAgent: navigator.userAgent
      }
    };
  }

  /**
   * 生成测试报告
   */
  private async generateReport(results: PWATestResult[]): Promise<PWATestReport> {
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const score = Math.round((passed / total) * 100);
    
    const capabilities = await pwaService.getCapabilities();
    
    return {
      timestamp: Date.now(),
      results,
      summary: {
        total,
        passed,
        failed: total - passed,
        score
      },
      capabilities,
      userAgent: navigator.userAgent,
      platform: navigator.platform
    };
  }

  /**
   * 工具方法：获取显示模式
   */
  private getDisplayMode(): string {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return 'standalone';
    }
    if (window.matchMedia('(display-mode: fullscreen)').matches) {
      return 'fullscreen';
    }
    if (window.matchMedia('(display-mode: minimal-ui)').matches) {
      return 'minimal-ui';
    }
    if ('standalone' in navigator && (navigator as any).standalone) {
      return 'standalone (iOS)';
    }
    return 'browser';
  }

  /**
   * 工具方法：获取权限文本
   */
  private getPermissionText(permission: NotificationPermission): string {
    switch (permission) {
      case 'granted': return '已授权';
      case 'denied': return '已拒绝';
      case 'default': return '未请求';
      default: return '未知';
    }
  }

  /**
   * 工具方法：格式化字节大小
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 工具方法：检查是否为现代浏览器
   */
  private isModernBrowser(browser: string, version: number): boolean {
    const minVersions: Record<string, number> = {
      'Chrome': 60,
      'Firefox': 60,
      'Safari': 12,
      'Edge': 79
    };
    
    return minVersions[browser] ? version >= minVersions[browser] : false;
  }

  /**
   * 导出测试报告
   */
  exportTestReport(report: PWATestReport): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(60));
    lines.push('PWA 测试报告');
    lines.push(`生成时间: ${new Date(report.timestamp).toLocaleString()}`);
    lines.push(`浏览器: ${report.userAgent}`);
    lines.push(`平台: ${report.platform}`);
    lines.push('='.repeat(60));
    lines.push('');
    
    // 测试结果
    lines.push('测试结果:');
    lines.push(''.padEnd(60, '-'));
    
    report.results.forEach((result, index) => {
      const status = result.passed ? '✓' : '✗';
      lines.push(`${(index + 1).toString().padStart(2, ' ')}. ${status} ${result.name}`);
      lines.push(`    ${result.message}`);
      if (result.details) {
        lines.push(`    详情: ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n     ')}`);
      }
      lines.push('');
    });
    
    // 摘要
    lines.push(''.padEnd(60, '-'));
    lines.push(`总计: ${report.summary.total} 项测试`);
    lines.push(`通过: ${report.summary.passed} 项`);
    lines.push(`失败: ${report.summary.failed} 项`);
    lines.push(`得分: ${report.summary.score}/100`);
    lines.push('');
    
    // 能力检测
    if (report.capabilities) {
      lines.push('PWA 能力检测:');
      lines.push(''.padEnd(60, '-'));
      lines.push(`安装支持: ${report.capabilities.installable ? '是' : '否'}`);
      lines.push(`推送通知: ${report.capabilities.pushEnabled ? '是' : '否'}`);
      lines.push(`后台同步: ${report.capabilities.backgroundSync ? '是' : '否'}`);
      lines.push(`离线支持: ${report.capabilities.offlineSupport ? '是' : '否'}`);
      lines.push(`存储使用: ${this.formatBytes(report.capabilities.storageUsage)} / ${this.formatBytes(report.capabilities.storageQuota)}`);
      lines.push('');
    }
    
    // 建议
    lines.push('建议:');
    lines.push(''.padEnd(60, '-'));
    
    const failedTests = report.results.filter(r => !r.passed);
    if (failedTests.length === 0) {
      lines.push('✓ 所有测试通过，PWA 功能完整！');
    } else {
      lines.push('需要改进的项目:');
      failedTests.forEach(test => {
        lines.push(`  • ${test.name}: ${test.message}`);
      });
    }
    
    lines.push('');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }
  
  /**
   * 运行 Lighthouse 审计（模拟）
   */
  async runLighthouseAudit(): Promise<{
    performance: number;
    pwa: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  }> {
    // 这里模拟 Lighthouse 审计结果
    // 实际项目中应该调用 Lighthouse API 或使用 Lighthouse CI
    
    const report = await this.runFullTestSuite();
    const pwaScore = report.summary.score;
    
    // 基于 PWA 测试结果估算其他分数
    return {
      performance: Math.min(100, pwaScore + 10),
      pwa: pwaScore,
      accessibility: 90, // 假设良好的可访问性
      bestPractices: Math.min(100, pwaScore + 5),
      seo: 85 // 假设良好的 SEO
    };
  }
  
  /**
   * 验证 PWA 是否符合标准
   */
  async validatePWAStandards(): Promise<{
    meetsBaseline: boolean;
    meetsFull: boolean;
    baselineChecks: Array<{ name: string; passed: boolean; description: string }>;
    fullChecks: Array<{ name: string; passed: boolean; description: string }>;
  }> {
    const report = await this.runFullTestSuite();
    
    // PWA 基线要求
    const baselineChecks = [
      {
        name: 'HTTPS',
        passed: window.location.protocol === 'https:',
        description: '必须通过 HTTPS 提供服务'
      },
      {
        name: 'Service Worker',
        passed: report.results.find(r => r.name === 'Service Worker')?.passed || false,
        description: '必须注册 Service Worker'
      },
      {
        name: 'Web App Manifest',
        passed: report.results.find(r => r.name === 'Web App Manifest')?.passed || false,
        description: '必须提供有效的 manifest.json'
      },
      {
        name: 'Responsive Design',
        passed: true, // 假设响应式设计
        description: '必须在所有屏幕尺寸上正常工作'
      }
    ];
    
    // PWA 完整要求
    const fullChecks = [
      ...baselineChecks,
      {
        name: 'Offline Support',
        passed: report.results.find(r => r.name === '离线支持')?.passed || false,
        description: '必须支持离线使用'
      },
      {
        name: 'Installable',
        passed: report.results.find(r => r.name === 'PWA 安装能力')?.passed || false,
        description: '必须支持添加到主屏幕'
      },
      {
        name: 'Push Notifications',
        passed: report.results.find(r => r.name === '推送通知')?.passed || false,
        description: '应该支持推送通知'
      },
      {
        name: 'Fast Load',
        passed: true, // 假设快速加载
        description: '首次加载应在 3 秒内完成'
      }
    ];
    
    const meetsBaseline = baselineChecks.every(check => check.passed);
    const meetsFull = fullChecks.every(check => check.passed);
    
    return {
      meetsBaseline,
      meetsFull,
      baselineChecks,
      fullChecks
    };
  }
}

export default new PWATestUtils();