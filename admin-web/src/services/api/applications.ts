// admin-web/src/services/api/applications.ts
import api from './index';
import { PaginatedResponse } from '@/types';

export interface IncompleteApplicant {
  id:        string;
  email:     string;
  phone:     string;
  firstName: string;
  lastName:  string;
  role:      'DRIVER' | 'DELIVERY_PARTNER';
  isActive:  boolean;
  createdAt: string;
}

export const applicationsAPI = {
  getIncomplete: async (params: {
    page?:  number;
    limit?: number;
    role?:  'DRIVER' | 'DELIVERY_PARTNER';
  } = {}): Promise<PaginatedResponse<IncompleteApplicant>> => {
    const response = await api.get('/admin/applications/incomplete', { params });
    return response.data;
  },
};