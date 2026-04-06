// admin-web/src/pages/Corporate/CompanyDetails.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, Users, Car, Wallet,
  CheckCircle, XCircle, RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/common';
import api from '@/services/api';
import toast from 'react-hot-toast';

const CompanyDetails: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [company,   setCompany]   = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [trips,     setTrips]     = useState<any[]>([]);
  const [tab,       setTab]       = useState<'overview' | 'employees' | 'trips'>('overview');
  const [loading,   setLoading]   = useState(true);
  const [acting,    setActing]    = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/admin/corporate/companies/${id}`),
      api.get(`/admin/corporate/companies/${id}/employees`),
      api.get(`/admin/corporate/companies/${id}/trips`),
    ])
      .then(([cRes, eRes, tRes]) => {
        setCompany(cRes.data.data.company);
        setEmployees(eRes.data.data.employees ?? []);
        setTrips(tRes.data.data.trips ?? []);
      })
      .catch(() => toast.error('Failed to load company'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (action: 'activate' | 'suspend') => {
    setActing(true);
    try {
      await api.put(`/admin/corporate/companies/${id}/${action}`);
      toast.success(`Company ${action}d`);
      const res = await api.get(`/admin/corporate/companies/${id}`);
      setCompany(res.data.data.company);
    } catch {
      toast.error('Action failed');
    } finally {
      setActing(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (!company) return (
    <div className="text-center py-20 text-gray-500">Company not found.</div>
  );

  const STATUS_COLOR: Record<string, string> = {
    ACTIVE:    'text-green-600',
    PENDING:   'text-amber-600',
    SUSPENDED: 'text-red-600',
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/corporate')} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
              <p className={`text-sm font-semibold ${STATUS_COLOR[company.status] ?? 'text-gray-500'}`}>
                {company.status}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {company.status === 'PENDING' && (
            <button
              onClick={() => handleStatusChange('activate')}
              disabled={acting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" /> Activate
            </button>
          )}
          {company.status === 'ACTIVE' && (
            <button
              onClick={() => handleStatusChange('suspend')}
              disabled={acting}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-sm font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" /> Suspend
            </button>
          )}
          {company.status === 'SUSPENDED' && (
            <button
              onClick={() => handleStatusChange('activate')}
              disabled={acting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" /> Reactivate
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['overview', 'employees', 'trips'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company info */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Company Info</h3>
            <dl className="space-y-3">
              {[
                ['Name',           company.name],
                ['RC Number',      company.rcNumber ?? '—'],
                ['Email',          company.email],
                ['Phone',          company.phone],
                ['Address',        company.address ?? '—'],
                ['Billing',        company.billingType],
                ['Commission',     `${(company.commissionRate * 100).toFixed(0)}%`],
                ['Onboarding fee', company.onboardingFeePaid ? '✅ Paid' : '❌ Unpaid'],
                ['Registered',     new Date(company.createdAt).toLocaleDateString('en-NG')],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-semibold text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Admin + wallet */}
          <div className="space-y-6">
            <Card>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Admin User</h3>
              <p className="font-semibold text-gray-900">{company.admin?.firstName} {company.admin?.lastName}</p>
              <p className="text-sm text-gray-500">{company.admin?.email}</p>
              <Link
                to={`/users/${company.adminUserId}`}
                className="text-xs text-blue-600 hover:underline mt-2 inline-block"
              >
                View user profile →
              </Link>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                <Wallet className="h-4 w-4 inline mr-2 text-blue-500" />
                Corporate Wallet
              </h3>
              <p className="text-3xl font-black text-blue-600">
                ₦{(company.wallet?.balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Low-balance alert below ₦{(company.wallet?.lowBalanceThreshold ?? 50000).toLocaleString('en-NG')}
              </p>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Employees', value: company._count?.employees ?? 0, icon: Users },
                  { label: 'Trips',     value: company._count?.trips     ?? 0, icon: Car  },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <Icon className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                    <p className="text-xl font-black text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Employees ── */}
      {tab === 'employees' && (
        <Card>
          {employees.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No employees yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="pb-3 pr-4 font-semibold">Employee</th>
                    <th className="pb-3 pr-4 font-semibold">Department</th>
                    <th className="pb-3 pr-4 font-semibold">Status</th>
                    <th className="pb-3 pr-4 font-semibold">Monthly Limit</th>
                    <th className="pb-3 font-semibold">Spent This Month</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.map(emp => (
                    <tr key={emp.id}>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-gray-900">{emp.user?.firstName} {emp.user?.lastName}</p>
                        <p className="text-xs text-gray-400">{emp.user?.phone}</p>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{emp.department ?? '—'}</td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          emp.inviteStatus === 'ACTIVE'  ? 'bg-green-100 text-green-700' :
                          emp.inviteStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {emp.inviteStatus}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-900 font-semibold">
                        ₦{emp.monthlyLimit.toLocaleString('en-NG')}
                      </td>
                      <td className="py-3">
                        <div>
                          <span className="font-semibold text-gray-900">
                            ₦{emp.currentMonthSpend.toLocaleString('en-NG')}
                          </span>
                          <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min((emp.currentMonthSpend / emp.monthlyLimit) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Trips ── */}
      {tab === 'trips' && (
        <Card>
          {trips.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Car className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No trips yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="pb-3 pr-4 font-semibold">Employee</th>
                    <th className="pb-3 pr-4 font-semibold">Route</th>
                    <th className="pb-3 pr-4 font-semibold">Purpose</th>
                    <th className="pb-3 pr-4 font-semibold">Fare</th>
                    <th className="pb-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {trips.map(trip => (
                    <tr key={trip.id}>
                      <td className="py-3 pr-4 font-semibold text-gray-900">
                        {trip.employee?.user?.firstName} {trip.employee?.user?.lastName}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 max-w-xs">
                        <p className="truncate text-xs">{trip.ride?.pickupAddress ?? trip.delivery?.pickupAddress ?? '—'}</p>
                        <p className="truncate text-xs text-gray-400">{trip.ride?.dropoffAddress ?? trip.delivery?.dropoffAddress ?? ''}</p>
                      </td>
                      <td className="py-3 pr-4 text-gray-500 text-xs">{trip.purpose ?? '—'}</td>
                      <td className="py-3 pr-4 font-semibold text-gray-900">₦{trip.fare.toLocaleString('en-NG')}</td>
                      <td className="py-3 text-gray-400 text-xs">
                        {new Date(trip.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default CompanyDetails;