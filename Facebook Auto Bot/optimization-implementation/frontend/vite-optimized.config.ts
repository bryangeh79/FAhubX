import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import compression from 'vite-plugin-compression'
import { splitVendorChunkPlugin } from 'vite'

const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  includeAssets: [
    'favicon.ico',
    'apple-touch-icon.png',
    'masked-icon.svg',
    'robots.txt',
    'sitemap.xml'
  ],
  manifest: {
    name: 'Facebook Auto Bot',
    short_name: 'FABot',
    description: 'Facebook Automation Bot SaaS Platform - Manage your Facebook automation tasks efficiently',
    theme_color: '#1890ff',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    scope: '/',
    start_url: '/',
    id: '/',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/pwa-maskable-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any'
      }
    ],
    screenshots: [
      {
        src: '/screenshots/desktop.png',
        sizes: '1920x1080',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Facebook Auto Bot Desktop Dashboard'
      },
      {
        src: '/screenshots/mobile.png',
        sizes: '1080x1920',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Facebook Auto Bot Mobile Interface'
      }
    ],
    categories: ['business', 'productivity', 'utilities'],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'View your automation dashboard',
        url: '/dashboard',
        icons: [{ src: '/icons/dashboard-96x96.png', sizes: '96x96' }]
      },
      {
        name: 'New Task',
        short_name: 'New Task',
        description: 'Create a new automation task',
        url: '/tasks/new',
        icons: [{ src: '/icons/task-96x96.png', sizes: '96x96' }]
      },
      {
        name: 'Accounts',
        short_name: 'Accounts',
        description: 'Manage your Facebook accounts',
        url: '/accounts',
        icons: [{ src: '/icons/account-96x96.png', sizes: '96x96' }]
      }
    ],
    share_target: {
      action: '/share',
      method: 'GET',
      params: {
        title: 'title',
        text: 'text',
        url: 'url'
      }
    }
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/api\.facebook\.com\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'facebook-api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 // 24 hours
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      {
        urlPattern: /^https:\/\/graph\.facebook\.com\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'facebook-graph-api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 // 24 hours
          }
        }
      },
      {
        urlPattern: /\/api\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 // 24 hours
          },
          networkTimeoutSeconds: 10
        }
      },
      {
        urlPattern: /.*\.(?:png|jpg|jpeg|svg|gif|webp)/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
          }
        }
      },
      {
        urlPattern: /.*\.(?:js|css)/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-resources',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
          }
        }
      }
    ],
    navigateFallback: '/offline.html',
    navigateFallbackDenylist: [
      /^\/api\//,
      /^\/auth\//,
      /^\/socket\.io\//,
      /^\/ws\//
    ],
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true
  },
  devOptions: {
    enabled: process.env.NODE_ENV === 'development',
    type: 'module',
    navigateFallback: 'index.html'
  },
  injectRegister: 'auto',
  strategies: 'generateSW',
  srcDir: 'src',
  filename: 'service-worker.ts',
  includeManifestIcons: true,
  minify: true,
  mode: 'production'
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // 启用Fast Refresh
      fastRefresh: true,
      // 启用Babel优化
      babel: {
        plugins: [
          ['babel-plugin-import', {
            libraryName: 'antd',
            libraryDirectory: 'es',
            style: true
          }]
        ]
      }
    }),
    VitePWA(pwaOptions),
    // 代码分割插件
    splitVendorChunkPlugin(),
    // Gzip压缩
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // 10KB以上才压缩
      deleteOriginFile: false
    }),
    // Brotli压缩
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false
    }),
    // 打包分析
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true
    })
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    },
    // 启用HTTP/2
    https: false,
    // 启用热更新
    hmr: {
      overlay: true
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages',
      '@hooks': '/src/hooks',
      '@utils': '/src/utils',
      '@services': '/src/services',
      '@store': '/src/store',
      '@types': '/src/types'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // 启用最小化
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境移除console
        drop_debugger: true // 移除debugger
      }
    },
    // 优化构建输出
    rollupOptions: {
      output: {
        // 更细粒度的代码分割
        manualChunks: {
          // 核心框架
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI库
          'antd-vendor': ['antd', '@ant-design/icons', '@ant-design/pro-components'],
          // 状态管理
          'state-vendor': ['zustand', 'react-query'],
          // 工具库
          'utils-vendor': ['dayjs', 'lodash-es', 'axios', 'zod'],
          // 表单处理
          'form-vendor': ['react-hook-form', '@hookform/resolvers'],
          // 图表库
          'chart-vendor': ['recharts'],
          // 国际化
          'i18n-vendor': ['react-intl']
        },
        // 优化chunk命名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // 优化构建目标
    target: 'es2020',
    // 启用CSS代码分割
    cssCodeSplit: true,
    // 优化资源内联阈值
    assetsInlineLimit: 4096, // 4KB以下内联
    // 启用模块预构建
    commonjsOptions: {
      include: [/node_modules/]
    }
  },
  // 优化开发体验
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'antd',
      '@ant-design/icons',
      'dayjs',
      'axios',
      'lodash-es'
    ],
    exclude: []
  },
  // 环境变量配置
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  }
})