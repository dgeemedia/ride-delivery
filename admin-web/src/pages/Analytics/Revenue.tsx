// admin-web/src/pages/Analytics/Revenue.tsx
import React, { useEffect, useState } from 'react';
import { Card, Select, Spinner } from '@/components/common';
import { LineChart, BarChart } from '@/components/charts';
import { analyticsAPI } from '@/services/api/analytics';
import { RevenueAnalytics } from '@/types';
import { TrendingUp, DollarSign, CreditCard, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PERIOD_OPTIONS = [
  { value: 'week',  label: 'Last 7 Days'  },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'year',  label: 'Last Year'    },
];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

interface StatCardProps {
  label:   string;
  value:   string;
  sub?:    string;
  icon:    React.ReactNode;
  iconBg:  string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, iconBg }) => (
  <Card>
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
      <div className={`flex-shrink-0 p-2 rounded-lg ml-3 ${iconBg}`}>
        {icon}
      </div>
    </div>
  </Card>
);

const Revenue: React.FC = () => {
  const [period,  setPeriod]  = useState('month');
  const [data,    setData]    = useState<RevenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [period]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await analyticsAPI.getRevenueAnalytics(period);
      setData(res.data);
    } catch {
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Spinner size="xl" />
        <p className="text-sm text-gray-500 animate-pulse">Loading revenue data…</p>
      </div>
    );
  }

  // Convert byMethod object → array for chart
  const byMethodData = Object.entries(data.byMethod || {}).map(([method, amount]) => ({
    method,
    amount: amount as number,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Analytics</h1>
          <p className="text-gray-500 mt-1 text-sm">Financial performance across all payment types</p>
        </div>
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          options={PERIOD_OPTIONS}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Revenue"
          value={fmt(data.totalRevenue)}
          sub={`${data.transactionCount.toLocaleString()} transactions`}
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Platform Fee (20%)"
          value={fmt(data.platformFee)}
          sub="Commission earned"
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50"
        />
        <StatCard
          label="Net to Earners (80%)"
          value={fmt(data.netRevenue)}
          sub="Paid to drivers & partners"
          icon={<CreditCard className="h-5 w-5 text-purple-600" />}
          iconBg="bg-purple-50"
        />
        <StatCard
          label="Transactions"
          value={data.transactionCount.toLocaleString()}
          sub={`in the last ${period}`}
          icon={<BarChart2 className="h-5 w-5 text-orange-500" />}
          iconBg="bg-orange-50"
        />
      </div>

      {/* Revenue trend */}
      <Card>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Revenue Trend</h3>
        {data.dailyRevenue.length > 0 ? (
          <LineChart
            data={data.dailyRevenue}
            xKey="date"
            lines={[
              { key: 'total',      name: 'Total',      color: '#007AFF' },
              { key: 'rides',      name: 'Rides',      color: '#34C759' },
              { key: 'deliveries', name: 'Deliveries', color: '#FF9500' },
            ]}
            height={320}
          />
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            No revenue data for this period
          </div>
        )}
      </Card>

      {/* Revenue by payment method */}
      <Card>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Revenue by Payment Method</h3>
        {byMethodData.length > 0 ? (
          <BarChart
            data={byMethodData}
            xKey="method"
            bars={[{ key: 'amount', name: 'Revenue (NGN)', color: '#007AFF' }]}
            height={280}
          />
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            No payment method data for this period
          </div>
        )}
      </Card>

      {/* Breakdown table */}
      {byMethodData.length > 0 && (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Method Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">Payment Method</th>
                  <th className="text-right py-2 pr-4 text-gray-500 font-medium">Amount</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {byMethodData
                  .sort((a, b) => b.amount - a.amount)
                  .map(({ method, amount }) => (
                    <tr key={method} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-4 font-medium text-gray-900 capitalize">
                        {method.toLowerCase().replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-gray-700">
                        {fmt(amount)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-gray-500">
                        {data.totalRevenue > 0
                          ? `${((amount / data.totalRevenue) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td className="pt-2.5 font-semibold text-gray-900">Total</td>
                  <td className="pt-2.5 text-right font-semibold text-gray-900 tabular-nums">
                    {fmt(data.totalRevenue)}
                  </td>
                  <td className="pt-2.5 text-right text-gray-500">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Revenue;