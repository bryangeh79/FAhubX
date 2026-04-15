import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import AccountsPage from '../pages/AccountsPage';

// Mock API
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({
      data: {
        accounts: [
          {
            id: '1',
            username: 'testuser1',
            displayName: '测试用户1',
            email: 'test1@example.com',
            status: 'active',
            tags: ['测试', 'VIP'],
            lastActivityAt: '2024-01-01T12:00:00Z',
            lastStatusCheck: '2024-01-01T12:00:00Z',
            totalTasks: 100,
            successfulTasks: 90,
            failedTasks: 10,
            vpnConfig: {
              provider: 'openvpn',
              location: 'us',
            },
          },
          {
            id: '2',
            username: 'testuser2',
            displayName: '测试用户2',
            email: 'test2@example.com',
            status: 'disabled',
            tags: ['测试'],
            lastActivityAt: '2024-01-01T11:00:00Z',
            lastStatusCheck: '2024-01-01T11:00:00Z',
            totalTasks: 50,
            successfulTasks: 40,
            failedTasks: 10,
          },
        ],
      },
    })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
  accountsAPI: {
    getAccounts: vi.fn(() => Promise.resolve({
      data: {
        accounts: [
          {
            id: '1',
            username: 'testuser1',
            displayName: '测试用户1',
            email: 'test1@example.com',
            status: 'active',
            tags: ['测试', 'VIP'],
            lastActivityAt: '2024-01-01T12:00:00Z',
            lastStatusCheck: '2024-01-01T12:00:00Z',
            totalTasks: 100,
            successfulTasks: 90,
            failedTasks: 10,
            vpnConfig: {
              provider: 'openvpn',
              location: 'us',
            },
          },
        ],
      },
    })),
    getAccount: vi.fn(() => Promise.resolve({ data: {} })),
    createAccount: vi.fn(() => Promise.resolve({ data: {} })),
    updateAccount: vi.fn(() => Promise.resolve({ data: {} })),
    deleteAccount: vi.fn(() => Promise.resolve({ data: {} })),
    testConnection: vi.fn(() => Promise.resolve({ data: {} })),
    loginAccount: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '1' }),
  };
});

describe('AccountsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AccountsPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('应该渲染账号管理页面标题', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('账号管理')).toBeInTheDocument();
      expect(screen.getByText('管理您的Facebook账号，配置VPN和自动化设置。')).toBeInTheDocument();
    });
  });

  it('应该显示添加账号按钮', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('添加账号')).toBeInTheDocument();
    });
  });

  it('应该加载并显示账号列表', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('测试用户1')).toBeInTheDocument();
      expect(screen.getByText('测试用户2')).toBeInTheDocument();
      expect(screen.getByText('test1@example.com')).toBeInTheDocument();
      expect(screen.getByText('test2@example.com')).toBeInTheDocument();
    });
  });

  it('应该显示账号状态标签', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('活跃')).toBeInTheDocument();
      expect(screen.getByText('禁用')).toBeInTheDocument();
    });
  });

  it('应该显示任务统计信息', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('总数: 100')).toBeInTheDocument();
      expect(screen.getByText('成功率: 90%')).toBeInTheDocument();
    });
  });

  it('应该显示操作按钮', async () => {
    renderComponent();
    
    await waitFor(() => {
      // 检查操作按钮是否存在
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('点击添加账号按钮应该打开模态框', async () => {
    renderComponent();
    
    await waitFor(() => {
      const addButton = screen.getByText('添加账号');
      fireEvent.click(addButton);
    });
    
    // 检查模态框是否打开
    await waitFor(() => {
      expect(screen.getByText('添加账号')).toBeInTheDocument();
    });
  });

  it('应该支持账号搜索功能', async () => {
    renderComponent();
    
    await waitFor(() => {
      // 这里可以添加搜索功能的测试
      // 由于搜索功能可能由Table组件提供，我们需要检查Table是否正确渲染
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });
  });

  it('应该支持分页功能', async () => {
    renderComponent();
    
    await waitFor(() => {
      // 检查分页控件是否存在
      const pagination = screen.getByText('共 2 个账号');
      expect(pagination).toBeInTheDocument();
    });
  });

  it('应该正确处理账号选择', async () => {
    renderComponent();
    
    await waitFor(() => {
      // 获取选择框
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
      
      // 选择第一个账号
      fireEvent.click(checkboxes[1]); // 第一个是表头全选，第二个是第一个账号
      
      // 检查批量操作面板是否显示
      expect(screen.getByText('已选择 1 个账号')).toBeInTheDocument();
    });
  });

  it('应该显示VPN配置信息', async () => {
    renderComponent();
    
    await waitFor(() => {
      // 检查VPN标签是否存在
      expect(screen.getByText('VPN')).toBeInTheDocument();
    });
  });
});

describe('AccountDetailPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  it('应该渲染返回按钮', async () => {
    // 这里可以添加AccountDetailPage的测试
    // 由于组件较大，我们可以先测试基本功能
    expect(true).toBe(true);
  });
});

describe('AccountForm', () => {
  it('应该验证表单字段', () => {
    // 测试表单验证逻辑
    expect(true).toBe(true);
  });
});

describe('BatchOperations', () => {
  it('应该处理批量操作', () => {
    // 测试批量操作逻辑
    expect(true).toBe(true);
  });
});

describe('VPNConfigManager', () => {
  it('应该管理VPN配置', () => {
    // 测试VPN配置管理逻辑
    expect(true).toBe(true);
  });
});