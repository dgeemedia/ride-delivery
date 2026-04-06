// admin-web/src/types/driver.ts
import { User } from './user';

export interface Driver {
  id: string;
  userId: string;
  user: User;
  licenseNumber: string;
  vehicleType: VehicleType;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleColor: string;
  vehiclePlate: string;
  licenseImageUrl: string;
  vehicleRegUrl: string;
  insuranceUrl: string;
  isApproved: boolean;
  isOnline: boolean;
  currentLat?: number;
  currentLng?: number;
  totalRides: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export enum VehicleType {
  BIKE = 'BIKE',
  CAR = 'CAR',
  MOTORCYCLE = 'MOTORCYCLE',
  VAN = 'VAN',
  TRICYCLE = 'TRICYCLE',
}

export interface DriverDocuments {
  licenseImageUrl: string;
  vehicleRegUrl: string;
  insuranceUrl: string;
}