// admin-web/src/pages/Settings/GeneralSettings.tsx
import React, { useState } from 'react';
import { Save, Lock, DollarSign, Settings, Eye, EyeOff, Gift } from 'lucide-react';
import { Card, Input, Button, Alert } from '@/components/common';
import { settingsAPI } from '@/services/api/settings';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import api from '@/services/api';

// These match fareEngine.js FALLBACK_RATES exactly
const PRICING_DEFAULTS = {
  ride_base_fare_car:             '500',
  ride_per_km_car:                '130',
  ride_base_fare_bike:            '200',
  ride_per_km_bike:               '80',
  ride_base_fare_van:             '800',
  ride_per_km_van:                '180',
  ride_booking_fee:               '100',
  platform_commission_rides:      '20',
  delivery_base_fee:              '500',
  delivery_per_km:                '80',
  delivery_weight_fee_per_kg:     '50',
  platform_commission_deliveries: '15',
};

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, children }) => (
  <Card>
    <div className="flex items-start gap-3 mb-6 pb-4 border-b border-gray-100">
      <span className="p-2 rounded-lg bg-primary-50 text-primary-600 mt-0.5">{icon}</span>
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </Card>
);

// ─── Password Change ──────────────────────────────────────────────────────────
const PasswordSection: React.FC = () => {
  const [form, setForm]       = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow]       = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match.'); return;
    }
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters.'); return;
    }
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
    <button
      type="button"
      onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))}
      className="text-gray-400 hover:text-gray-600 transition-colors"
    >
      {show[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <Section icon={<Lock className="h-4 w-4" />} title="Change Password" subtitle="Update your account password">
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      <div className="space-y-4 max-w-md">
        <div className="relative">
          <Input label="Current Password" name="currentPassword" type={show.current ? 'text' : 'password'} value={form.currentPassword} onChange={handleChange} />
          <span className="absolute right-3 top-[34px]"><ToggleEye field="current" /></span>
        </div>
        <div className="relative">
          <Input label="New Password" name="newPassword" type={show.next ? 'text' : 'password'} value={form.newPassword} onChange={handleChange} hint="Minimum 8 characters" />
          <span className="absolute right-3 top-[34px]"><ToggleEye field="next" /></span>
        </div>
        <div className="relative">
          <Input label="Confirm New Password" name="confirmPassword" type={show.confirm ? 'text' : 'password'} value={form.confirmPassword} onChange={handleChange} />
          <span className="absolute right-3 top-[34px]"><ToggleEye field="confirm" /></span>
        </div>
        <Button loading={loading} onClick={handleSubmit}>
          <Save className="h-4 w-4" />Update Password
        </Button>
      </div>
    </Section>
  );
};

// ─── Platform Settings ────────────────────────────────────────────────────────
const PlatformSection: React.FC = () => {
  const [form, setForm]       = useState({ name: 'Diakite', supportEmail: 'support@diakite.com', supportPhone: '+2348000000000' });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await Promise.all([
        settingsAPI.updateSetting('platform_name',  form.name),
        settingsAPI.updateSetting('support_email',  form.supportEmail),
        settingsAPI.updateSetting('support_phone',  form.supportPhone),
      ]);
      toast.success('Platform settings saved');
    } catch { toast.error('Failed to save settings'); }
    finally { setLoading(false); }
  };

  return (
    <Section icon={<Settings className="h-4 w-4" />} title="Platform Settings">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <Input label="Platform Name"  value={form.name}         onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Support Email"  value={form.supportEmail} onChange={e => setForm(f => ({ ...f, supportEmail: e.target.value }))} type="email" />
        <Input label="Support Phone"  value={form.supportPhone} onChange={e => setForm(f => ({ ...f, supportPhone: e.target.value }))} />
      </div>
      <div className="mt-5">
        <Button loading={loading} onClick={handleSave}><Save className="h-4 w-4" />Save Changes</Button>
      </div>
    </Section>
  );
};

// ─── Pricing Config ───────────────────────────────────────────────────────────
type PricingState = typeof PRICING_DEFAULTS;

const PricingSection: React.FC = () => {
  const [values, setValues] = useState<PricingState>({ ...PRICING_DEFAULTS });
  const [loading, setLoading] = useState(false);

  const set = (key: keyof PricingState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues(v => ({ ...v, [key]: e.target.value }));

  const handleSave = async () => {
    setLoading(true);
    try {
      await Promise.all(
        (Object.keys(PRICING_DEFAULTS) as (keyof PricingState)[]).map(key =>
          settingsAPI.updateSetting(key, values[key])
        )
      );
      toast.success('Pricing configuration saved — live immediately');
    } catch { toast.error('Failed to save pricing'); }
    finally { setLoading(false); }
  };

  const Field = ({ label, k, prefix = '₦' }: { label: string; k: keyof PricingState; prefix?: string }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">{prefix}</span>
        <input
          type="number"
          value={values[k]}
          onChange={set(k)}
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white hover:border-gray-400"
        />
      </div>
    </div>
  );

  return (
    <Section
      icon={<DollarSign className="h-4 w-4" />}
      title="Pricing Configuration (NGN)"
      subtitle="Changes take effect on the next fare request — no server restart needed"
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Rides</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Field label="Base Fare — Car"     k="ride_base_fare_car" />
        <Field label="Per KM — Car"        k="ride_per_km_car" />
        <Field label="Base Fare — Bike"    k="ride_base_fare_bike" />
        <Field label="Per KM — Bike"       k="ride_per_km_bike" />
        <Field label="Base Fare — Van"     k="ride_base_fare_van" />
        <Field label="Per KM — Van"        k="ride_per_km_van" />
        <Field label="Booking Fee (flat)"  k="ride_booking_fee" />
        <Field label="Commission"          k="platform_commission_rides" prefix="%" />
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Deliveries</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Field label="Base Fee"            k="delivery_base_fee" />
        <Field label="Per KM"              k="delivery_per_km" />
        <Field label="Weight Fee / KG"     k="delivery_weight_fee_per_kg" />
        <Field label="Commission"          k="platform_commission_deliveries" prefix="%" />
      </div>

      <Button loading={loading} onClick={handleSave}><Save className="h-4 w-4" />Update Pricing</Button>
    </Section>
  );
};

// ─── Onboarding Bonus — SUPER_ADMIN only ─────────────────────────────────────
const OnboardingBonusSection: React.FC = () => {
  const [driverBonus,  setDriverBonus]  = useState('5000');
  const [partnerBonus, setPartnerBonus] = useState('5000');
  const [loading, setLoading]           = useState(false);
  const [result,  setResult]            = useState<{ drivers: number; partners: number } | null>(null);

  const handleDisbursement = async () => {
    const dAmt = parseFloat(driverBonus);
    const pAmt = parseFloat(partnerBonus);
    if (isNaN(dAmt) || isNaN(pAmt) || dAmt < 0 || pAmt < 0) {
      toast.error('Enter valid bonus amounts'); return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/admin/bonuses/onboarding', { driverBonus: dAmt, partnerBonus: pAmt });
      setResult(res.data.data);
      toast.success(`Bonuses sent to ${res.data.data.drivers + res.data.data.partners} recipients`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to disburse bonuses');
    } finally { setLoading(false); }
  };

  return (
    <Section
      icon={<Gift className="h-4 w-4" />}
      title="Onboarding Bonus"
      subtitle="Credits approved drivers and partners who have ₦0 balance"
    >
      <Alert variant="info" className="mb-5">
        Credits every <strong>approved driver</strong> and <strong>delivery partner</strong> whose wallet is currently <strong>₦0</strong>.
        The bonus is <strong>non-withdrawable</strong> — it only serves as a security deposit to accept rides/deliveries.
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-sm mb-5">
        {([
          { label: 'Driver Bonus',  value: driverBonus,  setter: setDriverBonus },
          { label: 'Partner Bonus', value: partnerBonus, setter: setPartnerBonus },
        ] as const).map(({ label, value, setter }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label} (₦)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
              <input
                type="number"
                value={value}
                onChange={e => setter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        ))}
      </div>

      {result && (
        <Alert variant="success" className="mb-4">
          ✅ Disbursed — <strong>{result.drivers}</strong> driver(s) and <strong>{result.partners}</strong> partner(s) credited.
        </Alert>
      )}

      <Button variant="success" loading={loading} onClick={handleDisbursement}>
        <Gift className="h-4 w-4" />Disburse Onboarding Bonuses
      </Button>
    </Section>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
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
      <PasswordSection />

      {/*
        Onboarding Bonus section is only rendered for SUPER_ADMIN.
        The backend also enforces this — regular ADMINs will get a 403
        even if they somehow POST to /admin/bonuses/onboarding.
      */}
      {isSuperAdmin && <OnboardingBonusSection />}
    </div>
  );
};

export default GeneralSettings;