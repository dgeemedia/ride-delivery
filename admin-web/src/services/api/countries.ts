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
  /** false = still on auto-generated starter prices; the API blocks going live until reviewed. */
  pricingReviewed?: boolean;
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

// ── Per-country rules (pricing, commission, wallet, payouts, bonuses) ────────
export type SettingType = 'money' | 'percent' | 'number' | 'boolean' | 'enum' | 'date' | 'json';
/** Where the value currently in effect comes from. */
export type SettingSource = 'country' | 'global' | 'starter' | 'default';

export interface CountrySettingField {
  key: string;
  group: string;
  label: string;
  type: SettingType;
  min?: number;
  max?: number;
  options?: string[];
  help?: string;
  strictWhole?: boolean;
  value: any;
  source: SettingSource;
  /** true when this country has its own saved value (can be reset to inherit). */
  overridden: boolean;
}

export interface SurgeWindow {
  label: string;
  days: number[];
  hourStart: number;
  hourEnd: number;
  multiplier: number;
}

export interface CountrySettingsPayload {
  countryCode: string;
  countryName: string;
  currency: string;
  baseCurrency: string;
  pricingReviewed: boolean;
  groups: { id: string; label: string; pricing?: boolean }[];
  settings: CountrySettingField[];
  applied?: { key: string; from: any; to: any; source: SettingSource }[];
}

export interface CompareRow {
  code: string;
  name: string;
  currency: string;
  isActive: boolean;
  values: Record<string, any>;
  sources: Record<string, SettingSource>;
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

  getSettings: async (code: string): Promise<ApiResponse<CountrySettingsPayload>> => {
    const response = await api.get(`/admin/countries/${code}/settings`);
    return response.data;
  },

  /** `null` for a key removes the override so the country inherits again. */
  saveSettings: async (
    code: string,
    changes: Record<string, any>
  ): Promise<ApiResponse<CountrySettingsPayload>> => {
    const response = await api.put(`/admin/countries/${code}/settings`, { changes });
    return response.data;
  },

  copySettings: async (
    code: string,
    body: { fromCode: string; factor?: number; groups?: string[] }
  ): Promise<ApiResponse<CountrySettingsPayload>> => {
    const response = await api.post(`/admin/countries/${code}/settings/copy`, body);
    return response.data;
  },

  markPricingReviewed: async (code: string): Promise<ApiResponse<unknown>> => {
    const response = await api.post(`/admin/countries/${code}/settings/review`);
    return response.data;
  },

  compareSettings: async (
    keys: string[]
  ): Promise<ApiResponse<{ keys: { key: string; label: string; type: SettingType }[]; countries: CompareRow[] }>> => {
    const response = await api.get('/admin/countries/settings/compare', { params: { keys: keys.join(',') } });
    return response.data;
  },

  /**
   * Separate from update() so pausing a market is one click and can't
   * accidentally submit a stale payment configuration alongside it.
   */
  setStatus: async (
    code: string,
    isActive: boolean,
    acknowledgeStarterPricing = false
  ): Promise<ApiResponse<{ country: Country; userCount: number }>> => {
    const response = await api.patch(`/admin/countries/${code}/status`, { isActive, acknowledgeStarterPricing });
    return response.data;
  },
};

export default countriesAPI;
