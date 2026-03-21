// admin-web/src/services/api/tickets.ts
import api from './index';
import { ApiResponse, PaginatedResponse } from '@/types';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  user?: {
    id: string; firstName: string; lastName: string;
    email: string; phone: string; role: string;
  };
  subject: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  resolution?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  replies?: TicketReply[];
}

export interface TicketReply {
  id: string;
  ticketId: string;
  authorId: string;
  author?: { id: string; firstName: string; lastName: string; role: string };
  message: string;
  isAdmin: boolean;
  createdAt: string;
}

export const ticketsAPI = {
  getTickets: async (params?: {
    page?: number; limit?: number;
    status?: string; priority?: string; category?: string; assignedTo?: string;
  }): Promise<PaginatedResponse<SupportTicket>> => {
    const response = await api.get('/admin/tickets', { params });
    return response.data;
  },

  getTicketById: async (id: string): Promise<ApiResponse<{ ticket: SupportTicket }>> => {
    const response = await api.get(`/admin/tickets/${id}`);
    return response.data;
  },

  updateTicket: async (
    id: string,
    payload: {
      status?: string;
      assignedTo?: string;
      resolution?: string;
      replyMessage?: string;
    }
  ): Promise<ApiResponse<{ ticket: SupportTicket }>> => {
    const response = await api.put(`/admin/tickets/${id}`, payload);
    return response.data;
  },
};