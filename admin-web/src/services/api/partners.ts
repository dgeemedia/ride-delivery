import api from './index';
import { ApiResponse, DeliveryPartner } from '@/types';

export const partnersAPI = {
  getPendingPartners: async (): Promise<ApiResponse<{ partners: DeliveryPartner[] }>> => {
    const response = await api.get('/admin/partners/pending');
    return response.data;
  },

  approvePartner: async (id: string): Promise<ApiResponse<{ partner: DeliveryPartner }>> => {
    const response = await api.put(`/admin/partners/${id}/approve`);
    return response.data;
  },

  rejectPartner: async (id: string, reason: string): Promise<ApiResponse<{ partner: DeliveryPartner }>> => {
    const response = await api.put(`/admin/partners/${id}/reject`, { reason });
    return response.data;
  },
};