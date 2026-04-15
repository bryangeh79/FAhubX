import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Button,
  Space,
  Statistic,
  Timeline,
  List,
  Descriptions,
  Tabs,
  Table,
  Progress,
  Alert,
  Modal,
  message,
  Badge,
  Tooltip,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  RedoOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  HistoryOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import { Task, ExecutionLog } from '../../types/task';
import { tasksAPI } from '../../services/api';
import { formatDate } from '../../utils/formatters';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const TaskDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // 获取任务详情
  const { data: taskData, isLoading: taskLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksAPI.getTask(id!).then(res => res.data),
    enabled: !!id,
  });

  // 获取任务执行历史
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['taskHistory', id],
    queryFn: () => tasksAPI.getTaskHistory(id!).then(res => res.data),
    enabled: !!id,
  });

  const task: Task = taskData?.task;
  const executionHistory: ExecutionLog[] = historyData?.history || [];

  // 更新任务状态
  const statusMutation = useMutation({
    mutationFn: (status: string) => tasksAPI.updateTaskStatus(id!, status),
    onSuccess: () => {
      message.success('状态更新成功');
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '状态更新失败');
    },
  });

  // 立即执行任务
  const executeMutation = useMutation({
    mutationFn: () => tasksAPI.executeTask(id!),
    onSuccess: () => {
      message.success('任务已开始执行');
      queryClient.invalidateQueries({ queryKey: ['task', id] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '执行失败');
    },
  });

  // 删除任务
  const deleteMutation = useMutation({
    mutationFn: () => tasksAPI.deleteTask(id!),
    onSuccess: () => {
      message.success('任务删除成功');
      navigate('/tasks');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '删除失败');
    },
  });

  const handleStatusChange = (newStatus: string) => {
    Modal.confirm({
      title: '确认操作',
      content: `确定要将任务状态改为"${newStatus}"吗？`,
      onOk: () => statusMutation.mutate(newStatus),
    });
  };

  const handleExecute = () => {
    executeMutation.mutate();
  };

  const handleDelete = () => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个任务吗？删除后无法恢复。',
      okText: '删除',
      okType: 'danger',
      onOk: () => deleteMutation.mutate(),
    });
  };

  const handleDuplicate = () => {
    navigate('/tasks/create', {
      state: { duplicateTask: task },
    });
  };

  const handleEdit = () => {
    navigate(`/tasks/${id}/edit`);
  };

  const renderStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      pending: { color: 'default', text: '等待中', icon: <ClockCircleOutlined /> },
      running: { color: 'processing', text: '运行中', icon: <PlayCircleOutlined /> },
      completed: { color: 'success', text: '已完成', icon: <CheckCircleOutlined /> },
      failed: { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
      paused: { color: 'warning', text: '已暂停', icon: <PauseCircleOutlined /> },
      cancelled: { color: 'default', text: '已取消', icon: <StopOutlined /> },
    };
    const config = statusConfig[status] || { color: 'default', text: '未知', icon: null };
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const renderPriorityTag = (priority: string) => {
    const priorityConfig: Record<string, { color: string; text: string }> = {
      low: { color: 'default', text: '低' },
      normal: { color: 'blue', text: '普通' },
      high: { color: 'orange', text: '高' },
      urgent: { color: 'red', text: '紧急' },
    };
    const config = priorityConfig[priority] || { color: 'default', text: '未知' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const renderTaskTypeTag = (type: string) => {
    const typeConfig: Record<string, { color: string; text: string }> = {
      conversation: { color: 'blue', text: '对话' },
      post: { color: 'green', text: '发帖' },
      like: { color: 'purple', text: '点赞' },
      share: { color: 'orange', text: '分享' },
      comment: { color: 'cyan', text: '评论' },
      message: { color: 'magenta', text: '私信' },
      friend: { color: 'gold', text: '加好友' },
      group: { color: 'geekblue', text: '加群组' },
    };
    const config = typeConfig[type] || { color: 'default', text: '未知' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const renderScheduleInfo = () => {
    if (!task?.schedule) return null;

    const { schedule } = task;
    
    switch (schedule.type) {
      case 'immediate':
        return <Text>立即执行</Text>;
      case 'scheduled':
        return (
          <Space direction="vertical" size={2}>
            <Text>定时执行</Text>
            <Text type="secondary">
              时间: {dayjs(schedule.scheduledAt).format('YYYY-MM-DD HH:mm')}
            </Text>
          </Space>
        );
      case 'recurring':
        const recurring = schedule.recurring;
        return (
          <Space direction="vertical" size={2}>
            <Text>重复执行</Text>
            <Text type="secondary">
              频率: {recurring?.frequency === 'daily' ? '每天' :
                   recurring?.frequency === 'weekly' ? '每周' :
                   recurring?.frequency === 'monthly' ? '每月' : '自定义'}
            </Text>
            {recurring?.timeOfDay && (
              <Text type="secondary">时间: {recurring.timeOfDay}</Text>
            )}
          </Space>
        );
      case 'cron':
        return (
          <Space direction="vertical" size={2}>
            <Text>Cron表达式</Text>
            <Text type="secondary}>{schedule.cronExpression}</Text>
          </Space>
        );
      default:
        return null;
    }
  };

  const renderExecutionStats = () => {
    if (!task?.executionStats) return null;

    const stats = task.executionStats;
    const successRate = stats.totalExecutions > 0 
      ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
      : 0;

    return (
      <Row gutter={16}>
        <Col span={6}>
          <Statistic
            title="总执行次数"
            value={stats.totalExecutions}
            prefix={<HistoryOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="成功次数"
            value={stats.successfulExecutions}
            valueStyle={{ color: '#3f8600' }}
            prefix={<CheckCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="失败次数"
            value={stats.failedExecutions}
            valueStyle={{ color: '#cf1322' }}
            prefix={<CloseCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="成功率"
            value={successRate}
            suffix="%"
            valueStyle={{ color: successRate >= 90 ? '#3f8600' : successRate >= 70 ? '#faad14' : '#cf1322' }}
            prefix={<BarChartOutlined />}
          />
        </Col>
      </Row>
    );
  };

  const renderExecutionHistory = () => {
    const columns = [
      {
        title: '执行时间',
        dataIndex: 'startedAt',
        key: 'startedAt',
        render: (date: string) => formatDate(date, 'YYYY-MM-DD HH:mm:ss'),
      },
      {
        title: '账号',
        key: 'account',
        render: (_: any, record: ExecutionLog) => (
          <Text>{record.accountId}</Text>
        ),
      },
      {
        title: '状态',
        key: 'status',
        render: (_: any, record: ExecutionLog) => {
          const statusConfig: Record<string, { color: string; text: string }> = {
            success: { color: 'success', text: '成功' },
            failure: { color: 'error', text: '失败' },
            partial: { color: 'warning', text: '部分成功' },
          };
          const config = statusConfig[record.status] || { color: 'default', text: '未知' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: '持续时间',
        key: 'duration',
        render: (_: any, record: ExecutionLog) => (
          <Text>{record.duration ? `${record.duration}秒` : '-'}</Text>
        ),
      },
      {
        title: '操作',
        key: 'action',
        render: (_: any, record: ExecutionLog) => (
          <Space size="small">
            <Tooltip title="查看详情">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  Modal.info({
                    title: '执行详情',
                    width: 800,
                    content: (
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Descriptions column={2} size="small">
                          <Descriptions.Item label="执行ID">{record.id}</Descriptions.Item>
                          <Descriptions.Item label="任务ID">{record.taskId}</Descriptions.Item>
                          <Descriptions.Item label="账号ID">{record.accountId}</Descriptions.Item>
                          <Descriptions.Item label="状态">{record.status}</Descriptions.Item>
                          <Descriptions.Item label="开始时间">
                            {formatDate(record.startedAt, 'YYYY-MM-DD HH:mm:ss')}
                          </Descriptions.Item>
                          <Descriptions.Item label="结束时间">
                            {record.completedAt ? formatDate(record.completedAt, 'YYYY-MM-DD HH:mm:ss') : '-'}
                          </Descriptions.Item>
                          <Descriptions.Item label="持续时间">
                            {record.duration ? `${record.duration}秒` : '-'}
                          </Descriptions.Item>
                        </Descriptions>
                        
                        {record.error && (
                          <>
                            <Text strong>错误信息:</Text>
                            <Alert
                              message={record.error}
                              type="error"
                              showIcon
                            />
                          </>
                        )}
                        
                        {record.result && (
                          <>
                            <Text strong>执行结果:</Text>
                            <pre style={{ 
                              backgroundColor: '#f6f6f6', 
                              padding: 12, 
                              borderRadius: 4,
                              maxHeight: 200,
                              overflow: 'auto'
                            }}>
                              {JSON.stringify(record.result, null, 2)}
                            </pre>
                          </>
                        )}
                        
                        {record.logs && record.logs.length > 0 && (
                          <>
                            <Text strong>执行日志:</Text>
                            <List
                              size="small"
                              dataSource={record.logs}
                              renderItem={(log, index) => (
                                <List.Item>
                                  <Text code style={{ fontSize: 12 }}>
                                    {log}
                                  </Text>
                                </List.Item>
                              )}
                            />
                          </>
                        )}
                      </Space>
                    ),
                  });
                }}
              />
            </Tooltip>
          </Space>
        ),
      },
    ];

    return (
      <Table
        columns={columns}
        dataSource={executionHistory}
        rowKey="id"
        loading={historyLoading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />
    );
  };

  if (taskLoading) {
    return <div>加载中...</div>;
  }

  if (!task) {
    return (
      <Alert
        message="任务不存在"
        description="请求的任务不存在或已被删除。"
        type="error"
        showIcon
        action={
          <Button type="primary" onClick={() => navigate('/tasks')}>
            返回任务列表
          </Button>
        }
      />
    );
  }

  return (
    <div className="task-detail">
      {/* 页面标题和操作 */}
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space direction="vertical" size={2}>
              <Title level={2}>{task.name}</Title>
              <Space>
                {renderStatusTag(task.status)}
                {renderPriorityTag(task.priority)}
                {renderTaskTypeTag(task.type)}
                <Text type="secondary">ID: {task.id}</Text>
              </Space>
            </Space>
          </Col>
          <Col>
            <Space>
              {task.status === 'pending' || task.status === 'paused' ? (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleStatusChange('running')}
                  loading={statusMutation.isPending}
                >
                  启动
                </Button>
              ) : task.status === 'running' ? (
                <Button
                  icon={<PauseCircleOutlined />}
                  onClick={() => handleStatusChange('paused')}
                  loading={statusMutation.isPending}
                >
                  暂停
                </Button>
              ) : null}

              <Button
                icon={<StopOutlined />}
                onClick={() => handleStatusChange('cancelled')}
                loading={statusMutation.isPending}
              >
                停止
              </Button>

              <Button
                icon={<RedoOutlined />}
                onClick={handleExecute}
                loading={executeMutation.isPending}
              >
                立即执行
              </Button>

              <Button
                icon={<EditOutlined />}
                onClick={handleEdit}
              >
                编辑
              </Button>

              <Button
                icon={<CopyOutlined />}
                onClick={handleDuplicate}
              >
                复制
              </Button>

              <Button
                icon={<DeleteOutlined />}
                danger
                onClick={handleDelete}
                loading={deleteMutation.isPending}
              >
                删除
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 任务详情标签页 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="概览" key="overview" />
          <TabPane tab="执行历史" key="history" />
          <TabPane tab="配置详情" key="config" />
          <TabPane tab="实时日志" key="logs" />
        </Tabs>

        {activeTab === 'overview' && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 任务描述 */}
            {task.description && (
              <Card size="small" title="任务描述">
                <Paragraph>{task.description}</Paragraph>
              </Card>
            )}

            {/* 执行统计 */}
            <Card size="small" title="执行统计">
              {renderExecutionStats()}
            </Card>

            {/* 基本信息 */}
            <Card size="small" title="基本信息">
              <Descriptions column={2}>
                <Descriptions.Item label="任务类型">
                  {renderTaskTypeTag(task.type)}
                </Descriptions.Item>
                <Descriptions.Item label="优先级">
                  {renderPriorityTag(task.priority)}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  {renderStatusTag(task.status)}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {formatDate(task.createdAt, 'YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {formatDate(task.updatedAt, 'YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="创建者">
                  {task.createdBy}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 调度信息 */}
            <Card size="small" title="调度信息">
              <Descriptions column={2}>
                <Descriptions.Item label="调度类型">
                  {renderScheduleInfo()}
                </Descriptions.Item>
                <Descriptions.Item label="下次执行">
                  {task.executionStats.nextExecution ? (
                    <Text>
                      {formatDate(task.executionStats.nextExecution, 'YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  ) : (
                    <Text type="secondary">无</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="上次执行">
                  {task.executionStats.lastExecution ? (
                    <Text>
                      {formatDate(task.executionStats.lastExecution, 'YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  ) : (
                    <Text type="secondary">从未执行</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="平均执行时间">
                  {task.executionStats.averageDuration ? (
                    <Text>{task.executionStats.averageDuration.toFixed(2)}秒</Text>
                  ) : (
                    <Text type="secondary">-</Text>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 账号信息 */}
            <Card size="small" title="执行账号">
              <Space wrap>
                {task.accounts?.map(account => (
                  <Badge
                    key={account.id}
                    status={account.status === 'active' ? 'success' : 'error'}
                    text={account.displayName || account.username}
                  />
                )) || (
                  <Text type="secondary">无账号信息</Text>
                )}
              </Space>
            </Card>

            {/* 高级配置 */}
            <Card size="small" title="高级配置">
              <Descriptions column={2}>
                <Descriptions.Item label="最大并发数">
                  {task.advancedConfig?.maxConcurrentAccounts || 1}
                </Descriptions.Item>
                <Descriptions.Item label="失败重试">
                  {task.advancedConfig?.retryOnFailure ? '启用' : '禁用'}
                </Descriptions.Item>
                <Descriptions.Item label="最大重试次数">
                  {task.advancedConfig?.maxRetries || 0}
                </Descriptions.Item>
                <Descriptions.Item label="重试间隔">
                  {task.advancedConfig?.retryDelay || 0}秒
                </Descriptions.Item>
                <Descriptions.Item label="执行超时">
                  {task.advancedConfig?.executionTimeout || 300}秒
                </Descriptions.Item>
                <Descriptions.Item label="通知设置">
                  {task.advancedConfig?.notifications ? (
                    <Space direction="vertical" size={2}>
                      <Text>成功: {task.advancedConfig.notifications.onSuccess ? '是' : '否'}</Text>
                      <Text>失败: {task.advancedConfig.notifications.onFailure ? '是' : '否'}</Text>
                      <Text>完成: {task.advancedConfig.notifications.onCompletion ? '是' : '否'}</Text>
                    </Space>
                  ) : (
                    <Text type="secondary">无</Text>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>
        )}

        {activeTab === 'history' && (
          <Card size="small">
            {renderExecutionHistory()}
          </Card>
        )}

        {activeTab === 'config' && (
          <Card size="small">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* 任务配置详情 */}
              <Descriptions title="任务配置" column={1} bordered>
                <Descriptions.Item label="任务ID">{task.id}</Descriptions.Item>
                <Descriptions.Item label="任务名称">{task.name}</Descriptions.Item>
                <Descriptions.Item label="任务描述">{task.description || '-'}</Descriptions.Item>
                <Descriptions.Item label="任务类型">{task.type}</Descriptions.Item>
                <Descriptions.Item label="优先级">{task.priority}</Descriptions.Item>
                <Descriptions.Item label="账号ID列表">
                  {task.accountIds?.join(', ') || '-'}
                </Descriptions.Item>
                {task.scriptId && (
                  <Descriptions.Item label="对话剧本ID">
                    {task.scriptId}
                  </Descriptions.Item>
                )}
                {task.customScript && (
                  <Descriptions.Item label="自定义剧本">
                    <pre style={{ margin: 0, maxHeight: 200, overflow: 'auto' }}>
                      {task.customScript}
                    </pre>
                  </Descriptions.Item>
                )}
              </Descriptions>

              {/* 调度配置详情 */}
              <Descriptions title="调度配置" column={1} bordered>
                <Descriptions.Item label="调度类型">{task.schedule.type}</Descriptions.Item>
                {task.schedule.scheduledAt && (
                  <Descriptions.Item label="执行时间">
                    {dayjs(task.schedule.scheduledAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                )}
                {task.schedule.cronExpression && (
                  <Descriptions.Item label="Cron表达式">
                    {task.schedule.cronExpression}
                  </Descriptions.Item>
                )}
                {task.schedule.recurring && (
                  <>
                    <Descriptions.Item label="执行频率">
                      {task.schedule.recurring.frequency}
                    </Descriptions.Item>
                    {task.schedule.recurring.timeOfDay && (
                      <Descriptions.Item label="执行时间">
                        {task.schedule.recurring.timeOfDay}
                      </Descriptions.Item>
                    )}
                    {task.schedule.recurring.daysOfWeek && (
                      <Descriptions.Item label="每周执行日">
                        {task.schedule.recurring.daysOfWeek.join(', ')}
                      </Descriptions.Item>
                    )}
                    {task.schedule.recurring.daysOfMonth && (
                      <Descriptions.Item label="每月执行日">
                        {task.schedule.recurring.daysOfMonth.join(', ')}
                      </Descriptions.Item>
                    )}
                  </>
                )}
              </Descriptions>
            </Space>
          </Card>
        )}

        {activeTab === 'logs' && (
          <Card size="small">
            <Alert
              message="实时日志功能"
              description="实时日志功能正在开发中，将显示任务的实时执行日志。"
              type="info"
              showIcon
            />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                实时日志将显示任务的执行过程、错误信息和调试信息。
              </Text>
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
};

export default TaskDetail;
