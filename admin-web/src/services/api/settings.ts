// admin-web/src/services/api/settings.ts
import api from './index';
import { ApiResponse } from '@/types';

export const settingsAPI = {
  getSettings: async (category?: string): Promise<ApiResponse<{ settings: Record<string, any> }>> => {
    const response = await api.get('/admin/settings', { params: category ? { category } : undefined });
    return response.data;
  },

  updateSetting: async (key: string, value: string | number): Promise<ApiResponse<{ setting: any }>> => {
    const response = await api.put(`/admin/settings/${key}`, { value });
    return response.data;
  },

  // Sends all keys in one request — avoids rate-limit bursts from parallel PUTs
  updateSettingsBatch: async (
    settings: { key: string; value: string; category?: string }[]
  ): Promise<ApiResponse<{ settings: any[] }>> => {
    const response = await api.patch('/admin/settings/batch', { settings });
    return response.data;
  },
};