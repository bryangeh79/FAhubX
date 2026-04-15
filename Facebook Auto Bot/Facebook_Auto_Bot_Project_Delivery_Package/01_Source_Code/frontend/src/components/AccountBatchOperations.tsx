import React, { useState } from 'react';
import {
  Modal,
  Form,
  Select,
  Button,
  Space,
  message,
  Alert,
  Typography,
  Row,
  Col,
  Card,
  Progress,
  Tag,
} from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../services/api';

const { Text } = Typography;
const { Option } = Select;

interface AccountBatchOperationsProps {
  selectedAccountIds: string[];
  onClose: () => void;
  onSuccess?: () => void;
}

interface Operation {
  id: string;
  type: 'test_connection' | 'login' | 'enable' | 'disable' | 'assign_vpn';
  accountId: string;
  accountName: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: any;
  error?: string;
}

const AccountBatchOperations: React.FC<AccountBatchOperationsProps> = ({
  selectedAccountIds,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  // 批量测试连接
  const batchTestConnection = useMutation({
    mutationFn: (accountIds: string[]) => 
      Promise.all(accountIds.map(id => api.post(`/accounts/${id}/test-connection`))),
    onSuccess: () => {
      message.success('批量测试连接完成');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      message.error('批量测试连接失败');
    },
  });

  // 批量登录
  const batchLogin = useMutation({
    mutationFn: (accountIds: string[]) =>
      Promise.all(accountIds.map(id => api.post(`/accounts/${id}/login`))),
    onSuccess: () => {
      message.success('批量登录完成');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      message.error('批量登录失败');
    },
  });

  // 批量启用
  const batchEnable = useMutation({
    mutationFn: (accountIds: string[]) =>
      Promise.all(accountIds.map(id => api.put(`/accounts/${id}`, { status: 'active' }))),
    onSuccess: () => {
      message.success('批量启用完成');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      message.error('批量启用失败');
    },
  });

  // 批量禁用
  const batchDisable = useMutation({
    mutationFn: (accountIds: string[]) =>
      Promise.all(accountIds.map(id => api.put(`/accounts/${id}`, { status: 'disabled' }))),
    onSuccess: () => {
      message.success('批量禁用完成');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      message.error('批量禁用失败');
    },
  });

  const handleSubmit = async (values: any) => {
    const { operationType, vpnId } = values;
    
    // 初始化操作列表
    const initialOperations: Operation[] = selectedAccountIds.map((id, index) => ({
      id: `op-${Date.now()}-${index}`,
      type: operationType,
      accountId: id,
      accountName: `账号 ${index + 1}`,
      status: 'pending',
    }));
    
    setOperations(initialOperations);
    setIsRunning(true);

    try {
      switch (operationType) {
        case 'test_connection':
          await batchTestConnection.mutateAsync(selectedAccountIds);
          break;
        case 'login':
          await batchLogin.mutateAsync(selectedAccountIds);
          break;
        case 'enable':
          await batchEnable.mutateAsync(selectedAccountIds);
          break;
        case 'disable':
          await batchDisable.mutateAsync(selectedAccountIds);
          break;
        case 'assign_vpn':
          if (vpnId) {
            // 分配VPN逻辑
            await Promise.all(
              selectedAccountIds.map(id => 
                api.put(`/accounts/${id}/vpn`, { vpnId })
              )
            );
            message.success('批量分配VPN完成');
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
          }
          break;
      }

      // 更新操作状态为成功
      setOperations(ops => ops.map(op => ({ ...op, status: 'success' })));
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 1500);
    } catch (error) {
      // 更新操作状态为失败
      setOperations(ops => ops.map(op => ({ ...op, status: 'failed', error: '操作失败' })));
    } finally {
      setIsRunning(false);
    }
  };

  const getOperationName = (type: string) => {
    const names: Record<string, string> = {
      test_connection: '测试连接',
      login: '登录',
      enable: '启用',
      disable: '禁用',
      assign_vpn: '分配VPN',
    };
    return names[type] || type;
  };

  const getStatusTag = (status: string) => {
    const config: Record<string, { color: string; text: string; icon?: React.ReactNode }> = {
      pending: { color: 'default', text: '等待' },
      running: { color: 'processing', text: '执行中', icon: <SyncOutlined spin /> },
      success: { color: 'success', text: '成功', icon: <CheckCircleOutlined /> },
      failed: { color: 'error', text: '失败', icon: <ExclamationCircleOutlined /> },
    };
    const cfg = config[status] || { color: 'default', text: '未知' };
    return (
      <Tag icon={cfg.icon} color={cfg.color}>
        {cfg.text}
      </Tag>
    );
  };

  const completedCount = operations.filter(op => op.status === 'success' || op.status === 'failed').length;
  const successCount = operations.filter(op => op.status === 'success').length;
  const progress = operations.length > 0 ? (completedCount / operations.length) * 100 : 0;

  return (
    <Modal
      title="批量操作"
      open={true}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <div style={{ marginBottom: 24 }}>
        <Alert
          message={`已选择 ${selectedAccountIds.length} 个账号`}
          description="请选择要执行的批量操作类型"
          type="info"
          showIcon
        />
      </div>

      {operations.length === 0 ? (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="operationType"
            label="操作类型"
            rules={[{ required: true, message: '请选择操作类型' }]}
          >
            <Select placeholder="选择批量操作类型">
              <Option value="test_connection">
                <Space>
                  <SyncOutlined />
                  测试连接
                </Space>
              </Option>
              <Option value="login">
                <Space>
                  <UserOutlined />
                  批量登录
                </Space>
              </Option>
              <Option value="enable">
                <Space>
                  <CheckCircleOutlined />
                  批量启用
                </Space>
              </Option>
              <Option value="disable">
                <Space>
                  <ExclamationCircleOutlined />
                  批量禁用
                </Space>
              </Option>
              <Option value="assign_vpn">
                <Space>
                  <SafetyOutlined />
                  分配VPN
                </Space>
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.operationType !== currentValues.operationType}
          >
            {({ getFieldValue }) => {
              const operationType = getFieldValue('operationType');
              if (operationType === 'assign_vpn') {
                return (
                  <Form.Item
                    name="vpnId"
                    label="选择VPN"
                    rules={[{ required: true, message: '请选择VPN' }]}
                  >
                    <Select placeholder="选择要分配的VPN">
                      <Option value="vpn-1">美国VPN-01</Option>
                      <Option value="vpn-2">英国VPN-01</Option>
                      <Option value="vpn-3">日本VPN-01</Option>
                    </Select>
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={onClose}>取消</Button>
              <Button type="primary" htmlType="submit" loading={isRunning}>
                开始执行
              </Button>
            </Space>
          </Form.Item>
        </Form>
      ) : (
        <div>
          {/* 进度显示 */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]} align="middle">
              <Col flex="auto">
                <div style={{ marginBottom: 8 }}>
                  <Text strong>批量操作进度</Text>
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {getOperationName(operations[0]?.type || '')}
                  </Text>
                </div>
                <Progress
                  percent={progress}
                  status={
                    operations.some(op => op.status === 'failed')
                      ? 'exception'
                      : successCount === operations.length
                      ? 'success'
                      : 'active'
                  }
                />
              </Col>
              <Col>
                <Text>
                  {successCount} / {operations.length} 完成
                </Text>
              </Col>
            </Row>
          </Card>

          {/* 操作详情 */}
          <Card size="small" title="操作详情">
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {operations.map((operation) => (
                <div
                  key={operation.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <Text>{operation.accountName}</Text>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      ({operation.accountId.slice(0, 8)}...)
                    </Text>
                  </div>
                  <div>
                    {getStatusTag(operation.status)}
                    {operation.error && (
                      <Text type="danger" style={{ marginLeft: 8, fontSize: 12 }}>
                        {operation.error}
                      </Text>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            {isRunning ? (
              <Button loading>执行中...</Button>
            ) : (
              <Space>
                {operations.some(op => op.status === 'failed') && (
                  <Button
                    type="primary"
                    danger
                    onClick={() => {
                      // 重试失败的操作
                      const failedOps = operations.filter(op => op.status === 'failed');
                      // 这里可以实现重试逻辑
                    }}
                  >
                    重试失败项
                  </Button>
                )}
                <Button type="primary" onClick={onClose}>
                  完成
                </Button>
              </Space>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AccountBatchOperations;