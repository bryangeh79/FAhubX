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
import RegistrationModal from '../components/RegistrationModal';
import { accountsService, FacebookAccount, AccountStats, CreateAccountData } from '../services/accounts';
import api from '../services/api';
import { useT } from '../i18n';

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
  const t = useT();
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
  const [registrationModalVisible, setRegistrationModalVisible] = useState(false);
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
      message.error(t('accounts.deleteFailed'));
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await accountsService.syncAccount(id);
      message.success(t('accounts.syncSuccess'));
      fetchAccounts();
    } catch {
      message.error(t('accounts.syncFailed'));
    } finally {
      setSyncingId(null);
    }
  };

  const handleLogin = async (record: FacebookAccount) => {
    setLoggingInId(record.id);
    message.loading({ content: `${t('accounts.login')} ${record.name}...`, key: 'login', duration: 60 });
    try {
      const res = await api.post(`/facebook-accounts/${record.id}/login`, {}, { timeout: 360000 });
      const result = res.data?.data || res.data;
      message.destroy('login');
      if (result?.success) {
        message.success({ content: `${record.name} ${t('accounts.loggedIn')}`, duration: 4 });
        fetchAccounts();
        fetchStats();
      } else {
        setLoginResultModal({
          visible: true,
          success: false,
          message: result?.error || t('accounts.loginFailedDefault'),
          requiresManual: result?.requiresManual,
        });
        fetchAccounts();
      }
    } catch (err: any) {
      message.destroy('login');
      const errMsg = err?.response?.data?.message || err?.message || t('accounts.loginFailedDefault');
      setLoginResultModal({ visible: false, success: false, message: errMsg });
      message.error(errMsg);
    } finally {
      setLoggingInId(null);
    }
  };

  const handleLogout = async (record: FacebookAccount) => {
    try {
      await api.post(`/facebook-accounts/${record.id}/logout`);
      message.success(t('accounts.logout'));
      fetchAccounts();
      fetchStats();
    } catch {
      message.error(t('accounts.syncFailed'));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingAccount) {
        // 双保险：如果用户没主动修改过密码字段，就把它从 payload 剥离。
        // 防止浏览器密码管家自动填充其他网站的密码导致账号原密码被覆盖。
        const touchedPassword = form.isFieldTouched('facebookPassword');
        if (!touchedPassword) {
          delete (values as any).facebookPassword;
        }
        await accountsService.updateAccount(editingAccount.id, values);
        message.success(t('accounts.updateSuccess'));
      } else {
        await accountsService.createAccount(values as CreateAccountData);
        message.success(t('accounts.createSuccess'));
      }
      setIsModalVisible(false);
      form.resetFields();
      fetchAccounts();
      fetchStats();
    } catch (err: any) {
      if (err?.response?.data?.message) {
        message.error(err.response.data.message);
      } else if (!err?.errorFields) {
        message.error(t('accounts.operationFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusTag = (record: any) => {
    const loginStatus = record.loginStatus;
    const status = record.status;
    if (loginStatus === true || status === 'active') {
      return <Badge status="success" text={<Tag color="green"><CheckCircleOutlined /> {t('accounts.loggedIn')}</Tag>} />;
    }
    if (status === 'error') {
      return <Tooltip title={record.syncError || t('accounts.loginFailedTitle')}><Tag color="red"><CloseCircleOutlined /> {t('accounts.statusError')}</Tag></Tooltip>;
    }
    if (status === 'banned') return <Tag color="volcano"><WarningOutlined /> {t('accounts.statusBanned')}</Tag>;
    return <Tag color="default">{t('accounts.notLoggedIn')}</Tag>;
  };

  const columns = [
    {
      title: t('accounts.colName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: FacebookAccount) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          {(record as any).lastLoginAt && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {t('accounts.lastLogin')}: {dayjs((record as any).lastLoginAt).format('MM-DD HH:mm')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t('accounts.colType'),
      dataIndex: 'accountType',
      key: 'accountType',
      render: (type: string) => {
        const map: Record<string, string> = {
          user: t('accounts.typeUser'),
          page: t('accounts.typePage'),
          business: t('accounts.typeBusiness'),
        };
        return <Tag>{map[type] || type}</Tag>;
      },
    },
    {
      title: t('accounts.colStatus'),
      key: 'loginStatus',
      render: (_: any, record: any) => getStatusTag(record),
    },
    {
      title: t('accounts.colVpn'),
      dataIndex: 'vpnConfigId',
      key: 'vpnConfigId',
      render: (vpnId: string) => {
        if (vpnId) {
          const vpn = vpnOptions.find(v => v.id === vpnId);
          return (
            <Tooltip title={t('accounts.assignedVpnTooltip')}>
              <Tag color="purple" icon={<GlobalOutlined />}>
                {vpn ? vpn.name : t('accounts.assignedVpn')}
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title={defaultVPN ? t('accounts.defaultVpnTooltip', { name: defaultVPN.name }) : t('accounts.noDefaultVpnTooltip')}>
            <Tag color={defaultVPN ? 'cyan' : 'default'} icon={<GlobalOutlined />}>
              {defaultVPN ? t('accounts.defaultVpn', { name: defaultVPN.name }) : t('accounts.globalIp')}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('accounts.colRemarks'),
      dataIndex: 'remarks',
      key: 'remarks',
      render: (text: string) => text || '-',
    },
    {
      title: t('accounts.colCreatedAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: t('accounts.colAction'),
      key: 'action',
      width: 200,
      render: (_: any, record: any) => (
        <Space size={4}>
          {/* Login / Logout button */}
          {record.loginStatus === true || record.status === 'active' ? (
            <Tooltip title={t('accounts.logoutTooltip')}>
              <Button
                size="small"
                danger
                icon={<LogoutOutlined />}
                onClick={() => handleLogout(record)}
              >
                {t('accounts.logout')}
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title={t('accounts.loginTooltip')}>
              <Button
                size="small"
                type="primary"
                icon={loggingInId === record.id ? <LoadingOutlined /> : <LoginOutlined />}
                loading={loggingInId === record.id}
                onClick={() => handleLogin(record)}
                disabled={loggingInId !== null && loggingInId !== record.id}
              >
                {t('accounts.login')}
              </Button>
            </Tooltip>
          )}
          <Tooltip title={t('accounts.editTooltip')}>
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title={t('accounts.syncTooltip')}>
            <Button
              size="small"
              type="text"
              icon={<SyncOutlined spin={syncingId === record.id} />}
              onClick={() => handleSync(record.id)}
              loading={syncingId === record.id}
            />
          </Tooltip>
          <Popconfirm
            title={t('accounts.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Tooltip title={t('accounts.deleteTooltip')}>
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
        <Title level={2} style={{ margin: 0 }}>{t('accounts.title')}</Title>
        <Space>
          <Button
            type="default"
            icon={<GlobalOutlined />}
            onClick={() => {
              if (vpnOptions.length === 0) {
                message.warning(t('accounts.registerAccountNoVpn'));
                return;
              }
              setRegistrationModalVisible(true);
            }}
          >
            {t('accounts.registerAccount')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('accounts.addAccount')}
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading}>
            <Statistic
              title={t('accounts.quotaTitle', { plan: ((stats as any)?.plan || 'basic').toUpperCase() })}
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
            <Statistic title={t('accounts.loggedIn')} value={accounts.filter(a => (a as any).loginStatus === true || a.status === 'active').length} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading}>
            <Statistic title={t('accounts.pageAccounts')} value={stats?.pageAccounts ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading}>
            <Statistic title={t('accounts.businessAccounts')} value={stats?.businessAccounts ?? 0} />
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
            showTotal: (total) => t('common.total', { count: total }),
          }}
        />
      </Card>

      {/* Login result modal */}
      <Modal
        title={<Space><CloseCircleOutlined style={{ color: 'red' }} /> {t('accounts.loginFailedTitle')}</Space>}
        open={loginResultModal.visible}
        onOk={() => setLoginResultModal(p => ({ ...p, visible: false }))}
        onCancel={() => setLoginResultModal(p => ({ ...p, visible: false }))}
        okText={t('accounts.loginFailedKnowIt')}
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Alert
          type={loginResultModal.requiresManual ? 'warning' : 'error'}
          message={loginResultModal.message}
          description={
            loginResultModal.requiresManual
              ? t('accounts.loginFailedManualDesc')
              : t('accounts.loginFailedCheckDesc')
          }
          showIcon
        />
      </Modal>

      {/* Add / Edit modal */}
      <Modal
        title={editingAccount ? t('accounts.editModalTitle') : t('accounts.addModalTitle')}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => { setIsModalVisible(false); form.resetFields(); }}
        confirmLoading={submitting}
        okText={editingAccount ? t('accounts.saveButton') : t('accounts.addButton')}
        cancelText={t('accounts.cancelButton')}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t('accounts.accountDisplayName')} rules={[{ required: true, message: t('accounts.nameRequired') }]}>
            <Input prefix={<UserOutlined />} placeholder={t('accounts.namePlaceholder')} />
          </Form.Item>
          <Form.Item name="email" label={t('accounts.email')} rules={[{ required: true, message: t('accounts.emailPlaceholder') }]}>
            <Input prefix={<MailOutlined />} placeholder={t('accounts.emailPlaceholder')} autoComplete="off" />
          </Form.Item>
          {!editingAccount && (
            <Form.Item name="facebookPassword" label={t('accounts.password')} rules={[{ required: true, message: t('accounts.password') }]}>
              {/* autoComplete="new-password" 阻止浏览器密码管家把其他网站保存的密码填进来 */}
              <Input.Password prefix={<LockOutlined />} placeholder={t('accounts.passwordPlaceholder')} autoComplete="new-password" />
            </Form.Item>
          )}
          {editingAccount && (
            <Form.Item name="facebookPassword" label={t('accounts.newPassword')}>
              <Input.Password prefix={<LockOutlined />} placeholder={t('accounts.newPasswordPlaceholder')} autoComplete="new-password" />
            </Form.Item>
          )}
          <Form.Item name="accountType" label={t('accounts.accountType')} initialValue="user">
            <Select>
              <Option value="user">{t('accounts.accountType_user')}</Option>
              <Option value="page">{t('accounts.accountType_page')}</Option>
              <Option value="business">{t('accounts.accountType_business')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="vpnConfigId"
            label={<Space><GlobalOutlined /><span>{t('accounts.vpnConfigLabel')}</span></Space>}
            help={
              <span style={{ fontSize: 12, color: '#888' }}>
                {t('accounts.vpnHelpText')}
                {defaultVPN
                  ? t('accounts.vpnHelpCurrentDefault', { name: defaultVPN.name })
                  : t('accounts.vpnHelpNoDefault')}
              </span>
            }
          >
            <Select
              allowClear
              placeholder={defaultVPN ? t('accounts.defaultVpn', { name: defaultVPN.name }) : t('accounts.vpnPlaceholder')}
            >
              {vpnOptions.map(vpn => (
                <Option key={vpn.id} value={vpn.id}>
                  <Space>
                    <GlobalOutlined style={{ color: vpn.status === 'active' ? '#52c41a' : '#aaa' }} />
                    {vpn.name}
                    {vpn.country && <Tag style={{ marginLeft: 4 }}>{vpn.country}</Tag>}
                    {vpn.isDefault && <Tag color="cyan">{t('accounts.vpnDefaultOption')}</Tag>}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="messengerPin"
            label={t('accounts.messengerPin')}
            tooltip={t('accounts.messengerPinTooltip')}
          >
            <Input.Password
              placeholder={t('accounts.messengerPinPlaceholder')}
              maxLength={6}
            />
          </Form.Item>

          <Form.Item name="remarks" label={t('common.remarks')}>
            <Input.TextArea rows={2} placeholder={t('accounts.remarksPlaceholder')} />
          </Form.Item>

          <Alert
            style={{ marginBottom: 8 }}
            type="info"
            showIcon
            message={<span style={{ fontSize: 12 }}>{t('accounts.vpnNote')}</span>}
          />

          <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#389e0d' }}>
            <SafetyOutlined /> {t('accounts.passwordSecurity')}
          </div>
        </Form>
      </Modal>

      {/* Registration modal (VPN 代理下半自动注册新账号) */}
      <RegistrationModal
        open={registrationModalVisible}
        onClose={() => setRegistrationModalVisible(false)}
        onSuccess={() => {
          fetchAccounts();
          fetchStats();
        }}
        vpnOptions={vpnOptions}
      />
    </AppLayout>
  );
};

export default AccountsPage;
