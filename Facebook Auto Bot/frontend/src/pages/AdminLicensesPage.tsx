import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, DatePicker, Select, Tag, Space,
  Typography, message, Card, Row, Col, Statistic, Popconfirm, Tooltip,
} from 'antd';
import {
  ReloadOutlined, DisconnectOutlined, EditOutlined, DeleteOutlined,
  KeyOutlined, UserOutlined, DesktopOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../components/AppLayout';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;

interface License {
  id: string;
  license_key: string;
  tenant_name: string;
  tenant_email: string | null;
  tenant_username: string | null;
  plan: string;
  max_accounts: number;
  max_tasks: number;
  max_scripts: number;
  machine_id: string | null;
  expires_at: string | null;
  subscription_expiry: string | null;
  active: number;
  last_heartbeat: string | null;
  last_ip: string | null;
  current_accounts: number;
  current_tasks: number;
  created_at: string;
  notes: string | null;
}

interface Dashboard {
  totalLicenses: number;
  activeLicenses: number;
  expiredLicenses: number;
  onlineNow: number;
}

const AdminLicensesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [editing, setEditing] = useState<License | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [licRes, statRes] = await Promise.all([
        api.get('/admin/licenses'),
        api.get('/admin/licenses/dashboard'),
      ]);
      setLicenses(licRes.data?.data?.licenses || licRes.data?.licenses || []);
      setDashboard(statRes.data?.data || statRes.data || null);
    } catch (err: any) {
      message.error('加载失败: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleUnbind = async (id: string) => {
    try {
      await api.post(`/admin/licenses/${id}/unbind`);
      message.success('机器已解绑，租户可在新机器激活');
      loadData();
    } catch (err: any) {
      message.error('解绑失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/licenses/${id}`);
      message.success('License 已删除');
      loadData();
    } catch (err: any) {
      message.error('删除失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEdit = (license: License) => {
    setEditing(license);
    form.setFieldsValue({
      active: license.active === 1,
      plan: license.plan,
      notes: license.notes,
      subscriptionExpiry: license.subscription_expiry ? dayjs(license.subscription_expiry) : null,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const values = await form.validateFields();
      const payload: any = {
        active: values.active,
        plan: values.plan,
        notes: values.notes,
        subscriptionExpiry: values.subscriptionExpiry
          ? values.subscriptionExpiry.toISOString() : null,
        expiresAt: values.subscriptionExpiry
          ? values.subscriptionExpiry.toISOString() : null,
      };
      await api.patch(`/admin/licenses/${editing.id}`, payload);
      message.success('更新成功');
      setEditing(null);
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('更新失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const columns = [
    {
      title: 'License Key',
      dataIndex: 'license_key',
      key: 'license_key',
      width: 220,
      render: (key: string) => (
        <Text code copyable style={{ fontSize: 12 }}>{key}</Text>
      ),
    },
    {
      title: '租户',
      key: 'tenant',
      width: 200,
      render: (_: any, r: License) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.tenant_email || r.tenant_name}</div>
          {r.tenant_username && <Text type="secondary" style={{ fontSize: 11 }}>@{r.tenant_username}</Text>}
        </div>
      ),
    },
    {
      title: '套餐',
      dataIndex: 'plan',
      key: 'plan',
      width: 100,
      render: (plan: string, r: License) => {
        const color = plan === 'pro' ? 'purple' : plan === 'admin' ? 'red' : 'blue';
        return <div>
          <Tag color={color}>{plan.toUpperCase()}</Tag>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            {r.max_accounts}/{r.max_tasks}/{r.max_scripts}
          </div>
        </div>;
      },
    },
    {
      title: '机器绑定',
      key: 'machine',
      width: 150,
      render: (_: any, r: License) =>
        r.machine_id
          ? <Tooltip title={r.machine_id}><Tag color="green" icon={<DesktopOutlined />}>已绑定</Tag></Tooltip>
          : <Tag>未绑定</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_: any, r: License) => {
        if (!r.active) return <Tag color="red">已停用</Tag>;
        if (r.subscription_expiry && new Date(r.subscription_expiry) < new Date()) {
          return <Tag color="orange">已到期</Tag>;
        }
        return <Tag color="green">有效</Tag>;
      },
    },
    {
      title: '到期日',
      dataIndex: 'subscription_expiry',
      key: 'subscription_expiry',
      width: 110,
      render: (d: string | null) => d ? dayjs(d).format('YYYY-MM-DD') : <Text type="secondary">—</Text>,
    },
    {
      title: '最后心跳',
      dataIndex: 'last_heartbeat',
      key: 'last_heartbeat',
      width: 140,
      render: (d: string | null) => {
        if (!d) return <Text type="secondary">—</Text>;
        const hours = (Date.now() - new Date(d).getTime()) / 3600000;
        const color = hours < 1 ? '#52c41a' : hours < 24 ? '#faad14' : '#ff4d4f';
        return <Text style={{ fontSize: 11, color }}>{dayjs(d).fromNow ? dayjs(d).format('MM-DD HH:mm') : d}</Text>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, r: License) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Popconfirm title="确定要解绑当前机器？租户可在新机器上重新激活" onConfirm={() => handleUnbind(r.id)}>
            <Button size="small" icon={<DisconnectOutlined />} disabled={!r.machine_id}>解绑</Button>
          </Popconfirm>
          <Popconfirm title="确定要删除这个 License？不可恢复！" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>License 管理</Title>
            <Paragraph type="secondary">查看、管理所有 License Key · 解绑机器 · 延期/停用</Paragraph>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </div>

        {dashboard && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card><Statistic title="总 License 数" value={dashboard.totalLicenses} prefix={<KeyOutlined />} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="有效" value={dashboard.activeLicenses} valueStyle={{ color: '#3f8600' }} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="已到期" value={dashboard.expiredLicenses} valueStyle={{ color: '#cf1322' }} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="近 1 小时在线" value={dashboard.onlineNow} prefix={<DesktopOutlined />} valueStyle={{ color: '#1677ff' }} /></Card>
            </Col>
          </Row>
        )}

        <Card>
          <Table
            dataSource={licenses}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="middle"
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
          />
        </Card>

        <Modal
          title="编辑 License"
          open={!!editing}
          onOk={handleSave}
          onCancel={() => setEditing(null)}
          okText="保存"
          cancelText="取消"
        >
          <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item label="状态" name="active" valuePropName="checked">
              <Select>
                <Select.Option value={true}>有效</Select.Option>
                <Select.Option value={false}>停用</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="套餐" name="plan">
              <Select>
                <Select.Option value="basic">Basic（10 账号）</Select.Option>
                <Select.Option value="pro">Pro（30 账号）</Select.Option>
                <Select.Option value="admin">Admin（不限）</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="订阅到期日（留空表示永久有效）" name="subscriptionExpiry">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="备注" name="notes">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AppLayout>
  );
};

export default AdminLicensesPage;
