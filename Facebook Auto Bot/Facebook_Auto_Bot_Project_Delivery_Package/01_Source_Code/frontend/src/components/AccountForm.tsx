import React, { useState } from 'react';
import {
  Form,
  Input,
  Select,
  Switch,
  Card,
  Row,
  Col,
  Button,
  Space,
  Typography,
  Alert,
  Upload,
  message,
  Divider,
} from 'antd';
import {
  UploadOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  UserOutlined,
  MailOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// 表单验证模式
const accountSchema = z.object({
  username: z.string()
    .min(3, '用户名至少3个字符')
    .max(50, '用户名最多50个字符')
    .regex(/^[a-zA-Z0-9._]+$/, '用户名只能包含字母、数字、点和下划线'),
  password: z.string()
    .min(6, '密码至少6个字符')
    .max(100, '密码最多100个字符')
    .optional()
    .or(z.literal('')),
  displayName: z.string()
    .min(2, '显示名称至少2个字符')
    .max(50, '显示名称最多50个字符'),
  email: z.string()
    .email('请输入有效的邮箱地址')
    .max(100, '邮箱最多100个字符'),
  tags: z.array(z.string()).optional(),
  loginMethod: z.enum(['manual', 'auto', 'cookie']),
  twoFactorEnabled: z.boolean().optional(),
  twoFactorCode: z.string()
    .length(6, '2FA代码必须是6位数字')
    .regex(/^\d+$/, '2FA代码必须是数字')
    .optional()
    .or(z.literal('')),
  vpnConfig: z.object({
    provider: z.string().optional(),
    location: z.string().optional(),
    ipAddress: z.string().ip('请输入有效的IP地址').optional(),
    credentials: z.object({
      username: z.string().optional(),
      password: z.string().optional(),
    }).optional(),
  }).optional(),
  notes: z.string().max(500, '备注最多500个字符').optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountFormProps {
  initialValues?: Partial<AccountFormData>;
  onSubmit: (data: AccountFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
}

const AccountForm: React.FC<AccountFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = 'create',
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showVpnPassword, setShowVpnPassword] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [form] = Form.useForm();

  // 处理表单提交
  const handleSubmit = (values: any) => {
    // 清理空值
    const cleanedValues = Object.fromEntries(
      Object.entries(values).filter(([_, v]) => v !== undefined && v !== '')
    );
    
    // 处理VPN配置
    if (values.vpnProvider || values.vpnLocation || values.vpnIpAddress) {
      cleanedValues.vpnConfig = {
        provider: values.vpnProvider,
        location: values.vpnLocation,
        ipAddress: values.vpnIpAddress,
        credentials: values.vpnUsername || values.vpnPassword ? {
          username: values.vpnUsername,
          password: values.vpnPassword,
        } : undefined,
      };
    }

    // 删除临时字段
    delete cleanedValues.vpnProvider;
    delete cleanedValues.vpnLocation;
    delete cleanedValues.vpnIpAddress;
    delete cleanedValues.vpnUsername;
    delete cleanedValues.vpnPassword;

    onSubmit(cleanedValues);
  };

  // 处理文件上传
  const handleUpload = (info: any) => {
    let newFileList = [...info.fileList];

    // 限制只能上传一个文件
    newFileList = newFileList.slice(-1);

    // 读取文件内容
    newFileList = newFileList.map(file => {
      if (file.response) {
        file.url = file.response.url;
      }
      return file;
    });

    setFileList(newFileList);

    if (info.file.status === 'done') {
      message.success(`${info.file.name} 文件上传成功`);
      // 这里可以处理文件内容，比如解析CSV文件
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 文件上传失败`);
    }
  };

  // 批量导入处理
  const handleBulkImport = () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件');
      return;
    }

    // 这里可以实现批量导入逻辑
    message.info('批量导入功能开发中...');
  };

  // 测试连接
  const handleTestConnection = () => {
    const values = form.getFieldsValue();
    if (!values.username || !values.password) {
      message.warning('请先填写用户名和密码');
      return;
    }
    message.info('连接测试功能开发中...');
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        loginMethod: 'auto',
        twoFactorEnabled: false,
        tags: [],
        ...initialValues,
      }}
    >
      {/* 基本信息 */}
      <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="username"
              label="Facebook用户名"
              rules={[
                { required: true, message: '请输入Facebook用户名' },
                { min: 3, message: '用户名至少3个字符' },
                { pattern: /^[a-zA-Z0-9._]+$/, message: '用户名只能包含字母、数字、点和下划线' },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="例如: john.doe"
                disabled={mode === 'edit'}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="displayName"
              label="显示名称"
              rules={[
                { required: true, message: '请输入显示名称' },
                { min: 2, message: '显示名称至少2个字符' },
              ]}
            >
              <Input placeholder="例如: 约翰的个人账号" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="password"
              label="密码"
              rules={mode === 'create' ? [
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' },
              ] : []}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={mode === 'edit' ? '留空则不修改密码' : '请输入密码'}
                iconRender={(visible) =>
                  visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                }
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="email"
              label="邮箱地址"
              rules={[
                { required: true, message: '请输入邮箱地址' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="例如: john@example.com" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="tags"
          label="标签"
          tooltip="用于分类和筛选账号，按回车添加"
        >
          <Select
            mode="tags"
            placeholder="输入标签，按回车添加"
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Card>

      {/* 登录设置 */}
      <Card title="登录设置" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="loginMethod"
              label="登录方式"
              rules={[{ required: true, message: '请选择登录方式' }]}
            >
              <Select placeholder="选择登录方式">
                <Option value="auto">自动登录</Option>
                <Option value="manual">手动登录</Option>
                <Option value="cookie">Cookie登录</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="twoFactorEnabled"
              label="双重验证"
              valuePropName="checked"
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.twoFactorEnabled !== currentValues.twoFactorEnabled
          }
        >
          {({ getFieldValue }) =>
            getFieldValue('twoFactorEnabled') ? (
              <Form.Item
                name="twoFactorCode"
                label="2FA验证码"
                rules={[
                  { required: true, message: '请输入2FA验证码' },
                  { pattern: /^\d{6}$/, message: '2FA验证码必须是6位数字' },
                ]}
              >
                <Input placeholder="请输入6位2FA验证码" maxLength={6} />
              </Form.Item>
            ) : null
          }
        </Form.Item>
      </Card>

      {/* VPN配置 */}
      <Card title="VPN配置" size="small" style={{ marginBottom: 16 }}>
        <Alert
          message="VPN配置是可选的，但建议配置VPN以提高账号安全性"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="vpnProvider" label="VPN提供商">
              <Select placeholder="选择VPN提供商">
                <Option value="openvpn">OpenVPN</Option>
                <Option value="wireguard">WireGuard</Option>
                <Option value="nordvpn">NordVPN</Option>
                <Option value="expressvpn">ExpressVPN</Option>
                <Option value="custom">自定义</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="vpnLocation" label="VPN位置">
              <Select placeholder="选择VPN位置">
                <Option value="us">美国</Option>
                <Option value="uk">英国</Option>
                <Option value="jp">日本</Option>
                <Option value="sg">新加坡</Option>
                <Option value="de">德国</Option>
                <Option value="custom">自定义</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="vpnIpAddress"
              label="IP地址"
              rules={[
                { pattern: /^(\d{1,3}\.){3}\d{1,3}$/, message: '请输入有效的IP地址' },
              ]}
            >
              <Input placeholder="例如: 192.168.1.1" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="vpnUsername" label="VPN用户名">
              <Input placeholder="VPN用户名（可选）" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="vpnPassword" label="VPN密码">
              <Input.Password
                placeholder="VPN密码（可选）"
                iconRender={(visible) =>
                  visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                }
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item>
          <Button
            type="dashed"
            icon={<SafetyOutlined />}
            onClick={handleTestConnection}
            style={{ width: '100%' }}
          >
            测试VPN连接
          </Button>
        </Form.Item>
      </Card>

      {/* 备注 */}
      <Card title="备注" size="small" style={{ marginBottom: 16 }}>
        <Form.Item name="notes" label="备注信息">
          <TextArea
            placeholder="请输入备注信息（可选）"
            rows={3}
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Card>

      {/* 批量导入（仅创建模式） */}
      {mode === 'create' && (
        <Card title="批量导入" size="small" style={{ marginBottom: 16 }}>
          <Alert
            message="支持CSV格式文件导入，文件格式：用户名,密码,邮箱,显示名称"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Form.Item>
            <Upload
              fileList={fileList}
              onChange={handleUpload}
              beforeUpload={() => false}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>

          {fileList.length > 0 && (
            <Form.Item>
              <Button
                type="primary"
                onClick={handleBulkImport}
                style={{ width: '100%' }}
              >
                导入选中文件
              </Button>
            </Form.Item>
          )}
        </Card>
      )}

      {/* 表单操作 */}
      <div style={{ textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel} disabled={isSubmitting}>
            取消
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={isSubmitting}
          >
            {mode === 'create' ? '添加账号' : '更新账号'}
          </Button>
        </Space>
      </div>
    </Form>
  );
};

export default AccountForm;