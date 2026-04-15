import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Table,
  Tag,
  Typography,
  Progress,
  Badge,
  Space,
  Alert,
  Statistic,
  Timeline,
  Button,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  MessageOutlined,
  GlobalOutlined,
  SyncOutlined,
  WifiOutlined,
  WifiOffOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';

import { api } from '../services/api';
import { useDashboardWebSocket } from '../hooks/useDashboardWebSocket';
import { formatDate, formatDuration } from '../utils/formatters';

const { Title, Text } = Typography;

interface RealTimeMonitorProps {
  height?: number;
}

interface TaskUpdate {
  id: string;
  name: string;
  type: string;
  status: string;
  progress: number;
  accountId: string;
  accountName: string;
  timestamp: string;
  error?: string;
}

interface AccountUpdate {
  id: string;
  username: string;
  displayName: string;
  status: string;
  online: boolean;
  lastActivityAt: string;
}

interface SystemUpdate {
  type: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  timestamp: string;
}

const RealTimeMonitor: React.FC<RealTimeMonitorProps> = ({ height = 600 }) => {
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([]);
  const [accountUpdates, setAccountUpdates] = useState<AccountUpdate[]>([]);
  const [systemUpdates, setSystemUpdates] = useState<SystemUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // 获取初始数据
  const { data: initialData, refetch } = useQuery({
    queryKey: ['monitor-initial'],
    queryFn: () => api.get('/monitor/initial').then(res => res.data),
  });

  // WebSocket连接
  const { isConnected: wsConnected } = useDashboardWebSocket({
    onUpdate: (update) => {
      switch (update.type) {
        case 'task':
          setTaskUpdates(prev => {
            const newUpdates = [update.data as TaskUpdate, ...prev];
            return newUpdates.slice(0, 50); // 只保留最新的50条
          });
          break;
        case 'account':
          setAccountUpdates(prev => {
            const existingIndex = prev.findIndex(a => a.id === update.data.id);
            if (existingIndex >= 0) {
              const newUpdates = [...prev];
              newUpdates[existingIndex] = update.data as AccountUpdate;
              return newUpdates;
            } else {
              return [update.data as AccountUpdate, ...prev].slice(0, 20);
            }
          });
          break;
        case 'system':
          setSystemUpdates(prev => {
            const newUpdates = [update.data as SystemUpdate, ...prev];
            return newUpdates.slice(0, 20); // 只保留最新的20条
          });
          break;
      }
    },
  });

  useEffect(() => {
    setIsConnected(wsConnected);
  }, [wsConnected]);

  useEffect(() => {
    if (initialData) {
      setTaskUpdates(initialData.recentTasks || []);
      setAccountUpdates(initialData.recentAccounts || []);
      setSystemUpdates(initialData.recentSystem || []);
    }
  }, [initialData]);

  // 统计信息
  const stats = {
    activeTasks: taskUpdates.filter(t => t.status === 'running').length,
    completedTasks: taskUpdates.filter(t => t.status === 'completed').length,
    failedTasks: taskUpdates.filter(t => t.status === 'failed').length,
    onlineAccounts: accountUpdates.filter(a => a.online).length,
    totalAccounts: accountUpdates.length,
  };

  // 任务状态标签
  const renderTaskStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string; icon?: React.ReactNode }> = {
      running: { color: 'processing', text: '执行中', icon: <PlayCircleOutlined /> },
      completed: { color: 'success', text: '完成', icon: <CheckCircleOutlined /> },
      failed: { color: 'error', text: '失败', icon: <ExclamationCircleOutlined /> },
      pending: { color: 'default', text: '等待', icon: <ClockCircleOutlined /> },
      paused: { color: 'warning', text: '暂停', icon: <PauseCircleOutlined /> },
    };
    const config = statusConfig[status] || { color: 'default', text: '未知' };
    return (
      <Tag icon={config.icon} color={config.color}>
        {config.text}
      </Tag>
    );
  };

  // 账号状态标签
  const renderAccountStatusTag = (online: boolean) => {
    return online ? (
      <Tag icon={<WifiOutlined />} color="success">
        在线
      </Tag>
    ) : (
      <Tag icon={<WifiOffOutlined />} color="default">
        离线
      </Tag>
    );
  };

  // 系统更新级别标签
  const renderSystemLevelTag = (level: string) => {
    const levelConfig: Record<string, { color: string; text: string }> = {
      info: { color: 'blue', text: '信息' },
      warning: { color: 'orange', text: '警告' },
      error: { color: 'red', text: '错误' },
    };
    const config = levelConfig[level] || { color: 'default', text: '未知' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 任务表格列
  const taskColumns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: TaskUpdate) => (
        <Space direction="vertical" size={2}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.accountName}
          </Text>
        </Space>
      ),
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
      render: (status: string, record: TaskUpdate) => (
        <Space direction="vertical" size={4}>
          {renderTaskStatusTag(status)}
          {record.progress > 0 && record.progress < 100 && (
            <Progress percent={record.progress} size="small" style={{ width: 100 }} />
          )}
        </Space>
      ),
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: string) => formatDate(timestamp, 'HH:mm:ss'),
    },
  ];

  // 账号表格列
  const accountColumns = [
    {
      title: '账号',
      key: 'account',
      render: (_: any, record: AccountUpdate) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.displayName || record.username}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.username}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: AccountUpdate) => (
        <Space direction="vertical" size={4}>
          {renderAccountStatusTag(record.online)}
          <Tag color={record.status === 'active' ? 'success' : 'default'}>
            {record.status === 'active' ? '活跃' : '禁用'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '最后活动',
      dataIndex: 'lastActivityAt',
      key: 'lastActivityAt',
      render: (timestamp: string) => formatDate(timestamp, 'HH:mm:ss'),
    },
  ];

  return (
    <div className="real-time-monitor" style={{ height }}>
      {/* 连接状态和统计 */}
      <div style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Alert
              message={
                <Space>
                  <Badge status={isConnected ? 'success' : 'error'} />
                  <Text strong>实时监控</Text>
                  <Text type="secondary">
                    {isConnected ? '已连接到实时数据流' : '实时连接断开，使用轮询更新'}
                  </Text>
                </Space>
              }
              type={isConnected ? 'success' : 'warning'}
              showIcon
              action={
                <Button
                  icon={<SyncOutlined />}
                  size="small"
                  onClick={() => refetch()}
                >
                  刷新数据
                </Button>
              }
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12} lg={4}>
            <Card size="small">
              <Statistic
                title="活跃任务"
                value={stats.activeTasks}
                prefix={<PlayCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card size="small">
              <Statistic
                title="完成/失败"
                value={`${stats.completedTasks}/${stats.failedTasks}`}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: stats.failedTasks > 0 ? '#f5222d' : '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card size="small">
              <Statistic
                title="在线账号"
                value={`${stats.onlineAccounts}/${stats.totalAccounts}`}
                prefix={<UserOutlined />}
                valueStyle={{ color: stats.onlineAccounts === stats.totalAccounts ? '#52c41a' : '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card size="small">
              <Statistic
                title="更新频率"
                value="实时"
                prefix={<SyncOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card size="small">
              <Statistic
                title="数据延迟"
                value={isConnected ? '<1s' : '>5s'}
                suffix="秒"
                valueStyle={{ color: isConnected ? '#52c41a' : '#f5222d' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card size="small">
              <Statistic
                title="连接状态"
                value={isConnected ? '正常' : '断开'}
                valueStyle={{ color: isConnected ? '#52c41a' : '#f5222d' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* 主要内容 */}
      <Row gutter={[16, 16]} style={{ height: 'calc(100% - 180px)' }}>
        {/* 任务监控 */}
        <Col xs={24} lg={12} style={{ height: '100%' }}>
          <Card
            title="任务执行监控"
            extra={
              <Badge
                count={stats.activeTasks}
                style={{ backgroundColor: '#faad14' }}
              />
            }
            style={{ height: '100%' }}
            bodyStyle={{ height: 'calc(100% - 57px)', overflow: 'auto' }}
          >
            <Table
              columns={taskColumns}
              dataSource={taskUpdates}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />
          </Card>
        </Col>

        {/* 账号状态 */}
        <Col xs={24} lg={12} style={{ height: '100%' }}>
          <Card
            title="账号状态监控"
            extra={
              <Badge
                count={stats.onlineAccounts}
                style={{ backgroundColor: '#52c41a' }}
              />
            }
            style={{ height: '100%' }}
            bodyStyle={{ height: 'calc(100% - 57px)', overflow: 'auto' }}
          >
            <Table
              columns={accountColumns}
              dataSource={accountUpdates}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />
          </Card>
        </Col>

        {/* 系统日志 */}
        <Col xs={24} style={{ height: '40%' }}>
          <Card
            title="系统日志"
            extra={
              <Badge
                count={systemUpdates.filter(s => s.level === 'error').length}
                style={{ backgroundColor: '#f5222d' }}
              />
            }
            style={{ height: '100%' }}
            bodyStyle={{ height: 'calc(100% - 57px)', overflow: 'auto' }}
          >
            {systemUpdates.length > 0 ? (
              <Timeline>
                {systemUpdates.map((update, index) => (
                  <Timeline.Item
                    key={index}
                    color={
                      update.level === 'error' ? 'red' :
                      update.level === 'warning' ? 'orange' : 'blue'
                    }
                  >
                    <Space direction="vertical" size={2}>
                      <div>
                        {renderSystemLevelTag(update.level)}
                        <Text style={{ marginLeft: 8 }}>{update.message}</Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDate(update.timestamp, 'YYYY-MM-DD HH:mm:ss')}
                      </Text>
                    </Space>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <SyncOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">暂无系统日志</Text>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RealTimeMonitor;