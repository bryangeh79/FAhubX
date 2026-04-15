import React, { useState } from 'react';
import { Card, Table, Tag, Space, Button, Input, Select, Form, Modal, message } from 'antd';
import { SearchOutlined, PlusOutlined, PlayCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const { Option } = Select;

// 对话剧本类型定义
interface ConversationScript {
  id: string;
  name: string;
  description: string;
  category: string;
  relationship: string;
  timeOfDay: string;
  estimatedDuration: number;
  difficulty: string;
  tags: string[];
  isActive: boolean;
  usageCount: number;
  successRate: number;
}

const ConversationPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedScript, setSelectedScript] = useState<ConversationScript | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 模拟数据
  const scripts: ConversationScript[] = [
    {
      id: '1',
      name: '早安问候',
      description: '向好友发送早安问候，开启美好的一天',
      category: '问候',
      relationship: '好友',
      timeOfDay: '早晨',
      estimatedDuration: 5,
      difficulty: '简单',
      tags: ['问候', '日常', '友好'],
      isActive: true,
      usageCount: 150,
      successRate: 95,
    },
    {
      id: '2',
      name: '生日祝福',
      description: '发送个性化的生日祝福消息',
      category: '祝福',
      relationship: '亲密好友',
      timeOfDay: '全天',
      estimatedDuration: 10,
      difficulty: '中等',
      tags: ['生日', '祝福', '个性化'],
      isActive: true,
      usageCount: 80,
      successRate: 92,
    },
    {
      id: '3',
      name: '活动邀请',
      description: '邀请朋友参加线上或线下活动',
      category: '邀请',
      relationship: '普通朋友',
      timeOfDay: '下午',
      estimatedDuration: 15,
      difficulty: '中等',
      tags: ['邀请', '活动', '社交'],
      isActive: true,
      usageCount: 45,
      successRate: 88,
    },
    {
      id: '4',
      name: '商务合作',
      description: '发起商务合作对话',
      category: '商务',
      relationship: '商业伙伴',
      timeOfDay: '工作时间',
      estimatedDuration: 20,
      difficulty: '困难',
      tags: ['商务', '合作', '专业'],
      isActive: true,
      usageCount: 30,
      successRate: 85,
    },
    {
      id: '5',
      name: '节日祝福',
      description: '发送节日祝福消息',
      category: '祝福',
      relationship: '所有关系',
      timeOfDay: '全天',
      estimatedDuration: 8,
      difficulty: '简单',
      tags: ['节日', '祝福', '传统'],
      isActive: false,
      usageCount: 200,
      successRate: 90,
    },
  ];

  // 表格列定义
  const columns = [
    {
      title: '剧本名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ConversationScript) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.description}</div>
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => (
        <Tag color="blue">{category}</Tag>
      ),
    },
    {
      title: '关系',
      dataIndex: 'relationship',
      key: 'relationship',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space size={[0, 4]} wrap>
          {tags.map(tag => (
            <Tag key={tag} color="geekblue">{tag}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      render: (difficulty: string) => {
        let color = '';
        switch (difficulty) {
          case '简单': color = 'green'; break;
          case '中等': color = 'orange'; break;
          case '困难': color = 'red'; break;
          default: color = 'default';
        }
        return <Tag color={color}>{difficulty}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '使用统计',
      key: 'stats',
      render: (_: any, record: ConversationScript) => (
        <div>
          <div>使用次数: {record.usageCount}</div>
          <div>成功率: {record.successRate}%</div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: ConversationScript) => (
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            size="small"
            onClick={() => handleRunScript(record)}
          >
            运行
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditScript(record)}
          >
            编辑
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={() => handleDeleteScript(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 过滤数据
  const filteredScripts = scripts.filter(script => {
    const matchesSearch = script.name.toLowerCase().includes(searchText.toLowerCase()) ||
                         script.description.toLowerCase().includes(searchText.toLowerCase()) ||
                         script.tags.some(tag => tag.toLowerCase().includes(searchText.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'all' || script.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // 处理运行剧本
  const handleRunScript = (script: ConversationScript) => {
    Modal.confirm({
      title: `运行剧本: ${script.name}`,
      content: `确定要运行"${script.name}"吗？`,
      onOk: () => {
        message.success(`开始运行剧本: ${script.name}`);
        // 这里应该调用API运行剧本
      },
    });
  };

  // 处理编辑剧本
  const handleEditScript = (script: ConversationScript) => {
    setSelectedScript(script);
    form.setFieldsValue(script);
    setIsModalVisible(true);
  };

  // 处理删除剧本
  const handleDeleteScript = (script: ConversationScript) => {
    Modal.confirm({
      title: `删除剧本: ${script.name}`,
      content: '确定要删除这个剧本吗？此操作不可撤销。',
      okText: '删除',
      okType: 'danger',
      onOk: () => {
        message.success(`剧本"${script.name}"已删除`);
        // 这里应该调用API删除剧本
      },
    });
  };

  // 处理创建新剧本
  const handleCreateScript = () => {
    setSelectedScript(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  // 处理保存剧本
  const handleSaveScript = async () => {
    try {
      const values = await form.validateFields();
      
      if (selectedScript) {
        // 更新现有剧本
        message.success(`剧本"${values.name}"已更新`);
      } else {
        // 创建新剧本
        message.success(`剧本"${values.name}"已创建`);
      }
      
      setIsModalVisible(false);
    } catch (error) {
      console.error('验证失败:', error);
    }
  };

  // 分类选项
  const categories = ['all', '问候', '祝福', '邀请', '商务', '其他'];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1>对话剧本管理</h1>
        <p>管理您的自动对话剧本，创建个性化的对话流程。</p>
      </div>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="搜索剧本名称、描述或标签"
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            
            <Select
              placeholder="选择分类"
              style={{ width: 150 }}
              value={categoryFilter}
              onChange={setCategoryFilter}
            >
              {categories.map(category => (
                <Option key={category} value={category}>
                  {category === 'all' ? '全部分类' : category}
                </Option>
              ))}
            </Select>
          </Space>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateScript}
          >
            创建新剧本
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={filteredScripts}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个剧本`,
          }}
        />
      </Card>

      {/* 剧本编辑/创建模态框 */}
      <Modal
        title={selectedScript ? '编辑剧本' : '创建新剧本'}
        open={isModalVisible}
        onOk={handleSaveScript}
        onCancel={() => setIsModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="剧本名称"
            rules={[{ required: true, message: '请输入剧本名称' }]}
          >
            <Input placeholder="例如：早安问候" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入剧本描述' }]}
          >
            <Input.TextArea
              placeholder="描述这个剧本的用途和场景"
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="选择分类">
              <Option value="问候">问候</Option>
              <Option value="祝福">祝福</Option>
              <Option value="邀请">邀请</Option>
              <Option value="商务">商务</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="relationship"
            label="关系类型"
            rules={[{ required: true, message: '请选择关系类型' }]}
          >
            <Select placeholder="选择关系类型">
              <Option value="亲密好友">亲密好友</Option>
              <Option value="好友">好友</Option>
              <Option value="普通朋友">普通朋友</Option>
              <Option value="商业伙伴">商业伙伴</Option>
              <Option value="陌生人">陌生人</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="difficulty"
            label="难度"
            rules={[{ required: true, message: '请选择难度' }]}
          >
            <Select placeholder="选择难度">
              <Option value="简单">简单</Option>
              <Option value="中等">中等</Option>
              <Option value="困难">困难</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="isActive"
            label="状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ConversationPage;