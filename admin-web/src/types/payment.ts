import { User } from './user';
import { Ride } from './ride';
import { Delivery } from './delivery';

export interface Payment {
  id: string;
  userId: string;
  user: User;
  rideId?: string;
  ride?: Ride;
  deliveryId?: string;
  delivery?: Delivery;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  receiptUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  WALLET = 'WALLET',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface RefundRequest {
  paymentId: string;
  amount: number;
  reason: string;
}