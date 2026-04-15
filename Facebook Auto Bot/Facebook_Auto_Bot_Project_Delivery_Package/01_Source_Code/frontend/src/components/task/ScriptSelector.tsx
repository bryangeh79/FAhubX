import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  Tag,
  Button,
  Modal,
  Space,
  Typography,
  List,
  Avatar,
  Badge,
  Tabs,
  Empty,
  Divider,
  Tooltip,
  Form,
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  EditOutlined,
  PlusOutlined,
  StarOutlined,
  StarFilled,
  FileTextOutlined,
  TagsOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';

import { ConversationScript } from '../../types/task';
import { conversationAPI } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface ScriptSelectorProps {
  value?: string;
  onChange?: (scriptId: string) => void;
  onScriptSelect?: (script: ConversationScript) => void;
}

const ScriptSelector: React.FC<ScriptSelectorProps> = ({
  value,
  onChange,
  onScriptSelect,
}) => {
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedScript, setSelectedScript] = useState<ConversationScript | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  // 获取剧本列表
  const { data: scriptsData, isLoading } = useQuery({
    queryKey: ['conversationScripts', searchText, categoryFilter],
    queryFn: () => conversationAPI.getScripts({
      search: searchText || undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
    }).then(res => res.data),
  });

  const scripts: ConversationScript[] = scriptsData?.scripts || [];

  // 获取常用剧本（模拟数据）
  const popularScripts = scripts
    .filter(script => script.tags.includes('popular'))
    .slice(0, 5);

  // 获取用户收藏的剧本
  const favoriteScripts = scripts.filter(script => favorites.includes(script.id));

  // 分类统计
  const categoryStats = {
    marketing: scripts.filter(s => s.category === 'marketing').length,
    customer_service: scripts.filter(s => s.category === 'customer_service').length,
    social: scripts.filter(s => s.category === 'social').length,
    engagement: scripts.filter(s => s.category === 'engagement').length,
    lead_generation: scripts.filter(s => s.category === 'lead_generation').length,
    other: scripts.filter(s => s.category === 'other').length,
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handleCategoryChange = (category: string) => {
    setCategoryFilter(category);
  };

  const handleScriptClick = (script: ConversationScript) => {
    setSelectedScript(script);
    onChange?.(script.id);
    onScriptSelect?.(script);
  };

  const handlePreview = (script: ConversationScript) => {
    setSelectedScript(script);
    setPreviewVisible(true);
  };

  const handleFavorite = (scriptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favorites.includes(scriptId)) {
      setFavorites(favorites.filter(id => id !== scriptId));
    } else {
      setFavorites([...favorites, scriptId]);
    }
  };

  const handleUseTemplate = () => {
    // 这里可以打开自定义剧本编辑器
    Modal.info({
      title: '自定义剧本',
      content: '自定义剧本功能正在开发中...',
    });
  };

  const renderCategoryTag = (category: string) => {
    const categoryConfig: Record<string, { color: string; text: string }> = {
      marketing: { color: 'green', text: '营销' },
      customer_service: { color: 'blue', text: '客服' },
      social: { color: 'purple', text: '社交' },
      engagement: { color: 'orange', text: '互动' },
      lead_generation: { color: 'red', text: '获客' },
      other: { color: 'default', text: '其他' },
    };
    const config = categoryConfig[category] || { color: 'default', text: '其他' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const renderScriptCard = (script: ConversationScript) => (
    <Card
      key={script.id}
      hoverable
      style={{ marginBottom: 16 }}
      onClick={() => handleScriptClick(script)}
      className={value === script.id ? 'selected-script' : ''}
      styles={{
        body: { padding: 12 },
      }}
    >
      <Row gutter={8} align="middle">
        <Col flex="auto">
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Text strong style={{ fontSize: 14 }}>
                  {script.name}
                </Text>
              </Col>
              <Col>
                <Button
                  type="text"
                  size="small"
                  icon={favorites.includes(script.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                  onClick={(e) => handleFavorite(script.id, e)}
                />
              </Col>
            </Row>
            
            <Text type="secondary" style={{ fontSize: 12 }}>
              {script.description?.substring(0, 60)}
              {script.description && script.description.length > 60 ? '...' : ''}
            </Text>
            
            <Space size={4} wrap>
              {renderCategoryTag(script.category)}
              {script.tags.slice(0, 3).map(tag => (
                <Tag key={tag} color="default" style={{ fontSize: 10 }}>
                  {tag}
                </Tag>
              ))}
              {script.tags.length > 3 && (
                <Tag color="default" style={{ fontSize: 10 }}>
                  +{script.tags.length - 3}
                </Tag>
              )}
            </Space>
            
            <Row justify="space-between" style={{ marginTop: 4 }}>
              <Col>
                <Text type="secondary" style={{ fontSize: 10 }}>
                  <UserOutlined /> {script.createdBy}
                </Text>
              </Col>
              <Col>
                <Text type="secondary" style={{ fontSize: 10 }}>
                  {dayjs(script.updatedAt).format('YYYY-MM-DD')}
                </Text>
              </Col>
            </Row>
          </Space>
        </Col>
        <Col>
          <Space direction="vertical">
            <Tooltip title="预览">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(script);
                }}
              />
            </Tooltip>
            <Tooltip title="使用次数">
              <Badge
                count={script.usageCount || 0}
                size="small"
                style={{ backgroundColor: '#52c41a' }}
              />
            </Tooltip>
          </Space>
        </Col>
      </Row>
    </Card>
  );

  const renderPreviewModal = () => (
    <Modal
      title={
        <Space>
          <FileTextOutlined />
          <span>剧本预览: {selectedScript?.name}</span>
        </Space>
      }
      open={previewVisible}
      onCancel={() => setPreviewVisible(false)}
      footer={[
        <Button key="close" onClick={() => setPreviewVisible(false)}>
          关闭
        </Button>,
        <Button
          key="use"
          type="primary"
          onClick={() => {
            if (selectedScript) {
              handleScriptClick(selectedScript);
              setPreviewVisible(false);
            }
          }}
        >
          使用此剧本
        </Button>,
      ]}
      width={800}
    >
      {selectedScript && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Text strong>剧本名称:</Text>
              <Paragraph>{selectedScript.name}</Paragraph>
            </Col>
            <Col span={12}>
              <Text strong>分类:</Text>
              <div style={{ marginTop: 8 }}>
                {renderCategoryTag(selectedScript.category)}
              </div>
            </Col>
          </Row>
          
          <Text strong>描述:</Text>
          <Paragraph>{selectedScript.description}</Paragraph>
          
          <Text strong>标签:</Text>
          <Space wrap style={{ marginBottom: 16 }}>
            {selectedScript.tags.map(tag => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
          
          <Text strong>剧本内容:</Text>
          <Card
            size="small"
            style={{
              backgroundColor: '#f6ffed',
              borderColor: '#b7eb8f',
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {selectedScript.content}
            </pre>
          </Card>
          
          {selectedScript.variables && Object.keys(selectedScript.variables).length > 0 && (
            <>
              <Text strong>可用变量:</Text>
              <Space wrap>
                {Object.entries(selectedScript.variables).map(([key, value]) => (
                  <Tag key={key} color="blue">
                    {`{{${key}}}`}: {value}
                  </Tag>
                ))}
              </Space>
            </>
          )}
          
          <Divider />
          
          <Row justify="space-between">
            <Col>
              <Text type="secondary">
                创建者: {selectedScript.createdBy}
              </Text>
            </Col>
            <Col>
              <Text type="secondary">
                更新时间: {dayjs(selectedScript.updatedAt).format('YYYY-MM-DD HH:mm')}
              </Text>
            </Col>
          </Row>
        </Space>
      )}
    </Modal>
  );

  return (
    <div className="script-selector">
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>对话剧本选择</span>
          </Space>
        }
        extra={
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleUseTemplate}
          >
            自定义剧本
          </Button>
        }
      >
        {/* 搜索和筛选 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Input
              placeholder="搜索剧本名称或描述..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={12}>
            <Select
              placeholder="按分类筛选"
              style={{ width: '100%' }}
              value={categoryFilter}
              onChange={handleCategoryChange}
              suffixIcon={<FilterOutlined />}
            >
              <Option value="all">全部分类 ({scripts.length})</Option>
              <Option value="marketing">营销 ({categoryStats.marketing})</Option>
              <Option value="customer_service">客服 ({categoryStats.customer_service})</Option>
              <Option value="social">社交 ({categoryStats.social})</Option>
              <Option value="engagement">互动 ({categoryStats.engagement})</Option>
              <Option value="lead_generation">获客 ({categoryStats.lead_generation})</Option>
              <Option value="other">其他 ({categoryStats.other})</Option>
            </Select>
          </Col>
        </Row>

        {/* 标签页 */}
        <Tabs defaultActiveKey="all">
          <TabPane tab={`全部剧本 (${scripts.length})`} key="all">
            {scripts.length === 0 ? (
              <Empty
                description="暂无剧本"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Row gutter={[16, 16]}>
                {scripts.map(script => (
                  <Col span={24} key={script.id}>
                    {renderScriptCard(script)}
                  </Col>
                ))}
              </Row>
            )}
          </TabPane>
          
          <TabPane tab={`常用剧本 (${popularScripts.length})`} key="popular">
            {popularScripts.length === 0 ? (
              <Empty
                description="暂无常用剧本"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Row gutter={[16, 16]}>
                {popularScripts.map(script => (
                  <Col span={24} key={script.id}>
                    {renderScriptCard(script)}
                  </Col>
                ))}
              </Row>
            )}
          </TabPane>
          
          <TabPane tab={`我的收藏 (${favoriteScripts.length})`} key="favorites">
            {favoriteScripts.length === 0 ? (
              <Empty
                description="暂无收藏的剧本"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Row gutter={[16, 16]}>
                {favoriteScripts.map(script => (
                  <Col span={24} key={script.id}>
                    {renderScriptCard(script)}
                  </Col>
                ))}
              </Row>
            )}
          </TabPane>
        </Tabs>

        {/* 已选剧本提示 */}
        {value && (
          <Card
            type="inner"
            size="small"
            style={{ marginTop: 16, backgroundColor: '#e6f7ff' }}
          >
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Text strong>已选择剧本:</Text>
                  <Text>{scripts.find(s => s.id === value)?.name}</Text>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      const script = scripts.find(s => s.id === value);
                      if (script) handlePreview(script);
                    }}
                  >
                    预览
                  </Button>
                </Space>
              </Col>
              <Col>
                <Button
                  type="link"
                  danger
                  size="small"
                  onClick={() => onChange?.('')}
                >
                  取消选择
                </Button>
              </Col>
            </Row>
          </Card>
        )}
      </Card>

      {renderPreviewModal()}
    </div>
  );
};

import dayjs from 'dayjs';

export default ScriptSelector;