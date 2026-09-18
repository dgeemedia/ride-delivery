// mobile/src/context/CountryConfigContext.js
//
// One source of truth for "what can this user pay with, and how do they get
// paid out". Fetched once on login from GET /api/countries/me/config, which
// resolves the user's countryCode server-side — the client never decides
// which payment rails it's allowed to use.
//
// Why this is a context rather than a per-screen fetch: PaymentSelector,
// WalletTopUpScreen and WithdrawalScreen all need the same answer, and
// having each of them ask independently meant three round-trips and three
// chances to disagree about whether Orange Money is available.
//
// Falls back to the old hardcoded Nigeria behaviour if the fetch fails, so a
// flaky network degrades to "cash, wallet, Paystack, Flutterwave" rather
// than to a screen with no payment options at all.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { countryAPI } from '../services/api';
import { useAuth } from './AuthContext';

// Mirrors backend FALLBACK_COUNTRY in services/country.service.js.
const FALLBACK_CONFIG = {
  countryCode:    'NG',
  countryName:    'Nigeria',
  currencyCode:   'NGN',
  currencySymbol: '\u20A6',
  languageCode:   'en',
  providers:      ['paystack', 'flutterwave'],
  creditMethods:  ['CASH', 'WALLET', 'PAYSTACK', 'FLUTTERWAVE'],
  defaultMethod:  'PAYSTACK',
  payoutMethods:  ['NG_BANK_TRANSFER'],
  payoutMethod:   'NG_BANK_TRANSFER',
  payoutStyle:    'BANK',
  orangeReady:    false,
};

const CountryConfigContext = createContext();

export const CountryConfigProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [config, setConfig]   = useState(FALLBACK_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await countryAPI.getMyConfig();
      const next = res?.data?.config ?? res?.data?.data?.config;
      if (next?.creditMethods?.length) {
        setConfig(next);
        setError(null);
      }
    } catch (err) {
      // Deliberately non-fatal — see the file header.
      console.warn('[CountryConfig] Falling back to default payment config:', err?.message);
      setError(err?.message ?? 'Could not load payment options');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [token, user?.id, refresh]);

  // ── Derived helpers the screens actually consume ──────────────────────────
  const supports      = useCallback((method) => config.creditMethods.includes(method), [config]);
  const isOrangeMarket = config.providers.includes('orange');
  const isMobileMoneyPayout = config.payoutStyle === 'MOBILE_MONEY';

  return (
    <CountryConfigContext.Provider
      value={{
        config,
        loading,
        error,
        refresh,
        supports,
        isOrangeMarket,
        isMobileMoneyPayout,
        creditMethods: config.creditMethods,
        defaultMethod: config.defaultMethod,
      }}
    >
      {children}
    </CountryConfigContext.Provider>
  );
};

export const useCountryConfig = () => {
  const ctx = useContext(CountryConfigContext);
  if (!ctx) throw new Error('useCountryConfig must be used within a CountryConfigProvider');
  return ctx;
};

export { FALLBACK_CONFIG };
