import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Space,
  Progress,
  Alert,
  List,
  Tag,
  Descriptions,
  Statistic,
  Collapse,
  Modal,
  Table,
  Tooltip,
  Badge,
  Switch,
  Input,
  Form,
  message,
  Radio
} from 'antd';
import {
  RocketOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
  NotificationOutlined,
  WifiOutlined,
  DatabaseOutlined,
  SettingOutlined,
  ExportOutlined,
  BugOutlined,
  ThunderboltOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { usePWA } from '../contexts/PWAContext';
import './PWATestPage.css';
import pwaTestUtils, { PWATestReport, PWATestResult } from '../utils/pwaTestUtils';
import notificationService, { NotificationType } from '../services/notificationService';
import './PWATestPage.css';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: Array<{
    name: string;
    description: string;
    run: () => Promise<PWATestResult>;
  }>;
}

const PWATestPage: React.FC = () => {
  const pwa = usePWA();
  const [testReport, setTestReport] = useState<PWATestReport | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [activeTestSuite, setActiveTestSuite] = useState<string>('full');
  const [lighthouseResults, setLighthouseResults] = useState<any>(null);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'text' | 'html'>('json');
  const [customTestName, setCustomTestName] = useState('');
  const [customTestDescription, setCustomTestDescription] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    // 加载初始测试报告
    const report = await runQuickTest();
    setTestReport(report);
  };

  const runQuickTest = async (): Promise<PWATestReport> => {
    const results: PWATestResult[] = [
      await pwaTestUtils.testServiceWorker(),
      await pwaTestUtils.testManifest(),
      await pwaTestUtils.testInstallability(),
      await pwaTestUtils.testOfflineSupport(),
    ];

    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const score = Math.round((passed / total) * 100);

    return {
      timestamp: Date.now(),
      results,
      summary: { total, passed, failed: total - passed, score },
      capabilities: await pwa.getCapabilities(),
      userAgent: navigator.userAgent,
      platform: navigator.platform
    };
  };

  const runFullTestSuite = async () => {
    setRunningTests(true);
    try {
      const report = await pwaTestUtils.runFullTestSuite();
      setTestReport(report);
      message.success(`测试完成！得分: ${report.summary.score}/100`);
    } catch (error) {
      message.error('测试失败: ' + error.message);
    } finally {
      setRunningTests(false);
    }
  };

  const runLighthouseAudit = async () => {
    setRunningTests(true);
    try {
      const results = await pwaTestUtils.runLighthouseAudit();
      setLighthouseResults(results);
      message.success('Lighthouse 审计完成！');
    } catch (error) {
      message.error('Lighthouse 审计失败: ' + error.message);
    } finally {
      setRunningTests(false);
    }
  };

  const runValidation = async () => {
    setRunningTests(true);
    try {
      const results = await pwaTestUtils.validatePWAStandards();
      setValidationResults(results);
      message.success('PWA 标准验证完成！');
    } catch (error) {
      message.error('验证失败: ' + error.message);
    } finally {
      setRunningTests(false);
    }
  };

  const runCustomTest = async () => {
    if (!customTestName.trim()) {
      message.warning('请输入测试名称');
      return;
    }

    setRunningTests(true);
    try {
      // 这里可以添加自定义测试逻辑
      await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟测试
      
      const result: PWATestResult = {
        name: customTestName,
        passed: Math.random() > 0.5, // 随机结果
        message: customTestDescription || '自定义测试完成',
        details: { timestamp: Date.now() }
      };

      if (testReport) {
        const updatedReport = {
          ...testReport,
          results: [...testReport.results, result],
          summary: {
            ...testReport.summary,
            total: testReport.summary.total + 1,
            passed: testReport.summary.passed + (result.passed ? 1 : 0),
            failed: testReport.summary.failed + (result.passed ? 0 : 1),
            score: Math.round(((testReport.summary.passed + (result.passed ? 1 : 0)) / (testReport.summary.total + 1)) * 100)
          }
        };
        setTestReport(updatedReport);
      }

      message.success(`自定义测试 "${customTestName}" 完成`);
      setCustomTestName('');
      setCustomTestDescription('');
    } catch (error) {
      message.error('自定义测试失败: ' + error.message);
    } finally {
      setRunningTests(false);
    }
  };

  const exportTestReport = () => {
    if (!testReport) {
      message.warning('没有测试报告可导出');
      return;
    }

    let content = '';
    let filename = '';
    let mimeType = '';

    switch (exportFormat) {
      case 'json':
        content = JSON.stringify(testReport, null, 2);
        filename = `pwa-test-report-${Date.now()}.json`;
        mimeType = 'application/json';
        break;
      case 'text':
        content = pwaTestUtils.exportTestReport(testReport);
        filename = `pwa-test-report-${Date.now()}.txt`;
        mimeType = 'text/plain';
        break;
      case 'html':
        content = generateHTMLReport(testReport);
        filename = `pwa-test-report-${Date.now()}.html`;
        mimeType = 'text/html';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    message.success(`报告已导出为 ${filename}`);
    setExportModalVisible(false);
  };

  const generateHTMLReport = (report: PWATestReport): string => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>PWA 测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #1890ff; color: white; padding: 20px; border-radius: 8px; }
        .summary { margin: 20px 0; }
        .test-result { margin: 10px 0; padding: 10px; border-left: 4px solid; }
        .passed { border-color: #52c41a; background: #f6ffed; }
        .failed { border-color: #ff4d4f; background: #fff2f0; }
        .score { font-size: 48px; font-weight: bold; color: #1890ff; }
    </style>
</head>
<body>
    <div class="header">
        <h1>PWA 测试报告</h1>
        <p>生成时间: ${new Date(report.timestamp).toLocaleString()}</p>
        <p>浏览器: ${report.userAgent}</p>
    </div>
    
    <div class="summary">
        <div class="score">${report.summary.score}/100</div>
        <p>总计: ${report.summary.total} 项测试 | 通过: ${report.summary.passed} | 失败: ${report.summary.failed}</p>
    </div>
    
    <h2>测试结果</h2>
    ${report.results.map(result => `
        <div class="test-result ${result.passed ? 'passed' : 'failed'}">
            <h3>${result.passed ? '✓' : '✗'} ${result.name}</h3>
            <p>${result.message}</p>
            ${result.details ? `<pre>${JSON.stringify(result.details, null, 2)}</pre>` : ''}
        </div>
    `).join('')}
</body>
</html>`;
  };

  const testSuites: TestSuite[] = [
    {
      id: 'full',
      name: '完整测试套件',
      description: '运行所有 PWA 功能测试',
      tests: [
        { name: 'Service Worker', description: '测试 Service Worker 注册和功能', run: pwaTestUtils.testServiceWorker },
        { name: 'Web App Manifest', description: '测试 manifest.json 配置', run: pwaTestUtils.testManifest },
        { name: '安装能力', description: '测试 PWA 安装支持', run: pwaTestUtils.testInstallability },
        { name: '离线支持', description: '测试离线缓存功能', run: pwaTestUtils.testOfflineSupport },
        { name: '推送通知', description: '测试推送通知支持', run: pwaTestUtils.testPushNotifications },
        { name: '后台同步', description: '测试后台同步功能', run: pwaTestUtils.testBackgroundSync },
        { name: '缓存性能', description: '测试缓存性能', run: pwaTestUtils.testCachePerformance },
        { name: '存储配额', description: '测试存储使用情况', run: pwaTestUtils.testStorageQuota },
      ]
    },
    {
      id: 'performance',
      name: '性能测试',
      description: '测试 PWA 性能相关功能',
      tests: [
        { name: '缓存性能', description: '测试缓存性能', run: pwaTestUtils.testCachePerformance },
        { name: '存储配额', description: '测试存储使用情况', run: pwaTestUtils.testStorageQuota },
        { name: 'Service Worker', description: '测试 Service Worker 性能', run: pwaTestUtils.testServiceWorker },
      ]
    },
    {
      id: 'compatibility',
      name: '兼容性测试',
      description: '测试浏览器和平台兼容性',
      tests: [
        { name: '浏览器兼容性', description: '测试浏览器支持', run: pwaTestUtils.testBrowserCompatibility },
        { name: '平台兼容性', description: '测试平台支持', run: pwaTestUtils.testPlatformCompatibility },
      ]
    }
  ];

  const renderTestResult = (result: PWATestResult) => {
    const statusColor = result.passed ? '#52c41a' : '#ff4d4f';
    const statusIcon = result.passed ? <CheckCircleOutlined /> : <CloseCircleOutlined />;
    
    return (
      <List.Item>
        <List.Item.Meta
          avatar={
            <Badge 
              color={statusColor}
              text={statusIcon}
            />
          }
          title={
            <Space>
              <Text strong>{result.name}</Text>
              <Tag color={result.passed ? 'success' : 'error'}>
                {result.passed ? '通过' : '失败'}
              </Tag>
            </Space>
          }
          description={
            <Space direction="vertical" size={0}>
              <Text>{result.message}</Text>
              {result.details && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  详情: {JSON.stringify(result.details)}
                </Text>
              )}
            </Space>
          }
        />
      </List.Item>
    );
  };

  const renderLighthouseResults = () => {
    if (!lighthouseResults) return null;

    const categories = [
      { key: 'performance', name: '性能', color: '#1890ff' },
      { key: 'pwa', name: 'PWA', color: '#52c41a' },
      { key: 'accessibility', name: '可访问性', color: '#faad14' },
      { key: 'bestPractices', name: '最佳实践', color: '#722ed1' },
      { key: 'seo', name: 'SEO', color: '#13c2c2' },
    ];

    return (
      <Card title="Lighthouse 审计结果" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          {categories.map(category => (
            <Col span={4} key={category.key}>
              <Card size="small">
                <Statistic
                  title={category.name}
                  value={lighthouseResults[category.key]}
                  suffix="/100"
                  valueStyle={{ color: category.color }}
                />
                <Progress 
                  percent={lighthouseResults[category.key]} 
                  strokeColor={category.color}
                  size="small"
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    );
  };

  const renderValidationResults = () => {
    if (!validationResults) return null;

    return (
      <Card title="PWA 标准验证" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            message={`基线标准: ${validationResults.meetsBaseline ? '符合' : '不符合'}`}
            type={validationResults.meetsBaseline ? 'success' : 'error'}
            showIcon
          />
          <Alert
            message={`完整标准: ${validationResults.meetsFull ? '符合' : '不符合'}`}
            type={validationResults.meetsFull ? 'success' : 'warning'}
            showIcon
          />
          
          <Collapse>
            <Panel header="基线标准检查" key="baseline">
              <List
                size="small"
                dataSource={validationResults.baselineChecks}
                renderItem={check => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Badge 
                          color={check.passed ? 'green' : 'red'}
                          text={check.passed ? '✓' : '✗'}
                        />
                      }
                      title={check.name}
                      description={check.description}
                    />
                  </List.Item>
                )}
              />
            </Panel>
            <Panel header="完整标准检查" key="full">
              <List
                size="small"
                dataSource={validationResults.fullChecks}
                renderItem={check => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Badge 
                          color={check.passed ? 'green' : 'red'}
                          text={check.passed ? '✓' : '✗'}
                        />
                      }
                      title={check.name}
                      description={check.description}
                    />
                  </List.Item>
                )}
              />
            </Panel>
          </Collapse>
        </Space>
      </Card>
    );
  };

  return (
    <div className="pwa-test-page">
      <Card>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>
              <RocketOutlined /> PWA 测试中心
            </Title>
            <Text type="secondary">
              测试和验证 Facebook Auto Bot 的 PWA 功能
            </Text>
          </Col>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={runFullTestSuite}
                loading={runningTests}
              >
                运行完整测试
              </Button>
              <Button
                icon={<ExportOutlined />}
                onClick={() => setExportModalVisible(true)}
              >
                导出报告
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 测试套件选择 */}
      <Card title="测试套件" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          {testSuites.map(suite => (
            <Col span={8} key={suite.id}>
              <Card
                hoverable
                onClick={() => setActiveTestSuite(suite.id)}
                style={{
                  borderColor: activeTestSuite === suite.id ? '#1890ff' : undefined,
                  borderWidth: activeTestSuite === suite.id ? 2 : 1
                }}
              >
                <Card.Meta
                  title={suite.name}
                  description={suite.description}
                />
                <Button
                  type="link"
                  style={{ marginTop: 12 }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setRunningTests(true);
                    const results = await Promise.all(suite.tests.map(test => test.run()));
                    const newReport = {
                      timestamp: Date.now(),
                      results,
                      summary: {
                        total: results.length,
                        passed: results.filter(r => r.passed).length,
                        failed: results.filter(r => !r.passed).length,
                        score: Math.round((results.filter(r => r.passed).length / results.length) * 100)
                      },
                      capabilities: await pwa.getCapabilities(),
                      userAgent: navigator.userAgent,
                      platform: navigator.platform
                    };
                    setTestReport(newReport);
                    setRunningTests(false);
                  }}
                >
                  运行此套件
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 测试结果 */}
      {testReport && (
        <Card title="测试结果" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="总分"
                  value={testReport.summary.score}
                  suffix="/100"
                  valueStyle={{ color: '#1890ff', fontSize: 36 }}
                />
                <Progress 
                  percent={testReport.summary.score} 
                  status="active"
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
              </Card>
            </Col>
            
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="通过"
                  value={testReport.summary.passed}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="失败"
                  value={testReport.summary.failed}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
            
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="总计"
                  value={testReport.summary.total}
                  valueStyle={{ color: '#faad14' }}
                  prefix={<InfoCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
          
          <List
            style={{ marginTop: 16 }}
            dataSource={testReport.results}
            renderItem={renderTestResult}
          />
        </Card>
      )}

      {/* 高级测试 */}
      <Card title="高级测试" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Card 
              hoverable
              onClick={runLighthouseAudit}
              loading={runningTests}
            >
              <Card.Meta
                avatar={<ThunderboltOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                title="Lighthouse 审计"
                description="运行 Lighthouse 性能审计"
              />
            </Card>
          </Col>
          
          <Col span={8}>
            <Card 
              hoverable
              onClick={runValidation}
              loading={runningTests}
            >
              <Card.Meta
                avatar={<SafetyOutlined style={{ fontSize: 24, color: '#52c41a' }} />}
                title="PWA 标准验证"
                description="验证是否符合 PWA 标准"
              />
            </Card>
          </Col>
          
          <Col span={8}>
            <Card hoverable>
              <Card.Meta
                avatar={<BugOutlined style={{ fontSize: 24, color: '#faad14' }} />}
                title="自定义测试"
                description="创建和运行自定义测试"
              />
              <div style={{ marginTop: 12 }}>
                <Input
                  placeholder="测试名称"
                  value={customTestName}
                  onChange={e => setCustomTestName(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <Input.TextArea
                  placeholder="测试描述"
                  value={customTestDescription}
                  onChange={e => setCustomTestDescription(e.target.value)}
                  rows={2}
                  style={{ marginBottom: 8 }}
                />
                <Button 
                  type="primary" 
                  onClick={runCustomTest}
                  block
                  loading={runningTests}
                >
                  运行自定义测试
                </Button>
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      {renderLighthouseResults()}
      {renderValidationResults()}

      {/* 系统信息 */}
      <Card title="系统信息" style={{ marginTop: 16 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="浏览器">
            {navigator.userAgent}
          </Descriptions.Item>
          <Descriptions.Item label="平台">
            {navigator.platform}
          </Descriptions.Item>
          <Descriptions.Item label="在线状态">
            <Badge 
              status={navigator.onLine ? 'success' : 'error'} 
              text={navigator.onLine ? '在线' : '离线'}
            />
          </Descriptions.Item>
          <Descriptions.Item label="PWA 安装状态">
            <Badge 
              status={pwa.isPWAInstalled() ? 'success' : 'default'} 
              text={pwa.isPWAInstalled() ? '已安装' : '未安装'}
            />
          </Descriptions.Item>
          <Descriptions.Item label="通知权限">
            <Badge 
              status={pwa.notificationPermission === 'granted' ? 'success' : 'warning'} 
              text={pwa.notificationPermission}
            />
          </Descriptions.Item>
          <Descriptions.Item label="Service Worker">
            <Badge 
              status={'serviceWorker' in navigator ? 'success' : 'error'} 
              text={'serviceWorker' in navigator ? '支持' : '不支持'}
            />
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 导出模态框 */}
      <Modal
        title="导出测试报告"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        onOk={exportTestReport}
        okText="导出"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>选择导出格式:</Text>
          <Radio.Group 
            value={exportFormat} 
            onChange={e => setExportFormat(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="json">JSON</Radio.Button>
            <Radio.Button value="text">文本</Radio.Button>
            <Radio.Button value="html">HTML</Radio.Button>
          </Radio.Group>
          
          {exportFormat === 'json' && (
            <Alert
              message="JSON 格式"
              description="导出为结构化 JSON 数据，适合程序处理"
              type="info"
              showIcon
            />
          )}
          
          {exportFormat === 'text' && (
            <Alert
              message="文本格式"
              description="导出为可读的文本报告，适合阅读"
              type="info"
              showIcon
            />
          )}
          
          {exportFormat === 'html' && (
            <Alert
              message="HTML 格式"
              description="导出为美观的 HTML 报告，适合分享"
              type="info"
              showIcon
            />
          )}
        </Space>
      </Modal>
    </div>
  );
};

export default PWATestPage;
