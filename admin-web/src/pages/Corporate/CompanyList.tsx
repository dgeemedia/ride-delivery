// admin-web/src/pages/Corporate/CompanyList.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, ChevronRight } from 'lucide-react';
import { Card } from '@/components/common';
import api from '@/services/api';
import toast from 'react-hot-toast';

type CompanyStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

interface Company {
  id:                string;
  name:              string;
  email:             string;
  phone:             string;
  rcNumber:          string | null;
  status:            CompanyStatus;
  billingType:       'PREPAID' | 'POSTPAID';
  onboardingFeePaid: boolean;
  commissionRate:    number;
  createdAt:         string;
  admin: {
    firstName: string;
    lastName:  string;
    email:     string;
  };
  wallet: {
    balance: number;
  } | null;
  _count: {
    employees: number;
    trips:     number;
  };
}

const STATUS_STYLES: Record<CompanyStatus, { pill: string; dot: string }> = {
  PENDING:   { pill: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  ACTIVE:    { pill: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  SUSPENDED: { pill: 'bg-red-100   text-red-700',   dot: 'bg-red-500'   },
};

const CompanyList: React.FC = () => {
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState<CompanyStatus | ''>('');
  const [loading,   setLoading]   = useState(true);

  const LIMIT = 15;

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(LIMIT) };
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await api.get('/admin/corporate/companies', { params });
      setCompanies(res.data.data.companies);
      setTotal(res.data.data.pagination.total);
    } catch {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, [page, status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCompanies();
  };

  const handleActivate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.put(`/admin/corporate/companies/${id}/activate`);
      toast.success('Company activated');
      fetchCompanies();
    } catch {
      toast.error('Failed to activate company');
    }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Corporate Accounts</h1>
            <p className="text-sm text-gray-500">{total} companies registered</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search company name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
            >
              Search
            </button>
          </form>

          <select
            value={status}
            onChange={e => { setStatus(e.target.value as CompanyStatus | ''); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No companies found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="pb-3 pr-4 font-semibold">Company</th>
                  <th className="pb-3 pr-4 font-semibold">Admin</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 pr-4 font-semibold">Billing</th>
                  <th className="pb-3 pr-4 font-semibold">Wallet</th>
                  <th className="pb-3 pr-4 font-semibold">Employees</th>
                  <th className="pb-3 pr-4 font-semibold">Trips</th>
                  <th className="pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {companies.map(c => {
                  const st = STATUS_STYLES[c.status];
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/corporate/${c.id}`)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.rcNumber ?? 'No RC'} • {c.email}</p>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {c.admin.firstName} {c.admin.lastName}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-xs font-semibold text-gray-600">{c.billingType}</span>
                      </td>
                      <td className="py-3 pr-4 font-semibold text-gray-900">
                        ₦{(c.wallet?.balance ?? 0).toLocaleString('en-NG')}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{c._count.employees}</td>
                      <td className="py-3 pr-4 text-gray-600">{c._count.trips}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {c.status === 'PENDING' && (
                            <button
                              onClick={e => handleActivate(c.id, e)}
                              className="px-3 py-1 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              Activate
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

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">{total} companies total</p>
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

export default CompanyList;