// admin-web/src/pages/Rides/RideList.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin } from 'lucide-react';
import { ridesAPI } from '@/services/api/rides';
import { Ride } from '@/types';
import {
  Card, Input, Select, Button,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Badge, Pagination, Spinner,
} from '@/components/common';
import { formatDateTime } from '@/utils/helpers';
import { RIDE_STATUSES } from '@/utils/constants';
import toast from 'react-hot-toast';

const statusVariant = (s: string): 'success' | 'warning' | 'error' | 'info' | 'default' => ({
  COMPLETED: 'success', CANCELLED: 'error',
  IN_PROGRESS: 'info', ACCEPTED: 'info', ARRIVED: 'info', REQUESTED: 'warning',
} as any)[s] ?? 'default';

const RideList: React.FC = () => {
  const navigate = useNavigate();
  const [rides, setRides]             = useState<Ride[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalCount, setTotalCount]     = useState(0);

  useEffect(() => { load(); }, [currentPage, statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ridesAPI.getRides({ page: currentPage, limit: 20, status: statusFilter || undefined });
      setRides(res.data.rides || []);
      setTotalPages(res.data.pagination.pages);
      setTotalCount(res.data.pagination.total);
    } catch {
      toast.error('Failed to load rides');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rides</h1>
          <p className="text-gray-500 text-sm mt-1">{totalCount.toLocaleString()} total</p>
        </div>
        <Button onClick={() => navigate('/rides/live')}>
          <MapPin className="h-4 w-4" />Live Map
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search by customer or driver..."
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
              ...Object.entries(RIDE_STATUSES).map(([value, label]) => ({ value, label: label as string })),
            ]}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => { setCurrentPage(1); load(); }}>
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
                  <TableHead>Customer</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fare</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* FIX: use native <tr><td> for colSpan */}
                {rides.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-gray-400 py-12 text-sm">
                      No rides found.
                    </td>
                  </tr>
                ) : rides.map(ride => (
                  <TableRow key={ride.id} onClick={() => navigate(`/rides/${ride.id}`)}>
                    <TableCell>
                      <div className="font-medium text-sm">{ride.customer?.firstName} {ride.customer?.lastName}</div>
                      <div className="text-xs text-gray-500">{ride.customer?.email}</div>
                    </TableCell>
                    <TableCell>
                      {ride.driver
                        ? <><div className="font-medium text-sm">{ride.driver.firstName} {ride.driver.lastName}</div><div className="text-xs text-gray-500">{ride.driver.email}</div></>
                        : <span className="text-xs text-gray-400 italic">Unassigned</span>}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5 max-w-[200px]">
                        <div className="flex items-start gap-1"><span className="text-green-500 font-bold">↑</span><span className="truncate">{ride.pickupAddress}</span></div>
                        <div className="flex items-start gap-1"><span className="text-red-500 font-bold">↓</span><span className="truncate">{ride.dropoffAddress}</span></div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(ride.status)}>
                        {RIDE_STATUSES[ride.status as keyof typeof RIDE_STATUSES] ?? ride.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      ₦{(ride.actualFare ?? ride.estimatedFare).toLocaleString('en-NG')}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                      {formatDateTime(ride.requestedAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm" variant="outline"
                        onClick={e => { e.stopPropagation(); navigate(`/rides/${ride.id}`); }}
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

export default RideList;