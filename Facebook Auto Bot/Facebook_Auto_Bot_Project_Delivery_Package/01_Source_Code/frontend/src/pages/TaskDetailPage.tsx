import React from 'react';
import { Card, Typography, Button, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import TaskDetail from '../components/task/TaskDetail';

const { Title } = Typography;

const TaskDetailPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="task-detail-page">
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
          
          <Title level={2}>任务详情</Title>
        </Space>
      </div>

      {/* 任务详情组件 */}
      <Card>
        <TaskDetail />
      </Card>
    </div>
  );
};

export default TaskDetailPage;