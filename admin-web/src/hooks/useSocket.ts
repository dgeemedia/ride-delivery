import { useEffect, useCallback } from 'react';
import socketService from '@/services/socket';
import { useAuthStore } from '@/store/authStore';
import { SocketEvent } from '@/services/socket/events';

export const useSocket = () => {
  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && token) {
      socketService.connect(token);
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated, token]);

  const on = useCallback((event: SocketEvent, callback: (...args: any[]) => void) => {
    socketService.on(event, callback);
    return () => socketService.off(event, callback);
  }, []);

  const emit = useCallback((event: SocketEvent, data?: any) => {
    socketService.emit(event, data);
  }, []);

  const isConnected = useCallback(() => {
    return socketService.isConnected();
  }, []);

  return { on, emit, isConnected };
};