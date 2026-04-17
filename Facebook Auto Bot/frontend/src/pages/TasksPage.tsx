import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Typography, Tag, Modal, Form, Input, Select,
  message, Row, Col, Statistic, Popconfirm, Switch, Divider, List, Badge,
  Tabs, Alert, InputNumber, Tooltip, Upload, Steps,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined,
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
  MessageOutlined, PictureOutlined, VideoCameraOutlined, PhoneOutlined,
  RobotOutlined, KeyOutlined, SearchOutlined, UserOutlined, SwapOutlined,
  ThunderboltOutlined, ApiOutlined, SettingOutlined, EyeOutlined, EditOutlined,
  SaveOutlined, PlusCircleOutlined, MinusCircleOutlined,
  UserAddOutlined, CommentOutlined, HeartOutlined, AppstoreOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import { Checkbox } from 'antd';
import dayjs from 'dayjs';
import AppLayout from '../components/AppLayout';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
type TaskType = 'auto_chat' | 'auto_post_image' | 'auto_post_video' | 'auto_call' | 'account_sync' | 'auto_simulate'
  | 'auto_add_friends' | 'auto_accept_requests' | 'auto_comment' | 'auto_follow' | 'auto_combo';

interface Task {
  id: string;
  name: string;
  accountName: string;
  taskType: TaskType;
  status: TaskStatus;
  scheduledAt: string;
  lastExecutedAt?: string;
  repeatCycle?: string;
  errorReason?: string;
  batchId?: string;
  batchGroup?: number;
}

// 50 chat scripts
const CHAT_SCRIPTS = Array.from({ length: 50 }, (_, i) => ({
  id: `script-${i + 1}`,
  title: `聊天模式${i + 1}`,
  preview: '点击选择此聊天模式...',
  rounds: Math.floor(Math.random() * 8) + 3,
  category: ['推广', '问候', '活动', '售后', '邀请'][i % 5],
}));

const AI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (OpenAI)' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (OpenAI)' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (Anthropic)' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku (Anthropic)' },
  { value: 'gemini-pro', label: 'Gemini Pro (Google)' },
];

const initialTasks: Task[] = [
  { id: '1', name: '每日自动问候', accountName: 'John Doe', taskType: 'auto_chat', status: 'running', scheduledAt: '2026-04-13T09:00:00Z', lastExecutedAt: '2026-04-13T09:00:05Z' },
  { id: '2', name: '产品推广发帖', accountName: 'Jane Smith', taskType: 'auto_post_image', status: 'completed', scheduledAt: '2026-04-13T08:00:00Z', lastExecutedAt: '2026-04-13T08:00:12Z' },
  { id: '3', name: '账号信息同步', accountName: 'Bryan Geh', taskType: 'account_sync', status: 'pending', scheduledAt: '2026-04-14T10:00:00Z' },
  { id: '4', name: '夜间互动任务', accountName: 'John Doe', taskType: 'auto_chat', status: 'failed', scheduledAt: '2026-04-12T23:00:00Z', lastExecutedAt: '2026-04-12T23:01:30Z' },
  { id: '5', name: '每周群发公告', accountName: 'Jane Smith', taskType: 'auto_post_image', status: 'pending', scheduledAt: '2026-04-15T22:00:00Z' },
];

const TASK_TYPE_CONFIG: Record<TaskType, { color: string; text: string; icon: React.ReactNode }> = {
  auto_chat:            { color: 'blue',     text: '自动聊天',    icon: <MessageOutlined /> },
  auto_post_image:      { color: 'purple',   text: '自动发图',    icon: <PictureOutlined /> },
  auto_post_video:      { color: 'magenta',  text: '自动发视频',  icon: <VideoCameraOutlined /> },
  auto_call:            { color: 'green',    text: '自动拨号',    icon: <PhoneOutlined /> },
  account_sync:         { color: 'orange',   text: '账号同步',    icon: <SwapOutlined /> },
  auto_simulate:        { color: 'cyan',     text: '模拟真人',    icon: <EyeOutlined /> },
  auto_add_friends:     { color: 'geekblue', text: '自动加好友',  icon: <UserAddOutlined /> },
  auto_accept_requests: { color: 'green',    text: '接受好友申请', icon: <CheckCircleOutlined /> },
  auto_comment:         { color: 'gold',     text: '自动留言',    icon: <CommentOutlined /> },
  auto_follow:          { color: 'volcano',  text: '自动 Follow', icon: <HeartOutlined /> },
  auto_combo:           { color: 'purple',   text: '组合任务',    icon: <AppstoreOutlined /> },
};

const STATUS_CONFIG: Record<TaskStatus, { color: string; icon: React.ReactNode; text: string }> = {
  pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
  running: { color: 'blue', icon: <LoadingOutlined />, text: '运行中' },
  completed: { color: 'green', icon: <CheckCircleOutlined />, text: '已完成' },
  failed: { color: 'red', icon: <CloseCircleOutlined />, text: '失败' },
};

// ─── AI Settings Modal ───────────────────────────────────────────────────────
const AISettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleTest = async () => {
    const values = form.getFieldsValue();
    if (!values.apiKey) { message.warning('请先输入 API Key'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      // Simulate API test
      await new Promise(r => setTimeout(r, 1500));
      // In real implementation, call backend to test the API key
      setTestResult({ ok: true, msg: `连接成功！模型 ${values.model || 'gpt-4o'} 可用` });
    } catch {
      setTestResult({ ok: false, msg: '连接失败，请检查 API Key 是否正确' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    // Save to localStorage for now (in real app, save to backend user settings)
    localStorage.setItem('ai_settings', JSON.stringify(values));
    message.success('AI 设置已保存');
    onClose();
  };

  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem('ai_settings');
      if (saved) form.setFieldsValue(JSON.parse(saved));
    }
  }, [open, form]);

  return (
    <Modal title={<Space><RobotOutlined style={{ color: '#722ed1' }} /> AI 辅助设置</Space>}
      open={open} onOk={handleSave} onCancel={onClose} okText="保存" cancelText="取消" width={520}>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="provider" label="AI 服务商" initialValue="openai">
          <Select>
            <Option value="openai">OpenAI</Option>
            <Option value="anthropic">Anthropic (Claude)</Option>
            <Option value="google">Google (Gemini)</Option>
          </Select>
        </Form.Item>
        <Form.Item name="model" label="使用模型" initialValue="gpt-4o">
          <Select showSearch>
            {AI_MODELS.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入 API Key' }]}>
          <Input.Password prefix={<KeyOutlined />} placeholder="sk-..." />
        </Form.Item>
        <Form.Item name="baseUrl" label="自定义 API 地址（可选）" extra="留空则使用默认地址">
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>
        <Form.Item name="temperature" label="创造性 (Temperature)" initialValue={0.7}>
          <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
        </Form.Item>
        <Space>
          <Button icon={<ThunderboltOutlined />} loading={testing} onClick={handleTest}>
            测试连接
          </Button>
          {testResult && (
            <Tag color={testResult.ok ? 'green' : 'red'}>
              {testResult.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />} {testResult.msg}
            </Tag>
          )}
        </Space>
      </Form>
    </Modal>
  );
};

// ─── Script Selector ─────────────────────────────────────────────────────────
const ScriptSelector: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  scripts?: typeof CHAT_SCRIPTS;
}> = ({ value, onChange, scripts: propScripts }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('全部');
  const sourceScripts = propScripts || CHAT_SCRIPTS;

  const filtered = sourceScripts.filter(s =>
    (category === '全部' || s.category === category) &&
    (!search || s.title.includes(search))
  );

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
        <Space>
          <Input
            size="small"
            prefix={<SearchOutlined />}
            placeholder="搜索剧本..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 160 }}
          />
          <Select size="small" value={category} onChange={setCategory} style={{ width: 80 }}>
            {['全部', '推广', '问候', '活动', '售后', '邀请'].map(c => <Option key={c} value={c}>{c}</Option>)}
          </Select>
          <Text type="secondary" style={{ fontSize: 12 }}>共 {filtered.length} 个剧本</Text>
        </Space>
      </div>
      <div style={{ height: 200, overflowY: 'auto' }}>
        <List
          size="small"
          dataSource={filtered as typeof CHAT_SCRIPTS}
          renderItem={script => (
            <List.Item
              onClick={() => onChange?.(script.id)}
              style={{
                cursor: 'pointer',
                padding: '6px 12px',
                background: value === script.id ? '#e6f4ff' : 'transparent',
                borderLeft: value === script.id ? '3px solid #1677ff' : '3px solid transparent',
              }}
            >
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space direction="vertical" size={0}>
                  <Text strong style={{ fontSize: 13 }}>{script.title}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{script.preview}</Text>
                </Space>
                <Space direction="vertical" size={0} style={{ textAlign: 'right', minWidth: 60 }}>
                  <Tag color="blue" style={{ fontSize: 10 }}>{script.category}</Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>{script.rounds} 轮对话</Text>
                </Space>
              </Space>
            </List.Item>
          )}
        />
      </div>
    </div>
  );
};

// ─── Script Editor Modal ──────────────────────────────────────────────────────
const ScriptEditorModal: React.FC<{
  scriptId: string | null;
  onClose: () => void;
}> = ({ scriptId, onClose }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!scriptId) return;
    api.get(`/chat-scripts/${scriptId}`).then(res => {
      const s = res.data?.data || res.data;
      form.setFieldsValue({
        title: s.title,
        goal: s.goal,
        systemPrompt: s.systemPrompt,
        phases: s.phases?.length ? s.phases : [{ label: '第一阶段', messages: [''] }],
      });
    }).catch(() => {});
  }, [scriptId, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.put(`/chat-scripts/${scriptId}`, values);
      message.success('剧本已保存');
      onClose();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={<Space><EditOutlined style={{ color: '#1677ff' }} /> 编辑聊天剧本</Space>}
      open={!!scriptId}
      onOk={handleSave}
      onCancel={onClose}
      okText={<Space><SaveOutlined />保存</Space>}
      cancelText="取消"
      width={680}
      confirmLoading={saving}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="title" label="剧本名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="goal" label="对话目标" extra="告诉 AI 这个剧本的最终目的（AI 模式下使用）">
          <TextArea rows={2} placeholder="例如：引导用户了解我们的产品，最终促成下单或留下联系方式" />
        </Form.Item>
        <Form.Item name="systemPrompt" label="AI 系统提示词" extra="AI 模式下发给 AI 的角色设定，留空则使用默认提示词">
          <TextArea rows={3} placeholder="例如：你是一个友善的Facebook销售助手，用轻松自然的语气和用户聊天..." />
        </Form.Item>

        <Divider>对话阶段（非AI模式逐条发送）</Divider>

        <Form.List name="phases">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, idx) => (
                <Card
                  key={field.key}
                  size="small"
                  style={{ marginBottom: 12 }}
                  title={
                    <Space>
                      <Tag color="blue">第 {idx + 1} 阶段</Tag>
                      <Form.Item {...field} name={[field.name, 'label']} noStyle>
                        <Input size="small" style={{ width: 160 }} placeholder="阶段名称" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'sender']} noStyle initialValue={idx % 2 === 0 ? 'A' : 'B'}>
                        <Select size="small" style={{ width: 120 }}>
                          <Option value="A">
                            <Tag color="blue" style={{ margin: 0 }}>账号 A 发送</Tag>
                          </Option>
                          <Option value="B">
                            <Tag color="green" style={{ margin: 0 }}>账号 B 发送</Tag>
                          </Option>
                        </Select>
                      </Form.Item>
                    </Space>
                  }
                  extra={
                    fields.length > 1 && (
                      <Button size="small" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    )
                  }
                >
                  <Form.List name={[field.name, 'messages']}>
                    {(msgFields, { add: addMsg, remove: removeMsg }) => (
                      <>
                        {msgFields.map((msgField, mIdx) => (
                          <Space key={msgField.key} style={{ display: 'flex', marginBottom: 6 }} align="start">
                            <Tag style={{ marginTop: 4 }}>{mIdx + 1}</Tag>
                            <Form.Item {...msgField} noStyle>
                              <Input.TextArea
                                rows={2}
                                style={{ width: 400 }}
                                placeholder="输入发送的消息内容..."
                              />
                            </Form.Item>
                            <Button
                              size="small"
                              danger
                              icon={<MinusCircleOutlined />}
                              onClick={() => removeMsg(msgField.name)}
                            />
                          </Space>
                        ))}
                        <Button
                          size="small"
                          icon={<PlusCircleOutlined />}
                          onClick={() => addMsg('')}
                          style={{ marginTop: 4 }}
                        >
                          添加消息
                        </Button>
                      </>
                    )}
                  </Form.List>
                </Card>
              ))}
              <Button
                icon={<PlusOutlined />}
                onClick={() => add({
                  label: `第 ${fields.length + 1} 阶段`,
                  sender: fields.length % 2 === 0 ? 'A' : 'B',
                  messages: [''],
                })}
              >
                添加阶段
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
// ─── Execution Log Modal ──────────────────────────────────────────────────────
const LOG_LEVEL_COLOR: Record<string, string> = {
  info: '#1677ff',
  success: '#52c41a',
  warn: '#faad14',
  error: '#f5222d',
};

const ExecutionLogModal: React.FC<{
  taskId: string | null;
  taskName: string;
  onClose: () => void;
  onStatusChange?: (id: string, status: TaskStatus) => void;
}> = ({ taskId, taskName, onClose, onStatusChange }) => {
  const [logs, setLogs] = useState<Array<{ time: string; level: string; message: string }>>([]);
  const [status, setStatus] = useState<string>('running');
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [startTime, setStartTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const logEndRef = React.useRef<HTMLDivElement>(null);

  // Use ref for onStatusChange to avoid infinite loop:
  // The parent passes an inline arrow function which creates a new reference on every render.
  // If we put it in useEffect deps, it triggers re-run → setLogs → parent re-render → new ref → loop.
  const onStatusChangeRef = React.useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  // Parse total duration from log messages (e.g. "模拟时长：10 分钟")
  const totalSeconds = React.useMemo(() => {
    const match = logs.find(l => l.message.includes('模拟时长'));
    if (!match) return 0;
    const m = match.message.match(/(\d+)\s*分钟/);
    return m ? parseInt(m[1]) * 60 : 0;
  }, [logs]);

  useEffect(() => {
    if (!taskId) return;
    setLogs([]);
    setStatus('running');
    setErrorReason(null);
    // 切换任务时重置起始时间（以该任务首条日志的时间戳为准，fetchLogs 里会校准）
    setStartTime(Date.now());
    setElapsed(0);
    setStopping(false);

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let elapsedInterval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    // Helper: stop ALL timers when task finishes
    const stopAllTimers = () => {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null; }
    };

    const fetchLogs = async () => {
      try {
        const res = await api.get(`/tasks/${taskId}/logs`);
        const data = res.data?.data || res.data;
        if (cancelled) return 'running';
        const logList = data?.logs || [];
        setLogs(logList);
        // 用首条日志的时间戳校准 startTime，避免组件复用导致时间错乱
        if (logList.length > 0 && logList[0].timestamp) {
          const firstTs = new Date(logList[0].timestamp).getTime();
          if (!Number.isNaN(firstTs)) setStartTime(firstTs);
        }
        const s = data?.status || 'running';
        setStatus(s);
        if (data?.errorReason) setErrorReason(data.errorReason);
        return s;
      } catch {}
      return 'running';
    };

    // Start elapsed timer immediately
    elapsedInterval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);

    // Fetch immediately on open
    fetchLogs().then(s => {
      if (cancelled) return;
      if (s === 'completed' || s === 'failed' || s === 'cancelled') {
        stopAllTimers();
        onStatusChangeRef.current?.(taskId, s as TaskStatus);
        return; // Already done — no need to poll
      }
      // Only poll if still running
      pollInterval = setInterval(async () => {
        const s2 = await fetchLogs();
        if (cancelled) return;
        if (s2 === 'completed' || s2 === 'failed' || s2 === 'cancelled') {
          stopAllTimers();
          onStatusChangeRef.current?.(taskId, s2 as TaskStatus);
        }
      }, 2000);
    });

    // Cleanup: clear ALL intervals on unmount or taskId change
    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      if (elapsedInterval) clearInterval(elapsedInterval);
    };
  }, [taskId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const isDone = status === 'completed' || status === 'failed' || status === 'cancelled';

  const handleStop = async () => {
    if (!taskId) return;
    setStopping(true);
    try {
      await api.post(`/tasks/${taskId}/cancel`);
      setStatus('cancelled');
      onStatusChange?.(taskId, 'failed');
      message.info('已发送停止信号，浏览器将在当前操作完成后关闭');
    } catch {
      message.error('停止失败');
    } finally {
      setStopping(false);
    }
  };

  const progressPct = totalSeconds > 0 ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0;

  return (
    <Modal
      title={
        <Space>
          {isDone
            ? <CheckCircleOutlined style={{ color: status === 'completed' ? '#52c41a' : '#f5222d' }} />
            : <LoadingOutlined style={{ color: '#1677ff' }} />}
          执行日志：{taskName}
          <Tag color={status === 'completed' ? 'green' : status === 'failed' ? 'red' : status === 'cancelled' ? 'default' : 'processing'}>
            {status === 'completed' ? '✅ 已完成' : status === 'failed' ? '❌ 失败' : status === 'cancelled' ? '⏹ 已停止' : '⚙️ 执行中...'}
          </Tag>
        </Space>
      }
      open={!!taskId}
      onCancel={onClose}
      footer={
        <Space>
          {!isDone && (
            <Button danger loading={stopping} onClick={handleStop} icon={<CloseCircleOutlined />}>
              强制停止
            </Button>
          )}
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
      width={700}
    >
      {/* Progress bar for timed tasks */}
      {totalSeconds > 0 && !isDone && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 4 }}>
            <span>⏱ 已用时 {Math.floor(elapsed / 60)}分{elapsed % 60}秒</span>
            <span>预计总时长 {Math.floor(totalSeconds / 60)} 分钟</span>
          </div>
          <div style={{ background: '#1a1a2e', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${progressPct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #1677ff, #52c41a)',
              transition: 'width 1s linear',
              borderRadius: 4,
            }} />
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#555', marginTop: 2 }}>{progressPct}%</div>
        </div>
      )}

      {/* Failure reason banner */}
      {status === 'failed' && errorReason && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="任务执行失败"
          description={
            <div>
              <Text strong>失败原因：</Text>
              <Text code style={{ fontSize: 12, display: 'block', marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {errorReason}
              </Text>
              <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                💡 常见原因：账号 Session 过期需重新登录 / Facebook 弹出验证 / 网络超时
              </div>
            </div>
          }
        />
      )}

      <div style={{
        background: '#0d1117',
        borderRadius: 8,
        padding: '12px 16px',
        minHeight: 280,
        maxHeight: 380,
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: 13,
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center', paddingTop: 60 }}>
            {isDone ? (
              <>
                <CheckCircleOutlined style={{ fontSize: 24, marginBottom: 8, color: '#555' }} />
                <div>此次执行未保留日志记录</div>
                <div style={{ fontSize: 11, marginTop: 4, color: '#444' }}>下次执行后即可在此查看完整日志</div>
              </>
            ) : (
              <>
                <LoadingOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                <div>等待执行日志...</div>
              </>
            )}
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{ marginBottom: 4, color: LOG_LEVEL_COLOR[log.level] || '#e6edf3' }}>
              <span style={{ color: '#555', marginRight: 10 }}>[{log.time}]</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
      {!isDone && (
        <div style={{ marginTop: 6, color: '#666', fontSize: 12 }}>
          <LoadingOutlined style={{ marginRight: 4 }} /> 每 2 秒自动刷新 · 浏览器正在后台执行操作
        </div>
      )}
    </Modal>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [scriptEditorId, setScriptEditorId] = useState<string | null>(null);
  const [scripts, setScripts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [taskType, setTaskType] = useState<TaskType | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [logModalTask, setLogModalTask] = useState<{ id: string; name: string } | null>(null);
  const [comboActions, setComboActions] = useState<string[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSize, setBatchSize] = useState(4);
  const [headlessMode, setHeadlessMode] = useState(true); // VPS 默认无头
  const [form] = Form.useForm();

  const fetchTasks = () => {
    api.get('/tasks?limit=100').then(res => {
      const data = res.data?.data;
      const list = data?.tasks || (Array.isArray(data) ? data : []);
      setTasks(list.map((t: any) => ({
        id: t.id,
        name: t.name,
        accountName: t.executionData?.parameters?.accountName || t.accountId || '—',
        taskType: (t.taskAction || t.executionData?.parameters?.taskAction || 'account_sync') as TaskType,
        status: (t.status === 'queued' ? 'pending' : t.status) as any,
        scheduledAt: t.scheduledAt || t.createdAt,
        lastExecutedAt: t.completedAt,
        repeatCycle: t.scheduleConfig?.recurringType,
        errorReason: t.result?.error || undefined,
        batchId: t.executionData?.parameters?.batchId,
        batchGroup: t.executionData?.parameters?.batchGroup,
      })));
    }).catch(() => {});
  };

  useEffect(() => {
    api.get('/facebook-accounts?limit=100').then(res => {
      setAccounts(res.data?.data?.accounts || []);
    }).catch(() => {});
    api.get('/chat-scripts').then(res => {
      const list = res.data?.data || res.data || [];
      setScripts(Array.isArray(list) ? list : []);
    }).catch(() => {});
    fetchTasks();

    // Auto-refresh task list every 30s to reflect scheduled executions
    const refreshInterval = setInterval(fetchTasks, 30000);
    return () => clearInterval(refreshInterval);
  }, []);

  const totalTasks = tasks.length;
  const runningTasks = tasks.filter(t => t.status === 'running').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const failedTasks = tasks.filter(t => t.status === 'failed').length;

  const handleCreateClick = () => {
    form.resetFields();
    setTaskType(null);
    setAiEnabled(false);
    setComboActions([]);
    setBatchMode(false);
    setIsModalVisible(true);
  };

  const handleShowBrowser = async (task: Task) => {
    try {
      await api.post(`/tasks/${task.id}/show-browser`);
      message.success('浏览器窗口已打开（仅桌面环境有效）');
    } catch {
      message.error('操作失败');
    }
  };

  // Helper: build a single task payload for one accountId
  const buildPayload = (
    values: any,
    accountId: string,
    hl: boolean,
    batchMeta?: { batchId: string; batchGroup: number },
  ) => {
    const accA = accounts.find(a => a.id === accountId);
    const accB = accounts.find(a => a.id === values.accountBId);
    const accountName = accA ? `${accA.name}${accB ? ` ↔ ${accB.name}` : ''}` : accountId;
    return {
      name: values.name,
      type: values.scheduledAt ? 'scheduled' : 'immediate',
      taskAction: values.taskType,
      accountId,
      accountBId: values.accountBId,
      scheduleConfig: values.scheduledAt ? { scheduledAt: new Date(values.scheduledAt) } : undefined,
      executionData: {
        scriptId: values.taskType,
        scriptType: 'dialogue',
        targets: [],
        parameters: {
          taskAction: values.taskType,
          accountName,
          accountAId: accountId,
          accountBId: values.accountBId,
          headless: hl,
          ...(batchMeta ?? {}),
          scriptId: values.scriptId,
          aiEnabled: values.aiEnabled,
          content: values.postContent,
          imageUrls: values.imageUrls,
          videoUrl: values.videoUrl,
          callDuration: values.callDuration,
          syncAccountIds: values.syncAccountIds,
          durationMinutes: values.durationMinutes,
          warmingActions: values.warmingActions,
          dailyLimit: values.dailyLimit,
          prioritizeMutual: values.prioritizeMutual,
          maxCount: values.maxCount,
          comments: typeof values.comments === 'string'
            ? values.comments.split('\n').map((s: string) => s.trim()).filter(Boolean)
            : values.comments,
          delayMin: values.delayMin,
          delayMax: values.delayMax,
          comboActions: values.taskType === 'auto_combo' ? comboActions.map(type => ({
            type,
            ...(type === 'auto_accept_requests' && { maxCount: values.comboAcceptMax }),
            ...(type === 'auto_add_friends' && {
              dailyLimit: values.comboAddLimit,
              delayMin: values.comboAddDelayMin,
              delayMax: values.comboAddDelayMax,
              prioritizeMutual: true,
            }),
            ...(type === 'auto_comment' && {
              comments: typeof values.comboComments === 'string'
                ? values.comboComments.split('\n').map((s: string) => s.trim()).filter(Boolean)
                : ['👍', '非常棒！', '赞！'],
              dailyLimit: values.comboCommentLimit,
              delayMin: values.comboCommentDelayMin,
              delayMax: values.comboCommentDelayMax,
            }),
            ...(type === 'auto_follow' && {
              dailyLimit: values.comboFollowLimit,
              delayMin: values.comboFollowDelayMin,
              delayMax: values.comboFollowDelayMax,
            }),
          })) : undefined,
        },
      },
    };
  };

  const handleModalOk = async () => {
    let values: any;
    try { values = await form.validateFields(); } catch { return; }

    // Social task types that support multi-account batch mode
    const socialTypes: TaskType[] = ['auto_combo', 'auto_add_friends', 'auto_accept_requests', 'auto_comment', 'auto_follow', 'auto_simulate', 'auto_post_image', 'auto_post_video'];
    const isBatchable = socialTypes.includes(values.taskType);
    const isBatch = batchMode && isBatchable && Array.isArray(values.batchAccountIds) && values.batchAccountIds.length > 1;

    setSubmitting(true);
    try {
      if (!isBatch) {
        // ── Single account ─────────────────────────────────────────────────
        const singleAccountId = values.accountAId || values.accountId;
        const payload = buildPayload(values, singleAccountId, headlessMode);
        const res = await api.post('/tasks', payload);
        const t = res.data?.data || res.data;
        const accA = accounts.find(a => a.id === singleAccountId);
        const accB = accounts.find(a => a.id === values.accountBId);
        const accountName = accA ? `${accA.name}${accB ? ` ↔ ${accB.name}` : ''}` : '未知账号';
        const newTask: Task = {
          id: t.id || Date.now().toString(),
          name: values.name,
          accountName,
          taskType: values.taskType,
          status: 'pending',
          scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : new Date().toISOString(),
          repeatCycle: values.repeatCycle,
        };
        setTasks(prev => [newTask, ...prev]);
        message.success('任务创建成功');
      } else {
        // ── Batch: multiple accounts, split into groups ────────────────────
        const batchId = crypto.randomUUID();
        const accountIds: string[] = values.batchAccountIds;
        const taskPayloads = accountIds.map((accountId, index) =>
          buildPayload(values, accountId, headlessMode, {
            batchId,
            batchGroup: Math.floor(index / batchSize),
          })
        );
        const res = await api.post('/tasks/batch', { tasks: taskPayloads });
        const groups = Math.ceil(accountIds.length / batchSize);
        message.success(`已创建 ${res.data?.count ?? taskPayloads.length} 个任务，分 ${groups} 批依次执行`);
        fetchTasks();
      }

      setIsModalVisible(false);
      form.resetFields();
      setBatchMode(false);
    } catch (err: any) {
      message.error(err?.response?.data?.message || '创建失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/tasks/${id}`);
    } catch (_) { /* ignore if not found */ }
    setTasks(prev => prev.filter(t => t.id !== id));
    message.success('任务已删除');
  };

  const handleToggle = (task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? {
      ...t,
      status: t.status === 'running' ? 'pending' : 'running',
    } : t));
    message.info(task.status === 'running' ? '任务已暂停' : '任务已启动');
  };

  const handleExecute = async (task: Task) => {
    try {
      await api.post(`/tasks/${task.id}/execute`);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'running' } : t));
      setLogModalTask({ id: task.id, name: task.name });
    } catch (err: any) {
      message.error(err?.response?.data?.message || '启动失败');
    }
  };

  const handleReset = async (task: Task) => {
    try {
      await api.post(`/tasks/${task.id}/reset`);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'pending' } : t));
      message.success('任务已重置为待执行状态');
    } catch {
      message.error('重置失败');
    }
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Task) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {record.batchId !== undefined && (
            <Tag color="geekblue" style={{ fontSize: 10, lineHeight: '16px' }}>
              第 {(record.batchGroup ?? 0) + 1} 批 · {record.batchId.slice(0, 8)}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '关联账号',
      dataIndex: 'accountName',
      key: 'accountName',
      render: (name: string) => <Text style={{ fontSize: 12 }}>{name}</Text>,
    },
    {
      title: '任务类型',
      dataIndex: 'taskType',
      key: 'taskType',
      render: (type: TaskType) => {
        const c = TASK_TYPE_CONFIG[type] || { color: 'default', text: type || '未知', icon: null };
        return <Tag color={c.color} icon={c.icon}>{c.text}</Tag>;
      },
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: Task) => {
        const c = STATUS_CONFIG[record.status] || { color: 'default', icon: null, text: record.status };
        const tag = <Tag color={c.color} icon={c.icon}>{c.text}</Tag>;
        if (record.status === 'failed' && record.errorReason) {
          return (
            <Tooltip
              title={
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>❌ 失败原因：</div>
                  <div style={{ maxWidth: 300, wordBreak: 'break-word' }}>{record.errorReason}</div>
                </div>
              }
              color="#ff4d4f"
            >
              <span style={{ cursor: 'help' }}>{tag} <Text type="danger" style={{ fontSize: 11 }}>悬停查看原因</Text></span>
            </Tooltip>
          );
        }
        return tag;
      },
    },
    {
      title: '计划时间',
      dataIndex: 'scheduledAt',
      key: 'scheduledAt',
      render: (date: string) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(date).format('YYYY-MM-DD HH:mm')}</Text>,
    },
    {
      title: '最后执行',
      dataIndex: 'lastExecutedAt',
      key: 'lastExecutedAt',
      render: (date?: string) => date
        ? <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(date).format('MM-DD HH:mm')}</Text>
        : <Text type="secondary">-</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Task) => (
        <Space size="small">
          <Space size={4}>
            {record.status === 'running' ? (
              <>
                <Button size="small" icon={<LoadingOutlined />}
                  onClick={() => setLogModalTask({ id: record.id, name: record.name })}>
                  查看日志
                </Button>
                <Tooltip title="在桌面打开浏览器窗口（VPS 上无效，仅本地调试）">
                  <Button size="small" icon={<DesktopOutlined />}
                    onClick={() => handleShowBrowser(record)}>
                    查看窗口
                  </Button>
                </Tooltip>
                <Tooltip title="任务卡住了？强制重置">
                  <Popconfirm
                    title="确定重置这个任务吗？（会中断当前执行）"
                    onConfirm={() => handleReset(record)}
                    okText="重置" cancelText="取消"
                  >
                    <Button size="small" icon={<CloseCircleOutlined />} style={{ color: '#faad14' }} type="text" />
                  </Popconfirm>
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip title="立即执行">
                  <Button type="primary" size="small" icon={<PlayCircleOutlined />}
                    onClick={() => handleExecute(record)}>
                    ▶ 执行
                  </Button>
                </Tooltip>
                <Tooltip title="查看上次执行日志">
                  <Button size="small" icon={<SearchOutlined />}
                    onClick={() => setLogModalTask({ id: record.id, name: record.name })}>
                    日志
                  </Button>
                </Tooltip>
              </>
            )}
            <Popconfirm title="确定删除这个任务吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ marginTop: 0, marginBottom: 4 }}>任务调度</Title>
            <Text type="secondary">管理和监控自动化任务的执行状态。</Text>
          </Col>
          <Col>
            <Space>
              <Tooltip title="AI 辅助设置">
                <Button icon={<RobotOutlined />} onClick={() => setAiModalVisible(true)}>AI 设置</Button>
              </Tooltip>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateClick} size="large">创建任务</Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { title: '总任务数', value: totalTasks, color: '#1890ff', icon: <ClockCircleOutlined /> },
          { title: '运行中', value: runningTasks, color: '#1677ff', icon: runningTasks > 0 ? <LoadingOutlined /> : <PlayCircleOutlined /> },
          { title: '已完成', value: completedTasks, color: '#52c41a', icon: <CheckCircleOutlined /> },
          { title: '失败', value: failedTasks, color: '#f5222d', icon: <CloseCircleOutlined /> },
        ].map(s => (
          <Col key={s.title} xs={24} sm={12} md={6}>
            <Card size="small">
              <Statistic title={s.title} value={s.value} valueStyle={{ color: s.color }} prefix={s.icon} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Table columns={columns} dataSource={tasks} rowKey="id"
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条记录` }}
          scroll={{ x: 900 }} />
      </Card>

      {/* ─── Create Task Modal ─── */}
      <Modal
        title={<Space><PlusOutlined /> 创建自动化任务</Space>}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => { setIsModalVisible(false); form.resetFields(); }}
        confirmLoading={submitting}
        okText="创建任务"
        cancelText="取消"
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>

          {/* Basic Info */}
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
                <Input placeholder="例如：产品推广对话任务" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="taskType" label="任务类型" rules={[{ required: true, message: '请选择' }]}>
                <Select placeholder="选择类型" onChange={(v: TaskType) => { setTaskType(v); setComboActions([]); }}>
                  <Option value="auto_chat"><MessageOutlined /> 自动聊天</Option>
                  <Option value="auto_post_image"><PictureOutlined /> 自动发图片</Option>
                  <Option value="auto_post_video"><VideoCameraOutlined /> 自动发视频</Option>
                  {/* auto_call 暂时隐藏，功能待完善 */}
                  <Option value="account_sync"><SwapOutlined /> 账号同步</Option>
                  <Option value="auto_simulate"><EyeOutlined /> 模拟真人操作</Option>
                  <Option value="auto_add_friends"><UserAddOutlined /> 自动加好友</Option>
                  <Option value="auto_accept_requests"><CheckCircleOutlined /> 接受好友申请</Option>
                  <Option value="auto_comment"><CommentOutlined /> 自动留言</Option>
                  <Option value="auto_follow"><HeartOutlined /> 自动 Follow</Option>
                  <Option value="auto_combo"><AppstoreOutlined /> 组合任务（多动作依次执行）</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* ── Batch Mode + Chrome Mode controls ── */}
          {taskType && taskType !== 'auto_chat' && taskType !== 'auto_call' && taskType !== 'account_sync' && (
            <Row gutter={16} style={{ marginBottom: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
              <Col span={8}>
                <Form.Item label="批量模式" style={{ marginBottom: 0 }}>
                  <Switch checked={batchMode} onChange={v => setBatchMode(v)}
                    checkedChildren="多账号" unCheckedChildren="单账号" />
                </Form.Item>
              </Col>
              {batchMode && (
                <Col span={8}>
                  <Form.Item label="每批并发数" style={{ marginBottom: 0 }}>
                    <InputNumber min={1} max={10} value={batchSize}
                      onChange={v => setBatchSize(v || 1)} addonAfter="个/批" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              )}
              <Col span={8}>
                <Form.Item label="Chrome 模式" style={{ marginBottom: 0 }}>
                  <Switch checked={headlessMode} onChange={setHeadlessMode}
                    checkedChildren="无头（VPS）" unCheckedChildren="显示窗口" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* Auto Chat Settings */}
          {taskType === 'auto_chat' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, color: '#1677ff' }}>
                <MessageOutlined /> 聊天账号设置（A ↔ B 角色扮演）
              </Divider>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="accountAId" label={<><UserOutlined /> 账号 A（发起方）</>}
                    rules={[{ required: true, message: '请选择账号A' }]}>
                    <Select placeholder="选择扮演 A 角色的账号" showSearch optionFilterProp="children">
                      {accounts.map(a => (
                        <Option key={a.id} value={a.id} disabled={form.getFieldValue('accountBId') === a.id}>
                          <Badge color={a.loginStatus ? 'green' : 'default'} text={a.name} />
                          <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{a.email}</Text>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="accountBId" label={<><UserOutlined /> 账号 B（回应方）</>}
                    rules={[{ required: true, message: '请选择账号B' }]}>
                    <Select placeholder="选择扮演 B 角色的账号" showSearch optionFilterProp="children">
                      {accounts.map(a => (
                        <Option key={a.id} value={a.id} disabled={form.getFieldValue('accountAId') === a.id}>
                          <Badge color={a.loginStatus ? 'green' : 'default'} text={a.name} />
                          <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{a.email}</Text>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" style={{ fontSize: 13, color: '#1677ff' }}>
                <MessageOutlined /> 选择聊天剧本（共 {scripts.length || CHAT_SCRIPTS.length} 个）
              </Divider>
              <Form.Item shouldUpdate={(prev, cur) => prev.scriptId !== cur.scriptId} noStyle>
                {() => {
                  const selectedId = form.getFieldValue('scriptId');
                  const selectedScript = scripts.find((s: any) => s.id === selectedId);
                  return (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Form.Item name="scriptId" rules={[{ required: true, message: '请选择聊天剧本' }]} noStyle>
                        <ScriptSelector
                          scripts={scripts.length ? scripts.map((s: any) => ({
                            id: s.id,
                            title: s.title,
                            preview: s.goal || '点击选择此聊天模式...',
                            rounds: s.phases?.length || 3,
                            category: s.category || '推广',
                          })) : undefined}
                        />
                      </Form.Item>
                      {selectedId && (
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => setScriptEditorId(selectedId)}
                        >
                          编辑剧本内容：{selectedScript?.title || selectedId}
                        </Button>
                      )}
                    </Space>
                  );
                }}
              </Form.Item>

              <Divider orientation="left" style={{ fontSize: 13, color: '#722ed1' }}>
                <RobotOutlined /> AI 辅助优化
              </Divider>
              <Row align="middle" gutter={16} style={{ marginBottom: 16 }}>
                <Col>
                  <Space>
                    <Switch checked={aiEnabled} onChange={setAiEnabled} />
                    <Text>启用 AI 优化对话内容</Text>
                  </Space>
                </Col>
                <Col>
                  <Button size="small" icon={<SettingOutlined />} onClick={() => setAiModalVisible(true)}>
                    配置 AI
                  </Button>
                </Col>
              </Row>
              {aiEnabled && (
                <Alert
                  type="info"
                  showIcon
                  icon={<RobotOutlined />}
                  message="AI 辅助已启用"
                  description="AI 将根据剧本内容动态优化每轮对话，使聊天更自然真实。请确保已在「AI 设置」中配置好 API Key。"
                  style={{ marginBottom: 16 }}
                />
              )}
            </>
          )}

          {/* Auto Post Image */}
          {taskType === 'auto_post_image' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, color: '#722ed1' }}>
                <PictureOutlined /> 发图设置
              </Divider>
              <Form.Item name={batchMode ? 'batchAccountIds' : 'accountAId'} label={batchMode ? '执行账号（批量）' : '发帖账号'} rules={[{ required: true, message: '请选择账号' }]}>
                <Select mode={batchMode ? 'multiple' : undefined} placeholder={batchMode ? '选择多个账号批量执行' : '选择发帖的 Facebook 账号'} showSearch optionFilterProp="children">
                  {accounts.map(a => <Option key={a.id} value={a.id}><Badge color={a.loginStatus ? 'green' : 'default'} text={a.name} /></Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="postContent" label="帖子内容" rules={[{ required: true, message: '请输入内容' }]}>
                <TextArea rows={3} placeholder="帖子文字内容..." />
              </Form.Item>
              <Form.Item name="imageUrls" label="图片（URL，每行一个）">
                <TextArea rows={3} placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg" />
              </Form.Item>
            </>
          )}

          {/* Auto Post Video */}
          {taskType === 'auto_post_video' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, color: '#eb2f96' }}>
                <VideoCameraOutlined /> 发视频设置
              </Divider>
              <Form.Item name={batchMode ? 'batchAccountIds' : 'accountAId'} label={batchMode ? '执行账号（批量）' : '发帖账号'} rules={[{ required: true, message: '请选择账号' }]}>
                <Select mode={batchMode ? 'multiple' : undefined} placeholder={batchMode ? '选择多个账号批量执行' : '选择发帖的 Facebook 账号'} showSearch optionFilterProp="children">
                  {accounts.map(a => <Option key={a.id} value={a.id}><Badge color={a.loginStatus ? 'green' : 'default'} text={a.name} /></Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="postContent" label="视频描述">
                <TextArea rows={2} placeholder="视频说明文字..." />
              </Form.Item>
              <Form.Item name="videoUrl" label="视频 URL" rules={[{ required: true, message: '请输入视频地址' }]}>
                <Input placeholder="https://example.com/video.mp4" />
              </Form.Item>
            </>
          )}

          {/* Auto Call */}
          {taskType === 'auto_call' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, color: '#52c41a' }}>
                <PhoneOutlined /> 自动拨号设置
              </Divider>
              <Alert type="warning" showIcon message="注意：自动拨号功能需要账号已登录，且对方账号在线" style={{ marginBottom: 16 }} />
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="accountAId" label="拨号方账号" rules={[{ required: true, message: '请选择' }]}>
                    <Select placeholder="选择发起通话的账号">
                      {accounts.map(a => <Option key={a.id} value={a.id}>{a.name}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="accountBId" label="接听方账号" rules={[{ required: true, message: '请选择' }]}>
                    <Select placeholder="选择接听通话的账号">
                      {accounts.map(a => <Option key={a.id} value={a.id}>{a.name}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="callDuration" label="通话时长（秒）" initialValue={30}>
                <InputNumber min={5} max={300} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}

          {/* Account Sync */}
          {taskType === 'account_sync' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13 }}>
                <SwapOutlined /> 同步设置
              </Divider>
              <Form.Item name="accountAId" label="同步账号" rules={[{ required: true, message: '请选择' }]}>
                <Select placeholder="选择要同步的账号" mode="multiple">
                  {accounts.map(a => <Option key={a.id} value={a.id}>{a.name}</Option>)}
                </Select>
              </Form.Item>
            </>
          )}

          {/* Auto Simulate / Account Warming */}
          {taskType === 'auto_simulate' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, color: '#13c2c2' }}>
                <EyeOutlined /> 模拟真人操作设置
              </Divider>
              <Alert
                type="info" showIcon style={{ marginBottom: 16 }}
                message="账号暖化"
                description="模拟真实用户浏览行为（刷动态、看视频、点赞等），降低账号被 Facebook 标记为机器人的风险。建议每天执行 20-60 分钟。"
              />
              <Form.Item name={batchMode ? 'batchAccountIds' : 'accountAId'} label={batchMode ? '目标账号（批量）' : '目标账号'} rules={[{ required: true, message: '请选择账号' }]}>
                <Select mode={batchMode ? 'multiple' : undefined} placeholder={batchMode ? '选择多个账号批量执行' : '选择要暖化的 Facebook 账号'} showSearch optionFilterProp="children">
                  {accounts.map(a => (
                    <Option key={a.id} value={a.id}>
                      <Badge color={a.loginStatus ? 'green' : 'default'} text={a.name} />
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="durationMinutes" label="模拟时长（分钟）" initialValue={30}
                rules={[{ required: true }]}>
                <InputNumber min={5} max={120} step={5} style={{ width: '100%' }}
                  addonAfter="分钟" />
              </Form.Item>
              <Form.Item name="warmingActions" label="执行动作" initialValue={['scroll_feed', 'watch_video', 'like_post']}
                rules={[{ required: true, message: '请至少选择一项' }]}>
                <Checkbox.Group style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Checkbox value="scroll_feed">📰 刷新闻 Feed（滚动浏览）</Checkbox>
                  <Checkbox value="watch_video">🎬 停留观看视频</Checkbox>
                  <Checkbox value="like_post">👍 随机点赞帖子</Checkbox>
                  <Checkbox value="view_profile">👤 浏览好友主页</Checkbox>
                  <Checkbox value="view_stories">📷 查看 Stories</Checkbox>
                </Checkbox.Group>
              </Form.Item>
            </>
          )}

          {/* ── Auto Add Friends ── */}
          {taskType === 'auto_add_friends' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, color: '#1d39c4' }}>
                <UserAddOutlined /> 自动加好友设置
              </Divider>
              <Alert
                type="warning" showIcon style={{ marginBottom: 16 }}
                message="安全提醒"
                description="Facebook 严格管控好友申请频率。强烈建议每天不超过 6 个，超出会触发账号限制甚至封号。系统已对上限硬性限制为 6 个/天。"
              />
              <Form.Item name={batchMode ? 'batchAccountIds' : 'accountAId'} label={batchMode ? '执行账号（批量）' : '执行账号'} rules={[{ required: true, message: '请选择账号' }]}>
                <Select mode={batchMode ? 'multiple' : undefined} placeholder={batchMode ? '选择多个账号批量执行' : '选择发送好友申请的账号'} showSearch optionFilterProp="children">
                  {accounts.map(a => (
                    <Option key={a.id} value={a.id}>
                      <Badge color={a.loginStatus ? 'green' : 'default'} text={a.name} />
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="dailyLimit" label="每日上限（个）" initialValue={5}
                    rules={[{ required: true }]}>
                    <InputNumber min={3} max={6} style={{ width: '100%' }} addonAfter="个/天" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="delayMin" label="最短间隔（秒）" initialValue={60}>
                    <InputNumber min={10} max={300} style={{ width: '100%' }} addonAfter="秒" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="delayMax" label="最长间隔（秒）" initialValue={240}>
                    <InputNumber min={30} max={600} style={{ width: '100%' }} addonAfter="秒" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="prioritizeMutual" label="优先 Mutual Friends" initialValue valuePropName="checked">
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </>
          )}

          {/* ── Auto Accept Friend Requests ── */}
          {taskType === 'auto_accept_requests' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, color: '#52c41a' }}>
                <CheckCircleOutlined /> 接受好友申请设置
              </Divider>
              <Form.Item name={batchMode ? 'batchAccountIds' : 'accountAId'} label={batchMode ? '执行账号（批量）' : '执行账号'} rules={[{ required: true, message: '请选择账号' }]}>
                <Select mode={batchMode ? 'multiple' : undefined} placeholder={batchMode ? '选择多个账号批量执行' : '选择要处理好友申请的账号'} showSearch optionFilterProp="children">
                  {accounts.map(a => (
                    <Option key={a.id} value={a.id}>
                      <Badge color={a.loginStatus ? 'green' : 'default'} text={a.name} />
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="maxCount" label="每次最多接受" initialValue={10}>
                <InputNumber min={1} max={500} style={{ width: '100%' }} addonAfter="个" />
              </Form.Item>
            </>
          )}

          {/* ── Auto Comment ── */}
          {taskType === 'auto_comment' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, color: '#d4b106' }}>
                <CommentOutlined /> 自动留言设置
              </Divider>
              <Alert
                type="info" showIcon style={{ marginBottom: 16 }}
                message="防 spam 提示"
                description="多填几条评论模板，系统每次随机选一条。内容多样化可有效降低 Facebook 将账号标记为 spam 的风险。"
              />
              <Form.Item name={batchMode ? 'batchAccountIds' : 'accountAId'} label={batchMode ? '执行账号（批量）' : '执行账号'} rules={[{ required: true, message: '请选择账号' }]}>
                <Select mode={batchMode ? 'multiple' : undefined} placeholder={batchMode ? '选择多个账号批量执行' : '选择发布评论的账号'} showSearch optionFilterProp="children">
                  {accounts.map(a => (
                    <Option key={a.id} value={a.id}>
                      <Badge color={a.loginStatus ? 'green' : 'default'} text={a.name} />
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="comments"
                label="评论模板（每行一条，随机选用）"
                initialValue={'👍\n非常棒！\n赞！\n很精彩！\n支持！'}
                rules={[{ required: true, message: '请至少填写一条评论' }]}
              >
                <TextArea rows={5} placeholder={'👍\n非常棒！\n赞！\n很精彩！\n支持！'} />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="dailyLimit" label="每日上限" initialValue={10}>
                    <InputNumber min={1} max={30} style={{ width: '100%' }} addonAfter="条/天" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="delayMin" label="最短间隔（秒）" initialValue={60}>
                    <InputNumber min={5} max={300} style={{ width: '100%' }} addonAfter="秒" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="delayMax" label="最长间隔（秒）" initialValue={120}>
                    <InputNumber min={15} max={600} style={{ width: '100%' }} addonAfter="秒" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* ── Auto Follow ── */}
          {taskType === 'auto_follow' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, color: '#d4380d' }}>
                <HeartOutlined /> 自动 Follow 设置
              </Divider>
              <Alert
                type="info" showIcon style={{ marginBottom: 16 }}
                message="关注操作相对安全，但仍建议每天不超过 40 个，避免触发 Facebook 风控。"
              />
              <Form.Item name={batchMode ? 'batchAccountIds' : 'accountAId'} label={batchMode ? '执行账号（批量）' : '执行账号'} rules={[{ required: true, message: '请选择账号' }]}>
                <Select mode={batchMode ? 'multiple' : undefined} placeholder={batchMode ? '选择多个账号批量执行' : '选择执行 Follow 的账号'} showSearch optionFilterProp="children">
                  {accounts.map(a => (
                    <Option key={a.id} value={a.id}>
                      <Badge color={a.loginStatus ? 'green' : 'default'} text={a.name} />
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="dailyLimit" label="每日上限" initialValue={10}>
                    <InputNumber min={1} max={50} style={{ width: '100%' }} addonAfter="个/天" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="delayMin" label="最短间隔（秒）" initialValue={60}>
                    <InputNumber min={5} max={120} style={{ width: '100%' }} addonAfter="秒" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="delayMax" label="最长间隔（秒）" initialValue={240}>
                    <InputNumber min={10} max={300} style={{ width: '100%' }} addonAfter="秒" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* ── Combo Task ── */}
          {taskType === 'auto_combo' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, color: '#722ed1' }}>
                <AppstoreOutlined /> 组合任务设置
              </Divider>
              <Alert
                type="info" showIcon style={{ marginBottom: 16 }}
                message="系统将按以下勾选顺序依次执行每个动作，共用同一个浏览器 Session，无需重复登录。"
              />
              <Form.Item name={batchMode ? 'batchAccountIds' : 'accountAId'} label={batchMode ? '执行账号（批量）' : '执行账号'} rules={[{ required: true, message: '请选择账号' }]}>
                <Select mode={batchMode ? 'multiple' : undefined} placeholder={batchMode ? '选择多个账号批量执行' : '选择执行所有动作的 Facebook 账号'} showSearch optionFilterProp="children">
                  {accounts.map(a => (
                    <Option key={a.id} value={a.id}>
                      <Badge color={a.loginStatus ? 'green' : 'default'} text={a.name} />
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label={<><span style={{ color: '#ff4d4f' }}>*</span> 选择动作（按顺序执行）</>}>
                <Checkbox.Group
                  value={comboActions}
                  onChange={vals => setComboActions(vals as string[])}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
                >
                  <Checkbox value="auto_accept_requests"><CheckCircleOutlined style={{ color: '#52c41a' }} /> 接受好友申请</Checkbox>
                  <Checkbox value="auto_add_friends"><UserAddOutlined style={{ color: '#1d39c4' }} /> 自动加好友</Checkbox>
                  <Checkbox value="auto_comment"><CommentOutlined style={{ color: '#d4b106' }} /> 自动留言</Checkbox>
                  <Checkbox value="auto_follow"><HeartOutlined style={{ color: '#d4380d' }} /> 自动 Follow</Checkbox>
                </Checkbox.Group>
                {comboActions.length === 0 && (
                  <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>请至少勾选一个动作</div>
                )}
              </Form.Item>

              {/* Per-action settings — only shown when checked */}
              {comboActions.includes('auto_accept_requests') && (
                <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '12px 16px', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#52c41a' }}><CheckCircleOutlined /> 接受好友申请设置</div>
                  <Form.Item name="comboAcceptMax" label="每次最多接受" initialValue={10} style={{ marginBottom: 0 }}>
                    <InputNumber min={1} max={500} addonAfter="个" style={{ width: '100%' }} />
                  </Form.Item>
                </div>
              )}

              {comboActions.includes('auto_add_friends') && (
                <div style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 6, padding: '12px 16px', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#1d39c4' }}><UserAddOutlined /> 自动加好友设置</div>
                  <Alert type="warning" showIcon message="系统强制上限 6 个/天，超出无效" style={{ marginBottom: 8, padding: '4px 8px' }} />
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="comboAddLimit" label="每日上限" initialValue={5} style={{ marginBottom: 0 }}>
                        <InputNumber min={3} max={6} addonAfter="个" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="comboAddDelayMin" label="最短间隔(秒)" initialValue={60} style={{ marginBottom: 0 }}>
                        <InputNumber min={10} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="comboAddDelayMax" label="最长间隔(秒)" initialValue={240} style={{ marginBottom: 0 }}>
                        <InputNumber min={30} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              )}

              {comboActions.includes('auto_comment') && (
                <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '12px 16px', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#d4b106' }}><CommentOutlined /> 自动留言设置</div>
                  <Form.Item name="comboComments" label="评论模板（每行一条）"
                    initialValue={'👍\n非常棒！\n赞！\n很精彩！\n支持！'} style={{ marginBottom: 8 }}>
                    <TextArea rows={4} />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="comboCommentLimit" label="每日上限" initialValue={10} style={{ marginBottom: 0 }}>
                        <InputNumber min={1} max={30} addonAfter="条" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="comboCommentDelayMin" label="最短间隔(秒)" initialValue={60} style={{ marginBottom: 0 }}>
                        <InputNumber min={5} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="comboCommentDelayMax" label="最长间隔(秒)" initialValue={120} style={{ marginBottom: 0 }}>
                        <InputNumber min={15} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              )}

              {comboActions.includes('auto_follow') && (
                <div style={{ background: '#fff2e8', border: '1px solid #ffbb96', borderRadius: 6, padding: '12px 16px', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#d4380d' }}><HeartOutlined /> 自动 Follow 设置</div>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="comboFollowLimit" label="每日上限" initialValue={10} style={{ marginBottom: 0 }}>
                        <InputNumber min={1} max={50} addonAfter="个" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="comboFollowDelayMin" label="最短间隔(秒)" initialValue={60} style={{ marginBottom: 0 }}>
                        <InputNumber min={5} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="comboFollowDelayMax" label="最长间隔(秒)" initialValue={240} style={{ marginBottom: 0 }}>
                        <InputNumber min={10} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              )}
            </>
          )}

          {/* Schedule Settings */}
          {taskType && (
            <>
              <Divider orientation="left" style={{ fontSize: 13 }}>⏰ 执行计划</Divider>
              <Row gutter={16}>
                <Col span={14}>
                  <Form.Item name="scheduledAt" label="执行时间" rules={[{ required: true, message: '请选择执行时间' }]}>
                    <Input type="datetime-local" />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item name="repeatCycle" label="重复周期" initialValue="once">
                    <Select>
                      <Option value="once">单次执行</Option>
                      <Option value="daily">每日重复</Option>
                      <Option value="weekly">每周重复</Option>
                      <Option value="monthly">每月重复</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {!taskType && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#aaa' }}>
              <MessageOutlined style={{ fontSize: 32, marginBottom: 8 }} />
              <div>请先选择任务类型</div>
            </div>
          )}
        </Form>
      </Modal>

      {/* AI Settings Modal */}
      <AISettingsModal open={aiModalVisible} onClose={() => setAiModalVisible(false)} />

      {/* Script Editor Modal */}
      <ScriptEditorModal
        scriptId={scriptEditorId}
        onClose={() => {
          setScriptEditorId(null);
          api.get('/chat-scripts').then(res => {
            const list = res.data?.data || res.data || [];
            setScripts(Array.isArray(list) ? list : []);
          }).catch(() => {});
        }}
      />

      {/* Execution Log Modal */}
      <ExecutionLogModal
        taskId={logModalTask?.id || null}
        taskName={logModalTask?.name || ''}
        onClose={() => setLogModalTask(null)}
        onStatusChange={(id, status) => {
          setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
        }}
      />
    </AppLayout>
  );
};

export default TasksPage;
