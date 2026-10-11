// admin-web/src/components/CountryFilter.tsx
// Shared country ("market") controls for the ops pages: drivers, partners, rides, deliveries
// and their approval queues.
import React, { useEffect, useState } from 'react';
import { Select } from '@/components/common';
import { countriesAPI } from '@/services/api/countries';
import { flagOf } from '@/utils/supportLanguages';

export interface CountryOption { code: string; name: string; lat?: number; lng?: number }

// One fetch per page load, shared by every control on the screen.
let cache: Promise<CountryOption[]> | null = null;
const loadCountries = (): Promise<CountryOption[]> => {
  if (!cache) {
    cache = countriesAPI.list()
      .then(res => (res.data.countries || []).map(c => {
        const lat = Number(c.mapCenterLat), lng = Number(c.mapCenterLng);
        return { code: String(c.code).toUpperCase(), name: c.name,
          lat: Number.isFinite(lat) && c.mapCenterLat != null ? lat : undefined,
          lng: Number.isFinite(lng) && c.mapCenterLng != null ? lng : undefined };
      }))
      .catch(() => { cache = null; return []; });
  }
  return cache;
};

export const useCountries = (): CountryOption[] => {
  const [list, setList] = useState<CountryOption[]>([]);
  useEffect(() => { let on = true; loadCountries().then(l => { if (on) setList(l); }); return () => { on = false; }; }, []);
  return list;
};

/** Dropdown: "All countries" + every configured country. */
export const CountrySelect: React.FC<{
  value: string;
  onChange: (code: string) => void;
  className?: string;
  /** Label for the empty option; pass null to force picking one country. */
  allLabel?: string | null;
}> = ({ value, onChange, className, allLabel = 'All countries' }) => {
  const countries = useCountries();
  return (
    <Select
      className={className}
      value={value}
      onChange={e => onChange(e.target.value)}
      options={[
        ...(allLabel === null || countries.length === 1 ? [] : [{ value: '', label: allLabel }]),
        ...countries.map(c => ({ value: c.code, label: `${flagOf(c.code)} ${c.name}` })),
      ]}
    />
  );
};

/** Flag + code, for table cells and cards. */
export const CountryTag: React.FC<{ code?: string | null; className?: string }> = ({ code, className = '' }) => (
  <span className={`inline-flex items-center gap-1 text-xs font-medium text-gray-700 whitespace-nowrap ${className}`}>
    <span>{flagOf(code)}</span>{code ? String(code).toUpperCase() : '—'}
  </span>
);

/** Pending-queue chips with per-country counts. `counts` is { NG: 3, ML: 2 }. */
export const CountryChips: React.FC<{
  counts: Record<string, number>;
  value: string;
  onChange: (code: string) => void;
}> = ({ counts, value, onChange }) => {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const total = entries.reduce((n, [, v]) => n + v, 0);
  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
      active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={chip(value === '')} onClick={() => onChange('')}>All ({total})</button>
      {entries.map(([code, n]) => (
        <button key={code} className={chip(value === code)} onClick={() => onChange(code)}>
          {flagOf(code)} {code} ({n})
        </button>
      ))}
    </div>
  );
};
