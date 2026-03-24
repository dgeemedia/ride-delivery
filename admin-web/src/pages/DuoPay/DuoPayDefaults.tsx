// admin-web/src/pages/DuoPay/DuoPayDefaults.tsx
//
// Shows all DuoPay accounts that have OVERDUE or SUSPENDED status —
// the "problem" accounts. Admins can waive individual transactions,
// view the customer profile, or trigger the overdue check manually.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, CheckCircle, ExternalLink } from 'lucide-react';
import { Card } from '@/components/common';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface OverdueAccount {
  id:          string;
  status:      string;
  usedBalance: number;
  creditLimit: number;
  suspendedAt: string | null;
  user: {
    id:        string;
    firstName: string;
    lastName:  string;
    phone:     string;
    email:     string;
  };
  transactions: {
    id:      string;
    amount:  number;
    dueDate: string;
    status:  string;
  }[];
}

const DuoPayDefaults: React.FC = () => {
  const navigate = useNavigate();

  const [accounts,  setAccounts]  = useState<OverdueAccount[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [running,   setRunning]   = useState(false);
  const [page,      setPage]      = useState(1);

  const LIMIT = 20;

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/duopay/accounts', {
        params: { status: 'SUSPENDED', page: String(page), limit: String(LIMIT) },
      });
      setAccounts(res.data.data.accounts ?? []);
      setTotal(res.data.data.pagination?.total ?? 0);
    } catch {
      toast.error('Failed to load defaulted accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page]);

  const handleRunOverdueCheck = async () => {
    setRunning(true);
    try {
      await api.post('/admin/duopay/run-overdue-check');
      toast.success('Overdue check completed');
      fetchData();
    } catch {
      toast.error('Failed to run check');
    } finally {
      setRunning(false);
    }
  };

  const handleWaiveAll = async (accountId: string) => {
    if (!confirm('Waive all overdue transactions for this account and reactivate DuoPay?')) return;
    try {
      await api.post(`/admin/duopay/accounts/${accountId}/waive`);
      toast.success('Account cleared and reactivated');
      fetchData();
    } catch {
      toast.error('Failed to waive');
    }
  };

  const handleWaiveTx = async (accountId: string, txId: string) => {
    try {
      await api.post(`/admin/duopay/accounts/${accountId}/transactions/${txId}/waive`);
      toast.success('Transaction waived');
      fetchData();
    } catch {
      toast.error('Failed to waive transaction');
    }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">DuoPay Defaults</h1>
            <p className="text-sm text-gray-500">{total} suspended accounts with overdue repayments</p>
          </div>
        </div>

        <button
          onClick={handleRunOverdueCheck}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
          Run Overdue Check
        </button>
      </div>

      {/* Explanation card */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm text-amber-800">
          Accounts below have been automatically suspended because a repayment was missed. 
          The customer cannot use DuoPay until their balance is cleared. You can waive 
          individual transactions (write-off) or waive all and reactivate the account 
          as a goodwill gesture for long-standing customers.
        </p>
      </div>

      {/* Account list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <div className="text-center py-16 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
            <p className="font-semibold text-gray-700">No suspended accounts</p>
            <p className="text-sm mt-1">All DuoPay customers are in good standing.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {accounts.map(acc => {
            const overdueTotal = acc.transactions
              ?.filter(t => t.status === 'OVERDUE')
              .reduce((s, t) => s + t.amount, 0) ?? 0;

            return (
              <Card key={acc.id}>
                {/* Account header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 text-base">
                        {acc.user.firstName} {acc.user.lastName}
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        SUSPENDED
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{acc.user.phone} · {acc.user.email}</p>
                    {acc.suspendedAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        Suspended: {new Date(acc.suspendedAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/users/${acc.user.id}`)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                    >
                      <ExternalLink className="h-3 w-3" /> View User
                    </button>
                    <button
                      onClick={() => handleWaiveAll(acc.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <CheckCircle className="h-3 w-3" /> Waive All & Reactivate
                    </button>
                  </div>
                </div>

                {/* Balance summary */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Credit Limit',    value: `₦${acc.creditLimit.toLocaleString('en-NG')}`,  color: 'text-gray-900' },
                    { label: 'Outstanding',      value: `₦${acc.usedBalance.toLocaleString('en-NG')}`,  color: 'text-red-600'  },
                    { label: 'Overdue Amount',   value: `₦${overdueTotal.toLocaleString('en-NG')}`,     color: 'text-red-700'  },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className={`text-base font-black ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Individual transactions */}
                {acc.transactions && acc.transactions.length > 0 && (
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                          <th className="px-4 py-2 font-semibold">Amount</th>
                          <th className="px-4 py-2 font-semibold">Due Date</th>
                          <th className="px-4 py-2 font-semibold">Status</th>
                          <th className="px-4 py-2 font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {acc.transactions.map(tx => (
                          <tr key={tx.id}>
                            <td className="px-4 py-2.5 font-semibold text-gray-900">
                              ₦{tx.amount.toLocaleString('en-NG')}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500">
                              {new Date(tx.dueDate).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                tx.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                                tx.status === 'PAID'    ? 'bg-green-100 text-green-700' :
                                tx.status === 'WAIVED'  ? 'bg-gray-100 text-gray-500' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {tx.status === 'OVERDUE' && (
                                <button
                                  onClick={() => handleWaiveTx(acc.id, tx.id)}
                                  className="text-xs font-semibold text-amber-600 hover:underline"
                                >
                                  Waive
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">{total} accounts total</p>
          <div className="flex gap-2">
            <button disabled={page === 1}     onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
            <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {pages}</span>
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuoPayDefaults;