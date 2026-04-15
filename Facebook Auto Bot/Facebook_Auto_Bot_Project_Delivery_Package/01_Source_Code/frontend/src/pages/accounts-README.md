# 账号管理页面 - 使用说明

## 概述

账号管理页面是 Facebook Auto Bot SaaS 平台的核心功能模块，提供了完整的 Facebook 账号管理功能，包括账号的增删改查、批量操作、VPN 配置管理等。

## 组件结构

### 1. AccountsPage (主页面)
- **位置**: `src/pages/AccountsPage.tsx`
- **功能**: 显示所有 Facebook 账号列表，支持搜索、筛选、分页
- **特性**:
  - 账号状态显示（活跃、禁用、封禁、暂停）
  - 任务统计信息
  - 批量操作支持
  - 添加/编辑账号模态框
  - 响应式设计

### 2. AccountDetailPage (详情页面)
- **位置**: `src/pages/AccountDetailPage.tsx`
- **功能**: 显示单个账号的详细信息
- **特性**:
  - 账号基本信息
  - 任务性能统计
  - VPN 配置详情
  - 活动日志
  - 性能趋势图表

### 3. AccountForm (表单组件)
- **位置**: `src/components/AccountForm.tsx`
- **功能**: 添加/编辑账号的表单
- **特性**:
  - 表单验证（使用 Zod）
  - Facebook 登录方式选择
  - VPN 配置
  - 2FA 支持
  - 批量导入功能

### 4. BatchOperations (批量操作组件)
- **位置**: `src/components/BatchOperations.tsx`
- **功能**: 处理账号的批量操作
- **特性**:
  - 批量启动/暂停/删除
  - 批量测试连接
  - 批量导出账号信息
  - 操作进度跟踪
  - 操作历史记录

### 5. VPNConfigManager (VPN 配置管理组件)
- **位置**: `src/components/VPNConfigManager.tsx`
- **功能**: 管理 VPN 配置
- **特性**:
  - VPN 配置的增删改查
  - 连接测试
  - IP 轮换策略配置
  - 性能监控
  - 批量测试

## API 集成

### 账号相关 API
```typescript
// 获取账号列表
GET /facebook-accounts

// 获取单个账号
GET /facebook-accounts/:id

// 创建账号
POST /facebook-accounts

// 更新账号
PATCH /facebook-accounts/:id

// 删除账号
DELETE /facebook-accounts/:id

// 测试连接
POST /facebook-accounts/:id/test-connection

// 手动登录
POST /facebook-accounts/:id/login

// 批量操作
POST /facebook-accounts/batch/:action
```

### VPN 相关 API
```typescript
// 获取 VPN 配置列表
GET /vpn-configs

// 创建 VPN 配置
POST /vpn-configs

// 更新 VPN 配置
PUT /vpn-configs/:id

// 删除 VPN 配置
DELETE /vpn-configs/:id

// 测试 VPN 连接
POST /vpn-configs/:id/test

// 批量测试
POST /vpn-configs/batch-test
```

## 使用示例

### 1. 添加新账号
```jsx
import AccountForm from '../components/AccountForm';

const AddAccountModal = () => {
  const handleSubmit = (data) => {
    // 调用 API 创建账号
    api.post('/facebook-accounts', data);
  };

  return (
    <AccountForm
      onSubmit={handleSubmit}
      onCancel={() => setModalVisible(false)}
      mode="create"
    />
  );
};
```

### 2. 批量操作
```jsx
import BatchOperations from '../components/BatchOperations';

const AccountList = () => {
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  
  return (
    <BatchOperations
      selectedAccounts={selectedAccounts}
      accounts={accounts}
      onSelectionChange={setSelectedAccounts}
    />
  );
};
```

### 3. 查看账号详情
```jsx
import { useNavigate } from 'react-router-dom';

const ViewAccountButton = ({ accountId }) => {
  const navigate = useNavigate();
  
  return (
    <Button onClick={() => navigate(`/accounts/${accountId}`)}>
      查看详情
    </Button>
  );
};
```

## 样式定制

### 自定义样式
样式文件位于 `src/styles/accounts.css`，包含以下样式类：

1. **状态标签**
   - `.account-status-active` - 活跃状态
   - `.account-status-disabled` - 禁用状态
   - `.account-status-banned` - 封禁状态
   - `.account-status-suspended` - 暂停状态

2. **VPN 状态指示器**
   - `.vpn-status-connected` - 已连接
   - `.vpn-status-disconnected` - 未连接

3. **响应式类**
   - `.responsive-table-cell` - 响应式表格单元格
   - `.account-modal` - 响应式模态框

### 主题定制
可以通过 Ant Design 的 ConfigProvider 定制主题：
```jsx
<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#1890ff',
      borderRadius: 6,
    },
  }}
>
  {/* 组件 */}
</ConfigProvider>
```

## 测试

### 运行测试
```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- AccountsPage.test.tsx

# 运行测试并显示 UI
npm run test:ui
```

### 测试覆盖
- 组件渲染测试
- 用户交互测试
- API 集成测试
- 表单验证测试
- 错误处理测试

## 最佳实践

### 1. 性能优化
- 使用 React Query 进行数据缓存
- 实现虚拟滚动处理大量数据
- 使用 React.memo 避免不必要的重渲染
- 按需加载组件

### 2. 错误处理
- 统一的错误处理中间件
- 用户友好的错误提示
- 网络错误重试机制
- 表单验证错误显示

### 3. 安全性
- 密码字段加密显示
- API 请求认证
- XSS 防护
- CSRF 防护

### 4. 可访问性
- 语义化 HTML
- ARIA 标签
- 键盘导航支持
- 屏幕阅读器兼容

## 故障排除

### 常见问题

1. **账号列表不显示**
   - 检查 API 连接
   - 验证认证令牌
   - 检查网络连接

2. **表单提交失败**
   - 检查表单验证规则
   - 查看控制台错误信息
   - 验证 API 端点

3. **批量操作无响应**
   - 检查选中状态
   - 查看网络请求
   - 检查服务器响应

4. **样式问题**
   - 检查 CSS 加载
   - 验证类名拼写
   - 检查样式优先级

### 调试技巧
1. 使用 React DevTools 检查组件状态
2. 使用 Network 面板查看 API 请求
3. 使用 Console 查看错误信息
4. 使用 React Query DevTools 查看缓存状态

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 基础账号管理功能
- VPN 配置管理
- 批量操作支持
- 响应式设计

### v1.1.0 (计划中)
- 实时状态更新
- 高级搜索筛选
- 数据导出增强
- 性能优化

## 贡献指南

1. Fork 仓库
2. 创建功能分支
3. 提交更改
4. 推送分支
5. 创建 Pull Request

## 许可证

MIT License