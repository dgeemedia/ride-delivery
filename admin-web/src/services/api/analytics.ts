// admin-web/src/services/api/analytics.ts
import api from './index';
import { ApiResponse, DashboardStats, RevenueAnalytics, UserGrowth } from '@/types';

export interface PerformanceMetrics {
  averageRideTime:         number | null;
  averageDeliveryTime:     number | null;
  driverRating:            number | null;
  partnerRating:           number | null;
  completionRate:          number;
  rideCompletionRate:      number;
  deliveryCompletionRate:  number;
  cancellationRate:        number;
  totalRides:              number;
  totalDeliveries:         number;
  completedRides:          number;
  completedDeliveries:     number;
  cancelledRides:          number;
  cancelledDeliveries:     number;
}

export interface WeeklyActivity {
  day:        string;
  rides:      number;
  deliveries: number;
}

export interface CompletionSlice {
  name:  string;
  value: number;
}

export interface PerformanceAnalytics {
  period:         string;
  metrics:        PerformanceMetrics;
  weeklyActivity: WeeklyActivity[];
  completionData: CompletionSlice[];
}

export const analyticsAPI = {
  getDashboardStats: async (): Promise<ApiResponse<DashboardStats>> => {
    const response = await api.get('/admin/dashboard/stats');
    return response.data;
  },

  getRevenueAnalytics: async (period: string = 'month'): Promise<ApiResponse<RevenueAnalytics>> => {
    const response = await api.get('/admin/analytics/revenue', { params: { period } });
    return response.data;
  },

  getUserGrowth: async (period: string = 'month'): Promise<ApiResponse<UserGrowth>> => {
    const response = await api.get('/admin/analytics/user-growth', { params: { period } });
    return response.data;
  },

  getPerformanceAnalytics: async (period: string = 'week'): Promise<ApiResponse<PerformanceAnalytics>> => {
    const response = await api.get('/admin/analytics/performance', { params: { period } });
    return response.data;
  },
};