// admin-web/src/pages/Deliveries/DeliveryList.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, X } from 'lucide-react';
import { deliveriesAPI } from '@/services/api/deliveries';
import { Delivery } from '@/types';
import {
  Card, Input, Select, Button,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Badge, Pagination, Spinner,
} from '@/components/common';
import { formatDateTime } from '@/utils/helpers';
import { DELIVERY_STATUSES } from '@/utils/constants';
import toast from 'react-hot-toast';

const statusBadgeVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
    DELIVERED:  'success',
    CANCELLED:  'error',
    IN_TRANSIT: 'info',
    PICKED_UP:  'info',
    ASSIGNED:   'info',
    PENDING:    'warning',
  };
  return map[status] ?? 'default';
};

const DeliveryList: React.FC = () => {
  const navigate = useNavigate();
  const [deliveries,   setDeliveries]   = useState<Delivery[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [currentPage,  setCurrentPage]  = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalCount,   setTotalCount]   = useState(0);

  useEffect(() => { load(); }, [currentPage, statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await deliveriesAPI.getDeliveries({
        page:   currentPage,
        limit:  20,
        status: statusFilter || undefined,
        // API type does not include a search param — only page/limit/status/partnerId/customerId
        // dateFrom/dateTo are also not in the API type, so we omit them server-side
        // and filter client-side below
      });
      const all: Delivery[] = res.data.deliveries || [];

      // Client-side text filter
      const q = search.trim().toLowerCase();
      let filtered = q ? all.filter(d =>
        `${d.customer?.firstName} ${d.customer?.lastName} ${d.customer?.email} ${d.partner?.firstName} ${d.partner?.lastName} ${d.partner?.email}`
          .toLowerCase().includes(q)
      ) : all;

      // Client-side date filter
      if (dateFrom) {
        const from = new Date(dateFrom).getTime();
        filtered = filtered.filter(d => {
          const t = new Date((d as any).requestedAt ?? (d as any).createdAt).getTime();
          return t >= from;
        });
      }
      if (dateTo) {
        // Include the full "to" day by advancing to midnight of the next day
        const to = new Date(dateTo).getTime() + 86_400_000;
        filtered = filtered.filter(d => {
          const t = new Date((d as any).requestedAt ?? (d as any).createdAt).getTime();
          return t < to;
        });
      }

      setDeliveries(filtered);
      setTotalPages(res.data.pagination.pages);
      setTotalCount(res.data.pagination.total);
    } catch {
      toast.error('Failed to load deliveries');
    } finally { setLoading(false); }
  };

  const handleSearch = () => { setCurrentPage(1); load(); };

  const clearDates = () => {
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
          <p className="text-gray-500 text-sm mt-1">{totalCount.toLocaleString()} total</p>
        </div>
        <Button onClick={() => navigate('/deliveries/live')}>
          <MapPin className="h-4 w-4" />Live Map
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search by customer or partner name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyPress={e => { if (e.key === 'Enter') handleSearch(); }}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'All Statuses' },
              ...Object.entries(DELIVERY_STATUSES).map(([value, label]) => ({ value, label: label as string })),
            ]}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 text-gray-700 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 text-gray-700 bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button className="flex-1" onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />Search
            </Button>
            {hasDateFilter && (
              <Button variant="ghost" onClick={clearDates} title="Clear dates">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {hasDateFilter && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Filtering:</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full">
              {dateFrom && dateTo
                ? `${dateFrom} → ${dateTo}`
                : dateFrom
                ? `From ${dateFrom}`
                : `Until ${dateTo}`}
              <button onClick={clearDates} className="hover:text-primary-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
      </Card>

      <Card padding={false}>
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size="lg" showLabel /></div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-400 py-12 text-sm">
                      No deliveries found.
                    </td>
                  </tr>
                ) : deliveries.map(d => (
                  <TableRow key={d.id} onClick={() => navigate(`/deliveries/${d.id}`)}>
                    <TableCell>
                      <div className="font-medium text-sm">{d.customer?.firstName} {d.customer?.lastName}</div>
                      <div className="text-xs text-gray-500">{d.customer?.email}</div>
                    </TableCell>
                    <TableCell>
                      {d.partner
                        ? <><div className="font-medium text-sm">{d.partner.firstName} {d.partner.lastName}</div><div className="text-xs text-gray-500">{d.partner.email}</div></>
                        : <span className="text-xs text-gray-400 italic">Unassigned</span>}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5 max-w-[180px]">
                        <div className="flex items-start gap-1"><span className="text-green-500 font-bold mt-0.5">↑</span><span className="truncate">{d.pickupAddress}</span></div>
                        <div className="flex items-start gap-1"><span className="text-red-500 font-bold mt-0.5">↓</span><span className="truncate">{d.dropoffAddress}</span></div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-[120px] truncate">{d.packageDescription}</div>
                      {d.packageWeight && <div className="text-xs text-gray-500">{d.packageWeight} kg</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(d.status)}>
                        {DELIVERY_STATUSES[d.status as keyof typeof DELIVERY_STATUSES] ?? d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      ₦{(d.actualFee ?? d.estimatedFee).toLocaleString('en-NG')}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                      {formatDateTime(d.requestedAt)}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); navigate(`/deliveries/${d.id}`); }}>
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

export default DeliveryList;