// admin-web/src/pages/Settings/GeneralSettings.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Save, Lock, DollarSign, Settings, Eye, EyeOff, Gift,
  Bell, Zap, ShieldAlert, ClipboardList, FileText,
  RefreshCw, ToggleLeft, ToggleRight, Search, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, Input, Button, Alert } from '@/components/common';
import { settingsAPI } from '@/services/api/settings';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import api from '@/services/api';

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
  platform_commission_rides:      '20',
  delivery_base_fee:              '500',
  delivery_per_km:                '80',
  delivery_weight_fee_per_kg:     '50',
  platform_commission_deliveries: '15',
};

const DEFAULT_SURGE_WINDOWS = [
  { label: 'Morning Rush',  days: [1,2,3,4,5],     hourStart: 6,  hourEnd: 9,  multiplier: 1.4 },
  { label: 'Evening Rush',  days: [1,2,3,4,5],     hourStart: 16, hourEnd: 20, multiplier: 1.5 },
  { label: 'Friday Night',  days: [5],             hourStart: 18, hourEnd: 23, multiplier: 1.6 },
  { label: 'Late Night',    days: [0,1,2,3,4,5,6], hourStart: 23, hourEnd: 24, multiplier: 1.3 },
  { label: 'Early Morning', days: [0,1,2,3,4,5,6], hourStart: 0,  hourEnd: 5,  multiplier: 1.3 },
  { label: 'Weekend Day',   days: [0,6],            hourStart: 10, hourEnd: 20, multiplier: 1.2 },
];

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

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
// MARKDOWN → HTML  (admin preview only — mobile uses its own renderer)
// ─────────────────────────────────────────────────────────────────────────────
function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:12px">$1</code>');
}

function markdownToHtml(text: string): string {
  const lines  = text.split('\n');
  const out: string[] = [];
  let inList   = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^### /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3 style="font-size:14px;font-weight:700;margin:16px 0 4px;color:#111">${inlineFormat(line.slice(4))}</h3>`);
    } else if (/^## /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2 style="font-size:17px;font-weight:700;margin:22px 0 6px;color:#111">${inlineFormat(line.slice(3))}</h2>`);
    } else if (/^# /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h1 style="font-size:21px;font-weight:800;margin:0 0 10px;color:#111">${inlineFormat(line.slice(2))}</h1>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList) { out.push('<ul style="margin:8px 0;padding-left:20px;list-style:disc">'); inList = true; }
      out.push(`<li style="margin:5px 0;color:#374151">${inlineFormat(line.slice(2))}</li>`);
    } else if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('<div style="height:10px"></div>');
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p style="margin:6px 0;line-height:1.7;color:#374151">${inlineFormat(line)}</p>`);
    }
  }

  if (inList) out.push('</ul>');
  return out.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD SECTION
// ─────────────────────────────────────────────────────────────────────────────
const PasswordSection: React.FC = () => {
  const [form, setForm]       = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow]       = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const strength = getPasswordStrength(form.newPassword);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    if (form.newPassword !== form.confirmPassword) { setError('New passwords do not match.'); return; }
    if (form.newPassword.length < 8)               { setError('Minimum 8 characters required.'); return; }
    setLoading(true);
    try {
      await api.put('/users/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
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
                strength.score <= 1 ? 'text-red-500' : strength.score === 2 ? 'text-orange-400' :
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
// ─────────────────────────────────────────────────────────────────────────────
const PlatformSection: React.FC = () => {
  const [form, setForm] = useState({
    name: 'Diakite', supportEmail: 'support@diakite.com',
    supportPhone: '+2348000000000', supportWhatsapp: '+2348000000000',
    logoUrl: '', maintenance: false, maintenanceMessage: '',
    maintenanceStartsAt: '', maintenanceEndsAt: '',
  });
  const [loading, setLoading]   = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    settingsAPI.getSettings('platform')
      .then(res => {
        const s = res.data?.settings ?? {};
        setForm(f => ({
          ...f,
          name:            s['platform_name']?.value    ?? f.name,
          supportEmail:    s['support_email']?.value    ?? f.supportEmail,
          supportPhone:    s['support_phone']?.value    ?? f.supportPhone,
          supportWhatsapp: s['support_whatsapp']?.value ?? s['support_phone']?.value ?? f.supportWhatsapp,
          logoUrl:         s['platform_logo']?.value    ?? '',
          maintenance:     s['maintenance_mode']?.value === true || s['maintenance_mode']?.value === 'true',
          maintenanceMessage:  s['maintenance_message']?.value ?? '',
          maintenanceStartsAt: s['maintenance_starts_at']?.value
            ? new Date(s['maintenance_starts_at'].value).toISOString().slice(0,16) : '',
          maintenanceEndsAt: s['maintenance_ends_at']?.value
            ? new Date(s['maintenance_ends_at'].value).toISOString().slice(0,16) : '',
        }));
      })
      .catch(() => toast.error('Could not load platform settings.'))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (!form.maintenance || !form.maintenanceEndsAt) return;
    const endsAt = new Date(form.maintenanceEndsAt);
    const ms = endsAt.getTime() - Date.now();
    if (ms <= 0) { setForm(f => ({ ...f, maintenance: false })); return; }
    const t = setTimeout(() => {
      setForm(f => ({ ...f, maintenance: false }));
      toast.success('Maintenance window expired — toggle turned off automatically');
    }, ms);
    return () => clearTimeout(t);
  }, [form.maintenance, form.maintenanceEndsAt]);

  const handleSave = async () => {
    if (form.maintenanceStartsAt && form.maintenanceEndsAt &&
        new Date(form.maintenanceEndsAt) <= new Date(form.maintenanceStartsAt)) {
      toast.error('End time must be after start time'); return;
    }
    setLoading(true);
    try {
      await Promise.all([
        settingsAPI.updateSetting('platform_name',        form.name),
        settingsAPI.updateSetting('support_email',        form.supportEmail),
        settingsAPI.updateSetting('support_phone',        form.supportPhone),
        settingsAPI.updateSetting('support_whatsapp',     form.supportWhatsapp),
        settingsAPI.updateSetting('platform_logo',        form.logoUrl),
        settingsAPI.updateSetting('maintenance_mode',     String(form.maintenance)),
        settingsAPI.updateSetting('maintenance_message',  form.maintenanceMessage),
        settingsAPI.updateSetting('maintenance_starts_at',
          form.maintenanceStartsAt ? new Date(form.maintenanceStartsAt).toISOString() : ''),
        settingsAPI.updateSetting('maintenance_ends_at',
          form.maintenanceEndsAt ? new Date(form.maintenanceEndsAt).toISOString() : ''),
      ]);
      toast.success('Platform settings saved');
    } catch { toast.error('Failed to save settings'); }
    finally  { setLoading(false); }
  };

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
        <Input label="Platform Name" value={form.name} disabled={fetching}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Support Email" value={form.supportEmail} disabled={fetching} type="email"
          onChange={e => setForm(f => ({ ...f, supportEmail: e.target.value }))} />
        <div>
          <Input label="Support Phone (call)" value={form.supportPhone} disabled={fetching}
            hint="E.164 format e.g. +2348012345678"
            onChange={e => setForm(f => ({ ...f, supportPhone: e.target.value }))} />
        </div>
        <div>
          <Input label="WhatsApp Number" value={form.supportWhatsapp} disabled={fetching}
            hint="Can differ from call number — E.164 format"
            onChange={e => setForm(f => ({ ...f, supportWhatsapp: e.target.value }))} />
          {form.supportPhone && form.supportPhone !== form.supportWhatsapp && (
            <button type="button"
              className="mt-1 text-xs text-primary-500 hover:text-primary-700 font-medium"
              onClick={() => setForm(f => ({ ...f, supportWhatsapp: f.supportPhone }))}>
              ← Copy from Support Phone
            </button>
          )}
        </div>
        <Input label="Logo URL (CDN)" value={form.logoUrl} disabled={fetching}
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

      <div className="mt-5 max-w-2xl border border-orange-200 bg-orange-50 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Maintenance Mode</p>
            <p className="text-xs text-gray-500 mt-0.5">Returns 503 on all customer/driver routes. Admin routes stay live.</p>
          </div>
          <button onClick={() => setForm(f => ({ ...f, maintenance: !f.maintenance }))}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${form.maintenance ? 'text-orange-600' : 'text-gray-400'}`}>
            {form.maintenance
              ? <><ToggleRight className="h-8 w-8" /><span>ON</span></>
              : <><ToggleLeft  className="h-8 w-8" /><span>OFF</span></>}
          </button>
        </div>
        {statusLabel && (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />{statusLabel}
          </div>
        )}
        {form.maintenance && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Message shown to users</label>
              <textarea rows={3}
                className="w-full px-3 py-2 rounded-lg border border-orange-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                placeholder="e.g. Scheduled maintenance from 2:00 AM – 5:00 AM WAT. We apologise for the inconvenience."
                value={form.maintenanceMessage}
                onChange={e => setForm(f => ({ ...f, maintenanceMessage: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start date &amp; time <span className="text-gray-400">(optional)</span></label>
                <input type="datetime-local" value={form.maintenanceStartsAt}
                  onChange={e => setForm(f => ({ ...f, maintenanceStartsAt: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-orange-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                <p className="text-xs text-gray-400 mt-1">Users see a warning banner before this time.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End date &amp; time <span className="text-gray-400">(optional)</span></label>
                <input type="datetime-local" value={form.maintenanceEndsAt}
                  onChange={e => setForm(f => ({ ...f, maintenanceEndsAt: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-orange-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                <p className="text-xs text-gray-400 mt-1">Maintenance auto-expires at this time.</p>
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
// LEGAL CONTENT SECTION  ← NEW
// Admin types markdown → saved to DB under keys:
//   terms_content | privacy_content | help_content
// Mobile app fetches via GET /status/legal and renders in LegalScreen.
// ─────────────────────────────────────────────────────────────────────────────
type LegalKey = 'terms_content' | 'privacy_content' | 'help_content';

const LEGAL_TABS: { key: LegalKey; label: string; icon: string }[] = [
  { key: 'terms_content',   label: 'Terms of Service', icon: '📋' },
  { key: 'privacy_content', label: 'Privacy Policy',   icon: '🔒' },
  { key: 'help_content',    label: 'Help Center',      icon: '💬' },
];

const LEGAL_PLACEHOLDERS: Record<LegalKey, string> = {
  terms_content: [
    '# Terms of Service',
    '',
    'Last updated: January 2025',
    '',
    '## 1. Acceptance of Terms',
    '',
    'By downloading or using the Diakite app, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.',
    '',
    '## 2. Eligibility',
    '',
    '- You must be at least 18 years old to use this platform',
    '- You must provide accurate and complete registration information',
    '- One account per person — multiple accounts are not permitted',
    '',
    '## 3. Rides & Deliveries',
    '',
    'Diakite connects you with independent drivers and couriers. We do not employ drivers directly.',
    '',
    '## 4. Payments',
    '',
    'All fares are displayed before booking. Cancellation fees may apply after a driver is matched.',
    '',
    '## 5. Contact',
    '',
    'For questions about these terms, contact **support@diakite.app**',
  ].join('\n'),

  privacy_content: [
    '# Privacy Policy',
    '',
    'Last updated: January 2025',
    '',
    '## What We Collect',
    '',
    '- **Account information** — name, phone number, email address',
    '- **Location data** — only while the app is in use for ride matching',
    '- **Payment information** — processed securely; we do not store card numbers',
    '- **Usage data** — ride history, app interactions',
    '',
    '## How We Use Your Data',
    '',
    '- To process your bookings and deliveries',
    '- To calculate fares and show your trip history',
    '- To send booking confirmations and support replies',
    '- To improve the app and prevent fraud',
    '',
    '## Sharing Your Data',
    '',
    'We share only what is necessary — your name and pickup location are shared with your driver. We do not sell your personal data to third parties.',
    '',
    '## Your Rights',
    '',
    'You may request deletion of your account and data at any time by contacting **support@diakite.app**',
    '',
    '## Data Security',
    '',
    'All data is encrypted in transit (TLS) and at rest. We follow industry-standard security practices.',
  ].join('\n'),

  help_content: [
    '# Help Center',
    '',
    '## Booking a Ride',
    '',
    '**How do I book a ride?**',
    'Tap **Book a Ride** on the home screen, enter your destination, choose your vehicle type, and confirm. A nearby driver will be matched instantly.',
    '',
    '**Can I schedule a ride in advance?**',
    'Currently rides are on-demand only. Scheduled rides are coming soon.',
    '',
    '**How do I cancel a ride?**',
    'Tap the ride card on the home screen and select **Cancel**. Cancellation fees may apply once a driver is matched.',
    '',
    '## Payments & Wallet',
    '',
    '**How do I top up my wallet?**',
    'Go to **Wallet** in the menu, tap **Top Up**, and choose Paystack or Flutterwave.',
    '',
    '**My payment failed — what do I do?**',
    'Check your card details or try a different payment method. If the problem persists, contact support.',
    '',
    '## Deliveries',
    '',
    '**How do I send a package?**',
    'Tap **Send a Package**, enter the pickup and drop-off address, add package details, and confirm.',
    '',
    '**Can I track my delivery live?**',
    'Yes — once a courier accepts, you will see their location on the map in real time.',
    '',
    '## Account',
    '',
    '**How do I change my password?**',
    'Go to **Profile → Change Password** and follow the steps.',
    '',
    '**How do I delete my account?**',
    'Contact us at **support@diakite.app** and we will process the request within 48 hours.',
    '',
    '## Still need help?',
    '',
    'Use **Submit a Ticket** on the Support screen or call us directly.',
  ].join('\n'),
};

const LegalContentSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LegalKey>('terms_content');
  const [viewMode,  setViewMode]  = useState<'edit' | 'preview'>('edit');
  const [content,   setContent]   = useState<Record<LegalKey, string>>({
    terms_content: '', privacy_content: '', help_content: '',
  });
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    settingsAPI.getSettings('legal')
      .then(res => {
        const s = res.data?.settings ?? {};
        setContent({
          terms_content:   s['terms_content']?.value   ?? '',
          privacy_content: s['privacy_content']?.value ?? '',
          help_content:    s['help_content']?.value    ?? '',
        });
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await Promise.all([
        settingsAPI.updateSetting('terms_content',   content.terms_content,   'legal'),
        settingsAPI.updateSetting('privacy_content', content.privacy_content, 'legal'),
        settingsAPI.updateSetting('help_content',    content.help_content,    'legal'),
      ]);
      toast.success('Legal & Help content saved — live in the app immediately');
    } catch { toast.error('Failed to save content'); }
    finally  { setLoading(false); }
  };

  const activeContent = content[activeTab];

  return (
    <Section
      icon={<FileText className="h-4 w-4" />}
      title="Legal & Help Content"
      subtitle="Write in markdown — displayed in-app when users tap Terms, Privacy, or Help Center"
    >
      {fetching && <p className="text-xs text-gray-400 mb-4 animate-pulse">Loading saved content…</p>}

      {/* Markdown cheatsheet */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Markdown quick reference</p>
        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
          {[
            ['# Title',       'Big heading'],
            ['## Section',    'Section heading'],
            ['### Sub',       'Smaller heading'],
            ['**bold**',      'Bold text'],
            ['*italic*',      'Italic text'],
            ['- item',        'Bullet list'],
          ].map(([syntax, desc]) => (
            <span key={syntax} className="flex items-center gap-1.5 bg-white border border-gray-200 px-2 py-1 rounded">
              <code className="font-mono text-primary-600">{syntax}</code>
              <span className="text-gray-400">→ {desc}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Page tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {LEGAL_TABS.map(tab => (
          <button key={tab.key}
            onClick={() => { setActiveTab(tab.key); setViewMode('edit'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">
          {content[activeTab]
            ? <span>{content[activeTab].length.toLocaleString()} characters · {content[activeTab].split('\n').length} lines</span>
            : <span className="text-orange-500 font-medium">⚠ No content yet — paste or type below</span>
          }
        </p>
        <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
          {(['edit', 'preview'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                viewMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>{m === 'edit' ? '✏️ Edit' : '👁 Preview'}</button>
          ))}
        </div>
      </div>

      {/* Editor / Preview */}
      {viewMode === 'edit' ? (
        <textarea
          rows={22}
          disabled={fetching}
          placeholder={LEGAL_PLACEHOLDERS[activeTab]}
          value={activeContent}
          onChange={e => setContent(c => ({ ...c, [activeTab]: e.target.value }))}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm font-mono
            leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-500
            bg-white resize-y disabled:opacity-50 disabled:cursor-wait text-gray-800"
          style={{ minHeight: 440 }}
        />
      ) : (
        <div
          className="w-full px-6 py-5 rounded-lg border border-gray-200 bg-white overflow-auto text-sm"
          style={{ minHeight: 440 }}
          dangerouslySetInnerHTML={{
            __html: activeContent.trim()
              ? markdownToHtml(activeContent)
              : '<p style="color:#9ca3af;font-style:italic">Nothing written yet — switch to Edit and start typing, or paste the starter content.</p>',
          }}
        />
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button loading={loading || fetching} onClick={handleSave}>
          <Save className="h-4 w-4" />Save All Three Pages
        </Button>
        {!activeContent && (
          <button
            type="button"
            onClick={() => setContent(c => ({ ...c, [activeTab]: LEGAL_PLACEHOLDERS[activeTab] }))}
            className="text-sm text-primary-500 hover:text-primary-700 font-medium"
          >
            ← Load starter content for this page
          </button>
        )}
        <p className="text-xs text-gray-400 ml-auto">Terms, Privacy &amp; Help saved together in one click</p>
      </div>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PRICING SECTION — unchanged
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
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 mt-4 col-span-full">{label}</p>
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
        <VehicleBlock label="Car"               prefix="car"      />
        <VehicleBlock label="Bike / Motorcycle" prefix="bike"     />
        <VehicleBlock label="Van"               prefix="van"      />
        <VehicleBlock label="Tricycle"          prefix="tricycle" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 col-span-full">Shared — applies to all vehicle types</p>
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
// SURGE SECTION — unchanged
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
        if (val) { try { setWindows(typeof val === 'string' ? JSON.parse(val) : val); } catch {} }
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
      days: w.days.includes(day) ? w.days.filter(d => d !== day) : [...w.days, day].sort(),
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
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">{w.multiplier}×</span>
                <span className="text-xs text-gray-500">{w.hourStart}:00–{w.hourEnd}:00 · {w.days.map(d => DAY_LABELS[d]).join(', ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); setWindows(ws => ws.filter((_, idx) => idx !== i)); }}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1">Remove</button>
                {expanded === i ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
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
                  <input type="number" min={0} max={23} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    value={w.hourStart} onChange={e => update(i, 'hourStart', parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End Hour (1–24)</label>
                  <input type="number" min={1} max={24} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    value={w.hourEnd} onChange={e => update(i, 'hourEnd', parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Multiplier</label>
                  <input type="number" step={0.1} min={1} max={5} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    value={w.multiplier} onChange={e => update(i, 'multiplier', parseFloat(e.target.value))} />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <label className="block text-xs font-medium text-gray-500 mb-2">Active Days</label>
                  <div className="flex gap-2">
                    {DAY_LABELS.map((d, dayIdx) => (
                      <button key={d} onClick={() => toggleDay(i, dayIdx)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          w.days.includes(dayIdx) ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
        <button onClick={() => setWindows(ws => [...ws, { label: 'New Window', days: [1,2,3,4,5], hourStart: 8, hourEnd: 10, multiplier: 1.2 }])}
          className="text-sm text-primary-500 hover:text-primary-600 font-medium">+ Add window</button>
        <Button loading={loading || fetching} onClick={handleSave}>
          <Save className="h-4 w-4" />Save Surge Config
        </Button>
      </div>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS SECTION — unchanged
// ─────────────────────────────────────────────────────────────────────────────
const NotificationsSection: React.FC = () => {
  const [form, setForm]         = useState({ quietStart: '23', quietEnd: '7', maxPerDay: '3' });
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

  const Field = ({ label, value, hint, onChange }: { label: string; value: string; hint?: string; onChange: (v: string) => void }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} disabled={fetching}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50" />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <Section icon={<Bell className="h-4 w-4" />} title="Notification Settings" subtitle="Control broadcast frequency and quiet hours">
      {fetching && <p className="text-xs text-gray-400 mb-4 animate-pulse">Loading…</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-xl">
        <Field label="Quiet Hours Start (0–23)" value={form.quietStart} hint="e.g. 23 = 11 PM" onChange={v => setForm(f => ({ ...f, quietStart: v }))} />
        <Field label="Quiet Hours End (0–23)"   value={form.quietEnd}   hint="e.g. 7 = 7 AM"   onChange={v => setForm(f => ({ ...f, quietEnd: v }))} />
        <Field label="Max Broadcasts / User / Day" value={form.maxPerDay} hint="Prevents notification fatigue" onChange={v => setForm(f => ({ ...f, maxPerDay: v }))} />
      </div>
      <p className="text-xs text-gray-500 mt-3">Quiet window: <strong>{form.quietStart}:00</strong> → <strong>{form.quietEnd}:00</strong> — no broadcasts sent</p>
      <div className="mt-5">
        <Button loading={loading || fetching} onClick={handleSave}><Save className="h-4 w-4" />Save Notification Settings</Button>
      </div>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING BONUS — unchanged
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
    try { const res = await api.get('/admin/bonuses/onboarding/preview'); setPreview(res.data.data); }
    catch { toast.error('Preview failed'); } finally { setPreviewing(false); }
  };

  const handleDisbursement = async () => {
    const dAmt = parseFloat(driverBonus); const pAmt = parseFloat(partnerBonus);
    if (isNaN(dAmt) || isNaN(pAmt) || dAmt < 0 || pAmt < 0) { toast.error('Enter valid bonus amounts'); return; }
    setLoading(true); setResult(null);
    try {
      const res = await api.post('/admin/bonuses/onboarding', { driverBonus: dAmt, partnerBonus: pAmt });
      setResult(res.data.data); setPreview(null);
      toast.success(`Bonuses sent to ${res.data.data.drivers + res.data.data.partners} recipients`);
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to disburse bonuses'); }
    finally { setLoading(false); }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try { const res = await api.get('/admin/logs?action=onboarding_bonus_disbursed&limit=10'); setLogs(res.data.data?.logs ?? []); }
    catch { toast.error('Could not load history'); } finally { setLogsLoading(false); }
  };

  return (
    <Section icon={<Gift className="h-4 w-4" />} title="Onboarding Bonus" subtitle="Credits approved drivers and partners with ₦0 balance">
      <Alert variant="info" className="mb-5">
        Credits every <strong>approved driver</strong> and <strong>delivery partner</strong> whose wallet is <strong>₦0</strong>.
        The bonus is <strong>non-withdrawable</strong> — used only as a security deposit. Safe to re-run.
      </Alert>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-sm mb-5">
        {([{ label: 'Driver Bonus', value: driverBonus, setter: setDriverBonus }, { label: 'Partner Bonus', value: partnerBonus, setter: setPartnerBonus }] as const).map(({ label, value, setter }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label} (₦)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
              <input type="number" value={value} onChange={e => setter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
        ))}
      </div>
      {preview && <Alert variant="warning" className="mb-4"><strong>Preview:</strong> {preview.eligibleDrivers} driver(s) and {preview.eligiblePartners} partner(s) eligible. Click "Disburse" to proceed.</Alert>}
      {result  && <Alert variant="success" className="mb-4">✅ <strong>{result.drivers}</strong> driver(s) and <strong>{result.partners}</strong> partner(s) credited.</Alert>}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="secondary" loading={previewing} onClick={handlePreview}><Search className="h-4 w-4" />Preview Eligible</Button>
        <Button variant="success"   loading={loading}    onClick={handleDisbursement}><Gift className="h-4 w-4" />Disburse Bonuses</Button>
      </div>
      <div className="mt-6 border-t border-gray-100 pt-4">
        <button onClick={() => { if (!logsOpen && logs.length === 0) loadLogs(); setLogsOpen(o => !o); }}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ClipboardList className="h-4 w-4" />Disbursement History
          {logsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {logsOpen && (
          <div className="mt-3">
            {logsLoading && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}
            {!logsLoading && logs.length === 0 && <p className="text-xs text-gray-400">No disbursements found.</p>}
            {!logsLoading && logs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-gray-400 uppercase tracking-wider">
                    <tr><th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Drivers</th><th className="pb-2 font-medium">Partners</th><th className="pb-2 font-medium">Total</th><th className="pb-2 font-medium">By</th></tr>
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
// AUDIT LOG — unchanged
// ─────────────────────────────────────────────────────────────────────────────
const AuditLogSection: React.FC = () => {
  const [logs,    setLogs]    = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get('/admin/logs?entityType=SystemSettings&limit=15'); setLogs(res.data.data?.logs ?? []); }
    catch { toast.error('Could not load audit log'); } finally { setLoading(false); }
  }, []);

  return (
    <Section icon={<ClipboardList className="h-4 w-4" />} title="Settings Audit Log" subtitle="Recent changes to platform configuration">
      <button onClick={() => { if (!open && logs.length === 0) load(); setOpen(o => !o); }}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-3">
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {open ? 'Hide' : 'Show'} Recent Changes
        {open && <button onClick={e => { e.stopPropagation(); load(); }} className="ml-2 text-gray-400 hover:text-gray-600"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /></button>}
      </button>
      {open && (
        <>
          {loading && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}
          {!loading && logs.length === 0 && <p className="text-xs text-gray-400">No settings changes recorded yet.</p>}
          {!loading && logs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-gray-400 uppercase tracking-wider">
                  <tr><th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Key</th><th className="pb-2 font-medium">New Value</th><th className="pb-2 font-medium">Changed By</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log, i) => (
                    <tr key={i} className="text-gray-700">
                      <td className="py-2 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('en-NG')}</td>
                      <td className="py-2 font-mono text-primary-600">{log.details?.key ?? '—'}</td>
                      <td className="py-2 font-mono">{String(log.details?.value ?? '—').slice(0,60)}{String(log.details?.value ?? '').length > 60 ? '…' : ''}</td>
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
// DANGER ZONE — unchanged
// ─────────────────────────────────────────────────────────────────────────────
const DangerZoneSection: React.FC = () => {
  const [cacheLoading, setCacheLoading] = useState(false);

  const clearFareCache = async () => {
    if (!window.confirm('Force-clear the fare engine cache? Next fare request will reload all pricing from DB.')) return;
    setCacheLoading(true);
    try { await settingsAPI.updateSetting('fare_cache_bust', String(Date.now())); toast.success('Fare cache cleared'); }
    catch { toast.error('Failed to clear fare cache'); } finally { setCacheLoading(false); }
  };

  return (
    <Section icon={<ShieldAlert className="h-4 w-4" />} title="Danger Zone" subtitle="Platform-wide operational actions — Super Admin only">
      <div className="flex items-center justify-between border border-red-200 bg-red-50 rounded-lg px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Clear Fare Engine Cache</p>
          <p className="text-xs text-gray-500 mt-0.5">Forces the fare engine to reload all pricing from DB on the next request.</p>
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
      <LegalContentSection />     {/* ← NEW: Terms, Privacy, Help editor */}
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