// admin-web/src/pages/Rides/RideList.tsx
import React, { useEffect, useState } from 'react';
import { ridesAPI } from '@/services/api/rides';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Card } from '@/components/common';
import { formatDateTime, formatCurrency } from '@/utils/helpers';
import { RIDE_STATUSES, STATUS_COLORS } from '@/utils/constants';

const RideList: React.FC = () => {
  const [rides, setRides] = useState([]);

  useEffect(() => {
    loadRides();
  }, []);

  const loadRides = async () => {
    const response = await ridesAPI.getRides({ page: 1, limit: 50 });
    setRides(response.data.rides);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Rides</h1>
      
      <Card padding={false}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fare</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rides.map((ride: any) => (
              <TableRow key={ride.id}>
                <TableCell>
                  {ride.customer.firstName} {ride.customer.lastName}
                </TableCell>
                <TableCell>
                  {ride.driver ? `${ride.driver.firstName} ${ride.driver.lastName}` : 'Unassigned'}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>{ride.pickupAddress}</div>
                    <div className="text-gray-500">{ride.dropoffAddress}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[ride.status]}>
                    {RIDE_STATUSES[ride.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {ride.actualFare ? formatCurrency(ride.actualFare) : formatCurrency(ride.estimatedFare)}
                </TableCell>
                <TableCell>{formatDateTime(ride.requestedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default RideList;