// admin-web/src/types/driver.ts
import { User } from './user';

export type DocumentStatus = 'COMPLETE' | 'PARTIAL' | 'NONE';

export interface Driver {
  id: string;
  userId: string;
  user: User;

  // ── Vehicle / license ──────────────────────────────────────────────────────
  licenseNumber: string;
  vehicleType: VehicleType;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleColor: string;
  vehiclePlate: string;

  // ── Documents ──────────────────────────────────────────────────────────────
  licenseImageUrl?: string;
  vehicleRegUrl?: string;
  insuranceUrl?: string;
  documentsUploadedAt?: string;  // ← new: when driver last uploaded docs

  /** Derived by the backend — 'COMPLETE' | 'PARTIAL' | 'NONE' */
  documentStatus?: DocumentStatus;  // ← new

  // ── Approval state ─────────────────────────────────────────────────────────
  isApproved: boolean;
  approvedAt?: string;   // ← new
  approvedBy?: string;   // ← new (admin userId)
  isRejected: boolean;   // ← new
  rejectedAt?: string;   // ← new
  rejectedBy?: string;   // ← new (admin userId)
  rejectionReason?: string;  // ← new

  // ── Runtime ───────────────────────────────────────────────────────────────
  isOnline: boolean;
  currentLat?: number;
  currentLng?: number;
  totalRides: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export enum VehicleType {
  BIKE       = 'BIKE',
  CAR        = 'CAR',
  MOTORCYCLE = 'MOTORCYCLE',
  VAN        = 'VAN',
  TRICYCLE   = 'TRICYCLE',
}

export interface DriverDocuments {
  licenseImageUrl?: string;
  vehicleRegUrl?: string;
  insuranceUrl?: string;
}