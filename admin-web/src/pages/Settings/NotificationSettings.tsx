import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Alert } from '@/components/common';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

interface NotificationSettings {
  email: {
    newUserRegistration: boolean;
    driverApplication: boolean;
    paymentReceived: boolean;
    systemAlerts: boolean;
  };
  push: {
    rideRequested: boolean;
    deliveryAssigned: boolean;
    emergencyAlerts: boolean;
  };
  sms: {
    enabled: boolean;
    criticalOnly: boolean;
  };
  emailTemplates: {
    welcomeEmail: string;
    driverApproval: string;
    rideConfirmation: string;
  };
}

const NotificationSettings: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    email: {
      newUserRegistration: true,
      driverApplication: true,
      paymentReceived: true,
      systemAlerts: true,
    },
    push: {
      rideRequested: true,
      deliveryAssigned: true,
      emergencyAlerts: true,
    },
    sms: {
      enabled: true,
      criticalOnly: true,
    },
    emailTemplates: {
      welcomeEmail: 'Welcome to DuoRide! We\'re excited to have you...',
      driverApproval: 'Congratulations! Your driver application has been approved...',
      rideConfirmation: 'Your ride has been confirmed...',
    },
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // API call to save settings
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Notification settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleEmailSetting = (key: keyof NotificationSettings['email']) => {
    setSettings({
      ...settings,
      email: {
        ...settings.email,
        [key]: !settings.email[key],
      },
    });
  };

  const togglePushSetting = (key: keyof NotificationSettings['push']) => {
    setSettings({
      ...settings,
      push: {
        ...settings.push,
        [key]: !settings.push[key],
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
        <p className="text-gray-600 mt-1">Configure notification preferences and email templates</p>
      </div>

      {/* Email Notifications */}
      <Card>
        <div className="flex items-center mb-4">
          <Mail className="h-5 w-5 text-primary-500 mr-2" />
          <h3 className="text-lg font-semibold">Email Notifications</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">New User Registration</p>
              <p className="text-sm text-gray-600">Receive emails when new users sign up</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.email.newUserRegistration}
                onChange={() => toggleEmailSetting('newUserRegistration')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Driver Applications</p>
              <p className="text-sm text-gray-600">Get notified about new driver applications</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.email.driverApplication}
                onChange={() => toggleEmailSetting('driverApplication')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Payment Received</p>
              <p className="text-sm text-gray-600">Notifications for completed payments</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.email.paymentReceived}
                onChange={() => toggleEmailSetting('paymentReceived')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">System Alerts</p>
              <p className="text-sm text-gray-600">Critical system alerts and errors</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.email.systemAlerts}
                onChange={() => toggleEmailSetting('systemAlerts')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>
        </div>
      </Card>

      {/* Push Notifications */}
      <Card>
        <div className="flex items-center mb-4">
          <Bell className="h-5 w-5 text-primary-500 mr-2" />
          <h3 className="text-lg font-semibold">Push Notifications</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Ride Requested</p>
              <p className="text-sm text-gray-600">New ride requests</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.push.rideRequested}
                onChange={() => togglePushSetting('rideRequested')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Delivery Assigned</p>
              <p className="text-sm text-gray-600">Partner delivery assignments</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.push.deliveryAssigned}
                onChange={() => togglePushSetting('deliveryAssigned')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Emergency Alerts</p>
              <p className="text-sm text-gray-600">Critical emergency notifications</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.push.emergencyAlerts}
                onChange={() => togglePushSetting('emergencyAlerts')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>
        </div>
      </Card>

      {/* Email Templates */}
      <Card>
        <div className="flex items-center mb-4">
          <MessageSquare className="h-5 w-5 text-primary-500 mr-2" />
          <h3 className="text-lg font-semibold">Email Templates</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Welcome Email
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={4}
              value={settings.emailTemplates.welcomeEmail}
              onChange={(e) => setSettings({
                ...settings,
                emailTemplates: {
                  ...settings.emailTemplates,
                  welcomeEmail: e.target.value,
                },
              })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Driver Approval Email
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={4}
              value={settings.emailTemplates.driverApproval}
              onChange={(e) => setSettings({
                ...settings,
                emailTemplates: {
                  ...settings.emailTemplates,
                  driverApproval: e.target.value,
                },
              })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ride Confirmation Email
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={4}
              value={settings.emailTemplates.rideConfirmation}
              onChange={(e) => setSettings({
                ...settings,
                emailTemplates: {
                  ...settings.emailTemplates,
                  rideConfirmation: e.target.value,
                },
              })}
            />
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} size="lg">
          Save All Settings
        </Button>
      </div>
    </div>
  );
};

export default NotificationSettings;