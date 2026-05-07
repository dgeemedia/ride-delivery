// admin-web/src/pages/Analytics/Performance.tsx
import React, { useEffect, useState } from 'react';
import { Card, Select, Spinner } from '@/components/common';
import { LineChart, PieChart } from '@/components/charts';
import { Clock, Star, CheckCircle } from 'lucide-react';
import { analyticsAPI, PerformanceAnalytics } from '@/services/api/analytics';
import toast from 'react-hot-toast';

const PERIOD_OPTIONS = [
  { value: 'week',  label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'year',  label: 'Last Year'    },
];

// Formats a nullable number of minutes as "24.5 min" or "—" when unavailable
const fmtMinutes = (v: number | null) =>
  v !== null ? `${v} min` : '—';

// Formats a nullable rating as "4.7" or "—"
const fmtRating = (v: number | null) =>
  v !== null ? String(v) : '—';

interface KpiCardProps {
  label:    string;
  value:    string;
  delta?:   null; // deltas are intentionally removed — no hardcoded numbers
  icon:     React.ReactNode;
  iconBg:   string;
  subtext?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, icon, iconBg, subtext }) => (
  <Card>
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
        {subtext && (
          <p className="text-xs text-gray-400 mt-1">{subtext}</p>
        )}
      </div>
      <div className={`flex-shrink-0 p-2 rounded-lg ml-3 ${iconBg}`}>
        {icon}
      </div>
    </div>
  </Card>
);

const Performance: React.FC = () => {
  const [period,  setPeriod]  = useState('week');
  const [data,    setData]    = useState<PerformanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [period]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await analyticsAPI.getPerformanceAnalytics(period);
      setData(res.data);
    } catch {
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Spinner size="xl" />
        <p className="text-sm text-gray-500 animate-pulse">Loading performance data…</p>
      </div>
    );
  }

  const { metrics, weeklyActivity, completionData } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Metrics</h1>
          <p className="text-gray-500 mt-1 text-sm">Monitor platform performance and efficiency</p>
        </div>
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          options={PERIOD_OPTIONS}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          label="Avg Ride Time"
          value={fmtMinutes(metrics.averageRideTime)}
          icon={<Clock className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
          subtext={metrics.averageRideTime === null ? 'No completed rides yet' : undefined}
        />
        <KpiCard
          label="Avg Delivery Time"
          value={fmtMinutes(metrics.averageDeliveryTime)}
          icon={<Clock className="h-5 w-5 text-orange-500" />}
          iconBg="bg-orange-50"
          subtext={metrics.averageDeliveryTime === null ? 'No completed deliveries yet' : undefined}
        />
        <KpiCard
          label="Driver Rating"
          value={fmtRating(metrics.driverRating)}
          icon={<Star className="h-5 w-5 text-yellow-500 fill-yellow-400" />}
          iconBg="bg-yellow-50"
          subtext={metrics.driverRating === null ? 'No ratings yet' : undefined}
        />
        <KpiCard
          label="Completion Rate"
          value={`${metrics.completionRate}%`}
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50"
          subtext={`${metrics.completedRides + metrics.completedDeliveries} completed`}
        />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <p className="text-sm text-gray-500 mb-3">Rides</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Completed</span>
              <span className="font-semibold text-green-600">{metrics.completedRides.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Cancelled</span>
              <span className="font-semibold text-red-500">{metrics.cancelledRides.toLocaleString()}</span>
            </div>
            <div className="h-px bg-gray-100 my-1" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Completion rate</span>
              <span className="font-bold text-gray-900">{metrics.rideCompletionRate}%</span>
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-sm text-gray-500 mb-3">Deliveries</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Completed</span>
              <span className="font-semibold text-green-600">{metrics.completedDeliveries.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Cancelled</span>
              <span className="font-semibold text-red-500">{metrics.cancelledDeliveries.toLocaleString()}</span>
            </div>
            <div className="h-px bg-gray-100 my-1" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Completion rate</span>
              <span className="font-bold text-gray-900">{metrics.deliveryCompletionRate}%</span>
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-sm text-gray-500 mb-3">Ratings</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Driver avg</span>
              <span className="font-semibold text-gray-900 flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                {fmtRating(metrics.driverRating)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Partner avg</span>
              <span className="font-semibold text-gray-900 flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                {fmtRating(metrics.partnerRating)}
              </span>
            </div>
            <div className="h-px bg-gray-100 my-1" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Cancellation rate</span>
              <span className="font-bold text-red-500">{metrics.cancellationRate}%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Completion vs Cancellation</h3>
          <PieChart
            data={completionData}
            nameKey="name"
            valueKey="value"
            colors={['#34C759', '#FF3B30']}
            height={300}
          />
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Weekly Activity (last 7 days)</h3>
          <LineChart
            data={weeklyActivity}
            xKey="day"
            lines={[
              { key: 'rides',      name: 'Rides',      color: '#007AFF' },
              { key: 'deliveries', name: 'Deliveries', color: '#FF9500' },
            ]}
            height={300}
          />
        </Card>
      </div>
    </div>
  );
};

export default Performance;