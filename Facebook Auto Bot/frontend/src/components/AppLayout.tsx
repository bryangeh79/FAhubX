import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Button,
  Typography,
  message,
} from 'antd';
import {
  UserOutlined,
  GlobalOutlined,
  MessageOutlined,
  SafetyOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  MonitorOutlined,
  CrownOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAuth } from '../store/authStore';
import { authService } from '../services/auth';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    if (path === '/accounts') return 'accounts';
    if (path === '/tasks') return 'tasks';
    if (path === '/vpn') return 'vpn';
    if (path === '/anti-detection') return 'anti-detection';
    if (path === '/login-status') return 'login-status';
    if (path === '/admin/users') return 'admin-users';
    return 'dashboard';
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // ignore errors on logout
    } finally {
      logout();
      message.success('已退出登录');
      navigate('/login');
    }
  };

  const userMenuItems = [
    {
      key: 'settings',
      icon: React.createElement(SettingOutlined),
      label: '系统设置',
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: React.createElement(LogoutOutlined),
      label: '退出登录',
      onClick: handleLogout,
      danger: true,
    },
  ];

  const isAdmin = user?.role === 'admin';

  const commonNavItems = [
    {
      key: 'dashboard',
      icon: React.createElement(DashboardOutlined),
      label: '仪表板',
      onClick: () => navigate('/'),
    },
    {
      key: 'accounts',
      icon: React.createElement(UserOutlined),
      label: '账号管理',
      onClick: () => navigate('/accounts'),
    },
    {
      key: 'tasks',
      icon: React.createElement(MessageOutlined),
      label: '任务调度',
      onClick: () => navigate('/tasks'),
    },
    {
      key: 'vpn',
      icon: React.createElement(SafetyOutlined),
      label: 'VPN配置',
      onClick: () => navigate('/vpn'),
    },
    {
      key: 'anti-detection',
      icon: React.createElement(SafetyOutlined),
      label: '反检测配置',
      onClick: () => navigate('/anti-detection'),
    },
    {
      key: 'login-status',
      icon: React.createElement(MonitorOutlined),
      label: '登录状态监控',
      onClick: () => navigate('/login-status'),
    },
  ];

  const adminOnlyItems = [
    { type: 'divider' as const },
    {
      key: 'admin-users',
      icon: React.createElement(TeamOutlined),
      label: '用户管理',
      onClick: () => navigate('/admin/users'),
      style: { color: '#722ed1' },
    },
  ];

  const navItems = isAdmin ? [...commonNavItems, ...adminOnlyItems] : commonNavItems;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        style={{ background: '#001529' }}
      >
        <div
          style={{
            padding: collapsed ? '12px 0' : '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}
        >
          {collapsed ? (
            <img src="/logo.png" alt="FAhubX" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          ) : (
            <>
              <img src="/logo.png" alt="FAhubX" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 4 }} />
              <div style={{ color: 'white', fontSize: 14, fontWeight: 'bold', letterSpacing: 1, whiteSpace: 'nowrap' }}>
                FAhubX
              </div>
            </>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={navItems}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? React.createElement(MenuUnfoldOutlined) : React.createElement(MenuFoldOutlined)}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px', width: 64, height: 64 }}
          />

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
              <Avatar
                icon={isAdmin ? React.createElement(CrownOutlined) : React.createElement(UserOutlined)}
                style={{ background: isAdmin ? '#722ed1' : '#1890ff' }}
              />
              <div>
                <Text>{user?.email || user?.username || '管理员'}</Text>
                {isAdmin && (
                  <Text style={{ fontSize: 11, color: '#722ed1', marginLeft: 6 }}>管理员</Text>
                )}
              </div>
            </div>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: '#f0f2f5',
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
