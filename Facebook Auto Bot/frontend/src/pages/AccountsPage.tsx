import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Typography, Tag, Modal, Form,
  Input, Select, message, Popconfirm, Row, Col, Statistic, Tooltip, Alert, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined,
  UserOutlined, LockOutlined, MailOutlined, SafetyOutlined, GlobalOutlined,
  LoginOutlined, LogoutOutlined, CheckCircleOutlined, CloseCircleOutlined,
  LoadingOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../components/AppLayout';
import { accountsService, FacebookAccount, AccountStats, CreateAccountData } from '../services/accounts';
import api from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface VPNOption {
  id: string;
  name: string;
  country?: string;
  status: string;
  isDefault: boolean;
}

const AccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FacebookAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [loggingInId, setLoggingInId] = useState<string | null>(null);
  const [vpnOptions, setVpnOptions] = useState<VPNOption[]>([]);
  const [defaultVPN, setDefaultVPN] = useState<VPNOption | null>(null);
  const [loginResultModal, setLoginResultModal] = useState<{ visible: boolean; success: boolean; message: string; requiresManual?: boolean }>({ visible: false, success: false, message: '' });
  const [form] = Form.useForm();

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountsService.getAccounts({ page, limit: pageSize });
      setAccounts(res.data.accounts);
      setTotal(res.data.meta.total);
    } catch {
      message.error('获取账号列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await accountsService.getStats();
      setStats(res.data);
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchVPNOptions = useCallback(async () => {
    try {
      const res = await api.get('/vpn-configs?limit=100');
      const list: VPNOption[] = (res.data?.data?.configs || res.data?.data?.vpns || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        country: v.country || v.serverLocation,
        status: v.status,
        isDefault: v.isDefault,
      }));
      setVpnOptions(list);
      setDefaultVPN(list.find(v => v.isDefault) || null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchStats();
    fetchVPNOptions();
  }, [fetchAccounts, fetchStats, fetchVPNOptions]);

  const handleCreate = () => {
    setEditingAccount(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: FacebookAccount) => {
    setEditingAccount(record);
    form.setFieldsValue({
      name: record.name,
      email: record.email,
      accountType: record.accountType,
      remarks: record.remarks,
      vpnConfigId: (record as any).vpnConfigId || undefined,
      messengerPin: (record as any).messengerPin || undefined,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await accountsService.deleteAccount(id);
      message.success('删除成功');
      fetchAccounts();
      fetchStats();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await accountsService.syncAccount(id);
      message.success('同步成功');
      fetchAccounts();
    } catch {
      message.error('同步失败');
    } finally {
      setSyncingId(null);
    }
  };

  const handleLogin = async (record: FacebookAccount) => {
    setLoggingInId(record.id);
    message.loading({ content: `正在登录 ${record.name}，请稍候（约30秒）...`, key: 'login', duration: 60 });
    try {
      const res = await api.post(`/facebook-accounts/${record.id}/login`, {}, { timeout: 360000 });
      const result = res.data?.data || res.data;
      message.destroy('login');
      if (result?.success) {
        message.success({ content: `${record.name} 登录成功！`, duration: 4 });
        fetchAccounts();
        fetchStats();
      } else {
        setLoginResultModal({
          visible: true,
          success: false,
          message: result?.error || '登录失败',
          requiresManual: result?.requiresManual,
        });
        fetchAccounts();
      }
    } catch (err: any) {
      message.destroy('login');
      const errMsg = err?.response?.data?.message || err?.message || '登录请求失败';
      setLoginResultModal({ visible: false, success: false, message: errMsg });
      message.error(errMsg);
    } finally {
      setLoggingInId(null);
    }
  };

  const handleLogout = async (record: FacebookAccount) => {
    try {
      await api.post(`/facebook-accounts/${record.id}/logout`);
      message.success('已登出');
      fetchAccounts();
      fetchStats();
    } catch {
      message.error('登出失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingAccount) {
        await accountsService.updateAccount(editingAccount.id, values);
        message.success('更新成功');
      } else {
        await accountsService.createAccount(values as CreateAccountData);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      form.resetFields();
      fetchAccounts();
      fetchStats();
    } catch (err: any) {
      if (err?.response?.data?.message) {
        message.error(err.response.data.message);
      } else if (!err?.errorFields) {
        message.error('操作失败，请重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusTag = (record: any) => {
    const loginStatus = record.loginStatus;
    const status = record.status;
    if (loginStatus === true || status === 'active') {
      return <Badge status="success" text={<Tag color="green"><CheckCircleOutlined /> 已登录</Tag>} />;
    }
    if (status === 'error') {
      return <Tooltip title={record.syncError || '登录失败'}><Tag color="red"><CloseCircleOutlined /> 错误</Tag></Tooltip>;
    }
    if (status === 'banned') return <Tag color="volcano"><WarningOutlined /> 封禁</Tag>;
    return <Tag color="default">未登录</Tag>;
  };

  const columns = [
    {
      title: '账号名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: FacebookAccount) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          {(record as any).lastLoginAt && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              上次登录: {dayjs((record as any).lastLoginAt).format('MM-DD HH:mm')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '账号类型',
      dataIndex: 'accountType',
      key: 'accountType',
      render: (type: string) => {
        const map: Record<string, string> = { user: '个人', page: '主页', business: '商业' };
        return <Tag>{map[type] || type}</Tag>;
      },
    },
    {
      title: '登录状态',
      key: 'loginStatus',
      render: (_: any, record: any) => getStatusTag(record),
    },
    {
      title: 'VPN / IP',
      dataIndex: 'vpnConfigId',
      key: 'vpnConfigId',
      render: (vpnId: string) => {
        if (vpnId) {
          const vpn = vpnOptions.find(v => v.id === vpnId);
          return (
            <Tooltip title="使用指定 VPN">
              <Tag color="purple" icon={<GlobalOutlined />}>
                {vpn ? vpn.name : '专属VPN'}
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title={defaultVPN ? `默认VPN: ${defaultVPN.name}` : '未设置默认VPN'}>
            <Tag color={defaultVPN ? 'cyan' : 'default'} icon={<GlobalOutlined />}>
              {defaultVPN ? `默认: ${defaultVPN.name}` : '大环境IP'}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      render: (text: string) => text || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => (
        <Space size={4}>
          {/* Login / Logout button */}
          {record.loginStatus === true || record.status === 'active' ? (
            <Tooltip title="登出">
              <Button
                size="small"
                danger
                icon={<LogoutOutlined />}
                onClick={() => handleLogout(record)}
              >
                登出
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title="自动登录 Facebook">
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
            </Tooltip>
          )}
          <Tooltip title="编辑">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="同步">
            <Button
              size="small"
              type="text"
              icon={<SyncOutlined spin={syncingId === record.id} />}
              onClick={() => handleSync(record.id)}
              loading={syncingId === record.id}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除这个账号吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>账号管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          添加账号
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading}>
            <Statistic
              title={`配额（${((stats as any)?.plan || 'basic').toUpperCase()} 配套）`}
              value={stats?.totalAccounts ?? total}
              suffix={`/ ${(stats as any)?.maxAccounts ?? '?'}`}
              prefix={<UserOutlined />}
              valueStyle={{
                color: (stats?.totalAccounts ?? 0) >= ((stats as any)?.maxAccounts ?? 10)
                  ? '#f5222d'
                  : (stats?.totalAccounts ?? 0) >= ((stats as any)?.maxAccounts ?? 10) * 0.8
                    ? '#faad14'
                    : '#1890ff',
              }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading}>
            <Statistic title="已登录" value={accounts.filter(a => (a as any).loginStatus === true || a.status === 'active').length} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading}>
            <Statistic title="主页账号" value={stats?.pageAccounts ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading}>
            <Statistic title="商业账号" value={stats?.businessAccounts ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={accounts}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      {/* Login result modal */}
      <Modal
        title={<Space><CloseCircleOutlined style={{ color: 'red' }} /> 登录失败</Space>}
        open={loginResultModal.visible}
        onOk={() => setLoginResultModal(p => ({ ...p, visible: false }))}
        onCancel={() => setLoginResultModal(p => ({ ...p, visible: false }))}
        okText="知道了"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Alert
          type={loginResultModal.requiresManual ? 'warning' : 'error'}
          message={loginResultModal.message}
          description={
            loginResultModal.requiresManual
              ? '此账号需要手动完成验证（短信验证码 / 邮箱验证 / 二步验证）。请在浏览器中手动登录一次后再试，或导入已有的 Cookie。'
              : '请检查账号密码是否正确，或账号是否被封禁。'
          }
          showIcon
        />
      </Modal>

      {/* Add / Edit modal */}
      <Modal
        title={editingAccount ? '编辑账号' : '添加 Facebook 账号'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => { setIsModalVisible(false); form.resetFields(); }}
        confirmLoading={submitting}
        okText={editingAccount ? '保存' : '添加'}
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="账号显示名称" rules={[{ required: true, message: '请输入账号名称' }]}>
            <Input prefix={<UserOutlined />} placeholder="例如：主营销账号" />
          </Form.Item>
          <Form.Item name="email" label="Facebook 邮箱 / 手机号" rules={[{ required: true, message: '请输入邮箱或手机号' }]}>
            <Input prefix={<MailOutlined />} placeholder="登录 Facebook 使用的邮箱或手机号" />
          </Form.Item>
          {!editingAccount && (
            <Form.Item name="facebookPassword" label="Facebook 密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Facebook 登录密码" />
            </Form.Item>
          )}
          {editingAccount && (
            <Form.Item name="facebookPassword" label="新密码（留空则不更改）">
              <Input.Password prefix={<LockOutlined />} placeholder="如需更改密码请填写" />
            </Form.Item>
          )}
          <Form.Item name="accountType" label="账号类型" initialValue="user">
            <Select>
              <Option value="user">个人账号</Option>
              <Option value="page">主页账号</Option>
              <Option value="business">商业账号</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="vpnConfigId"
            label={<Space><GlobalOutlined /><span>VPN 配置</span></Space>}
            help={
              <span style={{ fontSize: 12, color: '#888' }}>
                不选择则使用 <strong>默认大环境VPN</strong>
                {defaultVPN ? <>（当前默认：<Tag color="cyan" style={{ marginLeft: 4 }}>{defaultVPN.name}</Tag>）</> : '（未设置默认VPN）'}
              </span>
            }
          >
            <Select
              allowClear
              placeholder={defaultVPN ? `默认: ${defaultVPN.name}（大环境IP）` : '使用大环境IP（无专属VPN）'}
            >
              {vpnOptions.map(vpn => (
                <Option key={vpn.id} value={vpn.id}>
                  <Space>
                    <GlobalOutlined style={{ color: vpn.status === 'active' ? '#52c41a' : '#aaa' }} />
                    {vpn.name}
                    {vpn.country && <Tag style={{ marginLeft: 4 }}>{vpn.country}</Tag>}
                    {vpn.isDefault && <Tag color="cyan">默认</Tag>}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="messengerPin"
            label="Messenger PIN"
            tooltip="如果 Messenger 设置了聊天室 PIN 锁，填在这里。系统执行聊天任务时会自动输入，避免任务中断。没有可留空。"
          >
            <Input.Password
              placeholder="4–6 位数字 PIN（没有可留空）"
              maxLength={6}
            />
          </Form.Item>

          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} placeholder="可选备注信息" />
          </Form.Item>

          <Alert
            style={{ marginBottom: 8 }}
            type="info"
            showIcon
            message={
              <span style={{ fontSize: 12 }}>
                <strong>不选VPN</strong> → 使用默认大环境IP（多账号共享）｜
                <strong>选专属VPN</strong> → 该账号独用一个IP，更安全
              </span>
            }
          />

          <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#389e0d' }}>
            <SafetyOutlined /> 密码将使用 AES-256-GCM 加密存储，安全可靠
          </div>
        </Form>
      </Modal>
    </AppLayout>
  );
};

export default AccountsPage;
