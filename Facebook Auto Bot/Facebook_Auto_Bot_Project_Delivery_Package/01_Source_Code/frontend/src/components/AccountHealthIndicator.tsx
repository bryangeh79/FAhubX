import React from 'react';
import {
  Card,
  Row,
  Col,
  Progress,
  Tag,
  Statistic,
  Space,
  Button,
  Tooltip,
  Badge,
  Dropdown,
  MenuProps,
} from 'antd';
import {
  UserOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  MoreOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface AccountHealthData {
  id: string;
  username: string;
  displayName: string;
  status: 'active' | 'disabled' | 'banned' | 'suspended' | 'warning';
  healthScore: number;
  lastActivity: string;
  online: boolean;
  tasks: {
    total: number;
    completed: number;
    failed: number;
    running: number;
  };
  metrics: {
    successRate: number;
    responseTime: number;
    availability: number;
  };
  issues: Array<{
    type: 'login' | 'cookie' | 'rate_limit' | 'connection';
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
}

const AccountHealthIndicator: React.FC = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['account-health'],
    queryFn: () => api.get('/accounts/health').then(res => res.data),
    refetchInterval: 30000, // 每30秒刷新一次
  });

  const accounts: AccountHealthData[] = data?.accounts || [];

  const getHealthColor = (score: number): string => {
    if (score >= 90) return '#52c41a';
    if (score >= 70) return '#faad14';
    if (score >= 50) return '#fa8c16';
    return '#f5222d';
  };

  const getStatusTag = (status: string, online: boolean) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      active: {
        color: online ? 'success' : 'default',
        icon: online ? <CheckCircleOutlined /> : <WarningOutlined />,
        text: online ? '在线' : '离线',
      },
      disabled: {
        color: 'default',
        icon: <CloseCircleOutlined />,
        text: '禁用',
      },
      banned: {
        color: 'error',
        icon: <CloseCircleOutlined />,
        text: '封禁',
      },
      suspended: {
        color: 'warning',
        icon: <WarningOutlined />,
        text: '暂停',
      },
      warning: {
        color: 'warning',
        icon: <WarningOutlined />,
        text: '警告',
      },
    };

    const config = statusConfig[status] || {
      color: 'default',
      icon: <WarningOutlined />,
      text: '未知',
    };

    return (
      <Tag icon={config.icon} color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getIssueSeverityTag = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Tag color="red">严重</Tag>;
      case 'medium':
        return <Tag color="orange">中等</Tag>;
      case 'low':
        return <Tag color="blue">轻微</Tag>;
      default:
        return <Tag color="default">未知</Tag>;
    }
  };

  const handleAccountAction = (accountId: string, action: string) => {
    console.log(`执行操作: ${action} 账号: ${accountId}`);
    // 这里可以添加实际的API调用
  };

  const getActionMenu = (account: AccountHealthData): MenuProps => {
    const items: MenuProps['items'] = [
      {
        key: 'view',
        icon: <EyeOutlined />,
        label: '查看详情',
        onClick: () => handleAccountAction(account.id, 'view'),
      },
      {
        key: 'refresh',
        icon: <ReloadOutlined />,
        label: '刷新状态',
        onClick: () => handleAccountAction(account.id, 'refresh'),
      },
    ];

    if (account.status === 'active') {
      items.push({
        key: 'pause',
        icon: <PauseCircleOutlined />,
        label: '暂停账号',
        danger: true,
        onClick: () => handleAccountAction(account.id, 'pause'),
      });
    } else if (account.status === 'disabled' || account.status === 'suspended') {
      items.push({
        key: 'activate',
        icon: <PlayCircleOutlined />,
        label: '激活账号',
        onClick: () => handleAccountAction(account.id, 'activate'),
      });
    }

    return { items };
  };

  if (isLoading) {
    return (
      <Card title="账号健康状态" loading>
        <div style={{ height: 300 }} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        title="账号健康状态"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            size="small"
          >
            重试
          </Button>
        }
      >
        <div style={{ textAlign: 'center', padding: 40 }}>
          <WarningOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
          <div>无法获取账号健康数据</div>
        </div>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card
        title="账号健康状态"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            size="small"
          >
            刷新
          </Button>
        }
      >
        <div style={{ textAlign: 'center', padding: 40 }}>
          <UserOutlined style={{ fontSize: 48, color: '#999', marginBottom: 16 }} />
          <div>暂无账号数据</div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <UserOutlined />
          账号健康状态
          <Badge
            count={accounts.length}
            style={{ backgroundColor: '#1890ff' }}
          />
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            size="small"
          >
            刷新
          </Button>
        </Space>
      }
    >
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {accounts.map((account) => (
          <Card
            key={account.id}
            size="small"
            style={{ marginBottom: 12 }}
            title={
              <Row justify="space-between" align="middle">
                <Col>
                  <Space>
                    <Badge
                      status={account.online ? 'success' : 'default'}
                      dot
                    />
                    <span style={{ fontWeight: 500 }}>
                      {account.displayName || account.username}
                    </span>
                    {getStatusTag(account.status, account.online)}
                  </Space>
                </Col>
                <Col>
                  <Dropdown menu={getActionMenu(account)} trigger={['click']}>
                    <Button type="text" icon={<MoreOutlined />} size="small" />
                  </Dropdown>
                </Col>
              </Row>
            }
          >
            <Row gutter={[16, 16]}>
              {/* 健康分数 */}
              <Col xs={24} sm={8}>
                <div style={{ textAlign: 'center' }}>
                  <Progress
                    type="circle"
                    percent={account.healthScore}
                    strokeColor={getHealthColor(account.healthScore)}
                    format={(percent) => (
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                          {percent?.toFixed(0)}
                        </div>
                        <div style={{ fontSize: 12, color: '#999' }}>健康分</div>
                      </div>
                    )}
                    size={80}
                  />
                </div>
              </Col>

              {/* 任务统计 */}
              <Col xs={24} sm={8}>
                <div>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>任务统计</div>
                  <Row gutter={[8, 8]}>
                    <Col span={8}>
                      <Statistic
                        title="总数"
                        value={account.tasks.total}
                        valueStyle={{ fontSize: 16 }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="成功"
                        value={account.tasks.completed}
                        valueStyle={{ fontSize: 16, color: '#52c41a' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="失败"
                        value={account.tasks.failed}
                        valueStyle={{ fontSize: 16, color: '#f5222d' }}
                      />
                    </Col>
                  </Row>
                </div>
              </Col>

              {/* 性能指标 */}
              <Col xs={24} sm={8}>
                <div>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>性能指标</div>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>成功率</span>
                        <span style={{ fontWeight: 500 }}>{account.metrics.successRate}%</span>
                      </div>
                      <Progress
                        percent={account.metrics.successRate}
                        size="small"
                        strokeColor={getHealthColor(account.metrics.successRate)}
                        showInfo={false}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>响应时间</span>
                        <span style={{ fontWeight: 500 }}>{account.metrics.responseTime}ms</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>可用性</span>
                        <span style={{ fontWeight: 500 }}>{account.metrics.availability}%</span>
                      </div>
                    </div>
                  </Space>
                </div>
              </Col>
            </Row>

            {/* 问题列表 */}
            {account.issues.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 8, fontWeight: 500, color: '#f5222d' }}>
                  检测到问题 ({account.issues.length})
                </div>
                <div style={{ fontSize: 12 }}>
                  {account.issues.map((issue, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: 4,
                        padding: 4,
                        backgroundColor: '#fff2f0',
                        borderRadius: 4,
                      }}
                    >
                      {getIssueSeverityTag(issue.severity)}
                      <span style={{ marginLeft: 8, flex: 1 }}>{issue.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 最后活动时间 */}
            <div style={{ marginTop: 12, fontSize: 12, color: '#999', textAlign: 'right' }}>
              最后活动: {new Date(account.lastActivity).toLocaleString()}
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
};

export default AccountHealthIndicator;