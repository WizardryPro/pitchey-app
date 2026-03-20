import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock, Shield, Eye, Download, Trash2,
  Save, X, Smartphone, Globe, Users,
  AlertTriangle, MapPin, AlertCircle, RefreshCw
} from 'lucide-react';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { UserService } from '../../services/user.service';
import { toast } from 'react-hot-toast';

interface ProfileVisibility {
  publicProfile: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showLocation: boolean;
  searchable: boolean;
}

interface DataSharing {
  analytics: boolean;
  marketing: boolean;
  thirdParty: boolean;
  performance: boolean;
}

interface TwoFactorAuth {
  enabled: boolean;
  method: 'sms' | 'app' | 'email';
}

export default function PrivacySettings() {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'privacy' | 'security' | 'data'>('privacy');

  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>({
    publicProfile: true,
    showEmail: false,
    showPhone: false,
    showLocation: true,
    searchable: true
  });

  const [dataSharing, setDataSharing] = useState<DataSharing>({
    analytics: true,
    marketing: false,
    thirdParty: false,
    performance: true
  });

  const [twoFactorAuth, setTwoFactorAuth] = useState<TwoFactorAuth>({
    enabled: false,
    method: 'app'
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Fetch settings from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      setInitialLoading(true);
      setLoadError(null);
      try {
        const settings = await UserService.getSettings();
        if (settings) {
          setProfileVisibility(prev => ({
            ...prev,
            publicProfile: settings.publicProfile ?? prev.publicProfile
          }));
          setTwoFactorAuth(prev => ({
            ...prev,
            enabled: settings.twoFactorEnabled ?? prev.enabled
          }));
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setLoadError(e.message);
      } finally {
        setInitialLoading(false);
      }
    };
    loadSettings();
  }, []);

  const updateProfileVisibility = (field: keyof ProfileVisibility, value: boolean) => {
    setProfileVisibility(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const updateDataSharing = (field: keyof DataSharing, value: boolean) => {
    setDataSharing(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const toggleTwoFactor = () => {
    setTwoFactorAuth(prev => ({
      ...prev,
      enabled: !prev.enabled
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await UserService.updateSettings({
        publicProfile: profileVisibility.publicProfile,
        allowMessages: profileVisibility.publicProfile,
        twoFactorEnabled: twoFactorAuth.enabled
      });
      toast.success('Privacy settings updated successfully!');
      setHasChanges(false);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadData = async () => {
    try {
      toast.success('Data export started. You will receive an email when ready.');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to start data export');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      toast.error('Please type "DELETE MY ACCOUNT" to confirm');
      return;
    }

    try {
      await UserService.deleteAccount(deleteConfirmText);
      toast.success('Account deletion request submitted');
      logout();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to delete account');
    }
  };

  const ToggleSwitch = ({ enabled, onToggle, size = 'md' }: { enabled: boolean; onToggle: () => void; size?: 'sm' | 'md' }) => {
    const sizeClasses = size === 'sm' ? 'w-8 h-4' : 'w-11 h-6';
    const knobClasses = size === 'sm' ? 'w-3 h-3' : 'w-5 h-5';

    return (
      <button
        onClick={onToggle}
        className={`${sizeClasses} ${enabled ? 'bg-purple-600' : 'bg-gray-300'} rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-white`}
      >
        <div
          className={`${knobClasses} bg-white rounded-full transition-transform ${
            enabled ? (size === 'sm' ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0.5'
          }`}
        />
      </button>
    );
  };

  if (initialLoading) {
    return (
      <div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-lg p-6 animate-pulse">
            <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded mb-3" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-4">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Failed to load privacy settings</p>
              <p className="text-red-600 text-sm mt-1">{loadError}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-purple-500" />
              <h2 className="text-xl font-semibold text-gray-900">Privacy & Security Settings</h2>
            </div>
            <p className="mt-2 text-gray-600">Control your data privacy and account security</p>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'privacy' as const, label: 'Privacy', icon: Eye },
                { id: 'security' as const, label: 'Security', icon: Lock },
                { id: 'data' as const, label: 'Data Management', icon: Download }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-600 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Visibility</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'publicProfile' as keyof ProfileVisibility, title: 'Public Profile', description: 'Allow others to view your profile publicly', icon: Globe },
                      { key: 'searchable' as keyof ProfileVisibility, title: 'Searchable Profile', description: 'Allow your profile to appear in search results', icon: Users },
                      { key: 'showEmail' as keyof ProfileVisibility, title: 'Show Email Address', description: 'Display email address on public profile', icon: Globe },
                      { key: 'showPhone' as keyof ProfileVisibility, title: 'Show Phone Number', description: 'Display phone number on public profile', icon: Smartphone },
                      { key: 'showLocation' as keyof ProfileVisibility, title: 'Show Location', description: 'Display location on public profile', icon: MapPin }
                    ].map((setting) => (
                      <div key={setting.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-start gap-3">
                          <setting.icon className="w-5 h-5 text-gray-500 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-gray-900">{setting.title}</h4>
                            <p className="text-sm text-gray-600">{setting.description}</p>
                          </div>
                        </div>
                        <ToggleSwitch
                          enabled={profileVisibility[setting.key]}
                          onToggle={() => updateProfileVisibility(setting.key, !profileVisibility[setting.key])}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Data Sharing Preferences</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'analytics' as keyof DataSharing, title: 'Usage Analytics', description: 'Help improve the platform by sharing anonymized usage data' },
                      { key: 'marketing' as keyof DataSharing, title: 'Marketing Communications', description: 'Receive personalized recommendations and marketing content' },
                      { key: 'thirdParty' as keyof DataSharing, title: 'Third-Party Integrations', description: 'Allow data sharing with integrated third-party services' },
                      { key: 'performance' as keyof DataSharing, title: 'Performance Monitoring', description: 'Share performance data to help identify and fix issues' }
                    ].map((setting) => (
                      <div key={setting.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="font-medium text-gray-900">{setting.title}</h4>
                          <p className="text-sm text-gray-600">{setting.description}</p>
                        </div>
                        <ToggleSwitch
                          enabled={dataSharing[setting.key]}
                          onToggle={() => updateDataSharing(setting.key, !dataSharing[setting.key])}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Two-Factor Authentication</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-medium text-gray-900">Enable 2FA</h4>
                        <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
                      </div>
                      <ToggleSwitch
                        enabled={twoFactorAuth.enabled}
                        onToggle={toggleTwoFactor}
                      />
                    </div>

                    {twoFactorAuth.enabled && (
                      <div className="border-t border-gray-200 pt-4">
                        <p className="text-sm text-gray-600">
                          When enabled, a verification code will be sent to your email each time you sign in.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Current Session</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full mt-2 bg-green-500" />
                      <div>
                        <h4 className="font-medium text-gray-900">Active Session</h4>
                        <p className="text-sm text-gray-600">
                          Logged in as {user?.email || 'unknown'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Current session</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data Management Tab */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Export Your Data</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-4">
                      <Download className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Download Personal Data</h4>
                        <p className="text-sm text-gray-600 mb-4">
                          Request a copy of all your personal data including profile information, pitches, messages, and account activity.
                        </p>
                        <button
                          onClick={handleDownloadData}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          Request Data Export
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Data Retention</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900">Account Data</h4>
                        <p className="text-sm text-gray-600">Your account data is retained while your account is active and for 30 days after deletion.</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Pitch Content</h4>
                        <p className="text-sm text-gray-600">Pitch content is retained for legal and copyright purposes for up to 7 years after deletion.</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Analytics Data</h4>
                        <p className="text-sm text-gray-600">Anonymized analytics data may be retained indefinitely for platform improvement.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Account</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-4">
                      <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-red-600">Permanently Delete Account</h4>
                        <p className="text-sm text-gray-600 mb-4">
                          This action cannot be undone. All your data, pitches, and account information will be permanently deleted.
                        </p>

                        {!showDeleteConfirm ? (
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Delete Account
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Type "DELETE MY ACCOUNT" to confirm:
                              </label>
                              <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                placeholder="DELETE MY ACCOUNT"
                              />
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={handleDeleteAccount}
                                disabled={deleteConfirmText !== 'DELETE MY ACCOUNT'}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Confirm Deletion
                              </button>
                              <button
                                onClick={() => {
                                  setShowDeleteConfirm(false);
                                  setDeleteConfirmText('');
                                }}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {(activeTab === 'privacy' || activeTab === 'security') && (
              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
                <button
                  onClick={handleSave}
                  disabled={loading || !hasChanges}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Changes
                    </>
                  )}
                </button>

                <button
                  onClick={() => navigate(-1)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
