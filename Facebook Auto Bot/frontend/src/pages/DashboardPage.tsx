import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Button, message } from 'antd';
import {
  UserOutlined,
  GlobalOutlined,
  MessageOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import { accountsService, AccountStats } from '../services/accounts';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await accountsService.getStats();
        setStats(res.data);
      } catch {
        message.error('获取统计数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <AppLayout>
      <Title level={2} style={{ marginTop: 0 }}>
        仪表板
      </Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="总账号数"
              value={stats?.totalAccounts ?? '-'}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="活跃账号"
              value={stats?.activeAccounts ?? '-'}
              prefix={<GlobalOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={45}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="系统健康度"
              value={92}
              suffix="分"
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card title="系统功能概览">
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Card title="账号管理" style={{ marginBottom: 16 }}>
                  <ul>
                    <li>支持多个Facebook账号管理</li>
                    <li>账号健康度评分系统</li>
                    <li>批量操作功能</li>
                    <li>VPN/IP配置管理</li>
                  </ul>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card title="任务调度" style={{ marginBottom: 16 }}>
                  <ul>
                    <li>50个对话剧本支持</li>
                    <li>智能时间调度</li>
                    <li>实时任务监控</li>
                    <li>任务执行统计</li>
                  </ul>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card title="安全特性" style={{ marginBottom: 16 }}>
                  <ul>
                    <li>VPN/IP轮换系统</li>
                    <li>人类行为模拟</li>
                    <li>反检测机制</li>
                    <li>数据加密存储</li>
                  </ul>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="快速操作">
            <p>系统已准备就绪，您可以：</p>
            <ol>
              <li>在"账号管理"页面添加和管理Facebook账号</li>
              <li>在"任务调度"页面创建自动对话任务</li>
              <li>在"VPN配置"页面设置VPN和IP管理</li>
            </ol>
            <div style={{ marginTop: 16 }}>
              <Button type="primary" onClick={() => navigate('/accounts')} style={{ marginRight: 8 }}>
                开始管理账号
              </Button>
              <Button onClick={() => navigate('/tasks')}>查看任务调度</Button>
            </div>
          </Card>
        </Col>
      </Row>
    </AppLayout>
  );
};

export default DashboardPage;
