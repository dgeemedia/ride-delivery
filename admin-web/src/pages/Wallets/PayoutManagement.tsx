// admin-web/src/pages/Wallets/PayoutManagement.tsx  [NEW — replaces skeleton]
import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle, XCircle, Clock, DollarSign, ArrowLeftRight,
  Building2, RefreshCw, ChevronDown, Search, Filter,
} from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

type PayoutStatus    = 'PENDING' | 'COMPLETED' | 'FAILED' | 'ALL';
type TransferStatus  = 'PENDING' | 'COMPLETED' | 'FAILED' | 'ALL';

interface PayoutUser {
  id: string; firstName: string; lastName: string; email: string; phone: string; role: string;
}

interface Payout {
  id: string; userId: string; user: PayoutUser;
  amount: number; accountNumber: string; bankCode: string; accountName: string;
  status: string; reference: string; failureReason?: string;
  processedAt?: string; createdAt: string;
}

interface Transfer {
  id: string; walletId: string; type: string; amount: number;
  description: string; status: string; reference: string; createdAt: string;
  wallet: { user: PayoutUser };
}

interface WalletStats {
  totalBalance: number; totalWallets: number;
  pendingPayouts: number; pendingTransfers: number;
  todayCredits: number; todayDebits: number;
}

interface Pagination { total: number; page: number; pages: number; }

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    PENDING:   'bg-yellow-100 text-yellow-800 border-yellow-200',
    COMPLETED: 'bg-green-100  text-green-800  border-green-200',
    FAILED:    'bg-red-100    text-red-800    border-red-200',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status === 'PENDING'   && <Clock       className="w-3 h-3" />}
      {status === 'COMPLETED' && <CheckCircle className="w-3 h-3" />}
      {status === 'FAILED'    && <XCircle     className="w-3 h-3" />}
      {status}
    </span>
  );
};

const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  body: string;
  placeholder?: string;
  confirmLabel: string;
  confirmClass?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
}> = ({ open, title, body, placeholder, confirmLabel, confirmClass = 'btn-primary', onCancel, onConfirm, loading }) => {
  const [text, setText] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{body}</p>
        {placeholder && (
          <textarea
            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={placeholder}
            value={text}
            onChange={e => setText(e.target.value)}
          />
        )}
        <div className="flex gap-3 justify-end">
          <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className={`btn ${confirmClass}`}
            onClick={() => onConfirm(text)}
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner loading-xs" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Payout Row ───────────────────────────────────────────────────────────────

const PayoutRow: React.FC<{
  payout: Payout;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}> = ({ payout, onApprove, onReject }) => (
  <tr className="hover:bg-gray-50 transition-colors">
    <td className="px-4 py-4">
      <div className="font-semibold text-gray-900 text-sm">
        {payout.user.firstName} {payout.user.lastName}
      </div>
      <div className="text-xs text-gray-500">{payout.user.email}</div>
      <div className="text-xs text-gray-400 font-mono">{payout.user.phone}</div>
    </td>
    <td className="px-4 py-4">
      <div className="font-bold text-gray-900">₦{payout.amount.toLocaleString('en-NG')}</div>
      <div className="text-xs text-gray-500 font-mono mt-0.5">{payout.reference}</div>
    </td>
    <td className="px-4 py-4">
      <div className="text-sm font-semibold text-gray-800">{payout.accountName}</div>
      <div className="text-xs text-gray-500 font-mono">{payout.accountNumber}</div>
      <div className="text-xs text-gray-400">Code: {payout.bankCode}</div>
    </td>
    <td className="px-4 py-4">
      <StatusBadge status={payout.status} />
      {payout.failureReason && (
        <div className="text-xs text-red-600 mt-1 max-w-[140px] truncate" title={payout.failureReason}>
          {payout.failureReason}
        </div>
      )}
    </td>
    <td className="px-4 py-4 text-xs text-gray-500">
      {new Date(payout.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
    </td>
    <td className="px-4 py-4">
      {payout.status === 'PENDING' ? (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(payout.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Approve
          </button>
          <button
            onClick={() => onReject(payout.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      ) : (
        <span className="text-xs text-gray-400">
          {payout.processedAt ? new Date(payout.processedAt).toLocaleDateString('en-NG') : '—'}
        </span>
      )}
    </td>
  </tr>
);

// ─── Transfer Row ─────────────────────────────────────────────────────────────

const TransferRow: React.FC<{
  transfer: Transfer;
  onApprove: (ref: string) => void;
  onReject: (ref: string) => void;
}> = ({ transfer, onApprove, onReject }) => {
  // Extract recipient info from description
  const phoneMatch = transfer.description.match(/\((\d{10,11})\)/);
  const recipientPhone = phoneMatch ? phoneMatch[1] : '—';

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-4">
        <div className="font-semibold text-gray-900 text-sm">
          {transfer.wallet.user.firstName} {transfer.wallet.user.lastName}
        </div>
        <div className="text-xs text-gray-500">{transfer.wallet.user.email}</div>
        <div className="text-xs text-gray-400 font-mono">{transfer.wallet.user.phone}</div>
      </td>
      <td className="px-4 py-4">
        <div className="text-sm font-bold text-gray-800">→ {recipientPhone}</div>
        <div className="text-xs text-gray-500 mt-1 max-w-[200px]" title={transfer.description}>
          {transfer.description.replace('[PENDING] ', '').substring(0, 60)}…
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="font-bold text-gray-900">₦{transfer.amount.toLocaleString('en-NG')}</div>
        <div className="text-xs text-gray-500 font-mono mt-0.5">{transfer.reference}</div>
      </td>
      <td className="px-4 py-4">
        <StatusBadge status={transfer.status} />
      </td>
      <td className="px-4 py-4 text-xs text-gray-500">
        {new Date(transfer.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
      </td>
      <td className="px-4 py-4">
        {transfer.status === 'PENDING' ? (
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(transfer.reference)}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => onReject(transfer.reference)}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-400">Processed</span>
        )}
      </td>
    </tr>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

type TabId = 'payouts' | 'transfers';

const PayoutManagement: React.FC = () => {
  const [tab,               setTab]              = useState<TabId>('payouts');
  const [stats,             setStats]            = useState<WalletStats | null>(null);
  const [payouts,           setPayouts]          = useState<Payout[]>([]);
  const [transfers,         setTransfers]        = useState<Transfer[]>([]);
  const [payoutPagination,  setPayoutPagination] = useState<Pagination>({ total: 0, page: 1, pages: 1 });
  const [xferPagination,    setXferPagination]   = useState<Pagination>({ total: 0, page: 1, pages: 1 });
  const [payoutStatus,      setPayoutStatus]     = useState<PayoutStatus>('PENDING');
  const [xferStatus,        setXferStatus]       = useState<TransferStatus>('PENDING');
  const [loading,           setLoading]          = useState(false);

  // Confirm modal state
  const [modal, setModal] = useState<{
    open:    boolean;
    type:    'approve_payout' | 'reject_payout' | 'approve_transfer' | 'reject_transfer';
    id:      string;
    loading: boolean;
  }>({ open: false, type: 'approve_payout', id: '', loading: false });

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/wallet/admin/stats');
      setStats(res.data.data);
    } catch { /* non-critical */ }
  }, []);

  const loadPayouts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/wallet/admin/payouts', { params: { status: payoutStatus, page, limit: 20 } });
      setPayouts(res.data.data.payouts);
      setPayoutPagination(res.data.data.pagination);
    } catch { toast.error('Failed to load payouts'); }
    finally { setLoading(false); }
  }, [payoutStatus]);

  const loadTransfers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/wallet/admin/transfers', { params: { status: xferStatus, page, limit: 20 } });
      setTransfers(res.data.data.transfers);
      setXferPagination(res.data.data.pagination);
    } catch { toast.error('Failed to load transfers'); }
    finally { setLoading(false); }
  }, [xferStatus]);

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { if (tab === 'payouts')   loadPayouts();   }, [tab, payoutStatus]);
  useEffect(() => { if (tab === 'transfers') loadTransfers(); }, [tab, xferStatus]);

  // ── Modal actions ───────────────────────────────────────────────────────────

  const openModal = (type: typeof modal.type, id: string) =>
    setModal({ open: true, type, id, loading: false });

  const closeModal = () =>
    setModal(m => ({ ...m, open: false, loading: false }));

  const confirmAction = async (noteOrReason: string) => {
    setModal(m => ({ ...m, loading: true }));
    const { type, id } = modal;

    try {
      if (type === 'approve_payout') {
        await api.put(`/wallet/admin/payouts/${id}/approve`, { note: noteOrReason });
        toast.success('Payout approved and bank transfer initiated');
        loadPayouts();
      } else if (type === 'reject_payout') {
        await api.put(`/wallet/admin/payouts/${id}/reject`, { reason: noteOrReason });
        toast.success('Payout rejected and wallet refunded');
        loadPayouts();
      } else if (type === 'approve_transfer') {
        await api.put(`/wallet/admin/transfers/${id}/approve`, { note: noteOrReason });
        toast.success('Transfer approved. Recipient credited.');
        loadTransfers();
      } else if (type === 'reject_transfer') {
        await api.put(`/wallet/admin/transfers/${id}/reject`, { reason: noteOrReason });
        toast.success('Transfer rejected and sender refunded.');
        loadTransfers();
      }
      loadStats();
      closeModal();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Action failed');
      setModal(m => ({ ...m, loading: false }));
    }
  };

  // ── Status filter tabs ──────────────────────────────────────────────────────

  const PAYOUT_STATUSES: PayoutStatus[]   = ['PENDING', 'COMPLETED', 'FAILED', 'ALL'];
  const XFER_STATUSES:   TransferStatus[] = ['PENDING', 'COMPLETED', 'FAILED', 'ALL'];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wallet Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            Review and approve withdrawal requests and peer transfers.
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
          onClick={() => { loadStats(); tab === 'payouts' ? loadPayouts() : loadTransfers(); }}
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Wallet Balance', value: `₦${stats.totalBalance.toLocaleString('en-NG')}`, icon: DollarSign,      color: 'bg-blue-500'   },
            { label: 'Total Wallets',        value: stats.totalWallets.toLocaleString(),               icon: Building2,       color: 'bg-indigo-500' },
            { label: 'Pending Payouts',      value: stats.pendingPayouts.toString(),                   icon: Clock,           color: 'bg-yellow-500' },
            { label: 'Pending Transfers',    value: stats.pendingTransfers.toString(),                 icon: ArrowLeftRight,  color: 'bg-orange-500' },
            { label: 'Today Credits',        value: `₦${stats.todayCredits.toLocaleString('en-NG')}`, icon: CheckCircle,     color: 'bg-green-500'  },
            { label: 'Today Debits',         value: `₦${stats.todayDebits.toLocaleString('en-NG')}`,  icon: XCircle,         color: 'bg-red-500'    },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className={`w-9 h-9 ${card.color} rounded-xl flex items-center justify-center mb-3`}>
                <card.icon className="w-4 h-4 text-white" />
              </div>
              <div className="text-xl font-bold text-gray-900">{card.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['payouts', 'transfers'] as TabId[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'payouts'    && <Building2     className="w-4 h-4" />}
            {t === 'transfers'  && <ArrowLeftRight className="w-4 h-4" />}
            {t === 'payouts' ? 'Bank Withdrawals' : 'Peer Transfers'}
            {t === 'payouts' && stats?.pendingPayouts   ? (
              <span className="ml-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {stats.pendingPayouts}
              </span>
            ) : null}
            {t === 'transfers' && stats?.pendingTransfers ? (
              <span className="ml-1 bg-orange-400 text-orange-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {stats.pendingTransfers}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── PAYOUTS TAB ──────────────────────────────────────────────────── */}
      {tab === 'payouts' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Status filter */}
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 font-medium mr-2">Filter:</span>
            {PAYOUT_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setPayoutStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  payoutStatus === s
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
            <div className="ml-auto text-xs text-gray-400">{payoutPagination.total} records</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent" />
            </div>
          ) : payouts.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No {payoutStatus.toLowerCase()} payouts</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['User', 'Amount', 'Bank Details', 'Status', 'Requested', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payouts.map(p => (
                    <PayoutRow
                      key={p.id}
                      payout={p}
                      onApprove={id => openModal('approve_payout', id)}
                      onReject={id  => openModal('reject_payout',  id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {payoutPagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                Page {payoutPagination.page} of {payoutPagination.pages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={payoutPagination.page <= 1}
                  onClick={() => loadPayouts(payoutPagination.page - 1)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={payoutPagination.page >= payoutPagination.pages}
                  onClick={() => loadPayouts(payoutPagination.page + 1)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TRANSFERS TAB ─────────────────────────────────────────────────── */}
      {tab === 'transfers' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 font-medium mr-2">Filter:</span>
            {XFER_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setXferStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  xferStatus === s
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
            <div className="ml-auto text-xs text-gray-400">{xferPagination.total} records</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent" />
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No {xferStatus.toLowerCase()} transfers</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Sender', 'Recipient', 'Amount', 'Status', 'Initiated', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transfers.map(t => (
                    <TransferRow
                      key={t.id}
                      transfer={t}
                      onApprove={ref => openModal('approve_transfer', ref)}
                      onReject={ref  => openModal('reject_transfer',  ref)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {xferPagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                Page {xferPagination.page} of {xferPagination.pages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={xferPagination.page <= 1}
                  onClick={() => loadTransfers(xferPagination.page - 1)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={xferPagination.page >= xferPagination.pages}
                  onClick={() => loadTransfers(xferPagination.page + 1)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm modals */}
      <ConfirmModal
        open={modal.open && modal.type === 'approve_payout'}
        title="Approve Payout"
        body="This will initiate a Paystack bank transfer to the user's account. Are you sure?"
        placeholder="Optional note for the user…"
        confirmLabel="Approve & Send"
        confirmClass="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg"
        onCancel={closeModal}
        onConfirm={confirmAction}
        loading={modal.loading}
      />
      <ConfirmModal
        open={modal.open && modal.type === 'reject_payout'}
        title="Reject Payout"
        body="The user's balance will be refunded immediately. Please provide a reason."
        placeholder="Reason for rejection…"
        confirmLabel="Reject & Refund"
        confirmClass="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg"
        onCancel={closeModal}
        onConfirm={confirmAction}
        loading={modal.loading}
      />
      <ConfirmModal
        open={modal.open && modal.type === 'approve_transfer'}
        title="Approve Transfer"
        body="The recipient will be credited immediately. The sender's balance was already debited."
        placeholder="Optional note…"
        confirmLabel="Approve Transfer"
        confirmClass="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg"
        onCancel={closeModal}
        onConfirm={confirmAction}
        loading={modal.loading}
      />
      <ConfirmModal
        open={modal.open && modal.type === 'reject_transfer'}
        title="Reject Transfer"
        body="The sender's balance will be refunded. Please provide a reason for the rejection."
        placeholder="Reason for rejection…"
        confirmLabel="Reject & Refund"
        confirmClass="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg"
        onCancel={closeModal}
        onConfirm={confirmAction}
        loading={modal.loading}
      />
    </div>
  );
};

export default PayoutManagement;