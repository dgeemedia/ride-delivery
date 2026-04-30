// admin-web/src/pages/Drivers/DriverList.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { driversAPI } from '@/services/api/drivers';
import { Driver } from '@/types';
import {
  Card, Input, Select, Button,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Badge, Pagination, Spinner,
} from '@/components/common';
import { formatDate } from '@/utils/helpers';
import { VEHICLE_TYPES } from '@/utils/constants';
import { exportToExcel, exportToCSV, DRIVER_EXPORT_COLUMNS } from '@/utils/exportToExcel';
import toast from 'react-hot-toast';

const ExportDropdown: React.FC<{
  onExcel:  () => void;
  onCSV:    () => void;
  loading:  boolean;
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
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Excel (.xlsx)
          </button>
          <button
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
            onClick={() => { setOpen(false); onCSV(); }}
          >
            <FileText className="h-4 w-4 text-blue-500" />
            CSV (.csv)
          </button>
        </div>
      )}
    </div>
  );
};

const DriverList: React.FC = () => {
  const navigate = useNavigate();
  const [drivers,        setDrivers]        = useState<Driver[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [exporting,      setExporting]      = useState(false);
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [vehicleFilter,  setVehicleFilter]  = useState('');
  const [currentPage,    setCurrentPage]    = useState(1);
  const [totalPages,     setTotalPages]     = useState(1);
  const [totalCount,     setTotalCount]     = useState(0);

  useEffect(() => { loadDrivers(); }, [currentPage, statusFilter, vehicleFilter]);

  const buildFilterParams = () => {
    const base: Record<string, any> = {
      page:        currentPage,
      limit:       20,
      search:      search        || undefined,
      vehicleType: vehicleFilter || undefined,
    };
    if (statusFilter === 'approved:true')  { base.isApproved = 'true';  base.isRejected = 'false'; }
    if (statusFilter === 'pending')        { base.isApproved = 'false'; base.isRejected = 'false'; }
    if (statusFilter === 'rejected:true')  { base.isRejected = 'true'; }
    return base;
  };

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const res = await driversAPI.getDrivers(buildFilterParams());
      setDrivers(res.data.drivers || []);
      setTotalPages(res.data.pagination.pages);
      setTotalCount(res.data.pagination.total);
    } catch {
      toast.error('Failed to load drivers');
    } finally { setLoading(false); }
  };

  const fetchAll = async () => {
    const res = await driversAPI.getDrivers({
      page:        1,
      limit:       5000,
      search:      search        || undefined,
      isApproved:  statusFilter  || undefined,
      vehicleType: vehicleFilter || undefined,
    });
    return res.data.drivers ?? [];
  };

  const buildFilename = () => {
    const date   = new Date().toISOString().split('T')[0];
    const suffix = statusFilter === 'true'  ? 'approved'
                 : statusFilter === 'false' ? 'pending' : 'all';
    return `diakite-drivers-${suffix}-${date}`;
  };

  const handleExcel = async () => {
    setExporting(true);
    try {
      const all = await fetchAll();
      if (!all.length) { toast.error('No drivers to export'); return; }
      exportToExcel(all, DRIVER_EXPORT_COLUMNS, buildFilename(), 'Drivers');
      toast.success(`Exported ${all.length} driver${all.length !== 1 ? 's' : ''} as Excel`);
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const handleCSV = async () => {
    setExporting(true);
    try {
      const all = await fetchAll();
      if (!all.length) { toast.error('No drivers to export'); return; }
      exportToCSV(all, DRIVER_EXPORT_COLUMNS, buildFilename());
      toast.success(`Exported ${all.length} driver${all.length !== 1 ? 's' : ''} as CSV`);
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-gray-600 mt-1">
            {totalCount > 0 ? `${totalCount.toLocaleString()} total` : 'Manage all driver accounts'}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportDropdown onExcel={handleExcel} onCSV={handleCSV} loading={exporting} />
          <Button onClick={() => navigate('/drivers/pending')}>View Pending Approvals</Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search by name, email, or license..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && (setCurrentPage(1), loadDrivers())}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '',                label: 'All Status'  },
              { value: 'approved:true',   label: 'Approved'    },
              { value: 'pending',         label: 'Pending'     },
              { value: 'rejected:true',   label: 'Rejected'    },
            ]}
          />
          <Select
            value={vehicleFilter}
            onChange={e => { setVehicleFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'All Vehicles' },
              ...Object.entries(VEHICLE_TYPES).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => { setCurrentPage(1); loadDrivers(); }}>
            <Search className="h-4 w-4 mr-2" />Search
          </Button>
        </div>
      </Card>

      <Card padding={false}>
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size="lg" showLabel /></div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Total Rides</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* FIX: use native <tr><td> for colSpan */}
                {drivers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-400 py-12 text-sm">
                      No drivers found.
                    </td>
                  </tr>
                ) : drivers.map(driver => (
                  <TableRow key={driver.id} onClick={() => navigate(`/drivers/${driver.id}`)}>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                          {driver.user.firstName[0]}{driver.user.lastName[0]}
                        </div>
                        <div className="ml-3">
                          <div className="font-medium">{driver.user.firstName} {driver.user.lastName}</div>
                          <div className="text-sm text-gray-500">{driver.user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{driver.vehicleMake} {driver.vehicleModel}</div>
                      <div className="text-sm text-gray-500">{driver.vehicleType} • {driver.vehiclePlate}</div>
                    </TableCell>
                    <TableCell className="text-sm">{driver.licenseNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-warning-500 fill-warning-500" />
                        <span className="font-medium">{(driver.rating ?? 0).toFixed(1)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{driver.totalRides}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {driver.isRejected ? (
                          <Badge variant="error">Rejected</Badge>
                        ) : driver.isApproved ? (
                          <Badge variant="success">Approved</Badge>
                        ) : (
                          <Badge variant="warning">Pending</Badge>
                        )}
                        {driver.isOnline && <Badge variant="success">Online</Badge>}
                        {/* Document status chip */}
                        {!driver.isApproved && !driver.isRejected && (
                          <Badge variant={
                            driver.documentStatus === 'COMPLETE' ? 'success'
                            : driver.documentStatus === 'PARTIAL' ? 'warning'
                            : 'error'
                          }>
                            {driver.documentStatus === 'COMPLETE' ? '3/3 docs'
                            : driver.documentStatus === 'PARTIAL' ? 'Partial docs'
                            : 'No docs'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(driver.createdAt)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm" variant="outline"
                        onClick={e => { e.stopPropagation(); navigate(`/drivers/${driver.id}`); }}
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

export default DriverList;