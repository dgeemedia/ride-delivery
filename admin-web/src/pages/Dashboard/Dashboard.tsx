// admin-web/src/pages/Dashboard/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { Users, Car, Package, DollarSign, TrendingUp, Activity } from 'lucide-react';
import { Card } from '@/components/common';
import { LineChart, BarChart } from '@/components/charts';
import { analyticsAPI } from '@/services/api/analytics';
import { DashboardStats, RevenueAnalytics } from '@/types';
import { formatCurrency } from '@/utils/helpers';
import toast from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, revenueRes] = await Promise.all([
        analyticsAPI.getDashboardStats(),
        analyticsAPI.getRevenueAnalytics('week'),
      ]);
      setStats(statsRes.data);
      setRevenue(revenueRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <div>Loading...</div>;
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.users.total.toLocaleString(),
      icon: Users,
      color: 'bg-primary-500',
      change: '+12%',
    },
    {
      title: 'Active Rides',
      value: stats.rides.active.toLocaleString(),
      icon: Car,
      color: 'bg-success-500',
      change: '+5%',
    },
    {
      title: 'Active Deliveries',
      value: stats.deliveries.active.toLocaleString(),
      icon: Package,
      color: 'bg-warning-500',
      change: '+8%',
    },
    {
      title: "Today's Revenue",
      value: formatCurrency(stats.revenue.today),
      icon: DollarSign,
      color: 'bg-error-500',
      change: '+15%',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                <p className="text-sm text-success-600 mt-1">{stat.change} from last week</p>
              </div>
              <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Revenue Trend (Last 7 Days)</h3>
          {revenue && (
            <LineChart
              data={revenue.dailyRevenue}
              xKey="date"
              lines={[
                { key: 'total', name: 'Total Revenue', color: '#007AFF' },
                { key: 'rides', name: 'Rides', color: '#34C759' },
                { key: 'deliveries', name: 'Deliveries', color: '#FF9500' },
              ]}
            />
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Service Comparison</h3>
          {revenue && (
            <BarChart
              data={revenue.dailyRevenue.slice(-7)}
              xKey="date"
              bars={[
                { key: 'rides', name: 'Rides', color: '#34C759' },
                { key: 'deliveries', name: 'Deliveries', color: '#FF9500' },
              ]}
            />
          )}
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-success-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Rides</p>
              <p className="text-xl font-bold">{stats.rides.total.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <Package className="h-8 w-8 text-warning-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Deliveries</p>
              <p className="text-xl font-bold">{stats.deliveries.total.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-primary-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Month Revenue</p>
              <p className="text-xl font-bold">{formatCurrency(stats.revenue.month)}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;