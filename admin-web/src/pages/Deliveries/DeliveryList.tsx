// admin-web/src/pages/Deliveries/DeliveryList.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin } from 'lucide-react';
import { deliveriesAPI } from '@/services/api/deliveries';
import { Delivery } from '@/types';
import {
  Card, Input, Select, Button,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Badge, Pagination, Spinner,
} from '@/components/common';
import { formatDateTime, formatCurrency, getStatusColor } from '@/utils/helpers';
import { DELIVERY_STATUSES } from '@/utils/constants';
import toast from 'react-hot-toast';

const statusBadgeVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
  const map: Record<string, any> = {
    DELIVERED: 'success', CANCELLED: 'error',
    IN_TRANSIT: 'info', PICKED_UP: 'info', ASSIGNED: 'info', PENDING: 'warning',
  };
  return map[status] ?? 'default';
};

const DeliveryList: React.FC = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalCount, setTotalCount]     = useState(0);

  useEffect(() => { load(); }, [currentPage, statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await deliveriesAPI.getDeliveries({
        page: currentPage, limit: 20,
        status: statusFilter || undefined,
      });
      setDeliveries(res.data.deliveries || []);
      setTotalPages(res.data.pagination.pages);
      setTotalCount(res.data.pagination.total);
    } catch {
      toast.error('Failed to load deliveries');
    } finally { setLoading(false); }
  };

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

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search by customer or partner name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyPress={e => { if (e.key === 'Enter') { setCurrentPage(1); load(); } }}
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
        <div className="mt-4 flex justify-end">
          <Button onClick={() => { setCurrentPage(1); load(); }}>
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
                  <TableRow>
                    <TableCell className="text-center text-gray-400 py-12" colSpan={8}>
                      No deliveries found.
                    </TableCell>
                  </TableRow>
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