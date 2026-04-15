import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Typography, Tag, Input, Row, Col,
  Statistic, Tooltip, Badge, Alert, message,
} from 'antd';
import {
  SyncOutlined, CheckCircleOutlined, CloseCircleOutlined,
  WarningOutlined, ReloadOutlined, SearchOutlined,
  LoginOutlined, LogoutOutlined, LoadingOutlined, GlobalOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import AppLayout from '../components/AppLayout';
import api from '../services/api';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const LoginStatusPage: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggingInId, setLoggingInId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/facebook-accounts?limit=100');
      const list = res.data?.data?.accounts || [];
      setAccounts(list);
    } catch {
      message.error('获取账号状态失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    // Auto-refresh every 30s
    const timer = setInterval(fetchAccounts, 30000);
    return () => clearInterval(timer);
  }, [fetchAccounts]);

  const handleLogin = async (record: any) => {
    setLoggingInId(record.id);
    message.loading({ content: `正在登录 ${record.name}，请稍候...`, key: 'login', duration: 60 });
    try {
      const res = await api.post(`/facebook-accounts/${record.id}/login`, {}, { timeout: 360000 });
      const result = res.data?.data || res.data;
      message.destroy('login');
      if (result?.success) {
        message.success(`${record.name} 登录成功！`);
        fetchAccounts();
      } else {
        message.error(result?.error || '登录失败');
        fetchAccounts();
      }
    } catch (err: any) {
      message.destroy('login');
      message.error(err?.response?.data?.message || '登录请求失败');
    } finally {
      setLoggingInId(null);
    }
  };

  const handleLogout = async (record: any) => {
    try {
      await api.post(`/facebook-accounts/${record.id}/logout`);
      message.success('已登出');
      fetchAccounts();
    } catch {
      message.error('登出失败');
    }
  };

  const filtered = accounts.filter(a =>
    !searchText || a.name?.includes(searchText) || a.email?.includes(searchText),
  );

  const onlineCount = accounts.filter(a => a.loginStatus === true || a.status === 'active').length;
  const errorCount = accounts.filter(a => a.status === 'error').length;
  const offlineCount = accounts.length - onlineCount - errorCount;

  const getStatusBadge = (record: any) => {
    if (record.loginStatus === true || record.status === 'active') {
      return <Badge status="success" text={<Tag color="green"><CheckCircleOutlined /> 已登录</Tag>} />;
    }
    if (record.status === 'error') {
      return (
        <Tooltip title={record.syncError || '登录失败'}>
          <Tag color="red"><CloseCircleOutlined /> 登录失败</Tag>
        </Tooltip>
      );
    }
    if (record.status === 'banned') return <Tag color="volcano"><WarningOutlined /> 已封禁</Tag>;
    return <Tag color="default">未登录</Tag>;
  };

  const columns = [
    {
      title: '账号',
      key: 'account',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
        </Space>
      ),
    },
    {
      title: '登录状态',
      key: 'loginStatus',
      render: (_: any, record: any) => getStatusBadge(record),
    },
    {
      title: '会话到期',
      key: 'sessionExpiresAt',
      render: (_: any, record: any) => {
        if (!record.sessionExpiresAt) return <Text type="secondary">-</Text>;
        const exp = dayjs(record.sessionExpiresAt);
        const expired = exp.isBefore(dayjs());
        return (
          <Tooltip title={exp.format('YYYY-MM-DD HH:mm')}>
            <Tag color={expired ? 'red' : 'green'}>
              {expired ? '已过期' : exp.fromNow()}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '上次登录',
      key: 'lastLoginAt',
      render: (_: any, record: any) =>
        record.lastLoginAt ? (
          <Tooltip title={dayjs(record.lastLoginAt).format('YYYY-MM-DD HH:mm:ss')}>
            <Text>{dayjs(record.lastLoginAt).fromNow()}</Text>
          </Tooltip>
        ) : (
          <Text type="secondary">从未登录</Text>
        ),
    },
    {
      title: 'VPN',
      key: 'vpn',
      render: (_: any, record: any) => (
        <Tag icon={<GlobalOutlined />} color={record.vpnConfigId ? 'purple' : 'cyan'}>
          {record.vpnConfigId ? '专属VPN' : '大环境IP'}
        </Tag>
      ),
    },
    {
      title: '错误信息',
      dataIndex: 'syncError',
      key: 'syncError',
      ellipsis: true,
      render: (err: string) => err ? <Text type="danger" style={{ fontSize: 12 }}>{err}</Text> : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: any, record: any) => (
        <Space size={4}>
          {record.loginStatus === true || record.status === 'active' ? (
            <Button size="small" danger icon={<LogoutOutlined />} onClick={() => handleLogout(record)}>
              登出
            </Button>
          ) : (
            <Button
              size="small"
              type="primary"
              icon={loggingInId === record.id ? <LoadingOutlined /> : <LoginOutlined />}
              loading={loggingInId === record.id}
              onClick={() => handleLogin(record)}
              disabled={loggingInId !== null && loggingInId !== record.id}
            >
              登录
            </Button>
          )}
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchAccounts}>
            刷新
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>登录状态监控</Title>
          <Text type="secondary">实时监控所有 Facebook 账号的登录状态，每 30 秒自动刷新</Text>
        </div>
        <Button icon={<SyncOutlined />} onClick={fetchAccounts} loading={loading}>
          立即刷新
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="总账号" value={accounts.length} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="已登录" value={onlineCount} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="未登录" value={offlineCount} valueStyle={{ color: '#999' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="登录错误" value={errorCount} valueStyle={{ color: '#ff4d4f' }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
      </Row>

      {errorCount > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`有 ${errorCount} 个账号登录失败，请检查账号密码或手动处理验证码。`}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索账号名称或邮箱"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
        </div>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
          rowClassName={(record: any) => {
            if (record.loginStatus === true || record.status === 'active') return 'row-online';
            if (record.status === 'error') return 'row-error';
            return '';
          }}
        />
      </Card>
    </AppLayout>
  );
};

export default LoginStatusPage;
