import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Progress,
  Timeline,
  Space,
  Typography,
  Tag,
  Button,
  Select,
  DatePicker,
  Alert,
  Spin,
} from 'antd';
import {
  DashboardOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LineChartOutlined,
  ReloadOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { TaskMonitorData, ExecutionLog } from '../../types/task';
import { tasksAPI } from '../../services/api';
import { formatDate } from '../../utils/formatters';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const TaskMonitor: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('day'),
    dayjs().endOf('day'),
  ]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 获取监控数据
  const { data: monitorData, isLoading, refetch } = useQuery({
    queryKey: ['taskMonitor', timeRange, dateRange],
    queryFn: () => tasksAPI.getTasks({
      monitor: true,
      timeRange,
      startDate: dateRange[0].toISOString(),
      endDate: dateRange[1].toISOString(),
    }).then(res => res.data),
    refetchInterval: autoRefresh ? 10000 : false, // 10秒自动刷新
  });

  const monitor: TaskMonitorData = monitorData?.monitor || {
    activeTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalExecutions: 0,
    successRate: 0,
    averageExecutionTime: 0,
    recentExecutions: [],
    performanceByHour: [],
  };

  // 处理时间范围变化
  const handleTimeRangeChange = (value: 'today' | 'week' | 'month' | 'custom') => {
    setTimeRange(value);
    
    switch (value) {
      case 'today':
        setDateRange([dayjs().startOf('day'), dayjs().endOf('day')]);
        break;
      case 'week':
        setDateRange([dayjs().startOf('week'), dayjs().endOf('week')]);
        break;
      case 'month':
        setDateRange([dayjs().startOf('month'), dayjs().endOf('month')]);
        break;
      // custom 保持不变
    }
  };

  // 处理日期范围变化
  const handleDateRangeChange = (dates: any) => {
    if (dates) {
      setDateRange(dates);
      setTimeRange('custom');
    }
  };

  // 性能数据图表
  const performanceData = monitor.performanceByHour.map(item => ({
    hour: `${item.hour}:00`,
    执行次数: item.executions,
    成功率: item.successRate,
  }));

  // 任务状态分布数据
  const taskStatusData = [
    { name: '活跃', value: monitor.activeTasks, color: '#52c41a' },
    { name: '等待', value: monitor.pendingTasks, color: '#1890ff' },
    { name: '完成', value: monitor.completedTasks, color: '#722ed1' },
    { name: '失败', value: monitor.failedTasks, color: '#f5222d' },
  ];

  // 最近执行记录
  const recentExecutions = monitor.recentExecutions.slice(0, 10);

  const columns = [
    {
      title: '任务',
      key: 'task',
      render: (_: any, record: ExecutionLog) => (
        <Text strong>{record.taskId.substring(0, 8)}...</Text>
      ),
    },
    {
      title: '账号',
      key: 'account',
      render: (_: any, record: ExecutionLog) => (
        <Text>{record.accountId.substring(0, 8)}...</Text>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: ExecutionLog) => {
        const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
          success: { color: 'success', text: '成功', icon: <CheckCircleOutlined /> },
          failure: { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
          partial: { color: 'warning', text: '部分成功', icon: <ClockCircleOutlined /> },
        };
        const config = statusConfig[record.status] || { color: 'default', text: '未知', icon: null };
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (date: string) => formatDate(date, 'HH:mm:ss'),
    },
    {
      title: '持续时间',
      key: 'duration',
      render: (_: any, record: ExecutionLog) => (
        <Text>{record.duration ? `${record.duration}s` : '-'}</Text>
      ),
    },
  ];

  // 系统健康状态
  const systemHealth = monitor.successRate >= 90 ? 'healthy' :
                      monitor.successRate >= 70 ? 'warning' : 'critical';

  return (
    <div className="task-monitor">
      {/* 标题和控制栏 */}
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>
              <DashboardOutlined /> 任务监控
            </Title>
            <Text type="secondary">实时监控任务执行状态和性能指标</Text>
          </Col>
          <Col>
            <Space>
              <Select
                value={timeRange}
                onChange={handleTimeRangeChange}
                style={{ width: 120 }}
                suffixIcon={<FilterOutlined />}
              >
                <Option value="today">今天</Option>
                <Option value="week">本周</Option>
                <Option value="month">本月</Option>
                <Option value="custom">自定义</Option>
              </Select>

              <RangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                showTime
                format="YYYY-MM-DD HH:mm"
              />

              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetch()}
                loading={isLoading}
              >
                刷新
              </Button>

              <Button
                type={autoRefresh ? 'primary' : 'default'}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? '停止自动刷新' : '开启自动刷新'}
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 系统健康状态 */}
      <Alert
        message={
          systemHealth === 'healthy' ? '系统运行正常' :
          systemHealth === 'warning' ? '系统运行警告' : '系统运行异常'
        }
        description={
          systemHealth === 'healthy' ? '所有任务运行正常，成功率较高。' :
          systemHealth === 'warning' ? '部分任务执行失败，建议检查配置。' :
          '多个任务执行失败，需要立即处理。'
        }
        type={
          systemHealth === 'healthy' ? 'success' :
          systemHealth === 'warning' ? 'warning' : 'error'
        }
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* 关键指标 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃任务"
              value={monitor.activeTasks}
              valueStyle={{ color: '#52c41a' }}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="等待任务"
              value={monitor.pendingTasks}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总执行次数"
              value={monitor.totalExecutions}
              prefix={<LineChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功率"
              value={monitor.successRate}
              suffix="%"
              valueStyle={{
                color: monitor.successRate >= 90 ? '#52c41a' :
                       monitor.successRate >= 70 ? '#faad14' : '#f5222d'
              }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="任务执行趋势" size="small">
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="执行次数"
                    stroke="#1890ff"
                    activeDot={{ r: 8 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="成功率"
                    stroke="#52c41a"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="任务状态分布" size="small">
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 性能指标 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card title="平均执行时间" size="small">
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Progress
                type="dashboard"
                percent={Math.min(100, monitor.averageExecutionTime / 10)}
                format={() => `${monitor.averageExecutionTime.toFixed(2)}秒`}
                strokeColor={
                  monitor.averageExecutionTime < 5 ? '#52c41a' :
                  monitor.averageExecutionTime < 10 ? '#faad14' : '#f5222d'
                }
              />
              <Text type="secondary" style={{ marginTop: 16, display: 'block' }}>
                平均每个任务的执行时间
              </Text>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="失败任务分析" size="small">
            <div style={{ padding: 20 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>失败任务数: </Text>
                  <Text type="danger">{monitor.failedTasks}</Text>
                </div>
                <div>
                  <Text strong>失败率: </Text>
                  <Text type="danger">
                    {monitor.totalExecutions > 0
                      ? ((monitor.failedTasks / monitor.totalExecutions) * 100).toFixed(2)
                      : 0}%
                  </Text>
                </div>
                <div>
                  <Text strong>主要失败原因:</Text>
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    <li><Text type="secondary">网络连接问题</Text></li>
                    <li><Text type="secondary">账号认证失败</Text></li>
                    <li><Text type="secondary">API限制</Text></li>
                    <li><Text type="secondary">内容违规</Text></li>
                  </ul>
                </div>
              </Space>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="实时活动" size="small">
            <div style={{ height: 300, overflow: 'auto' }}>
              <Timeline>
                {recentExecutions.map((execution, index) => (
                  <Timeline.Item
                    key={index}
                    color={
                      execution.status === 'success' ? 'green' :
                      execution.status === 'failure' ? 'red' : 'orange'
                    }
                  >
                    <Space direction="vertical" size={2}>
                      <Text strong style={{ fontSize: 12 }}>
                        {execution.taskId.substring(0, 8)}...
                      </Text>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {formatDate(execution.startedAt, 'HH:mm:ss')}
                      </Text>
                      <Text style={{ fontSize: 10 }}>
                        状态: {execution.status === 'success' ? '成功' :
                              execution.status === 'failure' ? '失败' : '部分成功'}
                      </Text>
                    </Space>
                  </Timeline.Item>
                ))}
              </Timeline>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 最近执行记录 */}
      <Card title="最近执行记录" size="small">
        <Table
          columns={columns}
          dataSource={recentExecutions}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      {/* 性能建议 */}
      <Card
        title="性能优化建议"
        size="small"
        style={{ marginTop: 24 }}
      >
        <Row gutter={16}>
          <Col span={8}>
            <Alert
              message="并发控制"
              description="建议根据账号质量调整并发数，避免触发频率限制。"
              type="info"
              showIcon
            />
          </Col>
          <Col span={8}>
            <Alert
              message="失败重试"
              description="启用失败重试功能，提高任务成功率。"
              type="info"
              showIcon
            />
          </Col>
          <Col span={8}>
            <Alert
              message="时间调度"
              description="避免在高峰时段执行大量任务，分散执行时间。"
              type="info"
              showIcon
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default TaskMonitor;