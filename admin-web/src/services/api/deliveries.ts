import api from './index';
import { PaginatedResponse, ApiResponse, Delivery } from '@/types';

export const deliveriesAPI = {
  getDeliveries: async (params?: any): Promise<PaginatedResponse<Delivery>> => {
    const response = await api.get('/admin/deliveries', { params });
    return response.data;
  },

  getDeliveryById: async (id: string): Promise<ApiResponse<{ delivery: Delivery }>> => {
    const response = await api.get(`/admin/deliveries/${id}`);
    return response.data;
  },

  cancelDelivery: async (id: string, reason: string): Promise<ApiResponse<{ delivery: Delivery }>> => {
    const response = await api.put(`/admin/deliveries/${id}/cancel`, { reason });
    return response.data;
  },

  getLiveDeliveries: async (): Promise<ApiResponse<{ deliveries: Delivery[] }>> => {
    const response = await api.get('/admin/deliveries/live');
    return response.data;
  },
};