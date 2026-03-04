import React from 'react';
import { Card } from '@/components/common';

interface RideMapProps {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  driverLat?: number;
  driverLng?: number;
}

const RideMap: React.FC<RideMapProps> = ({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  driverLat,
  driverLng,
}) => {
  return (
    <Card>
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="font-medium">Map Integration</p>
          <p className="text-sm mt-1">
            Pickup: {pickupLat.toFixed(4)}, {pickupLng.toFixed(4)}
          </p>
          <p className="text-sm">
            Dropoff: {dropoffLat.toFixed(4)}, {dropoffLng.toFixed(4)}
          </p>
          {driverLat && driverLng && (
            <p className="text-sm mt-2 text-primary-500">
              Driver: {driverLat.toFixed(4)}, {driverLng.toFixed(4)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default RideMap;