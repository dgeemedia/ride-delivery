// admin-web/src/pages/DuoPay/DuoPayMonitor.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, AlertTriangle, TrendingUp, Users, ChevronRight, XCircle } from 'lucide-react';
import { Card } from '@/components/common';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface DuoPayStats {
  totalAccounts:   number;
  activeAccounts:  number;
  suspendedAccounts: number;
  defaultedAccounts: number;
  totalOutstanding: number;
  totalOverdue:     number;
}

interface DuoPayAccount {
  id:                string;
  status:            'INACTIVE' | 'ACTIVE' | 'SUSPENDED' | 'DEFAULTED';
  creditLimit:       number;
  usedBalance:       number;
  consecutiveOnTime: number;
  nextRepaymentDate: string | null;
  cardLast4:         string | null;
  cardBrand:         string | null;
  activatedAt:       string | null;
  user: {
    id:        string;
    firstName: string;
    lastName:  string;
    phone:     string;
    email:     string;
  };
  _count: { transactions: number };
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700',
  INACTIVE:  'bg-gray-100  text-gray-500',
  SUSPENDED: 'bg-amber-100 text-amber-700',
  DEFAULTED: 'bg-red-100   text-red-700',
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ElementType; color: string; bg: string }> =
  ({ label, value, icon: Icon, color, bg }) => (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-black text-gray-900">{value}</p>
        </div>
        <div className={`${bg} w-11 h-11 rounded-xl flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </Card>
  );

const DuoPayMonitor: React.FC = () => {
  const navigate = useNavigate();

  const [stats,    setStats]    = useState<DuoPayStats | null>(null);
  const [accounts, setAccounts] = useState<DuoPayAccount[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [status,   setStatus]   = useState('');
  const [loading,  setLoading]  = useState(true);

  const LIMIT = 15;

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(LIMIT) };
      if (status) params.status = status;

      const [statsRes, listRes] = await Promise.all([
        api.get('/admin/duopay/stats'),
        api.get('/admin/duopay/accounts', { params }),
      ]);

      setStats(statsRes.data.data);
      setAccounts(listRes.data.data.accounts);
      setTotal(listRes.data.data.pagination.total);
    } catch {
      toast.error('Failed to load DuoPay data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, status]);

  const handleWaive = async (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Waive all overdue transactions for this account?')) return;
    try {
      await api.post(`/admin/duopay/accounts/${accountId}/waive`);
      toast.success('Overdue transactions waived');
      fetchData();
    } catch {
      toast.error('Failed to waive');
    }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Zap className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">DuoPay Monitor</h1>
            <p className="text-sm text-gray-500">Ride now, pay later credit accounts</p>
          </div>
        </div>
        <button onClick={fetchData} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Accounts"    value={stats.totalAccounts}                                               icon={Users}        color="text-blue-600"  bg="bg-blue-100"  />
          <StatCard label="Active"            value={stats.activeAccounts}                                              icon={Zap}          color="text-green-600" bg="bg-green-100" />
          <StatCard label="Suspended"         value={stats.suspendedAccounts}                                           icon={AlertTriangle} color="text-amber-600" bg="bg-amber-100" />
          <StatCard label="Total Outstanding" value={`₦${(stats.totalOutstanding ?? 0).toLocaleString('en-NG')}`}      icon={TrendingUp}   color="text-red-600"   bg="bg-red-100"   />
        </div>
      )}

      {/* Overdue alert */}
      {stats && stats.totalOverdue > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-red-700">
            ₦{stats.totalOverdue.toLocaleString('en-NG')} in overdue repayments across suspended accounts.
          </p>
        </div>
      )}

      {/* Filter */}
      <Card>
        <div className="flex gap-2">
          {['', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'DEFAULTED'].map(s => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                status === s
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </Card>

      {/* Accounts table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No accounts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="pb-3 pr-4 font-semibold">Customer</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 pr-4 font-semibold">Credit</th>
                  <th className="pb-3 pr-4 font-semibold">Used</th>
                  <th className="pb-3 pr-4 font-semibold">Card</th>
                  <th className="pb-3 pr-4 font-semibold">On-time streak</th>
                  <th className="pb-3 pr-4 font-semibold">Next repayment</th>
                  <th className="pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {accounts.map(acc => {
                  const pct = acc.creditLimit > 0 ? (acc.usedBalance / acc.creditLimit) * 100 : 0;
                  return (
                    <tr
                      key={acc.id}
                      onClick={() => navigate(`/users/${acc.user.id}`)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-gray-900">{acc.user.firstName} {acc.user.lastName}</p>
                        <p className="text-xs text-gray-400">{acc.user.phone}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[acc.status]}`}>
                          {acc.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-semibold text-gray-900">
                        ₦{acc.creditLimit.toLocaleString('en-NG')}
                      </td>
                      <td className="py-3 pr-4">
                        <div>
                          <span className={`text-sm font-semibold ${pct > 80 ? 'text-red-600' : 'text-gray-900'}`}>
                            ₦{acc.usedBalance.toLocaleString('en-NG')}
                          </span>
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-500 text-xs">
                        {acc.cardBrand ?? '—'} {acc.cardLast4 ? `••••${acc.cardLast4}` : ''}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm font-semibold text-green-600">
                          {acc.consecutiveOnTime} 🔥
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-500 text-xs">
                        {acc.nextRepaymentDate
                          ? new Date(acc.nextRepaymentDate).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })
                          : '—'}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {acc.status === 'SUSPENDED' && (
                            <button
                              onClick={e => handleWaive(acc.id, e)}
                              className="px-2 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100"
                            >
                              Waive
                            </button>
                          )}
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">{total} accounts total</p>
            <div className="flex gap-2">
              <button disabled={page === 1}     onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {pages}</span>
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DuoPayMonitor;