import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Bell, Shield, CreditCard, FileText,
  Globe, Key, Smartphone, Mail, Save, Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { toast } from 'react-hot-toast';
import { investorApi } from '../../services/investor.service';

interface SettingsState {
  notifications: {
    emailAlerts: boolean;
    pushNotifications: boolean;
    smsAlerts: boolean;
    weeklyDigest: boolean;
    pitchUpdates: boolean;
    investmentAlerts: boolean;
    ndaReminders: boolean;
  };
  privacy: {
    profileVisible: boolean;
    showInvestments: boolean;
    allowMessages: boolean;
    dataSharing: boolean;
  };
  security: {
    twoFactorAuth: boolean;
    loginAlerts: boolean;
    sessionTimeout: string;
  };
  preferences: {
    currency: string;
    language: string;
    timezone: string;
    theme: string;
  };
}

const defaultSettings: SettingsState = {
  notifications: {
    emailAlerts: true,
    pushNotifications: false,
    smsAlerts: false,
    weeklyDigest: true,
    pitchUpdates: true,
    investmentAlerts: true,
    ndaReminders: true,
  },
  privacy: {
    profileVisible: true,
    showInvestments: false,
    allowMessages: true,
    dataSharing: false,
  },
  security: {
    twoFactorAuth: false,
    loginAlerts: true,
    sessionTimeout: '30',
  },
  preferences: {
    currency: 'USD',
    language: 'en',
    timezone: 'America/Los_Angeles',
    theme: 'light',
  },
};

const InvestorSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await investorApi.getSettings();
        if (response.success && response.data) {
          const d = response.data as Partial<SettingsState>;
          setSettings({
            notifications: { ...defaultSettings.notifications, ...d.notifications },
            privacy: { ...defaultSettings.privacy, ...d.privacy },
            security: { ...defaultSettings.security, ...d.security },
            preferences: { ...defaultSettings.preferences, ...d.preferences },
          });
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to load settings:', e.message);
      } finally {
        setLoading(false);
      }
    };
    void fetchSettings();
  }, []);

  const handleSaveSettings = async (section: string) => {
    setSaving(true);
    try {
      const response = await investorApi.saveSettings(settings as unknown as Record<string, unknown>);
      if (response.success) {
        toast.success(`${section} settings saved successfully`);
      } else {
        toast.error('Failed to save settings');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(`Failed to save settings: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 mt-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Settings</h1>

          {/* Notification Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Manage how you receive updates and alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label htmlFor="email-alerts" className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Alerts
                </span>
                <input
                  type="checkbox"
                  id="email-alerts"
                  name="email-alerts"
                  className="h-4 w-4"
                  checked={settings.notifications.emailAlerts}
                  onChange={(e) =>
                    setSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, emailAlerts: e.target.checked }
                    }))
                  }
                />
              </label>

              <label htmlFor="push-notifications" className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Push Notifications
                </span>
                <input
                  type="checkbox"
                  id="push-notifications"
                  name="push-notifications"
                  className="h-4 w-4"
                  checked={settings.notifications.pushNotifications}
                  onChange={(e) =>
                    setSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, pushNotifications: e.target.checked }
                    }))
                  }
                />
              </label>

              <label htmlFor="weekly-digest" className="flex items-center justify-between cursor-pointer">
                <span>Weekly Investment Digest</span>
                <input
                  type="checkbox"
                  id="weekly-digest"
                  name="weekly-digest"
                  className="h-4 w-4"
                  checked={settings.notifications.weeklyDigest}
                  onChange={(e) =>
                    setSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, weeklyDigest: e.target.checked }
                    }))
                  }
                />
              </label>

              <label htmlFor="pitch-updates" className="flex items-center justify-between cursor-pointer">
                <span>Pitch Updates</span>
                <input
                  type="checkbox"
                  id="pitch-updates"
                  name="pitch-updates"
                  className="h-4 w-4"
                  checked={settings.notifications.pitchUpdates}
                  onChange={(e) =>
                    setSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, pitchUpdates: e.target.checked }
                    }))
                  }
                />
              </label>

              <Button
                onClick={() => { void handleSaveSettings('Notification'); }}
                disabled={saving}
                className="w-full"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy & Visibility
              </CardTitle>
              <CardDescription>
                Control who can see your information and activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label htmlFor="public-profile" className="flex items-center justify-between cursor-pointer">
                <span>Public Profile</span>
                <input
                  type="checkbox"
                  id="public-profile"
                  name="public-profile"
                  className="h-4 w-4"
                  checked={settings.privacy.profileVisible}
                  onChange={(e) =>
                    setSettings(prev => ({
                      ...prev,
                      privacy: { ...prev.privacy, profileVisible: e.target.checked }
                    }))
                  }
                />
              </label>

              <label htmlFor="show-investments" className="flex items-center justify-between cursor-pointer">
                <span>Show Investment History</span>
                <input
                  type="checkbox"
                  id="show-investments"
                  name="show-investments"
                  className="h-4 w-4"
                  checked={settings.privacy.showInvestments}
                  onChange={(e) =>
                    setSettings(prev => ({
                      ...prev,
                      privacy: { ...prev.privacy, showInvestments: e.target.checked }
                    }))
                  }
                />
              </label>

              <label htmlFor="allow-messages" className="flex items-center justify-between cursor-pointer">
                <span>Allow Direct Messages</span>
                <input
                  type="checkbox"
                  id="allow-messages"
                  name="allow-messages"
                  className="h-4 w-4"
                  checked={settings.privacy.allowMessages}
                  onChange={(e) =>
                    setSettings(prev => ({
                      ...prev,
                      privacy: { ...prev.privacy, allowMessages: e.target.checked }
                    }))
                  }
                />
              </label>

              <Button
                onClick={() => { void handleSaveSettings('Privacy'); }}
                disabled={saving}
                className="w-full"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Privacy Settings
              </Button>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>
                Manage your account security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label htmlFor="two-factor-auth" className="flex items-center justify-between cursor-pointer">
                <span>Two-Factor Authentication</span>
                <input
                  type="checkbox"
                  id="two-factor-auth"
                  name="two-factor-auth"
                  className="h-4 w-4"
                  checked={settings.security.twoFactorAuth}
                  onChange={(e) =>
                    setSettings(prev => ({
                      ...prev,
                      security: { ...prev.security, twoFactorAuth: e.target.checked }
                    }))
                  }
                />
              </label>

              <label htmlFor="login-alerts" className="flex items-center justify-between cursor-pointer">
                <span>Login Alerts</span>
                <input
                  type="checkbox"
                  id="login-alerts"
                  name="login-alerts"
                  className="h-4 w-4"
                  checked={settings.security.loginAlerts}
                  onChange={(e) =>
                    setSettings(prev => ({
                      ...prev,
                      security: { ...prev.security, loginAlerts: e.target.checked }
                    }))
                  }
                />
              </label>

              <Button
                onClick={() => { void handleSaveSettings('Security'); }}
                disabled={saving}
                className="w-full"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Security Settings
              </Button>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Account Management
              </CardTitle>
              <CardDescription>
                Quick access to important account features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => { void navigate('/investor/profile'); }}
                variant="outline"
                className="w-full justify-start"
              >
                <User className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>

              <Button
                onClick={() => { void navigate('/investor/tax-documents'); }}
                variant="outline"
                className="w-full justify-start"
              >
                <FileText className="h-4 w-4 mr-2" />
                Tax Documents
              </Button>

              <Button
                onClick={() => { void navigate('/investor/payment-methods'); }}
                variant="outline"
                className="w-full justify-start"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Payment Methods
              </Button>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => {
                  if (confirm('Are you sure you want to deactivate your account? This action can be reversed by contacting support.')) {
                    toast.success('Account deactivation request submitted');
                  }
                }}
              >
                Deactivate Account
              </Button>

              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                    toast.error('Account deletion requires additional verification');
                  }
                }}
              >
                Delete Account Permanently
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InvestorSettings;
