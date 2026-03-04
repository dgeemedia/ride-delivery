import api from './index';
import { PaginatedResponse, ApiResponse, Payment, RefundRequest } from '@/types';

export const paymentsAPI = {
  getPayments: async (params?: any): Promise<PaginatedResponse<Payment>> => {
    const response = await api.get('/admin/payments', { params });
    return response.data;
  },

  getPaymentById: async (id: string): Promise<ApiResponse<{ payment: Payment }>> => {
    const response = await api.get(`/admin/payments/${id}`);
    return response.data;
  },

  processRefund: async (data: RefundRequest): Promise<ApiResponse<{ payment: Payment }>> => {
    const response = await api.post('/admin/payments/refund', data);
    return response.data;
  },

  getRefunds: async (): Promise<ApiResponse<{ refunds: Payment[] }>> => {
    const response = await api.get('/admin/payments/refunds');
    return response.data;
  },
};