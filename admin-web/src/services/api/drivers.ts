// admin-web/src/services/api/drivers.ts
import api from './index';
import { ApiResponse, PaginatedResponse, Driver } from '@/types';

export const driversAPI = {
  /** GET /api/admin/drivers — paginated, filterable */
  getDrivers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    isApproved?: string;   // 'true' | 'false'
    vehicleType?: string;
  }): Promise<PaginatedResponse<Driver>> => {
    const response = await api.get('/admin/drivers', { params });
    return response.data;
  },

  /** GET /api/admin/drivers/pending */
  getPendingDrivers: async (): Promise<ApiResponse<{ drivers: Driver[] }>> => {
    const response = await api.get('/admin/drivers/pending');
    return response.data;
  },

  /** GET /api/admin/drivers/:id — full detail with recent rides */
  getDriverById: async (id: string): Promise<ApiResponse<{ driver: Driver; recentRides: any[] }>> => {
    const response = await api.get(`/admin/drivers/${id}`);
    return response.data;
  },

  /**
   * PUT /api/admin/drivers/:id/approve
   * SUPER_ADMIN can optionally grant a non-withdrawable onboarding bonus.
   */
  approveDriver: async (
    id: string,
    options?: { grantBonus?: boolean; bonusAmount?: number }
  ): Promise<ApiResponse<{ driver: Driver; bonusCredited: number }>> => {
    const response = await api.put(`/admin/drivers/${id}/approve`, options ?? {});
    return response.data;
  },

  /** PUT /api/admin/drivers/:id/reject */
  rejectDriver: async (
    id: string,
    reason: string
  ): Promise<ApiResponse<{ driver: Driver }>> => {
    const response = await api.put(`/admin/drivers/${id}/reject`, { reason });
    return response.data;
  },
};