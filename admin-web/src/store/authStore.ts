// admin-web/src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login:   (user: User, token: string) => void;
  logout:  () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            null,
      token:           null,
      isAuthenticated: false,

      login: (user, token) => set({ user, token, isAuthenticated: true }),

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        localStorage.removeItem('auth-storage');
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      // Persist the full user object including adminDepartment
      partialize: (state) => ({
        user:  state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);