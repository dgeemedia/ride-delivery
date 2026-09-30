// mobile/src/context/CurrencyContext.js
//
// Single source of truth for "what currency should this screen display".
// Fetches the user's wallet once (currency is set server-side based on
// their country — see backend/src/services/country.service.js) and exposes
// it everywhere via useCurrency(), instead of every screen hardcoding ₦.
//
// Falls back to NGN/₦ if the wallet hasn't loaded yet or the fetch fails,
// so existing screens never render blank while this loads.

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { walletAPI } from '../services/api';
import { useAuth } from './AuthContext';

const CURRENCY_SYMBOLS = {
  NGN: '₦', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', USD: '$', EUR: '€', GBP: '£',
  XOF: 'CFA', XAF: 'FCFA', GMD: 'D', GNF: 'FG', SLE: 'Le', LRD: 'L$', CVE: '$',
  MGA: 'Ar', CDF: 'FC', BWP: 'P',
};

// Kept in sync with backend/src/services/country.service.js's currency→locale
// intent (fareEngine/country config assign en-XX per country). Add entries
// here as new countries go live so number formatting looks native.
const CURRENCY_LOCALES = {
  NGN: 'en-NG', GHS: 'en-GH', KES: 'en-KE', ZAR: 'en-ZA', USD: 'en-US', EUR: 'en-IE', GBP: 'en-GB',
  XOF: 'fr-CI', XAF: 'fr-CM', GMD: 'en-GM', GNF: 'fr-GN', SLE: 'en-SL', LRD: 'en-LR', CVE: 'pt-CV',
  MGA: 'fr-MG', CDF: 'fr-CD', BWP: 'en-BW',
};

// Currencies with no minor unit — never show ".00" on these.
const WHOLE_UNIT = ['XOF', 'XAF', 'GNF', 'MGA', 'CDF'];

const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [currency, setCurrency] = useState('NGN');
  const [loading, setLoading] = useState(true);

  const refreshCurrency = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await walletAPI.getWallet();
      const walletCurrency = res?.data?.wallet?.currency;
      if (walletCurrency) setCurrency(walletCurrency);
    } catch (err) {
      console.warn('[CurrencyContext] Failed to fetch wallet currency, defaulting to NGN:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refreshCurrency(); }, [token, user?.id, refreshCurrency]);

  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;
  const locale = CURRENCY_LOCALES[currency] || 'en-NG';

  const formatMoney = useCallback((amount, opts = {}) => {
    const value = Number(amount) || 0;
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: opts.decimals ?? 0,
        ...(WHOLE_UNIT.includes(currency) && { maximumFractionDigits: 0 }),
      }).format(value);
    } catch {
      // Intl doesn't recognise the currency code (shouldn't happen with the
      // map above, but never let a formatting error crash a screen)
      return `${currencySymbol}${value.toLocaleString(locale)}`;
    }
  }, [currency, currencySymbol, locale]);

  return (
    <CurrencyContext.Provider value={{ currency, currencySymbol, locale, loading, formatMoney, refreshCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
};