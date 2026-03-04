import { useAuthStore } from '@/store/authStore';

export const useAuth = () => {
  const { user, token, isAuthenticated, login, logout } = useAuthStore();

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    login,
    logout,
  };
};