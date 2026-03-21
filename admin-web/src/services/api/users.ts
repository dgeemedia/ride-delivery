// admin-web/src/services/api/users.ts
import api from './index';
import { ApiResponse, PaginatedResponse, User } from '@/types';

export interface CreateAdminPayload {
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'SUPPORT' | 'MODERATOR';
  adminDepartment?: 'RIDES' | 'DELIVERIES' | 'SUPPORT' | null;
}

export const usersAPI = {
  getUsers: async (params?: {
    page?: number; limit?: number;
    role?: string; search?: string; isActive?: string;
  }): Promise<PaginatedResponse<User>> => {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  getUserById: async (id: string): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.get(`/admin/users/${id}`);
    return response.data;
  },

  suspendUser: async (id: string, reason: string): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.put(`/admin/users/${id}/suspend`, { reason });
    return response.data;
  },

  activateUser: async (id: string): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.put(`/admin/users/${id}/activate`);
    return response.data;
  },

  /** Soft-delete — SUPER_ADMIN only */
  deleteUser: async (id: string): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  },

  /** Create admin / support / moderator account — SUPER_ADMIN only */
  createAdminUser: async (
    payload: CreateAdminPayload
  ): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.post('/admin/users/create-admin', payload);
    return response.data;
  },
};