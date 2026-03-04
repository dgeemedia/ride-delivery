import api from './index';
import { ApiResponse, PaginatedResponse, Driver } from '@/types';

export const driversAPI = {
  getDrivers: async (params?: any): Promise<PaginatedResponse<Driver>> => {
    const response = await api.get('/admin/drivers', { params });
    return response.data;
  },

  getPendingDrivers: async (): Promise<ApiResponse<{ drivers: Driver[] }>> => {
    const response = await api.get('/admin/drivers/pending');
    return response.data;
  },

  getDriverById: async (id: string): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await api.get(`/admin/drivers/${id}`);
    return response.data;
  },

  approveDriver: async (id: string): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await api.put(`/admin/drivers/${id}/approve`);
    return response.data;
  },

  rejectDriver: async (id: string, reason: string): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await api.put(`/admin/drivers/${id}/reject`, { reason });
    return response.data;
  },
};