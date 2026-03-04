import React from 'react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/utils/helpers';

interface BarChartProps {
  data: any[];
  xKey: string;
  bars: Array<{
    key: string;
    name: string;
    color: string;
  }>;
  height?: number;
}

const BarChart: React.FC<BarChartProps> = ({ data, xKey, bars, height = 300 }) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          dataKey={xKey}
          stroke="#757575"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#757575"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => formatCurrency(value)}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#fff', 
            border: '1px solid #e0e0e0',
            borderRadius: '8px'
          }}
          formatter={(value: any) => formatCurrency(value)}
        />
        <Legend />
        {bars.map((bar) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name}
            fill={bar.color}
            radius={[8, 8, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
};

export default BarChart;