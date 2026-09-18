// admin-web/src/services/api/countries.ts
import api from './index';
import { ApiResponse } from '@/types';

export type CreditMethod = 'CASH' | 'WALLET' | 'PAYSTACK' | 'FLUTTERWAVE' | 'ORANGE_MONEY';
export type PayoutMethod = 'NG_BANK_TRANSFER' | 'BANK_TRANSFER' | 'ORANGE_MONEY' | 'MANUAL' | 'UNSUPPORTED';
export type PaymentProvider = 'paystack' | 'flutterwave' | 'orange';

export interface Country {
  id: string;
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  defaultLocale: string;
  languageCode: string;
  phoneDialCode: string;
  isActive: boolean;
  paymentProviders: PaymentProvider[];
  creditMethods: CreditMethod[];
  payoutMethods: PayoutMethod[];
  payoutMethod: string;
  /** Secrets arrive masked as '••••1234' — see redactProviderConfig on the server. */
  providerConfig: Record<string, Record<string, any>>;
  userCount?: number;
  pendingPayouts?: number;
  grossVolume?: number;
  platformFees?: number;
}

export interface CountryMeta {
  creditMethods: CreditMethod[];
  payoutMethods: PayoutMethod[];
  providers: PaymentProvider[];
  methodProvider: Record<string, PaymentProvider | null>;
  orangeConfigured: boolean;
  orangeB2CEnabled: boolean;
  orangeMarkets: string[];
}

export interface CountryOverview {
  country: Country;
  users: Record<string, number>;
  queues: {
    pendingDrivers: number;
    pendingPartners: number;
    pendingPayouts: number;
    unreconciledTopUps: number;
  };
  live: { rides: number; deliveries: number };
  revenue: {
    currency: string;
    grossVolume: number;
    platformFees: number;
    paymentCount: number;
  };
}

export const countriesAPI = {
  list: async (): Promise<ApiResponse<{ countries: Country[]; meta: CountryMeta }>> => {
    const response = await api.get('/admin/countries');
    return response.data;
  },

  /** One row per market with traffic + pending-queue counts, for the dashboard table. */
  overviewAll: async (): Promise<ApiResponse<{ countries: Country[] }>> => {
    const response = await api.get('/admin/countries/overview');
    return response.data;
  },

  overview: async (code: string): Promise<ApiResponse<CountryOverview>> => {
    const response = await api.get(`/admin/countries/${code}/overview`);
    return response.data;
  },

  get: async (code: string): Promise<ApiResponse<{ country: Country }>> => {
    const response = await api.get(`/admin/countries/${code}`);
    return response.data;
  },

  create: async (payload: Partial<Country>): Promise<ApiResponse<{ country: Country }>> => {
    const response = await api.post('/admin/countries', payload);
    return response.data;
  },

  update: async (code: string, payload: Partial<Country>): Promise<ApiResponse<{ country: Country }>> => {
    const response = await api.put(`/admin/countries/${code}`, payload);
    return response.data;
  },

  /**
   * Separate from update() so pausing a market is one click and can't
   * accidentally submit a stale payment configuration alongside it.
   */
  setStatus: async (
    code: string,
    isActive: boolean
  ): Promise<ApiResponse<{ country: Country; userCount: number }>> => {
    const response = await api.patch(`/admin/countries/${code}/status`, { isActive });
    return response.data;
  },
};

export default countriesAPI;
