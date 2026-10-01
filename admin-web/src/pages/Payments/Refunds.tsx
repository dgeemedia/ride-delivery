// admin-web/src/pages/Payments/Refunds.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Search, DollarSign } from 'lucide-react';
import { Card } from '@/components/common';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { formatMoney, sortCurrencies } from '@/utils/money';

interface RefundUser {
  id: string; firstName: string; lastName: string; email: string; phone: string;
}

interface Refund {
  id: string;
  userId: string;
  user: RefundUser;
  amount: number;
  refundAmount: number;
  currency: string;
  method: string;
  provider?: string | null;
  transactionId?: string;
  refundedAt: string;
  createdAt: string;
}

interface Pagination { total: number; page: number; pages: number; }

const fmt = (n: number, currency?: string | null) => formatMoney(n, currency, { decimals: 2 });

const PROVIDER_LABEL: Record<string, string> = {
  paystack: 'Paystack', flutterwave: 'Flutterwave', orange: 'Orange Money',
};

interface CurrencyTotal { currency: string; total: number; }

const Refunds: React.FC = () => {
  const [refunds, setRefunds]           = useState<Refund[]>([]);
  const [totals, setTotals]             = useState<CurrencyTotal[]>([]);
  const [pagination, setPagination]     = useState<Pagination>({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading]           = useState(false);
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 25 };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get('/admin/refunds', { params });
      setRefunds(res.data.data.refunds);
      setTotals(sortCurrencies((res.data.data.totalsByCurrency ?? []).map((t: CurrencyTotal) => t.currency))
        .map(c => (res.data.data.totalsByCurrency as CurrencyTotal[]).find(t => t.currency === c)!));
      setPagination(res.data.data.pagination);
    } catch {
      toast.error('Failed to load refunds');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { load(1); }, [debouncedSearch]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Refunds</h1>
          <p className="text-gray-500 text-sm mt-1">All refunds issued to customers, across wallet and card payments.</p>
        </div>
        <button
          onClick={() => load(pagination.page)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
        {/* One "Total Refunded" card per currency — they are never added together */}
        {(totals.length ? totals : [{ currency: '', total: 0 }]).map(t => (
          <div key={t.currency || 'none'} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-9 h-9 bg-purple-500 rounded-xl flex items-center justify-center mb-3">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <div className="text-xl font-bold text-gray-900">{fmt(t.total, t.currency || undefined)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total Refunded{t.currency ? ` (${t.currency})` : ''}</div>
          </div>
        ))}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center mb-3">
            <RefreshCw className="w-4 h-4 text-white" />
          </div>
          <div className="text-xl font-bold text-gray-900">{pagination.total}</div>
          <div className="text-xs text-gray-500 mt-0.5">Refund Count</div>
        </div>
      </div>

      <Card>
        <div className="px-4 py-4 border-b border-gray-100">
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent" />
          </div>
        ) : refunds.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No refunds found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Customer', 'Original Amount', 'Refunded', 'Method', 'Refunded At', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {refunds.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-gray-900">{r.user.firstName} {r.user.lastName}</div>
                      <div className="text-xs text-gray-500">{r.user.email}</div>
                    </td>
                    <td className="px-4 py-4 text-gray-700">{fmt(r.amount, r.currency)}</td>
                    <td className="px-4 py-4 font-bold text-purple-700">{fmt(r.refundAmount, r.currency)}</td>
                    <td className="px-4 py-4 text-xs font-semibold text-gray-600">
                      {r.method}
                      {r.provider && <div className="text-[11px] font-normal text-gray-400">{PROVIDER_LABEL[r.provider] ?? r.provider}</div>}
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-500">
                      {new Date(r.refundedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-4">
                      <Link to={`/payments/${r.id}`} className="text-xs font-semibold text-blue-600 hover:underline">
                        View payment
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {pagination.page} of {pagination.pages}</span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => load(pagination.page - 1)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => load(pagination.page + 1)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Refunds;