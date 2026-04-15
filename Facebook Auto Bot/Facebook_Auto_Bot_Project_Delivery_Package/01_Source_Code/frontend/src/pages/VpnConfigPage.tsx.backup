import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Table,
  Button,
  Space,
  Typography,
  Alert,
  Tabs,
  Modal,
  Form,
  Input,
  Select,
  Badge,
  Tag,
  message
} from 'antd';
import {
  GlobalOutlined,
  SafetyOutlined,
  HistoryOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

const VpnConfigPage: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  
  // 模拟数据
  const vpnData = [
    {
      id: '1',
      name: '美国VPN-01',
      provider: 'openvpn',
      location: 'us',
      protocol: 'OpenVPN',
      server: 'vpn.usa.com',
      port: 1194,
      status: 'active',
      successRate: 95
    },
    {
      id: '2',
      name: '日本VPN-01',
      provider: 'wireguard',
      location: 'jp',
      protocol: 'WireGuard',
      server: 'vpn.jp.com',
      port: 51820,
      status: 'active',
      successRate: 98
    }
  ];
  
  const ipData = [
    {
      id: '1',
      ipAddress: '192.168.1.100',
      country: '美国',
      city: '纽约',
      isp: 'Comcast',
      status: 'available'
    },
    {
      id: '2',
      ipAddress: '192.168.1.101',
      country: '日本',
      city: '东京',
      isp: 'SoftBank',
      status: 'in_use'
    }
  ];
  
  const vpnColumns = [
    {
      title: 'VPN名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space>
          <GlobalOutlined />
          <Text strong>{text}</Text>
          {record.status === 'active' && <Tag color="success">活跃</Tag>}
        </Space>
      ),
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string) => {
        const map: Record<string, string> = {
          openvpn: 'OpenVPN',
          wireguard: 'WireGuard'
        };
        return map[provider] || provider;
      },
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      render: (location: string) => {
        const map: Record<string, string> = {
          us: '美国',
          jp: '日本'
        };
        return map[location] || location;
      },
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
    },
    {
      title: '服务器',
      dataIndex: 'server',
      key: 'server',
      render: (server: string, record: any) => (
        <Text type="secondary">{server}:{record.port}</Text>
      ),
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      key: 'successRate',
      render: (rate: number) => (
        <Progress percent={rate} size="small" />
      ),
    },
  ];
  
  const ipColumns = [
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '位置',
      key: 'location',
      render: (_: any, record: any) => (
        <Space>
          <SafetyOutlined />
          <Text>{record.country} - {record.city}</Text>
        </Space>
      ),
    },
    {
      title: 'ISP',
      dataIndex: 'isp',
      key: 'isp',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config: Record<string, { color: string; text: string }> = {
          available: { color: 'success', text: '可用' },
          in_use: { color: 'processing', text: '使用中' },
          blocked: { color: 'error', text: '封禁' },
        };
        const cfg = config[status] || { color: 'default', text: '未知' };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
  ];
  
  const handleSubmit = (values: any) => {
    console.log('Form values:', values);
    message.success('配置已保存');
    setModalVisible(false);
    form.resetFields();
  };
  
  return (
    <div className="vpn-config-page">
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>VPN/IP配置管理</Title>
            <Text type="secondary">管理VPN连接和IP地址资源。</Text>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalVisible(true)}
            >
              添加VPN配置
            </Button>
          </Col>
        </Row>
      </div>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="VPN配置总数"
              value={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="VPN连接成功率"
              value={96}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="IP地址总数"
              value={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="IP使用率"
              value={50}
              suffix="%"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>
      
      <Tabs defaultActiveKey="vpns">
        <TabPane
          tab={
            <span>
              <GlobalOutlined />
              VPN配置
            </span>
          }
          key="vpns"
        >
          <Card>
            <Table
              columns={vpnColumns}
              dataSource={vpnData}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>
        
        <TabPane
          tab={
            <span>
              <SafetyOutlined />
              IP地址池
            </span>
          }
          key="ip-pool"
        >
          <Card>
            <Alert
              message="IP地址池管理"
              description="管理可用的IP地址资源。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Table
              columns={ipColumns}
              dataSource={ipData}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>
        
        <TabPane
          tab={
            <span>
              <HistoryOutlined />
              连接日志
            </span>
          }
          key="logs"
        >
          <Card>
            <div style={{ textAlign: 'center', padding: 40 }}>
              <HistoryOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">暂无连接日志</Text>
              </div>
            </div>
          </Card>
        </TabPane>
      </Tabs>
      
      <Modal
        title="添加VPN配置"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="VPN名称"
                rules={[{ required: true, message: '请输入VPN名称' }]}
              >
                <Input placeholder="例如: 美国VPN-01" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="provider"
                label="提供商"
                rules={[{ required: true, message: '请选择VPN提供商' }]}
              >
                <Select placeholder="选择VPN提供商">
                  <Option value="openvpn">OpenVPN</Option>
                  <Option value="wireguard">WireGuard</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                添加
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VpnConfigPage;