// admin-web/src/services/api/partners.ts
import api from './index';
import { ApiResponse, PaginatedResponse, DeliveryPartner } from '@/types';

export const partnersAPI = {
  /** GET /api/admin/partners — paginated, filterable */
  getPartners: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    isApproved?: string;  // 'true' | 'false'
    vehicleType?: string;
  }): Promise<PaginatedResponse<DeliveryPartner>> => {
    const response = await api.get('/admin/partners', { params });
    return response.data;
  },

  /** GET /api/admin/partners/pending */
  getPendingPartners: async (): Promise<ApiResponse<{ partners: DeliveryPartner[] }>> => {
    const response = await api.get('/admin/partners/pending');
    return response.data;
  },

  /** GET /api/admin/partners/:id — full detail with recent deliveries */
  getPartnerById: async (
    id: string
  ): Promise<ApiResponse<{ partner: DeliveryPartner; recentDeliveries: any[] }>> => {
    const response = await api.get(`/admin/partners/${id}`);
    return response.data;
  },

  /**
   * PUT /api/admin/partners/:id/approve
   * SUPER_ADMIN can optionally grant a non-withdrawable onboarding bonus.
   */
  approvePartner: async (
    id: string,
    options?: { grantBonus?: boolean; bonusAmount?: number }
  ): Promise<ApiResponse<{ partner: DeliveryPartner; bonusCredited: number }>> => {
    const response = await api.put(`/admin/partners/${id}/approve`, options ?? {});
    return response.data;
  },

  /** PUT /api/admin/partners/:id/reject */
  rejectPartner: async (
    id: string,
    reason: string
  ): Promise<ApiResponse<{ partner: DeliveryPartner }>> => {
    const response = await api.put(`/admin/partners/${id}/reject`, { reason });
    return response.data;
  },
};