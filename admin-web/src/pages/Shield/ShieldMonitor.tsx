// admin-web/src/pages/Shield/ShieldMonitor.tsx
//
// Admin monitoring page for all SHIELD safety sessions.
// Shows live active sessions, today's stats, alert count, and a full
// paginated session list. Admins can click into any session for details.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertTriangle, CheckCircle, Zap, Eye, XCircle } from 'lucide-react';
import { Card } from '@/components/common';
import api from '@/services/api';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShieldStats {
  activeSessions:  number;
  sessionsToday:   number;
  alertsTriggered: number;
  autoTriggered:   number;
  arrivedSafe:     number;
}

interface ShieldSession {
  id:               string;
  token:            string;
  isActive:         boolean;
  autoTriggered:    boolean;
  driverAlerted:    boolean;
  arrivedSafe:      boolean;
  viewCount:        number;
  beneficiaryName:  string | null;
  beneficiaryPhone: string | null;
  createdAt:        string;
  expiresAt:        string;
  user: {
    firstName: string;
    lastName:  string;
    phone:     string;
  };
  ride?: {
    id:             string;
    status:         string;
    pickupAddress:  string;
    dropoffAddress: string;
    driver?: { firstName: string; lastName: string } | null;
  } | null;
  delivery?: {
    id:             string;
    status:         string;
    pickupAddress:  string;
    dropoffAddress: string;
    partner?: { firstName: string; lastName: string } | null;
  } | null;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  title: string;
  value: number | string;
  icon:  React.ElementType;
  color: string;
  bg:    string;
}> = ({ title, value, icon: Icon, color, bg }) => (
  <Card className="hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
      <div className={`${bg} w-12 h-12 rounded-xl flex items-center justify-center`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
    </div>
  </Card>
);

// ── Status badge ──────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
    active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
    {active ? 'Live' : 'Ended'}
  </span>
);

// ── Main ──────────────────────────────────────────────────────────────────────

const ShieldMonitor: React.FC = () => {
  const navigate = useNavigate();

  const [stats,    setStats]    = useState<ShieldStats | null>(null);
  const [sessions, setSessions] = useState<ShieldSession[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [filter,   setFilter]   = useState<'all' | 'active' | 'alerted'>('all');
  const [loading,  setLoading]  = useState(true);

  const LIMIT = 15;

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(LIMIT) };
      if (filter === 'active')  params.isActive      = 'true';
      if (filter === 'alerted') params.autoTriggered = 'true';

      const [statsRes, sessionsRes] = await Promise.all([
        api.get('/admin/shield/stats'),
        api.get('/admin/shield/sessions', { params }),
      ]);

      setStats(sessionsRes.data.data ? statsRes.data.data : null);
      setStats(statsRes.data.data);
      setSessions(sessionsRes.data.data.sessions);
      setTotal(sessionsRes.data.data.pagination.total);
    } catch {
      toast.error('Failed to load SHIELD data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, filter]);

  // Auto-refresh every 30 s for live sessions
  useEffect(() => {
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleClose = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Force-close this SHIELD session?')) return;
    try {
      await api.put(`/admin/shield/sessions/${id}/close`);
      toast.success('Session closed');
      loadData();
    } catch {
      toast.error('Could not close session');
    }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Shield className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SHIELD Monitor</h1>
            <p className="text-sm text-gray-500">Real-time safety guardian sessions</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Active Now"        value={stats.activeSessions}  icon={Shield}        color="text-green-600"  bg="bg-green-100"  />
          <StatCard title="Sessions Today"    value={stats.sessionsToday}   icon={Eye}           color="text-blue-600"   bg="bg-blue-100"   />
          <StatCard title="Alerts Triggered"  value={stats.alertsTriggered} icon={AlertTriangle} color="text-red-600"    bg="bg-red-100"    />
          <StatCard title="Auto-SHIELD (9PM)" value={stats.autoTriggered}   icon={Zap}           color="text-amber-600"  bg="bg-amber-100"  />
          <StatCard title="Arrived Safe ✅"   value={stats.arrivedSafe}     icon={CheckCircle}   color="text-green-600"  bg="bg-green-100"  />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'alerted'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              filter === f
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'alerted' ? 'Auto-SHIELD' : f}
          </button>
        ))}
      </div>

      {/* Sessions table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No SHIELD sessions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500 text-xs uppercase tracking-wider">
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 pr-4 font-semibold">Customer</th>
                  <th className="pb-3 pr-4 font-semibold">Guardian</th>
                  <th className="pb-3 pr-4 font-semibold">Type</th>
                  <th className="pb-3 pr-4 font-semibold">Driver / Partner</th>
                  <th className="pb-3 pr-4 font-semibold">Views</th>
                  <th className="pb-3 pr-4 font-semibold">Flags</th>
                  <th className="pb-3 font-semibold">Created</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.map((s) => {
                  const trip    = s.ride ?? s.delivery;
                  const contact = s.ride?.driver ?? s.delivery?.partner;
                  const type    = s.ride ? 'Ride' : 'Delivery';

                  return (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/shield/${s.id}`)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <StatusBadge active={s.isActive} />
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900">
                          {s.user.firstName} {s.user.lastName}
                        </p>
                        <p className="text-xs text-gray-400">{s.user.phone}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900">{s.beneficiaryName ?? '—'}</p>
                        <p className="text-xs text-gray-400">{s.beneficiaryPhone ?? ''}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          s.ride ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {type}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {contact ? `${contact.firstName} ${contact.lastName}` : '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-500">{s.viewCount}</td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-1">
                          {s.autoTriggered && (
                            <span title="Auto-triggered (night)" className="text-amber-500">
                              <Zap className="h-3.5 w-3.5" />
                            </span>
                          )}
                          {s.driverAlerted && (
                            <span title="Guardian sent alert" className="text-red-500">
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </span>
                          )}
                          {s.arrivedSafe && (
                            <span title="Customer confirmed safe" className="text-green-500">
                              <CheckCircle className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(s.createdAt).toLocaleString('en-NG', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3">
                        {s.isActive && (
                          <button
                            onClick={(e) => handleClose(s.id, e)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Force close session"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">{total} sessions total</p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {pages}</span>
              <button
                disabled={page === pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
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

export default ShieldMonitor;