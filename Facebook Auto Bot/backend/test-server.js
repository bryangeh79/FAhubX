const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors({
  origin: 'http://localhost:5174',
  credentials: true
}));
app.use(bodyParser.json());

// 模拟数据
const mockAccounts = [
  {
    id: '1',
    username: 'john_doe',
    email: 'john@example.com',
    displayName: 'John Doe',
    status: 'active',
    healthScore: 95,
    lastLogin: '2026-04-13T10:30:00Z',
    createdAt: '2026-04-01T08:00:00Z',
  },
  {
    id: '2',
    username: 'jane_smith',
    email: 'jane@example.com',
    displayName: 'Jane Smith',
    status: 'active',
    healthScore: 88,
    lastLogin: '2026-04-13T09:15:00Z',
    createdAt: '2026-04-02T10:00:00Z',
  },
  {
    id: '3',
    username: 'bob_wilson',
    email: 'bob@example.com',
    displayName: 'Bob Wilson',
    status: 'warning',
    healthScore: 65,
    lastLogin: '2026-04-12T14:20:00Z',
    createdAt: '2026-04-03T12:00:00Z',
  },
];

// 认证中间件
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: '未授权' });
  }
  
  // 简单验证token
  if (token !== 'demo-token') {
    return res.status(401).json({ message: '无效token' });
  }
  
  req.user = { id: '1', username: 'admin', role: 'admin' };
  next();
};

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'admin123') {
    res.json({
      access_token: 'demo-token',
      user: {
        id: '1',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({ message: '用户名或密码错误' });
  }
});

// 获取账号列表
app.get('/api/accounts', authenticate, (req, res) => {
  res.json({
    data: mockAccounts,
    total: mockAccounts.length,
    page: 1,
    limit: 10
  });
});

// 获取单个账号
app.get('/api/accounts/:id', authenticate, (req, res) => {
  const account = mockAccounts.find(a => a.id === req.params.id);
  
  if (!account) {
    return res.status(404).json({ message: '账号不存在' });
  }
  
  res.json(account);
});

// 创建账号
app.post('/api/accounts', authenticate, (req, res) => {
  const newAccount = {
    id: Date.now().toString(),
    ...req.body,
    status: 'inactive',
    healthScore: 0,
    createdAt: new Date().toISOString(),
  };
  
  mockAccounts.push(newAccount);
  res.status(201).json(newAccount);
});

// 更新账号
app.put('/api/accounts/:id', authenticate, (req, res) => {
  const index = mockAccounts.findIndex(a => a.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ message: '账号不存在' });
  }
  
  mockAccounts[index] = {
    ...mockAccounts[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  
  res.json(mockAccounts[index]);
});

// 删除账号
app.delete('/api/accounts/:id', authenticate, (req, res) => {
  const index = mockAccounts.findIndex(a => a.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ message: '账号不存在' });
  }
  
  mockAccounts.splice(index, 1);
  res.status(204).send();
});

// 获取仪表板数据
app.get('/api/dashboard/stats', authenticate, (req, res) => {
  res.json({
    totalAccounts: mockAccounts.length,
    activeAccounts: mockAccounts.filter(a => a.status === 'active').length,
    totalTasks: 45,
    completedTasks: 32,
    conversationRate: 85,
    healthScore: 92,
    recentActivities: [
      { id: '1', type: 'account_login', accountId: '1', timestamp: '2026-04-13T10:30:00Z', details: '账号登录成功' },
      { id: '2', type: 'task_completed', accountId: '2', timestamp: '2026-04-13T09:45:00Z', details: '自动聊天任务完成' },
      { id: '3', type: 'account_warning', accountId: '3', timestamp: '2026-04-13T08:20:00Z', details: '账号健康度下降' },
    ]
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`测试服务器运行在 http://localhost:${PORT}`);
  console.log('API端点:');
  console.log('  GET  /api/health');
  console.log('  POST /api/auth/login');
  console.log('  GET  /api/dashboard/stats (需要认证)');
  console.log('  GET  /api/accounts (需要认证)');
  console.log('  POST /api/accounts (需要认证)');
  console.log('  PUT  /api/accounts/:id (需要认证)');
  console.log('  DELETE /api/accounts/:id (需要认证)');
});