import api from './index';
import { ApiResponse, PaginatedResponse, User } from '@/types';

export const usersAPI = {
  getUsers: async (params?: any): Promise<PaginatedResponse<User>> => {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  getUserById: async (id: string): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.get(`/admin/users/${id}`);
    return response.data;
  },

  suspendUser: async (id: string, reason: string): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.put(`/admin/users/${id}/suspend`, { reason });
    return response.data;
  },

  activateUser: async (id: string): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.put(`/admin/users/${id}/activate`);
    return response.data;
  },
};