// admin-web/src/pages/Payments/PaymentList.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, DollarSign, CheckCircle, XCircle, Clock,
  RefreshCw, Filter, Search, TrendingUp, Car, Package,
  Wallet, Banknote, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentStatus = 'ALL' | 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED';
type PaymentMethod = 'ALL' | 'CASH' | 'CARD' | 'WALLET';
type ServiceFilter = 'ALL' | 'RIDE' | 'DELIVERY';

interface PaymentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface Payment {
  id: string;
  userId: string;
  user: PaymentUser;
  amount: number;
  currency: string;
  method: string;
  status: string;
  transactionId?: string;
  rideId?: string;
  deliveryId?: string;
  // commission fields (populated when CommissionLedger exists)
  platformFee?: number;
  driverEarnings?: number;
  createdAt: string;
  updatedAt: string;
}

interface PaymentStats {
  totalRevenue:      number;
  todayRevenue:      number;
  totalCommission:   number;
  todayCommission:   number;
  pendingCount:      number;
  refundedTotal:     number;
  byMethod:          { method: string; count: number; total: number }[];
}

interface Pagination { total: number; page: number; pages: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₦${(n ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  PENDING:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  FAILED:    'bg-red-100 text-red-800 border-red-200',
  REFUNDED:  'bg-purple-100 text-purple-800 border-purple-200',
};

const METHOD_ICON: Record<string, React.ReactNode> = {
  CASH:   <Banknote className="w-3.5 h-3.5" />,
  CARD:   <CreditCard className="w-3.5 h-3.5" />,
  WALLET: <Wallet className="w-3.5 h-3.5" />,
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
    {status === 'COMPLETED' && <CheckCircle className="w-3 h-3" />}
    {status === 'PENDING'   && <Clock       className="w-3 h-3" />}
    {status === 'FAILED'    && <XCircle     className="w-3 h-3" />}
    {status === 'REFUNDED'  && <RefreshCw   className="w-3 h-3" />}
    {status}
  </span>
);

const ServiceBadge: React.FC<{ rideId?: string; deliveryId?: string }> = ({ rideId, deliveryId }) => {
  if (rideId)     return <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium"><Car className="w-3 h-3" />Ride</span>;
  if (deliveryId) return <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium"><Package className="w-3 h-3" />Delivery</span>;
  return <span className="text-xs text-gray-400">—</span>;
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string;
}> = ({ label, value, sub, icon, color }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
    <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center mb-3`}>
      {icon}
    </div>
    <div className="text-xl font-bold text-gray-900">{value}</div>
    {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    <div className="text-xs text-gray-500 mt-0.5">{label}</div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const PaymentList: React.FC = () => {
  const [payments,    setPayments]    = useState<Payment[]>([]);
  const [stats,       setStats]       = useState<PaymentStats | null>(null);
  const [pagination,  setPagination]  = useState<Pagination>({ total: 0, page: 1, pages: 1 });
  const [loading,     setLoading]     = useState(false);

  // Filters
  const [status,  setStatus]  = useState<PaymentStatus>('ALL');
  const [method,  setMethod]  = useState<PaymentMethod>('ALL');
  const [service, setService] = useState<ServiceFilter>('ALL');
  const [search,  setSearch]  = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/payments/stats');
      setStats(res.data.data);
    } catch { /* non-critical */ }
  }, []);

  const loadPayments = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 25 };
      if (status  !== 'ALL') params.status  = status;
      if (method  !== 'ALL') params.method  = method;
      if (service === 'RIDE')     params.hasRide = 'true';
      if (service === 'DELIVERY') params.hasDelivery = 'true';
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await api.get('/admin/payments', { params });
      setPayments(res.data.data?.payments ?? res.data.data ?? []);
      setPagination(res.data.data?.pagination ?? res.data.pagination ?? { total: 0, page: 1, pages: 1 });
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [status, method, service, debouncedSearch]);

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { loadPayments(1); }, [status, method, service, debouncedSearch]);

  const STATUS_FILTERS: PaymentStatus[] = ['ALL', 'COMPLETED', 'PENDING', 'FAILED', 'REFUNDED'];
  const METHOD_FILTERS: PaymentMethod[] = ['ALL', 'CASH', 'CARD', 'WALLET'];
  const SERVICE_FILTERS: ServiceFilter[] = ['ALL', 'RIDE', 'DELIVERY'];

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-500 text-sm mt-1">All transactions across rides, deliveries, and wallet top-ups.</p>
        </div>
        <button
          onClick={() => { loadStats(); loadPayments(pagination.page); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Revenue"      value={fmt(stats.totalRevenue)}    sub="All time"     icon={<DollarSign className="w-4 h-4 text-white" />}    color="bg-blue-500" />
          <StatCard label="Today's Revenue"    value={fmt(stats.todayRevenue)}    sub="Today"        icon={<TrendingUp className="w-4 h-4 text-white" />}     color="bg-green-500" />
          <StatCard label="Platform Commission" value={fmt(stats.totalCommission)} sub="All time"    icon={<DollarSign className="w-4 h-4 text-white" />}    color="bg-indigo-500" />
          <StatCard label="Today Commission"   value={fmt(stats.todayCommission)} sub="Today"        icon={<TrendingUp className="w-4 h-4 text-white" />}    color="bg-purple-500" />
          <StatCard label="Pending Payments"   value={String(stats.pendingCount)} sub="Needs action" icon={<Clock className="w-4 h-4 text-white" />}         color="bg-yellow-500" />
          <StatCard label="Total Refunded"     value={fmt(stats.refundedTotal)}   sub="All time"     icon={<RefreshCw className="w-4 h-4 text-white" />}     color="bg-red-500" />
        </div>
      )}

      {/* Method breakdown pills */}
      {stats?.byMethod && (
        <div className="flex flex-wrap gap-3">
          {stats.byMethod.map(m => (
            <div key={m.method} className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
              <span className="text-gray-500">{METHOD_ICON[m.method] ?? <CreditCard className="w-3.5 h-3.5" />}</span>
              <span className="text-sm font-semibold text-gray-800">{m.method}</span>
              <span className="text-xs text-gray-400">{m.count} txns</span>
              <span className="text-xs font-bold text-gray-700">{fmt(m.total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Filters bar */}
        <div className="px-6 py-4 border-b border-gray-100 space-y-3">
          {/* Search */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or transaction ID…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter pills row */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Status */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Status:</span>
              {STATUS_FILTERS.map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    status === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>{s}</button>
              ))}
            </div>

            {/* Method */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Method:</span>
              {METHOD_FILTERS.map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    method === m ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>{m}</button>
              ))}
            </div>

            {/* Service */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Service:</span>
              {SERVICE_FILTERS.map(s => (
                <button key={s} onClick={() => setService(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    service === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>{s}</button>
              ))}
            </div>

            <div className="ml-auto text-xs text-gray-400">{pagination.total} records</div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No payments match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Customer', 'Amount', 'Commission', 'Method', 'Service', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    {/* Customer */}
                    <td className="px-4 py-4">
                      <div className="font-semibold text-gray-900">{p.user.firstName} {p.user.lastName}</div>
                      <div className="text-xs text-gray-500">{p.user.email}</div>
                      <div className="text-xs text-gray-400 font-mono">{p.user.phone}</div>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-4">
                      <div className="font-bold text-gray-900">{fmt(p.amount)}</div>
                      {p.transactionId && (
                        <div className="text-xs text-gray-400 font-mono mt-0.5 max-w-[120px] truncate" title={p.transactionId}>
                          {p.transactionId}
                        </div>
                      )}
                    </td>

                    {/* Commission — shown when CommissionLedger data is joined */}
                    <td className="px-4 py-4">
                      {p.platformFee !== undefined ? (
                        <div>
                          <div className="text-sm font-semibold text-indigo-700">{fmt(p.platformFee)}</div>
                          {p.driverEarnings !== undefined && (
                            <div className="text-xs text-gray-500 mt-0.5">Earner: {fmt(p.driverEarnings)}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Method */}
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                        {METHOD_ICON[p.method] ?? null}
                        {p.method}
                      </span>
                    </td>

                    {/* Service */}
                    <td className="px-4 py-4">
                      <ServiceBadge rideId={p.rideId} deliveryId={p.deliveryId} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <StatusBadge status={p.status} />
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadPayments(pagination.page - 1)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => loadPayments(pagination.page + 1)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentList;