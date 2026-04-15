import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Steps,
  Divider,
  Alert,
  Tabs,
  Switch,
  InputNumber,
  Tag,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { TaskType, TaskPriority, AdvancedConfig } from '../../types/task';
import ScheduleSelector from './ScheduleSelector';
import ScriptSelector from './ScriptSelector';
import { tasksAPI, accountsAPI } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { Step } = Steps;
const { TabPane } = Tabs;

interface TaskCreateFormProps {
  initialValues?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const TaskCreateForm: React.FC<TaskCreateFormProps> = ({
  initialValues,
  onSuccess,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [taskType, setTaskType] = useState<TaskType>('conversation');

  // 获取账号列表
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsAPI.getAccounts().then(res => res.data),
  });

  const accounts = accountsData?.accounts || [];

  // 创建任务
  const createMutation = useMutation({
    mutationFn: (values: any) => tasksAPI.createTask(values),
    onSuccess: () => {
      message.success('任务创建成功');
      onSuccess?.();
      navigate('/tasks');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '创建失败');
    },
  });

  // 立即执行
  const executeMutation = useMutation({
    mutationFn: (values: any) => {
      const taskData = { ...values, schedule: { type: 'immediate', immediate: true } };
      return tasksAPI.createTask(taskData);
    },
    onSuccess: (data) => {
      message.success('任务已开始执行');
      // 可以跳转到任务详情页
      navigate(`/tasks/${data.data.id}`);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '执行失败');
    },
  });

  const handleTaskTypeChange = (type: TaskType) => {
    setTaskType(type);
    form.setFieldValue('type', type);
  };

  const handleAccountSelect = (accountIds: string[]) => {
    setSelectedAccounts(accountIds);
    form.setFieldValue('accountIds', accountIds);
  };

  const handleNext = () => {
    form.validateFields().then(() => {
      setCurrentStep(currentStep + 1);
    }).catch((errorInfo) => {
      console.log('验证失败:', errorInfo);
    });
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSaveAsDraft = () => {
    form.validateFields().then((values) => {
      const draftData = {
        ...values,
        status: 'paused',
        isDraft: true,
      };
      createMutation.mutate(draftData);
    });
  };

  const handleExecuteNow = () => {
    form.validateFields().then((values) => {
      executeMutation.mutate(values);
    });
  };

  const handleSubmit = (values: any) => {
    createMutation.mutate(values);
  };

  const renderBasicInfoStep = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="基本信息" size="small">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="任务名称"
              rules={[{ required: true, message: '请输入任务名称' }]}
            >
              <Input placeholder="例如: 日常问候对话" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="priority"
              label="任务优先级"
              initialValue="normal"
            >
              <Select placeholder="选择优先级">
                <Option value="low">低</Option>
                <Option value="normal">普通</Option>
                <Option value="high">高</Option>
                <Option value="urgent">紧急</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label="任务描述"
        >
          <Input.TextArea
            placeholder="描述任务的目的和内容"
            rows={3}
          />
        </Form.Item>

        <Form.Item
          name="type"
          label="任务类型"
          rules={[{ required: true, message: '请选择任务类型' }]}
        >
          <Select
            placeholder="选择任务类型"
            onChange={handleTaskTypeChange}
          >
            <Option value="conversation">对话</Option>
            <Option value="post">发帖</Option>
            <Option value="like">点赞</Option>
            <Option value="share">分享</Option>
            <Option value="comment">评论</Option>
            <Option value="message">私信</Option>
            <Option value="friend">加好友</Option>
            <Option value="group">加群组</Option>
          </Select>
        </Form.Item>
      </Card>

      <Card title="账号选择" size="small">
        <Form.Item
          name="accountIds"
          label="选择执行账号"
          rules={[{ required: true, message: '请至少选择一个账号' }]}
        >
          <Select
            mode="multiple"
            placeholder="选择1-10个Facebook账号"
            loading={accountsLoading}
            maxTagCount={3}
            onChange={handleAccountSelect}
          >
            {accounts.map((account: any) => (
              <Option key={account.id} value={account.id}>
                <Space>
                  <UserOutlined />
                  <span>{account.displayName || account.username}</span>
                  <Tag color={account.status === 'active' ? 'success' : 'warning'} size="small">
                    {account.status === 'active' ? '正常' : '异常'}
                  </Tag>
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        {selectedAccounts.length > 0 && (
          <Alert
            message={`已选择 ${selectedAccounts.length} 个账号`}
            description="任务将使用这些账号依次执行"
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    </Space>
  );

  const renderContentStep = () => {
    if (taskType === 'conversation') {
      return (
        <Card title="对话内容配置" size="small">
          <Form.Item
            name="scriptId"
            label="选择对话剧本"
            rules={[{ required: true, message: '请选择对话剧本' }]}
          >
            <ScriptSelector />
          </Form.Item>

          <Form.Item
            name="customScript"
            label="自定义剧本（可选）"
          >
            <Input.TextArea
              placeholder="如果需要自定义对话内容，可以在这里输入..."
              rows={6}
            />
          </Form.Item>

          <Alert
            message="提示"
            description="如果同时选择了剧本和自定义内容，将优先使用自定义内容。"
            type="info"
            showIcon
          />
        </Card>
      );
    }

    // 其他任务类型的配置
    return (
      <Card title="内容配置" size="small">
        <Form.Item
          name="content"
          label="内容"
          rules={[{ required: true, message: '请输入内容' }]}
        >
          <Input.TextArea
            placeholder={
              taskType === 'post' ? '输入帖子内容...' :
              taskType === 'comment' ? '输入评论内容...' :
              taskType === 'message' ? '输入私信内容...' :
              '输入内容...'
            }
            rows={4}
          />
        </Form.Item>

        {taskType === 'post' && (
          <>
            <Form.Item
              name="link"
              label="链接（可选）"
            >
              <Input placeholder="https://example.com" />
            </Form.Item>
            <Form.Item
              name="imageUrl"
              label="图片URL（可选）"
            >
              <Input placeholder="https://example.com/image.jpg" />
            </Form.Item>
          </>
        )}
      </Card>
    );
  };

  const renderScheduleStep = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Form.Item
        name="schedule"
        label="时间调度"
        rules={[{ required: true, message: '请配置时间调度' }]}
      >
        <ScheduleSelector />
      </Form.Item>

      <Card title="高级调度选项" size="small">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name={['advancedConfig', 'maxConcurrentAccounts']}
              label="最大并发数"
              initialValue={1}
            >
              <InputNumber
                min={1}
                max={10}
                style={{ width: '100%' }}
                addonAfter="个账号"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name={['advancedConfig', 'executionTimeout']}
              label="执行超时"
              initialValue={300}
            >
              <InputNumber
                min={60}
                max={3600}
                style={{ width: '100%' }}
                addonAfter="秒"
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>
    </Space>
  );

  const renderAdvancedStep = () => (
    <Card title="高级配置" size="small">
      <Tabs defaultActiveKey="retry">
        <TabPane tab="失败重试" key="retry">
          <Form.Item
            name={['advancedConfig', 'retryOnFailure']}
            label="启用失败重试"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['advancedConfig', 'maxRetries']}
                label="最大重试次数"
                initialValue={3}
              >
                <InputNumber
                  min={0}
                  max={10}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['advancedConfig', 'retryDelay']}
                label="重试间隔"
                initialValue={60}
              >
                <InputNumber
                  min={10}
                  max={3600}
                  style={{ width: '100%' }}
                  addonAfter="秒"
                />
              </Form.Item>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="通知设置" key="notifications">
          <Form.Item
            name={['advancedConfig', 'notifications', 'onSuccess']}
            label="成功时通知"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name={['advancedConfig', 'notifications', 'onFailure']}
            label="失败时通知"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name={['advancedConfig', 'notifications', 'onCompletion']}
            label="完成时通知"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name={['advancedConfig', 'notifications', 'channels']}
            label="通知渠道"
            initialValue={['email']}
          >
            <Select mode="multiple" placeholder="选择通知渠道">
              <Option value="email">邮件</Option>
              <Option value="webhook">Webhook</Option>
              <Option value="telegram">Telegram</Option>
            </Select>
          </Form.Item>
        </TabPane>

        <TabPane tab="其他设置" key="other">
          <Form.Item
            name="tags"
            label="标签"
          >
            <Select
              mode="tags"
              placeholder="添加标签（按回车确认）"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="saveAsTemplate"
            label="保存为模板"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.saveAsTemplate !== currentValues.saveAsTemplate}
          >
            {({ getFieldValue }) => {
              if (getFieldValue('saveAsTemplate')) {
                return (
                  <Form.Item
                    name="templateName"
                    label="模板名称"
                    rules={[{ required: true, message: '请输入模板名称' }]}
                  >
                    <Input placeholder="例如: 日常问候模板" />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
        </TabPane>
      </Tabs>
    </Card>
  );

  const steps = [
    {
      title: '基本信息',
      icon: <UserOutlined />,
      content: renderBasicInfoStep(),
    },
    {
      title: '内容配置',
      icon: <FileTextOutlined />,
      content: renderContentStep(),
    },
    {
      title: '时间调度',
      icon: <ClockCircleOutlined />,
      content: renderScheduleStep(),
    },
    {
      title: '高级配置',
      icon: <SettingOutlined />,
      content: renderAdvancedStep(),
    },
  ];

  return (
    <div className="task-create-form">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          ...initialValues,
          advancedConfig: {
            maxConcurrentAccounts: 1,
            retryOnFailure: true,
            maxRetries: 3,
            retryDelay: 60,
            executionTimeout: 300,
            notifications: {
              onSuccess: true,
              onFailure: true,
              onCompletion: false,
              channels: ['email'],
            },
          },
        }}
      >
        {/* 步骤指示器 */}
        <Card style={{ marginBottom: 24 }}>
          <Steps current={currentStep} size="small">
            {steps.map((step, index) => (
              <Step key={index} title={step.title} icon={step.icon} />
            ))}
          </Steps>
        </Card>

        {/* 当前步骤内容 */}
        <div style={{ marginBottom: 24 }}>
          {steps[currentStep].content}
        </div>

        {/* 导航按钮 */}
        <div style={{ textAlign: 'center' }}>
          <Space size="large">
            {currentStep > 0 && (
              <Button onClick={handlePrev} icon={<ArrowLeftOutlined />}>
                上一步
              </Button>
            )}

            {currentStep < steps.length - 1 ? (
              <Button type="primary" onClick={handleNext} icon={<ArrowRightOutlined />}>
                下一步
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSaveAsDraft}
                  loading={createMutation.isPending}
                  icon={<SaveOutlined />}
                >
                  保存为草稿
                </Button>
                <Button
                  type="primary"
                  onClick={handleExecuteNow}
                  loading={executeMutation.isPending}
                  icon={<PlayCircleOutlined />}
                >
                  立即执行
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={createMutation.isPending}
                >
                  创建任务
                </Button>
              </>
            )}

            {onCancel && (
              <Button onClick={onCancel}>
                取消
              </Button>
            )}
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default TaskCreateForm;