# Facebook Auto Bot 前端项目指南

## 项目概述

这是一个 Facebook Auto Bot SaaS 平台的前端项目，使用现代 Web 技术栈构建。

## 技术栈

### 核心框架
- **React 18** - 用户界面库
- **TypeScript** - 类型安全的 JavaScript
- **Vite 4.4** - 构建工具和开发服务器

### UI 组件库
- **Ant Design 5** - 企业级 UI 组件库
- **@ant-design/icons** - 图标库
- **@ant-design/pro-components** - 高级业务组件

### 状态管理
- **Zustand 4.4** - 轻量级状态管理
- **React Query 3.39** - 服务器状态管理
- **React Hook Form 7.45** - 表单处理
- **Zod 3.21** - 表单验证

### 数据可视化
- **Recharts 2.7** - 图表库
- **Day.js 1.11** - 日期处理

### PWA 支持
- **vite-plugin-pwa 0.16** - PWA 插件
- **Workbox 7.0** - Service Worker 工具库

### 开发工具
- **ESLint** - 代码检查
- **Prettier** - 代码格式化
- **Vitest** - 单元测试
- **TailwindCSS 3.3** - 实用 CSS 框架

## 项目结构

```
frontend/
├── src/
│   ├── components/     # 可复用组件
│   ├── pages/         # 页面组件
│   ├── contexts/      # React Context
│   ├── hooks/         # 自定义 Hooks
│   ├── services/      # API 服务
│   ├── store/         # Zustand 状态存储
│   ├── types/         # TypeScript 类型定义
│   ├── utils/         # 工具函数
│   └── App.tsx        # 应用入口
├── public/            # 静态资源
├── index.html         # HTML 模板
└── vite.config.ts     # Vite 配置
```

## 代码规范

### 命名约定
- **组件**: PascalCase (如 `DashboardPage.tsx`)
- **函数/变量**: camelCase (如 `getUserData`)
- **常量**: UPPER_SNAKE_CASE (如 `API_TIMEOUT`)
- **类型/接口**: PascalCase (如 `UserProfile`)
- **文件**: kebab-case (如 `user-profile.ts`)

### 组件规范
1. **函数组件**: 使用 React.FC 类型
   ```typescript
   const MyComponent: React.FC<MyProps> = ({ prop1, prop2 }) => {
     // 组件逻辑
     return <div>内容</div>;
   };
   ```

2. **Props 类型**: 使用 TypeScript 接口
   ```typescript
   interface MyProps {
     title: string;
     count?: number;
     onAction: () => void;
   }
   ```

3. **状态管理**: 优先使用 Zustand，复杂表单使用 React Hook Form

### API 调用规范
1. **使用 React Query** 进行数据获取和缓存
   ```typescript
   const { data, isLoading, error } = useQuery({
     queryKey: ['users'],
     queryFn: () => api.get('/users'),
   });
   ```

2. **错误处理**: 使用 API 拦截器统一处理
3. **加载状态**: 显示加载指示器
4. **数据更新**: 使用乐观更新或手动刷新

### 样式规范
1. **Ant Design 组件**: 使用内置样式和主题
2. **自定义样式**: 使用 CSS Modules 或 styled-components
3. **响应式设计**: 使用 Ant Design 的 Grid 系统
4. **主题**: 支持亮色/暗色主题切换

## 开发流程

### 1. 环境设置
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 代码检查
npm run lint

# 代码格式化
npm run format

# 类型检查
npm run type-check
```

### 2. 创建新页面
1. 在 `src/pages/` 创建页面组件
2. 在 `App.tsx` 中添加路由
3. 在 `src/types/` 中添加类型定义
4. 在 `src/services/` 中添加 API 调用

### 3. 创建可复用组件
1. 在 `src/components/` 创建组件
2. 添加 PropTypes 或 TypeScript 类型
3. 添加必要的样式
4. 编写单元测试

### 4. 状态管理
1. 简单状态使用 React useState
2. 复杂状态使用 Zustand
3. 服务器状态使用 React Query
4. 表单状态使用 React Hook Form

### 5. 测试
```bash
# 运行测试
npm run test

# 测试覆盖率
npm run test:coverage

# UI 测试模式
npm run test:ui
```

## API 集成

### API 服务
所有 API 调用通过 `src/services/api.ts` 进行，已包含：
- 请求/响应拦截器
- Token 自动刷新
- 错误统一处理
- 超时设置

### 可用 API 模块
```typescript
import { authAPI, accountsAPI, tasksAPI, conversationAPI, dashboardAPI } from './services/api';

// 示例：获取账号列表
const { data: accounts } = useQuery({
  queryKey: ['accounts'],
  queryFn: () => accountsAPI.getAccounts(),
});
```

### WebSocket 实时数据
使用 `src/hooks/useWebSocket.ts` 进行实时数据订阅：
```typescript
const { messages, sendMessage, isConnected } = useWebSocket({
  onMessage: (data) => {
    // 处理实时消息
  },
});
```

## PWA 配置

### 已配置功能
1. **Service Worker**: 自动注册和更新
2. **Manifest**: 应用元数据
3. **离线支持**: 核心资源缓存
4. **安装提示**: 符合 PWA 标准

### 开发注意事项
1. **缓存策略**: 注意资源更新问题
2. **推送通知**: 需要用户授权
3. **离线功能**: 考虑数据同步
4. **移动端**: 优化触摸交互

## 性能优化

### 构建优化
1. **代码分割**: 路由级懒加载
2. **Tree Shaking**: 移除未使用代码
3. **压缩**: 资源压缩和优化

### 运行时优化
1. **虚拟列表**: 大数据列表使用虚拟滚动
2. **图片懒加载**: 延迟加载非关键图片
3. **代码分割**: 动态导入大型组件
4. **缓存策略**: 合理使用浏览器缓存

### 监控和调试
1. **React DevTools**: 组件性能分析
2. **React Query DevTools**: 数据缓存调试
3. **Lighthouse**: 性能审计
4. **Web Vitals**: 核心 Web 指标

## 部署

### 构建生产版本
```bash
npm run build
```

### 部署选项
1. **静态托管**: Netlify, Vercel, GitHub Pages
2. **容器化**: Docker + Nginx
3. **传统服务器**: Nginx/Apache 托管

### 环境变量
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_ENV=development
```

## 故障排除

### 常见问题
1. **API 连接失败**: 检查 `VITE_API_URL` 环境变量
2. **类型错误**: 运行 `npm run type-check`
3. **构建失败**: 检查依赖版本兼容性
4. **PWA 不工作**: 检查 Service Worker 注册

### 调试工具
1. **浏览器 DevTools**: 网络、控制台、应用
2. **Vite Dev Server**: 热重载和错误覆盖
3. **TypeScript**: 类型检查和错误提示
4. **ESLint**: 代码规范检查

## 贡献指南

### 代码提交
1. **功能分支**: 从 `main` 分支创建功能分支
2. **提交信息**: 使用 Conventional Commits 格式
3. **代码审查**: 提交 Pull Request 进行审查
4. **测试**: 确保所有测试通过

### 质量保证
1. **代码规范**: 通过 ESLint 检查
2. **类型安全**: 通过 TypeScript 检查
3. **测试覆盖**: 关键功能有单元测试
4. **性能**: 通过 Lighthouse 审计

---

**最后更新**: 2026-04-13  
**版本**: 1.0.0  
**维护者**: Facebook Auto Bot 开发团队