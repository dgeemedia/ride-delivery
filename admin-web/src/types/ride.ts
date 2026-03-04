import { User } from './user';
import { Payment } from './payment';

export interface Ride {
  id: string;
  customerId: string;
  driverId?: string;
  customer: User;
  driver?: User;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  status: RideStatus;
  distance?: number;
  duration?: number;
  estimatedFare: number;
  actualFare?: number;
  requestedAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  notes?: string;
  cancellationReason?: string;
  payment?: Payment;
  rating?: Rating;
}

export enum RideStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  ARRIVED = 'ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Rating {
  id: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}