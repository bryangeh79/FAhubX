import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Button,
  Space,
  Typography,
  Alert,
  List,
  Tag,
  Switch,
  Tooltip,
  Modal,
  Descriptions,
  Badge,
  Divider
} from 'antd';
import {
  WifiOutlined,
  NotificationOutlined,
  DownloadOutlined,
  SyncOutlined,
  DatabaseOutlined,
  SettingOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  CloudSyncOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { usePWA } from '../contexts/PWAContext';
import notificationService, { NotificationType } from '../services/notificationService';
import './PWAManagementPanel.css';

const { Title, Text, Paragraph } = Typography;

interface PWAManagementPanelProps {
  compact?: boolean;
  showAdvanced?: boolean;
}

const PWAManagementPanel: React.FC<PWAManagementPanelProps> = ({
  compact = false,
  showAdvanced = false
}) => {
  const pwa = usePWA();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cacheModalVisible, setCacheModalVisible] = useState(false);
  const [offlineModalVisible, setOfflineModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [backgroundSync, setBackgroundSync] = useState(false);

  useEffect(() => {
    loadNotifications();
    checkBackgroundSync();
  }, []);

  const loadNotifications = () => {
    const notifs = notificationService.getNotifications();
    setNotifications(notifs.slice(0, 5));
    setUnreadCount(notificationService.getUnreadCount());
  };

  const checkBackgroundSync = () => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      setBackgroundSync(true);
    }
  };

  const handleInstall = async () => {
    await pwa.installPWA();
  };

  const handleRequestNotificationPermission = async () => {
    await pwa.requestNotificationPermission();
  };

  const handleTestNotification = async (type: NotificationType) => {
    await notificationService.testNotification(type);
    loadNotifications();
  };

  const handleClearCache = async () => {
    await pwa.clearCache();
    await pwa.refreshCacheInfo();
  };

  const handleClearOfflineQueue = () => {
    pwa.clearOfflineQueue();
  };

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead();
    loadNotifications();
  };

  const handleCheckUpdates = async () => {
    await pwa.checkForUpdates();
  };

  const handleUpdateServiceWorker = async () => {
    await pwa.updateServiceWorker();
  };

  const handleRefresh = async () => {
    await pwa.refreshCapabilities();
    await pwa.refreshCacheInfo();
    loadNotifications();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getNetworkStatusColor = () => {
    switch (pwa.networkQuality) {
      case 'good': return '#52c41a';
      case 'poor': return '#faad14';
      case 'offline': return '#ff4d4f';
      default: return '#d9d9d9';
    }
  };

  const getNetworkStatusText = () => {
    switch (pwa.networkQuality) {
      case 'good': return '良好';
      case 'poor': return '较差';
      case 'offline': return '离线';
      default: return '未知';
    }
  };

  const getNotificationPermissionColor = () => {
    switch (pwa.notificationPermission) {
      case 'granted': return '#52c41a';
      case 'denied': return '#ff4d4f';
      case 'default': return '#faad14';
      default: return '#d9d9d9';
    }
  };

  const getNotificationPermissionText = () => {
    switch (pwa.notificationPermission) {
      case 'granted': return '已授权';
      case 'denied': return '已拒绝';
      case 'default': return '未请求';
      default: return '未知';
    }
  };

  const renderCompactView = () => (
    <Card size="small" className="pwa-management-compact">
      <Row gutter={16} align="middle">
        <Col flex="auto">
          <Space>
            <Badge
              status={pwa.isOnline ? 'success' : 'error'}
              text={pwa.isOnline ? '在线' : '离线'}
            />
            {!pwa.isPWAInstalled && pwa.canInstallPWA && (
              <Tag color="blue" icon={<DownloadOutlined />}>
                可安装
              </Tag>
            )}
            {pwa.updateAvailable && (
              <Tag color="orange" icon={<SyncOutlined />}>
                更新可用
              </Tag>
            )}
            {unreadCount > 0 && (
              <Tag color="red" icon={<NotificationOutlined />}>
                {unreadCount} 条未读
              </Tag>
            )}
          </Space>
        </Col>
        <Col>
          <Space>
            {!pwa.isPWAInstalled && pwa.canInstallPWA && (
              <Button
                size="small"
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleInstall}
              >
                安装
              </Button>
            )}
            {pwa.updateAvailable && (
              <Button
                size="small"
                icon={<SyncOutlined />}
                onClick={handleUpdateServiceWorker}
              >
                更新
              </Button>
            )}
            <Button
              size="small"
              icon={<SettingOutlined />}
              onClick={() => setCacheModalVisible(true)}
            >
              管理
            </Button>
          </Space>
        </Col>
      </Row>
    </Card>
  );

  if (compact) {
    return renderCompactView();
  }

  return (
    <div className="pwa-management-panel">
      <Row gutter={[16, 16]}>
        {/* 状态概览 */}
        <Col span={24}>
          <Card title="PWA 状态概览" extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              size="small"
            >
              刷新
            </Button>
          }>
            <Row gutter={16}>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="安装状态"
                    value={pwa.isPWAInstalled ? '已安装' : '未安装'}
                    prefix={pwa.isPWAInstalled ? 
                      <CheckCircleOutlined style={{ color: '#52c41a' }} /> : 
                      <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                    }
                  />
                  {!pwa.isPWAInstalled && pwa.canInstallPWA && (
                    <Button
                      type="primary"
                      size="small"
                      block
                      icon={<DownloadOutlined />}
                      onClick={handleInstall}
                      style={{ marginTop: 8 }}
                    >
                      安装应用
                    </Button>
                  )}
                </Card>
              </Col>
              
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="网络状态"
                    value={getNetworkStatusText()}
                    valueStyle={{ color: getNetworkStatusColor() }}
                    prefix={<WifiOutlined />}
                  />
                  <Progress
                    percent={
                      pwa.networkQuality === 'good' ? 100 :
                      pwa.networkQuality === 'poor' ? 50 : 0
                    }
                    size="small"
                    status={pwa.networkQuality === 'offline' ? 'exception' : 'normal'}
                    strokeColor={getNetworkStatusColor()}
                    style={{ marginTop: 8 }}
                  />
                </Card>
              </Col>
              
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="通知权限"
                    value={getNotificationPermissionText()}
                    valueStyle={{ color: getNotificationPermissionColor() }}
                    prefix={<NotificationOutlined />}
                  />
                  {pwa.notificationPermission !== 'granted' && (
                    <Button
                      size="small"
                      block
                      onClick={handleRequestNotificationPermission}
                      style={{ marginTop: 8 }}
                    >
                      请求权限
                    </Button>
                  )}
                </Card>
              </Col>
              
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="离线操作"
                    value={pwa.offlineQueue.length}
                    prefix={<CloudSyncOutlined />}
                  />
                  {pwa.offlineQueue.length > 0 && (
                    <Button
                      size="small"
                      block
                      onClick={() => setOfflineModalVisible(true)}
                      style={{ marginTop: 8 }}
                    >
                      查看队列
                    </Button>
                  )}
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 缓存和存储 */}
        <Col span={12}>
          <Card 
            title="缓存和存储" 
            extra={
              <Button
                icon={<DeleteOutlined />}
                onClick={handleClearCache}
                size="small"
                danger
              >
                清理缓存
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {pwa.capabilities && (
                <div className="storage-info">
                  <DatabaseOutlined />
                  <Text>存储使用: </Text>
                  <Progress
                    percent={Math.min((pwa.capabilities.storageUsage / pwa.capabilities.storageQuota) * 100, 100)}
                    size="small"
                    style={{ flex: 1 }}
                  />
                  <Text type="secondary">
                    {formatBytes(pwa.capabilities.storageUsage)} / {formatBytes(pwa.capabilities.storageQuota)}
                  </Text>
                </div>
              )}
              
              <List
                size="small"
                dataSource={pwa.cacheInfo.slice(0, 3)}
                renderItem={(cache) => (
                  <List.Item>
                    <List.Item.Meta
                      title={cache.name}
                      description={`${cache.entries} 个文件 · ${formatBytes(cache.size)}`}
                    />
                    <Progress
                      percent={Math.min((cache.size / (1024 * 1024)) * 100, 100)}
                      size="small"
                      width={80}
                    />
                  </List.Item>
                )}
              />
              
              {pwa.cacheInfo.length > 3 && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setCacheModalVisible(true)}
                >
                  查看全部 {pwa.cacheInfo.length} 个缓存
                </Button>
              )}
            </Space>
          </Card>
        </Col>

        {/* 通知管理 */}
        <Col span={12}>
          <Card 
            title="通知管理" 
            extra={
              <Space>
                <Button
                  icon={<NotificationOutlined />}
                  onClick={() => setNotificationModalVisible(true)}
                  size="small"
                >
                  查看全部
                </Button>
                {unreadCount > 0 && (
                  <Button
                    size="small"
                    onClick={handleMarkAllAsRead}
                  >
                    标记全部已读
                  </Button>
                )}
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div className="notification-stats">
                <Text>未读通知: </Text>
                <Badge count={unreadCount} showZero />
                <Text style={{ marginLeft: 16 }}>总计: </Text>
                <Badge count={notifications.length} showZero />
              </div>
              
              <List
                size="small"
                dataSource={notifications}
                renderItem={(notification) => (
                  <List.Item
                    className={notification.read ? 'notification-read' : 'notification-unread'}
                    onClick={() => notificationService.markAsRead(notification.timestamp)}
                  >
                    <List.Item.Meta
                      avatar={
                        <Badge dot={!notification.read}>
                          <NotificationOutlined />
                        </Badge>
                      }
                      title={
                        <Text ellipsis style={{ maxWidth: 200 }}>
                          {notification.title}
                        </Text>
                      }
                      description={
                        <Text type="secondary" ellipsis style={{ maxWidth: 200 }}>
                          {notificationService.formatNotificationTime(notification.timestamp)}
                        </Text>
                      }
                    />
                    <Tag size="small" color="blue">
                      {notification.type}
                    </Tag>
                  </List.Item>
                )}
              />
              
              {showAdvanced && (
                <div className="notification-test">
                  <Text strong>测试通知:</Text>
                  <Space wrap>
                    {Object.values(NotificationType).map((type) => (
                      <Button
                        key={type}
                        size="small"
                        onClick={() => handleTestNotification(type)}
                      >
                        {type}
                      </Button>
                    ))}
                  </Space>
                </div>
              )}
            </Space>
          </Card>
        </Col>

        {/* 高级设置 */}
        {showAdvanced && (
          <Col span={24}>
            <Card title="高级设置">
              <Row gutter={16}>
                <Col span={12}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div className="setting-item">
                      <Switch checked={autoSync} onChange={setAutoSync} />
                      <Text>自动同步离线操作</Text>
                      <Tooltip title="启用后，应用会在网络恢复时自动同步离线操作">
                        <InfoCircleOutlined />
                      </Tooltip>
                    </div>
                    
                    <div className="setting-item">
                      <Switch checked={backgroundSync} disabled={!backgroundSync} />
                      <Text>后台同步</Text>
                      <Tooltip title="使用后台同步 API 自动同步数据">
                        <InfoCircleOutlined />
                      </Tooltip>
                      {!backgroundSync && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          (当前浏览器不支持)
                        </Text>
                      )}
                    </div>
                    
                    <div className="setting-item">
                      <Switch checked={pwa.updateAvailable} disabled />
                      <Text>更新可用</Text>
                      {pwa.updateAvailable && (
                        <Button
                          type="link"
                          size="small"
                          onClick={handleUpdateServiceWorker}
                        >
                          立即更新
                        </Button>
                      )}
                    </div>
                  </Space>
                </Col>
                
                <Col span={12}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Button
                      block
                      onClick={handleCheckUpdates}
                      icon={<SyncOutlined />}
                    >
                      检查更新
                    </Button>
                    
                    <Button
                      block
                      onClick={() => pwa.resetMetrics()}
                      icon={<DeleteOutlined />}
                    >
                      重置统计
                    </Button>
                    
                    <Button
                      block
                      danger
                      onClick={handleClearOfflineQueue}
                      icon={<DeleteOutlined />}
                      disabled={pwa.offlineQueue.length === 0}
                    >
                      清空离线队列
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Card>
          </Col>
        )}
      </Row>

      {/* 缓存详情模态框 */}
      <Modal
        title="缓存管理"
        open={cacheModalVisible}
        onCancel={() => setCacheModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setCacheModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="clear"
            type="primary"
            danger
            onClick={handleClearCache}
          >
            清理所有缓存
          </Button>
        ]}
        width={800}
      >
        <Descriptions column={1} bordered size="small">
          {pwa.cacheInfo.map((cache) => (
            <Descriptions.Item key={cache.name} label={cache.name}>
              <Space direction="vertical">
                <Text>文件数量: {cache.entries}</Text>
                <Text>缓存大小: {formatBytes(cache.size)}</Text>
                <Progress
                  percent={Math.min((cache.size / (1024 * 1024)) * 100, 100)}
                  size="small"
                />
                <Button
                  size="small"
                  danger
                  onClick={() => pwa.clearCache(cache.name)}
                >
                  清理此缓存
                </Button>
              </Space>
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Modal>

      {/* 离线队列模态框 */}
      <Modal
        title="离线操作队列"
        open={offlineModalVisible}
        onCancel={() => setOfflineModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setOfflineModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="clear"
            type="primary"
            danger
            onClick={handleClearOfflineQueue}
            disabled={pwa.offlineQueue.length === 0}
          >
            清空队列
          </Button>
        ]}
        width={800}
      >
        <List
          size="small"
          dataSource={pwa.offlineQueue}
          renderItem={(operation) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color={
                      operation.status === 'pending' ? 'orange' :
                      operation.status === 'processing' ? 'blue' :
                      operation.status === 'completed' ? 'green' : 'red'
                    }>
                      {operation.status}
                    </Tag>
                    <Text>{operation.type}</Text>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">ID: {operation.id.substring(0, 12)}...</Text>
                    <Text type="secondary">
                      创建时间: {new Date(operation.timestamp).toLocaleString()}
                    </Text>
                    {operation.retryCount > 0 && (
                      <Text type="secondary">
                        重试次数: {operation.retryCount}
                      </Text>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
        
        {pwa.offlineQueue.length === 0 && (
          <Alert
            message="队列为空"
            description="当前没有等待同步的离线操作"
            type="info"
            showIcon
          />
        )}
      </Modal>

      {/* 通知详情模态框 */}
      <Modal
        title="通知中心"
        open={notificationModalVisible}
        onCancel={() => setNotificationModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setNotificationModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="clear"
            danger
            onClick={() => {
              notificationService.clearAllNotifications();
              loadNotifications();
              setNotificationModalVisible(false);
            }}
          >
            清空所有通知
          </Button>
        ]}
        width={800}
      >
        <List
          size="small"
          dataSource={notificationService.getNotifications()}
          renderItem={(notification) => (
            <List.Item
              className={notification.read ? 'notification-read' : 'notification-unread'}
              actions={[
                <Button
                  key="read"
                  size="small"
                  onClick={() => {
                    notificationService.markAsRead(notification.timestamp);
                    loadNotifications();
                  }}
                >
                  标记已读
                </Button>,
                <Button
                  key="delete"
                  size="small"
                  danger
                  onClick={() => {
                    notificationService.deleteNotification(notification.timestamp);
                    loadNotifications();
                  }}
                >
                  删除
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Badge dot={!notification.read}>
                    <NotificationOutlined />
                  </Badge>
                }
                title={
                  <Space>
                    <Text strong>{notification.title}</Text>
                    <Tag size="small" color="blue">
                      {notification.type}
                    </Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <Text>{notification.body}</Text>
                    <Text type="secondary">
                      {notificationService.formatNotificationTime(notification.timestamp)}
                    </Text>
                    {notification.data && (
                      <Text type="secondary" ellipsis>
                        数据: {JSON.stringify(notification.data)}
                      </Text>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
        
        {notifications.length === 0 && (
          <Alert
            message="暂无通知"
            description="您还没有收到任何通知"
            type="info"
            showIcon
          />
        )}
      </Modal>
    </div>
  );
};

export default PWAManagementPanel;