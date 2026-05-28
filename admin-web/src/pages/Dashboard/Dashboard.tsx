// admin-web/src/pages/Dashboard/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Car, Package, DollarSign, TrendingUp, Activity, Shield, Clock, UserX } from 'lucide-react';
import { Card, Spinner } from '@/components/common';
import { LineChart, BarChart } from '@/components/charts';
import { analyticsAPI } from '@/services/api/analytics';
import api from '@/services/api';
import { DashboardStats, RevenueAnalytics } from '@/types';
import { formatCurrency, formatDate } from '@/utils/helpers';
import toast from 'react-hot-toast';

// ─── Feature flags ──────────────────────────────────────────────────────────
const ENABLE_SHIELD = import.meta.env.VITE_ENABLE_SHIELD === 'true';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Formats a numeric delta as "+12.5%" / "-3.2%" / null → undefined (no badge shown).
 * Returns both the formatted string and a CSS colour class.
 */
function formatDelta(delta: number | null | undefined): { label: string; positive: boolean } | null {
  if (delta === null || delta === undefined) return null;
  const positive = delta >= 0;
  return {
    label:    `${positive ? '+' : ''}${delta}% vs yesterday`,
    positive,
  };
}

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

  if (loading || !stats) return (
    <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
      <Spinner size="xl" />
      <p className="text-sm text-gray-500 animate-pulse">Loading dashboard…</p>
    </div>
  );

  // ── Real sub-labels derived from live data ──────────────────────────────────
  const revenueDelta = formatDelta(stats.revenue?.revenueDelta ?? stats.deltas?.revenue);
  const userDelta    = formatDelta(stats.deltas?.users);

const statCards = [
    {
      title:    'Total Customers',
      value:    stats.users.total.toLocaleString(),
      icon:     Users,
      color:    'bg-primary-500',
      subLabel: stats.users.newToday !== undefined
        ? userDelta
          ? { label: userDelta.label, positive: userDelta.positive }
          : { label: `+${stats.users.newToday} today`, positive: true }
        : null,
      onClick:  () => navigate('/users'),
    },
    {
      title:    'Total Drivers',
      value:    stats.users.drivers.toLocaleString(),
      icon:     Car,
      color:    'bg-blue-500',
      subLabel: stats.suspended?.driversCount
        ? { label: `${stats.suspended.driversCount} suspended`, positive: false }
        : null,
      onClick:  () => navigate('/drivers'),
    },
    {
      title:    'Total Delivery Partners',
      value:    stats.users.partners.toLocaleString(),
      icon:     Package,
      color:    'bg-indigo-500',
      subLabel: stats.suspended?.partnersCount
        ? { label: `${stats.suspended.partnersCount} suspended`, positive: false }
        : null,
      onClick:  () => navigate('/partners'),
    },
    {
      title:    'Pending Driver Approvals',
      value:    stats.pending.drivers.toLocaleString(),
      icon:     Clock,
      color:    stats.pending.drivers > 0 ? 'bg-amber-500' : 'bg-success-500',
      subLabel: stats.pending.drivers === 0
        ? { label: 'All approvals up to date', positive: true }
        : { label: 'Awaiting review', positive: false },
      onClick:  () => navigate('/drivers?status=pending'),
    },
    {
      title:    'Pending Partner Approvals',
      value:    stats.pending.partners.toLocaleString(),
      icon:     Clock,
      color:    stats.pending.partners > 0 ? 'bg-amber-500' : 'bg-success-500',
      subLabel: stats.pending.partners === 0
        ? { label: 'All approvals up to date', positive: true }
        : { label: 'Awaiting review', positive: false },
      onClick:  () => navigate('/partners?status=pending'),
    },
    {
      title:    'Active Rides',
      value:    stats.rides.active.toLocaleString(),
      icon:     Car,
      color:    'bg-success-500',
      subLabel: stats.rides.total > 0
        ? { label: `${stats.rides.total.toLocaleString()} completed total`, positive: true }
        : null,
      onClick:  () => navigate('/rides/live'),
    },
    {
      title:    'Active Deliveries',
      value:    stats.deliveries.active.toLocaleString(),
      icon:     Package,
      color:    'bg-warning-500',
      subLabel: stats.deliveries.total > 0
        ? { label: `${stats.deliveries.total.toLocaleString()} delivered total`, positive: true }
        : null,
      onClick:  () => navigate('/deliveries'),
    },
    {
      title:    "Today's Revenue",
      value:    formatCurrency(stats.revenue.today),
      icon:     DollarSign,
      color:    'bg-error-500',
      subLabel: revenueDelta,
      onClick:  undefined as (() => void) | undefined,
    },
    ...(ENABLE_SHIELD ? [{
      title:    'SHIELD Active',
      value:    shieldActive,
      icon:     Shield,
      color:    'bg-green-500',
      subLabel: shieldActive > 0
        ? { label: '🛡️ Sessions live now', positive: true }
        : { label: 'No active sessions', positive: false },
      onClick:  () => navigate('/shield') as void,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                {stat.subLabel && (
                  <p className={`text-sm mt-1 ${
                    stat.subLabel.positive ? 'text-success-600' : 'text-gray-400'
                  }`}>
                    {stat.subLabel.label}
                  </p>
                )}
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
          {revenue && revenue.dailyRevenue.length > 0 ? (
            <LineChart
              data={revenue.dailyRevenue}
              xKey="date"
              lines={[
                { key: 'total',      name: 'Total Revenue', color: '#007AFF' },
                { key: 'rides',      name: 'Rides',         color: '#34C759' },
                { key: 'deliveries', name: 'Deliveries',    color: '#FF9500' },
              ]}
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              No revenue data for the last 7 days
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Service Comparison</h3>
          {revenue && revenue.dailyRevenue.length > 0 ? (
            <BarChart
              data={revenue.dailyRevenue.slice(-7)}
              xKey="date"
              bars={[
                { key: 'rides',      name: 'Rides',      color: '#34C759' },
                { key: 'deliveries', name: 'Deliveries', color: '#FF9500' },
              ]}
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              No service data yet
            </div>
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
{/* Suspended Users */}
      {((stats.suspended?.driversList?.length ?? 0) > 0 ||
        (stats.suspended?.partnersList?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Suspended Drivers */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <UserX className="h-5 w-5 text-error-500" />
              <h3 className="text-lg font-semibold">
                Suspended Drivers
                {(stats.suspended?.driversCount ?? 0) > 0 && (
                  <span className="ml-2 text-sm font-normal text-error-500">
                    ({stats.suspended.driversCount})
                  </span>
                )}
              </h3>
            </div>
            {(stats.suspended?.driversList?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400">No suspended drivers.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {stats.suspended.driversList.map(d => (
                  <div
                    key={d.id}
                    className="py-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-gray-50 px-1 rounded"
                    onClick={() => navigate(`/drivers/${d.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {d.firstName} {d.lastName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{d.email}</p>
                      {d.suspensionReason && (
                        <p className="text-xs text-error-500 mt-0.5 truncate">
                          {d.suspensionReason}
                        </p>
                      )}
                    </div>
                    {d.suspendedAt && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatDate(d.suspendedAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Suspended Delivery Partners */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <UserX className="h-5 w-5 text-error-500" />
              <h3 className="text-lg font-semibold">
                Suspended Delivery Partners
                {(stats.suspended?.partnersCount ?? 0) > 0 && (
                  <span className="ml-2 text-sm font-normal text-error-500">
                    ({stats.suspended.partnersCount})
                  </span>
                )}
              </h3>
            </div>
            {(stats.suspended?.partnersList?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400">No suspended partners.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {stats.suspended.partnersList.map(p => (
                  <div
                    key={p.id}
                    className="py-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-gray-50 px-1 rounded"
                    onClick={() => navigate(`/partners/${p.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{p.email}</p>
                      {p.suspensionReason && (
                        <p className="text-xs text-error-500 mt-0.5 truncate">
                          {p.suspensionReason}
                        </p>
                      )}
                    </div>
                    {p.suspendedAt && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatDate(p.suspendedAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>
      )}
    </div>
  );
};

export default Dashboard;