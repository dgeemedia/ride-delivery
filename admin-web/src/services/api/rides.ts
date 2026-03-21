// admin-web/src/services/api/rides.ts
import api from './index';
import { PaginatedResponse, ApiResponse, Ride } from '@/types';

export const ridesAPI = {
  /** GET /api/admin/rides — paginated with optional filters */
  getRides: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    driverId?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Ride>> => {
    const response = await api.get('/admin/rides', { params });
    return response.data;
  },

  /** GET /api/admin/rides/:id — full detail for tracking + history */
  getRideById: async (id: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await api.get(`/admin/rides/${id}`);
    return response.data;
  },

  /** GET /api/admin/rides/live — all in-progress rides with driver GPS */
  getLiveRides: async (): Promise<ApiResponse<{ rides: Ride[]; total: number }>> => {
    const response = await api.get('/admin/rides/live');
    return response.data;
  },

  /** PUT /api/admin/rides/:id/cancel — admin force-cancel */
  cancelRide: async (
    id: string,
    reason?: string
  ): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await api.put(`/admin/rides/${id}/cancel`, { reason });
    return response.data;
  },
};