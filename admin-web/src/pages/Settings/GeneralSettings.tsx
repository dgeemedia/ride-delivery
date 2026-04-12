// admin-web/src/pages/Settings/GeneralSettings.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Save, Lock, DollarSign, Settings, Eye, EyeOff, Gift,
  Bell, Zap, ShieldAlert, ClipboardList,
  RefreshCw, ToggleLeft, ToggleRight, Search, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, Input, Button, Alert } from '@/components/common';
import { settingsAPI } from '@/services/api/settings';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import api from '@/services/api';

// ── Pricing defaults — must stay in sync with FALLBACK_RATES in fareEngine.js ──
const PRICING_DEFAULTS = {
  ride_base_fare_car:             '500',
  ride_per_km_car:                '130',
  ride_per_minute_car:            '15',
  ride_minimum_fare_car:          '500',
  ride_cancellation_fee_car:      '200',

  ride_base_fare_bike:            '200',
  ride_per_km_bike:               '80',
  ride_per_minute_bike:           '8',
  ride_minimum_fare_bike:         '250',
  ride_cancellation_fee_bike:     '100',

  ride_base_fare_van:             '800',
  ride_per_km_van:                '180',
  ride_per_minute_van:            '20',
  ride_minimum_fare_van:          '1000',
  ride_cancellation_fee_van:      '300',

  ride_base_fare_tricycle:        '300',
  ride_per_km_tricycle:           '100',
  ride_per_minute_tricycle:       '10',
  ride_minimum_fare_tricycle:     '300',
  ride_cancellation_fee_tricycle: '150',

  ride_booking_fee:               '100',
  platform_commission_rides:      '20',   // whole % — fareEngine divides by 100

  delivery_base_fee:              '500',
  delivery_per_km:                '80',
  delivery_weight_fee_per_kg:     '50',
  platform_commission_deliveries: '15',   // whole % — fareEngine divides by 100
};

// ── Default surge windows — stored as JSON in SystemSettings('surge_windows') ──
const DEFAULT_SURGE_WINDOWS = [
  { label: 'Morning Rush',  days: [1,2,3,4,5],       hourStart: 6,  hourEnd: 9,  multiplier: 1.4 },
  { label: 'Evening Rush',  days: [1,2,3,4,5],       hourStart: 16, hourEnd: 20, multiplier: 1.5 },
  { label: 'Friday Night',  days: [5],               hourStart: 18, hourEnd: 23, multiplier: 1.6 },
  { label: 'Late Night',    days: [0,1,2,3,4,5,6],   hourStart: 23, hourEnd: 24, multiplier: 1.3 },
  { label: 'Early Morning', days: [0,1,2,3,4,5,6],   hourStart: 0,  hourEnd: 5,  multiplier: 1.3 },
  { label: 'Weekend Day',   days: [0,6],              hourStart: 10, hourEnd: 20, multiplier: 1.2 },
];

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Password strength scorer (0–5, no deps) ──────────────────────────────────
const getPasswordStrength = (pw: string) => {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)           score++;
  if (pw.length >= 12)          score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;
  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-500'    };
  if (score === 2) return { score, label: 'Fair',   color: 'bg-orange-400' };
  if (score === 3) return { score, label: 'Good',   color: 'bg-yellow-400' };
  return               { score, label: 'Strong', color: 'bg-green-500'  };
};

// ── Section wrapper — `locked` is visual only, backend auth is the real gate ──
const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  locked?: boolean;
}> = ({ icon, title, subtitle, children, locked = false }) => (
  <Card>
    <div className="flex items-start gap-3 mb-6 pb-4 border-b border-gray-100">
      <span className="p-2 rounded-lg bg-primary-50 text-primary-600 mt-0.5">{icon}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {locked && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Lock className="h-3 w-3" />Super Admin only
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className={locked ? 'opacity-40 pointer-events-none select-none' : ''}>
      {children}
    </div>
  </Card>
);

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD SECTION
// Calls PUT /users/password. Includes a strength meter with no external deps.
// ─────────────────────────────────────────────────────────────────────────────
const PasswordSection: React.FC = () => {
  const [form, setForm]     = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow]     = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const strength = getPasswordStrength(form.newPassword);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    if (form.newPassword !== form.confirmPassword) { setError('New passwords do not match.'); return; }
    if (form.newPassword.length < 8)               { setError('Minimum 8 characters required.'); return; }
    setLoading(true);
    try {
      await api.put('/users/password', {
        currentPassword: form.currentPassword,
        newPassword:     form.newPassword,
      });
      toast.success('Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to change password');
    } finally { setLoading(false); }
  };

  const ToggleEye = ({ field }: { field: 'current' | 'next' | 'confirm' }) => (
    <button type="button" onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))}
      className="text-gray-400 hover:text-gray-600 transition-colors">
      {show[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <Section icon={<Lock className="h-4 w-4" />} title="Change Password" subtitle="Update your account password">
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      <div className="space-y-4 max-w-md">
        <div className="relative">
          <Input label="Current Password" name="currentPassword"
            type={show.current ? 'text' : 'password'} value={form.currentPassword} onChange={handleChange} />
          <span className="absolute right-3 top-[34px]"><ToggleEye field="current" /></span>
        </div>

        <div className="relative">
          <Input label="New Password" name="newPassword"
            type={show.next ? 'text' : 'password'} value={form.newPassword}
            onChange={handleChange} hint="Minimum 8 characters" />
          <span className="absolute right-3 top-[34px]"><ToggleEye field="next" /></span>
          {form.newPassword && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors
                    ${i <= strength.score ? strength.color : 'bg-gray-200'}`} />
                ))}
              </div>
              <p className={`text-xs font-medium ${
                strength.score <= 1 ? 'text-red-500'    :
                strength.score === 2 ? 'text-orange-400' :
                strength.score === 3 ? 'text-yellow-500' : 'text-green-600'
              }`}>{strength.label}</p>
            </div>
          )}
        </div>

        <div className="relative">
          <Input label="Confirm New Password" name="confirmPassword"
            type={show.confirm ? 'text' : 'password'} value={form.confirmPassword} onChange={handleChange} />
          <span className="absolute right-3 top-[34px]"><ToggleEye field="confirm" /></span>
        </div>

        <Button loading={loading} onClick={handleSubmit}>
          <Save className="h-4 w-4" />Update Password
        </Button>
      </div>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM SECTION
// Saves platform_name, support_email, support_phone, platform_logo,
// and maintenance_mode to SystemSettings.
// ─────────────────────────────────────────────────────────────────────────────
const PlatformSection: React.FC = () => {
  const [form, setForm] = useState({
    name: 'Diakite',
    supportEmail: 'support@diakite.com',
    supportPhone: '+2348000000000',
    logoUrl: '',
    maintenance: false,
    maintenanceMessage: '',
    maintenanceStartsAt: '',  // ISO datetime-local string
    maintenanceEndsAt: '',    // ISO datetime-local string
  });
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    settingsAPI.getSettings('platform')
      .then(res => {
        const s = res.data?.settings ?? {};
        setForm(f => ({
          ...f,
          name:               s['platform_name']?.value        ?? f.name,
          supportEmail:       s['support_email']?.value        ?? f.supportEmail,
          supportPhone:       s['support_phone']?.value        ?? f.supportPhone,
          logoUrl:            s['platform_logo']?.value        ?? '',
          maintenance:        s['maintenance_mode']?.value === true
                           || s['maintenance_mode']?.value === 'true',
          maintenanceMessage: s['maintenance_message']?.value  ?? '',
          // Convert stored ISO → datetime-local format (strip seconds+Z)
          maintenanceStartsAt: s['maintenance_starts_at']?.value
            ? new Date(s['maintenance_starts_at'].value).toISOString().slice(0,16)
            : '',
          maintenanceEndsAt: s['maintenance_ends_at']?.value
            ? new Date(s['maintenance_ends_at'].value).toISOString().slice(0,16)
            : '',
        }));
      })
      .catch(() => toast.error('Could not load platform settings.'))
      .finally(() => setFetching(false));
  }, []);

  // Auto-expire the toggle in the UI when endsAt passes
  useEffect(() => {
    if (!form.maintenance || !form.maintenanceEndsAt) return;

    const endsAt = new Date(form.maintenanceEndsAt);
    const msUntilExpiry = endsAt.getTime() - Date.now();
    if (msUntilExpiry <= 0) {
      setForm(f => ({ ...f, maintenance: false }));
      return;
    }

    const timer = setTimeout(() => {
      setForm(f => ({ ...f, maintenance: false }));
      toast.success('Maintenance window has expired — toggle turned off automatically');
    }, msUntilExpiry);

    return () => clearTimeout(timer);
  }, [form.maintenance, form.maintenanceEndsAt]);

  const handleSave = async () => {
    // Validate: if both are set, end must be after start
    if (form.maintenanceStartsAt && form.maintenanceEndsAt) {
      if (new Date(form.maintenanceEndsAt) <= new Date(form.maintenanceStartsAt)) {
        toast.error('End time must be after start time');
        return;
      }
    }
    setLoading(true);
    try {
      await Promise.all([
        settingsAPI.updateSetting('platform_name',    form.name),
        settingsAPI.updateSetting('support_email',    form.supportEmail),
        settingsAPI.updateSetting('support_phone',    form.supportPhone),
        settingsAPI.updateSetting('platform_logo',    form.logoUrl),
        settingsAPI.updateSetting('maintenance_mode', String(form.maintenance)),
        settingsAPI.updateSetting('maintenance_message', form.maintenanceMessage),
        settingsAPI.updateSetting('maintenance_starts_at',
          form.maintenanceStartsAt ? new Date(form.maintenanceStartsAt).toISOString() : ''),
        settingsAPI.updateSetting('maintenance_ends_at',
          form.maintenanceEndsAt ? new Date(form.maintenanceEndsAt).toISOString() : ''),
      ]);
      toast.success('Platform settings saved');
    } catch { toast.error('Failed to save settings'); }
    finally   { setLoading(false); }
  };

  // Derive a human-readable status line
  const statusLabel = (() => {
    if (!form.maintenance) return null;
    const now = new Date();
    const starts = form.maintenanceStartsAt ? new Date(form.maintenanceStartsAt) : null;
    const ends   = form.maintenanceEndsAt   ? new Date(form.maintenanceEndsAt)   : null;
    if (starts && starts > now) return `Scheduled — starts ${starts.toLocaleString('en-NG')}`;
    if (ends)                   return `Active — ends ${ends.toLocaleString('en-NG')}`;
    return 'Active — no end time set (manual off required)';
  })();

  return (
    <Section icon={<Settings className="h-4 w-4" />}
      title="Platform Settings" subtitle="Identity, contact info, and operational state">
      {fetching && <p className="text-xs text-gray-400 mb-4 animate-pulse">Loading…</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <Input label="Platform Name"  value={form.name}         disabled={fetching}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Support Email"  value={form.supportEmail} disabled={fetching} type="email"
          onChange={e => setForm(f => ({ ...f, supportEmail: e.target.value }))} />
        <Input label="Support Phone"  value={form.supportPhone} disabled={fetching}
          onChange={e => setForm(f => ({ ...f, supportPhone: e.target.value }))} />
        <Input label="Logo URL (CDN)" value={form.logoUrl}      disabled={fetching}
          hint="Paste a publicly accessible image URL"
          onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))} />
      </div>

      {form.logoUrl && (
        <div className="mt-3 flex items-center gap-3">
          <img src={form.logoUrl} alt="Logo preview"
            className="h-10 w-auto rounded border border-gray-200 object-contain"
            onError={e => (e.currentTarget.style.display = 'none')} />
          <span className="text-xs text-gray-500">Logo preview</span>
        </div>
      )}

      {/* ── Maintenance block ── */}
      <div className="mt-5 max-w-2xl border border-orange-200 bg-orange-50 rounded-lg p-4 space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Maintenance Mode</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Returns 503 on all customer/driver routes. Admin routes stay live.
            </p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, maintenance: !f.maintenance }))}
            className={`flex items-center gap-2 text-sm font-medium transition-colors
              ${form.maintenance ? 'text-orange-600' : 'text-gray-400'}`}
          >
            {form.maintenance
              ? <><ToggleRight className="h-8 w-8" /><span>ON</span></>
              : <><ToggleLeft  className="h-8 w-8" /><span>OFF</span></>}
          </button>
        </div>

        {/* Status pill */}
        {statusLabel && (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold
            bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            {statusLabel}
          </div>
        )}

        {/* Fields — always visible when maintenance is toggled on */}
        {form.maintenance && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Message shown to users
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-orange-300 text-sm
                  focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                placeholder="e.g. Scheduled maintenance from 2:00 AM – 5:00 AM WAT. We apologise for the inconvenience."
                value={form.maintenanceMessage}
                onChange={e => setForm(f => ({ ...f, maintenanceMessage: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Start date &amp; time <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.maintenanceStartsAt}
                  onChange={e => setForm(f => ({ ...f, maintenanceStartsAt: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-orange-300 text-sm
                    focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
                <p className="text-xs text-gray-400 mt-1">
                  If set, users see a warning banner before this time but can still use the app.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  End date &amp; time <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.maintenanceEndsAt}
                  onChange={e => setForm(f => ({ ...f, maintenanceEndsAt: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-orange-300 text-sm
                    focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Maintenance auto-expires at this time. Leave blank for manual off.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5">
        <Button loading={loading || fetching} onClick={handleSave}>
          <Save className="h-4 w-4" />Save Changes
        </Button>
      </div>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PRICING SECTION
// Full vehicle coverage: Car, Bike/Motorcycle, Van, Tricycle + Deliveries.
// Changes are live on the next fare request — no server restart needed.
// ─────────────────────────────────────────────────────────────────────────────
type PricingState = typeof PRICING_DEFAULTS;

const PricingSection: React.FC = () => {
  const [values,   setValues]   = useState<PricingState>({ ...PRICING_DEFAULTS });
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    settingsAPI.getSettings()
      .then(res => {
        const s = res.data?.settings ?? {};
        setValues(prev => ({
          ...prev,
          ...Object.fromEntries(
            (Object.keys(PRICING_DEFAULTS) as (keyof PricingState)[])
              .filter(k => s[k]?.value !== undefined)
              .map(k => [k, String(s[k].value)])
          ),
        }));
      })
      .catch(() => toast.error('Could not load saved pricing — showing defaults.'))
      .finally(() => setFetching(false));
  }, []);

  const set = (key: keyof PricingState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues(v => ({ ...v, [key]: e.target.value }));

  const handleSave = async () => {
    setLoading(true);
    try {
      await Promise.all(
        (Object.keys(PRICING_DEFAULTS) as (keyof PricingState)[])
          .map(key => settingsAPI.updateSetting(key, values[key]))
      );
      toast.success('Pricing saved — live on next fare request');
    } catch { toast.error('Failed to save pricing'); }
    finally   { setLoading(false); }
  };

  const Field = ({ label, k, prefix = '₦' }: { label: string; k: keyof PricingState; prefix?: string }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">{prefix}</span>
        <input type="number" value={values[k]} onChange={set(k)} disabled={fetching}
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900
            focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white
            hover:border-gray-400 disabled:opacity-50 disabled:cursor-wait" />
      </div>
    </div>
  );

  const VehicleBlock = ({ label, prefix }: { label: string; prefix: 'car' | 'bike' | 'van' | 'tricycle' }) => (
    <>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 mt-4 col-span-full">
        {label}
      </p>
      <Field label="Base Fare"        k={`ride_base_fare_${prefix}`        as keyof PricingState} />
      <Field label="Per KM"           k={`ride_per_km_${prefix}`           as keyof PricingState} />
      <Field label="Per Minute"       k={`ride_per_minute_${prefix}`       as keyof PricingState} />
      <Field label="Minimum Fare"     k={`ride_minimum_fare_${prefix}`     as keyof PricingState} />
      <Field label="Cancellation Fee" k={`ride_cancellation_fee_${prefix}` as keyof PricingState} />
    </>
  );

  return (
    <Section icon={<DollarSign className="h-4 w-4" />}
      title="Pricing Configuration (NGN)"
      subtitle="Changes take effect on the next fare request — no server restart needed">
      {fetching && <p className="text-xs text-gray-400 mb-4 animate-pulse">Loading current values…</p>}

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Rides</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-2">
        <VehicleBlock label="Car"              prefix="car"      />
        <VehicleBlock label="Bike / Motorcycle" prefix="bike"    />
        <VehicleBlock label="Van"              prefix="van"      />
        <VehicleBlock label="Tricycle"         prefix="tricycle" />
      </div>

      {/* Shared — bikes 0.5×, vans 1.5×, tricycles 0.75× booking fee in fareEngine */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 col-span-full">
          Shared — applies to all vehicle types
        </p>
        <Field label="Booking Fee (flat)"  k="ride_booking_fee" />
        <Field label="Platform Commission" k="platform_commission_rides" prefix="%" />
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Deliveries</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Field label="Base Fee"            k="delivery_base_fee" />
        <Field label="Per KM"              k="delivery_per_km" />
        <Field label="Weight Fee / KG"     k="delivery_weight_fee_per_kg" />
        <Field label="Platform Commission" k="platform_commission_deliveries" prefix="%" />
      </div>

      <Button loading={loading || fetching} onClick={handleSave}>
        <Save className="h-4 w-4" />Update Pricing
      </Button>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SURGE SECTION
// Windows stored as JSON in SystemSettings('surge_windows').
// fareEngine.js reads this key in _loadFromDB() instead of using a hardcoded array.
// ─────────────────────────────────────────────────────────────────────────────
type SurgeWindow = { label: string; days: number[]; hourStart: number; hourEnd: number; multiplier: number };

const SurgeSection: React.FC = () => {
  const [windows,  setWindows]  = useState<SurgeWindow[]>(DEFAULT_SURGE_WINDOWS);
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    settingsAPI.getSettings('surge')
      .then(res => {
        const val = res.data?.settings?.['surge_windows']?.value;
        if (val) {
          try { setWindows(typeof val === 'string' ? JSON.parse(val) : val); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await settingsAPI.updateSetting('surge_windows', JSON.stringify(windows));
      toast.success('Surge windows saved — live on next fare request');
    } catch { toast.error('Failed to save surge config'); }
    finally   { setLoading(false); }
  };

  const update = (i: number, field: keyof SurgeWindow, val: any) =>
    setWindows(ws => ws.map((w, idx) => idx === i ? { ...w, [field]: val } : w));

  const toggleDay = (i: number, day: number) =>
    setWindows(ws => ws.map((w, idx) => idx !== i ? w : {
      ...w,
      days: w.days.includes(day)
        ? w.days.filter(d => d !== day)
        : [...w.days, day].sort(),
    }));

  return (
    <Section icon={<Zap className="h-4 w-4" />}
      title="Surge Pricing Windows"
      subtitle="Configure when dynamic pricing applies — stored in DB, no deployment needed">
      {fetching && <p className="text-xs text-gray-400 mb-4 animate-pulse">Loading…</p>}

      <div className="space-y-2">
        {windows.map((w, i) => (
          <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
              onClick={() => setExpanded(expanded === i ? null : i)}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-800">{w.label || 'Unnamed'}</span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                  {w.multiplier}×
                </span>
                <span className="text-xs text-gray-500">
                  {w.hourStart}:00–{w.hourEnd}:00 · {w.days.map(d => DAY_LABELS[d]).join(', ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); setWindows(ws => ws.filter((_, idx) => idx !== i)); }}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1">Remove</button>
                {expanded === i
                  ? <ChevronUp className="h-4 w-4 text-gray-400" />
                  : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>
            </div>

            {expanded === i && (
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    value={w.label} onChange={e => update(i, 'label', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start Hour (0–23)</label>
                  <input type="number" min={0} max={23}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    value={w.hourStart} onChange={e => update(i, 'hourStart', parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End Hour (1–24)</label>
                  <input type="number" min={1} max={24}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    value={w.hourEnd} onChange={e => update(i, 'hourEnd', parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Multiplier</label>
                  <input type="number" step={0.1} min={1} max={5}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    value={w.multiplier} onChange={e => update(i, 'multiplier', parseFloat(e.target.value))} />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <label className="block text-xs font-medium text-gray-500 mb-2">Active Days</label>
                  <div className="flex gap-2">
                    {DAY_LABELS.map((d, dayIdx) => (
                      <button key={d} onClick={() => toggleDay(i, dayIdx)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          w.days.includes(dayIdx)
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={() => setWindows(ws => [
          ...ws,
          { label: 'New Window', days: [1,2,3,4,5], hourStart: 8, hourEnd: 10, multiplier: 1.2 },
        ])} className="text-sm text-primary-500 hover:text-primary-600 font-medium">
          + Add window
        </button>
        <Button loading={loading || fetching} onClick={handleSave}>
          <Save className="h-4 w-4" />Save Surge Config
        </Button>
      </div>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS SECTION
// Quiet hours and broadcast cap stored in SystemSettings.
// notification.service.js must read these before dispatching broadcasts.
// Transactional notifications (ride accepted, payment, etc.) bypass quiet hours.
// ─────────────────────────────────────────────────────────────────────────────
const NotificationsSection: React.FC = () => {
  const [form, setForm]     = useState({ quietStart: '23', quietEnd: '7', maxPerDay: '3' });
  const [loading, setLoading]   = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    settingsAPI.getSettings('notifications')
      .then(res => {
        const s = res.data?.settings ?? {};
        setForm(f => ({
          quietStart: String(s['notifications_quiet_hours_start']?.value     ?? f.quietStart),
          quietEnd:   String(s['notifications_quiet_hours_end']?.value       ?? f.quietEnd),
          maxPerDay:  String(s['notifications_max_broadcast_per_day']?.value ?? f.maxPerDay),
        }));
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await Promise.all([
        settingsAPI.updateSetting('notifications_quiet_hours_start',     form.quietStart),
        settingsAPI.updateSetting('notifications_quiet_hours_end',       form.quietEnd),
        settingsAPI.updateSetting('notifications_max_broadcast_per_day', form.maxPerDay),
      ]);
      toast.success('Notification settings saved');
    } catch { toast.error('Failed to save notification settings'); }
    finally   { setLoading(false); }
  };

  const Field = ({ label, value, hint, onChange }: {
    label: string; value: string; hint?: string; onChange: (v: string) => void;
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} disabled={fetching}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm
          focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50" />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <Section icon={<Bell className="h-4 w-4" />}
      title="Notification Settings" subtitle="Control broadcast frequency and quiet hours">
      {fetching && <p className="text-xs text-gray-400 mb-4 animate-pulse">Loading…</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-xl">
        <Field label="Quiet Hours Start (0–23)" value={form.quietStart}
          hint="e.g. 23 = 11 PM" onChange={v => setForm(f => ({ ...f, quietStart: v }))} />
        <Field label="Quiet Hours End (0–23)"   value={form.quietEnd}
          hint="e.g. 7 = 7 AM"  onChange={v => setForm(f => ({ ...f, quietEnd: v }))} />
        <Field label="Max Broadcasts / User / Day" value={form.maxPerDay}
          hint="Prevents notification fatigue" onChange={v => setForm(f => ({ ...f, maxPerDay: v }))} />
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Quiet window: <strong>{form.quietStart}:00</strong> → <strong>{form.quietEnd}:00</strong> — no broadcasts sent
      </p>
      <div className="mt-5">
        <Button loading={loading || fetching} onClick={handleSave}>
          <Save className="h-4 w-4" />Save Notification Settings
        </Button>
      </div>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING BONUS — SUPER_ADMIN only
// Two-step: Preview (dry run) → Disburse (commit).
// Credits approved drivers/partners with ₦0 balance. Safe to re-run.
// ─────────────────────────────────────────────────────────────────────────────
const OnboardingBonusSection: React.FC = () => {
  const [driverBonus,  setDriverBonus]  = useState('5000');
  const [partnerBonus, setPartnerBonus] = useState('5000');
  const [loading,      setLoading]      = useState(false);
  const [previewing,   setPreviewing]   = useState(false);
  const [preview,      setPreview]      = useState<{ eligibleDrivers: number; eligiblePartners: number } | null>(null);
  const [result,       setResult]       = useState<{ drivers: number; partners: number } | null>(null);
  const [logs,         setLogs]         = useState<any[]>([]);
  const [logsOpen,     setLogsOpen]     = useState(false);
  const [logsLoading,  setLogsLoading]  = useState(false);

  const handlePreview = async () => {
    setPreviewing(true); setPreview(null);
    try {
      const res = await api.get('/admin/bonuses/onboarding/preview');
      setPreview(res.data.data);
    } catch { toast.error('Preview failed'); }
    finally { setPreviewing(false); }
  };

  const handleDisbursement = async () => {
    const dAmt = parseFloat(driverBonus);
    const pAmt = parseFloat(partnerBonus);
    if (isNaN(dAmt) || isNaN(pAmt) || dAmt < 0 || pAmt < 0) {
      toast.error('Enter valid bonus amounts'); return;
    }
    setLoading(true); setResult(null);
    try {
      const res = await api.post('/admin/bonuses/onboarding', { driverBonus: dAmt, partnerBonus: pAmt });
      setResult(res.data.data); setPreview(null);
      toast.success(`Bonuses sent to ${res.data.data.drivers + res.data.data.partners} recipients`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to disburse bonuses');
    } finally { setLoading(false); }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await api.get('/admin/logs?action=onboarding_bonus_disbursed&limit=10');
      setLogs(res.data.data?.logs ?? []);
    } catch { toast.error('Could not load history'); }
    finally { setLogsLoading(false); }
  };

  return (
    <Section icon={<Gift className="h-4 w-4" />}
      title="Onboarding Bonus" subtitle="Credits approved drivers and partners with ₦0 balance">
      <Alert variant="info" className="mb-5">
        Credits every <strong>approved driver</strong> and <strong>delivery partner</strong> whose
        wallet is <strong>₦0</strong>. The bonus is <strong>non-withdrawable</strong> — used only
        as a security deposit to accept rides/deliveries. Safe to re-run.
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-sm mb-5">
        {([
          { label: 'Driver Bonus',  value: driverBonus,  setter: setDriverBonus  },
          { label: 'Partner Bonus', value: partnerBonus, setter: setPartnerBonus },
        ] as const).map(({ label, value, setter }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label} (₦)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
              <input type="number" value={value} onChange={e => setter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <Alert variant="warning" className="mb-4">
          <strong>Preview:</strong> {preview.eligibleDrivers} driver(s) and {preview.eligiblePartners} partner(s) eligible.
          Click "Disburse" to proceed.
        </Alert>
      )}
      {result && (
        <Alert variant="success" className="mb-4">
          ✅ <strong>{result.drivers}</strong> driver(s) and <strong>{result.partners}</strong> partner(s) credited.
        </Alert>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="secondary" loading={previewing} onClick={handlePreview}>
          <Search className="h-4 w-4" />Preview Eligible
        </Button>
        <Button variant="success" loading={loading} onClick={handleDisbursement}>
          <Gift className="h-4 w-4" />Disburse Bonuses
        </Button>
      </div>

      {/* Disbursement history from ActivityLog */}
      <div className="mt-6 border-t border-gray-100 pt-4">
        <button onClick={() => { if (!logsOpen && logs.length === 0) loadLogs(); setLogsOpen(o => !o); }}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ClipboardList className="h-4 w-4" />
          Disbursement History
          {logsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {logsOpen && (
          <div className="mt-3">
            {logsLoading && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}
            {!logsLoading && logs.length === 0 && (
              <p className="text-xs text-gray-400">No disbursements found.</p>
            )}
            {!logsLoading && logs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Drivers</th>
                      <th className="pb-2 font-medium">Partners</th>
                      <th className="pb-2 font-medium">Total</th>
                      <th className="pb-2 font-medium">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.map((log, i) => (
                      <tr key={i} className="text-gray-700">
                        <td className="py-2">{new Date(log.createdAt).toLocaleString('en-NG')}</td>
                        <td className="py-2">{log.details?.driverCount  ?? '—'}</td>
                        <td className="py-2">{log.details?.partnerCount ?? '—'}</td>
                        <td className="py-2">₦{(log.details?.totalDisbursed ?? 0).toLocaleString('en-NG')}</td>
                        <td className="py-2">{log.user?.firstName} {log.user?.lastName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG — visible to all admins, lazy-loaded on toggle
// ─────────────────────────────────────────────────────────────────────────────
const AuditLogSection: React.FC = () => {
  const [logs,    setLogs]    = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/logs?entityType=SystemSettings&limit=15');
      setLogs(res.data.data?.logs ?? []);
    } catch { toast.error('Could not load audit log'); }
    finally { setLoading(false); }
  }, []);

  return (
    <Section icon={<ClipboardList className="h-4 w-4" />}
      title="Settings Audit Log" subtitle="Recent changes to platform configuration">
      <button onClick={() => { if (!open && logs.length === 0) load(); setOpen(o => !o); }}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-3">
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {open ? 'Hide' : 'Show'} Recent Changes
        {open && (
          <button onClick={e => { e.stopPropagation(); load(); }}
            className="ml-2 text-gray-400 hover:text-gray-600">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </button>

      {open && (
        <>
          {loading && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}
          {!loading && logs.length === 0 && (
            <p className="text-xs text-gray-400">No settings changes recorded yet.</p>
          )}
          {!loading && logs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Key</th>
                    <th className="pb-2 font-medium">New Value</th>
                    <th className="pb-2 font-medium">Changed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log, i) => (
                    <tr key={i} className="text-gray-700">
                      <td className="py-2 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('en-NG')}</td>
                      <td className="py-2 font-mono text-primary-600">{log.details?.key   ?? '—'}</td>
                      <td className="py-2 font-mono">{String(log.details?.value ?? '—')}</td>
                      <td className="py-2">{log.user?.firstName} {log.user?.lastName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DANGER ZONE — SUPER_ADMIN only
// Clear Fare Cache: writes fare_cache_bust key → triggers invalidateFareCache()
// ─────────────────────────────────────────────────────────────────────────────
const DangerZoneSection: React.FC = () => {
  const [cacheLoading, setCacheLoading] = useState(false);

  const clearFareCache = async () => {
    if (!window.confirm('Force-clear the fare engine cache? Next fare request will reload all pricing from DB.')) return;
    setCacheLoading(true);
    try {
      await settingsAPI.updateSetting('fare_cache_bust', String(Date.now()));
      toast.success('Fare cache cleared — next request reloads pricing from DB');
    } catch { toast.error('Failed to clear fare cache'); }
    finally   { setCacheLoading(false); }
  };

  return (
    <Section icon={<ShieldAlert className="h-4 w-4" />}
      title="Danger Zone" subtitle="Platform-wide operational actions — Super Admin only">
      <div className="flex items-center justify-between border border-red-200 bg-red-50 rounded-lg px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Clear Fare Engine Cache</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Forces the fare engine to reload all pricing from DB on the next request.
            Use this after any manual DB edits that bypass the admin UI.
          </p>
        </div>
        <Button variant="danger" loading={cacheLoading} onClick={clearFareCache} className="ml-4 shrink-0">
          <RefreshCw className="h-4 w-4" />Clear Cache
        </Button>
      </div>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE ROOT
// ─────────────────────────────────────────────────────────────────────────────
const GeneralSettings: React.FC = () => {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage platform configuration, pricing, and security.</p>
      </div>

      <PlatformSection />
      <PricingSection />
      <SurgeSection />
      <NotificationsSection />
      <PasswordSection />
      <AuditLogSection />

      {isSuperAdmin && <OnboardingBonusSection />}
      {isSuperAdmin && <DangerZoneSection />}
    </div>
  );
};

export default GeneralSettings;