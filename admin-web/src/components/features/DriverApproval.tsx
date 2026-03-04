import React from 'react';
import { Driver } from '@/types/driver';
import { Card, Button } from '@/components/common';

interface DriverApprovalCardProps {
  driver: Driver;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onViewDocuments: (driver: Driver) => void;
}

const DriverApprovalCard: React.FC<DriverApprovalCardProps> = ({
  driver,
  onApprove,
  onReject,
  onViewDocuments,
}) => {
  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
            {driver.user.firstName[0]}{driver.user.lastName[0]}
          </div>
          <div className="ml-3">
            <h3 className="font-semibold text-lg">
              {driver.user.firstName} {driver.user.lastName}
            </h3>
            <p className="text-sm text-gray-600">{driver.user.email}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-sm text-gray-600">Vehicle</p>
            <p className="font-medium">
              {driver.vehicleMake} {driver.vehicleModel} ({driver.vehicleYear})
            </p>
            <p className="text-sm text-gray-500">{driver.vehiclePlate}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">License Number</p>
            <p className="font-medium">{driver.licenseNumber}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Vehicle Type</p>
            <p className="font-medium">{driver.vehicleType}</p>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="success"
            onClick={() => onApprove(driver.id)}
            className="flex-1"
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => onReject(driver.id)}
            className="flex-1"
          >
            Reject
          </Button>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => onViewDocuments(driver)}
          className="w-full"
        >
          View Documents
        </Button>
      </div>
    </Card>
  );
};

export default DriverApprovalCard;