import React, { useState, useEffect } from 'react';
import { adminService } from '../services/admin.service';

interface SystemSettings {
  maintenance: {
    enabled: boolean;
    message: string;
    scheduledStart?: string;
    scheduledEnd?: string;
  };
  features: {
    userRegistration: boolean;
    pitchSubmission: boolean;
    payments: boolean;
    messaging: boolean;
    ndaWorkflow: boolean;
    realTimeUpdates: boolean;
  };
  limits: {
    maxPitchesPerUser: number;
    maxFileUploadSize: number; // in MB
    maxDocumentsPerPitch: number;
    sessionTimeout: number; // in minutes
  };
  pricing: {
    creditPrices: {
      single: number;
      pack5: number;
      pack10: number;
      pack25: number;
    };
    subscriptionPlans: {
      basic: { monthly: number; yearly: number };
      premium: { monthly: number; yearly: number };
      enterprise: { monthly: number; yearly: number };
    };
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    weeklyDigest: boolean;
  };
  security: {
    enforceStrongPasswords: boolean;
    twoFactorRequired: boolean;
    sessionSecurity: 'normal' | 'strict';
    apiRateLimit: number; // requests per minute
  };
}

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await adminService.getSystemSettings() as any;
      // Normalize: API returns { settings: {...} } — extract inner object
      const raw = data?.settings ?? data?.data ?? data ?? {};
      setSettings(raw);
    } catch (err) {
      setError('Failed to load system settings');
      console.error('Settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updatedSettings: SystemSettings) => {
    try {
      setSaving(true);
      await adminService.updateSystemSettings(updatedSettings);
      setSettings(updatedSettings);
      setSuccessMessage('Settings updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to save settings');
      console.error('Save settings error:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (path: string, value: any) => {
    if (!settings) return;

    const newSettings = { ...settings };
    const keys = path.split('.');
    let current: any = newSettings;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    setSettings(newSettings);
  };

  const tabs = [
    { id: 'general', name: 'General', icon: '⚙️' },
    { id: 'features', name: 'Features', icon: '🔧' },
    { id: 'limits', name: 'Limits', icon: '📊' },
    { id: 'pricing', name: 'Pricing', icon: '💰' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    { id: 'security', name: 'Security', icon: '🔒' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Settings</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadSettings}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">System Settings</h1>
          <p className="text-gray-600">Configure platform settings and features</p>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-600">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">General Settings</h2>

                {/* Maintenance Mode */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">Maintenance Mode</h3>
                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.maintenance.enabled}
                        onChange={(e) => updateSetting('maintenance.enabled', e.target.checked)}
                        className="mr-3"
                      />
                      <span>Enable maintenance mode</span>
                    </label>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maintenance Message
                      </label>
                      <textarea
                        value={settings.maintenance.message}
                        onChange={(e) => updateSetting('maintenance.message', e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Message to display during maintenance..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Scheduled Start
                        </label>
                        <input
                          type="datetime-local"
                          value={settings.maintenance.scheduledStart || ''}
                          onChange={(e) => updateSetting('maintenance.scheduledStart', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Scheduled End
                        </label>
                        <input
                          type="datetime-local"
                          value={settings.maintenance.scheduledEnd || ''}
                          onChange={(e) => updateSetting('maintenance.scheduledEnd', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Features Tab */}
            {activeTab === 'features' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Feature Toggles</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(settings.features).map(([key, value]) => (
                    <div key={key} className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center justify-between">
                        <span className="font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => updateSetting(`features.${key}`, e.target.checked)}
                          className="ml-3"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Limits Tab */}
            {activeTab === 'limits' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">System Limits</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Pitches Per User
                    </label>
                    <input
                      type="number"
                      value={settings.limits.maxPitchesPerUser}
                      onChange={(e) => updateSetting('limits.maxPitchesPerUser', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max File Upload Size (MB)
                    </label>
                    <input
                      type="number"
                      value={settings.limits.maxFileUploadSize}
                      onChange={(e) => updateSetting('limits.maxFileUploadSize', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      min="1"
                      max="100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Documents Per Pitch
                    </label>
                    <input
                      type="number"
                      value={settings.limits.maxDocumentsPerPitch}
                      onChange={(e) => updateSetting('limits.maxDocumentsPerPitch', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      value={settings.limits.sessionTimeout}
                      onChange={(e) => updateSetting('limits.sessionTimeout', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      min="5"
                      max="1440"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Pricing Tab */}
            {activeTab === 'pricing' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Pricing Configuration</h2>

                {/* Credit Prices */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">Credit Prices (USD)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Single Credit
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={settings.pricing.creditPrices.single}
                        onChange={(e) => updateSetting('pricing.creditPrices.single', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        5-Pack Credits
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={settings.pricing.creditPrices.pack5}
                        onChange={(e) => updateSetting('pricing.creditPrices.pack5', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        10-Pack Credits
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={settings.pricing.creditPrices.pack10}
                        onChange={(e) => updateSetting('pricing.creditPrices.pack10', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        25-Pack Credits
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={settings.pricing.creditPrices.pack25}
                        onChange={(e) => updateSetting('pricing.creditPrices.pack25', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Subscription Plans */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">Subscription Plans (USD)</h3>
                  <div className="space-y-4">
                    {Object.entries(settings.pricing.subscriptionPlans).map(([plan, prices]) => (
                      <div key={plan} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                        <div className="font-medium capitalize">{plan}</div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Monthly</label>
                          <input
                            type="number"
                            step="0.01"
                            value={prices.monthly}
                            onChange={(e) => updateSetting(`pricing.subscriptionPlans.${plan}.monthly`, Number(e.target.value))}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Yearly</label>
                          <input
                            type="number"
                            step="0.01"
                            value={prices.yearly}
                            onChange={(e) => updateSetting(`pricing.subscriptionPlans.${plan}.yearly`, Number(e.target.value))}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Notification Settings</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(settings.notifications).map(([key, value]) => (
                    <div key={key} className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center justify-between">
                        <span className="font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => updateSetting(`notifications.${key}`, e.target.checked)}
                          className="ml-3"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Security Settings</h2>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center justify-between">
                        <span className="font-medium">Enforce Strong Passwords</span>
                        <input
                          type="checkbox"
                          checked={settings.security.enforceStrongPasswords}
                          onChange={(e) => updateSetting('security.enforceStrongPasswords', e.target.checked)}
                          className="ml-3"
                        />
                      </label>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center justify-between">
                        <span className="font-medium">Two-Factor Required</span>
                        <input
                          type="checkbox"
                          checked={settings.security.twoFactorRequired}
                          onChange={(e) => updateSetting('security.twoFactorRequired', e.target.checked)}
                          className="ml-3"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Session Security Level
                      </label>
                      <select
                        value={settings.security.sessionSecurity}
                        onChange={(e) => updateSetting('security.sessionSecurity', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="normal">Normal</option>
                        <option value="strict">Strict</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Rate Limit (requests/minute)
                      </label>
                      <input
                        type="number"
                        value={settings.security.apiRateLimit}
                        onChange={(e) => updateSetting('security.apiRateLimit', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        min="10"
                        max="1000"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-end">
              <button
                onClick={() => saveSettings(settings)}
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;