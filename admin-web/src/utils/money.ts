// admin-web/src/utils/money.ts
//
// Single place the admin formats money. Every amount in this app belongs to a
// currency (Payment.currency, Wallet.currency, Payout.currency, Ride.currency…)
// — never assume Naira. Pass the record's own currency.

export const BASE_CURRENCY = 'NGN';

// No usable minor unit — mobile-money rails (Orange, MTN…) reject decimals.
const WHOLE_UNIT = new Set(['XOF', 'XAF', 'GNF', 'MGA', 'CDF']);

// Used only if Intl doesn't know the code (e.g. an older browser and SLE).
const FALLBACK_SYMBOL: Record<string, string> = {
  NGN: '₦', GHS: '₵', XOF: 'CFA', XAF: 'FCFA', GMD: 'D', GNF: 'FG', SLE: 'Le',
  LRD: 'L$', CVE: '$', MGA: 'Ar', CDF: 'FC', BWP: 'P',
};

export const isWholeUnitCurrency = (currency?: string | null): boolean =>
  WHOLE_UNIT.has(String(currency ?? '').toUpperCase());

export interface MoneyOptions {
  /** Force a fixed number of decimals (e.g. 2 on a receipt). Whole-unit currencies are always 0. */
  decimals?: number;
}

/**
 * formatMoney(5000, 'NGN') → "₦5,000"
 * formatMoney(5000, 'XOF') → "CFA 5,000"
 * formatMoney(12.5, 'GHS') → "₵12.50"   (ask for { decimals: 2 })
 * Never throws: an unknown currency code still renders as "123 XYZ".
 */
export const formatMoney = (
  amount: number | null | undefined,
  currency?: string | null,
  opts: MoneyOptions = {},
): string => {
  const n   = Number(amount ?? 0);
  const cur = String(currency || BASE_CURRENCY).toUpperCase();
  const whole = isWholeUnitCurrency(cur);
  const min = whole ? 0 : (opts.decimals ?? 0);
  const max = whole ? 0 : (opts.decimals ?? 2);
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: cur,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    }).format(n);
  } catch {
    const sym = FALLBACK_SYMBOL[cur];
    const num = n.toLocaleString('en', { minimumFractionDigits: min, maximumFractionDigits: max });
    return sym ? `${sym}${num}` : `${num} ${cur}`;
  }
};

/** Just the symbol/code, for input prefixes: moneySymbol('XOF') → "CFA". */
export const moneySymbol = (currency?: string | null): string => {
  const cur = String(currency || BASE_CURRENCY).toUpperCase();
  try {
    const part = new Intl.NumberFormat('en', { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find(p => p.type === 'currency');
    return part?.value ?? FALLBACK_SYMBOL[cur] ?? cur;
  } catch {
    return FALLBACK_SYMBOL[cur] ?? cur;
  }
};

/** Preferred tab order: NGN first (the base market), the rest alphabetical. */
export const sortCurrencies = (codes: string[]): string[] =>
  [...codes].sort((a, b) =>
    a === BASE_CURRENCY ? -1 : b === BASE_CURRENCY ? 1 : a.localeCompare(b));
