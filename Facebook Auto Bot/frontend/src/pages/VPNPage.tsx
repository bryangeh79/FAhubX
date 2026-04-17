import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Tabs,
  Alert,
  Progress,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  WifiOutlined,
  DisconnectOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  LinkOutlined,
  SyncOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../components/AppLayout';
import VPNAccountAssociation from '../components/VPNAccountAssociation';
import { vpnService, VPNConfig } from '../services/vpn';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const VPNPage: React.FC = () => {
  const [vpns, setVpns] = useState<VPNConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVPN, setEditingVPN] = useState<VPNConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('vpns');
  // const [showMonitor, setShowMonitor] = useState(false); // 暂时注释，未使用

  const configuredCount = vpns.length;
  const activeCount = vpns.filter((v) => v.status === 'connected' || (v as any).status === 'active').length;
  const ipPoolCount = vpns.filter((v) => v.status !== 'error').length;
  

  // const avgLatency = connectedVPNs.length > 0 
  //   ? Math.round(connectedVPNs.reduce((sum, v) => sum + (v.latency || 0), 0) / connectedVPNs.length)
  //   : 0; // 暂时注释，未使用
  // const avgBandwidth = connectedVPNs.length > 0
  //   ? Math.round(connectedVPNs.reduce((sum, v) => sum + (v.bandwidth || 0), 0) / connectedVPNs.length)
  //   : 0; // 暂时注释，未使用

  // const handleAssociationChange = () => {}; // 暂时注释，未使用
  // const handlePolicyChange = () => {}; // 暂时注释，未使用

  useEffect(() => {
    fetchVPNs();
  }, []);

  const fetchVPNs = async () => {
    setLoading(true);
    try {
      const res = await vpnService.getVPNs();
      setVpns(res.data.vpns || []);
    } catch {
      message.error('获取VPN列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingVPN(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditClick = (vpn: VPNConfig) => {
    setEditingVPN(vpn);
    const rec = vpn as any;
    form.setFieldsValue({
      name: rec.name,
      type: rec.type || rec.protocol,
      serverAddress: rec.serverAddress || rec.server,
      port: rec.port,
      username: rec.username,
      password: rec.password,
      country: rec.country,
      city: rec.city,
      ipAddress: rec.ipAddress,
    });
    setModalVisible(true);
  };

  const handleDeleteClick = async (id: string) => {
    try {
      await vpnService.deleteVPN(id);
      message.success('删除成功');
      fetchVPNs();
    } catch {
      message.error('删除失败');
    }
  };

  const handleConnectClick = async (id: string) => {
    setConnectingId(id);
    try {
      await vpnService.connectVPN(id);
      message.success('连接成功');
      fetchVPNs();
    } catch {
      message.error('连接失败');
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnectClick = async (id: string) => {
    try {
      await vpnService.disconnectVPN(id);
      message.success('断开成功');
      fetchVPNs();
    } catch {
      message.error('断开失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingVPN) {
        await vpnService.updateVPN(editingVPN.id, values);
        message.success('更新成功');
      } else {
        await vpnService.createVPN(values);
        message.success('创建成功');
      }

      setModalVisible(false);
      fetchVPNs();
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    form.resetFields();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'active': return 'green';
      case 'connecting':
      case 'testing': return 'blue';
      case 'disconnecting': return 'orange';
      case 'disconnected':
      case 'inactive': return 'default';
      case 'error': return 'red';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
      case 'active': return '已连接';
      case 'connecting':
      case 'testing': return '连接中';
      case 'disconnecting': return '断开中';
      case 'disconnected':
      case 'inactive': return '未连接';
      case 'error': return '错误';
      default: return status || '未知';
    }
  };

  const getTypeText = (type: string) => {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'openvpn': return 'OpenVPN';
      case 'wireguard': return 'WireGuard';
      case 'shadowsocks':
      case 'proxy': return 'Shadowsocks/Proxy';
      case 'OpenVPN': return 'OpenVPN';
      case 'WireGuard': return 'WireGuard';
      case 'Shadowsocks': return 'Shadowsocks';
      case 'Other':
      case 'other': return '其他';
      default: return type || '未知';
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '类型',
      key: 'type',
      width: 100,
      render: (_: any, record: any) => {
        const t = record.protocol || record.type || '';
        return <Tag color="blue">{getTypeText(t)}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '服务器',
      key: 'serverAddress',
      width: 150,
      render: (_: any, record: any) => {
        const address = record.server || record.serverAddress || '';
        return (
          <div>
            <div>{address || '-'}</div>
            {record.country && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.country} {record.city ? `· ${record.city}` : ''}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 120,
      render: (ip: string) => (ip ? <Tag color="geekblue">{ip}</Tag> : '-'),
    },
    {
      title: '性能指标',
      key: 'performance',
      render: (_: any, record: VPNConfig) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          {record.latency && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text type="secondary" style={{ fontSize: 12, width: 40 }}>延迟:</Text>
              <Progress
                percent={Math.min(100, (record.latency || 300) / 3)}
                size="small"
                status={record.latency < 150 ? 'success' : record.latency < 250 ? 'normal' : 'exception'}
                showInfo={false}
                style={{ flex: 1 }}
              />
              <Text style={{ fontSize: 12, width: 40 }}>{record.latency}ms</Text>
            </div>
          )}
          {record.bandwidth && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text type="secondary" style={{ fontSize: 12, width: 40 }}>带宽:</Text>
              <Progress
                percent={Math.min(100, (record.bandwidth || 100) / 10)}
                size="small"
                status={record.bandwidth > 50 ? 'success' : record.bandwidth > 20 ? 'normal' : 'exception'}
                showInfo={false}
                style={{ flex: 1 }}
              />
              <Text style={{ fontSize: 12, width: 40 }}>{record.bandwidth}Mbps</Text>
            </div>
          )}
        </Space>
      ),
    },
    {
      title: '最后连接',
      dataIndex: 'lastConnectedAt',
      key: 'lastConnectedAt',
      width: 120,
      render: (time: string) => (time ? dayjs(time).format('MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: VPNConfig) => (
        <Space size="small">
          {(record.status === 'connected' || (record as any).status === 'active') ? (
            <Button
              size="small"
              icon={<DisconnectOutlined />}
              onClick={() => handleDisconnectClick(record.id)}
              danger
            >
              断开
            </Button>
          ) : (
            <Button
              size="small"
              icon={<WifiOutlined />}
              onClick={() => handleConnectClick(record.id)}
              loading={connectingId === record.id}
              type="primary"
            >
              连接
            </Button>
          )}
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleEditClick(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个VPN配置吗？"
            onConfirm={() => handleDeleteClick(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button icon={<DeleteOutlined />} danger>
              删除
            </Button>
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
            <Title level={2} style={{ marginTop: 0, marginBottom: 4 }}>
              VPN配置
            </Title>
            <Text type="secondary">管理VPN节点配置，为Facebook账号分配独立IP。</Text>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick} size="large">
              添加VPN
            </Button>
          </Col>
        </Row>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="配置总数"
              value={configuredCount}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SafetyOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="活跃连接"
              value={activeCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="可用IP池"
              value={ipPoolCount}
              valueStyle={{ color: '#722ed1' }}
              prefix={<GlobalOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="平均延迟"
              value={0}
              suffix="ms"
              valueStyle={{ color: '#faad14' }}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 24 }}>
        <TabPane tab={<span><WifiOutlined /> VPN列表</span>} key="vpns">
          <Card>
            <Table
              columns={columns}
              dataSource={vpns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条记录` }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </TabPane>
        <TabPane tab={<span><LinkOutlined /> 账号-VPN关联</span>} key="associations">
          <VPNAccountAssociation />
        </TabPane>
        <TabPane tab={<span><SyncOutlined /> IP轮换策略</span>} key="rotation">
          <Card>
            <Alert
              message="IP轮换策略管理"
              description="配置IP轮换策略，控制VPN连接的切换频率和条件。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <SyncOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
              <Text type="secondary">IP轮换策略功能开发中</Text>
            </div>
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title={editingVPN ? '编辑VPN配置' : '添加VPN配置'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="例如：美国洛杉矶节点" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="VPN类型"
                rules={[{ required: true, message: '请选择VPN类型' }]}
              >
                <Select placeholder="选择VPN类型">
                  <Select.OptGroup label="✅ 推荐（Chromium 原生支持）">
                    <Select.Option value="SOCKS5">SOCKS5 代理（静态住宅 IP / 911 S5）</Select.Option>
                    <Select.Option value="HTTP">HTTP 代理</Select.Option>
                  </Select.OptGroup>
                  <Select.OptGroup label="⚠️ 需额外配置（不推荐）">
                    <Select.Option value="OpenVPN">OpenVPN（需系统级 VPN 客户端）</Select.Option>
                    <Select.Option value="WireGuard">WireGuard（需系统级 VPN 客户端）</Select.Option>
                    <Select.Option value="Shadowsocks">Shadowsocks</Select.Option>
                    <Select.Option value="Other">其他（通用代理）</Select.Option>
                  </Select.OptGroup>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="serverAddress"
                label="服务器地址"
                rules={[{ required: true, message: '请输入服务器地址' }]}
              >
                <Input placeholder="例如：vpn.example.com 或 192.168.1.100" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="port"
                label="端口"
                rules={[{ required: true, message: '请输入端口号' }]}
              >
                <Input placeholder="例如：1194" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="country"
                label="国家/地区"
              >
                <Input placeholder="例如：美国" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="city"
                label="城市"
              >
                <Input placeholder="例如：洛杉矶" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="username"
                label="用户名"
              >
                <Input placeholder="VPN用户名（可选）" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="password" label="密码">
            <Input.Password placeholder="VPN密码（可选）" />
          </Form.Item>

          <Form.Item name="ipAddress" label="出口IP地址" extra="填写该VPN节点的出口公网IP（可选，用于记录和显示）">
            <Input placeholder="例如：103.12.34.56" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
};

export default VPNPage;