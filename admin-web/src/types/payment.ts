// admin-web/src/types/payment.ts
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
  /** Gateway that took the money: 'paystack' | 'flutterwave' | 'orange' (null for cash/wallet). */
  provider?: PaymentProvider | null;
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
  MOBILE_MONEY = 'MOBILE_MONEY',
}

export type PaymentProvider = 'paystack' | 'flutterwave' | 'orange';

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
  /** Orange Money has no automated refund: confirm the money was already sent manually. */
  manuallySettled?: boolean;
}