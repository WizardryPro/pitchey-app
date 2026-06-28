/**
 * Notification Preferences - Comprehensive settings panel for all notification types
 */

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Mail, 
  Smartphone, 
  MessageSquare, 
  Clock, 
  Volume, 
  VolumeX,
  Globe,
  DollarSign,
  FileText,
  TrendingUp,
  Briefcase,
  Info,
  Save,
  RefreshCw,
  Check,
  X,
  Settings,
  Moon,
  Sun,
  ChevronDown,
  ChevronUp,
  TestTube,
  Zap,
  Shield
} from 'lucide-react';

export interface NotificationPreferences {
  // Global toggles
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  smsEnabled: boolean;

  // Category-specific preferences
  investmentAlerts: {
    email: boolean;
    push: boolean;
    in_app: boolean;
    sms: boolean;
  };
  projectUpdates: {
    email: boolean;
    push: boolean;
    in_app: boolean;
    sms: boolean;
  };
  systemAlerts: {
    email: boolean;
    push: boolean;
    in_app: boolean;
    sms: boolean;
  };
  analyticsAlerts: {
    email: boolean;
    push: boolean;
    in_app: boolean;
    sms: boolean;
  };
  marketIntelligence: {
    email: boolean;
    push: boolean;
    in_app: boolean;
    sms: boolean;
  };

  // Timing preferences
  digestFrequency: 'instant' | 'daily' | 'weekly' | 'monthly';
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
}

export interface NotificationPreferencesProps {
  className?: string;
  onSave?: (preferences: NotificationPreferences) => void;
}

const CATEGORY_INFO = {
  investmentAlerts: {
    title: 'Investment Alerts',
    description: 'New investors, funding milestones, deal updates',
    icon: DollarSign,
    color: 'text-green-600 bg-green-100',
  },
  projectUpdates: {
    title: 'Project Updates',
    description: 'NDA approvals, pitch status changes, document uploads',
    icon: FileText,
    color: 'text-blue-600 bg-blue-100',
  },
  systemAlerts: {
    title: 'System Alerts',
    description: 'Security notifications, maintenance, feature announcements',
    icon: Info,
    color: 'text-gray-600 bg-gray-100',
  },
  analyticsAlerts: {
    title: 'Analytics Alerts',
    description: 'Performance milestones, threshold breaches, trend changes',
    icon: TrendingUp,
    color: 'text-purple-600 bg-purple-100',
  },
  marketIntelligence: {
    title: 'Market Intelligence',
    description: 'Industry news, competitor updates, opportunity alerts',
    icon: Briefcase,
    color: 'text-orange-600 bg-orange-100',
  },
};

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'America/Denver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Australia/Sydney',
];

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  className = '',
  onSave,
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailEnabled: true,
    pushEnabled: true,
    inAppEnabled: true,
    smsEnabled: false,
    investmentAlerts: { email: true, push: true, in_app: true, sms: false },
    projectUpdates: { email: true, push: true, in_app: true, sms: false },
    systemAlerts: { email: true, push: false, in_app: true, sms: false },
    analyticsAlerts: { email: false, push: false, in_app: true, sms: false },
    marketIntelligence: { email: true, push: false, in_app: true, sms: false },
    digestFrequency: 'daily',
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    timezone: 'UTC',
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['global']));
  const [pushSubscriptionStatus, setPushSubscriptionStatus] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown');

  // Load preferences on mount
  useEffect(() => {
    void loadPreferences();
    void checkPushPermission();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/notifications/preferences', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load preferences');
      }

      const data = await response.json();
      setPreferences(data.preferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSave?.(preferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const checkPushPermission = async () => {
    if (!('Notification' in window)) {
      setPushSubscriptionStatus('unsupported');
      return;
    }

    setPushSubscriptionStatus(Notification.permission as any);
  };

  const requestPushPermission = async () => {
    if (!('Notification' in window)) return;

    try {
      const permission = await Notification.requestPermission();
      setPushSubscriptionStatus(permission as any);

      if (permission === 'granted') {
        // Subscribe to push notifications
        await subscribeToPush();
      }
    } catch (error) {
      console.error('Error requesting push permission:', error);
    }
  };

  const subscribeToPush = async () => {
    try {
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Get VAPID key
      const vapidResponse = await fetch('/api/notifications/push/vapid-key');
      const { publicKey } = await vapidResponse.json();

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      // Send subscription to server
      await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
            auth: arrayBufferToBase64(subscription.getKey('auth')!),
          },
        }),
      });
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    }
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
    return btoa(binary);
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const updateGlobalSetting = (key: keyof NotificationPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const updateCategorySetting = (
    category: keyof Pick<NotificationPreferences, 'investmentAlerts' | 'projectUpdates' | 'systemAlerts' | 'analyticsAlerts' | 'marketIntelligence'>,
    channel: 'email' | 'push' | 'in_app' | 'sms',
    value: boolean
  ) => {
    setPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [channel]: value,
      },
    }));
  };

  const resetToDefaults = () => {
    setPreferences({
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      smsEnabled: false,
      investmentAlerts: { email: true, push: true, in_app: true, sms: false },
      projectUpdates: { email: true, push: true, in_app: true, sms: false },
      systemAlerts: { email: true, push: false, in_app: true, sms: false },
      analyticsAlerts: { email: false, push: false, in_app: true, sms: false },
      marketIntelligence: { email: true, push: false, in_app: true, sms: false },
      digestFrequency: 'daily',
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      timezone: 'UTC',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading preferences...</span>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Notification Preferences
            </h2>
            <p className="text-gray-600 mt-1">
              Control how and when you receive notifications across all channels
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={resetToDefaults}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Reset to defaults
            </button>
            <button
              onClick={savePreferences}
              disabled={saving}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <X className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}
      </div>

      <div className="divide-y">
        {/* Global Settings */}
        <div className="p-6">
          <button
            onClick={() => toggleSection('global')}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Global Settings
            </h3>
            {expandedSections.has('global') ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.has('global') && (
            <div className="mt-6 space-y-6">
              {/* Channel Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center">
                    <Mail className="w-5 h-5 text-blue-600 mr-3" />
                    <div>
                      <div className="font-medium">Email</div>
                      <div className="text-sm text-gray-500">Email notifications</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.emailEnabled}
                      onChange={(e) => updateGlobalSetting('emailEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center">
                    <Smartphone className="w-5 h-5 text-green-600 mr-3" />
                    <div>
                      <div className="font-medium">Push</div>
                      <div className="text-sm text-gray-500">Browser notifications</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {pushSubscriptionStatus === 'denied' && (
                      <span className="text-xs text-red-600">Blocked</span>
                    )}
                    {pushSubscriptionStatus === 'unsupported' && (
                      <span className="text-xs text-gray-500">Unsupported</span>
                    )}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.pushEnabled && pushSubscriptionStatus === 'granted'}
                        onChange={(e) => {
                          if (e.target.checked && pushSubscriptionStatus !== 'granted') {
                            void requestPushPermission();
                          } else {
                            updateGlobalSetting('pushEnabled', e.target.checked);
                          }
                        }}
                        disabled={pushSubscriptionStatus === 'unsupported'}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-disabled:bg-gray-100"></div>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center">
                    <Bell className="w-5 h-5 text-purple-600 mr-3" />
                    <div>
                      <div className="font-medium">In-App</div>
                      <div className="text-sm text-gray-500">Within application</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.inAppEnabled}
                      onChange={(e) => updateGlobalSetting('inAppEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center">
                    <MessageSquare className="w-5 h-5 text-orange-600 mr-3" />
                    <div>
                      <div className="font-medium">SMS</div>
                      <div className="text-sm text-gray-500">Text messages</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.smsEnabled}
                      onChange={(e) => updateGlobalSetting('smsEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>
              </div>

              {/* Timing Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Digest Frequency
                  </label>
                  <select
                    value={preferences.digestFrequency}
                    onChange={(e) => updateGlobalSetting('digestFrequency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="instant">Instant (as they happen)</option>
                    <option value="daily">Daily digest</option>
                    <option value="weekly">Weekly summary</option>
                    <option value="monthly">Monthly summary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timezone
                  </label>
                  <select
                    value={preferences.timezone}
                    onChange={(e) => updateGlobalSetting('timezone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIMEZONES.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Moon className="w-4 h-4 mr-2" />
                    Quiet Hours Start
                  </label>
                  <input
                    type="time"
                    value={preferences.quietHoursStart}
                    onChange={(e) => updateGlobalSetting('quietHoursStart', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Sun className="w-4 h-4 mr-2" />
                    Quiet Hours End
                  </label>
                  <input
                    type="time"
                    value={preferences.quietHoursEnd}
                    onChange={(e) => updateGlobalSetting('quietHoursEnd', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Category-Specific Settings */}
        {Object.entries(CATEGORY_INFO).map(([categoryKey, categoryInfo]) => (
          <div key={categoryKey} className="p-6">
            <button
              onClick={() => toggleSection(categoryKey)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <div className={`p-2 rounded-lg ${categoryInfo.color} mr-3`}>
                  <categoryInfo.icon className="w-5 h-5" />
                </div>
                {categoryInfo.title}
              </h3>
              {expandedSections.has(categoryKey) ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {expandedSections.has(categoryKey) && (
              <div className="mt-6">
                <p className="text-gray-600 mb-4">{categoryInfo.description}</p>
                
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="font-medium text-sm text-gray-700 mb-2">Email</div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={typeof preferences[categoryKey as keyof typeof preferences] === 'object' && preferences[categoryKey as keyof typeof preferences] !== null && 'email' in (preferences[categoryKey as keyof typeof preferences] as any) ? (preferences[categoryKey as keyof typeof preferences] as any).email : false}
                        onChange={(e) => updateCategorySetting(
                          categoryKey as any,
                          'email',
                          e.target.checked
                        )}
                        disabled={!preferences.emailEnabled}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:bg-gray-100"></div>
                    </label>
                  </div>

                  <div className="text-center">
                    <div className="font-medium text-sm text-gray-700 mb-2">Push</div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={typeof preferences[categoryKey as keyof typeof preferences] === 'object' && preferences[categoryKey as keyof typeof preferences] !== null && 'push' in (preferences[categoryKey as keyof typeof preferences] as any) ? (preferences[categoryKey as keyof typeof preferences] as any).push : false}
                        onChange={(e) => updateCategorySetting(
                          categoryKey as any,
                          'push',
                          e.target.checked
                        )}
                        disabled={!preferences.pushEnabled}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-disabled:bg-gray-100"></div>
                    </label>
                  </div>

                  <div className="text-center">
                    <div className="font-medium text-sm text-gray-700 mb-2">In-App</div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={typeof preferences[categoryKey as keyof typeof preferences] === 'object' && preferences[categoryKey as keyof typeof preferences] !== null && 'in_app' in (preferences[categoryKey as keyof typeof preferences] as any) ? (preferences[categoryKey as keyof typeof preferences] as any).in_app : false}
                        onChange={(e) => updateCategorySetting(
                          categoryKey as any,
                          'in_app',
                          e.target.checked
                        )}
                        disabled={!preferences.inAppEnabled}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-disabled:bg-gray-100"></div>
                    </label>
                  </div>

                  <div className="text-center">
                    <div className="font-medium text-sm text-gray-700 mb-2">SMS</div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={typeof preferences[categoryKey as keyof typeof preferences] === 'object' && preferences[categoryKey as keyof typeof preferences] !== null && 'sms' in (preferences[categoryKey as keyof typeof preferences] as any) ? (preferences[categoryKey as keyof typeof preferences] as any).sms : false}
                        onChange={(e) => updateCategorySetting(
                          categoryKey as any,
                          'sms',
                          e.target.checked
                        )}
                        disabled={!preferences.smsEnabled}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600 peer-disabled:bg-gray-100"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-6 bg-gray-50 border-t rounded-b-lg">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Changes are saved automatically when you click "Save Changes"
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={loadPreferences}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Reload preferences
            </button>
            <button
              onClick={() => window.location.href = '/notifications'}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View notification history
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferences;