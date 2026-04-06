// admin-web/src/store/dataStore.ts
import { create } from 'zustand';
import { DashboardStats } from '@/types';

interface DataState {
  dashboardStats: DashboardStats | null;
  setDashboardStats: (stats: DashboardStats) => void;
  
  liveRidesCount: number;
  setLiveRidesCount: (count: number) => void;
  
  liveDeliveriesCount: number;
  setLiveDeliveriesCount: (count: number) => void;
  
  pendingApprovalsCount: number;
  setPendingApprovalsCount: (count: number) => void;
}

export const useDataStore = create<DataState>((set) => ({
  dashboardStats: null,
  setDashboardStats: (stats) => set({ dashboardStats: stats }),
  
  liveRidesCount: 0,
  setLiveRidesCount: (count) => set({ liveRidesCount: count }),
  
  liveDeliveriesCount: 0,
  setLiveDeliveriesCount: (count) => set({ liveDeliveriesCount: count }),
  
  pendingApprovalsCount: 0,
  setPendingApprovalsCount: (count) => set({ pendingApprovalsCount: count }),
}));