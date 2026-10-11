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
  /** Currency of the plotted amounts (default NGN). Ignored when valueType is 'number'. */
  currency?: string;
  /** 'money' (default) formats as currency; 'number' for counts such as rides or users. */
  valueType?: 'money' | 'number';
}

const BarChart: React.FC<BarChartProps> = ({ data, xKey, bars, height = 300, currency, valueType = 'money' }) => {
  const fmt = (v: any) => (valueType === 'number' ? Number(v ?? 0).toLocaleString() : formatCurrency(v, currency));
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
          tickFormatter={(value) => fmt(value)}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#fff', 
            border: '1px solid #e0e0e0',
            borderRadius: '8px'
          }}
          formatter={(value: any) => fmt(value)}
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