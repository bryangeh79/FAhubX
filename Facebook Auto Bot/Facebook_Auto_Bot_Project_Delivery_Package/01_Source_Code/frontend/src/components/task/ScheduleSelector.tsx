import React, { useState } from 'react';
import {
  Card,
  Form,
  Radio,
  DatePicker,
  TimePicker,
  Select,
  Input,
  Space,
  Typography,
  Row,
  Col,
  Switch,
  Tag,
} from 'antd';
import {
  ClockCircleOutlined,
  CalendarOutlined,
  SyncOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import cronstrue from 'cronstrue';

import { ScheduleType, RecurringFrequency } from '../../types/task';

const { Title, Text } = Typography;
const { Option } = Select;

interface ScheduleSelectorProps {
  value?: any;
  onChange?: (value: any) => void;
}

const ScheduleSelector: React.FC<ScheduleSelectorProps> = ({ value, onChange }) => {
  const [scheduleType, setScheduleType] = useState<ScheduleType>(value?.type || 'immediate');
  const [cronExpression, setCronExpression] = useState<string>(value?.cronExpression || '');
  const [cronDescription, setCronDescription] = useState<string>('');

  const handleScheduleTypeChange = (type: ScheduleType) => {
    setScheduleType(type);
    const newValue = { type };
    
    // 设置默认值
    switch (type) {
      case 'immediate':
        newValue.immediate = true;
        break;
      case 'scheduled':
        newValue.scheduledAt = dayjs().add(1, 'hour').format();
        break;
      case 'recurring':
        newValue.recurring = {
          frequency: 'daily',
          timeOfDay: '09:00',
        };
        break;
      case 'cron':
        newValue.cronExpression = '0 9 * * *';
        break;
    }
    
    onChange?.(newValue);
  };

  const handleCronChange = (expression: string) => {
    setCronExpression(expression);
    
    try {
      const description = cronstrue.toString(expression);
      setCronDescription(description);
    } catch (error) {
      setCronDescription('无效的Cron表达式');
    }
    
    onChange?.({ type: 'cron', cronExpression: expression });
  };

  const renderImmediateSchedule = () => (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Text type="secondary">
        <ClockCircleOutlined /> 任务将在创建后立即开始执行
      </Text>
      <Tag color="blue">立即执行</Tag>
    </Space>
  );

  const renderScheduledSchedule = () => (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Form.Item
        label="执行时间"
        name="scheduledAt"
        rules={[{ required: true, message: '请选择执行时间' }]}
      >
        <DatePicker
          showTime
          format="YYYY-MM-DD HH:mm"
          style={{ width: '100%' }}
          placeholder="选择执行时间"
          defaultValue={dayjs().add(1, 'hour')}
        />
      </Form.Item>
      <Text type="secondary">
        <CalendarOutlined /> 任务将在指定时间执行一次
      </Text>
    </Space>
  );

  const renderRecurringSchedule = () => {
    const [frequency, setFrequency] = useState<RecurringFrequency>(
      value?.recurring?.frequency || 'daily'
    );

    const handleFrequencyChange = (newFrequency: RecurringFrequency) => {
      setFrequency(newFrequency);
      const recurring = {
        ...value?.recurring,
        frequency: newFrequency,
      };
      onChange?.({ type: 'recurring', recurring });
    };

    const renderDailyOptions = () => (
      <Form.Item
        label="执行时间"
        name={['recurring', 'timeOfDay']}
        rules={[{ required: true, message: '请选择执行时间' }]}
      >
        <TimePicker
          format="HH:mm"
          style={{ width: '100%' }}
          placeholder="选择执行时间"
          defaultValue={dayjs('09:00', 'HH:mm')}
        />
      </Form.Item>
    );

    const renderWeeklyOptions = () => (
      <>
        <Form.Item
          label="执行日期"
          name={['recurring', 'daysOfWeek']}
          rules={[{ required: true, message: '请选择执行日期' }]}
        >
          <Select
            mode="multiple"
            placeholder="选择每周执行日期"
            style={{ width: '100%' }}
          >
            <Option value={0}>星期日</Option>
            <Option value={1}>星期一</Option>
            <Option value={2}>星期二</Option>
            <Option value={3}>星期三</Option>
            <Option value={4}>星期四</Option>
            <Option value={5}>星期五</Option>
            <Option value={6}>星期六</Option>
          </Select>
        </Form.Item>
        <Form.Item
          label="执行时间"
          name={['recurring', 'timeOfDay']}
          rules={[{ required: true, message: '请选择执行时间' }]}
        >
          <TimePicker
            format="HH:mm"
            style={{ width: '100%' }}
            placeholder="选择执行时间"
            defaultValue={dayjs('09:00', 'HH:mm')}
          />
        </Form.Item>
      </>
    );

    const renderMonthlyOptions = () => (
      <>
        <Form.Item
          label="执行日期"
          name={['recurring', 'daysOfMonth']}
          rules={[{ required: true, message: '请选择执行日期' }]}
        >
          <Select
            mode="multiple"
            placeholder="选择每月执行日期"
            style={{ width: '100%' }}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
              <Option key={day} value={day}>
                {day}日
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          label="执行时间"
          name={['recurring', 'timeOfDay']}
          rules={[{ required: true, message: '请选择执行时间' }]}
        >
          <TimePicker
            format="HH:mm"
            style={{ width: '100%' }}
            placeholder="选择执行时间"
            defaultValue={dayjs('09:00', 'HH:mm')}
          />
        </Form.Item>
      </>
    );

    const renderCustomOptions = () => (
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="间隔天数"
            name={['recurring', 'interval']}
            rules={[{ required: true, message: '请输入间隔天数' }]}
          >
            <Input type="number" min={1} placeholder="例如: 3" addonAfter="天" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="执行时间"
            name={['recurring', 'timeOfDay']}
            rules={[{ required: true, message: '请选择执行时间' }]}
          >
            <TimePicker
              format="HH:mm"
              style={{ width: '100%' }}
              placeholder="选择执行时间"
              defaultValue={dayjs('09:00', 'HH:mm')}
            />
          </Form.Item>
        </Col>
      </Row>
    );

    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Form.Item
          label="执行频率"
          name={['recurring', 'frequency']}
          rules={[{ required: true, message: '请选择执行频率' }]}
        >
          <Select
            placeholder="选择执行频率"
            style={{ width: '100%' }}
            onChange={handleFrequencyChange}
            defaultValue="daily"
          >
            <Option value="daily">每天</Option>
            <Option value="weekly">每周</Option>
            <Option value="monthly">每月</Option>
            <Option value="custom">自定义间隔</Option>
          </Select>
        </Form.Item>

        {frequency === 'daily' && renderDailyOptions()}
        {frequency === 'weekly' && renderWeeklyOptions()}
        {frequency === 'monthly' && renderMonthlyOptions()}
        {frequency === 'custom' && renderCustomOptions()}

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="开始日期"
              name={['recurring', 'startDate']}
            >
              <DatePicker
                style={{ width: '100%' }}
                placeholder="选择开始日期"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="结束日期"
              name={['recurring', 'endDate']}
            >
              <DatePicker
                style={{ width: '100%' }}
                placeholder="选择结束日期（可选）"
              />
            </Form.Item>
          </Col>
        </Row>

        <Text type="secondary">
          <SyncOutlined /> 任务将按照设定的频率重复执行
        </Text>
      </Space>
    );
  };

  const renderCronSchedule = () => (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Form.Item
        label="Cron表达式"
        name="cronExpression"
        rules={[
          { required: true, message: '请输入Cron表达式' },
          {
            validator: (_, value) => {
              if (!value) return Promise.resolve();
              try {
                cronstrue.toString(value);
                return Promise.resolve();
              } catch (error) {
                return Promise.reject(new Error('无效的Cron表达式'));
              }
            },
          },
        ]}
      >
        <Input
          placeholder="例如: 0 9 * * * (每天9:00)"
          value={cronExpression}
          onChange={(e) => handleCronChange(e.target.value)}
          addonBefore={<CodeOutlined />}
        />
      </Form.Item>

      {cronDescription && (
        <Card size="small">
          <Text type="secondary">
            <strong>表达式说明:</strong> {cronDescription}
          </Text>
        </Card>
      )}

      <Space direction="vertical" size="small">
        <Text strong>常用表达式:</Text>
        <Space wrap>
          {[
            { expr: '0 9 * * *', desc: '每天9:00' },
            { expr: '0 9,18 * * *', desc: '每天9:00和18:00' },
            { expr: '0 9 * * 1', desc: '每周一9:00' },
            { expr: '0 9 1 * *', desc: '每月1号9:00' },
            { expr: '*/30 * * * *', desc: '每30分钟' },
          ].map((item) => (
            <Tag
              key={item.expr}
              color="blue"
              style={{ cursor: 'pointer' }}
              onClick={() => handleCronChange(item.expr)}
            >
              {item.desc}
            </Tag>
          ))}
        </Space>
      </Space>

      <Text type="secondary">
        <CodeOutlined /> 使用Cron表达式定义复杂的执行计划
      </Text>
    </Space>
  );

  return (
    <Card
      title={
        <Space>
          <CalendarOutlined />
          <span>时间调度</span>
        </Space>
      }
      size="small"
    >
      <Form.Item
        name="scheduleType"
        initialValue={scheduleType}
        rules={[{ required: true, message: '请选择调度类型' }]}
      >
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          style={{ width: '100%', marginBottom: 16 }}
          onChange={(e) => handleScheduleTypeChange(e.target.value)}
        >
          <Radio.Button value="immediate" style={{ flex: 1, textAlign: 'center' }}>
            立即执行
          </Radio.Button>
          <Radio.Button value="scheduled" style={{ flex: 1, textAlign: 'center' }}>
            定时执行
          </Radio.Button>
          <Radio.Button value="recurring" style={{ flex: 1, textAlign: 'center' }}>
            重复执行
          </Radio.Button>
          <Radio.Button value="cron" style={{ flex: 1, textAlign: 'center' }}>
            Cron表达式
          </Radio.Button>
        </Radio.Group>
      </Form.Item>

      {scheduleType === 'immediate' && renderImmediateSchedule()}
      {scheduleType === 'scheduled' && renderScheduledSchedule()}
      {scheduleType === 'recurring' && renderRecurringSchedule()}
      {scheduleType === 'cron' && renderCronSchedule()}
    </Card>
  );
};

export default ScheduleSelector;