import React, { useState } from 'react';
import { Card, Input, Button, Typography, Space, Alert, message } from 'antd';
import { KeyOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;

const ActivationPage: React.FC<{ onActivated: () => void }> = ({ onActivated }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('请输入 License Key');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/license/activate', { licenseKey: licenseKey.trim() });
      const data = res.data?.data || res.data;
      if (data.success) {
        message.success(`激活成功！配套：${(data.license?.plan || 'basic').toUpperCase()}，最多 ${data.license?.maxAccounts || 10} 个账号`);
        onActivated();
      } else {
        setError(data.error || '激活失败，请检查 License Key 是否正确');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.message || '激活失败，请检查网络连接和 License Key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ width: 460, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔑</div>
            <Title level={3} style={{ margin: 0 }}>FAhubX 系统激活</Title>
            <Paragraph type="secondary">请输入管理员提供的 License Key 来激活系统</Paragraph>
          </div>

          {error && (
            <Alert type="error" message={error} showIcon closable onClose={() => setError(null)} />
          )}

          <Input
            size="large"
            prefix={<KeyOutlined style={{ color: '#1677ff' }} />}
            placeholder="FAH-XXXX-XXXX-XXXX"
            value={licenseKey}
            onChange={e => setLicenseKey(e.target.value.toUpperCase())}
            onPressEnter={handleActivate}
            maxLength={19}
            style={{ fontFamily: 'monospace', fontSize: 16, letterSpacing: 1 }}
          />

          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            onClick={handleActivate}
            icon={loading ? <LoadingOutlined /> : <CheckCircleOutlined />}
          >
            {loading ? '正在验证...' : '激活系统'}
          </Button>

          <Text type="secondary" style={{ fontSize: 12 }}>
            如果您没有 License Key，请联系您的服务提供商获取
          </Text>
        </Space>
      </Card>
    </div>
  );
};

export default ActivationPage;
