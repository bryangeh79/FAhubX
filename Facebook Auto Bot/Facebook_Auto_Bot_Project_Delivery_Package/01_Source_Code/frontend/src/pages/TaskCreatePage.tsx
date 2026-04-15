import React from 'react';
import { Card, Typography, Button, Space, Alert } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

import TaskCreateForm from '../components/task/TaskCreateForm';

const { Title, Text } = Typography;

const TaskCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const duplicateTask = location.state?.duplicateTask;

  const handleSuccess = () => {
    navigate('/tasks');
  };

  const handleCancel = () => {
    navigate('/tasks');
  };

  return (
    <div className="task-create-page">
      {/* 页面标题和操作 */}
      <div style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/tasks')}
            style={{ padding: 0 }}
          >
            返回任务列表
          </Button>
          
          <Title level={2}>
            {duplicateTask ? '复制任务' : '创建新任务'}
          </Title>
          
          <Text type="secondary">
            {duplicateTask 
              ? `基于任务"${duplicateTask.name}"创建新任务`
              : '创建新的自动化任务，配置执行计划和内容'}
          </Text>
        </Space>
      </div>

      {/* 创建表单 */}
      <Card>
        {duplicateTask && (
          <Alert
            message="复制模式"
            description="您正在基于现有任务创建新任务。可以修改所有配置，原任务不会受影响。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <TaskCreateForm
          initialValues={duplicateTask}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </Card>

      {/* 使用提示 */}
      <Card size="small" style={{ marginTop: 24 }}>
        <Space direction="vertical" size="small">
          <Text strong>使用提示:</Text>
          <Text type="secondary">• 任务创建后可以随时修改配置</Text>
          <Text type="secondary">• 建议先创建测试任务验证配置</Text>
          <Text type="secondary">• 批量任务可以使用模板功能</Text>
          <Text type="secondary">• 注意Facebook平台的频率限制</Text>
        </Space>
      </Card>
    </div>
  );
};

export default TaskCreatePage;