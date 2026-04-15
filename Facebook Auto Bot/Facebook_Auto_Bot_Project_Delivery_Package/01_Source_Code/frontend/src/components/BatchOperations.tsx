import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Select,
  message,
  Progress,
  Alert,
  Table,
  Tag,
  Popconfirm,
  Tooltip,
  Badge,
} from 'antd';
import {
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ExportOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, accountsAPI } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface Account {
  id: string;
  username: string;
  displayName: string;
  status: 'active' | 'disabled' | 'banned' | 'suspended';
}

interface BatchOperationsProps {
  selectedAccounts: string[];
  accounts: Account[];
  onSelectionChange: (selectedIds: string[]) => void;
}

interface BatchOperation {
  id: string;
  type: 'start' | 'pause' | 'delete' | 'export' | 'test';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  completed: number;
  failed: number;
  startTime?: string;
  endTime?: string;
}

const BatchOperations: React.FC<BatchOperationsProps> = ({
  selectedAccounts,
  accounts,
  onSelectionChange,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [operationType, setOperationType] = useState<string>('');
  const [operations, setOperations] = useState<BatchOperation[]>([]);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const selectedCount = selectedAccounts.length;
  const selectedAccountsData = accounts.filter(account => 
    selectedAccounts.includes(account.id)
  );

  // 批量操作状态
  const batchStartMutation = useMutation({
    mutationFn: (ids: string[]) => 
      api.post('/facebook-accounts/batch/start', { ids }),
    onSuccess: () => {
      message.success('批量启动成功');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '批量启动失败');
    },
  });

  const batchPauseMutation = useMutation({
    mutationFn: (ids: string[]) => 
      api.post('/facebook-accounts/batch/pause', { ids }),
    onSuccess: () => {
      message.success('批量暂停成功');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '批量暂停失败');
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => 
      api.post('/facebook-accounts/batch/delete', { ids }),
    onSuccess: () => {
      message.success('批量删除成功');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onSelectionChange([]);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '批量删除失败');
    },
  });

  const batchTestMutation = useMutation({
    mutationFn: (ids: string[]) => 
      api.post('/facebook-accounts/batch/test-connection', { ids }),
    onSuccess: () => {
      message.success('批量测试成功');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '批量测试失败');
    },
  });

  // 处理批量操作
  const handleBatchOperation = (type: string) => {
    if (selectedCount === 0) {
      message.warning('请先选择要操作的账号');
      return;
    }

    setOperationType(type);
    
    if (type === 'delete') {
      // 删除操作需要确认
      Modal.confirm({
        title: '确认批量删除',
        content: (
          <div>
            <Alert
              message="警告"
              description={`确定要删除选中的 ${selectedCount} 个账号吗？此操作不可恢复。`}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Text type="secondary">选中的账号：</Text>
            <div style={{ marginTop: 8, maxHeight: 200, overflow: 'auto' }}>
              {selectedAccountsData.map(account => (
                <Tag key={account.id} style={{ margin: 2 }}>
                  {account.displayName || account.username}
                </Tag>
              ))}
            </div>
          </div>
        ),
        okText: '确认删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => {
          batchDeleteMutation.mutate(selectedAccounts);
        },
      });
    } else {
      // 其他操作直接执行
      setModalVisible(true);
      
      // 创建操作记录
      const operationId = `batch-${type}-${Date.now()}`;
      const newOperation: BatchOperation = {
        id: operationId,
        type: type as any,
        status: 'running',
        progress: 0,
        total: selectedCount,
        completed: 0,
        failed: 0,
        startTime: new Date().toISOString(),
      };
      
      setOperations([newOperation, ...operations.slice(0, 4)]);
      
      // 执行批量操作
      switch (type) {
        case 'start':
          batchStartMutation.mutate(selectedAccounts);
          break;
        case 'pause':
          batchPauseMutation.mutate(selectedAccounts);
          break;
        case 'test':
          batchTestMutation.mutate(selectedAccounts);
          break;
      }
      
      // 模拟进度更新
      simulateProgress(operationId, selectedCount);
    }
  };

  // 模拟操作进度
  const simulateProgress = (operationId: string, total: number) => {
    let progress = 0;
    let completed = 0;
    let failed = 0;
    
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress > 100) progress = 100;
      
      completed = Math.floor((progress / 100) * total * 0.9);
      failed = Math.floor((progress / 100) * total * 0.1);
      
      setOperations(prev => prev.map(op => {
        if (op.id === operationId) {
          return {
            ...op,
            progress: Math.min(progress, 100),
            completed,
            failed,
            status: progress >= 100 ? 'completed' : 'running',
            endTime: progress >= 100 ? new Date().toISOString() : op.endTime,
          };
        }
        return op;
      }));
      
      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 500);
  };

  // 导出账号信息
  const handleExport = () => {
    if (selectedCount === 0) {
      message.warning('请先选择要导出的账号');
      return;
    }

    // 创建导出数据
    const exportData = selectedAccountsData.map(account => ({
      用户名: account.username,
      显示名称: account.displayName,
      状态: account.status === 'active' ? '活跃' : 
            account.status === 'disabled' ? '禁用' :
            account.status === 'banned' ? '封禁' : '暂停',
    }));

    // 转换为CSV
    const headers = Object.keys(exportData[0]).join(',');
    const rows = exportData.map(row => Object.values(row).join(','));
    const csvContent = [headers, ...rows].join('\n');

    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `facebook-accounts-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success(`成功导出 ${selectedCount} 个账号信息`);
  };

  // 操作状态标签
  const renderOperationStatus = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string; icon?: React.ReactNode }> = {
      pending: { color: 'default', text: '等待中' },
      running: { color: 'processing', text: '进行中', icon: <SyncOutlined spin /> },
      completed: { color: 'success', text: '已完成', icon: <CheckCircleOutlined /> },
      failed: { color: 'error', text: '失败', icon: <WarningOutlined /> },
    };
    const config = statusConfig[status] || { color: 'default', text: '未知' };
    return (
      <Tag icon={config.icon} color={config.color}>
        {config.text}
      </Tag>
    );
  };

  // 操作类型标签
  const renderOperationType = (type: string) => {
    const typeConfig: Record<string, { color: string; text: string; icon?: React.ReactNode }> = {
      start: { color: 'success', text: '启动', icon: <PlayCircleOutlined /> },
      pause: { color: 'warning', text: '暂停', icon: <PauseCircleOutlined /> },
      delete: { color: 'error', text: '删除', icon: <DeleteOutlined /> },
      export: { color: 'blue', text: '导出', icon: <ExportOutlined /> },
      test: { color: 'cyan', text: '测试', icon: <SyncOutlined /> },
    };
    const config = typeConfig[type] || { color: 'default', text: '未知' };
    return (
      <Tag icon={config.icon} color={config.color}>
        {config.text}
      </Tag>
    );
  };

  return (
    <div className="batch-operations">
      {/* 批量操作工具栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Text strong>已选择 {selectedCount} 个账号</Text>
              {selectedCount > 0 && (
                <Button type="link" onClick={() => onSelectionChange([])}>
                  取消选择
                </Button>
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              <Tooltip title="批量启动">
                <Button
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleBatchOperation('start')}
                  disabled={selectedCount === 0}
                >
                  启动
                </Button>
              </Tooltip>
              <Tooltip title="批量暂停">
                <Button
                  icon={<PauseCircleOutlined />}
                  onClick={() => handleBatchOperation('pause')}
                  disabled={selectedCount === 0}
                >
                  暂停
                </Button>
              </Tooltip>
              <Tooltip title="批量测试连接">
                <Button
                  icon={<SyncOutlined />}
                  onClick={() => handleBatchOperation('test')}
                  disabled={selectedCount === 0}
                >
                  测试
                </Button>
              </Tooltip>
              <Tooltip title="批量导出">
                <Button
                  icon={<ExportOutlined />}
                  onClick={handleExport}
                  disabled={selectedCount === 0}
                >
                  导出
                </Button>
              </Tooltip>
              <Tooltip title="批量删除">
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => handleBatchOperation('delete')}
                  disabled={selectedCount === 0}
                >
                  删除
                </Button>
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 选中的账号列表 */}
      {selectedCount > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Title level={5} style={{ marginBottom: 12 }}>
            选中的账号 ({selectedCount})
          </Title>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            <Row gutter={[8, 8]}>
              {selectedAccountsData.map(account => (
                <Col key={account.id} xs={24} sm={12} md={8} lg={6}>
                  <Card size="small" style={{ position: 'relative' }}>
                    <Button
                      type="text"
                      size="small"
                      style={{ position: 'absolute', top: 4, right: 4, padding: 0 }}
                      onClick={() => onSelectionChange(
                        selectedAccounts.filter(id => id !== account.id)
                      )}
                    >
                      ×
                    </Button>
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Text strong ellipsis style={{ maxWidth: '100%' }}>
                        {account.displayName || account.username}
                      </Text>
                      <Tag
                        color={
                          account.status === 'active' ? 'success' :
                          account.status === 'disabled' ? 'default' :
                          account.status === 'banned' ? 'error' : 'warning'
                        }
                        style={{ fontSize: 10 }}
                      >
                        {account.status === 'active' ? '活跃' :
                         account.status === 'disabled' ? '禁用' :
                         account.status === 'banned' ? '封禁' : '暂停'}
                      </Tag>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </Card>
      )}

      {/* 操作历史 */}
      {operations.length > 0 && (
        <Card size="small">
          <Title level={5} style={{ marginBottom: 12 }}>
            批量操作历史
          </Title>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {operations.map(operation => (
              <div key={operation.id} style={{ marginBottom: 12, padding: 12, border: '1px solid #f0f0f0', borderRadius: 4 }}>
                <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                  <Col>
                    <Space>
                      {renderOperationType(operation.type)}
                      {renderOperationStatus(operation.status)}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {operation.total} 个账号
                      </Text>
                    </Space>
                  </Col>
                  <Col>
                    <Badge
                      count={operation.completed}
                      style={{ backgroundColor: '#52c41a', marginRight: 8 }}
                    />
                    <Badge
                      count={operation.failed}
                      style={{ backgroundColor: '#f5222d' }}
                    />
                  </Col>
                </Row>
                
                <Progress
                  percent={operation.progress}
                  status={
                    operation.status === 'completed' ? 'success' :
                    operation.status === 'failed' ? 'exception' : 'active'
                  }
                  size="small"
                  style={{ marginBottom: 8 }}
                />
                
                <Row justify="space-between">
                  <Col>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      开始: {operation.startTime ? new Date(operation.startTime).toLocaleTimeString() : '-'}
                    </Text>
                  </Col>
                  <Col>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      结束: {operation.endTime ? new Date(operation.endTime).toLocaleTimeString() : '-'}
                    </Text>
                  </Col>
                </Row>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 批量操作确认模态框 */}
      <Modal
        title={`批量${operationType === 'start' ? '启动' : operationType === 'pause' ? '暂停' : '测试'}操作`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        <Alert
          message="操作确认"
          description={`确定要对选中的 ${selectedCount} 个账号执行批量${operationType === 'start' ? '启动' : operationType === 'pause' ? '暂停' : '测试'}操作吗？`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <div style={{ marginBottom: 16 }}>
          <Text strong>选中的账号：</Text>
          <div style={{ marginTop: 8, maxHeight: 150, overflow: 'auto' }}>
            {selectedAccountsData.map(account => (
              <Tag key={account.id} style={{ margin: 2 }}>
                {account.displayName || account.username}
              </Tag>
            ))}
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={() => setModalVisible(false)}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={() => {
                setModalVisible(false);
                // 操作已经在handleBatchOperation中执行
              }}
            >
              确认执行
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default BatchOperations;