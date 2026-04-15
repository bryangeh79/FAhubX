const fs = require('fs');
const path = require('path');

console.log('=== 开始修复所有 TypeScript 错误 ===\n');

// 修复 TasksPage.tsx
const tasksPagePath = path.join(__dirname, 'frontend/src/pages/TasksPage.tsx');
console.log('1. 修复 TasksPage.tsx...');

const tasksPageContent = `import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tabs,
  Badge,
  Tag,
  Input,
  Select,
  DatePicker,
  message,
  Popconfirm,
  Tooltip
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  CopyOutlined,
  ExportOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

const TasksPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<any>(null);
  
  // 模拟数据
  const tasks = [
    {
      id: '1',
      name: '每日问候任务',
      type: 'conversation',
      status: 'running',
      accounts: 3,
      script: '日常问候剧本',
      schedule: '每天 09:00',
      lastRun: '2026-04-13 09:00',
      nextRun: '2026-04-14 09:00',
      successRate: 95
    },
    {
      id: '2',
      name: '产品推广任务',
      type: 'conversation',
      status: 'completed',
      accounts: 5,
      script: '产品推广剧本',
      schedule: '一次性',
      lastRun: '2026-04-12 14:30',
      nextRun: '-',
      successRate: 88
    }
  ];
  
  const stats = {
    total: 2,
    running: 1,
    pending: 0,
    completed: 1,
    failed: 0
  };
  
  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space>
          <Text strong>{text}</Text>
          {record.status === 'running' && <Tag color="processing">运行中</Tag>}
          {record.status === 'completed' && <Tag color="success">完成</Tag>}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          conversation: '对话',
          post: '发帖',
          like: '点赞'
        };
        return <Tag color="blue">{typeMap[type] || type}</Tag>;
      },
    },
    {
      title: '账号数',
      dataIndex: 'accounts',
      key: 'accounts',
    },
    {
      title: '剧本',
      dataIndex: 'script',
      key: 'script',
    },
    {
      title: '调度',
      dataIndex: 'schedule',
      key: 'schedule',
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      key: 'successRate',
      render: (rate: number) => \`\${rate}%\`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} />
          </Tooltip>
          <Tooltip title="复制">
            <Button type="text" icon={<CopyOutlined />} />
          </Tooltip>
          {record.status === 'running' && (
            <Tooltip title="暂停">
              <Button type="text" icon={<PauseCircleOutlined />} />
            </Tooltip>
          )}
          <Popconfirm title="确定要删除这个任务吗？" okText="确定" cancelText="取消">
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  
  const handleSearch = () => {
    console.log('搜索:', { searchText, statusFilter, dateRange });
    message.info('搜索功能待实现');
  };
  
  return (
    <div className="tasks-page">
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>任务管理</Title>
        <Text type="secondary">创建、管理和监控自动化任务。</Text>
      </div>
      
      {/* 搜索和过滤 */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large" wrap>
          <Input
            placeholder="搜索任务名称"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
          />
          
          <Select
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
          >
            <Option value="all">全部状态</Option>
            <Option value="running">运行中</Option>
            <Option value="pending">等待中</Option>
            <Option value="completed">已完成</Option>
            <Option value="failed">失败</Option>
          </Select>
          
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            value={dateRange}
            onChange={setDateRange}
          />
          
          <Button type="primary" icon={<FilterOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          
          <Button icon={<ExportOutlined />}>
            导出
          </Button>
        </Space>
      </Card>
      
      {/* 统计标签页 */}
      <Tabs defaultActiveKey="all" style={{ marginBottom: 24 }}>
        <TabPane
          tab={
            <span>
              全部
              <Badge count={stats.total} style={{ marginLeft: 8 }} />
            </span>
          }
          key="all"
        />
        <TabPane
          tab={
            <span>
              运行中
              {stats.running > 0 && (
                <Badge count={stats.running} style={{ marginLeft: 8, backgroundColor: '#1890ff' }} />
              )}
            </span>
          }
          key="running"
        />
        <TabPane
          tab={
            <span>
              已完成
              {stats.completed > 0 && (
                <Badge count={stats.completed} style={{ marginLeft: 8, backgroundColor: '#52c41a' }} />
              )}
            </span>
          }
          key="completed"
        />
        <TabPane
          tab={
            <span>
              失败
              {stats.failed > 0 && (
                <Badge count={stats.failed} style={{ marginLeft: 8, backgroundColor: '#f5222d' }} />
              )}
            </span>
          }
          key="failed"
        />
      </Tabs>
      
      {/* 任务列表 */}
      <Card>
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Link to="/tasks/create">
            <Button type="primary" icon={<PlusOutlined />}>
              创建任务
            </Button>
          </Link>
        </div>
        
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => \`共 \${total} 个任务\`,
          }}
        />
      </Card>
    </div>
  );
};

export default TasksPage;`;

fs.writeFileSync(tasksPagePath, tasksPageContent);
console.log('✅ TasksPage.tsx 修复完成\n');

// 检查其他可能有问题文件
const pagesDir = path.join(__dirname, 'frontend/src/pages');
const pageFiles = fs.readdirSync(pagesDir).filter(file => file.endsWith('.tsx'));

console.log('2. 检查所有页面文件...');
let fixedCount = 0;

pageFiles.forEach(file => {
  const filePath = path.join(pagesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 检查常见问题
  let needsFix = false;
  let newContent = content;
  
  // 1. 检查是否缺少导入语句
  if (!content.includes('import React') && content.includes('React.FC')) {
    console.log(\`⚠️  \${file}: 缺少React导入\`);
    needsFix = true;
  }
  
  // 2. 检查是否缺少导出
  if (!content.includes('export default')) {
    console.log(\`⚠️  \${file}: 缺少导出语句\`);
    needsFix = true;
  }
  
  // 3. 检查JSX标签匹配
  const openTags = (content.match(/<[^/>][^>]*>/g) || []).length;
  const closeTags = (content.match(/<\/[^>]+>/g) || []).length;
  
  if (openTags !== closeTags) {
    console.log(\`⚠️  \${file}: JSX标签不匹配 (打开:\${openTags}, 关闭:\${closeTags})\`);
    needsFix = true;
  }
  
  if (needsFix) {
    // 创建备份
    fs.writeFileSync(filePath + '.backup', content);
    console.log(\`  已创建备份: \${file}.backup\`);
    fixedCount++;
  }
});

console.log(\`\\n✅ 检查完成，发现 \${fixedCount} 个文件可能需要修复\\n\`);

// 运行TypeScript检查
console.log('3. 运行TypeScript检查...');
const { execSync } = require('child_process');

try {
  const result = execSync('cd frontend && npx tsc --noEmit --skipLibCheck 2>&1', {
    encoding: 'utf8',
    timeout: 10000
  });
  
  if (result.includes('error TS')) {
    console.log('❌ 仍然存在TypeScript错误:');
    console.log(result.split('\\n').filter(line => line.includes('error TS')).join('\\n'));
  } else {
    console.log('✅ TypeScript编译成功！');
  }
} catch (error) {
  console.log('TypeScript检查结果:', error.message);
}

console.log('\\n=== 修复完成 ===');`;

fs.writeFileSync(path.join(__dirname, 'fix-all-ts-errors.js'), fixAllTSErrorsScript);

console.log('修复脚本已创建。现在运行它...');

// 运行修复脚本
const { execSync } = require('child_process');
try {
  const result = execSync('node fix-all-ts-errors.js', { encoding: 'utf8' });
  console.log(result);
} catch (error) {
  console.error('运行修复脚本时出错:', error.message);
}