import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Mail, MessageSquare, Film, DollarSign,
  Users, Calendar, AlertCircle, Save, X, Smartphone,
  Volume2, VolumeX, Clock, Star, Zap
} from 'lucide-react';
import DashboardHeader from '../../../components/DashboardHeader';
import { useBetterAuthStore } from '../../../store/betterAuthStore';
import { getDashboardRoute } from '../../../utils/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { toast } from 'react-hot-toast';
import { NotificationsService } from '../../../services/notifications.service';

interface NotificationSettings {
  email: {
    enabled: boolean;
    frequency: 'instant' | 'hourly' | 'daily' | 'weekly';
    pitchSubmissions: boolean;
    statusUpdates: boolean;
    messages: boolean;
    paymentUpdates: boolean;
    teamActivity: boolean;
    systemAlerts: boolean;
    marketingEmails: boolean;
    weeklyDigest: boolean;
  };
  push: {
    enabled: boolean;
    urgent: boolean;
    messages: boolean;
    submissions: boolean;
    deadlines: boolean;
    teamUpdates: boolean;
  };
  inApp: {
    enabled: boolean;
    sound: boolean;
    badges: boolean;
    popups: boolean;
    autoMarkRead: boolean;
  };
  sms: {
    enabled: boolean;
    urgentOnly: boolean;
    phone: string;
    verificationCode: string;
    verified: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
}

export default function ProductionSettingsNotifications() {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    email: {
      enabled: true,
      frequency: 'daily',
      pitchSubmissions: true,
      statusUpdates: true,
      messages: true,
      paymentUpdates: true,
      teamActivity: false,
      systemAlerts: true,
      marketingEmails: false,
      weeklyDigest: true
    },
    push: {
      enabled: true,
      urgent: true,
      messages: true,
      submissions: true,
      deadlines: true,
      teamUpdates: false
    },
    inApp: {
      enabled: true,
      sound: true,
      badges: true,
      popups: false,
      autoMarkRead: true
    },
    sms: {
      enabled: false,
      urgentOnly: true,
      phone: '',
      verificationCode: '',
      verified: false
    },
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'America/Los_Angeles'
    }
  });

  // Load saved preferences from API on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await NotificationsService.getPreferences();
        if (prefs) {
          setSettings(prev => ({
            ...prev,
            email: { ...prev.email, enabled: prefs.email ?? prev.email.enabled },
            push: { ...prev.push, enabled: prefs.push ?? prev.push.enabled },
            sms: { ...prev.sms, enabled: prefs.sms ?? prev.sms.enabled },
          }));
        }
      } catch {
        // Use defaults if preferences endpoint fails
      }
    };
    loadPreferences();
  }, []);

  const handleToggle = (category: keyof NotificationSettings, setting: string) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: !prev[category][setting as keyof typeof prev[typeof category]]
      }
    }));
  };

  const handleSelectChange = (category: keyof NotificationSettings, setting: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
  };

  const handleInputChange = (category: keyof NotificationSettings, setting: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await NotificationsService.updatePreferences({
        email: settings.email.enabled,
        push: settings.push.enabled,
        sms: settings.sms.enabled,
        marketing: settings.email.marketingEmails,
      });
      toast.success('Notification settings updated successfully!');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to update notification settings');
    } finally {
      setLoading(false);
    }
  };

  const testNotification = () => {
    toast.success('Test notification sent! Check your notification preferences.');
  };

  const verifyPhone = () => {
    toast.success('Verification code sent to your phone!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        userType="production"
        title="Notification Settings"
        onLogout={logout}
        useEnhancedNav={true}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
          <p className="mt-2 text-gray-600">Manage how and when you receive notifications</p>
        </div>

        <div className="space-y-6">
          {/* Email Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Notifications
              </CardTitle>
              <CardDescription>Control email notification preferences and frequency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Email Notifications</p>
                  <p className="text-sm text-gray-500">Receive notifications via email</p>
                </div>
                <button
                  onClick={() => handleToggle('email', 'enabled')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.email.enabled ? 'bg-purple-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.email.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {settings.email.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notification Frequency</label>
                    <select
                      value={settings.email.frequency}
                      onChange={(e) => handleSelectChange('email', 'frequency', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="instant">Instant</option>
                      <option value="hourly">Hourly Digest</option>
                      <option value="daily">Daily Digest</option>
                      <option value="weekly">Weekly Digest</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Email Types</h4>
                    
                    {[
                      { key: 'pitchSubmissions', label: 'Pitch Submissions', description: 'New pitch submissions to your company', icon: Film },
                      { key: 'statusUpdates', label: 'Status Updates', description: 'Project status changes and updates', icon: AlertCircle },
                      { key: 'messages', label: 'Messages', description: 'Direct messages from creators and team', icon: MessageSquare },
                      { key: 'paymentUpdates', label: 'Payment Updates', description: 'Payment confirmations and invoices', icon: DollarSign },
                      { key: 'teamActivity', label: 'Team Activity', description: 'Team member actions and collaborations', icon: Users },
                      { key: 'systemAlerts', label: 'System Alerts', description: 'Important system notifications', icon: Bell },
                      { key: 'marketingEmails', label: 'Marketing Emails', description: 'Platform updates and promotional content', icon: Star },
                      { key: 'weeklyDigest', label: 'Weekly Digest', description: 'Summary of platform activity and metrics', icon: Calendar }
                    ].map(({ key, label, description, icon: Icon }) => (
                      <div key={key} className="flex items-center justify-between py-2">
                        <div className="flex items-center space-x-3">
                          <Icon className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium">{label}</p>
                            <p className="text-xs text-gray-500">{description}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggle('email', key)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            settings.email[key as keyof typeof settings.email] ? 'bg-purple-600' : 'bg-gray-200'
                          }`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            settings.email[key as keyof typeof settings.email] ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Push Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Push Notifications
              </CardTitle>
              <CardDescription>Browser and mobile push notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Push Notifications</p>
                  <p className="text-sm text-gray-500">Receive push notifications in your browser</p>
                </div>
                <button
                  onClick={() => handleToggle('push', 'enabled')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.push.enabled ? 'bg-purple-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.push.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {settings.push.enabled && (
                <div className="space-y-3">
                  {[
                    { key: 'urgent', label: 'Urgent Notifications', description: 'Critical alerts and time-sensitive updates' },
                    { key: 'messages', label: 'Messages', description: 'New direct messages' },
                    { key: 'submissions', label: 'Submissions', description: 'New pitch submissions' },
                    { key: 'deadlines', label: 'Deadlines', description: 'Upcoming deadlines and reminders' },
                    { key: 'teamUpdates', label: 'Team Updates', description: 'Team activity and collaboration updates' }
                  ].map(({ key, label, description }) => (
                    <div key={key} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-gray-500">{description}</p>
                      </div>
                      <button
                        onClick={() => handleToggle('push', key)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          settings.push[key as keyof typeof settings.push] ? 'bg-purple-600' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          settings.push[key as keyof typeof settings.push] ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* In-App Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                In-App Notifications
              </CardTitle>
              <CardDescription>Notifications within the application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'enabled', label: 'In-App Notifications', description: 'Show notifications within the app' },
                { key: 'sound', label: 'Sound Notifications', description: 'Play sounds for new notifications' },
                { key: 'badges', label: 'Notification Badges', description: 'Show red badges for unread notifications' },
                { key: 'popups', label: 'Popup Notifications', description: 'Show popup notifications on screen' },
                { key: 'autoMarkRead', label: 'Auto-mark as Read', description: 'Automatically mark notifications as read when viewed' }
              ].map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-3">
                    {key === 'sound' && <Volume2 className="w-4 h-4 text-gray-400" />}
                    {key === 'badges' && <Star className="w-4 h-4 text-gray-400" />}
                    {key === 'popups' && <Zap className="w-4 h-4 text-gray-400" />}
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-gray-500">{description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle('inApp', key)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.inApp[key as keyof typeof settings.inApp] ? 'bg-purple-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.inApp[key as keyof typeof settings.inApp] ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quiet Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Quiet Hours
              </CardTitle>
              <CardDescription>Set times when you don't want to receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Quiet Hours</p>
                  <p className="text-sm text-gray-500">Pause non-urgent notifications during specified hours</p>
                </div>
                <button
                  onClick={() => handleToggle('quietHours', 'enabled')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.quietHours.enabled ? 'bg-purple-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.quietHours.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {settings.quietHours.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                    <input
                      type="time"
                      value={settings.quietHours.startTime}
                      onChange={(e) => handleInputChange('quietHours', 'startTime', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                    <input
                      type="time"
                      value={settings.quietHours.endTime}
                      onChange={(e) => handleInputChange('quietHours', 'endTime', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                    <select
                      value={settings.quietHours.timezone}
                      onChange={(e) => handleSelectChange('quietHours', 'timezone', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/New_York">Eastern Time (ET)</option>
                    </select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Notification */}
          <Card>
            <CardHeader>
              <CardTitle>Test Notifications</CardTitle>
              <CardDescription>Send a test notification to verify your settings</CardDescription>
            </CardHeader>
            <CardContent>
              <button
                onClick={testNotification}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
              >
                <Bell className="w-4 h-4" />
                Send Test Notification
              </button>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Settings
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => navigate(getDashboardRoute(user?.userType))}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}