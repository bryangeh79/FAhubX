import React, { useState, useEffect } from 'react';
import { 
  Result, 
  Button, 
  Card, 
  Typography, 
  Space, 
  Row, 
  Col, 
  Progress, 
  List, 
  Alert,
  Badge
} from 'antd';
import { 
  WifiOutlined, 
  CloudSyncOutlined, 
  DatabaseOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import pwaService from '../services/pwaService';
import { OfflineOperation, PWACapabilities } from '../types/pwa';
import './OfflinePage.css';

const { Title, Text, Paragraph } = Typography;

interface OfflinePageProps {
  onRetry?: () => void;
  showDetails?: boolean;
}

const OfflinePage: React.FC<OfflinePageProps> = ({ 
  onRetry, 
  showDetails = true 
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineOperation[]>([]);
  const [capabilities, setCapabilities] = useState<PWACapabilities | null>(null);
  const [cacheInfo, setCacheInfo] = useState<any[]>([]);
  const [storageUsage, setStorageUsage] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    checkNetworkStatus();
    loadOfflineData();
    loadCapabilities();
    loadCacheInfo();
    
    const interval = setInterval(() => {
      checkNetworkStatus();
      loadOfflineData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const checkNetworkStatus = () => {
    const online = pwaService.isOnline();
    setIsOnline(online);
    
    if (online && offlineQueue.length > 0) {
      triggerSync();
    }
  };

  const loadOfflineData = () => {
    const queue = pwaService.getOfflineQueue();
    setOfflineQueue(queue);
    
    const metrics = pwaService.getMetrics();
    setStorageUsage(metrics.storageUsage);
    
    if (metrics.lastUpdateCheck) {
      setLastSync(new Date(metrics.lastUpdateCheck));
    }
  };

  const loadCapabilities = async () => {
    const caps = await pwaService.getCapabilities();
    setCapabilities(caps);
  };

  const loadCacheInfo = async () => {
    const info = await pwaService.getCacheInfo();
    setCacheInfo(info);
  };

  const triggerSync = async () => {
    if (syncing) return;
    
    setSyncing(true);
    try {
      // 这里触发同步逻辑
      await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟同步
      loadOfflineData();
    } finally {
      setSyncing(false);
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const handleManualSync = () => {
    triggerSync();
  };

  const handleClearQueue = () => {
    pwaService.clearOfflineQueue();
    loadOfflineData();
  };

  const handleClearCache = async () => {
    await pwaService.clearCache();
    loadCacheInfo();
  };

  const getQueueStats = () => {
    const pending = offlineQueue.filter(op => op.status === 'pending').length;
    const processing = offlineQueue.filter(op => op.status === 'processing').length;
    const completed = offlineQueue.filter(op => op.status === 'completed').length;
    const failed = offlineQueue.filter(op => op.status === 'failed').length;
    
    return { pending, processing, completed, failed };
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (date: Date | null): string => {
    if (!date) return '从未同步';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    
    return date.toLocaleDateString();
  };

  if (isOnline) {
    return null;
  }

  const queueStats = getQueueStats();

  return (
    <div className="offline-page">
      <Result
        icon={<WifiOutlined className="offline-icon" />}
        title="网络连接已断开"
        subTitle="您当前处于离线状态，部分功能可能受限"
        extra={[
          <Button 
            key="retry" 
            type="primary" 
            onClick={handleRetry}
            icon={<ReloadOutlined />}
          >
            重试连接
          </Button>,
          <Button 
            key="sync" 
            onClick={handleManualSync}
            icon={<CloudSyncOutlined />}
            loading={syncing}
          >
            手动同步
          </Button>
        ]}
      />
      
      {showDetails && (
        <div className="offline-details">
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card title="离线操作队列" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div className="queue-stats">
                    <Row gutter={16}>
                      <Col span={6}>
                        <Badge 
                          count={queueStats.pending} 
                          style={{ backgroundColor: '#faad14' }}
                        >
                          <Card size="small">
                            <Text>等待中</Text>
                          </Card>
                        </Badge>
                      </Col>
                      <Col span={6}>
                        <Badge 
                          count={queueStats.processing} 
                          style={{ backgroundColor: '#1890ff' }}
                        >
                          <Card size="small">
                            <Text>处理中</Text>
                          </Card>
                        </Badge>
                      </Col>
                      <Col span={6}>
                        <Badge 
                          count={queueStats.completed} 
                          style={{ backgroundColor: '#52c41a' }}
                        >
                          <Card size="small">
                            <Text>已完成</Text>
                          </Card>
                        </Badge>
                      </Col>
                      <Col span={6}>
                        <Badge 
                          count={queueStats.failed} 
                          style={{ backgroundColor: '#ff4d4f' }}
                        >
                          <Card size="small">
                            <Text>失败</Text>
                          </Card>
                        </Badge>
                      </Col>
                    </Row>
                  </div>
                  
                  {offlineQueue.length > 0 && (
                    <List
                      size="small"
                      dataSource={offlineQueue.slice(0, 5)}
                      renderItem={(operation) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={
                              <Badge 
                                status={
                                  operation.status === 'pending' ? 'warning' :
                                  operation.status === 'processing' ? 'processing' :
                                  operation.status === 'completed' ? 'success' : 'error'
                                }
                              />
                            }
                            title={
                              <Text>
                                {operation.type} - {operation.id.substring(0, 8)}
                              </Text>
                            }
                            description={
                              <Space>
                                <ClockCircleOutlined />
                                <Text type="secondary">
                                  {new Date(operation.timestamp).toLocaleTimeString()}
                                </Text>
                                {operation.retryCount > 0 && (
                                  <Text type="secondary">
                                    重试: {operation.retryCount} 次
                                  </Text>
                                )}
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  )}
                  
                  {offlineQueue.length > 5 && (
                    <Text type="secondary">
                      还有 {offlineQueue.length - 5} 个操作未显示
                    </Text>
                  )}
                  
                  <Space>
                    <Button 
                      size="small" 
                      onClick={handleManualSync}
                      disabled={queueStats.pending === 0 || syncing}
                    >
                      同步队列
                    </Button>
                    <Button 
                      size="small" 
                      danger 
                      onClick={handleClearQueue}
                      disabled={offlineQueue.length === 0}
                    >
                      清空队列
                    </Button>
                  </Space>
                </Space>
              </Card>
            </Col>
            
            <Col span={12}>
              <Card title="缓存状态" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {cacheInfo.map((cache) => (
                    <div key={cache.name} className="cache-item">
                      <Text>{cache.name}</Text>
                      <div className="cache-progress">
                        <Progress 
                          percent={Math.min((cache.size / (1024 * 1024)) * 100, 100)}
                          size="small"
                          showInfo={false}
                        />
                        <Text type="secondary">
                          {cache.entries} 个文件 · {formatBytes(cache.size)}
                        </Text>
                      </div>
                    </div>
                  ))}
                  
                  {capabilities && (
                    <div className="storage-info">
                      <DatabaseOutlined />
                      <Text type="secondary">
                        存储使用: {formatBytes(storageUsage)} / {formatBytes(capabilities.storageQuota)}
                      </Text>
                    </div>
                  )}
                  
                  <Button 
                    size="small" 
                    danger 
                    onClick={handleClearCache}
                    disabled={cacheInfo.length === 0}
                  >
                    清理缓存
                  </Button>
                </Space>
              </Card>
            </Col>
            
            <Col span={12}>
              <Card title="系统信息" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div className="info-item">
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <Text>PWA 已安装: {pwaService.isPWAInstalled() ? '是' : '否'}</Text>
                  </div>
                  
                  <div className="info-item">
                    <CloudSyncOutlined style={{ color: '#1890ff' }} />
                    <Text>最后同步: {formatTime(lastSync)}</Text>
                  </div>
                  
                  <div className="info-item">
                    <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                    <Text>离线操作: {offlineQueue.length} 个</Text>
                  </div>
                  
                  {capabilities && (
                    <>
                      <div className="info-item">
                        <Text>推送通知: {capabilities.pushEnabled ? '支持' : '不支持'}</Text>
                      </div>
                      <div className="info-item">
                        <Text>后台同步: {capabilities.backgroundSync ? '支持' : '不支持'}</Text>
                      </div>
                    </>
                  )}
                </Space>
              </Card>
            </Col>
          </Row>
          
          <Alert
            message="离线模式提示"
            description={
              <Paragraph type="secondary">
                在离线模式下，您可以继续使用已缓存的功能。新创建的操作将保存在本地队列中，并在网络恢复后自动同步。
                建议定期清理缓存以释放存储空间。
              </Paragraph>
            }
            type="info"
            showIcon
            className="offline-alert"
          />
        </div>
      )}
    </div>
  );
};

export default OfflinePage;