// admin-web/src/pages/Countries/CountrySettings.tsx
//
// "Pricing & rules" — everything an admin can tune PER COUNTRY: fares,
// commission, surge, wallet limits, payout/withdrawal rules and bonuses.
//
// Pick a country at the top (Nigeria, Mali, Ghana, …) and every value below
// belongs to that market only. Each field shows where its current value comes
// from, so an admin never has to guess whether a number is theirs or inherited:
//
//   Country   — this country has its own saved value (can be reset)
//   Inherited — falls back to the global Settings value (percentages, flags…)
//   Starter   — auto-generated for a new currency; MUST be reviewed before launch
//   Default   — built-in default, nothing saved anywhere
//
// Changes are staged locally and saved together, so a half-edited rate card
// is never live. The server validates everything and rejects the whole save if
// any one value is wrong.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Globe, Save, RotateCcw, Copy, AlertTriangle, CheckCircle2, ArrowLeftRight, Info, Plus, Trash2,
} from 'lucide-react';
import { Card, Button, Modal, Input, Alert, Spinner } from '@/components/common';
import {
  countriesAPI, Country, CountrySettingField, CountrySettingsPayload, SettingSource,
  SurgeWindow, CompareRow,
} from '@/services/api/countries';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { cn } from '@/utils/helpers';

const flagOf = (code: string) =>
  code.length === 2
    ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)))
    : '🏳️';

const SOURCE_META: Record<SettingSource, { label: string; cls: string; tip: string }> = {
  country: { label: 'Country',   cls: 'bg-emerald-100 text-emerald-700', tip: 'This country has its own saved value.' },
  global:  { label: 'Inherited', cls: 'bg-blue-100 text-blue-700',       tip: 'Using the global Settings value. Edit it here to give this country its own.' },
  starter: { label: 'Starter — review', cls: 'bg-amber-100 text-amber-800', tip: 'Auto-generated for this currency. Not a recommendation — review before going live.' },
  default: { label: 'Default',   cls: 'bg-slate-100 text-slate-600',     tip: 'Built-in default; nothing saved yet.' },
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Fields that are edited as text but stored as numbers/booleans. */
const toInput = (v: any): string =>
  v === null || v === undefined ? '' : String(v);

const parseForType = (f: CountrySettingField, raw: string): any => {
  switch (f.type) {
    case 'money': case 'percent': case 'number': return raw.trim() === '' ? NaN : Number(raw);
    case 'boolean': return raw === 'true';
    default: return raw;
  }
};

const sameValue = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

// ─────────────────────────────────────────────────────────────────────────────
// Surge window editor
// ─────────────────────────────────────────────────────────────────────────────

const SurgeEditor: React.FC<{
  value: SurgeWindow[];
  onChange: (v: SurgeWindow[]) => void;
  disabled: boolean;
}> = ({ value, onChange, disabled }) => {
  const update = (i: number, patch: Partial<SurgeWindow>) =>
    onChange(value.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  const toggleDay = (i: number, d: number) => {
    const days = value[i].days.includes(d) ? value[i].days.filter(x => x !== d) : [...value[i].days, d].sort();
    update(i, { days });
  };

  return (
    <div className="space-y-3">
      {value.map((w, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-3 bg-white">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input label="Name" value={w.label} disabled={disabled} onChange={e => update(i, { label: e.target.value })} />
            </div>
            <div className="w-24">
              <Input label="From (hr)" type="number" min={0} max={24} value={w.hourStart} disabled={disabled}
                     onChange={e => update(i, { hourStart: Number(e.target.value) })} />
            </div>
            <div className="w-24">
              <Input label="To (hr)" type="number" min={0} max={24} value={w.hourEnd} disabled={disabled}
                     onChange={e => update(i, { hourEnd: Number(e.target.value) })} />
            </div>
            <div className="w-24">
              <Input label="Multiplier" type="number" step="0.1" min={1} max={5} value={w.multiplier} disabled={disabled}
                     onChange={e => update(i, { multiplier: Number(e.target.value) })} />
            </div>
            {!disabled && (
              <Button variant="ghost" size="sm" onClick={() => onChange(value.filter((_, idx) => idx !== i))} aria-label="Remove window">
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            )}
          </div>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((d, di) => (
              <button
                key={d}
                type="button"
                disabled={disabled}
                onClick={() => toggleDay(i, di)}
                className={cn(
                  'px-2.5 py-1 rounded-full border text-xs font-semibold transition',
                  w.days.includes(di) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-300',
                  disabled && 'opacity-60 cursor-not-allowed'
                )}
              >{d}</button>
            ))}
          </div>
        </div>
      ))}
      {!disabled && (
        <Button
          variant="outline" size="sm"
          onClick={() => onChange([...value, { label: 'New window', days: [1, 2, 3, 4, 5], hourStart: 7, hourEnd: 9, multiplier: 1.3 }])}
        >
          <Plus className="w-4 h-4 mr-1.5" /> Add window
        </Button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// One field
// ─────────────────────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: CountrySettingField;
  currency: string;
  draft: any;                       // staged value, or undefined if untouched
  staged: 'set' | 'clear' | null;
  disabled: boolean;
  error?: string;
  onChange: (v: any) => void;
  onReset: () => void;
}

const FieldRow: React.FC<FieldRowProps> = ({ field: f, currency, draft, staged, disabled, error, onChange, onReset }) => {
  const shown = staged === 'set' ? draft : f.value;
  const src = SOURCE_META[staged === 'clear' ? 'global' : f.source];
  const unit = f.type === 'money' ? currency : f.type === 'percent' ? '%' : '';

  let control: React.ReactNode;
  if (f.type === 'boolean') {
    control = (
      <select
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        value={String(shown)} disabled={disabled}
        onChange={e => onChange(e.target.value === 'true')}
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  } else if (f.type === 'enum') {
    control = (
      <select
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        value={shown} disabled={disabled}
        onChange={e => onChange(e.target.value)}
      >
        {f.options!.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else if (f.type === 'json') {
    control = <SurgeEditor value={shown as SurgeWindow[]} onChange={onChange} disabled={disabled} />;
  } else if (f.type === 'date') {
    control = (
      <input
        type="date"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        value={String(shown ?? '').slice(0, 10)} disabled={disabled}
        onChange={e => onChange(e.target.value)}
      />
    );
  } else {
    control = (
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={f.min} max={f.max}
          step={f.strictWhole ? 1 : 'any'}
          value={Number.isNaN(shown) ? '' : toInput(shown)}
          disabled={disabled}
          onChange={e => onChange(parseForType(f, e.target.value))}
          className={cn(
            'w-full rounded-lg border px-3 py-2 pr-14 text-sm disabled:bg-slate-50 disabled:text-slate-500',
            error ? 'border-red-400 bg-red-50' : 'border-slate-300'
          )}
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unit}</span>}
      </div>
    );
  }

  return (
    <div className={cn('py-3 grid grid-cols-12 gap-4 items-start', staged && 'bg-amber-50/50 -mx-4 px-4 rounded-lg')}>
      <div className={cn(f.type === 'json' ? 'col-span-12' : 'col-span-5')}>
        <p className="text-sm font-medium text-slate-800">{f.label}</p>
        {f.help && <p className="text-xs text-slate-500 mt-0.5">{f.help}</p>}
      </div>
      <div className={cn(f.type === 'json' ? 'col-span-12' : 'col-span-4')}>
        {control}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      {f.type !== 'json' && (
        <div className="col-span-3 flex items-center gap-2 justify-end">
          <span title={src.tip} className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', src.cls)}>
            {staged === 'clear' ? 'Will inherit' : src.label}
          </span>
          {!disabled && (f.overridden || staged === 'set') && staged !== 'clear' && (
            <button
              type="button" onClick={onReset}
              title={f.overridden ? 'Remove this country’s value and inherit again' : 'Discard change'}
              className="text-slate-400 hover:text-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      {f.type === 'json' && (f.overridden || staged === 'set') && !disabled && (
        <div className="col-span-12 -mt-1">
          <button type="button" onClick={onReset} className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> {f.overridden ? 'Reset to inherited windows' : 'Discard change'}
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Compare view
// ─────────────────────────────────────────────────────────────────────────────

const COMPARE_KEYS = [
  'platform_commission_rides', 'platform_commission_deliveries', 'ride_booking_fee',
  'wallet_topup_min', 'withdrawal_min_earner', 'withdrawal_fee_percent',
  'onboarding_bonus_driver', 'cashback_enabled',
];

const CompareModal: React.FC<{ onClose: () => void; onPick: (code: string) => void }> = ({ onClose, onPick }) => {
  const [data, setData] = useState<{ keys: { key: string; label: string; type: string }[]; countries: CompareRow[] } | null>(null);
  useEffect(() => {
    countriesAPI.compareSettings(COMPARE_KEYS).then(r => setData(r.data)).catch(() => toast.error('Could not load comparison'));
  }, []);

  const show = (row: CompareRow, key: string, type: string) => {
    const v = row.values[key];
    if (type === 'boolean') return v ? 'On' : 'Off';
    if (type === 'percent') return `${v}%`;
    if (type === 'money') return `${Number(v).toLocaleString()} ${row.currency}`;
    return String(v);
  };

  return (
    <Modal isOpen onClose={onClose} title="Compare countries" size="xl">
      {!data ? <div className="py-10 flex justify-center"><Spinner /></div> : (
        <div className="overflow-x-auto -mx-2">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="px-2 py-2 font-medium">Country</th>
                {data.keys.map(k => <th key={k.key} className="px-2 py-2 font-medium whitespace-nowrap">{k.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.countries.map(c => (
                <tr key={c.code} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => { onPick(c.code); onClose(); }}>
                  <td className="px-2 py-2 whitespace-nowrap font-medium">
                    {flagOf(c.code)} {c.name} {!c.isActive && <span className="text-xs text-slate-400">(paused)</span>}
                  </td>
                  {data.keys.map(k => (
                    <td key={k.key} className="px-2 py-2 whitespace-nowrap">
                      <span className={cn(c.sources[k.key] === 'starter' && 'text-amber-700')}>{show(c, k.key, k.type)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 px-2 text-xs text-slate-500">Amber = auto-generated starter value. Click a row to edit that country.</p>
        </div>
      )}
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Copy modal
// ─────────────────────────────────────────────────────────────────────────────

const CopyModal: React.FC<{
  target: CountrySettingsPayload;
  countries: Country[];
  onClose: () => void;
  onDone: (p: CountrySettingsPayload) => void;
}> = ({ target, countries, onClose, onDone }) => {
  const candidates = countries.filter(c => c.code !== target.countryCode);
  const [from, setFrom] = useState(candidates[0]?.code ?? '');
  const [factor, setFactor] = useState('');
  const [busy, setBusy] = useState(false);
  const src = candidates.find(c => c.code === from);
  const differs = !!src && src.currencyCode !== target.currency;

  const run = async () => {
    setBusy(true);
    try {
      const res = await countriesAPI.copySettings(target.countryCode, { fromCode: from, ...(differs && { factor: Number(factor) }) });
      toast.success(res.message ?? 'Copied');
      onDone(res.data);
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not copy');
    } finally { setBusy(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Copy rules into ${target.countryName}`} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Copy from</label>
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={from} onChange={e => setFrom(e.target.value)}>
            {candidates.map(c => <option key={c.code} value={c.code}>{flagOf(c.code)} {c.name} ({c.currencyCode})</option>)}
          </select>
        </div>
        {differs && (
          <>
            <Input
              label={`Exchange rate: 1 ${src!.currencyCode} = ? ${target.currency}`}
              type="number" step="any" min="0" value={factor}
              onChange={e => setFactor(e.target.value)}
              hint="Money amounts are multiplied by this. Percentages, on/off switches and time zones are handled separately. No rate is guessed for you."
            />
          </>
        )}
        <Alert variant="warning">
          This overwrites every rule in {target.countryName} with a copy of {src?.name ?? 'the source'}'s current
          values (except its time zone). You can still edit each value afterwards.
        </Alert>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={run} disabled={busy || !from || (differs && !(Number(factor) > 0))}>
            {busy ? 'Copying…' : 'Copy rules'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

const CountrySettings: React.FC = () => {
  const navigate = useNavigate();
  const { code: codeParam } = useParams<{ code?: string }>();
  const { user } = useAuthStore();
  const canEdit = user?.role === 'SUPER_ADMIN';

  const [countries, setCountries] = useState<Country[]>([]);
  const [code, setCode] = useState<string>((codeParam ?? 'NG').toUpperCase());
  const [data, setData] = useState<CountrySettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<string>('ride_pricing');
  // staged edits: key → new value, or null meaning "remove override"
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCopy, setShowCopy] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    countriesAPI.list().then(r => setCountries(r.data.countries)).catch(() => toast.error('Could not load countries'));
  }, []);

  const load = useCallback(async (c: string) => {
    setLoading(true);
    try {
      const res = await countriesAPI.getSettings(c);
      setData(res.data);
      setDraft({});
      setErrors({});
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not load this country');
      setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(code); }, [code, load]);

  const switchCountry = (next: string) => {
    if (Object.keys(draft).length && !window.confirm('You have unsaved changes for this country. Discard them?')) return;
    setCode(next);
    navigate(`/country-settings/${next}`, { replace: true });
  };

  const byKey = useMemo(() => Object.fromEntries((data?.settings ?? []).map(s => [s.key, s])), [data]);
  const country = countries.find(c => c.code === code);
  const dirtyKeys = Object.keys(draft);

  const stage = (f: CountrySettingField, v: any) => {
    setDraft(prev => {
      const next = { ...prev };
      // Editing back to the value already saved for this country = no change.
      if (f.overridden && sameValue(v, f.value)) delete next[f.key];
      else next[f.key] = v;
      return next;
    });
    setErrors(prev => { const n = { ...prev }; delete n[f.key]; return n; });
  };

  const reset = (f: CountrySettingField) => {
    if (draft[f.key] !== undefined && draft[f.key] !== null) {
      // discard staged edit
      setDraft(prev => { const n = { ...prev }; delete n[f.key]; return n; });
    } else if (f.overridden) {
      setDraft(prev => ({ ...prev, [f.key]: null }));   // stage "inherit again"
    }
  };

  // Light client-side check so obvious typos are caught before a round trip.
  // The server remains the authority and re-validates everything.
  const validateDraft = (): boolean => {
    const errs: Record<string, string> = {};
    for (const [key, v] of Object.entries(draft)) {
      if (v === null) continue;
      const f = byKey[key];
      if (!f) continue;
      if (['money', 'percent', 'number'].includes(f.type)) {
        if (typeof v !== 'number' || Number.isNaN(v)) { errs[key] = 'Enter a number'; continue; }
        if (f.min !== undefined && v < f.min) errs[key] = `At least ${f.min}`;
        else if (f.max !== undefined && v > f.max) errs[key] = `At most ${f.max}`;
        else if (f.strictWhole && ['XOF', 'XAF', 'GNF', 'MGA', 'CDF'].includes(data!.currency) && !Number.isInteger(v))
          errs[key] = `${data!.currency} has no decimals`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!validateDraft()) { toast.error('Fix the highlighted fields first'); return; }
    setSaving(true);
    try {
      const res = await countriesAPI.saveSettings(code, draft);
      toast.success(res.message ?? 'Saved');
      setData(res.data);
      setDraft({});
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not save');
    } finally { setSaving(false); }
  };

  const markReviewed = async () => {
    try {
      await countriesAPI.markPricingReviewed(code);
      toast.success('Marked as reviewed');
      load(code);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed'); }
  };

  const fieldsInTab = (data?.settings ?? []).filter(s => s.group === tab);
  const starterCount = (data?.settings ?? []).filter(s => s.source === 'starter').length;
  const tabDirty = (gid: string) => dirtyKeys.some(k => byKey[k]?.group === gid);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-slate-500" /> Pricing &amp; rules by country
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Commission, fares, surge, wallet limits, payouts and bonuses — set separately for each market.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Country</label>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium min-w-[220px]"
              value={code}
              onChange={e => switchCountry(e.target.value)}
            >
              {countries.map(c => (
                <option key={c.code} value={c.code}>
                  {flagOf(c.code)} {c.name} — {c.currencyCode}{c.isActive ? '' : ' (paused)'}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" onClick={() => setShowCompare(true)}>
            <ArrowLeftRight className="w-4 h-4 mr-1.5" /> Compare
          </Button>
          {canEdit && (
            <Button variant="outline" onClick={() => setShowCopy(true)} disabled={!data}>
              <Copy className="w-4 h-4 mr-1.5" /> Copy from…
            </Button>
          )}
        </div>
      </div>

      {!canEdit && (
        <Alert variant="info">You can view these rules. Only a Super Admin can change them.</Alert>
      )}

      {data && !data.pricingReviewed && (
        <Alert variant="warning" title={`${data.countryName} is still on auto-generated starter prices`}>
          <p>
            {starterCount} price values were generated from {data.baseCurrency} using a rough exchange rate. They are a
            safety net, not a recommendation — cost of living and local competition matter more than the exchange rate.
            Review the <strong>Ride pricing</strong> and <strong>Delivery pricing</strong> tabs and save, and this notice
            clears. {country && !country.isActive && 'The country cannot go live until then (unless you confirm on the Countries page).'}
          </p>
          {canEdit && (
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={markReviewed}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> I've reviewed these prices as they are
              </Button>
            </div>
          )}
        </Alert>
      )}

      {loading ? (
        <div className="py-20 flex justify-center"><Spinner /></div>
      ) : !data ? (
        <Card><div className="py-12 text-center text-slate-400"><AlertTriangle className="w-5 h-5 mx-auto mb-2" />Could not load this country.</div></Card>
      ) : (
        <>
          {/* ── Currency banner ── */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Info className="w-4 h-4 text-slate-400" />
            All amounts on this page are in <strong>{data.currency}</strong>.
            {['XOF', 'XAF', 'GNF', 'MGA', 'CDF'].includes(data.currency) && ' This currency has no decimals — payout and wallet amounts must be whole numbers.'}
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
            {data.groups.map(g => (
              <button
                key={g.id}
                onClick={() => setTab(g.id)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition',
                  tab === g.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
                )}
              >
                {g.label}
                {tabDirty(g.id) && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-500 align-middle" />}
              </button>
            ))}
          </div>

          {/* ── Fields ── */}
          <Card>
            <div className="divide-y divide-slate-100 px-4">
              {fieldsInTab.map(f => {
                const staged: 'set' | 'clear' | null =
                  draft[f.key] === null ? 'clear' : draft[f.key] !== undefined ? 'set' : null;
                return (
                  <FieldRow
                    key={f.key}
                    field={f}
                    currency={data.currency}
                    draft={draft[f.key]}
                    staged={staged}
                    disabled={!canEdit}
                    error={errors[f.key]}
                    onChange={v => stage(f, v)}
                    onReset={() => reset(f)}
                  />
                );
              })}
            </div>
          </Card>

          {tab === 'commission' && (
            <p className="text-xs text-slate-500">
              Commission is taken from the fare <em>excluding</em> the booking fee. Changes apply to rides and deliveries
              requested after you save; trips already in progress keep the rate they were quoted.
            </p>
          )}
          {tab === 'payouts' && (
            <p className="text-xs text-slate-500">
              The fee is deducted from what the person receives: they are debited the full amount and the payout is for
              amount minus fee. A rejected withdrawal refunds the full amount.
            </p>
          )}

          {/* ── Sticky save bar ── */}
          {dirtyKeys.length > 0 && (
            <div className="sticky bottom-4 z-10">
              <div className="rounded-xl border border-amber-300 bg-white shadow-lg px-5 py-3 flex items-center justify-between">
                <div className="text-sm">
                  <strong>{dirtyKeys.length}</strong> unsaved change{dirtyKeys.length === 1 ? '' : 's'} for <strong>{data.countryName}</strong>
                  <span className="text-slate-500"> — affects {data.countryName} only</span>
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => { setDraft({}); setErrors({}); }}>Discard</Button>
                  <Button onClick={save} disabled={saving}>
                    <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showCopy && data && (
        <CopyModal target={data} countries={countries} onClose={() => setShowCopy(false)} onDone={p => { setData(p); setDraft({}); }} />
      )}
      {showCompare && <CompareModal onClose={() => setShowCompare(false)} onPick={switchCountry} />}
    </div>
  );
};

export default CountrySettings;
