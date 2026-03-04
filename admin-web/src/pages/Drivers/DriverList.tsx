import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Star } from 'lucide-react';
import { driversAPI } from '@/services/api/drivers';
import { Driver } from '@/types';
import {
  Card,
  Input,
  Select,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Pagination,
} from '@/components/common';
import { formatDate } from '@/utils/helpers';
import { VEHICLE_TYPES } from '@/utils/constants';
import toast from 'react-hot-toast';

const DriverList: React.FC = () => {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadDrivers();
  }, [currentPage, statusFilter, vehicleFilter]);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const response = await driversAPI.getDrivers({
        page: currentPage,
        limit: 20,
        search: search || undefined,
        isApproved: statusFilter || undefined,
        vehicleType: vehicleFilter || undefined,
      });
      setDrivers(response.data.drivers || []);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      toast.error('Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadDrivers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-gray-600 mt-1">Manage all driver accounts</p>
        </div>
        <Button onClick={() => navigate('/drivers/pending')}>
          View Pending Approvals
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search by name, email, or license..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'All Status' },
              { value: 'true', label: 'Approved' },
              { value: 'false', label: 'Pending' },
            ]}
          />
          <Select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            options={[
              { value: '', label: 'All Vehicles' },
              ...Object.entries(VEHICLE_TYPES).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>
      </Card>

      {/* Drivers Table */}
      <Card padding={false}>
        {loading ? (
          <div className="p-8 text-center">Loading...</div>
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
                {drivers.map((driver) => (
                  <TableRow key={driver.id} onClick={() => navigate(`/drivers/${driver.id}`)}>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-medium">
                          {driver.user.firstName[0]}{driver.user.lastName[0]}
                        </div>
                        <div className="ml-3">
                          <div className="font-medium">
                            {driver.user.firstName} {driver.user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{driver.user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {driver.vehicleMake} {driver.vehicleModel}
                        </div>
                        <div className="text-sm text-gray-500">
                          {driver.vehicleType} • {driver.vehiclePlate}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{driver.licenseNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-warning-500 fill-warning-500 mr-1" />
                        <span className="font-medium">{driver.rating.toFixed(1)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{driver.totalRides}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={driver.isApproved ? 'success' : 'warning'}>
                          {driver.isApproved ? 'Approved' : 'Pending'}
                        </Badge>
                        {driver.isOnline && (
                          <Badge variant="success">Online</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(driver.createdAt)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default DriverList;