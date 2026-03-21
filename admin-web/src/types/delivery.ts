// admin-web/src/types/delivery.ts
import { User } from './user';
import { Payment } from './payment';

export interface Delivery {
  id: string;
  customerId: string;
  partnerId?: string;
  customer: User;
  partner?: User;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  pickupContact: string;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffContact: string;
  packageDescription: string;
  packageWeight?: number;
  packageValue?: number;
  status: DeliveryStatus;
  distance?: number;
  estimatedFee: number;
  actualFee?: number;
  deliveryImageUrl?: string;
  recipientName?: string;
  requestedAt: string;
  assignedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  notes?: string;
  payment?: Payment;
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}