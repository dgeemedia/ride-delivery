import React from 'react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/utils/helpers';

interface LineChartProps {
  data: any[];
  xKey: string;
  lines: Array<{
    key: string;
    name: string;
    color: string;
  }>;
  height?: number;
}

const LineChart: React.FC<LineChartProps> = ({ data, xKey, lines, height = 300 }) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data}>
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
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={{ fill: line.color, strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
};

export default LineChart;