// admin-web/src/services/api/partners.ts
import api from './index';
import { ApiResponse, PaginatedResponse, DeliveryPartner } from '@/types';

export const partnersAPI = {
  getPartners: async (params?: any): Promise<PaginatedResponse<DeliveryPartner>> => {
    const response = await api.get('/admin/partners', { params });
    return response.data;
  },

  getPendingPartners: async (): Promise<ApiResponse<{ partners: DeliveryPartner[] }>> => {
    const response = await api.get('/admin/partners/pending');
    return response.data;
  },

  getPartnerById: async (id: string): Promise<ApiResponse<{ partner: DeliveryPartner }>> => {
    const response = await api.get(`/admin/partners/${id}`);
    return response.data;
  },

  /**
   * Approve delivery partner.
   * SUPER_ADMIN can optionally grant onboarding bonus.
   * Bonus is non-withdrawable — only usable to accept deliveries.
   */
  approvePartner: async (
    id: string,
    options?: { grantBonus?: boolean; bonusAmount?: number }
  ): Promise<ApiResponse<{ partner: DeliveryPartner }>> => {
    const response = await api.put(`/admin/partners/${id}/approve`, options ?? {});
    return response.data;
  },

  rejectPartner: async (id: string, reason: string): Promise<ApiResponse<{ partner: DeliveryPartner }>> => {
    const response = await api.put(`/admin/partners/${id}/reject`, { reason });
    return response.data;
  },
};