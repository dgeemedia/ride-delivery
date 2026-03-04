import api from './index';
import { ApiResponse, User } from '@/types';

export const authAPI = {
  login: async (email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  getCurrentUser: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout: async (): Promise<void> => {
    // Implement if backend has logout endpoint
    await api.post('/auth/logout');
  },

  forgotPassword: async (email: string): Promise<ApiResponse<void>> => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },
};