import React from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Tabs,
  Button,
  Space,
  Alert,
  Statistic,
  Progress,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  BarChartOutlined,
  LineChartOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';

import RealTimeMonitor from '../components/RealTimeMonitor';
import DashboardChart from '../components/DashboardChart';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const TaskMonitorPage: React.FC = () => {
  // 模拟数据
  const systemStats = {
    cpuUsage: 45,
    memoryUsage: 68,
    diskUsage: 32,
    networkIn: 1250,
    networkOut: 850,
  };

  const taskStats = {
    total: 156,
    running: 12,
    completed: 132,
    failed: 8,
    successRate: 92,
    avgDuration: 45,
  };

  return (
    <div className="task-monitor-page">
      {/* 页面标题和操作 */}
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Link to="/tasks">
                <Button icon={<ArrowLeftOutlined />}>
                  返回
                </Button>
              </Link>
              <Title level={2} style={{ margin: 0 }}>
                任务监控中心
              </Title>
            </Space>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">实时监控任务执行状态和系统资源使用情况。</Text>
            </div>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />}>
                刷新
              </Button>
              <Button icon={<PlayCircleOutlined />} type="primary">
                开始监控
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 系统资源统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="CPU使用率"
              value={systemStats.cpuUsage}
              suffix="%"
              valueStyle={{
                color: systemStats.cpuUsage > 80 ? '#f5222d' :
                       systemStats.cpuUsage > 60 ? '#faad14' : '#52c41a'
              }}
            />
            <Progress
              percent={systemStats.cpuUsage}
              status={
                systemStats.cpuUsage > 80 ? 'exception' :
                systemStats.cpuUsage > 60 ? 'normal' : 'success'
              }
              size="small"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="内存使用率"
              value={systemStats.memoryUsage}
              suffix="%"
              valueStyle={{
                color: systemStats.memoryUsage > 80 ? '#f5222d' :
                       systemStats.memoryUsage > 60 ? '#faad14' : '#52c41a'
              }}
            />
            <Progress
              percent={systemStats.memoryUsage}
              status={
                systemStats.memoryUsage > 80 ? 'exception' :
                systemStats.memoryUsage > 60 ? 'normal' : 'success'
              }
              size="small"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="磁盘使用率"
              value={systemStats.diskUsage}
              suffix="%"
              valueStyle={{
                color: systemStats.diskUsage > 80 ? '#f5222d' :
                       systemStats.diskUsage > 60 ? '#faad14' : '#52c41a'
              }}
            />
            <Progress
              percent={systemStats.diskUsage}
              status={
                systemStats.diskUsage > 80 ? 'exception' :
                systemStats.diskUsage > 60 ? 'normal' : 'success'
              }
              size="small"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="网络流入"
              value={systemStats.networkIn}
              suffix="KB/s"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="网络流出"
              value={systemStats.networkOut}
              suffix="KB/s"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="任务成功率"
              value={taskStats.successRate}
              suffix="%"
              valueStyle={{
                color: taskStats.successRate > 90 ? '#52c41a' :
                       taskStats.successRate > 70 ? '#faad14' : '#f5222d'
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 警告信息 */}
      {systemStats.cpuUsage > 80 && (
        <Alert
          message="CPU使用率过高"
          description="当前CPU使用率超过80%，可能会影响任务执行性能。"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {taskStats.failed > 5 && (
        <Alert
          message="任务失败率较高"
          description={`当前有 ${taskStats.failed} 个任务失败，建议检查账号状态和网络连接。`}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 标签页内容 */}
      <Tabs defaultActiveKey="realtime">
        <TabPane
          tab={
            <span>
              <PlayCircleOutlined />
              实时监控
            </span>
          }
          key="realtime"
        >
          <Card>
            <RealTimeMonitor height={600} />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <LineChartOutlined />
              性能图表
            </span>
          }
          key="charts"
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="任务执行趋势">
                <DashboardChart type="tasks" height={300} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="成功率趋势">
                <DashboardChart type="successRate" height={300} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="资源使用趋势">
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text type="secondary">资源监控图表</Text>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="账号活跃度">
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text type="secondary">账号活跃度图表</Text>
                </div>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane
          tab={
            <span>
              <BarChartOutlined />
              统计分析
            </span>
          }
          key="analysis"
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={8}>
              <Card title="任务类型分布" size="small">
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text type="secondary">饼图：任务类型分布</Text>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="执行时间分布" size="small">
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text type="secondary">柱状图：执行时间分布</Text>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="失败原因分析" size="small">
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text type="secondary">条形图：失败原因分析</Text>
                </div>
              </Card>
            </Col>
          </Row>

          <Card title="详细统计" style={{ marginTop: 16 }}>
            <Row gutter={[32, 32]}>
              <Col xs={24} sm={12} md={8}>
                <div>
                  <Text type="secondary">总任务数</Text>
                  <div>
                    <Title level={3} style={{ margin: 0 }}>{taskStats.total}</Title>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <div>
                  <Text type="secondary">平均执行时间</Text>
                  <div>
                    <Title level={3} style={{ margin: 0 }}>{taskStats.avgDuration}秒</Title>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <div>
                  <Text type="secondary">成功率</Text>
                  <div>
                    <Title level={3} style={{ margin: 0, color: taskStats.successRate > 90 ? '#52c41a' : '#faad14' }}>
                      {taskStats.successRate}%
                    </Title>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <div>
                  <Text type="secondary">进行中任务</Text>
                  <div>
                    <Title level={3} style={{ margin: 0, color: '#faad14' }}>{taskStats.running}</Title>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <div>
                  <Text type="secondary">已完成任务</Text>
                  <div>
                    <Title level={3} style={{ margin: 0, color: '#52c41a' }}>{taskStats.completed}</Title>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <div>
                  <Text type="secondary">失败任务</Text>
                  <div>
                    <Title level={3} style={{ margin: 0, color: '#f5222d' }}>{taskStats.failed}</Title>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <TableOutlined />
              历史记录
            </span>
          }
          key="history"
        >
          <Card>
            <Alert
              message="历史记录"
              description="查看过去24小时的任务执行记录和系统日志。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div style={{ textAlign: 'center', padding: 40 }}>
              <TableOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">历史记录功能开发中</Text>
              </div>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">即将支持时间范围筛选和导出功能</Text>
              </div>
            </div>
          </Card>
        </TabPane>
      </Tabs>

      {/* 操作指南 */}
      <Card title="监控指南" style={{ marginTop: 24 }} size="small">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong>实时监控</Text>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  实时显示任务执行状态、账号状态和系统日志，帮助您及时发现问题。
                </Text>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong>性能图表</Text>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  通过图表分析任务执行趋势、成功率变化和资源使用情况。
                </Text>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong>统计分析</Text>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  提供详细的数据统计和分析，帮助您优化任务配置和提高成功率。
                </Text>
              </div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default TaskMonitorPage;