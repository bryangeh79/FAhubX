import React from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Progress,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Alert
} from 'antd';
import {
  UserOutlined,
  MessageOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Title, Text } = Typography;

const DashboardPage: React.FC = () => {
  // 模拟数据
  const stats = {
    totalAccounts: 8,
    activeAccounts: 6,
    disabledAccounts: 1,
    bannedAccounts: 1,
    totalTasks: 12,
    activeTasks: 3,
    pendingTasks: 2,
    completedTasks: 7,
    failedTasks: 0,
    totalConversations: 245,
    todayConversations: 18,
    successRate: 92,
    systemStatus: 'healthy',
    lastUpdate: '2026-04-13T04:30:00Z'
  };

  const accounts = [
    {
      id: '1',
      displayName: '张三',
      username: 'zhangsan',
      status: 'active',
      lastActivityAt: '2026-04-13T04:15:00Z'
    },
    {
      id: '2',
      displayName: '李四',
      username: 'lisi',
      status: 'active',
      lastActivityAt: '2026-04-13T03:45:00Z'
    },
    {
      id: '3',
      displayName: '王五',
      username: 'wangwu',
      status: 'disabled',
      lastActivityAt: '2026-04-12T14:20:00Z'
    }
  ];

  const tasks = [
    {
      id: '1',
      name: '每日问候任务',
      type: 'conversation',
      status: 'running',
      executedAt: '2026-04-13T09:00:00Z',
      duration: 120
    },
    {
      id: '2',
      name: '产品推广任务',
      type: 'conversation',
      status: 'completed',
      executedAt: '2026-04-12T14:30:00Z',
      duration: 180
    }
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  const statCards = [
    {
      title: '总账号数',
      value: stats.totalAccounts,
      icon: <UserOutlined />,
      color: '#1890ff',
      suffix: '个',
    },
    {
      title: '活跃任务',
      value: stats.activeTasks,
      icon: <ClockCircleOutlined />,
      color: '#faad14',
      suffix: '个',
    },
    {
      title: '今日对话',
      value: stats.todayConversations,
      icon: <MessageOutlined />,
      color: '#52c41a',
      suffix: '次',
    },
    {
      title: '成功率',
      value: stats.successRate,
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
      suffix: '%',
      render: (value: number) => (
        <Progress
          percent={value}
          size="small"
          strokeColor={value > 90 ? '#52c41a' : value > 70 ? '#faad14' : '#f5222d'}
        />
      ),
    },
  ];

  const accountColumns = [
    {
      title: '账号名称',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text: string, record: any) => (
        <Space>
          <UserOutlined />
          <Text strong>{text || record.username}</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig: Record<string, { color: string; text: string }> = {
          active: { color: 'success', text: '活跃' },
          disabled: { color: 'default', text: '禁用' },
          banned: { color: 'error', text: '封禁' },
          suspended: { color: 'warning', text: '暂停' },
        };
        const config = statusConfig[status] || { color: 'default', text: '未知' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '最后活动',
      dataIndex: 'lastActivityAt',
      key: 'lastActivityAt',
      render: (date: string) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small">
            详情
          </Button>
          {record.status === 'active' && (
            <Button type="link" size="small" danger>
              暂停
            </Button>
          )}
        </Space>
      ),
    },
  ];

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
        const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
          completed: { color: 'success', icon: <CheckCircleOutlined /> },
          running: { color: 'processing', icon: <ClockCircleOutlined /> },
          failed: { color: 'error', icon: <ExclamationCircleOutlined /> },
          pending: { color: 'default', icon: <ClockCircleOutlined /> },
        };
        const config = statusConfig[status] || { color: 'default', icon: null };
        return (
          <Tag icon={config.icon} color={config.color}>
            {status === 'completed' ? '完成' :
             status === 'running' ? '运行中' :
             status === 'failed' ? '失败' : '等待'}
          </Tag>
        );
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
    <div className="dashboard-page">
      {/* 页面标题和操作 */}
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>仪表板</Title>
            <Text type="secondary">欢迎回来！这里是您的自动化任务概览。</Text>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />}>
                刷新
              </Button>
              <Link to="/tasks/create">
                <Button type="primary" icon={<PlusOutlined />}>
                  创建任务
                </Button>
              </Link>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 系统状态提示 */}
      {stats.systemStatus === 'warning' && (
        <Alert
          message="系统检测到异常"
          description="部分账号登录状态异常，建议检查账号配置。"
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card>
              <Statistic
                title={card.title}
                value={card.value}
                prefix={card.icon}
                suffix={card.suffix}
                valueStyle={{ color: card.color }}
              />
              {card.render && card.render(card.value)}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* 账号状态 */}
        <Col xs={24} lg={12}>
          <Card
            title="账号状态"
            extra={
              <Link to="/accounts">
                <Button type="link" size="small">
                  管理账号
                </Button>
              </Link>
            }
          >
            <Table
              columns={accountColumns}
              dataSource={accounts}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* 最近任务 */}
        <Col xs={24} lg={12}>
          <Card
            title="最近任务"
            extra={
              <Link to="/tasks">
                <Button type="link" size="small">
                  查看全部
                </Button>
              </Link>
            }
          >
            <Table
              columns={taskColumns}
              dataSource={tasks}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <Card title="快速操作">
            <Space wrap>
              <Link to="/accounts/add">
                <Button icon={<PlusOutlined />}>添加账号</Button>
              </Link>
              <Link to="/conversation/scripts">
                <Button icon={<MessageOutlined />}>对话剧本</Button>
              </Link>
              <Link to="/tasks/create?type=conversation">
                <Button type="primary" icon={<MessageOutlined />}>
                  创建对话任务
                </Button>
              </Link>
              <Link to="/tasks/create?type=post">
                <Button type="primary" icon={<MessageOutlined />}>
                  创建发帖任务
                </Button>
              </Link>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 系统信息 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <Card title="系统信息" size="small">
            <Row gutter={[32, 16]}>
              <Col xs={24} sm={8}>
                <div>
                  <Text type="secondary">系统版本</Text>
                  <div>
                    <Text strong>v1.0.0</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div>
                  <Text type="secondary">最后更新</Text>
                  <div>
                    <Text strong>{formatDate(stats.lastUpdate)}</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div>
                  <Text type="secondary">运行状态</Text>
                  <div>
                    <Tag color="success">正常</Tag>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;