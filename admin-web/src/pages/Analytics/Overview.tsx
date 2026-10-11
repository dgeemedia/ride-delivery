// admin-web/src/pages/Analytics/Overview.tsx
import React, { useEffect, useState } from 'react';
import { analyticsAPI } from '@/services/api/analytics';
import { Card, Spinner } from '@/components/common';
import { LineChart, BarChart } from '@/components/charts';
import { CountrySelect } from '@/components/CountryFilter';

const Analytics: React.FC = () => {
  const [revenue,    setRevenue]    = useState<any>(null);
  const [userGrowth, setUserGrowth] = useState<any>(null);
  // '' = the server's default market (Nigeria, or the admin's first assigned country).
  const [country, setCountry] = useState('');

  useEffect(() => {
    loadAnalytics();
  }, [country]);

  const loadAnalytics = async () => {
    const [revenueRes, growthRes] = await Promise.all([
      analyticsAPI.getRevenueAnalytics('month', country || undefined),
      analyticsAPI.getUserGrowth('month', country || undefined),
    ]);
    setRevenue(revenueRes.data);
    setUserGrowth(growthRes.data);
  };

  if (!revenue || !userGrowth) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <Spinner size="xl" />
      <p className="text-sm text-gray-500 animate-pulse">Loading analytics…</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            {revenue.countryName ?? 'Nigeria'} · amounts in {revenue.currency}. Pick a country to switch market.
          </p>
        </div>
        <CountrySelect allLabel={null} value={country || revenue.country || ''} onChange={setCountry} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
          <LineChart
            data={revenue.dailyRevenue}
            xKey="date"
            lines={[
              { key: 'total', name: 'Revenue', color: '#007AFF' },
            ]}
            currency={revenue.currency}
          />
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">User Growth</h3>
          <BarChart
            data={userGrowth.growth}
            xKey="month"
            bars={[
              { key: 'customers', name: 'Customers', color: '#34C759' },
              { key: 'drivers',   name: 'Drivers',   color: '#FF9500' },
            ]}
            valueType="number"
          />
        </Card>
      </div>
    </div>
  );
};

export default Analytics;