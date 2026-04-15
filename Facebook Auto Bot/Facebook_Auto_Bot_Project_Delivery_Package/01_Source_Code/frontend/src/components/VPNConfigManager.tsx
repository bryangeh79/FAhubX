import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Tooltip,
  Popconfirm,
  message,
  Row,
  Col,
  Alert,
  Badge,
  Progress,
  Descriptions,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  SafetyOutlined,
  GlobalOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface VPNConfig {
  id: string;
  name: string;
  provider: string;
  location: string;
  ipAddress: string;
  isConnected: boolean;
  latency?: number;
  bandwidth?: number;
  lastConnection: string;
  credentials?: {
    username?: string;
    password?: string;
  };
  rotationStrategy: 'random' | 'round-robin' | 'least-used' | 'fixed';
  rotationInterval: number; // 分钟
  maxConnections: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface VPNTestResult {
  configId: string;
  success: boolean;
  latency?: number;
  bandwidth?: number;
  error?: string;
  timestamp: string;
}

const VPNConfigManager: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<VPNConfig | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // 获取VPN配置列表
  const { data: vpnConfigs, isLoading } = useQuery({
    queryKey: ['vpn-configs'],
    queryFn: () => api.get('/vpn-configs').then(res => res.data),
  });

  // 获取VPN测试结果
  const { data: testResults } = useQuery({
    queryKey: ['vpn-test-results'],
    queryFn: () => api.get('/vpn-configs/test-results').then(res => res.data),
  });

  // 创建/更新VPN配置
  const mutation = useMutation({
    mutationFn: (values: any) => {
      if (editingConfig) {
        return api.put(`/vpn-configs/${editingConfig.id}`, values);
      } else {
        return api.post('/vpn-configs', values);
      }
    },
    onSuccess: () => {
      message.success(editingConfig ? 'VPN配置更新成功' : 'VPN配置添加成功');
      queryClient.invalidateQueries({ queryKey: ['vpn-configs'] });
      handleModalClose();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '操作失败');
    },
  });

  // 删除VPN配置
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vpn-configs/${id}`),
    onSuccess: () => {
      message.success('VPN配置删除成功');
      queryClient.invalidateQueries({ queryKey: ['vpn-configs'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '删除失败');
    },
  });

  // 测试VPN连接
  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/vpn-configs/${id}/test`),
    onSuccess: () => {
      message.success('VPN连接测试成功');
      queryClient.invalidateQueries({ queryKey: ['vpn-configs'] });
      queryClient.invalidateQueries({ queryKey: ['vpn-test-results'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '连接测试失败');
    },
  });

  // 批量测试
  const batchTestMutation = useMutation({
    mutationFn: () => api.post('/vpn-configs/batch-test'),
    onSuccess: () => {
      message.success('批量测试成功');
      queryClient.invalidateQueries({ queryKey: ['vpn-configs'] });
      queryClient.invalidateQueries({ queryKey: ['vpn-test-results'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '批量测试失败');
    },
  });

  const handleAddClick = () => {
    setEditingConfig(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditClick = (config: VPNConfig) => {
    setEditingConfig(config);
    form.setFieldsValue({
      name: config.name,
      provider: config.provider,
      location: config.location,
      ipAddress: config.ipAddress,
      username: config.credentials?.username,
      password: config.credentials?.password,
      rotationStrategy: config.rotationStrategy,
      rotationInterval: config.rotationInterval,
      maxConnections: config.maxConnections,
      tags: config.tags,
    });
    setModalVisible(true);
  };

  const handleTestClick = (id: string) => {
    setSelectedConfigId(id);
    testMutation.mutate(id);
  };

  const handleBatchTest = () => {
    batchTestMutation.mutate();
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingConfig(null);
    form.resetFields();
  };

  const handleSubmit = (values: any) => {
    const formattedValues = {
      ...values,
      credentials: values.username || values.password ? {
        username: values.username,
        password: values.password,
      } : undefined,
    };
    delete formattedValues.username;
    delete formattedValues.password;
    
    mutation.mutate(formattedValues);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // 连接状态标签
  const renderConnectionStatus = (isConnected: boolean, latency?: number) => {
    if (isConnected) {
      return (
        <Space>
          <Tag icon={<CheckCircleOutlined />} color="success">
            已连接
          </Tag>
          {latency && (
            <Tag color={latency < 100 ? 'success' : latency < 300 ? 'warning' : 'error'}>
              {latency}ms
            </Tag>
          )}
        </Space>
      );
    }
    return (
      <Tag icon={<ExclamationCircleOutlined />} color="error">
        未连接
      </Tag>
    );
  };

  // 提供商标签
  const renderProviderTag = (provider: string) => {
    const providerColors: Record<string, string> = {
      openvpn: 'blue',
      wireguard: 'cyan',
      nordvpn: 'purple',
      expressvpn: 'red',
      custom: 'default',
    };
    return (
      <Tag color={providerColors[provider] || 'default'}>
        {provider === 'openvpn' ? 'OpenVPN' :
         provider === 'wireguard' ? 'WireGuard' :
         provider === 'nordvpn' ? 'NordVPN' :
         provider === 'expressvpn' ? 'ExpressVPN' : '自定义'}
      </Tag>
    );
  };

  // 轮换策略标签
  const renderRotationStrategy = (strategy: string) => {
    const strategyConfig: Record<string, { color: string; text: string }> = {
      random: { color: 'orange', text: '随机' },
      'round-robin': { color: 'blue', text: '轮询' },
      'least-used': { color: 'green', text: '最少使用' },
      fixed: { color: 'default', text: '固定' },
    };
    const config = strategyConfig[strategy] || { color: 'default', text: '未知' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 表格列定义
  const columns = [
    {
      title: '配置名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: VPNConfig) => (
        <Space direction="vertical" size={2}>
          <Text strong>{name}</Text>
          <Space size={4}>
            {renderProviderTag(record.provider)}
            <Tag color="geekblue">{record.location}</Tag>
          </Space>
        </Space>
      ),
    },
    {
      title: '连接状态',
      key: 'status',
      render: (_: any, record: VPNConfig) => (
        <Space direction="vertical" size={4}>
          {renderConnectionStatus(record.isConnected, record.latency)}
          <Text type="secondary" style={{ fontSize: 12 }}>
            IP: {record.ipAddress}
          </Text>
        </Space>
      ),
    },
    {
      title: '性能指标',
      key: 'performance',
      render: (_: any, record: VPNConfig) => {
        if (!record.isConnected) return '-';
        return (
          <Space direction="vertical" size={2}>
            {record.latency && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>延迟: </Text>
                <Text strong style={{ color: record.latency < 100 ? '#52c41a' : record.latency < 300 ? '#faad14' : '#f5222d' }}>
                  {record.latency}ms
                </Text>
              </div>
            )}
            {record.bandwidth && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>带宽: </Text>
                <Text strong>{Math.round(record.bandwidth / 1024)} Mbps</Text>
              </div>
            )}
          </Space>
        );
      },
    },
    {
      title: '轮换策略',
      key: 'rotation',
      render: (_: any, record: VPNConfig) => (
        <Space direction="vertical" size={2}>
          {renderRotationStrategy(record.rotationStrategy)}
          <Text type="secondary" style={{ fontSize: 12 }}>
            间隔: {record.rotationInterval}分钟
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            最大连接: {record.maxConnections}
          </Text>
        </Space>
      ),
    },
    {
      title: '最后连接',
      dataIndex: 'lastConnection',
      key: 'lastConnection',
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(date).toLocaleString()}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: VPNConfig) => (
        <Space size="small">
          <Tooltip title="测试连接">
            <Button
              type="text"
              icon={<SyncOutlined />}
              size="small"
              loading={testMutation.isPending && testMutation.variables === record.id}
              onClick={() => handleTestClick(record.id)}
            />
          </Tooltip>
          <Tooltip title="编辑配置">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEditClick(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个VPN配置吗？"
            description="删除后，使用此配置的账号将无法连接。"
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

  // 测试结果表格列
  const testResultColumns = [
    {
      title: '配置名称',
      key: 'configName',
      render: (_: any, record: VPNTestResult) => {
        const config = vpnConfigs?.find((c: VPNConfig) => c.id === record.configId);
        return config?.name || record.configId;
      },
    },
    {
      title: '测试结果',
      key: 'result',
      render: (_: any, record: VPNTestResult) => (
        <Tag color={record.success ? 'success' : 'error'}>
          {record.success ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: '延迟',
      key: 'latency',
      render: (_: any, record: VPNTestResult) =>
        record.latency ? (
          <Text style={{ color: record.latency < 100 ? '#52c41a' : record.latency < 300 ? '#faad14' : '#f5222d' }}>
            {record.latency}ms
          </Text>
        ) : (
          '-'
        ),
    },
    {
      title: '带宽',
      key: 'bandwidth',
      render: (_: any, record: VPNTestResult) =>
        record.bandwidth ? (
          <Text>{Math.round(record.bandwidth / 1024)} Mbps</Text>
        ) : (
          '-'
        ),
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      render: (error: string) =>
        error ? (
          <Tooltip title={error}>
            <Text type="danger" style={{ fontSize: 12 }} ellipsis>
              {error}
            </Text>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: '测试时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(date).toLocaleString()}
        </Text>
      ),
    },
  ];

  return (
    <div className="vpn-config-manager">
      {/* 页面标题和操作 */}
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>VPN配置管理</Title>
            <Text type="secondary">管理VPN配置，配置IP轮换策略和连接设置。</Text>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<SyncOutlined />}
                loading={batchTestMutation.isPending}
                onClick={handleBatchTest}
              >
                批量测试
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
                添加配置
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* VPN配置列表 */}
      <Card style={{ marginBottom: 24 }}>
        <Table
          columns={columns}
          dataSource={vpnConfigs || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个VPN配置`,
          }}
        />
      </Card>

      {/* 测试结果 */}
      <Card title="最近测试结果" size="small">
        <Table
          columns={testResultColumns}
          dataSource={testResults || []}
          rowKey="timestamp"
          pagination={{
            pageSize: 5,
            showSizeChanger: false,
          }}
          size="small"
        />
      </Card>

      {/* 添加/编辑VPN配置模态框 */}
      <Modal
        title={editingConfig ? '编辑VPN配置' : '添加VPN配置'}
        open={modalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            rotationStrategy: 'round-robin',
            rotationInterval: 30,
            maxConnections: 10,
            tags: [],
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="配置名称"
                rules={[{ required: true, message: '请输入配置名称' }]}
              >
                <Input placeholder="例如: 美国VPN-01" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="provider"
                label="VPN提供商"
                rules={[{ required: true, message: '请选择VPN提供商' }]}
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
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="location"
                label="VPN位置"
                rules={[{ required: true, message: '请选择VPN位置' }]}
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
            <Col span={12}>
              <Form.Item
                name="ipAddress"
                label="IP地址"
                rules={[
                  { required: true, message: '请输入IP地址' },
                  { pattern: /^(\d