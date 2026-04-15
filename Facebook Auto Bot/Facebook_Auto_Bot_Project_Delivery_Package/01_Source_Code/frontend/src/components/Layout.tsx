import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  UserOutlined,
  MessageOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { Layout, Menu, Button, theme, Avatar, Dropdown, Badge, Space } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

const { Header, Sider, Content } = Layout;

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // 导航菜单项
  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
      path: '/dashboard',
    },
    {
      key: 'accounts',
      icon: <UserOutlined />,
      label: '账号管理',
      path: '/accounts',
    },
    {
      key: 'tasks',
      icon: <ScheduleOutlined />,
      label: '任务管理',
      path: '/tasks',
    },
    {
      key: 'conversation',
      icon: <MessageOutlined />,
      label: '对话管理',
      path: '/conversation',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      path: '/settings',
    },
  ];

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'profile',
      label: '个人资料',
      icon: <UserOutlined />,
    },
    {
      key: 'notifications',
      label: (
        <Space>
          通知
          {unreadCount > 0 && (
            <Badge count={unreadCount} size="small" />
          )}
        </Space>
      ),
      icon: <BellOutlined />,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'help',
      label: '帮助中心',
      icon: <QuestionCircleOutlined />,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      danger: true,
    },
  ];

  // 处理用户菜单点击
  const handleUserMenuClick = async ({ key }: { key: string }) => {
    switch (key) {
      case 'logout':
        await logout();
        break;
      case 'profile':
        window.location.href = '/settings?tab=profile';
        break;
      case 'notifications':
        window.location.href = '/settings?tab=notifications';
        break;
      case 'help':
        window.open('https://docs.fbautobot.com', '_blank');
        break;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={250}
        style={{
          background: colorBgContainer,
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <h1 style={{
            margin: 0,
            fontSize: collapsed ? 16 : 20,
            fontWeight: 'bold',
            color: '#1890ff',
            transition: 'all 0.2s',
          }}>
            {collapsed ? 'FAB' : 'Facebook Auto Bot'}
          </h1>
        </div>

        <Menu
          mode="inline"
          defaultSelectedKeys={['dashboard']}
          style={{
            borderRight: 0,
            marginTop: 16,
          }}
          items={menuItems.map(item => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            onClick: () => {
              window.location.href = item.path;
            },
          }))}
        />

        <div style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          padding: '16px',
          borderTop: '1px solid #f0f0f0',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <Avatar
              size={collapsed ? 32 : 40}
              src={user?.avatarUrl}
              style={{
                backgroundColor: '#1890ff',
              }}
            >
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
            
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 'bold',
                  fontSize: 14,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {user?.fullName || user?.username}
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#999',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {user?.email}
                </div>
              </div>
            )}
          </div>
        </div>
      </Sider>

      <Layout>
        <Header style={{
          padding: '0 24px',
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />

          <Space size="large">
            <Badge count={unreadCount} size="small">
              <Button
                type="text"
                icon={<BellOutlined />}
                style={{ fontSize: '16px' }}
                onClick={() => window.location.href = '/settings?tab=notifications'}
              />
            </Badge>

            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: handleUserMenuClick,
              }}
              placement="bottomRight"
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 8,
                transition: 'background 0.3s',
                ':hover': {
                  background: '#f5f5f5',
                },
              }}>
                <Avatar
                  size="small"
                  src={user?.avatarUrl}
                  style={{ backgroundColor: '#1890ff' }}
                >
                  {user?.username?.charAt(0).toUpperCase()}
                </Avatar>
                <span style={{ fontWeight: 500 }}>
                  {user?.username}
                </span>
              </div>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;