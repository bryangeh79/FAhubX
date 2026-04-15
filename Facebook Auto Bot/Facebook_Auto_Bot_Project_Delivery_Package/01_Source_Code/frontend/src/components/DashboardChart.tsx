import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, Spin, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface DashboardChartProps {
  type: 'tasks' | 'successRate' | 'conversations' | 'accounts';
  title?: string;
  height?: number;
}

const DashboardChart: React.FC<DashboardChartProps> = ({
  type,
  title,
  height = 300,
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: [`chart-${type}`],
    queryFn: () => api.get(`/dashboard/charts/${type}`).then(res => res.data),
    staleTime: 5 * 60 * 1000, // 5分钟
  });

  if (isLoading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="暂无数据" />
      </div>
    );
  }

  const chartData = data.data;

  const renderChart = () => {
    switch (type) {
      case 'tasks':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="completed"
              name="完成任务"
              stroke="#52c41a"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="failed"
              name="失败任务"
              stroke="#f5222d"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="running"
              name="运行中任务"
              stroke="#1890ff"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );

      case 'successRate':
        return (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis unit="%" />
            <Tooltip formatter={(value) => [`${value}%`, '成功率']} />
            <Legend />
            <Area
              type="monotone"
              dataKey="rate"
              name="成功率"
              stroke="#52c41a"
              fill="#52c41a"
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </AreaChart>
        );

      case 'conversations':
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="sent"
              name="发送消息"
              fill="#1890ff"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="received"
              name="接收消息"
              fill="#52c41a"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );

      case 'accounts':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="active"
              name="活跃账号"
              stroke="#52c41a"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="总账号数"
              stroke="#1890ff"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );

      default:
        return <Empty description="不支持的图表类型" />;
    }
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      {renderChart()}
    </ResponsiveContainer>
  );
};

export default DashboardChart;