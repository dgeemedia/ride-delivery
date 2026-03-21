// admin-web/src/pages/Partners/PartnerList.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star } from 'lucide-react';
import { partnersAPI } from '@/services/api/partners';
import { DeliveryPartner } from '@/types';
import {
  Card, Input, Select, Button,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Badge, Pagination, Spinner,
} from '@/components/common';
import { formatDate } from '@/utils/helpers';
import { VEHICLE_TYPES } from '@/utils/constants';
import toast from 'react-hot-toast';

const PartnerList: React.FC = () => {
  const navigate = useNavigate();
  const [partners, setPartners]         = useState<DeliveryPartner[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [totalPages, setTotalPages]     = useState(1);

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
    } catch {
      toast.error('Failed to load delivery partners');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Partners</h1>
          <p className="text-gray-600 mt-1">Manage all delivery partner accounts</p>
        </div>
        <Button onClick={() => navigate('/partners/pending')}>View Pending Approvals</Button>
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
            onChange={e => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'All Status' },
              { value: 'true', label: 'Approved' },
              { value: 'false', label: 'Pending' },
            ]}
          />
          <Select
            value={vehicleFilter}
            onChange={e => setVehicleFilter(e.target.value)}
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
                        <div className="w-10 h-10 bg-warning-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
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
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-warning-500 fill-warning-500 mr-1" />
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
                    <TableCell>{formatDate(partner.createdAt)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); navigate(`/partners/${partner.id}`); }}>
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