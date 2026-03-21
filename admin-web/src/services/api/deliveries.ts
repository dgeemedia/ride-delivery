// admin-web/src/services/api/deliveries.ts
import api from './index';
import { PaginatedResponse, ApiResponse, Delivery } from '@/types';

export const deliveriesAPI = {
  /** GET /api/admin/deliveries — paginated list with optional status filter */
  getDeliveries: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    partnerId?: string;
    customerId?: string;
  }): Promise<PaginatedResponse<Delivery>> => {
    const response = await api.get('/admin/deliveries', { params });
    return response.data;
  },

  /** GET /api/admin/deliveries/:id — full detail for live tracking + history */
  getDeliveryById: async (id: string): Promise<ApiResponse<{ delivery: Delivery; timeline: any[] }>> => {
    const response = await api.get(`/admin/deliveries/${id}`);
    return response.data;
  },

  /** GET /api/admin/deliveries/live — all in-progress deliveries with partner GPS */
  getLiveDeliveries: async (): Promise<ApiResponse<{ deliveries: Delivery[]; total: number }>> => {
    const response = await api.get('/admin/deliveries/live');
    return response.data;
  },

  /** PUT /api/admin/deliveries/:id/cancel — admin force-cancel */
  cancelDelivery: async (id: string, reason?: string): Promise<ApiResponse<{ delivery: Delivery }>> => {
    const response = await api.put(`/admin/deliveries/${id}/cancel`, { reason });
    return response.data;
  },
};