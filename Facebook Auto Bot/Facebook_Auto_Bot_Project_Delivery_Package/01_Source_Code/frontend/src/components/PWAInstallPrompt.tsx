import React, { useState, useEffect } from 'react';
import { Modal, Button, Card, Typography, Space, Alert, Steps, Row, Col } from 'antd';
import { 
  DownloadOutlined, 
  CloseOutlined, 
  CheckCircleOutlined,
  MobileOutlined,
  DesktopOutlined,
  InfoCircleOutlined 
} from '@ant-design/icons';
import pwaService from '../services/pwaService';
import './PWAInstallPrompt.css';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

interface PWAInstallPromptProps {
  visible?: boolean;
  onClose?: () => void;
  onInstall?: () => void;
  autoShow?: boolean;
  showOnLoad?: boolean;
  rememberChoice?: boolean;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  visible: externalVisible,
  onClose,
  onInstall,
  autoShow = true,
  showOnLoad = false,
  rememberChoice = true
}) => {
  const [visible, setVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [platform, setPlatform] = useState<'desktop' | 'mobile'>('desktop');
  const [browser, setBrowser] = useState<string>('');
  const [installationStep, setInstallationStep] = useState(0);
  const [userChoiceRemembered, setUserChoiceRemembered] = useState(false);

  useEffect(() => {
    checkInstallStatus();
    detectPlatform();
    detectBrowser();
    
    if (autoShow && showOnLoad) {
      const timer = setTimeout(() => {
        showPromptIfNeeded();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (externalVisible !== undefined) {
      setVisible(externalVisible);
    }
  }, [externalVisible]);

  const checkInstallStatus = () => {
    const installed = pwaService.isPWAInstalled();
    setIsInstalled(installed);
    
    if (installed) {
      setVisible(false);
    }
  };

  const detectPlatform = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|android|iphone|ipad|ipod/.test(userAgent);
    setPlatform(isMobile ? 'mobile' : 'desktop');
  };

  const detectBrowser = () => {
    const userAgent = navigator.userAgent;
    
    if (userAgent.indexOf('Chrome') > -1) {
      setBrowser('Chrome');
    } else if (userAgent.indexOf('Safari') > -1) {
      setBrowser('Safari');
    } else if (userAgent.indexOf('Firefox') > -1) {
      setBrowser('Firefox');
    } else if (userAgent.indexOf('Edge') > -1) {
      setBrowser('Edge');
    } else {
      setBrowser('Browser');
    }
  };

  const showPromptIfNeeded = () => {
    if (isInstalled) {
      return;
    }

    if (rememberChoice) {
      const choice = localStorage.getItem('pwa_install_choice');
      if (choice === 'dismissed') {
        setUserChoiceRemembered(true);
        return;
      }
    }

    const canShow = pwaService.canShowInstallPrompt();
    setCanInstall(canShow);
    
    if (canShow && autoShow) {
      setVisible(true);
    }
  };

  const handleInstall = async () => {
    try {
      setInstallationStep(1);
      const installed = await pwaService.showInstallPrompt();
      
      if (installed) {
        setInstallationStep(2);
        setIsInstalled(true);
        
        if (onInstall) {
          onInstall();
        }
        
        setTimeout(() => {
          setVisible(false);
          setInstallationStep(0);
        }, 2000);
      } else {
        setInstallationStep(0);
        if (rememberChoice) {
          localStorage.setItem('pwa_install_choice', 'dismissed');
        }
      }
    } catch (error) {
      console.error('Installation failed:', error);
      setInstallationStep(0);
    }
  };

  const handleClose = () => {
    if (rememberChoice) {
      localStorage.setItem('pwa_install_choice', 'dismissed');
      setUserChoiceRemembered(true);
    }
    
    setVisible(false);
    
    if (onClose) {
      onClose();
    }
  };

  const showManualInstructions = () => {
    setInstallationStep(3);
  };

  const getInstallInstructions = () => {
    if (platform === 'mobile') {
      if (browser === 'Safari') {
        return (
          <div className="install-instructions">
            <Title level={5}>在 Safari 中安装：</Title>
            <Steps direction="vertical" current={0}>
              <Step 
                title="点击分享按钮" 
                description="点击底部工具栏的分享图标（向上箭头）" 
              />
              <Step 
                title="添加到主屏幕" 
                description="在分享菜单中选择“添加到主屏幕”" 
              />
              <Step 
                title="确认添加" 
                description="点击“添加”按钮完成安装" 
              />
            </Steps>
          </div>
        );
      } else {
        return (
          <div className="install-instructions">
            <Title level={5}>在 {browser} 中安装：</Title>
            <Steps direction="vertical" current={0}>
              <Step 
                title="点击菜单按钮" 
                description="点击浏览器右上角的菜单按钮（三个点）" 
              />
              <Step 
                title="选择安装应用" 
                description="在菜单中选择“安装应用”或“添加到主屏幕”" 
              />
              <Step 
                title="确认安装" 
                description="点击“安装”按钮完成安装" 
              />
            </Steps>
          </div>
        );
      }
    } else {
      return (
        <div className="install-instructions">
          <Title level={5}>在 {browser} 中安装：</Title>
          <Steps direction="vertical" current={0}>
            <Step 
              title="点击安装按钮" 
              description="在地址栏右侧点击安装图标" 
            />
            <Step 
              title="确认安装" 
              description="在弹出的对话框中点击“安装”按钮" 
            />
            <Step 
              title="开始使用" 
              description="应用将自动安装并可以在开始菜单或应用列表中找到" 
            />
          </Steps>
        </div>
      );
    }
  };

  const renderContent = () => {
    switch (installationStep) {
      case 0:
        return (
          <>
            <Card className="install-benefits-card">
              <Title level={4}>🎯 安装 Facebook Auto Bot PWA 的好处</Title>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <div className="benefit-item">
                    <CheckCircleOutlined className="benefit-icon" />
                    <Text strong>离线使用</Text>
                    <Paragraph type="secondary">即使没有网络也能访问核心功能</Paragraph>
                  </div>
                </Col>
                <Col span={12}>
                  <div className="benefit-item">
                    <CheckCircleOutlined className="benefit-icon" />
                    <Text strong>快速启动</Text>
                    <Paragraph type="secondary">像原生应用一样快速启动，无需打开浏览器</Paragraph>
                  </div>
                </Col>
                <Col span={12}>
                  <div className="benefit-item">
                    <CheckCircleOutlined className="benefit-icon" />
                    <Text strong>推送通知</Text>
                    <Paragraph type="secondary">实时接收任务状态和系统通知</Paragraph>
                  </div>
                </Col>
                <Col span={12}>
                  <div className="benefit-item">
                    <CheckCircleOutlined className="benefit-icon" />
                    <Text strong>全屏体验</Text>
                    <Paragraph type="secondary">获得更好的全屏使用体验</Paragraph>
                  </div>
                </Col>
              </Row>
            </Card>
            
            <Alert
              message="安装提示"
              description={
                platform === 'mobile' 
                  ? "将此应用安装到主屏幕，方便快速访问和使用"
                  : "将此应用安装为桌面应用，获得更好的使用体验"
              }
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              className="install-alert"
            />
          </>
        );
      
      case 1:
        return (
          <div className="installation-progress">
            <Title level={4}>⏳ 正在准备安装...</Title>
            <Paragraph>请按照浏览器提示完成安装</Paragraph>
            <div className="loading-spinner"></div>
          </div>
        );
      
      case 2:
        return (
          <div className="installation-success">
            <CheckCircleOutlined className="success-icon" />
            <Title level={4}>✅ 安装成功！</Title>
            <Paragraph>Facebook Auto Bot 已成功安装</Paragraph>
            <Paragraph type="secondary">
              您现在可以从开始菜单或主屏幕启动应用
            </Paragraph>
          </div>
        );
      
      case 3:
        return (
          <div className="manual-instructions">
            <Title level={4}>📱 手动安装指南</Title>
            {getInstallInstructions()}
            
            <Alert
              message="提示"
              description={
                platform === 'mobile'
                  ? "如果看不到安装选项，请确保您使用的是最新版本的浏览器"
                  : "某些浏览器可能需要手动启用 PWA 安装功能"
              }
              type="warning"
              showIcon
              className="manual-instructions-alert"
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  const renderFooter = () => {
    switch (installationStep) {
      case 0:
        return (
          <Space>
            <Button 
              onClick={handleClose}
              icon={<CloseOutlined />}
            >
              稍后再说
            </Button>
            {canInstall ? (
              <Button
                type="primary"
                onClick={handleInstall}
                icon={<DownloadOutlined />}
                loading={installationStep === 1}
              >
                立即安装
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={showManualInstructions}
                icon={<InfoCircleOutlined />}
              >
                查看安装指南
              </Button>
            )}
          </Space>
        );
      
      case 1:
        return (
          <Button disabled>
            等待用户确认...
          </Button>
        );
      
      case 2:
        return (
          <Button type="primary" onClick={handleClose}>
            完成
          </Button>
        );
      
      case 3:
        return (
          <Space>
            <Button onClick={() => setInstallationStep(0)}>
              返回
            </Button>
            <Button type="primary" onClick={handleClose}>
              关闭
            </Button>
          </Space>
        );
      
      default:
        return null;
    }
  };

  if (isInstalled || userChoiceRemembered) {
    return null;
  }

  return (
    <Modal
      title={
        <Space>
          {platform === 'mobile' ? <MobileOutlined /> : <DesktopOutlined />}
          <span>安装 Facebook Auto Bot</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={renderFooter()}
      width={600}
      centered
      closable={installationStep !== 1}
      maskClosable={installationStep !== 1}
    >
      <div className="pwa-install-prompt">
        {renderContent()}
        
        {installationStep === 0 && (
          <div className="platform-info">
            <Text type="secondary">
              检测到您正在使用 {platform === 'mobile' ? '移动设备' : '桌面设备'} 上的 {browser} 浏览器
            </Text>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PWAInstallPrompt;