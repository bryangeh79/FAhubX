import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Popconfirm,
  Tooltip,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
  BatchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { api } from '../services/api';
import { formatDate } from '../utils/formatters';
import AccountBatchOperations from '../components/AccountBatchOperations';

const { Title, Text } = Typography;
const { Option } = Select;

interface Account {
  id: string;
  username: string;
  displayName: string;
  email: string;
  status: 'active' | 'disabled' | 'banned' | 'suspended';
  tags: string[];
  lastActivityAt: string;
  lastStatusCheck: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  vpnConfig?: {
    provider: string;
    location: string;
  };
}

const AccountsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const queryClient = useQueryClient();

  // 获取账号列表
  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then(res => res.data),
  });

  const accounts = accountsData?.accounts || [];

  // 创建/更新账号
  const mutation = useMutation({
    mutationFn: (values: any) => {
      if (editingAccount) {
        return api.put(`/accounts/${editingAccount.id}`, values);
      } else {
        return api.post('/accounts', values);
      }
    },
    onSuccess: () => {
      message.success(editingAccount ? '账号更新成功' : '账号添加成功');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      handleModalClose();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '操作失败');
    },
  });

  // 删除账号
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      message.success('账号删除成功');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '删除失败');
    },
  });

  // 测试连接
  const testConnectionMutation = useMutation({
    mutationFn: (id: string) => api.post(`/accounts/${id}/test-connection`),
    onSuccess: () => {
      message.success('连接测试成功');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '连接测试失败');
    },
  });

  // 手动登录
  const loginMutation = useMutation({
    mutationFn: (id: string) => api.post(`/accounts/${id}/login`),
    onSuccess: () => {
      message.success('登录成功');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '登录失败');
    },
  });

  const handleAddClick = () => {
    setEditingAccount(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleBatchClick = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的账号');
      return;
    }
    setBatchModalVisible(true);
  };

  const handleEditClick = (account: Account) => {
    setEditingAccount(account);
    form.setFieldsValue({
      username: account.username,
      displayName: account.displayName,
      email: account.email,
      tags: account.tags,
      vpnProvider: account.vpnConfig?.provider,
      vpnLocation: account.vpnConfig?.location,
    });
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingAccount(null);
    form.resetFields();
  };

  const handleBatchClose = () => {
    setBatchModalVisible(false);
    setSelectedRowKeys([]);
  };

  const handleBatchSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    setSelectedRowKeys([]);
  };

  const handleSubmit = (values: any) => {
    const formattedValues = {
      ...values,
      vpnConfig: values.vpnProvider ? {
        provider: values.vpnProvider,
        location: values.vpnLocation,
      } : undefined,
    };
    delete formattedValues.vpnProvider;
    delete formattedValues.vpnLocation;
    
    mutation.mutate(formattedValues);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleTestConnection = (id: string) => {
    testConnectionMutation.mutate(id);
  };

  const handleLogin = (id: string) => {
    loginMutation.mutate(id);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  // 账号状态标签
  const renderStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string; icon?: React.ReactNode }> = {
      active: { color: 'success', text: '活跃', icon: <CheckCircleOutlined /> },
      disabled: { color: 'default', text: '禁用' },
      banned: { color: 'error', text: '封禁', icon: <ExclamationCircleOutlined /> },
      suspended: { color: 'warning', text: '暂停' },
    };
    const config = statusConfig[status] || { color: 'default', text: '未知' };
    return (
      <Tag icon={config.icon} color={config.color}>
        {config.text}
      </Tag>
    );
  };

  // 成功率计算
  const calculateSuccessRate = (account: Account) => {
    if (account.totalTasks === 0) return 0;
    return Math.round((account.successfulTasks / account.totalTasks) * 100);
  };

  // 表格列定义
  const columns = [
    {
      title: '账号信息',
      key: 'info',
      render: (_: any, record: Account) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.displayName || record.username}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.email}
          </Text>
          <Space size={4}>
            {record.tags?.map((tag: string) => (
              <Tag key={tag} color="blue" style={{ fontSize: 10, margin: 0 }}>
                {tag}
              </Tag>
            ))}
          </Space>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Account) => (
        <Space direction="vertical" size={4}>
          {renderStatusTag(status)}
          {record.vpnConfig && (
            <Tooltip title={`VPN: ${record.vpnConfig.provider} - ${record.vpnConfig.location}`}>
              <Tag color="cyan" style={{ fontSize: 10, margin: 0 }}>
                VPN
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '任务统计',
      key: 'stats',
      render: (_: any, record: Account) => {
        const successRate = calculateSuccessRate(record);
        return (
          <Space direction="vertical" size={2}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                总数: {record.totalTasks}
              </Text>
            </div>
            <div>
              <Badge
                status={successRate > 90 ? 'success' : successRate > 70 ? 'warning' : 'error'}
                text={`成功率: ${successRate}%`}
              />
            </div>
          </Space>
        );
      },
    },
    {
      title: '最后活动',
      dataIndex: 'lastActivityAt',
      key: 'lastActivityAt',
      render: (date: string) => (
        <Tooltip title={formatDate(date, 'YYYY-MM-DD HH:mm:ss')}>
          <Text>{formatDate(date)}</Text>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Account) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Link to={`/accounts/${record.id}`}>
              <Button type="text" icon={<EyeOutlined />} size="small" />
            </Link>
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEditClick(record)}
            />
          </Tooltip>
          <Tooltip title="测试连接">
            <Button
              type="text"
              icon={<SyncOutlined />}
              size="small"
              loading={testConnectionMutation.isPending && testConnectionMutation.variables === record.id}
              onClick={() => handleTestConnection(record.id)}
            />
          </Tooltip>
          <Tooltip title="手动登录">
            <Button
              type="text"
              icon={<CheckCircleOutlined />}
              size="small"
              loading={loginMutation.isPending && loginMutation.variables === record.id}
              onClick={() => handleLogin(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个账号吗？"
            description="删除后，相关的任务配置也会被删除。"
            icon={<QuestionCircleOutlined style={{ color: 'red' }} />}
            onConfirm={() => handleDelete(record.id)}
          >
            <Tooltip title="删除">
              <Button type="text" icon={<DeleteOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="accounts-page">
      {/* 页面标题和操作 */}
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>账号管理</Title>
            <Text type="secondary">管理您的Facebook账号，配置VPN和自动化设置。</Text>
          </Col>
          <Col>
            <Space>
              {selectedRowKeys.length > 0 && (
                <>
                  <Text type="secondary">
                    已选择 {selectedRowKeys.length} 个账号
                  </Text>
                  <Button
                    icon={<BatchOutlined />}
                    onClick={handleBatchClick}
                  >
                    批量操作
                  </Button>
                </>
              )}
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
                添加账号
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 账号列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={accounts}
          rowKey="id"
          loading={isLoading}
          rowSelection={rowSelection}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个账号`,
          }}
        />
      </Card>

      {/* 添加/编辑账号模态框 */}
      <Modal
        title={editingAccount ? '编辑账号' : '添加账号'}
        open={modalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            tags: [],
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="Facebook用户名"
                rules={[
                  { required: true, message: '请输入Facebook用户名' },
                  { min: 3, message: '用户名至少3个字符' },
                ]}
              >
                <Input placeholder="例如: john.doe" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="displayName"
                label="显示名称"
                rules={[{ required: true, message: '请输入显示名称' }]}
              >
                <Input placeholder="例如: 约翰的个人账号" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="email"
            label="邮箱地址"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="例如: john@example.com" />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
            tooltip="用于分类和筛选账号"
          >
            <Select
              mode="tags"
              placeholder="输入标签，按回车添加"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Card title="VPN配置" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="vpnProvider"
                  label="VPN提供商"
                >
                  <Select placeholder="选择VPN提供商">
                    <Option value="openvpn">OpenVPN</Option>
                    <Option value="wireguard">WireGuard</Option>
                    <Option value="nordvpn">NordVPN</Option>
                    <Option value="expressvpn">ExpressVPN</Option>
                    <Option value="custom">自定义</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="vpnLocation"
                  label="VPN位置"
                >
                  <Select placeholder="选择VPN位置">
                    <Option value="us">美国</Option>
                    <Option value="uk">英国</Option>
                    <Option value="jp">日本</Option>
                    <Option value="sg">新加坡</Option>
                    <Option value="de">德国</Option>
                    <Option value="custom">自定义</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Form.Item
            name="autoLogin"
            label="自动登录"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleModalClose}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={mutation.isPending}
              >
                {editingAccount ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量操作模态框 */}
      {batchModalVisible && (
        <AccountBatchOperations
          selectedAccountIds={selectedRowKeys as string[]}
          onClose={handleBatchClose}
          onSuccess={handleBatchSuccess}
        />
      )}
    </div>
  );
};

export default AccountsPage;