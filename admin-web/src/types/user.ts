export interface User {
  id: string;
  email: string;
  phone: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  profileImage?: string;
  isVerified: boolean;
  isActive: boolean;
  isSuspended: boolean;
  suspendedAt?: string;
  suspendedBy?: string;
  suspensionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  DELIVERY_PARTNER = 'DELIVERY_PARTNER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  MODERATOR = 'MODERATOR',
  SUPPORT = 'SUPPORT',
}

export interface CreateUserDTO {
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  phone?: string;
  profileImage?: string;
}