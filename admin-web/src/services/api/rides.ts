import api from './index';
import { PaginatedResponse, ApiResponse, Ride } from '@/types';

export const ridesAPI = {
  getRides: async (params?: any): Promise<PaginatedResponse<Ride>> => {
    const response = await api.get('/admin/rides', { params });
    return response.data;
  },

  getRideById: async (id: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await api.get(`/admin/rides/${id}`);
    return response.data;
  },

  cancelRide: async (id: string, reason: string): Promise<ApiResponse<{ ride: Ride }>> => {
    const response = await api.put(`/admin/rides/${id}/cancel`, { reason });
    return response.data;
  },
};