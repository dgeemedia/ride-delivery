import React from 'react';
import { AreaChart as RechartsAreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AreaChartProps {
  data: any[];
  xKey: string;
  areaKey: string;
  areaName: string;
  color: string;
  height?: number;
}

const AreaChart: React.FC<AreaChartProps> = ({ 
  data, 
  xKey, 
  areaKey, 
  areaName, 
  color, 
  height = 300 
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data}>
        <defs>
          <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          dataKey={xKey}
          stroke="#757575"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#757575"
          style={{ fontSize: '12px' }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#fff', 
            border: '1px solid #e0e0e0',
            borderRadius: '8px'
          }}
        />
        <Area
          type="monotone"
          dataKey={areaKey}
          name={areaName}
          stroke={color}
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorArea)"
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
};

export default AreaChart;