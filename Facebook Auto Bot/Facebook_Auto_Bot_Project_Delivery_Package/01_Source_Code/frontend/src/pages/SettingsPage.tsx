import React, { useState } from 'react';
import { Tabs, Card, Form, Input, Button, Switch, Select, Space, message, Avatar, Upload } from 'antd';
import { UserOutlined, LockOutlined, BellOutlined, SafetyOutlined, UploadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { TabPane } = Tabs;
const { Option } = Select;

const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // 处理个人资料更新
  const handleProfileUpdate = async (values: any) => {
    setLoading(true);
    try {
      await updateUser(values);
      message.success('个人资料更新成功');
    } catch (error: any) {
      message.error(error.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理头像上传
  const handleAvatarUpload = async (file: File) => {
    setAvatarLoading(true);
    try {
      // 这里应该调用上传API
      // const formData = new FormData();
      // formData.append('avatar', file);
      // const response = await axios.post('/api/upload/avatar', formData);
      
      // 模拟上传成功
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 更新用户头像
      const avatarUrl = URL.createObjectURL(file);
      await updateUser({ avatarUrl });
      
      message.success('头像上传成功');
    } catch (error) {
      message.error('头像上传失败');
    } finally {
      setAvatarLoading(false);
    }
    return false; // 阻止默认上传行为
  };

  // 处理密码更改
  const handlePasswordChange = async (values: any) => {
    setLoading(true);
    try {
      // 这里应该调用更改密码API
      // await axios.post('/auth/change-password', values);
      
      // 模拟成功
      await new Promise(resolve => setTimeout(resolve, 1000));
      message.success('密码更改成功');
    } catch (error) {
      message.error('密码更改失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理通知设置更新
  const handleNotificationUpdate = async (values: any) => {
    setLoading(true);
    try {
      await updateUser({
        preferences: {
          ...user?.preferences,
          notifications: values,
        },
      });
      message.success('通知设置更新成功');
    } catch (error: any) {
      message.error(error.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>设置</h1>
      
      <Tabs defaultActiveKey="profile">
        <TabPane
          tab={
            <span>
              <UserOutlined />
              个人资料
            </span>
          }
          key="profile"
        >
          <Card>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <Avatar
                size={120}
                src={user?.avatarUrl}
                style={{
                  backgroundColor: '#1890ff',
                  fontSize: 48,
                  marginBottom: 16,
                }}
              >
                {user?.username?.charAt(0).toUpperCase()}
              </Avatar>
              
              <Upload
                beforeUpload={handleAvatarUpload}
                showUploadList={false}
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={avatarLoading}
                  style={{ marginTop: 16 }}
                >
                  更换头像
                </Button>
              </Upload>
            </div>

            <Form
              layout="vertical"
              initialValues={{
                fullName: user?.fullName,
                email: user?.email,
                username: user?.username,
                timezone: user?.preferences?.timezone || 'Asia/Shanghai',
                language: user?.preferences?.language || 'zh-CN',
              }}
              onFinish={handleProfileUpdate}
            >
              <Form.Item
                name="fullName"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' },
                ]}
              >
                <Input disabled={user?.emailVerified} />
              </Form.Item>

              <Form.Item
                name="username"
                label="用户名"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名至少3个字符' },
                ]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                name="timezone"
                label="时区"
              >
                <Select>
                  <Option value="Asia/Shanghai">中国标准时间 (UTC+8)</Option>
                  <Option value="America/New_York">美国东部时间 (UTC-5)</Option>
                  <Option value="Europe/London">伦敦时间 (UTC+0)</Option>
                  <Option value="Asia/Tokyo">日本时间 (UTC+9)</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="language"
                label="语言"
              >
                <Select>
                  <Option value="zh-CN">简体中文</Option>
                  <Option value="en-US">English</Option>
                  <Option value="ja-JP">日本語</Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  保存更改
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <LockOutlined />
              安全设置
            </span>
          }
          key="security"
        >
          <Card title="更改密码">
            <Form
              layout="vertical"
              onFinish={handlePasswordChange}
            >
              <Form.Item
                name="currentPassword"
                label="当前密码"
                rules={[{ required: true, message: '请输入当前密码' }]}
              >
                <Input.Password />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 8, message: '密码至少8个字符' },
                ]}
              >
                <Input.Password />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="确认新密码"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  更改密码
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title="双重认证" style={{ marginTop: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                  双重认证状态
                </div>
                <Switch checked={user?.twoFactorEnabled} disabled />
                <span style={{ marginLeft: 8 }}>
                  {user?.twoFactorEnabled ? '已启用' : '未启用'}
                </span>
              </div>
              
              <Button type="link" disabled={user?.twoFactorEnabled}>
                设置双重认证
              </Button>
            </Space>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <BellOutlined />
              通知设置
            </span>
          }
          key="notifications"
        >
          <Card>
            <Form
              layout="vertical"
              initialValues={{
                emailNotifications: true,
                pushNotifications: true,
                taskFailures: true,
                taskSuccess: false,
                systemUpdates: true,
                marketing: false,
              }}
              onFinish={handleNotificationUpdate}
            >
              <Form.Item
                name="emailNotifications"
                label="邮件通知"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="pushNotifications"
                label="推送通知"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <div style={{ margin: '24px 0', borderTop: '1px solid #f0f0f0', paddingTop: 24 }}>
                <h3>通知类型</h3>
                
                <Form.Item
                  name="taskFailures"
                  label="任务失败通知"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  name="taskSuccess"
                  label="任务成功通知"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  name="systemUpdates"
                  label="系统更新通知"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  name="marketing"
                  label="营销通知"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </div>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  保存设置
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <SafetyOutlined />
              隐私设置
            </span>
          }
          key="privacy"
        >
          <Card title="数据保留设置">
            <Form layout="vertical">
              <Form.Item
                name="dataRetention"
                label="数据保留期限"
                initialValue={user?.preferences?.privacy?.dataRetention || '30days'}
              >
                <Select>
                  <Option value="7days">7天</Option>
                  <Option value="30days">30天</Option>
                  <Option value="90days">90天</Option>
                  <Option value="1year">1年</Option>
                  <Option value="forever">永久</Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button type="primary" loading={loading}>
                  保存设置
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title="数据导出" style={{ marginTop: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <p>您可以导出您的个人数据，包括：</p>
              <ul>
                <li>个人资料信息</li>
                <li>Facebook账号数据</li>
                <li>任务历史记录</li>
                <li>系统日志</li>
              </ul>
              
              <Button type="primary">
                导出我的数据
              </Button>
            </Space>
          </Card>

          <Card title="账户删除" style={{ marginTop: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <p style={{ color: '#ff4d4f' }}>
                <strong>警告：</strong>删除账户是不可逆的操作。所有数据将被永久删除。
              </p>
              
              <Button type="primary" danger>
                删除我的账户
              </Button>
            </Space>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default SettingsPage;