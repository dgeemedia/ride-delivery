// admin-web/src/pages/Partners/PartnerList.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { partnersAPI } from '@/services/api/partners';
import { DeliveryPartner } from '@/types';
import {
  Card, Input, Select, Button,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Badge, Pagination, Spinner,
} from '@/components/common';
import { formatDate } from '@/utils/helpers';
import { VEHICLE_TYPES } from '@/utils/constants';
import { exportToExcel, exportToCSV, PARTNER_EXPORT_COLUMNS } from '@/utils/exportToExcel';
import toast from 'react-hot-toast';

// ─── Reusable export dropdown (same as DriverList) ────────────────────────────
const ExportDropdown: React.FC<{
  onExcel: () => void;
  onCSV: () => void;
  loading: boolean;
}> = ({ onExcel, onCSV, loading }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" loading={loading} onClick={() => setOpen(o => !o)}>
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className={`h-3.5 w-3.5 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
          <button
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => { setOpen(false); onExcel(); }}
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />Excel (.xlsx)
          </button>
          <button
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
            onClick={() => { setOpen(false); onCSV(); }}
          >
            <FileText className="h-4 w-4 text-blue-500" />CSV (.csv)
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const PartnerList: React.FC = () => {
  const navigate = useNavigate();
  const [partners, setPartners]           = useState<DeliveryPartner[]>([]);
  const [loading, setLoading]             = useState(true);
  const [exporting, setExporting]         = useState(false);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [currentPage, setCurrentPage]     = useState(1);
  const [totalPages, setTotalPages]       = useState(1);
  const [totalCount, setTotalCount]       = useState(0);

  useEffect(() => { loadPartners(); }, [currentPage, statusFilter, vehicleFilter]);

  const loadPartners = async () => {
    setLoading(true);
    try {
      const res = await partnersAPI.getPartners({
        page: currentPage, limit: 20,
        search: search || undefined,
        isApproved: statusFilter || undefined,
        vehicleType: vehicleFilter || undefined,
      });
      setPartners(res.data.partners || []);
      setTotalPages(res.data.pagination.pages);
      setTotalCount(res.data.pagination.total);
    } catch {
      toast.error('Failed to load delivery partners');
    } finally {
      setLoading(false);
    }
  };

  const fetchAll = async () => {
    const res = await partnersAPI.getPartners({
      page: 1, limit: 5000,
      search: search || undefined,
      isApproved: statusFilter || undefined,
      vehicleType: vehicleFilter || undefined,
    });
    return res.data.partners ?? [];
  };

  const buildFilename = () => {
    const date   = new Date().toISOString().split('T')[0];
    const suffix = statusFilter === 'true' ? 'approved'
                 : statusFilter === 'false' ? 'pending' : 'all';
    return `diakite-partners-${suffix}-${date}`;
  };

  const handleExcel = async () => {
    setExporting(true);
    try {
      const all = await fetchAll();
      if (!all.length) { toast.error('No partners to export'); return; }
      exportToExcel(all, PARTNER_EXPORT_COLUMNS, buildFilename(), 'Delivery Partners');
      toast.success(`Exported ${all.length} partner${all.length !== 1 ? 's' : ''} as Excel`);
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const handleCSV = async () => {
    setExporting(true);
    try {
      const all = await fetchAll();
      if (!all.length) { toast.error('No partners to export'); return; }
      exportToCSV(all, PARTNER_EXPORT_COLUMNS, buildFilename());
      toast.success(`Exported ${all.length} partner${all.length !== 1 ? 's' : ''} as CSV`);
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Partners</h1>
          <p className="text-gray-600 mt-1">
            {totalCount > 0 ? `${totalCount.toLocaleString()} total` : 'Manage all delivery partner accounts'}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportDropdown onExcel={handleExcel} onCSV={handleCSV} loading={exporting} />
          <Button onClick={() => navigate('/partners/pending')}>View Pending Approvals</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && (setCurrentPage(1), loadPartners())}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'All Status' },
              { value: 'true', label: 'Approved' },
              { value: 'false', label: 'Pending' },
            ]}
          />
          <Select
            value={vehicleFilter}
            onChange={e => { setVehicleFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'All Vehicles' },
              ...Object.entries(VEHICLE_TYPES).map(([value, label]) => ({ value, label: label as string })),
            ]}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => { setCurrentPage(1); loadPartners(); }}>
            <Search className="h-4 w-4 mr-2" />Search
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size="lg" showLabel /></div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Deliveries</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-center text-gray-400 py-12" colSpan={7}>
                      No delivery partners found.
                    </TableCell>
                  </TableRow>
                ) : partners.map(partner => (
                  <TableRow key={partner.id} onClick={() => navigate(`/partners/${partner.id}`)}>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-warning-500 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                          {partner.user.firstName[0]}{partner.user.lastName[0]}
                        </div>
                        <div className="ml-3">
                          <div className="font-medium">{partner.user.firstName} {partner.user.lastName}</div>
                          <div className="text-sm text-gray-500">{partner.user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{partner.vehicleType}</div>
                      {partner.vehiclePlate && <div className="text-sm text-gray-500">{partner.vehiclePlate}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-warning-500 fill-warning-500" />
                        <span className="font-medium">{(partner.rating ?? 0).toFixed(1)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{partner.totalDeliveries}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={partner.isApproved ? 'success' : 'warning'}>
                          {partner.isApproved ? 'Approved' : 'Pending'}
                        </Badge>
                        {partner.isOnline && <Badge variant="success">Online</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(partner.createdAt)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm" variant="outline"
                        onClick={e => { e.stopPropagation(); navigate(`/partners/${partner.id}`); }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        )}
      </Card>
    </div>
  );
};

export default PartnerList;