import React, { useEffect, useState } from 'react';
import { analyticsAPI } from '@/services/api/analytics';
import { Card } from '@/components/common';
import { LineChart, BarChart, PieChart } from '@/components/charts';

const Analytics: React.FC = () => {
  const [revenue, setRevenue] = useState<any>(null);
  const [userGrowth, setUserGrowth] = useState<any>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    const [revenueRes, growthRes] = await Promise.all([
      analyticsAPI.getRevenueAnalytics('month'),
      analyticsAPI.getUserGrowth('month'),
    ]);
    setRevenue(revenueRes.data);
    setUserGrowth(growthRes.data);
  };

  if (!revenue || !userGrowth) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
          <LineChart
            data={revenue.dailyRevenue}
            xKey="date"
            lines={[
              { key: 'total', name: 'Revenue', color: '#007AFF' }
            ]}
          />
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">User Growth</h3>
          <BarChart
            data={userGrowth.growth}
            xKey="month"
            bars={[
              { key: 'customers', name: 'Customers', color: '#34C759' },
              { key: 'drivers', name: 'Drivers', color: '#FF9500' },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};

export default Analytics;