// admin-web/src/pages/Payments/PaymentDetails.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, CreditCard, Wallet, Banknote, CheckCircle, XCircle,
  Clock, RefreshCw, Car, Package,
} from 'lucide-react';
import { Card } from '@/components/common';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface PaymentUser {
  id: string; firstName: string; lastName: string; email: string; phone: string;
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
  platformFee?: number;
  driverEarnings?: number;
  refundAmount?: number;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const fmt = (n: number) => `₦${(n ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  PENDING:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  FAILED:    'bg-red-100 text-red-800 border-red-200',
  REFUNDED:  'bg-purple-100 text-purple-800 border-purple-200',
};

const METHOD_ICON: Record<string, React.ReactNode> = {
  CASH:   <Banknote className="w-4 h-4" />,
  CARD:   <CreditCard className="w-4 h-4" />,
  WALLET: <Wallet className="w-4 h-4" />,
};

const PaymentDetails: React.FC = () => {
  const { id } = useParams();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState(false);
  const [reason, setReason] = useState('');
  const [showRefundBox, setShowRefundBox] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/payments/${id}`);
      setPayment(res.data.data.payment);
    } catch {
      toast.error('Failed to load payment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const issueRefund = async () => {
    if (!payment) return;
    setRefunding(true);
    try {
      await api.post(`/admin/payments/${payment.id}/refund`, { reason: reason || undefined });
      toast.success('Refund issued successfully');
      setShowRefundBox(false);
      setReason('');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Refund failed');
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="space-y-6 p-6">
        <Link to="/payments" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Back to payments
        </Link>
        <Card><p className="text-center py-12 text-gray-400">Payment not found.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <Link to="/payments" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Back to payments
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payment Details</h1>
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[payment.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
          {payment.status === 'COMPLETED' && <CheckCircle className="w-3.5 h-3.5" />}
          {payment.status === 'PENDING'   && <Clock       className="w-3.5 h-3.5" />}
          {payment.status === 'FAILED'    && <XCircle     className="w-3.5 h-3.5" />}
          {payment.status === 'REFUNDED'  && <RefreshCw   className="w-3.5 h-3.5" />}
          {payment.status}
        </span>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-6 p-2">
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Amount</div>
            <div className="text-2xl font-bold text-gray-900">{fmt(payment.amount)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Method</div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              {METHOD_ICON[payment.method]} {payment.method}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Service</div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              {payment.rideId && <><Car className="w-3.5 h-3.5" /> Ride</>}
              {payment.deliveryId && <><Package className="w-3.5 h-3.5" /> Delivery</>}
              {!payment.rideId && !payment.deliveryId && '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Transaction ID</div>
            <div className="text-sm font-mono text-gray-700">{payment.transactionId || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Platform Fee</div>
            <div className="text-sm font-semibold text-indigo-700">
              {payment.platformFee !== undefined ? fmt(payment.platformFee) : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Earner Amount</div>
            <div className="text-sm font-semibold text-gray-700">
              {payment.driverEarnings !== undefined ? fmt(payment.driverEarnings) : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Created</div>
            <div className="text-sm text-gray-600">
              {new Date(payment.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
          {payment.refundedAt && (
            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Refunded</div>
              <div className="text-sm text-gray-600">
                {fmt(payment.refundAmount ?? 0)} on {new Date(payment.refundedAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-2">
          <div className="text-xs text-gray-400 font-semibold uppercase mb-2">Customer</div>
          <div className="font-semibold text-gray-900">{payment.user.firstName} {payment.user.lastName}</div>
          <div className="text-sm text-gray-500">{payment.user.email}</div>
          <div className="text-sm text-gray-400 font-mono">{payment.user.phone}</div>
        </div>
      </Card>

      {payment.status === 'COMPLETED' && payment.method !== 'CASH' && (
        <Card>
          <div className="p-2">
            {!showRefundBox ? (
              <button
                onClick={() => setShowRefundBox(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold rounded-xl transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Issue Refund
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  This will refund <strong>{fmt(payment.amount)}</strong> to the customer
                  {payment.method === 'WALLET' ? ' wallet' : ' original payment method'}.
                </p>
                <textarea
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Reason for refund (optional)…"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowRefundBox(false); setReason(''); }}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
                    disabled={refunding}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={issueRefund}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                    disabled={refunding}
                  >
                    {refunding ? 'Processing…' : 'Confirm Refund'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default PaymentDetails;