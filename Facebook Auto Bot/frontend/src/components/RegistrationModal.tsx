import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, Form, Input, Select, DatePicker, Button, Space, Alert, Typography, Steps, Row, Col, message,
} from 'antd';
import {
  UserOutlined, MailOutlined, LockOutlined, GlobalOutlined,
  PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { accountsService } from '../services/accounts';

const { Text, Paragraph } = Typography;
const { Option } = Select;

interface VPNOption {
  id: string;
  name: string;
  country?: string;
  status: string;
  isDefault: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;  // refresh account list after registration succeeds
  vpnOptions: VPNOption[];
}

type Phase = 'form' | 'waiting' | 'success' | 'failed';

const POLL_INTERVAL_MS = 5000;

const RegistrationModal: React.FC<Props> = ({ open, onClose, onSuccess, vpnOptions }) => {
  const [form] = Form.useForm();
  const [phase, setPhase] = useState<Phase>('form');
  const [submitting, setSubmitting] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhase('form');
      setAccountId(null);
      setErrorMsg('');
      form.resetFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Clean up poll timer on unmount / close
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const startPolling = (id: string) => {
    const tick = async () => {
      try {
        const { status, error } = await accountsService.getRegistrationStatus(id);
        if (status === 'idle') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setPhase('success');
          onSuccess();
        } else if (status === 'registration_failed') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setErrorMsg(error || '注册失败');
          setPhase('failed');
        }
        // status='registering' → keep polling
      } catch (e: any) {
        // Network error — keep polling, don't fail the flow
        console.warn('Registration status poll failed:', e?.message);
      }
    };
    tick(); // immediate
    pollTimerRef.current = setInterval(tick, POLL_INTERVAL_MS);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        facebookPassword: values.facebookPassword,
        vpnConfigId: values.vpnConfigId,
        name: values.name?.trim() || undefined,
        dateOfBirth: values.dateOfBirth ? dayjs(values.dateOfBirth).format('YYYY-MM-DD') : undefined,
        gender: values.gender || undefined,
        accountType: values.accountType || 'user',
        remarks: values.remarks || undefined,
      };
      const { accountId: newId } = await accountsService.startRegistration(payload);
      setAccountId(newId);
      setPhase('waiting');
      startPolling(newId);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '启动注册失败';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (phase === 'waiting' && accountId) {
      // User wants to abort in-progress registration
      Modal.confirm({
        title: '确认取消注册？',
        content: '这将关闭浏览器并删除临时账号。已经在浏览器里完成的 FB 注册不会同步到系统。',
        okText: '确认取消',
        cancelText: '继续注册',
        onOk: async () => {
          try {
            await accountsService.cancelRegistration(accountId);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            message.info('已取消注册');
            onClose();
          } catch (e: any) {
            message.error(e?.response?.data?.message || '取消失败');
          }
        },
      });
    } else {
      // Form phase or already done — just close
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      onClose();
    }
  };

  const stepCurrent = phase === 'form' ? 0 : phase === 'waiting' ? 1 : 2;
  const stepStatus: 'wait' | 'process' | 'finish' | 'error' =
    phase === 'failed' ? 'error' : phase === 'success' ? 'finish' : 'process';

  return (
    <Modal
      title={
        <Space>
          <PlayCircleOutlined style={{ color: '#1890ff' }} />
          <span>注册新 Facebook 账号（VPN 代理下）</span>
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      maskClosable={false}
      width={680}
      footer={
        phase === 'form' ? (
          <Space>
            <Button onClick={handleCancel}>取消</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit} icon={<PlayCircleOutlined />}>
              启动注册
            </Button>
          </Space>
        ) : phase === 'waiting' ? (
          <Button danger onClick={handleCancel}>取消注册</Button>
        ) : (
          <Button type="primary" onClick={onClose}>关闭</Button>
        )
      }
    >
      <Steps
        size="small"
        current={stepCurrent}
        status={stepStatus}
        style={{ marginBottom: 24 }}
        items={[
          { title: '填写资料', icon: <UserOutlined /> },
          {
            title: '完成注册',
            icon: phase === 'waiting' ? <LoadingOutlined /> : <GlobalOutlined />,
          },
          {
            title: phase === 'failed' ? '失败' : '成功',
            icon: phase === 'failed' ? <CloseCircleOutlined /> : <CheckCircleOutlined />,
          },
        ]}
      />

      {phase === 'form' && (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="提示"
            description="点「启动注册」后，系统会打开一个带 VPN 代理的浏览器窗口，自动跳转到 FB 注册页并预填以下资料。你需要手动完成 CAPTCHA、邮箱/手机号验证，然后提交。注册成功后系统会自动保存账号到列表。"
          />
          <Form form={form} layout="vertical">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="firstName" label="名（First Name）" rules={[{ required: true, message: '请输入名' }]}>
                  <Input prefix={<UserOutlined />} placeholder="John" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="lastName" label="姓（Last Name）" rules={[{ required: true, message: '请输入姓' }]}>
                  <Input prefix={<UserOutlined />} placeholder="Doe" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="email"
              label="邮箱或手机号"
              rules={[{ required: true, message: '请输入邮箱或手机号' }]}
              extra="FB 会向此邮箱/手机号发验证码，请用你能收到的"
            >
              <Input prefix={<MailOutlined />} placeholder="你的邮箱或 +60xxxxxxxx" />
            </Form.Item>
            <Form.Item
              name="facebookPassword"
              label="Facebook 密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少 6 位' },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="你为新账号设的密码" />
            </Form.Item>
            <Form.Item
              name="vpnConfigId"
              label="VPN 配置（必选）"
              rules={[{ required: true, message: '注册必须选择 VPN — 保证新账号首次登录 IP 就是目标地区' }]}
              extra="建议选目标受众所在地区的住宅 IP，固定不变"
            >
              <Select placeholder="选择 VPN/代理" showSearch optionFilterProp="children">
                {vpnOptions.map(v => (
                  <Option key={v.id} value={v.id}>
                    <Space>
                      <GlobalOutlined />
                      <span>{v.name}</span>
                      {v.country && <Text type="secondary" style={{ fontSize: 12 }}>({v.country})</Text>}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="dateOfBirth" label="生日（可选）">
                  <DatePicker style={{ width: '100%' }} placeholder="YYYY-MM-DD" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="gender" label="性别（可选）">
                  <Select placeholder="选择" allowClear>
                    <Option value="male">男</Option>
                    <Option value="female">女</Option>
                    <Option value="custom">自定义</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="accountType" label="账号类型" initialValue="user">
                  <Select>
                    <Option value="user">个人账号</Option>
                    <Option value="page">主页账号</Option>
                    <Option value="business">商业账号</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="name" label="内部显示名（可选）" extra="不填默认用「名 + 姓」">
                  <Input placeholder="例如：营销账号 1" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="remarks" label="备注（可选）">
              <Input.TextArea rows={2} placeholder="用途 / 账号绑定的邮箱密码等备忘" />
            </Form.Item>
          </Form>
        </>
      )}

      {phase === 'waiting' && (
        <div style={{ padding: '20px 0' }}>
          <Alert
            type="info"
            showIcon
            icon={<LoadingOutlined />}
            message="浏览器已打开，请完成注册步骤"
            description={
              <div>
                <Paragraph style={{ marginTop: 8, marginBottom: 4 }}>
                  1. 在弹出的浏览器里检查预填字段，补齐缺的内容<br />
                  2. 过 CAPTCHA 验证<br />
                  3. 接收邮箱/手机短信验证码填入<br />
                  4. 点 FB 的「注册」按钮提交
                </Paragraph>
                <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
                  系统每 5 秒检测一次注册是否完成（检测 c_user cookie）。完成后会自动保存账号到列表，
                  浏览器会保留打开供你继续操作，你自己手动关就行。<br />
                  ⏱ 最长等待 30 分钟，超时会标记为「注册失败」。
                </Paragraph>
              </div>
            }
          />
        </div>
      )}

      {phase === 'success' && (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 56, color: '#52c41a' }} />
          <Paragraph strong style={{ marginTop: 16, fontSize: 16 }}>
            ✅ 账号注册成功！
          </Paragraph>
          <Paragraph type="secondary">
            已自动加入账号管理列表，可立即绑定任务使用。<br />
            浏览器窗口仍保持打开，你可以继续操作或自己关闭。
          </Paragraph>
        </div>
      )}

      {phase === 'failed' && (
        <div style={{ padding: '20px 0' }}>
          <Alert
            type="error"
            showIcon
            message="注册未能完成"
            description={errorMsg || '可能原因：超时、浏览器被关闭、FB 拒绝注册等。浏览器仍开着，你可以看看情况再决定重试或放弃。'}
          />
        </div>
      )}
    </Modal>
  );
};

export default RegistrationModal;
