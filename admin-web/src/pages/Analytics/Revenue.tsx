// admin-web/src/pages/Analytics/Revenue.tsx
import React from 'react';
import { Card } from '@/components/common';
import { LineChart } from '@/components/charts';

const Revenue: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Revenue Analytics</h1>
      <Card>
        <LineChart
          data={[]}
          xKey="date"
          lines={[{ key: 'revenue', name: 'Revenue', color: '#007AFF' }]}
        />
      </Card>
    </div>
  );
};

export default Revenue;