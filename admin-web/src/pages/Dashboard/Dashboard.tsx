// admin-web/src/pages/Dashboard/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Car, Package, DollarSign, TrendingUp, Activity, Shield } from 'lucide-react';
import { Card } from '@/components/common';
import { LineChart, BarChart } from '@/components/charts';
import { analyticsAPI } from '@/services/api/analytics';
import api from '@/services/api';
import { DashboardStats, RevenueAnalytics } from '@/types';
import { formatCurrency } from '@/utils/helpers';
import toast from 'react-hot-toast';

// ─── Feature flags (set in admin-web/.env) ────────────────────────────────────
const ENABLE_SHIELD    = import.meta.env.VITE_ENABLE_SHIELD    === 'true';
const ENABLE_CORPORATE = import.meta.env.VITE_ENABLE_CORPORATE === 'true';
const ENABLE_DUOPAY    = import.meta.env.VITE_ENABLE_DUOPAY    === 'true';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats,        setStats]        = useState<DashboardStats | null>(null);
  const [revenue,      setRevenue]      = useState<RevenueAnalytics | null>(null);
  const [shieldActive, setShieldActive] = useState<number>(0);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [statsRes, revenueRes, shieldRes] = await Promise.all([
        analyticsAPI.getDashboardStats(),
        analyticsAPI.getRevenueAnalytics('week'),
        // Only fetch SHIELD stats if feature is enabled
        ENABLE_SHIELD
          ? api.get('/admin/shield/stats').catch(() => ({ data: { data: { activeSessions: 0 } } }))
          : Promise.resolve({ data: { data: { activeSessions: 0 } } }),
      ]);
      setStats(statsRes.data);
      setRevenue(revenueRes.data);
      setShieldActive(shieldRes.data.data.activeSessions ?? 0);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) return <div>Loading...</div>;

  const statCards = [
    {
      title:  'Total Users',
      value:  stats.users.total.toLocaleString(),
      icon:   Users,
      color:  'bg-primary-500',
      change: '+12%',
      onClick: () => navigate('/users'),
    },
    {
      title:  'Active Rides',
      value:  stats.rides.active.toLocaleString(),
      icon:   Car,
      color:  'bg-success-500',
      change: '+5%',
      onClick: () => navigate('/rides/live'),
    },
    {
      title:  'Active Deliveries',
      value:  stats.deliveries.active.toLocaleString(),
      icon:   Package,
      color:  'bg-warning-500',
      change: '+8%',
      onClick: () => navigate('/deliveries'),
    },
    {
      title:  "Today's Revenue",
      value:  formatCurrency(stats.revenue.today),
      icon:   DollarSign,
      color:  'bg-error-500',
      change: '+15%',
      onClick: undefined,
    },
    // SHIELD stat card — only shown when SHIELD is enabled
    ...(ENABLE_SHIELD ? [{
      title:  'SHIELD Active',
      value:  shieldActive,
      icon:   Shield,
      color:  'bg-green-500',
      change: 'Live safety sessions',
      onClick: () => navigate('/shield'),
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${
        ENABLE_SHIELD ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
      }`}>
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className={`hover:shadow-lg transition-shadow ${stat.onClick ? 'cursor-pointer' : ''}`}
            onClick={stat.onClick}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                <p className={`text-sm mt-1 ${
                  stat.title === 'SHIELD Active' && shieldActive > 0
                    ? 'text-green-600 font-semibold'
                    : 'text-success-600'
                }`}>
                  {stat.title === 'SHIELD Active' && shieldActive > 0
                    ? '🛡️ Sessions live now'
                    : stat.change}
                </p>
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
                { key: 'total',      name: 'Total Revenue', color: '#007AFF' },
                { key: 'rides',      name: 'Rides',         color: '#34C759' },
                { key: 'deliveries', name: 'Deliveries',    color: '#FF9500' },
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
                { key: 'rides',      name: 'Rides',      color: '#34C759' },
                { key: 'deliveries', name: 'Deliveries', color: '#FF9500' },
              ]}
            />
          )}
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

        {/* SHIELD quick stat — only shown when SHIELD is enabled */}
        {ENABLE_SHIELD && (
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/shield')}
          >
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">SHIELD Monitor</p>
                <p className="text-xl font-bold">{shieldActive} live</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;