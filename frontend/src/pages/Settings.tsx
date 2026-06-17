import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Bell, Eye, Mail, Smartphone, Lock, Key, Trash2, AlertCircle, User, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { sessionManager } from '../lib/session-manager';
import { sessionCache } from '../store/sessionCache';
import { UserService } from '../services/user.service';
import { API_URL } from '../config';
import { usePortalTheme } from '@shared/hooks/usePortalTheme';
import LogoLoader from '@/components/LogoLoader';

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  pitchViews: boolean;
  newMessages: boolean;
  projectUpdates: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'network';
  showEmail: boolean;
  showPhone: boolean;
  allowDirectMessages: boolean;
  allowPitchRequests: boolean;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  loginNotifications: boolean;
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, checkSession } = useBetterAuthStore();
  const theme = usePortalTheme();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'privacy' | 'security' | 'account'>('profile');

  // Profile (username / email) — the editable account identity fields.
  const [profileForm, setProfileForm] = useState({ username: '', email: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  // Password change
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Pre-populate the profile form from the auth store once the user loads.
  useEffect(() => {
    if (user) {
      setProfileForm({ username: user.username || '', email: user.email || '' });
    }
  }, [user]);

  const saveProfile = async () => {
    const username = profileForm.username.trim().toLowerCase();
    const email = profileForm.email.trim().toLowerCase();
    if (username && username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }
    setProfileSaving(true);
    try {
      const originalEmail = (user?.email || '').trim().toLowerCase();
      await UserService.updateProfile({
        username: username || undefined,
        email: email && email !== originalEmail ? email : undefined,
      });
      sessionManager.clearCache();
      await checkSession();
      // Re-write the localStorage session cache with the fresh user so a page
      // refresh doesn't surface the stale pre-change username for the cache TTL.
      const freshUser = useBetterAuthStore.getState().user;
      if (freshUser) sessionCache.set(freshUser);
      toast.success('Profile updated');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setPasswordSaving(true);
    try {
      await UserService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      toast.success('Password changed');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNotifications: true,
    pushNotifications: true,
    pitchViews: true,
    newMessages: true,
    projectUpdates: true,
    weeklyDigest: false,
    marketingEmails: false
  });
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    profileVisibility: 'public',
    showEmail: false,
    showPhone: false,
    allowDirectMessages: true,
    allowPitchRequests: true
  });
  const [security, setSecurity] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    sessionTimeout: 30,
    loginNotifications: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
    const response = await fetch(`${API_URL}/api/user/settings`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || notifications);
        setPrivacy(data.privacy || privacy);
        setSecurity(data.security || security);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      // Use default settings if fetch fails
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
    const response = await fetch(`${API_URL}/api/user/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifications, privacy, security }),
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        toast.success('Settings saved');
      } else {
        console.error('Failed to save settings');
        toast.error('Couldn\'t save settings. Please try again.');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Couldn\'t save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationChange = (key: keyof NotificationSettings, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const handlePrivacyChange = (key: keyof PrivacySettings, value: any) => {
    setPrivacy(prev => ({ ...prev, [key]: value }));
  };

  const handleSecurityChange = (key: keyof SecuritySettings, value: any) => {
    setSecurity(prev => ({ ...prev, [key]: value }));
  };

  const handleDeleteAccount = async () => {
    try {
      // Live delete endpoint is DELETE /api/user/account and requires the
      // explicit confirmation token (the previous /api/user/settings DELETE had
      // no route registered, so the button silently no-op'd).
      const response = await fetch(`${API_URL}/api/user/account`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE_MY_ACCOUNT' }),
      });

      if (response.ok) {
        toast.success('Your account has been deleted.');
        logout();
        navigate('/');
      } else {
        const data = await response.json().catch(() => ({} as { error?: string }));
        toast.error(data?.error || 'Failed to delete account. Please try again.');
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error('Failed to delete account. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LogoLoader size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page heading — global chrome comes from PortalLayout's MinimalHeader */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your preferences and security</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className={`px-4 py-2 rounded-lg transition disabled:opacity-50 ${theme.btnPrimary}`}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Tab Navigation — horizontally scrollable on mobile */}
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto scrollbar-hide">
              {[
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'privacy', label: 'Privacy', icon: Eye },
                { id: 'security', label: 'Security', icon: Shield },
                { id: 'account', label: 'Account', icon: Trash2 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap shrink-0 ${
                    activeTab === tab.id
                      ? `${theme.tabActiveBorder} ${theme.tabActiveText}`
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {/* Portals with a richer, role-tailored profile editor launch into it
                    from here. The username/email below stay as a quick edit. */}
                {(user?.userType === 'creator' || user?.userType === 'production') && (
                  <button
                    onClick={() => navigate(
                      user?.userType === 'production'
                        ? '/production/settings/profile'
                        : '/creator/settings/profile'
                    )}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition text-left"
                  >
                    <span className="flex items-center gap-3">
                      <User className={`w-5 h-5 ${theme.textAccent}`} />
                      <span>
                        <span className="block font-medium text-gray-900">
                          {user?.userType === 'production' ? 'Edit your full company profile' : 'Edit your full creator profile'}
                        </span>
                        <span className="block text-sm text-gray-500">
                          {user?.userType === 'production'
                            ? 'Company details, branding, contact and the address used on NDAs'
                            : 'Your creative statement, portfolio, contact and the address used on NDAs'}
                        </span>
                      </span>
                    </span>
                    <span className={`text-sm font-medium ${theme.textAccent}`}>Open →</span>
                  </button>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                      <input
                        type="text"
                        value={profileForm.username}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') }))}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
                        placeholder="your-username"
                      />
                      <p className="text-xs text-gray-500 mt-1">Letters, numbers, dots, hyphens, underscores. Min 3 characters.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
                        placeholder="you@example.com"
                      />
                      <p className="text-xs text-gray-500 mt-1">This is the email you sign in with.</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={saveProfile}
                      disabled={profileSaving}
                      className={`px-4 py-2 rounded-lg transition disabled:opacity-50 flex items-center gap-2 ${theme.btnPrimary}`}
                    >
                      <Save className="w-4 h-4" />
                      {profileSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                          <p className="text-xs text-gray-500">Receive important updates via email</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          id="email-notifications"
                          name="emailNotifications"
                          type="checkbox"
                          checked={notifications.emailNotifications}
                          onChange={(e) => handleNotificationChange('emailNotifications', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 ${theme.peerFocusRing} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${theme.toggleChecked}`}></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Push Notifications</p>
                          <p className="text-xs text-gray-500">Receive notifications on your device</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          id="push-notifications"
                          name="pushNotifications"
                          type="checkbox"
                          checked={notifications.pushNotifications}
                          onChange={(e) => handleNotificationChange('pushNotifications', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 ${theme.peerFocusRing} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${theme.toggleChecked}`}></div>
                      </label>
                    </div>

                    <hr className="my-4" />

                    {[
                      { key: 'pitchViews', label: 'Pitch Views', desc: 'When someone views your pitches' },
                      { key: 'newMessages', label: 'New Messages', desc: 'When you receive new messages' },
                      { key: 'projectUpdates', label: 'Project Updates', desc: 'Updates on projects you\'re following' },
                      { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Weekly summary of your activity' },
                      { key: 'marketingEmails', label: 'Marketing Emails', desc: 'Product updates and tips' }
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={notifications[item.key as keyof NotificationSettings] as boolean}
                            onChange={(e) => handleNotificationChange(item.key as keyof NotificationSettings, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 ${theme.peerFocusRing} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${theme.toggleChecked}`}></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy Settings</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Profile Visibility</label>
                      <select
                        value={privacy.profileVisibility}
                        onChange={(e) => handlePrivacyChange('profileVisibility', e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
                      >
                        <option value="public">Public - Anyone can view your profile</option>
                        <option value="network">Network - Only connections can view</option>
                        <option value="private">Private - Only you can view</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Show Email Address</p>
                        <p className="text-xs text-gray-500">Display your email on your public profile</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          id="privacy-show-email"
                          name="showEmail"
                          type="checkbox"
                          checked={privacy.showEmail}
                          onChange={(e) => handlePrivacyChange('showEmail', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 ${theme.peerFocusRing} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${theme.toggleChecked}`}></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Show Phone Number</p>
                        <p className="text-xs text-gray-500">Display your phone number on your public profile</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          id="privacy-show-phone"
                          name="showPhone"
                          type="checkbox"
                          checked={privacy.showPhone}
                          onChange={(e) => handlePrivacyChange('showPhone', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 ${theme.peerFocusRing} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${theme.toggleChecked}`}></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Allow Direct Messages</p>
                        <p className="text-xs text-gray-500">Let others send you direct messages</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          id="privacy-direct-messages"
                          name="allowDirectMessages"
                          type="checkbox"
                          checked={privacy.allowDirectMessages}
                          onChange={(e) => handlePrivacyChange('allowDirectMessages', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 ${theme.peerFocusRing} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${theme.toggleChecked}`}></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Allow Pitch Requests</p>
                        <p className="text-xs text-gray-500">Let others request access to your pitches</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          id="privacy-pitch-requests"
                          name="allowPitchRequests"
                          type="checkbox"
                          checked={privacy.allowPitchRequests}
                          onChange={(e) => handlePrivacyChange('allowPitchRequests', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 ${theme.peerFocusRing} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${theme.toggleChecked}`}></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
                  
                  <div className="space-y-6">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900 mb-1">Two-Factor Authentication</h4>
                          <p className="text-sm text-yellow-800 mb-3">
                            Add an extra layer of security to your account by enabling two-factor authentication.
                          </p>
                          <button
                            onClick={() => handleSecurityChange('twoFactorEnabled', !security.twoFactorEnabled)}
                            className={`px-4 py-2 rounded-lg font-medium transition ${
                              security.twoFactorEnabled
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                          >
                            {security.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Session Timeout</label>
                      <select
                        value={security.sessionTimeout}
                        onChange={(e) => handleSecurityChange('sessionTimeout', parseInt(e.target.value))}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
                      >
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={240}>4 hours</option>
                        <option value={480}>8 hours</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Automatically sign out after this period of inactivity
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Login Notifications</p>
                        <p className="text-xs text-gray-500">Get notified when someone signs in to your account</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          id="security-login-notifications"
                          name="loginNotifications"
                          type="checkbox"
                          checked={security.loginNotifications}
                          onChange={(e) => handleSecurityChange('loginNotifications', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 ${theme.peerFocusRing} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${theme.toggleChecked}`}></div>
                      </label>
                    </div>

                    <div className="border-t pt-6">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Change Password
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                          <input
                            type="password"
                            autoComplete="current-password"
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
                            placeholder="Enter your current password"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
                            placeholder="At least 8 characters"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
                            placeholder="Repeat new password"
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={changePassword}
                          disabled={passwordSaving || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition disabled:opacity-50 ${theme.btnPrimary}`}
                        >
                          <Lock className="w-4 h-4" />
                          {passwordSaving ? 'Updating...' : 'Update Password'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Management</h3>
                  
                  <div className="space-y-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Export Your Data</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Download a copy of your account data including pitches, messages, and analytics.
                      </p>
                      <button className={`px-4 py-2 rounded-lg transition ${theme.btnPrimary}`}>
                        Request Data Export
                      </button>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Trash2 className="w-5 h-5 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-red-900 mb-1">Delete Account</h4>
                          <p className="text-sm text-red-800 mb-3">
                            Permanently delete your account and all associated data. This action cannot be undone.
                          </p>
                          <button
                            onClick={() => setShowDeleteModal(true)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                          >
                            Delete Account
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you absolutely sure you want to delete your account? This will permanently remove all your data, 
              including pitches, messages, and analytics. This action cannot be undone.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteAccount();
                  setShowDeleteModal(false);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}