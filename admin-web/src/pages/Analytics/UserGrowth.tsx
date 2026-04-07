// admin-web/src/pages/Analytics/UserGrowth.tsx
import React, { useEffect, useState } from 'react';
import { Card, Select } from '@/components/common';
import { AreaChart, BarChart } from '@/components/charts';
import { analyticsAPI } from '@/services/api/analytics';
import { UserGrowth as UserGrowthType } from '@/types';
import toast from 'react-hot-toast';

const UserGrowth: React.FC = () => {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState<UserGrowthType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await analyticsAPI.getUserGrowth(period);
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load user growth data');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Growth</h1>
          <p className="text-gray-600 mt-1">Track user acquisition and growth trends</p>
        </div>
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          options={[
            { value: 'week', label: 'Last Week' },
            { value: 'month', label: 'Last Month' },
            { value: 'year', label: 'Last Year' },
          ]}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <p className="text-sm text-gray-600">Total Users</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {data.totalUsers.toLocaleString()}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-600">Customers</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">
            {data.growth.reduce((sum, g) => sum + g.customers, 0).toLocaleString()}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-600">Drivers</p>
          <p className="text-3xl font-bold text-success-600 mt-1">
            {data.growth.reduce((sum, g) => sum + g.drivers, 0).toLocaleString()}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-600">Partners</p>
          <p className="text-3xl font-bold text-warning-600 mt-1">
            {data.growth.reduce((sum, g) => sum + g.partners, 0).toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Growth Chart */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">User Growth Over Time</h3>
        <AreaChart
          data={data.growth}
          xKey="month"
          areaKey="total"
          areaName="Total Users"
          color="#007AFF"
          height={400}
        />
      </Card>

      {/* Breakdown by Type */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Growth by User Type</h3>
        <BarChart
          data={data.growth}
          xKey="month"
          bars={[
            { key: 'customers', name: 'Customers', color: '#007AFF' },
            { key: 'drivers', name: 'Drivers', color: '#34C759' },
            { key: 'partners', name: 'Partners', color: '#FF9500' },
          ]}
          height={400}
        />
      </Card>
    </div>
  );
};

export default UserGrowth;