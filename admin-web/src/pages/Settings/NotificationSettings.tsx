// admin-web/src/pages/Settings/NotificationSettings.tsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert } from '@/components/common';
import { Bell, Mail, MessageSquare, Save } from 'lucide-react';
import { settingsAPI } from '@/services/api/settings';
import toast from 'react-hot-toast';

const NotificationSettings: React.FC = () => {
  const [form, setForm] = useState({
    quietStart: '23',
    quietEnd:   '7',
    maxPerDay:  '3',
  });
  const [fetching, setFetching] = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    settingsAPI.getSettings('notifications')
      .then(res => {
        const s = res.data?.settings ?? {};
        setForm(f => ({
          quietStart: String(s['notifications_quiet_hours_start']?.value    ?? f.quietStart),
          quietEnd:   String(s['notifications_quiet_hours_end']?.value      ?? f.quietEnd),
          maxPerDay:  String(s['notifications_max_broadcast_per_day']?.value ?? f.maxPerDay),
        }));
      })
      .catch(() => toast.error('Could not load notification settings'))
      .finally(() => setFetching(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        settingsAPI.updateSetting('notifications_quiet_hours_start',     form.quietStart),
        settingsAPI.updateSetting('notifications_quiet_hours_end',       form.quietEnd),
        settingsAPI.updateSetting('notifications_max_broadcast_per_day', form.maxPerDay),
      ]);
      toast.success('Notification settings saved');
    } catch {
      toast.error('Failed to save notification settings');
    } finally { setSaving(false); }
  };

  const Field = ({ label, value, hint, onChange }: {
    label: string; value: string; hint?: string; onChange: (v: string) => void;
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type="number" value={value} disabled={fetching}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50" />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
        <p className="text-gray-600 mt-1">Control broadcast frequency and quiet hours</p>
      </div>

      {fetching && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}

      {/* Broadcast controls — DB-backed */}
      <Card>
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
          <Bell className="h-5 w-5 text-primary-500" />
          <h3 className="text-base font-semibold text-gray-900">Broadcast Controls</h3>
        </div>

        <Alert variant="info" className="mb-5">
          <strong>Backend enforcement required:</strong> <code>notification.service.js</code> must
          read these settings before dispatching broadcasts. Transactional notifications
          (ride accepted, payment received, etc.) always bypass quiet hours.
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-xl">
          <Field label="Quiet Hours Start (0–23)" value={form.quietStart}
            hint="e.g. 23 = 11 PM" onChange={v => setForm(f => ({ ...f, quietStart: v }))} />
          <Field label="Quiet Hours End (0–23)" value={form.quietEnd}
            hint="e.g. 7 = 7 AM" onChange={v => setForm(f => ({ ...f, quietEnd: v }))} />
          <Field label="Max Broadcasts / User / Day" value={form.maxPerDay}
            hint="Prevents notification fatigue" onChange={v => setForm(f => ({ ...f, maxPerDay: v }))} />
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Quiet window: <strong>{form.quietStart}:00</strong> → <strong>{form.quietEnd}:00</strong> — no broadcasts sent during this period.
        </p>

        <div className="mt-5">
          <Button loading={saving || fetching} onClick={handleSave}>
            <Save className="h-4 w-4" />Save Notification Settings
          </Button>
        </div>
      </Card>

      {/* Email / SMS toggles — UI only, no backend storage yet */}
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
          <Mail className="h-5 w-5 text-primary-500" />
          <div>
            <h3 className="text-base font-semibold text-gray-900">Email & SMS Preferences</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              UI only — connect to an email/SMS provider (Resend, Termii, etc.) to activate.
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Email and SMS notification channels are not yet configured.
          When an email provider is integrated, toggles and templates will be stored here.
        </p>
      </Card>

      {/* Email templates — placeholder */}
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
          <MessageSquare className="h-5 w-5 text-primary-500" />
          <div>
            <h3 className="text-base font-semibold text-gray-900">Email Templates</h3>
            <p className="text-xs text-gray-400 mt-0.5">Not yet connected to an email provider.</p>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Add a transactional email provider (Resend, SendGrid, Mailgun) to the backend,
          then wire template editing here via <code className="text-xs bg-gray-100 px-1 rounded">SystemSettings</code> keys.
        </p>
      </Card>
    </div>
  );
};

export default NotificationSettings;