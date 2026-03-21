// admin-web/src/types/index.ts
// REPLACE the existing User interface — adds adminDepartment

export type AdminDepartment = 'RIDES' | 'DELIVERIES' | 'SUPPORT' | null;

export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'CUSTOMER' | 'DRIVER' | 'DELIVERY_PARTNER' | 'ADMIN' | 'SUPER_ADMIN' | 'MODERATOR' | 'SUPPORT';
  adminDepartment?: AdminDepartment;  // ← new
  profileImage?: string;
  isActive: boolean;
  isVerified: boolean;
  isSuspended: boolean;
  suspendedAt?: string;
  suspendedBy?: string;
  suspensionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: string;
  userId: string;
  user: User;
  licenseNumber: string;
  vehicleType: 'BIKE' | 'CAR' | 'MOTORCYCLE' | 'VAN';
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

export interface DeliveryPartner {
  id: string;
  userId: string;
  user: User;
  vehicleType: 'BIKE' | 'CAR' | 'MOTORCYCLE' | 'VAN';
  vehiclePlate?: string;
  idImageUrl: string;
  vehicleImageUrl?: string;
  isApproved: boolean;
  isOnline: boolean;
  currentLat?: number;
  currentLng?: number;
  totalDeliveries: number;
  rating: number;
  createdAt: string;
}

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
  status: 'REQUESTED' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  distance?: number;
  duration?: number;
  estimatedFare: number;
  actualFare?: number;
  requestedAt: string;
  acceptedAt?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  notes?: string;
  cancellationReason?: string;
  promoCode?: string;
  payment?: Payment;
  rating?: Rating;
}

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
  status: 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  distance?: number;
  estimatedFee: number;
  actualFee?: number;
  deliveryImageUrl?: string;
  recipientName?: string;
  requestedAt: string;
  assignedAt?: string;
  pickedUpAt?: string;
  inTransitAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  notes?: string;
  payment?: Payment;
  rating?: Rating;
}

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
  method: 'CASH' | 'CARD' | 'WALLET';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transactionId?: string;
  receiptUrl?: string;
  platformFee?: number;
  driverEarnings?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Rating {
  id: string;
  userId: string;
  rideId?: string;
  deliveryId?: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface DashboardStats {
  users:      { total: number; drivers: number; partners: number };
  rides:      { total: number; active: number };
  deliveries: { total: number; active: number };
  revenue:    { today: number; month: number; currency: string };
  wallet:     { totalBalance: number };
  pending:    { drivers: number; partners: number };
  support:    { openTickets: number };
}

export interface RevenueAnalytics {
  totalRevenue: number;
  platformFee: number;
  netRevenue: number;
  transactionCount: number;
  dailyRevenue: Array<{
    date: string; total: number; rides: number; deliveries: number; count: number;
  }>;
  byMethod: Record<string, number>;
  period: string;
  currency: string;
}

export interface UserGrowth {
  growth: Array<{
    month: string; customers: number; drivers: number; partners: number; total: number;
  }>;
  totalUsers: number;
  period: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    [key: string]: T[] | any;
    pagination: { total: number; page: number; pages: number };
  };
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}