import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Button, message, Space } from 'antd';
import {
  UserOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  PlayCircleOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import { accountsService, AccountStats } from '../services/accounts';
import { vpnService, VPNConfig } from '../services/vpn';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';

const { Title, Text } = Typography;

interface TaskStats {
  total: number;
  running: number;
  success: number;
  failed: number;
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const t = useT();
  const [accountStats, setAccountStats] = useState<AccountStats | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [vpns, setVpns] = useState<VPNConfig[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Parallel fetch: account stats, task stats, VPN list
        const [accountRes, taskRes, vpnRes] = await Promise.allSettled([
          accountsService.getStats(),
          api.get<any>('/tasks/stats'),
          vpnService.getVPNs({ limit: 100 }),
        ]);

        if (accountRes.status === 'fulfilled') {
          setAccountStats(accountRes.value.data);
        }
        if (taskRes.status === 'fulfilled') {
          // 后端若有全局拦截器包 { data: ... }，读 .data.data；否则直接 .data
          const raw: any = (taskRes.value as any).data;
          setTaskStats(raw?.data ?? raw);
        }
        if (vpnRes.status === 'fulfilled') {
          const d: any = vpnRes.value.data;
          setVpns(d?.vpns || []);
        }
      } catch {
        message.error(t('dashboard.fetchStatsFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // VPN 状态拆分：status='active' 算已连接
  const vpnConnectedCount = vpns.filter(v => (v as any).status === 'active').length;
  const vpnDisconnectedCount = vpns.length - vpnConnectedCount;

  return (
    <AppLayout>
      <Title level={2} style={{ marginTop: 0 }}>
        {t('dashboard.title')}
      </Title>

      {/* Row 1: 账号 + VPN 状态（Col 统一高度，Card height:100% 对齐） */}
      <Row gutter={16} style={{ marginBottom: 16 }} align="stretch">
        <Col xs={24} sm={12} lg={6} style={{ display: 'flex' }}>
          <Card loading={loading} style={{ width: '100%' }}>
            <Statistic
              title={t('dashboard.totalAccounts')}
              value={accountStats?.totalAccounts ?? '-'}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6} style={{ display: 'flex' }}>
          <Card loading={loading} style={{ width: '100%' }}>
            <Statistic
              title={t('dashboard.activeAccounts')}
              value={accountStats?.activeAccounts ?? '-'}
              prefix={<GlobalOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={12} style={{ display: 'flex' }}>
          <Card
            loading={loading}
            hoverable
            onClick={() => navigate('/vpn')}
            style={{ cursor: 'pointer', width: '100%' }}
          >
            {/* 模仿 Statistic 结构：title 在顶 + 数字区在下，高度与邻居卡片对齐 */}
            <div
              className="ant-statistic"
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <div className="ant-statistic-title" style={{ marginBottom: 4 }}>
                <Space>
                  <WifiOutlined />
                  <span>{t('dashboard.vpnStatus')}</span>
                </Space>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
                <div>
                  <span style={{ fontSize: 24, fontWeight: 400, color: '#52c41a' }}>
                    <CheckCircleOutlined style={{ marginRight: 8, fontSize: 20 }} />
                    {vpnConnectedCount}
                  </span>
                  <Text type="secondary" style={{ fontSize: 13, marginLeft: 6 }}>{t('dashboard.vpnConnected')}</Text>
                </div>
                <div>
                  <span style={{ fontSize: 24, fontWeight: 400, color: (vpnDisconnectedCount > 0 ? '#f5222d' : '#bfbfbf') }}>
                    <CloseCircleOutlined style={{ marginRight: 8, fontSize: 20 }} />
                    {vpnDisconnectedCount}
                  </span>
                  <Text type="secondary" style={{ fontSize: 13, marginLeft: 6 }}>{t('dashboard.vpnDisconnected')}</Text>
                </div>
              </div>
              {vpns.length === 0 && !loading && (
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                  {t('dashboard.vpnEmpty')}
                </Text>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Row 2: 任务 4 数字 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic
              title={t('dashboard.totalTasks')}
              value={taskStats?.total ?? '-'}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic
              title={t('dashboard.runningTasks')}
              value={taskStats?.running ?? '-'}
              prefix={<SyncOutlined spin={!!taskStats?.running} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic
              title={t('dashboard.successTasks')}
              value={taskStats?.success ?? '-'}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={loading}>
            <Statistic
              title={t('dashboard.failedTasks')}
              value={taskStats?.failed ?? '-'}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: (taskStats?.failed ?? 0) > 0 ? '#f5222d' : '#8c8c8c' }}
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
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate('/accounts')} style={{ marginRight: 8 }}>
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
