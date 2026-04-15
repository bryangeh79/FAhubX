import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Typography,
  Tabs,
  Table,
  Progress,
  Statistic,
  Alert,
  Timeline,
  Badge,
  Modal,
  Form,
  Input,
  Select,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  SyncOutlined,
  HistoryOutlined,
  SettingOutlined,
  BarChartOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  MailOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';

import { api } from '../services/api';
import { formatDate, formatDuration } from '../utils/formatters';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface AccountDetail {
  id: string;
  username: string;
  displayName: string;
  email: string;
  status: 'active' | 'disabled' | 'banned' | 'suspended';
  tags: string[];
  lastActivityAt: string;
  lastStatusCheck: string;
  createdAt: string;
  updatedAt: string;
  
  // 统计信息
  stats: {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    totalConversations: number;
    successfulConversations: number;
    totalPosts: number;
    successfulPosts: number;
  };
  
  // VPN配置
  vpnConfig?: {
    provider: string;
    location: string;
    status: 'connected' | 'disconnected' | 'error';
    lastConnected: string;
    ipAddress: string;
  };
  
  // 最近活动
  recentActivities: Array<{
    id: string;
    type: 'task' | 'login' | 'status_check' | 'vpn_connect';
    description: string;
    status: 'success' | 'failed' | 'pending';
    timestamp: string;
    details?: any;
  }>;
  
  // 最近任务
  recentTasks: Array<{
    id: string;
    name: string;
    type: string;
    status: 'completed' | 'running' | 'failed' | 'pending';
    executedAt: string;
    duration: number;
    result?: any;
  }>;
}

const AccountDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [vpnModalVisible, setVpnModalVisible] = useState(false);
  const queryClient = useQueryClient();

  // 获取账号详情
  const { data: account, isLoading, error } = useQuery({
    queryKey: ['account', id],
    queryFn: () => api.get(`/accounts/${id}`).then(res => res.data),
    enabled: !!id,
  });

  // 更新VPN配置
  const updateVpnMutation = useMutation({
    mutationFn: (values: any) => api.put(`/accounts/${id}/vpn`, values),
    onSuccess: () => {
      message.success('VPN配置更新成功');
      queryClient.invalidateQueries({ queryKey: ['account', id] });
      setVpnModalVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '更新失败');
    },
  });

  // 测试连接
  const testConnectionMutation = useMutation({
    mutationFn: () => api.post(`/accounts/${id}/test-connection`),
    onSuccess: () => {
      message.success('连接测试成功');
      queryClient.invalidateQueries({ queryKey: ['account', id] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '连接测试失败');
    },
  });

  // 手动登录
  const loginMutation = useMutation({
    mutationFn: () => api.post(`/accounts/${id}/login`),
    onSuccess: () => {
      message.success('登录成功');
      queryClient.invalidateQueries({ queryKey: ['account', id] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '登录失败');
    },
  });

  const handleBack = () => {
    navigate('/accounts');
  };

  const handleEditVpn = () => {
    if (account?.vpnConfig) {
      form.setFieldsValue({
        provider: account.vpnConfig.provider,
        location: account.vpnConfig.location,
      });
    }
    setVpnModalVisible(true);
  };

  const handleVpnSubmit = (values: any) => {
    updateVpnMutation.mutate(values);
  };

  const handleTestConnection = () => {
    testConnectionMutation.mutate();
  };

  const handleLogin = () => {
    loginMutation.mutate();
  };

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="加载失败"
          description={error.message || '无法加载账号信息'}
          type="error"
          showIcon
          action={
            <Button type="primary" onClick={handleBack}>
              返回账号列表
            </Button>
          }
        />
      </div>
    );
  }

  if (!account && !isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="账号不存在"
          description="请求的账号不存在或已被删除"
          type="warning"
          showIcon
          action={
            <Button type="primary" onClick={handleBack}>
              返回账号列表
            </Button>
          }
        />
      </div>
    );
  }

  const accountData = account as AccountDetail;

  // 计算成功率
  const calculateSuccessRate = (success: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((success / total) * 100);
  };

  const taskSuccessRate = calculateSuccessRate(
    accountData?.stats.successfulTasks || 0,
    accountData?.stats.totalTasks || 0
  );

  const conversationSuccessRate = calculateSuccessRate(
    accountData?.stats.successfulConversations || 0,
    accountData?.stats.totalConversations || 0
  );

  const postSuccessRate = calculateSuccessRate(
    accountData?.stats.successfulPosts || 0,
    accountData?.stats.totalPosts || 0
  );

  // 状态标签
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

  // VPN状态标签
  const renderVpnStatusTag = (status?: string) => {
    if (!status) return <Tag color="default">未配置</Tag>;
    
    const statusConfig: Record<string, { color: string; text: string }> = {
      connected: { color: 'success', text: '已连接' },
      disconnected: { color: 'default', text: '未连接' },
      error: { color: 'error', text: '连接错误' },
    };
    const config = statusConfig[status] || { color: 'default', text: '未知' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 活动时间线项目
  const renderTimelineItem = (activity: any) => {
    const statusConfig: Record<string, { color: string; icon?: React.ReactNode }> = {
      success: { color: 'green', icon: <CheckCircleOutlined /> },
      failed: { color: 'red', icon: <ExclamationCircleOutlined /> },
      pending: { color: 'gray', icon: <ClockCircleOutlined /> },
    };
    const config = statusConfig[activity.status] || { color: 'blue' };

    return {
      color: config.color,
      dot: config.icon,
      children: (
        <div>
          <Text strong>{activity.description}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatDate(activity.timestamp, 'YYYY-MM-DD HH:mm:ss')}
            </Text>
          </div>
        </div>
      ),
    };
  };

  // 任务表格列
  const taskColumns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          conversation: '对话',
          post: '发帖',
          like: '点赞',
          share: '分享',
        };
        return <Tag color="blue">{typeMap[type] || type}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig: Record<string, { color: string; text: string }> = {
          completed: { color: 'success', text: '完成' },
          running: { color: 'processing', text: '运行中' },
          failed: { color: 'error', text: '失败' },
          pending: { color: 'default', text: '等待' },
        };
        const config = statusConfig[status] || { color: 'default', text: '未知' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '执行时间',
      dataIndex: 'executedAt',
      key: 'executedAt',
      render: (date: string) => formatDate(date),
    },
    {
      title: '持续时间',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration: number) => formatDuration(duration),
    },
  ];

  return (
    <div className="account-detail-page">
      {/* 页面标题和操作 */}
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
                返回
              </Button>
              <Title level={2} style={{ margin: 0 }}>
                {accountData?.displayName || accountData?.username || '账号详情'}
              </Title>
              {accountData && renderStatusTag(accountData.status)}
            </Space>
            {accountData?.email && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  <MailOutlined /> {accountData.email}
                </Text>
              </div>
            )}
          </Col>
          <Col>
            <Space>
              <Button
                icon={<SyncOutlined />}
                loading={testConnectionMutation.isPending}
                onClick={handleTestConnection}
              >
                测试连接
              </Button>
              <Button
                icon={<CheckCircleOutlined />}
                loading={loginMutation.isPending}
                onClick={handleLogin}
              >
                手动登录
              </Button>
              <Link to={`/accounts/${id}/edit`}>
                <Button icon={<EditOutlined />} type="primary">
                  编辑账号
                </Button>
              </Link>
            </Space>
          </Col>
        </Row>
      </div>

      {isLoading ? (
        <Card loading={true} />
      ) : (
        <>
          {/* 基本信息卡片 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={8}>
              <Card title="基本信息" size="small">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="用户名">
                    <Text strong>{accountData.username}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="显示名称">
                    {accountData.displayName}
                  </Descriptions.Item>
                  <Descriptions.Item label="邮箱">
                    {accountData.email}
                  </Descriptions.Item>
                  <Descriptions.Item label="标签">
                    <Space size={[0, 4]} wrap>
                      {accountData.tags?.map((tag: string) => (
                        <Tag key={tag} color="blue">
                          {tag}
                        </Tag>
                      ))}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="创建时间">
                    {formatDate(accountData.createdAt)}
                  </Descriptions.Item>
                  <Descriptions.Item label="最后更新">
                    {formatDate(accountData.updatedAt)}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="VPN配置" size="small" extra={
                <Button type="link" size="small" icon={<EditOutlined />} onClick={handleEditVpn}>
                  编辑
                </Button>
              }>
                {accountData.vpnConfig ? (
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="提供商">
                      {accountData.vpnConfig.provider}
                    </Descriptions.Item>
                    <Descriptions.Item label="位置">
                      {accountData.vpnConfig.location}
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      {renderVpnStatusTag(accountData.vpnConfig.status)}
                    </Descriptions.Item>
                    <Descriptions.Item label="IP地址">
                      {accountData.vpnConfig.ipAddress || '未知'}
                    </Descriptions.Item>
                    <Descriptions.Item label="最后连接">
                      {accountData.vpnConfig.lastConnected
                        ? formatDate(accountData.vpnConfig.lastConnected)
                        : '从未连接'}
                    </Descriptions.Item>
                  </Descriptions>
                ) : (
                  <Alert
                    message="未配置VPN"
                    description="此账号尚未配置VPN连接"
                    type="warning"
                    showIcon
                    action={
                      <Button type="link" size="small" onClick={handleEditVpn}>
                        立即配置
                      </Button>
                    }
                  />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="账号状态" size="small">
                <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <Statistic
                      title="最后活动"
                      value={formatDate(accountData.lastActivityAt, 'MM-DD HH:mm')}
                      valueStyle={{ fontSize: 14 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="状态检查"
                      value={formatDate(accountData.lastStatusCheck, 'MM-DD HH:mm')}
                      valueStyle={{ fontSize: 14 }}
                    />
                  </Col>
                </Row>
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    账号健康度
                  </Text>
                  <Progress
                    percent={accountData.status === 'active' ? 95 : accountData.status === 'suspended' ? 60 : 30}
                    status={accountData.status === 'active' ? 'success' : 'normal'}
                    size="small"
                  />
                </div>
              </Card>
            </Col>
          </Row>

          {/* 标签页内容 */}
          <Tabs defaultActiveKey="activities">
            <TabPane
              tab={
                <span>
                  <HistoryOutlined />
                  最近活动
                </span>
              }
              key="activities"
            >
              <Card>
                {accountData.recentActivities && accountData.recentActivities.length > 0 ? (
                  <Timeline
                    items={accountData.recentActivities.map(renderTimelineItem)}
                  />
                ) : (
                  <Alert
                    message="暂无活动记录"
                    description="此账号还没有任何活动记录"
                    type="info"
                    showIcon
                  />
                )}
              </Card>
            </TabPane>

            <TabPane
              tab={
                <span>
                  <BarChartOutlined />
                  最近任务
                </span>
              }
              key="tasks"
            >
              <Card>
                <Table
                  columns={taskColumns}
                  dataSource={accountData.recentTasks}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              </Card>
            </TabPane>

            <TabPane
              tab={
                <span>
                  <SettingOutlined />
                  高级设置
                </span>
              }
              key="settings"
            >
              <Card title="账号设置">
                <Alert
                  message="高级设置"
                  description="这里可以配置账号的高级选项，如自动化规则、安全设置等。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card size="small" title="安全设置">
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <div>
                          <Text strong>双重验证</Text>
                          <Switch checked={false} style={{ marginLeft: 8 }} />
                        </div>
                        <div>
                          <Text strong>登录通知</Text>
                          <Switch checked={true} style={{ marginLeft: 8 }} />
                        </div>
                        <div>
                          <Text strong>异常活动警报</Text>
                          <Switch checked={true} style={{ marginLeft: 8 }} />
                        </div>
                      </Space>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="自动化规则">
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <div>
                          <Text strong>自动重试失败任务</Text>
                          <Switch checked={true} style={{ marginLeft: 8 }} />
                        </div>
                        <div>
                          <Text strong>任务失败通知</Text>
                          <Switch checked={true} style={{ marginLeft: 8 }} />
                        </div>
                        <div>
                          <Text strong>自动切换VPN</Text>
                          <Switch checked={false} style={{ marginLeft: 8 }} />
                        </div>
                      </Space>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </TabPane>
          </Tabs>

          {/* VPN配置模态框 */}
          <Modal
            title="VPN配置"
            open={vpnModalVisible}
            onCancel={() => setVpnModalVisible(false)}
            footer={null}
            width={500}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleVpnSubmit}
            >
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

              <Form.Item
                name="config"
                label="配置文件"
                tooltip="自定义VPN配置文件（可选）"
              >
                <Input.TextArea
                  placeholder="输入VPN配置文件内容"
                  rows={4}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setVpnModalVisible(false)}>
                    取消
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={updateVpnMutation.isPending}
                  >
                    保存配置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
    </div>
  );
};

export default AccountDetailPage;
            <Col xs={24} lg={8}>
              <Card title="任务统计" size="small">
                <Row gutter={[8, 16]}>
                  <Col span={12}>
                    <Statistic
                      title="总任务数"
                      value={accountData.stats.totalTasks}
                      prefix={<HistoryOutlined />}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="成功率"
                      value={taskSuccessRate}
                      suffix="%"
                      valueStyle={{ color: taskSuccessRate > 90 ? '#52c41a' : taskSuccessRate > 70 ? '#faad14' : '#f5222d' }}
                    />
                  </Col>
                  <Col span={24}>
                    <Progress
                      percent={taskSuccessRate}
                      status={taskSuccessRate > 90 ? 'success' : taskSuccessRate > 70 ? 'normal' : 'exception'}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="对话统计" size="small">
                <Row gutter={[8, 16]}>
                  <Col span={12}>
                    <Statistic
                      title="对话次数"
                      value={accountData.stats.totalConversations}
                      prefix={<UserOutlined />}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="成功率"
                      value={conversationSuccessRate}
                      suffix="%"
                      valueStyle={{ color: conversationSuccessRate > 90 ? '#52c41a' : conversationSuccessRate > 70 ? '#faad14' : '#f5222d' }}
                    />
                  </Col>
                  <Col span={24}>
                    <Progress
                      percent={conversationSuccessRate}
                      status={conversationSuccessRate > 90 ? 'success' : conversationSuccessRate > 70 ? 'normal' : 'exception'}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="发帖统计" size="small">
                <Row gutter={[8, 16]}>
                  <Col span={12}>
                    <Statistic
                      title="发帖数量"
                      value={accountData.stats.totalPosts}
                      prefix={<GlobalOutlined />}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="成功率"
                      value={postSuccessRate}
                      suffix="%"
                      valueStyle={{ color: postSuccessRate > 90 ? '#52c41a' : postSuccessRate > 70 ? '#faad14' : '#f5222d' }}
                    />
                  </Col>
                  <Col span={24}>
                    <Progress
                      percent={postSuccessRate}
                      status={postSuccessRate > 90 ? 'success' : postSuccessRate > 70 ? 'normal' : 'exception'}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>