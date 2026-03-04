import React, { useEffect, useState } from 'react';
import { driversAPI } from '@/services/api/drivers';
import { Driver } from '@/types';
import { Card, Button, Badge, Modal } from '@/components/common';
import toast from 'react-hot-toast';

const DriverApproval: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadPendingDrivers();
  }, []);

  const loadPendingDrivers = async () => {
    try {
      const response = await driversAPI.getPendingDrivers();
      setDrivers(response.data.drivers);
    } catch (error) {
      toast.error('Failed to load pending drivers');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await driversAPI.approveDriver(id);
      toast.success('Driver approved');
      loadPendingDrivers();
    } catch (error) {
      toast.error('Failed to approve driver');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Driver Approvals</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {drivers.map((driver) => (
          <Card key={driver.id}>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">
                  {driver.user.firstName} {driver.user.lastName}
                </h3>
                <p className="text-sm text-gray-600">{driver.user.email}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Vehicle</p>
                <p className="font-medium">
                  {driver.vehicleMake} {driver.vehicleModel} ({driver.vehicleYear})
                </p>
                <p className="text-sm">{driver.vehiclePlate}</p>
              </div>

              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => handleApprove(driver.id)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedDriver(driver);
                    setShowModal(true);
                  }}
                >
                  View Documents
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DriverApproval;