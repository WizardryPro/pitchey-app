import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Key, Eye, EyeOff, Smartphone, 
  AlertTriangle, CheckCircle, Lock, Unlock,
  Calendar, MapPin, Monitor, Save, X, 
  RefreshCw, Download, Trash2, Plus, QrCode
} from 'lucide-react';
import DashboardHeader from '../../../components/DashboardHeader';
import { useBetterAuthStore } from '../../../store/betterAuthStore';
import { getDashboardRoute } from '../../../utils/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'react-hot-toast';

interface SecuritySettings {
  twoFactorEnabled: boolean;
  passwordRequireUpdate: boolean;
  sessionTimeout: number;
  ipWhitelist: string[];
  deviceTrust: boolean;
  emailNotifications: boolean;
  loginAlerts: boolean;
}

interface LoginSession {
  id: string;
  device: string;
  location: string;
  ip: string;
  browser: string;
  lastActive: string;
  current: boolean;
}

interface SecurityLog {
  id: string;
  action: string;
  timestamp: string;
  ip: string;
  location: string;
  status: 'success' | 'failed' | 'suspicious';
}

export default function ProductionSettingsSecurity() {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'sessions' | 'logs' | '2fa'>('general');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const [settings, setSettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    passwordRequireUpdate: false,
    sessionTimeout: 24,
    ipWhitelist: [],
    deviceTrust: false,
    emailNotifications: true,
    loginAlerts: true
  });

  const [sessions] = useState<LoginSession[]>([]);

  const [securityLogs] = useState<SecurityLog[]>([]);

  const handlePasswordChange = (field: keyof typeof passwords, value: string) => {
    setPasswords(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSettingToggle = (setting: keyof SecuritySettings) => {
    setSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleSettingChange = (setting: keyof SecuritySettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const handleUpdatePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwords.new !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwords.new.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const { apiClient } = await import('../../../lib/api-client');
      const response = await apiClient.post('/api/auth/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.new,
      });
      if (!response.success) {
        throw new Error((response.error as any)?.message || 'Failed to update password');
      }
      toast.success('Password updated successfully!');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { default: apiClient } = await import('../../../lib/api-client');
      const response = await apiClient.put('/api/user/settings', {
        sessionTimeout: settings.sessionTimeout,
        emailNotifications: settings.emailNotifications,
        loginAlerts: settings.loginAlerts,
      });
      if (!response.success) {
        throw new Error((response.error as any)?.message || 'Failed to save');
      }
      toast.success('Security settings updated successfully!');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to update security settings');
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = (_sessionId: string) => {
    toast.error('Session management is not yet available');
  };

  const enable2FA = () => {
    toast.error('Two-factor authentication is not yet available');
  };

  const disable2FA = () => {
    toast.error('Two-factor authentication is not yet available');
  };

  const downloadSecurityReport = () => {
    toast.error('Security report downloads are not yet available');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        userType="production"
        title="Security Settings"
        onLogout={logout}
        useEnhancedNav={true}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Security Settings</h1>
          <p className="mt-2 text-gray-600">Manage your account security and access controls</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'general', name: 'General Security', icon: Shield },
              { id: '2fa', name: 'Two-Factor Auth', icon: Smartphone },
              { id: 'sessions', name: 'Active Sessions', icon: Monitor },
              { id: 'logs', name: 'Security Logs', icon: AlertTriangle }
            ].map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {name}
              </button>
            ))}
          </nav>
        </div>

        {/* General Security Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Password Update */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Change Password
                </CardTitle>
                <CardDescription>Update your account password regularly for better security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwords.current}
                      onChange={(e) => handlePasswordChange('current', e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwords.new}
                      onChange={(e) => handlePasswordChange('new', e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwords.confirm}
                      onChange={(e) => handlePasswordChange('confirm', e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleUpdatePassword}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Security Preferences</CardTitle>
                <CardDescription>Configure your account security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {[
                    {
                      key: 'passwordRequireUpdate',
                      title: 'Force Password Update',
                      description: 'Require password change every 90 days'
                    },
                    {
                      key: 'deviceTrust',
                      title: 'Trust This Device',
                      description: 'Remember this device for 30 days'
                    },
                    {
                      key: 'emailNotifications',
                      title: 'Email Security Notifications',
                      description: 'Get notified of security events via email'
                    },
                    {
                      key: 'loginAlerts',
                      title: 'Login Alerts',
                      description: 'Get alerts for new login locations'
                    }
                  ].map(({ key, title, description }) => (
                    <div key={key} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-gray-900">{title}</p>
                        <p className="text-sm text-gray-500">{description}</p>
                      </div>
                      <button
                        onClick={() => handleSettingToggle(key as keyof SecuritySettings)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          settings[key as keyof SecuritySettings] ? 'bg-purple-600' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          settings[key as keyof SecuritySettings] ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Session Timeout</label>
                  <select
                    value={settings.sessionTimeout}
                    onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value={1}>1 hour</option>
                    <option value={8}>8 hours</option>
                    <option value={24}>24 hours</option>
                    <option value={168}>1 week</option>
                    <option value={720}>1 month</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Automatically log out after this period of inactivity
                  </p>
                </div>

                <div className="flex gap-4 pt-4 border-t">
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
        )}

        {/* Two-Factor Authentication Tab */}
        {activeTab === '2fa' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      settings.twoFactorEnabled ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {settings.twoFactorEnabled ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <Shield className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        Two-Factor Authentication is {settings.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {settings.twoFactorEnabled 
                          ? 'Your account is protected with 2FA' 
                          : 'Secure your account with an additional verification step'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={settings.twoFactorEnabled ? disable2FA : enable2FA}
                    className={`px-4 py-2 rounded-lg transition ${
                      settings.twoFactorEnabled
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {settings.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                  </button>
                </div>

                {settings.twoFactorEnabled && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h4 className="font-medium text-green-900">2FA is Active</h4>
                    </div>
                    <p className="text-sm text-green-700 mb-4">
                      You're using an authenticator app for two-factor authentication. 
                      Backup codes are available if you lose access to your device.
                    </p>
                    <div className="flex gap-3">
                      <button className="px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded text-sm hover:bg-green-50 transition">
                        View Backup Codes
                      </button>
                      <button className="px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded text-sm hover:bg-green-50 transition">
                        Regenerate Codes
                      </button>
                    </div>
                  </div>
                )}

                {!settings.twoFactorEnabled && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      <h4 className="font-medium text-yellow-900">Enhance Your Security</h4>
                    </div>
                    <p className="text-sm text-yellow-700 mb-4">
                      Enable two-factor authentication to add an extra layer of security. 
                      You'll need an authenticator app like Google Authenticator or Authy.
                    </p>
                    <div className="flex gap-3">
                      <button 
                        onClick={enable2FA}
                        className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition flex items-center gap-2"
                      >
                        <QrCode className="w-4 h-4" />
                        Setup 2FA
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Active Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Active Sessions</h2>
                <p className="text-sm text-gray-600">Manage your active login sessions across devices</p>
              </div>
              <button
                onClick={downloadSecurityReport}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Report
              </button>
            </div>

            <div className="space-y-4">
              {sessions.map((session) => (
                <Card key={session.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                          <Monitor className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">{session.device}</h3>
                            {session.current && (
                              <Badge variant="default">Current Session</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{session.browser}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {session.location}
                            </span>
                            <span>IP: {session.ip}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {getTimeAgo(session.lastActive)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {!session.current && (
                        <button
                          onClick={() => revokeSession(session.id)}
                          className="px-3 py-2 text-red-600 hover:text-red-800 border border-red-300 hover:border-red-400 rounded-lg transition flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Revoke
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Security Logs Tab */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Security Activity</h2>
                <p className="text-sm text-gray-600">Recent security events and login activity</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Activity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date & Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          IP Address
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {securityLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {log.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                              {log.status === 'failed' && <X className="w-4 h-4 text-red-500" />}
                              {log.status === 'suspicious' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                              <span className="text-sm font-medium text-gray-900">{log.action}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(log.timestamp)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {log.location}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {log.ip}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge 
                              variant={
                                log.status === 'success' ? 'default' :
                                log.status === 'failed' ? 'destructive' : 'secondary'
                              }
                            >
                              {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}