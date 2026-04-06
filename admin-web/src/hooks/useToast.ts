// admin-web/src/hooks/useToast.ts
import { useCallback } from 'react';
import toast, { Toast } from 'react-hot-toast';

export const useToast = () => {
  const showSuccess = useCallback((message: string) => {
    toast.success(message);
  }, []);

  const showError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  const showInfo = useCallback((message: string) => {
    toast(message, {
      icon: 'ℹ️',
    });
  }, []);

  const showWarning = useCallback((message: string) => {
    toast(message, {
      icon: '⚠️',
      style: {
        background: '#FF9500',
        color: '#fff',
      },
    });
  }, []);

  const showLoading = useCallback((message: string) => {
    return toast.loading(message);
  }, []);

  const dismiss = useCallback((toastId?: string) => {
    toast.dismiss(toastId);
  }, []);

  return {
    success: showSuccess,
    error: showError,
    info: showInfo,
    warning: showWarning,
    loading: showLoading,
    dismiss,
  };
};