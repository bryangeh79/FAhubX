import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Typography, Tag, Modal, Form,
  Input, Select, message, Row, Col, Switch, Divider, Alert, Tooltip, Popconfirm,
  Collapse, Tabs,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../components/AppLayout';
import { AntiDetectionConfig } from '../types/facebook-login';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;
const { TabPane } = Tabs;

const AntiDetectionPage: React.FC = () => {
  const [configs, setConfigs] = useState<AntiDetectionConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AntiDetectionConfig | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // 模拟加载数据
  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      // 模拟数据
      const mockConfigs: AntiDetectionConfig[] = [
        {
          id: '1',
          name: '桌面Chrome配置',
          browserFingerprint: {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            screenWidth: 1920,
            screenHeight: 1080,
            colorDepth: 24,
            timezone: 'Asia/Shanghai',
            language: 'zh-CN',
            platform: 'Win32',
            hardwareConcurrency: 8,
            deviceMemory: 8,
            webglVendor: 'Google Inc.',
            webglRenderer: 'ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
            canvasFingerprint: 'canvas-fingerprint',
            audioFingerprint: 'audio-fingerprint',
            fonts: ['Arial', 'Microsoft YaHei', 'SimSun'],
            plugins: ['Chrome PDF Plugin', 'Chrome PDF Viewer'],
          },
          humanBehavior: {
            mouseMovement: {
              enabled: true,
              speedVariation: 0.3,
              pauseProbability: 0.1,
              curveProbability: 0.5,
            },
            keyboardInput: {
              enabled: true,
              typingSpeed: 300,
              errorRate: 0.05,
              backspaceProbability: 0.1,
            },
            scrolling: {
              enabled: true,
              speedVariation: 0.4,
              pauseProbability: 0.2,
              scrollDirectionChanges: true,
            },
            pageInteraction: {
              enabled: true,
              clickRandomness: 0.3,
              hoverProbability: 0.5,
              tabSwitchProbability: 0.1,
            },
          },
          deviceSimulation: {
            deviceType: 'desktop',
            os: 'windows',
            osVersion: '10',
            browser: 'chrome',
            browserVersion: '120.0.0.0',
            viewportWidth: 1920,
            viewportHeight: 1080,
            pixelRatio: 1,
            touchSupport: false,
          },
          enabled: true,
          accounts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      setConfigs(mockConfigs);
    } catch (error) {
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConfig = async (values: any) => {
    try {
      // 模拟创建
      const newConfig: AntiDetectionConfig = {
        id: Date.now().toString(),
        ...values,
        accounts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setConfigs(prev => [...prev, newConfig]);
      setIsCreateModalVisible(false);
      createForm.resetFields();
      message.success('配置创建成功');
    } catch (error) {
      message.error('创建配置失败');
    }
  };

  const handleEditConfig = async (values: any) => {
    if (!editingConfig) return;
    
    try {
      // 模拟更新
      const updatedConfigs = configs.map(config => 
        config.id === editingConfig.id 
          ? { ...config, ...values, updatedAt: new Date().toISOString() }
          : config
      );
      setConfigs(updatedConfigs);
      setIsEditModalVisible(false);
      setEditingConfig(null);
      editForm.resetFields();
      message.success('配置更新成功');
    } catch (error) {
      message.error('更新配置失败');
    }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      // 模拟删除
      setConfigs(prev => prev.filter(config => config.id !== id));
      message.success('配置删除成功');
    } catch (error) {
      message.error('删除配置失败');
    }
  };

  const columns = [
    {
      title: '配置名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '设备类型',
      key: 'device',
      render: (_: any, record: AntiDetectionConfig) => (
        <Space>
          <Tag color={record.deviceSimulation.deviceType === 'desktop' ? 'blue' : 'purple'}>
            {record.deviceSimulation.deviceType === 'desktop' ? '桌面' : '移动'}
          </Tag>
          <Text type="secondary">
            {record.deviceSimulation.os} {record.deviceSimulation.browser}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'red'}>
          {enabled ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '关联账号',
      key: 'accounts',
      render: (_: any, record: AntiDetectionConfig) => (
        <Text type="secondary">
          {record.accounts.length} 个账号
        </Text>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(date).format('YYYY-MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: AntiDetectionConfig) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingConfig(record);
                editForm.setFieldsValue(record);
                setIsEditModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="复制配置">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => {
                const newConfig = { ...record, id: Date.now().toString(), name: `${record.name} - 副本` };
                setConfigs(prev => [...prev, newConfig]);
                message.success('配置复制成功');
              }}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个配置吗？"
            onConfirm={() => handleDeleteConfig(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ marginTop: 0, marginBottom: 4 }}>反检测配置</Title>
            <Text type="secondary">配置浏览器指纹、设备模拟和人类行为参数，避免被Facebook检测</Text>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => setIsCreateModalVisible(true)}
            >
              创建配置
            </Button>
          </Col>
        </Row>
      </div>

      <Alert
        message="反检测配置说明"
        description="通过模拟真实用户的浏览器指纹、设备信息和行为模式，可以有效降低被Facebook检测的风险。建议为不同类型的账号创建不同的配置。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={configs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条配置` }}
        />
      </Card>

      {/* 创建配置模态框 */}
      <Modal
        title="创建反检测配置"
        open={isCreateModalVisible}
        onOk={() => createForm.submit()}
        onCancel={() => {
          setIsCreateModalVisible(false);
          createForm.resetFields();
        }}
        width={800}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateConfig}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="例如：桌面Chrome配置、移动Safari配置" />
          </Form.Item>

          <Form.Item
            name="enabled"
            label="启用配置"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Divider>设备模拟配置</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['deviceSimulation', 'deviceType']}
                label="设备类型"
                rules={[{ required: true }]}
                initialValue="desktop"
              >
                <Select>
                  <Option value="desktop">桌面设备</Option>
                  <Option value="mobile">移动设备</Option>
                  <Option value="tablet">平板设备</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['deviceSimulation', 'os']}
                label="操作系统"
                rules={[{ required: true }]}
                initialValue="windows"
              >
                <Select>
                  <Option value="windows">Windows</Option>
                  <Option value="macos">macOS</Option>
                  <Option value="linux">Linux</Option>
                  <Option value="android">Android</Option>
                  <Option value="ios">iOS</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Alert
            message="提示"
            description="更多高级配置将在后续步骤中完善"
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </Form>
      </Modal>

      {/* 编辑配置模态框 */}
      <Modal
        title="编辑反检测配置"
        open={isEditModalVisible}
        onOk={() => editForm.submit()}
        onCancel={() => {
          setIsEditModalVisible(false);
          setEditingConfig(null);
          editForm.resetFields();
        }}
        width={800}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditConfig}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="例如：桌面Chrome配置、移动Safari配置" />
          </Form.Item>

          <Form.Item
            name="enabled"
            label="启用配置"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
};

export default AntiDetectionPage;