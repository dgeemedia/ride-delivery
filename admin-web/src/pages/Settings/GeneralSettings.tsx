// admin-web/src/pages/Settings/GeneralSettings.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save, Lock, DollarSign, Eye, EyeOff, Gift,
  Bell, Zap, ShieldAlert, ClipboardList, FileText,
  RefreshCw, ToggleLeft, ToggleRight, Search, ChevronDown,
  Building2, Wallet, Plus,
} from 'lucide-react';
import { Input, Button, Alert } from '@/components/common';
import { settingsAPI } from '@/services/api/settings';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { cn } from '@/utils/helpers';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

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

type LegalKey = 'terms_content' | 'privacy_content' | 'help_content';
type PricingState = typeof PRICING_DEFAULTS;
type SurgeWindow = { label: string; days: number[]; hourStart: number; hourEnd: number; multiplier: number };
type RecipientRole = 'DRIVER' | 'DELIVERY_PARTNER';
type RoleFilter = 'both' | RecipientRole;

interface Recipient {
  walletUserId: string;
  name:         string;
  email:        string;
  role:         RecipientRole;
  isOnline:     boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCENT PALETTE
// ─────────────────────────────────────────────────────────────────────────────

interface AccentConfig {
  bar:   string;
  solid: string;
}

const ACCENT: Record<string, AccentConfig> = {
  platform:           { bar: '#185FA5', solid: '#185FA5' },
  legal:              { bar: '#0F6E56', solid: '#0F6E56' },
  pricing:            { bar: '#3B6D11', solid: '#3B6D11' },
  surge:              { bar: '#BA7517', solid: '#BA7517' },
  notifications:      { bar: '#534AB7', solid: '#534AB7' },
  wallet:             { bar: '#1D9E75', solid: '#1D9E75' },
  password:           { bar: '#5F5E5A', solid: '#5F5E5A' },
  audit:              { bar: '#5F5E5A', solid: '#5F5E5A' },
  'onboarding-bonus': { bar: '#993556', solid: '#993556' },
  'custom-bonus':     { bar: '#993556', solid: '#993556' },
  danger:             { bar: '#A32D2D', solid: '#A32D2D' },
};

const DEFAULT_ACCENT: AccentConfig = { bar: '#5F5E5A', solid: '#5F5E5A' };

// ─────────────────────────────────────────────────────────────────────────────
// ACCORDION CARD WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

interface SettingCardProps {
  id:         string;
  icon:       React.ReactNode;
  title:      string;
  subtitle:   string;
  isOpen:     boolean;
  onToggle:   (id: string) => void;
  children:   React.ReactNode;
  badge?:     React.ReactNode;
  wide?:      boolean;
  danger?:    boolean;
}

const SettingCard: React.FC<SettingCardProps> = ({
  id, icon, title, subtitle, isOpen, onToggle, children, badge, wide, danger,
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const accent  = ACCENT[id] ?? DEFAULT_ACCENT;

  return (
    <div
      className={cn(
        'rounded-xl border bg-white transition-all duration-200 overflow-hidden',
        wide && 'col-span-full md:col-span-2',
        isOpen
          ? 'border-gray-300 shadow-sm'
          : danger
          ? 'border-red-200 hover:border-red-300'
          : 'border-gray-200 hover:border-gray-300',
      )}
    >
      <div className="flex">
        <div
          className="w-1 flex-shrink-0 rounded-l-xl transition-opacity duration-200"
          style={{ background: accent.bar, opacity: isOpen ? 1 : 0.55 }}
        />
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => onToggle(id)}
            className={cn(
              'w-full flex items-center gap-4 px-4 py-4 text-left transition-colors',
              isOpen ? 'bg-gray-50' : 'hover:bg-gray-50/60',
            )}
          >
            <span
              className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 text-white"
              style={{ background: accent.solid }}
            >
              {icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-gray-900">{title}</h3>
                {badge}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </button>
          <div
            ref={bodyRef}
            className={cn(
              'overflow-hidden transition-all duration-300 ease-in-out',
              isOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
            )}
          >
            <div className="px-5 pt-4 pb-5 border-t border-gray-100">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const SuperAdminBadge = () => (
  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
    <Lock className="h-2.5 w-2.5" />Super Admin
  </span>
);

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

// simple markdown → html (admin preview only)
function escapeHtml(text: string) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function inlineFormat(text: string) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:12px">$1</code>');
}
function markdownToHtml(text: string) {
  const lines = text.split('\n');
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3 style="font-size:14px;font-weight:700;margin:16px 0 4px">${inlineFormat(line.slice(4))}</h3>`);
    } else if (/^## /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2 style="font-size:17px;font-weight:700;margin:22px 0 6px">${inlineFormat(line.slice(3))}</h2>`);
    } else if (/^# /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h1 style="font-size:21px;font-weight:800;margin:0 0 10px">${inlineFormat(line.slice(2))}</h1>`);
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
          name:                s['platform_name']?.value    ?? f.name,
          supportEmail:        s['support_email']?.value    ?? f.supportEmail,
          supportPhone:        s['support_phone']?.value    ?? f.supportPhone,
          supportWhatsapp:     s['support_whatsapp']?.value ?? s['support_phone']?.value ?? f.supportWhatsapp,
          logoUrl:             s['platform_logo']?.value    ?? '',
          maintenance:         String(s['maintenance_mode']?.value) === 'true',
          maintenanceMessage:  s['maintenance_message']?.value ?? '',
          maintenanceStartsAt: s['maintenance_starts_at']?.value
            ? new Date(s['maintenance_starts_at'].value).toISOString().slice(0,16) : '',
          maintenanceEndsAt: s['maintenance_ends_at']?.value
            ? new Date(s['maintenance_ends_at'].value).toISOString().slice(0,16) : '',
        }));
      })
      .catch((err: any) => { if (!err?._handled) toast.error('Could not load platform settings.'); })
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (!form.maintenance || !form.maintenanceEndsAt) return;
    const endsAt = new Date(form.maintenanceEndsAt);
    const ms = endsAt.getTime() - Date.now();
    if (ms <= 0) { setForm(f => ({ ...f, maintenance: false })); return; }
    const t = setTimeout(async () => {
      setForm(f => ({ ...f, maintenance: false }));
      try {
        await settingsAPI.updateSetting('maintenance_mode', 'false', 'platform');
        toast.success('Maintenance window expired — mode turned off automatically');
      } catch {
        toast.error('Maintenance window expired but failed to turn off — please disable manually');
      }
    }, ms);
    return () => clearTimeout(t);
  }, [form.maintenance, form.maintenanceEndsAt]);

  const handleSave = async () => {
    if (form.maintenanceEndsAt && !form.maintenanceStartsAt) {
      toast.error('Set a start time when using an end time'); return;
    }
    if (form.maintenanceStartsAt && form.maintenanceEndsAt &&
        new Date(form.maintenanceEndsAt) <= new Date(form.maintenanceStartsAt)) {
      toast.error('End time must be after start time'); return;
    }
    if (form.maintenance && !window.confirm(
      'Enabling maintenance mode will return 503 to all customers and drivers immediately. Continue?'
    )) return;

    setLoading(true);
    try {
      await settingsAPI.updateSettingsBatch([
        { key: 'platform_name',         value: form.name,             category: 'platform' },
        { key: 'support_email',         value: form.supportEmail,     category: 'platform' },
        { key: 'support_phone',         value: form.supportPhone,     category: 'platform' },
        { key: 'support_whatsapp',      value: form.supportWhatsapp,  category: 'platform' },
        { key: 'platform_logo',         value: form.logoUrl,          category: 'platform' },
        { key: 'maintenance_mode',      value: String(form.maintenance),         category: 'platform' },
        { key: 'maintenance_message',   value: form.maintenanceMessage,          category: 'platform' },
        { key: 'maintenance_starts_at', value: form.maintenanceStartsAt
            ? new Date(form.maintenanceStartsAt).toISOString() : '', category: 'platform' },
        { key: 'maintenance_ends_at',   value: form.maintenanceEndsAt
            ? new Date(form.maintenanceEndsAt).toISOString() : '',   category: 'platform' },
      ]);
      toast.success('Platform settings saved');
    } catch (err: any) { if (!err?._handled) toast.error('Failed to save settings'); }
    finally { setLoading(false); }
  };

  const statusLabel = (() => {
    if (!form.maintenance) return null;
    const now    = new Date();
    const starts = form.maintenanceStartsAt ? new Date(form.maintenanceStartsAt) : null;
    const ends   = form.maintenanceEndsAt   ? new Date(form.maintenanceEndsAt)   : null;
    if (starts && starts > now) return `Scheduled — starts ${starts.toLocaleString('en-NG')}`;
    if (ends)                   return `Active — ends ${ends.toLocaleString('en-NG')}`;
    return 'Active — no end time set (manual off required)';
  })();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      {fetching && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Platform name"     value={form.name}          disabled={fetching} onChange={set('name')} />
        <Input label="Support email"     value={form.supportEmail}  disabled={fetching} onChange={set('supportEmail')} type="email" />
        <div>
          <Input label="Support phone (call)" value={form.supportPhone} disabled={fetching}
            hint="E.164 — e.g. +2348012345678" onChange={set('supportPhone')} />
        </div>
        <div>
          <Input label="WhatsApp number" value={form.supportWhatsapp} disabled={fetching}
            hint="Can differ from call number" onChange={set('supportWhatsapp')} />
          {form.supportPhone && form.supportPhone !== form.supportWhatsapp && (
            <button type="button"
              className="mt-1 text-xs text-primary-500 hover:text-primary-700 font-medium"
              onClick={() => setForm(f => ({ ...f, supportWhatsapp: f.supportPhone }))}>
              ← Copy from Support Phone
            </button>
          )}
        </div>
        <div className="sm:col-span-2">
          <Input label="Logo URL (CDN)" value={form.logoUrl} disabled={fetching}
            hint="Paste a publicly accessible image URL" onChange={set('logoUrl')} />
          {form.logoUrl && (
            <img src={form.logoUrl} alt="Logo preview"
              className="mt-2 h-8 w-auto rounded border border-gray-200 object-contain"
              onError={e => (e.currentTarget.style.display = 'none')} />
          )}
        </div>
      </div>

      {/* Maintenance */}
      <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Maintenance mode</p>
            <p className="text-xs text-gray-500 mt-0.5">Returns 503 on all customer/driver routes. Admin routes stay live.</p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, maintenance: !f.maintenance }))}
            className={cn('flex items-center gap-2 text-sm font-medium transition-colors',
              form.maintenance ? 'text-orange-600' : 'text-gray-400')}
          >
            {form.maintenance
              ? <><ToggleRight className="h-8 w-8" /><span>ON</span></>
              : <><ToggleLeft  className="h-8 w-8" /><span>OFF</span></>}
          </button>
        </div>

        {statusLabel && (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            {statusLabel}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
            <div className="flex gap-2">
              <input type="date" value={form.maintenanceStartsAt?.slice(0,10) ?? ''}
                onChange={e => {
                  const time = form.maintenanceStartsAt?.slice(11,16) || '00:00';
                  setForm(f => ({ ...f, maintenanceStartsAt: e.target.value ? `${e.target.value}T${time}` : '' }));
                }}
                className="flex-1 px-3 py-2 rounded-lg border border-orange-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
              <input type="time" value={form.maintenanceStartsAt?.slice(11,16) ?? ''}
                onChange={e => {
                  const date = form.maintenanceStartsAt?.slice(0,10) || '';
                  if (!date) return;
                  setForm(f => ({ ...f, maintenanceStartsAt: `${date}T${e.target.value}` }));
                }}
                className="w-28 px-3 py-2 rounded-lg border border-orange-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
            <div className="flex gap-2">
              <input type="date" value={form.maintenanceEndsAt?.slice(0,10) ?? ''}
                onChange={e => {
                  const time = form.maintenanceEndsAt?.slice(11,16) || '00:00';
                  setForm(f => ({ ...f, maintenanceEndsAt: e.target.value ? `${e.target.value}T${time}` : '' }));
                }}
                className="flex-1 px-3 py-2 rounded-lg border border-orange-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
              <input type="time" value={form.maintenanceEndsAt?.slice(11,16) ?? ''}
                onChange={e => {
                  const date = form.maintenanceEndsAt?.slice(0,10) || '';
                  if (!date) return;
                  setForm(f => ({ ...f, maintenanceEndsAt: `${date}T${e.target.value}` }));
                }}
                className="w-28 px-3 py-2 rounded-lg border border-orange-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
            </div>
          </div>
        </div>

        {(form.maintenance || form.maintenanceStartsAt || form.maintenanceEndsAt) && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Message shown to users</label>
            <textarea rows={2}
              className="w-full px-3 py-2 rounded-lg border border-orange-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              placeholder="e.g. Scheduled maintenance 2:00–5:00 AM WAT. We apologise for the inconvenience."
              value={form.maintenanceMessage}
              onChange={set('maintenanceMessage')} />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button loading={loading || fetching} onClick={handleSave}>
          <Save className="h-4 w-4" />Save changes
        </Button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGAL CONTENT SECTION
// ─────────────────────────────────────────────────────────────────────────────

const LEGAL_TABS: { key: LegalKey; label: string }[] = [
  { key: 'terms_content',   label: 'Terms of Service' },
  { key: 'privacy_content', label: 'Privacy Policy'   },
  { key: 'help_content',    label: 'Help Center'      },
];

const LEGAL_PLACEHOLDER: Record<LegalKey, string> = {
  terms_content:   '# Terms of Service\n\nLast updated: January 2025\n\n## 1. Acceptance of Terms\n\nBy using the Diakite app, you agree to these terms.',
  privacy_content: '# Privacy Policy\n\nLast updated: January 2025\n\n## What We Collect\n\n- **Account information** — name, phone number, email\n- **Location data** — only while the app is in use',
  help_content:    '# Help Center\n\n## Booking a Ride\n\n**How do I book a ride?**\nTap **Book a Ride**, enter your destination, choose your vehicle type, and confirm.',
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
      await settingsAPI.updateSettingsBatch([
        { key: 'terms_content',   value: content.terms_content,   category: 'legal' },
        { key: 'privacy_content', value: content.privacy_content, category: 'legal' },
        { key: 'help_content',    value: content.help_content,    category: 'legal' },
      ]);
      toast.success('Legal & Help content saved — live in the app immediately');
    } catch (err: any) { if (!err?._handled) toast.error('Failed to save content'); }
    finally { setLoading(false); }
  };

  const activeContent = content[activeTab];

  return (
    <div className="space-y-4">
      {fetching && <p className="text-xs text-gray-400 animate-pulse">Loading saved content…</p>}

      {/* Markdown cheatsheet */}
      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
        {[['# Title','Big heading'],['## Section','Section heading'],['**bold**','Bold'],['*italic*','Italic'],['- item','Bullet']].map(([syntax, desc]) => (
          <span key={syntax} className="flex items-center gap-1.5 bg-white border border-gray-200 px-2 py-1 rounded text-xs text-gray-600">
            <code className="font-mono text-primary-600">{syntax}</code>
            <span className="text-gray-400">→ {desc}</span>
          </span>
        ))}
      </div>

      {/* Page tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {LEGAL_TABS.map(tab => (
          <button key={tab.key}
            onClick={() => { setActiveTab(tab.key); setViewMode('edit'); }}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
              activeTab === tab.key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {activeContent
            ? <>{activeContent.length.toLocaleString()} chars · {activeContent.split('\n').length} lines</>
            : <span className="text-orange-500 font-medium">No content yet</span>
          }
        </p>
        <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
          {(['edit', 'preview'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all',
                viewMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}>
              {m === 'edit' ? '✏️ Edit' : '👁 Preview'}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'edit' ? (
        <textarea
          rows={16}
          disabled={fetching}
          placeholder={LEGAL_PLACEHOLDER[activeTab]}
          value={activeContent}
          onChange={e => setContent(c => ({ ...c, [activeTab]: e.target.value }))}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm font-mono
            leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-500
            bg-white resize-y disabled:opacity-50 disabled:cursor-wait text-gray-800"
          style={{ minHeight: 320 }}
        />
      ) : (
        <div
          className="w-full px-6 py-5 rounded-lg border border-gray-200 bg-white overflow-auto text-sm"
          style={{ minHeight: 320 }}
          dangerouslySetInnerHTML={{
            __html: activeContent.trim()
              ? markdownToHtml(activeContent)
              : '<p style="color:#9ca3af;font-style:italic">Nothing written yet.</p>',
          }}
        />
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button loading={loading || fetching} onClick={handleSave}>
          <Save className="h-4 w-4" />Save all three pages
        </Button>
        {!activeContent && (
          <button type="button"
            onClick={() => setContent(c => ({ ...c, [activeTab]: LEGAL_PLACEHOLDER[activeTab] }))}
            className="text-sm text-primary-500 hover:text-primary-700 font-medium">
            ← Load starter content
          </button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PRICING SECTION
// ─────────────────────────────────────────────────────────────────────────────

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
      .catch((err: any) => { if (!err?._handled) toast.error('Could not load saved pricing — showing defaults.'); })
      .finally(() => setFetching(false));
  }, []);

  const set = (key: keyof PricingState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues(v => ({ ...v, [key]: e.target.value }));

  const handleSave = async () => {
    const commissionKeys = ['platform_commission_rides', 'platform_commission_deliveries'] as const;
    for (const key of Object.keys(PRICING_DEFAULTS) as (keyof PricingState)[]) {
      const v = parseFloat(values[key]);
      if (isNaN(v) || v < 0) { toast.error(`Invalid value for ${key}`); return; }
      if (commissionKeys.includes(key as any) && v > 100) { toast.error(`Commission for ${key} cannot exceed 100%`); return; }
    }
    setLoading(true);
    try {
      await settingsAPI.updateSettingsBatch(
        (Object.keys(PRICING_DEFAULTS) as (keyof PricingState)[]).map(key => ({
          key,
          value: values[key],
          category: (['platform_commission_rides','platform_commission_deliveries'] as string[]).includes(key) ? 'platform' : 'pricing',
        }))
      );
      toast.success('Pricing saved — live on next fare request');
    } catch (err: any) { if (!err?._handled) toast.error('Failed to save pricing'); }
    finally { setLoading(false); }
  };

  const NumField = ({ label, k, prefix = '₦' }: { label: string; k: keyof PricingState; prefix?: string }) => (
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

  const VehicleBlock = ({ label, prefix }: { label: string; prefix: 'car'|'bike'|'van'|'tricycle' }) => (
    <>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 mt-4 col-span-full">{label}</p>
      <NumField label="Base Fare"        k={`ride_base_fare_${prefix}`        as keyof PricingState} />
      <NumField label="Per KM"           k={`ride_per_km_${prefix}`           as keyof PricingState} />
      <NumField label="Per Minute"       k={`ride_per_minute_${prefix}`       as keyof PricingState} />
      <NumField label="Minimum Fare"     k={`ride_minimum_fare_${prefix}`     as keyof PricingState} />
      <NumField label="Cancellation Fee" k={`ride_cancellation_fee_${prefix}` as keyof PricingState} />
    </>
  );

  return (
    <div>
      {fetching && <p className="text-xs text-gray-400 mb-4 animate-pulse">Loading current values…</p>}
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Rides</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <VehicleBlock label="Car"      prefix="car"      />
        <VehicleBlock label="Bike"     prefix="bike"     />
        <VehicleBlock label="Van"      prefix="van"      />
        <VehicleBlock label="Tricycle" prefix="tricycle" />
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 mt-4 col-span-full">Shared — applies to all vehicle types</p>
        <NumField label="Booking Fee (flat)"  k="ride_booking_fee" />
        <NumField label="Platform Commission" k="platform_commission_rides" prefix="%" />
      </div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3 mt-5">Deliveries</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <NumField label="Base Fee"            k="delivery_base_fee" />
        <NumField label="Per KM"              k="delivery_per_km" />
        <NumField label="Weight Fee / KG"     k="delivery_weight_fee_per_kg" />
        <NumField label="Platform Commission" k="platform_commission_deliveries" prefix="%" />
      </div>
      <Button loading={loading || fetching} onClick={handleSave}>
        <Save className="h-4 w-4" />Update pricing
      </Button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SURGE SECTION
// ─────────────────────────────────────────────────────────────────────────────

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
          try { setWindows(typeof val === 'string' ? JSON.parse(val) : val); }
          catch { toast.error('Surge window data is corrupted — showing defaults'); }
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await settingsAPI.updateSetting('surge_windows', JSON.stringify(windows), 'surge');
      toast.success('Surge windows saved');
    } catch (err: any) { if (!err?._handled) toast.error('Failed to save surge config'); }
    finally { setLoading(false); }
  };

  const update = (i: number, field: keyof SurgeWindow, val: any) =>
    setWindows(ws => ws.map((w, idx) => idx === i ? { ...w, [field]: val } : w));

  const toggleDay = (i: number, day: number) =>
    setWindows(ws => ws.map((w, idx) => idx !== i ? w : {
      ...w,
      days: w.days.includes(day) ? w.days.filter(d => d !== day) : [...w.days, day].sort(),
    }));

  return (
    <div>
      {fetching && <p className="text-xs text-gray-400 mb-4 animate-pulse">Loading…</p>}
      <div className="space-y-2">
        {windows.map((w, i) => (
          <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium text-gray-800 truncate">{w.label || 'Unnamed'}</span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">{w.multiplier}×</span>
                <span className="text-xs text-gray-500 hidden sm:block">{w.hourStart}:00–{w.hourEnd}:00 · {w.days.map(d => DAY_LABELS[d]).join(', ')}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); setWindows(ws => ws.filter((_,idx) => idx !== i)); }}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  Remove
                </button>
                <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform duration-200', expanded === i && 'rotate-180')} />
              </div>
            </div>
            {expanded === i && (
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={w.label} onChange={e => update(i, 'label', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start Hour (0–23)</label>
                  <input type="number" min={0} max={23}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={w.hourStart} onChange={e => update(i, 'hourStart', parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End Hour (1–24)</label>
                  <input type="number" min={1} max={24}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={w.hourEnd} onChange={e => update(i, 'hourEnd', parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Multiplier</label>
                  <input type="number" step={0.1} min={1} max={5}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={w.multiplier} onChange={e => update(i, 'multiplier', parseFloat(e.target.value))} />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <label className="block text-xs font-medium text-gray-500 mb-2">Active Days</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAY_LABELS.map((d, dayIdx) => (
                      <button key={d} onClick={() => toggleDay(i, dayIdx)}
                        className={cn(
                          'px-2 py-1 rounded text-xs font-medium transition-colors',
                          w.days.includes(dayIdx)
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                        )}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => setWindows(ws => [...ws, { label: 'New Window', days: [1,2,3,4,5], hourStart: 8, hourEnd: 10, multiplier: 1.2 }])}
          className="flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-600 font-medium"
        >
          <Plus className="h-4 w-4" />Add window
        </button>
        <Button loading={loading || fetching} onClick={handleSave}>
          <Save className="h-4 w-4" />Save surge config
        </Button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS SECTION
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
        settingsAPI.updateSetting('notifications_quiet_hours_start',     form.quietStart, 'notifications'),
        settingsAPI.updateSetting('notifications_quiet_hours_end',       form.quietEnd,   'notifications'),
        settingsAPI.updateSetting('notifications_max_broadcast_per_day', form.maxPerDay,  'notifications'),
      ]);
      toast.success('Notification settings saved');
    } catch (err: any) { if (!err?._handled) toast.error('Failed to save notification settings'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      {fetching && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([
          { label: 'Quiet hours start (0–23)', key: 'quietStart', hint: 'e.g. 23 = 11 PM' },
          { label: 'Quiet hours end (0–23)',   key: 'quietEnd',   hint: 'e.g. 7 = 7 AM'   },
          { label: 'Max broadcasts / user / day', key: 'maxPerDay', hint: 'Prevents notification fatigue' },
        ] as const).map(({ label, key, hint }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <input type="number" value={form[key]} disabled={fetching}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50" />
            <p className="text-xs text-gray-400 mt-1">{hint}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Quiet window: <strong>{form.quietStart}:00</strong> → <strong>{form.quietEnd}:00</strong> — no broadcasts sent
      </p>
      <Button loading={loading || fetching} onClick={handleSave}>
        <Save className="h-4 w-4" />Save notification settings
      </Button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// WALLET LIMITS SECTION
// ─────────────────────────────────────────────────────────────────────────────

const WalletLimitsSection: React.FC = () => {
  const [minDeposit, setMinDeposit] = useState('100');
  const [maxDeposit, setMaxDeposit] = useState('1000000');
  const [loading,    setLoading]    = useState(false);
  const [fetching,   setFetching]   = useState(true);

  useEffect(() => {
    settingsAPI.getSettings('wallet')
      .then(res => {
        const s = res.data?.settings ?? {};
        setMinDeposit(String(s['wallet_topup_min']?.value ?? '100'));
        setMaxDeposit(String(s['wallet_topup_max']?.value ?? '1000000'));
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleSave = async () => {
    const min = parseFloat(minDeposit);
    const max = parseFloat(maxDeposit);
    if (isNaN(min) || min < 100)   { toast.error('Minimum deposit cannot be less than ₦100'); return; }
    if (isNaN(max) || max < min)   { toast.error('Maximum must be greater than minimum'); return; }
    if (max > 10_000_000)          { toast.error('Maximum deposit cannot exceed ₦10,000,000'); return; }
    setLoading(true);
    try {
      await Promise.all([
        settingsAPI.updateSetting('wallet_topup_min', String(min), 'wallet'),
        settingsAPI.updateSetting('wallet_topup_max', String(max), 'wallet'),
      ]);
      toast.success('Deposit limits saved');
    } catch (err: any) { if (!err?._handled) toast.error('Failed to save deposit limits'); }
    finally { setLoading(false); }
  };

  const min = parseFloat(minDeposit) || 0;
  const max = parseFloat(maxDeposit) || 0;

  return (
    <div className="space-y-4">
      {fetching && <p className="text-xs text-gray-400 animate-pulse">Loading current limits…</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
        {([
          { label: 'Minimum deposit (₦)', value: minDeposit, setter: setMinDeposit, hint: 'Hard floor is ₦100', min: 100 },
          { label: 'Maximum deposit (₦)', value: maxDeposit, setter: setMaxDeposit, hint: 'Ceiling is ₦10,000,000', min: 0  },
        ] as const).map(({ label, value, setter, hint, min: inputMin }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">₦</span>
              <input type="number" min={inputMin} value={value} disabled={fetching}
                onChange={e => setter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50" />
            </div>
            <p className="text-xs text-gray-400 mt-1">{hint}</p>
          </div>
        ))}
      </div>

      {min > 0 && max > 0 && (
        <div className="inline-flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg">
          <DollarSign className="h-4 w-4 flex-shrink-0" />
          Customers can deposit between <strong>₦{min.toLocaleString('en-NG')}</strong> and <strong>₦{max.toLocaleString('en-NG')}</strong>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Quick presets for max limit</p>
        <div className="flex flex-wrap gap-2">
          {[50000, 100000, 500000, 1000000].map(preset => (
            <button key={preset} onClick={() => setMaxDeposit(String(preset))}
              className={cn(
                'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
                parseFloat(maxDeposit) === preset
                  ? 'bg-primary-50 border-primary-400 text-primary-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400',
              )}>
              ₦{preset.toLocaleString('en-NG')}
            </button>
          ))}
        </div>
      </div>

      <Button loading={loading || fetching} onClick={handleSave}>
        <Save className="h-4 w-4" />Save deposit limits
      </Button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD SECTION
// PwField is defined OUTSIDE PasswordSection so React doesn't recreate the
// component type on every render — avoids losing focus after each keystroke.
// ─────────────────────────────────────────────────────────────────────────────

interface PwFieldProps {
  label:    string;
  name:     'currentPassword' | 'newPassword' | 'confirmPassword';
  field:    'current' | 'next' | 'confirm';
  hint?:    string;
  value:    string;
  show:     boolean;
  onToggle: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PwField: React.FC<PwFieldProps> = ({ label, name, field, hint, value, show, onToggle, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <div className="relative">
      <input
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 text-sm
          focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
    {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
  </div>
);

const PasswordSection: React.FC = () => {
  const [form, setForm]       = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow]       = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const strength = getPasswordStrength(form.newPassword);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const toggle = (field: 'current' | 'next' | 'confirm') =>
    setShow(s => ({ ...s, [field]: !s[field] }));

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

  return (
    <div className="space-y-4 max-w-md">
      {error && <Alert variant="error">{error}</Alert>}

      <PwField
        label="Current password"
        name="currentPassword"
        field="current"
        value={form.currentPassword}
        show={show.current}
        onToggle={() => toggle('current')}
        onChange={handleChange}
      />

      <div>
        <PwField
          label="New password"
          name="newPassword"
          field="next"
          hint="Minimum 8 characters"
          value={form.newPassword}
          show={show.next}
          onToggle={() => toggle('next')}
          onChange={handleChange}
        />
        {form.newPassword && (
          <div className="mt-2">
            <div className="flex gap-1 mb-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors',
                  i <= strength.score ? strength.color : 'bg-gray-200')} />
              ))}
            </div>
            <p className={cn('text-xs font-medium',
              strength.score <= 1 ? 'text-red-500'
              : strength.score === 2 ? 'text-orange-400'
              : strength.score === 3 ? 'text-yellow-500'
              : 'text-green-600')}>
              {strength.label}
            </p>
          </div>
        )}
      </div>

      <PwField
        label="Confirm new password"
        name="confirmPassword"
        field="confirm"
        value={form.confirmPassword}
        show={show.confirm}
        onToggle={() => toggle('confirm')}
        onChange={handleChange}
      />

      <Button loading={loading} onClick={handleSubmit}>
        <Save className="h-4 w-4" />Update password
      </Button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING BONUS SECTION
// ─────────────────────────────────────────────────────────────────────────────

const OnboardingBonusSection: React.FC = () => {
  const [driverBonus,  setDriverBonus]  = useState('5000');
  const [partnerBonus, setPartnerBonus] = useState('5000');
  const [loading,      setLoading]      = useState(false);
  const [previewing,   setPreviewing]   = useState(false);
  const [preview,      setPreview]      = useState<{
    drivers:  { eligible: number; total: number; alreadyBonused: number; totalWalletBalance: number };
    partners: { eligible: number; total: number; alreadyBonused: number; totalWalletBalance: number };
  } | null>(null);
  const [result,      setResult]      = useState<{ drivers: number; partners: number } | null>(null);
  const [logs,        setLogs]        = useState<any[]>([]);
  const [logsOpen,    setLogsOpen]    = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => { setPreview(null); }, [driverBonus, partnerBonus]);

  const handlePreview = async () => {
    setPreviewing(true); setPreview(null); setResult(null);
    try {
      const res = await api.get('/admin/bonuses/onboarding/preview');
      setPreview(res.data.data);
    } catch (err: any) { if (!err?._handled) toast.error('Preview failed'); }
    finally { setPreviewing(false); }
  };

  const handleDisbursement = async () => {
    const dAmt = parseFloat(driverBonus);
    const pAmt = parseFloat(partnerBonus);
    if (isNaN(dAmt) || isNaN(pAmt) || dAmt < 0 || pAmt < 0) { toast.error('Enter valid bonus amounts'); return; }
    if (!preview) { toast.error('Run a preview first'); return; }
    const totalEligible = preview.drivers.eligible + preview.partners.eligible;
    if (totalEligible === 0) { toast.error('No eligible recipients'); return; }
    setLoading(true); setResult(null);
    try {
      const res = await api.post('/admin/bonuses/onboarding', { driverBonus: dAmt, partnerBonus: pAmt });
      setResult(res.data.data);
      setPreview(null);
      toast.success(`Bonuses sent to ${res.data.data.drivers + res.data.data.partners} recipients`);
    } catch (err: any) {
      if (!err?._handled) toast.error(err?.response?.data?.message || 'Failed to disburse bonuses');
    } finally { setLoading(false); }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await api.get('/admin/logs?action=onboarding_bonus_disbursed&limit=10');
      setLogs(res.data.data?.logs ?? []);
    } catch (err: any) { if (!err?._handled) toast.error('Could not load history'); }
    finally { setLogsLoading(false); }
  };

  const totalEligible = preview ? preview.drivers.eligible + preview.partners.eligible : 0;
  const totalPayout   = preview
    ? (preview.drivers.eligible  * parseFloat(driverBonus  || '0')) +
      (preview.partners.eligible * parseFloat(partnerBonus || '0'))
    : 0;

  return (
    <div className="space-y-4">
      <Alert variant="info">
        Only approved drivers/partners who have <strong>never previously received</strong> an onboarding bonus are eligible.
        The bonus is <strong>non-withdrawable</strong>.
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-sm">
        {([
          { label: 'Driver bonus (₦)',  value: driverBonus,  setter: setDriverBonus  },
          { label: 'Partner bonus (₦)', value: partnerBonus, setter: setPartnerBonus },
        ] as const).map(({ label, value, setter }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
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
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-gray-200">
            {([
              { label: 'Drivers',  data: preview.drivers,  amount: driverBonus  },
              { label: 'Partners', data: preview.partners, amount: partnerBonus },
            ] as const).map(({ label, data, amount }) => (
              <div key={label} className="p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{data.eligible}</p>
                <p className="text-xs text-gray-500">of {data.total} approved eligible</p>
                {data.alreadyBonused > 0 && (
                  <p className="text-xs text-orange-500 mt-0.5">{data.alreadyBonused} already received bonus</p>
                )}
                <p className="text-xs font-medium text-green-600 mt-2">
                  Payout: ₦{(data.eligible * parseFloat(amount || '0')).toLocaleString('en-NG')}
                </p>
              </div>
            ))}
          </div>
          {totalEligible > 0 ? (
            <div className="px-4 py-3 bg-green-50 border-t border-gray-200 flex items-center justify-between">
              <p className="text-xs text-gray-600">{totalEligible} recipient{totalEligible !== 1 ? 's' : ''} will be credited</p>
              <p className="text-sm font-bold text-green-700">Total: ₦{totalPayout.toLocaleString('en-NG')}</p>
            </div>
          ) : (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500">All approved drivers and partners have already received an onboarding bonus.</p>
            </div>
          )}
        </div>
      )}

      {result && (
        <Alert variant="success">
          ✅ <strong>{result.drivers}</strong> driver(s) and <strong>{result.partners}</strong> partner(s) credited.
        </Alert>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="secondary" loading={previewing} onClick={handlePreview}>
          <Search className="h-4 w-4" />Preview eligible
        </Button>
        <Button loading={loading} onClick={handleDisbursement} disabled={!preview || totalEligible === 0}>
          <Gift className="h-4 w-4" />
          {totalEligible > 0
            ? `Disburse ₦${totalPayout.toLocaleString('en-NG')} to ${totalEligible} recipient${totalEligible !== 1 ? 's' : ''}`
            : 'Disburse bonuses'}
        </Button>
      </div>

      {/* Disbursement history */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => { if (!logsOpen && logs.length === 0) loadLogs(); setLogsOpen(o => !o); }}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ClipboardList className="h-4 w-4" />Disbursement history
          <ChevronDown className={cn('h-4 w-4 transition-transform', logsOpen && 'rotate-180')} />
        </button>
        {logsOpen && (
          <div className="mt-3">
            {logsLoading && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}
            {!logsLoading && logs.length === 0 && <p className="text-xs text-gray-400">No disbursements yet.</p>}
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
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM BONUS SECTION
// ─────────────────────────────────────────────────────────────────────────────

const CustomBonusSection: React.FC = () => {
  const [recipients,  setRecipients]  = useState<Recipient[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [roleFilter,  setRoleFilter]  = useState<RoleFilter>('both');
  const [searchTerm,  setSearchTerm]  = useState('');
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [amount,      setAmount]      = useState('');
  const [description, setDescription] = useState('');
  const [nonWithdraw, setNonWithdraw] = useState(true);
  const [sending,     setSending]     = useState(false);
  const [loaded,      setLoaded]      = useState(false);

  const loadRecipients = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = { isApproved: 'true', limit: 500, page: 1 };
      const [driversRes, partnersRes] = await Promise.all([
        roleFilter !== 'DELIVERY_PARTNER' ? api.get('/admin/drivers',  { params }) : null,
        roleFilter !== 'DRIVER'           ? api.get('/admin/partners', { params }) : null,
      ]);
      const mapped: Recipient[] = [
        ...(driversRes?.data?.data?.drivers ?? []).map((d: any) => ({
          walletUserId: d.user.id,
          name:         `${d.user.firstName} ${d.user.lastName}`,
          email:        d.user.email,
          role:         'DRIVER' as const,
          isOnline:     d.isOnline,
        })),
        ...(partnersRes?.data?.data?.partners ?? []).map((p: any) => ({
          walletUserId: p.user.id,
          name:         `${p.user.firstName} ${p.user.lastName}`,
          email:        p.user.email,
          role:         'DELIVERY_PARTNER' as const,
          isOnline:     p.isOnline,
        })),
      ];
      setRecipients(mapped);
      setSelected(new Set());
    } catch {
      toast.error('Failed to load recipients');
    } finally {
      setLoadingList(false);
    }
  }, [roleFilter]);

  const handleLoad = () => {
    if (!loaded) { setLoaded(true); loadRecipients(); }
  };

  useEffect(() => {
    if (loaded) loadRecipients();
  }, [roleFilter]);

  const filtered = recipients.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOne = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(r => r.walletUserId)));

  const handleDisburse = async () => {
    if (selected.size === 0)     { toast.error('Select at least one recipient'); return; }
    if (!+amount || +amount < 1) { toast.error('Enter a valid amount (min ₦1)'); return; }
    setSending(true);
    try {
      const res = await api.post('/admin/bonuses/disburse', {
        userIds:         Array.from(selected),
        amount:          +amount,
        description:     description.trim() || undefined,
        nonWithdrawable: nonWithdraw,
      });
      toast.success(`₦${(+amount).toLocaleString('en-NG')} credited to ${res.data.data.credited} recipient(s)`);
      setSelected(new Set());
      setAmount('');
      setDescription('');
    } catch (err: any) {
      if (!err?._handled) toast.error(err?.response?.data?.message || 'Disbursement failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {!loaded ? (
        <div className="flex flex-col items-center py-6 gap-3 text-gray-400">
          <Gift className="h-8 w-8" />
          <p className="text-sm">Load the recipient list to get started</p>
          <Button onClick={handleLoad}>
            <RefreshCw className="h-4 w-4" />Load recipients
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input placeholder="Search by name or email…" value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as RoleFilter)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="both">Drivers &amp; Partners</option>
              <option value="DRIVER">Drivers only</option>
              <option value="DELIVERY_PARTNER">Partners only</option>
            </select>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <label className="flex items-center gap-2.5 text-xs font-medium text-gray-600 cursor-pointer select-none">
                <input type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-primary-600" />
                Select all ({filtered.length})
              </label>
              {selected.size > 0 && (
                <span className="text-xs font-semibold text-primary-600">{selected.size} selected</span>
              )}
            </div>

            <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
              {loadingList ? (
                <p className="text-xs text-gray-400 text-center py-8 animate-pulse">Loading recipients…</p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No approved drivers or partners found.</p>
              ) : filtered.map(r => (
                <label key={r.walletUserId}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                    selected.has(r.walletUserId) ? 'bg-primary-50' : 'hover:bg-gray-50',
                  )}>
                  <input type="checkbox" checked={selected.has(r.walletUserId)}
                    onChange={() => toggleOne(r.walletUserId)}
                    className="rounded border-gray-300 text-primary-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                    <p className="text-xs text-gray-400 truncate">{r.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                      r.role === 'DRIVER' ? 'bg-blue-50 text-blue-600' : 'bg-yellow-50 text-yellow-700')}>
                      {r.role === 'DRIVER' ? 'Driver' : 'Partner'}
                    </span>
                    {r.isOnline && (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Online
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {selected.size > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <p className="text-sm font-semibold text-gray-700">
                Configure bonus for {selected.size} recipient{selected.size !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Amount per recipient (₦)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                    <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="e.g. 3000"
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  {amount && +amount > 0 && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      Total payout: ₦{(+amount * selected.size).toLocaleString('en-NG')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description (optional)</label>
                  <input value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="e.g. Weekend performance bonus" maxLength={300}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <input id="nw-toggle" type="checkbox" checked={nonWithdraw}
                  onChange={e => setNonWithdraw(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-amber-600" />
                <label htmlFor="nw-toggle" className="text-xs cursor-pointer">
                  <span className="font-semibold text-amber-800 block">Non-withdrawable</span>
                  <span className="text-amber-700">Recipients can only spend this on rides or deliveries — not withdraw as cash.</span>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelected(new Set())}
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                  Clear selection
                </button>
                <Button loading={sending} onClick={handleDisburse}>
                  <Gift className="h-4 w-4" />Disburse to {selected.size} recipient{selected.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG SECTION
// ─────────────────────────────────────────────────────────────────────────────

const AuditLogSection: React.FC = () => {
  const [logs,    setLogs]    = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/logs?entityType=SystemSettings&limit=15');
      setLogs(res.data.data?.logs ?? []);
    } catch (err: any) { if (!err?._handled) toast.error('Could not load audit log'); }
    finally { setLoading(false); }
  }, []);

  const handleLoad = () => {
    if (!loaded) { setLoaded(true); load(); }
    else load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={handleLoad}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          {loaded ? 'Refresh' : 'Load log'}
        </button>
      </div>

      {!loaded && (
        <p className="text-xs text-gray-400 text-center py-6">Click "Load log" to fetch recent changes.</p>
      )}
      {loaded && loading && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}
      {loaded && !loading && logs.length === 0 && (
        <p className="text-xs text-gray-400">No settings changes recorded yet.</p>
      )}
      {loaded && !loading && logs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Key</th>
                <th className="pb-2 font-medium">New value</th>
                <th className="pb-2 font-medium">Changed by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log, i) => (
                <tr key={i} className="text-gray-700">
                  <td className="py-2 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('en-NG')}</td>
                  <td className="py-2 font-mono text-primary-600">{log.details?.key ?? '—'}</td>
                  <td className="py-2 font-mono">
                    {String(log.details?.value ?? '—').slice(0,60)}
                    {String(log.details?.value ?? '').length > 60 ? '…' : ''}
                  </td>
                  <td className="py-2">{log.user?.firstName} {log.user?.lastName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DANGER ZONE SECTION
// ─────────────────────────────────────────────────────────────────────────────

const DangerZoneSection: React.FC = () => {
  const [cacheLoading, setCacheLoading] = useState(false);

  const clearFareCache = async () => {
    if (!window.confirm('Force-clear the fare engine cache? Next fare request will reload all pricing from DB.')) return;
    setCacheLoading(true);
    try {
      await api.post('/admin/settings/invalidate-cache');
      toast.success('Fare cache cleared');
    } catch (err: any) { if (!err?._handled) toast.error('Failed to clear fare cache'); }
    finally { setCacheLoading(false); }
  };

  return (
    <div className="space-y-3">
      <Alert variant="warning">
        These actions affect all users immediately and cannot be undone automatically.
      </Alert>
      <div className="flex items-center justify-between border border-red-200 bg-red-50 rounded-lg px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Clear fare engine cache</p>
          <p className="text-xs text-gray-500 mt-0.5">Forces the fare engine to reload all pricing from DB on the next request.</p>
        </div>
        <Button variant="danger" loading={cacheLoading} onClick={clearFareCache} className="ml-4 shrink-0">
          <RefreshCw className="h-4 w-4" />Clear cache
        </Button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CARD DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

interface CardDef {
  id:         string;
  icon:       React.ReactNode;
  title:      string;
  subtitle:   string;
  component:  React.ReactNode;
  superAdmin?: boolean;
  danger?:    boolean;
  wide?:      boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE ROOT
// ─────────────────────────────────────────────────────────────────────────────

const GeneralSettings: React.FC = () => {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [openCard, setOpenCard] = useState<string | null>(null);

  const toggleCard = (id: string) =>
    setOpenCard(prev => (prev === id ? null : id));

  const CARDS: CardDef[] = [
    {
      id: 'platform',
      icon: <Building2 className="h-4 w-4" />,
      title: 'Platform',
      subtitle: 'Brand name, contact info, and maintenance mode',
      component: <PlatformSection />,
    },
    {
      id: 'legal',
      icon: <FileText className="h-4 w-4" />,
      title: 'Legal & Help',
      subtitle: 'Terms of service, privacy policy, help center content',
      component: <LegalContentSection />,
    },
    {
      id: 'notifications',
      icon: <Bell className="h-4 w-4" />,
      title: 'Notifications',
      subtitle: 'Quiet hours and broadcast frequency limits',
      component: <NotificationsSection />,
    },
    {
      id: 'password',
      icon: <Lock className="h-4 w-4" />,
      title: 'Change password',
      subtitle: 'Update your administrator account password',
      component: <PasswordSection />,
    },
    {
      id: 'audit',
      icon: <ClipboardList className="h-4 w-4" />,
      title: 'Audit log',
      subtitle: 'Recent changes to platform configuration',
      component: <AuditLogSection />,
    },
    ...(isSuperAdmin ? [
      {
        id: 'onboarding-bonus',
        icon: <Gift className="h-4 w-4" />,
        title: 'Onboarding bonus',
        subtitle: "Credit approved drivers & partners who haven't received one yet",
        component: <OnboardingBonusSection />,
        superAdmin: true,
      },
      {
        id: 'pricing',
        icon: <DollarSign className="h-4 w-4" />,
        title: 'Fare pricing',
        subtitle: 'Base fares, per-km rates, commissions — live on next fare request',
        component: <PricingSection />,
        wide: true,
        superAdmin: true,
      },
      {
        id: 'surge',
        icon: <Zap className="h-4 w-4" />,
        title: 'Surge windows',
        subtitle: 'Dynamic pricing schedules stored in DB',
        component: <SurgeSection />,
        superAdmin: true,
      },
      {
        id: 'wallet',
        icon: <Wallet className="h-4 w-4" />,
        title: 'Wallet limits',
        subtitle: 'Min/max top-up amounts per transaction',
        component: <WalletLimitsSection />,
        superAdmin: true,
      },
      {
        id: 'custom-bonus',
        icon: <Gift className="h-4 w-4" />,
        title: 'Custom bonus',
        subtitle: 'Credit specific drivers or partners a custom amount',
        component: <CustomBonusSection />,
        superAdmin: true,
      },
      {
        id: 'danger',
        icon: <ShieldAlert className="h-4 w-4" />,
        title: 'Danger zone',
        subtitle: 'Irreversible platform-wide actions — proceed with care',
        component: <DangerZoneSection />,
        superAdmin: true,
        danger: true,
      },
    ] as CardDef[] : []),
  ];

  const regularCards    = CARDS.filter(c => !c.superAdmin);
  const superAdminCards = CARDS.filter(c => c.superAdmin);

  const renderCard = (card: CardDef) => (
    <SettingCard
      key={card.id}
      id={card.id}
      icon={card.icon}
      title={card.title}
      subtitle={card.subtitle}
      isOpen={openCard === card.id}
      onToggle={toggleCard}
      badge={card.superAdmin ? <SuperAdminBadge /> : undefined}
      wide={card.wide}
      danger={card.danger}
    >
      {card.component}
    </SettingCard>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-1">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Manage platform configuration, pricing, and security. Click any card to expand.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {regularCards.map(renderCard)}
      </div>

      {isSuperAdmin && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
              <Lock className="h-3 w-3" />Super admin only
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {superAdminCards.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralSettings;