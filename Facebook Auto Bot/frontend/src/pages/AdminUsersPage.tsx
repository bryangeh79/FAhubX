import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Table, Button, Space, Typography, Tag, Modal, Form, Input,
  Select, message, Row, Col, Statistic, Popconfirm, Divider, Badge, Alert, DatePicker,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, UserOutlined,
  TeamOutlined, CheckCircleOutlined, StopOutlined, CrownOutlined,
  ReloadOutlined, LockOutlined, CalendarOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../components/AppLayout';
import api from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface TenantUser {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  role: 'admin' | 'tenant';
  plan: 'basic' | 'pro' | 'admin';
  maxAccounts: number;
  subscriptionExpiry?: string | null;
  status: 'active' | 'suspended';
  createdAt: string;
  emailVerified: boolean;
}

/** 计算距今天数（负数 = 已到期） */
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return dayjs(dateStr).startOf('day').diff(dayjs().startOf('day'), 'day');
}

/** 到期日标签 */
const ExpiryTag: React.FC<{ expiry?: string | null }> = ({ expiry }) => {
  const days = daysUntil(expiry);
  if (days === null) return <Text type="secondary">-</Text>;
  if (days < 0) return <Tag color="red">已到期</Tag>;
  if (days === 0) return <Tag color="red">今天到期</Tag>;
  if (days <= 7) return <Tag color="orange">{days} 天后到期</Tag>;
  return <Tag color="green" icon={<CalendarOutlined />}>{dayjs(expiry).format('YYYY-MM-DD')}</Tag>;
};

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, adminCount: 0, tenantCount: 0 });
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<TenantUser | null>(null);
  const [form] = Form.useForm();

  // 即将到期或已到期的租户数量
  const expiringCount = useMemo(() => {
    return users.filter(u => {
      if (u.role !== 'tenant') return false;
      const d = daysUntil(u.subscriptionExpiry);
      return d !== null && d <= 7;
    }).length;
  }, [users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get('/admin/users?limit=100'),
        api.get('/admin/users/stats/overview'),
      ]);
      const data = usersRes.data?.data || usersRes.data;
      setUsers(data?.users || []);
      const s = statsRes.data?.data || statsRes.data;
      setStats(s || {});
    } catch (e: any) {
      message.error(e?.response?.data?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setEditUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (user: TenantUser) => {
    setEditUser(user);
    form.setFieldsValue({
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      subscriptionExpiry: user.subscriptionExpiry ? dayjs(user.subscriptionExpiry) : null,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    // 将 dayjs 对象转换为 ISO 字符串
    if (values.subscriptionExpiry) {
      values.subscriptionExpiry = (values.subscriptionExpiry as any).toISOString();
    } else {
      values.subscriptionExpiry = null;
    }
    try {
      if (editUser) {
        await api.patch(`/admin/users/${editUser.id}`, values);
        message.success('用户已更新');
      } else {
        await api.post('/admin/users', values);
        message.success('租户账号已创建');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '操作失败');
    }
  };

  const toggleStatus = async (user: TenantUser) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/admin/users/${user.id}`, { status: newStatus });
      message.success(newStatus === 'active' ? '账号已启用' : '账号已禁用');
      fetchUsers();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/users/${id}`);
      message.success('用户已删除');
      fetchUsers();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '删除失败');
    }
  };

  const columns = [
    {
      title: '用户',
      key: 'user',
      render: (_: any, r: TenantUser) => (
        <Space>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: r.role === 'admin' ? '#722ed1' : '#1677ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15,
          }}>
            {r.role === 'admin' ? <CrownOutlined /> : <UserOutlined />}
          </div>
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 13 }}>{r.fullName || r.username}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{r.email}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'purple' : 'blue'} icon={role === 'admin' ? <CrownOutlined /> : <UserOutlined />}>
          {role === 'admin' ? '管理员' : '租户'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={status === 'active' ? 'success' : 'error'}
          text={status === 'active' ? '正常' : '已禁用'}
        />
      ),
    },
    {
      title: '套餐',
      key: 'plan',
      render: (_: any, r: TenantUser) => (
        r.role === 'admin' ? (
          <Tag color="purple">无限制</Tag>
        ) : (
          <Tag color={r.plan === 'pro' ? 'gold' : 'default'}>
            {r.plan === 'pro' ? 'Pro · 30账号' : 'Basic · 10账号'}
          </Tag>
        )
      ),
    },
    {
      title: '订阅到期日',
      key: 'subscriptionExpiry',
      render: (_: any, r: TenantUser) =>
        r.role === 'admin' ? <Text type="secondary">-</Text> : <ExpiryTag expiry={r.subscriptionExpiry} />,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(d).format('YYYY-MM-DD HH:mm')}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, r: TenantUser) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Button
            size="small"
            icon={r.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />}
            style={{ color: r.status === 'active' ? '#faad14' : '#52c41a' }}
            onClick={() => toggleStatus(r)}
          >
            {r.status === 'active' ? '禁用' : '启用'}
          </Button>
          <Popconfirm title="确定删除此用户？" onConfirm={() => handleDelete(r.id)} okText="确定" cancelText="取消">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ marginTop: 0, marginBottom: 4 }}>用户管理</Title>
            <Text type="secondary">创建和管理租户账号，控制用户访问权限。</Text>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchUsers}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="large">
                创建租户
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 到期预警横幅 */}
      {expiringCount > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={
            <span>
              有 <strong>{expiringCount}</strong> 位租户订阅<strong>即将到期或已到期</strong>，请及时跟进续费。
            </span>
          }
          style={{ marginBottom: 20, borderRadius: 8 }}
          closable
        />
      )}

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { title: '总用户数', value: stats.totalUsers, color: '#1890ff', icon: <TeamOutlined /> },
          { title: '正常账号', value: stats.activeUsers, color: '#52c41a', icon: <CheckCircleOutlined /> },
          { title: '管理员', value: stats.adminCount, color: '#722ed1', icon: <CrownOutlined /> },
          { title: '租户', value: stats.tenantCount, color: '#1677ff', icon: <UserOutlined /> },
        ].map(s => (
          <Col key={s.title} xs={24} sm={12} md={6}>
            <Card size="small">
              <Statistic title={s.title} value={s.value} valueStyle={{ color: s.color }} prefix={s.icon} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 个用户` }}
          rowClassName={(r: TenantUser) => {
            const d = daysUntil(r.subscriptionExpiry);
            if (d !== null && d < 0) return 'row-expired';
            if (d !== null && d <= 7) return 'row-expiring';
            return '';
          }}
        />
      </Card>

      <style>{`
        .row-expired td { background: #fff2f0 !important; }
        .row-expiring td { background: #fffbe6 !important; }
      `}</style>

      {/* Create / Edit Modal */}
      <Modal
        title={<Space>{editUser ? <EditOutlined /> : <PlusOutlined />} {editUser ? '编辑用户' : '创建新租户'}</Space>}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editUser ? '保存' : '创建'}
        cancelText="取消"
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {!editUser && (
            <>
              <Form.Item name="email" label="邮箱地址" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
                <Input prefix={<UserOutlined />} placeholder="tenant@example.com" />
              </Form.Item>
              <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input placeholder="username" />
              </Form.Item>
              <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="至少6位" />
              </Form.Item>
            </>
          )}
          <Form.Item name="fullName" label="显示名称">
            <Input placeholder="公司名称或真实姓名" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="tenant">
            <Select>
              <Option value="tenant"><UserOutlined /> 租户（普通用户）</Option>
              <Option value="admin"><CrownOutlined /> 管理员</Option>
            </Select>
          </Form.Item>
          {!editUser && (
            <Form.Item name="plan" label="套餐" initialValue="basic">
              <Select>
                <Option value="basic">Basic — 最多 10 个 Facebook 账号</Option>
                <Option value="pro">Pro — 最多 30 个 Facebook 账号</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="subscriptionExpiry"
            label="订阅到期日"
            extra="留空表示未设置到期日"
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="选择到期日期"
              format="YYYY-MM-DD"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>

          {editUser && (
            <>
              <Divider>修改密码（可选）</Divider>
              <Form.Item name="password" label="新密码（留空不修改）">
                <Input.Password prefix={<LockOutlined />} placeholder="留空则不修改密码" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </AppLayout>
  );
};

export default AdminUsersPage;
