// admin-web/src/services/api/index.ts
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
(error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      toast.error('Session expired. Please login again.');
      // mark so components don't double-toast
      error._handled = true;
    } else if (error.response?.status === 403) {
      // Don't toast here — the component has the specific reason (e.g. quiet hours).
      // Only mark it so components can choose to suppress their own generic fallback.
      error._handled = false;
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
      error._handled = true;
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout. Please check your connection.');
      error._handled = true;
    }
    return Promise.reject(error);
  }
);

export default api;