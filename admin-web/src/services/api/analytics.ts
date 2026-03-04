import api from './index';
import { ApiResponse, DashboardStats, RevenueAnalytics, UserGrowth } from '@/types';

export const analyticsAPI = {
  getDashboardStats: async (): Promise<ApiResponse<DashboardStats>> => {
    const response = await api.get('/admin/dashboard/stats');
    return response.data;
  },

  getRevenueAnalytics: async (period: string = 'month'): Promise<ApiResponse<RevenueAnalytics>> => {
    const response = await api.get('/admin/analytics/revenue', {
      params: { period },
    });
    return response.data;
  },

  getUserGrowth: async (period: string = 'month'): Promise<ApiResponse<UserGrowth>> => {
    const response = await api.get('/admin/analytics/user-growth', {
      params: { period },
    });
    return response.data;
  },
};