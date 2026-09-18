// admin-web/src/pages/Countries/CountryList.tsx
//
// One screen to run every market: which countries are live, what each one
// charges through, how its drivers get paid, what language its app defaults
// to, and what's currently queued for approval in it.
//
// The two halves are deliberate. The table answers "where do I need to act
// today" (pending payouts, unapproved drivers, unreconciled top-ups). The
// editor answers "how is this market configured". Both live here so an
// admin isn't hopping between Settings and six filtered list pages.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Globe, Plus, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Wallet, Users, Search,
} from 'lucide-react';
import {
  Card, Button, Badge, Modal, Input, Alert, Spinner,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/common';
import {
  countriesAPI, Country, CountryMeta, CountryOverview,
  CreditMethod, PayoutMethod, PaymentProvider,
} from '@/services/api/countries';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { cn } from '@/utils/helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Presentation helpers
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDER_STYLE: Record<PaymentProvider, string> = {
  paystack:    'bg-teal-50 text-teal-700 border-teal-200',
  flutterwave: 'bg-amber-50 text-amber-700 border-amber-200',
  orange:      'bg-orange-50 text-orange-700 border-orange-200',
};

const METHOD_LABEL: Record<CreditMethod, string> = {
  CASH:         'Cash',
  WALLET:       'Wallet',
  PAYSTACK:     'Paystack',
  FLUTTERWAVE:  'Flutterwave',
  ORANGE_MONEY: 'Orange Money',
};

const PAYOUT_LABEL: Record<PayoutMethod, string> = {
  NG_BANK_TRANSFER: 'Bank transfer (NG)',
  BANK_TRANSFER:    'Bank transfer',
  ORANGE_MONEY:     'Orange Money cash-out',
  MANUAL:           'Manual settlement',
  UNSUPPORTED:      'Not supported',
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
];

/** ISO alpha-2 → flag emoji, so we don't ship 20 flag images. */
const flagOf = (code: string) =>
  code.length === 2
    ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)))
    : '🏳️';

// ─────────────────────────────────────────────────────────────────────────────
// Editor
// ─────────────────────────────────────────────────────────────────────────────

interface EditorProps {
  country: Country | null;      // null = creating a new one
  meta: CountryMeta;
  onClose: () => void;
  onSaved: () => void;
}

const blank: Partial<Country> = {
  code: '', name: '', currencyCode: '', currencySymbol: '',
  phoneDialCode: '', languageCode: 'en', isActive: true,
  paymentProviders: ['flutterwave'],
  creditMethods: ['CASH', 'WALLET'],
  payoutMethods: ['MANUAL'],
  providerConfig: {},
};

const CountryEditor: React.FC<EditorProps> = ({ country, meta, onClose, onSaved }) => {
  const isNew = !country;
  const [form, setForm] = useState<Partial<Country>>(country ?? blank);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Country>(key: K, value: Country[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const providers = form.paymentProviders ?? [];
  const credits   = form.creditMethods ?? [];
  const payouts   = form.payoutMethods ?? [];

  // Mirrors the server-side validation in adminCountry.controller so the
  // admin sees the problem while editing rather than on submit.
  const orphanMethods = credits.filter(m => {
    const needed = meta.methodProvider[m];
    return needed && !providers.includes(needed);
  });

  const orangeSelected = credits.includes('ORANGE_MONEY') || payouts.includes('ORANGE_MONEY');
  const orangeBlocked  = orangeSelected && !meta.orangeConfigured;

  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  /**
   * Turning a provider off should take its methods with it — leaving
   * "Paystack" checked under a country with no Paystack provider is the
   * exact mismatch the server rejects.
   */
  const toggleProvider = (p: PaymentProvider) => {
    const next = toggle(providers, p);
    set('paymentProviders', next);
    if (!next.includes(p)) {
      set('creditMethods', credits.filter(m => meta.methodProvider[m] !== p) as CreditMethod[]);
    }
  };

  const save = async () => {
    if (orphanMethods.length) return;
    setSaving(true);
    try {
      if (isNew) {
        await countriesAPI.create(form);
        toast.success(`${form.name} added`);
      } else {
        await countriesAPI.update(country!.code, form);
        toast.success(`${form.name} updated`);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Could not save country');
    } finally {
      setSaving(false);
    }
  };

  const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }> =
    ({ active, onClick, children, disabled }) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'px-3 py-1.5 rounded-full border text-xs font-semibold transition',
          active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400',
          disabled && 'opacity-40 cursor-not-allowed'
        )}
      >
        {children}
      </button>
    );

  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'Add country' : `${flagOf(form.code ?? '')} ${form.name}`} size="lg">
      <div className="space-y-6">
        {/* ── Identity ── */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ISO code"
            value={form.code ?? ''}
            disabled={!isNew}
            maxLength={2}
            onChange={e => set('code', e.target.value.toUpperCase() as any)}
            placeholder="CI"
          />
          <Input label="Name" value={form.name ?? ''} onChange={e => set('name', e.target.value as any)} placeholder="Côte d'Ivoire" />
          <Input label="Currency code" value={form.currencyCode ?? ''} maxLength={3}
                 onChange={e => set('currencyCode', e.target.value.toUpperCase() as any)} placeholder="XOF" />
          <Input label="Currency symbol" value={form.currencySymbol ?? ''}
                 onChange={e => set('currencySymbol', e.target.value as any)} placeholder="CFA" />
          <Input label="Dial code" value={form.phoneDialCode ?? ''}
                 onChange={e => set('phoneDialCode', e.target.value as any)} placeholder="+225" />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Default app language</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.languageCode ?? 'en'}
              onChange={e => set('languageCode', e.target.value as any)}
            >
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              A suggestion only — the app still follows the device language on first
              launch and always respects a language the user picks themselves.
            </p>
          </div>
        </div>

        {/* ── Providers ── */}
        <div>
          <h4 className="text-sm font-semibold text-slate-800 mb-2">Payment providers</h4>
          <div className="flex flex-wrap gap-2">
            {meta.providers.map(p => (
              <Chip key={p} active={providers.includes(p)} onClick={() => toggleProvider(p)}>
                {p === 'orange' ? 'Orange Money' : p[0].toUpperCase() + p.slice(1)}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Order matters: the first provider is treated as this market's primary rail
            and its method is preselected in the app.
          </p>
        </div>

        {/* ── Credit methods ── */}
        <div>
          <h4 className="text-sm font-semibold text-slate-800 mb-2">How customers credit their account</h4>
          <div className="flex flex-wrap gap-2">
            {meta.creditMethods.map(m => (
              <Chip
                key={m}
                active={credits.includes(m)}
                onClick={() => set('creditMethods', toggle(credits, m) as CreditMethod[])}
              >
                {METHOD_LABEL[m]}
              </Chip>
            ))}
          </div>
          {orphanMethods.length > 0 && (
            <Alert variant="error" className="mt-3">
              {orphanMethods.map(m => METHOD_LABEL[m]).join(', ')} need a provider that isn't
              enabled above. Enable the provider or remove the method.
            </Alert>
          )}
        </div>

        {/* ── Payouts ── */}
        <div>
          <h4 className="text-sm font-semibold text-slate-800 mb-2">How drivers &amp; partners get paid</h4>
          <div className="flex flex-wrap gap-2">
            {meta.payoutMethods.map(m => (
              <Chip
                key={m}
                active={payouts.includes(m)}
                onClick={() => set('payoutMethods', toggle(payouts, m) as PayoutMethod[])}
              >
                {PAYOUT_LABEL[m]}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Choosing Orange Money switches the app's withdrawal form from bank details
            to an Orange Money number.
          </p>
        </div>

        {orangeBlocked && (
          <Alert variant="warning">
            <strong>Orange credentials aren't configured on the server.</strong> You can save
            this now, but Orange Money stays hidden in the app until the merchant keys are
            added to the backend environment. Nothing breaks in the meantime — customers
            just see the other methods.
          </Alert>
        )}

        {orangeSelected && meta.orangeConfigured && !meta.orangeB2CEnabled && payouts.includes('ORANGE_MONEY') && (
          <Alert variant="info">
            Orange checkout is live, but automatic cash-out (B2C) is not enabled. Approved
            payouts will stay in <strong>Processing</strong> for manual settlement instead of
            sending automatically.
          </Alert>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || orphanMethods.length > 0}>
            {saving ? 'Saving…' : isNew ? 'Add country' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-country operations drawer
// ─────────────────────────────────────────────────────────────────────────────

const OverviewPanel: React.FC<{ code: string; onClose: () => void }> = ({ code, onClose }) => {
  const [data, setData] = useState<CountryOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    countriesAPI.overview(code)
      .then(res => setData(res.data))
      .catch(() => toast.error('Could not load country overview'))
      .finally(() => setLoading(false));
  }, [code]);

  const Stat: React.FC<{ label: string; value: React.ReactNode; warn?: boolean }> = ({ label, value, warn }) => (
    <div className={cn('rounded-lg border p-3', warn ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white')}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn('text-xl font-bold', warn ? 'text-amber-700' : 'text-slate-900')}>{value}</p>
    </div>
  );

  return (
    <Modal isOpen onClose={onClose} title={`${flagOf(code)} ${data?.country.name ?? code} — operations`} size="lg">
      {loading || !data ? (
        <div className="py-12 flex justify-center"><Spinner /></div>
      ) : (
        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Waiting on you</h4>
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Drivers to approve"   value={data.queues.pendingDrivers}     warn={data.queues.pendingDrivers > 0} />
              <Stat label="Partners to approve"  value={data.queues.pendingPartners}    warn={data.queues.pendingPartners > 0} />
              <Stat label="Payouts to settle"    value={data.queues.pendingPayouts}     warn={data.queues.pendingPayouts > 0} />
              <Stat label="Unreconciled top-ups" value={data.queues.unreconciledTopUps} warn={data.queues.unreconciledTopUps > 0} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Unreconciled top-ups are payments that were started but never confirmed by a
              provider webhook — worth checking if a market's checkout callback is misconfigured.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Live right now</h4>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Active rides"      value={data.live.rides} />
              <Stat label="Active deliveries" value={data.live.deliveries} />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2">People</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.users).map(([role, count]) => (
                <Badge key={role} variant="default">{role.replace('_', ' ')}: {count}</Badge>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Completed payments</h4>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Transactions" value={data.revenue.paymentCount} />
              <Stat label={`Gross (${data.revenue.currency})`}    value={data.revenue.grossVolume.toLocaleString()} />
              <Stat label={`Platform fees (${data.revenue.currency})`} value={data.revenue.platformFees.toLocaleString()} />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

const CountryList: React.FC = () => {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'SUPER_ADMIN';

  const [countries, setCountries] = useState<Country[]>([]);
  const [meta, setMeta] = useState<CountryMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Country | null | undefined>(undefined); // undefined = closed
  const [viewing, setViewing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The config list and the traffic counts come from different queries;
      // merge them so the table has both without a second render pass.
      const [listRes, overviewRes] = await Promise.all([
        countriesAPI.list(),
        countriesAPI.overviewAll(),
      ]);
      const stats = Object.fromEntries(overviewRes.data.countries.map(c => [c.code, c]));
      setCountries(listRes.data.countries.map(c => ({ ...c, ...stats[c.code] })));
      setMeta(listRes.data.meta);
    } catch {
      toast.error('Could not load countries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (c: Country) => {
    try {
      const res = await countriesAPI.setStatus(c.code, !c.isActive);
      toast.success(res.message ?? 'Updated');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Could not update country');
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.currencyCode.toLowerCase().includes(q)
    );
  }, [countries, query]);

  const needsAttention = countries.filter(c => (c.pendingPayouts ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-slate-500" /> Countries
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Payment rails, payout methods and default language for every market you operate in.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          {canEdit && (
            <Button onClick={() => setEditing(null)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add country
            </Button>
          )}
        </div>
      </div>

      {meta && !meta.orangeConfigured && (
        <Alert variant="warning">
          <strong>Orange Money is built but not activated.</strong> Add the Orange merchant
          credentials to the backend environment to switch it on. Until then, Orange stays
          hidden from customers in every market — the other payment methods are unaffected.
        </Alert>
      )}

      {needsAttention > 0 && (
        <Alert variant="info">
          {needsAttention} {needsAttention === 1 ? 'market has' : 'markets have'} payouts waiting
          to be settled. Open a country to see its queue.
        </Alert>
      )}

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, code or currency…"
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {/* ── Table ── */}
      <Card>
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Credit methods</TableHead>
                <TableHead>Payout</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.code} className={cn(!c.isActive && 'opacity-60')}>
                  <TableCell>
                    <button onClick={() => setViewing(c.code)} className="flex items-center gap-2 hover:underline">
                      <span className="text-lg">{flagOf(c.code)}</span>
                      <span className="font-semibold text-slate-900">{c.name}</span>
                      <span className="text-xs text-slate-400">{c.code}</span>
                    </button>
                    <div className="flex gap-1 mt-1">
                      {c.paymentProviders.map(p => (
                        <span key={p} className={cn('px-1.5 py-0.5 rounded border text-[10px] font-semibold', PROVIDER_STYLE[p])}>
                          {p === 'orange' ? 'Orange' : p}
                        </span>
                      ))}
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="font-medium">{c.currencyCode}</span>
                    <span className="text-slate-400 ml-1">{c.currencySymbol}</span>
                  </TableCell>

                  <TableCell className="uppercase text-xs font-semibold text-slate-600">
                    {c.languageCode}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {c.creditMethods.map(m => (
                        <span
                          key={m}
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-medium',
                            m === 'ORANGE_MONEY' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {METHOD_LABEL[m]}
                        </span>
                      ))}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-slate-600">
                    {c.payoutMethods.map(m => PAYOUT_LABEL[m]).join(', ')}
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-slate-700">
                      <Users className="w-3.5 h-3.5 text-slate-400" />{c.userCount ?? 0}
                    </span>
                  </TableCell>

                  <TableCell>
                    {(c.pendingPayouts ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                        <Wallet className="w-3.5 h-3.5" />{c.pendingPayouts}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {c.isActive
                      ? <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Live</Badge>
                      : <Badge variant="default"><XCircle className="w-3 h-3 mr-1" />Paused</Badge>}
                  </TableCell>

                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="secondary" onClick={() => setViewing(c.code)}>View</Button>
                      {canEdit && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>Edit</Button>
                          <Button
                            size="sm"
                            variant={c.isActive ? 'danger' : 'primary'}
                            onClick={() => toggleActive(c)}
                          >
                            {c.isActive ? 'Pause' : 'Activate'}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}

            </TableBody>
          </Table>
        )}

        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
            No countries match that search.
          </div>
        )}
      </Card>

      {editing !== undefined && meta && (
        <CountryEditor
          country={editing}
          meta={meta}
          onClose={() => setEditing(undefined)}
          onSaved={load}
        />
      )}

      {viewing && <OverviewPanel code={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};

export default CountryList;
