import React from 'react';
import {
  Card,
  Row,
  Col,
  Progress,
  Tag,
  Statistic,
  Alert,
  Space,
  Tooltip,
  Button,
} from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  ApiOutlined,
  CloudServerOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface SystemHealthData {
  cpu: {
    usage: number;
    cores: number;
    load: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  services: Array<{
    name: string;
    status: 'running' | 'stopped' | 'warning';
    uptime: number;
    lastCheck: string;
  }>;
  alerts: Array<{
    id: string;
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
  lastUpdate: string;
}

const SystemHealthMonitor: React.FC = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.get('/dashboard/system-health').then(res => res.data),
    refetchInterval: 60000, // 每分钟刷新一次
  });

  const healthData: SystemHealthData = data || {
    cpu: { usage: 0, cores: 4, load: [0, 0, 0] },
    memory: { total: 0, used: 0, free: 0, usage: 0 },
    disk: { total: 0, used: 0, free: 0, usage: 0 },
    services: [],
    alerts: [],
    lastUpdate: new Date().toISOString(),
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (usage: number): string => {
    if (usage < 70) return '#52c41a';
    if (usage < 85) return '#faad14';
    return '#f5222d';
  };

  const getServiceStatusTag = (status: string) => {
    switch (status) {
      case 'running':
        return <Tag icon={<CheckCircleOutlined />} color="success">运行中</Tag>;
      case 'stopped':
        return <Tag icon={<WarningOutlined />} color="error">已停止</Tag>;
      case 'warning':
        return <Tag icon={<WarningOutlined />} color="warning">警告</Tag>;
      default:
        return <Tag color="default">未知</Tag>;
    }
  };

  const getAlertLevelTag = (level: string) => {
    switch (level) {
      case 'info':
        return <Tag color="blue">信息</Tag>;
      case 'warning':
        return <Tag color="orange">警告</Tag>;
      case 'error':
        return <Tag color="red">错误</Tag>;
      default:
        return <Tag color="default">未知</Tag>;
    }
  };

  if (isLoading) {
    return (
      <Card title="系统健康监控" loading>
        <div style={{ height: 200 }} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        title="系统健康监控"
        extra={
          <Button
            icon={<SyncOutlined />}
            onClick={() => refetch()}
            size="small"
          >
            重试
          </Button>
        }
      >
        <Alert
          message="无法获取系统健康数据"
          description="请检查网络连接或服务器状态"
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <DashboardOutlined />
          系统健康监控
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="最后更新">
            <span style={{ fontSize: 12, color: '#999' }}>
              {new Date(healthData.lastUpdate).toLocaleTimeString()}
            </span>
          </Tooltip>
          <Button
            icon={<SyncOutlined />}
            onClick={() => refetch()}
            size="small"
          >
            刷新
          </Button>
        </Space>
      }
    >
      {/* 资源使用情况 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card size="small" title="CPU使用率">
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="dashboard"
                percent={healthData.cpu.usage}
                strokeColor={getStatusColor(healthData.cpu.usage)}
                format={(percent) => `${percent?.toFixed(1)}%`}
              />
              <div style={{ marginTop: 8 }}>
                <Statistic
                  title="负载"
                  value={healthData.cpu.load[0]?.toFixed(2) || 0}
                  suffix={`/${healthData.cpu.cores}`}
                  valueStyle={{ fontSize: 14 }}
                />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card size="small" title="内存使用">
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="dashboard"
                percent={healthData.memory.usage}
                strokeColor={getStatusColor(healthData.memory.usage)}
                format={(percent) => `${percent?.toFixed(1)}%`}
              />
              <div style={{ marginTop: 8 }}>
                <Statistic
                  title="已用/总量"
                  value={formatBytes(healthData.memory.used)}
                  suffix={`/${formatBytes(healthData.memory.total)}`}
                  valueStyle={{ fontSize: 14 }}
                />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card size="small" title="磁盘使用">
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="dashboard"
                percent={healthData.disk.usage}
                strokeColor={getStatusColor(healthData.disk.usage)}
                format={(percent) => `${percent?.toFixed(1)}%`}
              />
              <div style={{ marginTop: 8 }}>
                <Statistic
                  title="已用/总量"
                  value={formatBytes(healthData.disk.used)}
                  suffix={`/${formatBytes(healthData.disk.total)}`}
                  valueStyle={{ fontSize: 14 }}
                />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 服务状态 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title={
              <Space>
                <CloudServerOutlined />
                服务状态
              </Space>
            }
          >
            {healthData.services.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16 }}>
                暂无服务数据
              </div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {healthData.services.map((service, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: index < healthData.services.length - 1 ? '1px solid #f0f0f0' : 'none',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>{service.name}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        最后检查: {new Date(service.lastCheck).toLocaleTimeString()}
                      </div>
                    </div>
                    <div>
                      {getServiceStatusTag(service.status)}
                      {service.uptime > 0 && (
                        <div style={{ fontSize: 12, textAlign: 'right', color: '#999' }}>
                          运行: {Math.floor(service.uptime / 3600)}h
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            size="small"
            title={
              <Space>
                <WarningOutlined />
                系统告警
              </Space>
            }
          >
            {healthData.alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: '#52c41a' }}>
                <CheckCircleOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                <div>系统运行正常</div>
              </div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {healthData.alerts.map((alert) => (
                  <Alert
                    key={alert.id}
                    message={
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                          {getAlertLevelTag(alert.level)}
                          <span style={{ marginLeft: 8, flex: 1 }}>{alert.message}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                    }
                    type={alert.level === 'error' ? 'error' : alert.level === 'warning' ? 'warning' : 'info'}
                    showIcon={false}
                    style={{ marginBottom: 8 }}
                  />
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Card>
  );
};

export default SystemHealthMonitor;