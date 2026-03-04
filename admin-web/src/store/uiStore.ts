import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  isMobile: boolean;
  setIsMobile: (isMobile: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  isMobile: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  
  setIsMobile: (isMobile: boolean) => set({ isMobile }),
}));