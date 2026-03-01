import { useState, useEffect } from 'react';
import {
  Bell,
  BellPlus,
  BellOff,
  Mail,
  Trash2,
  Edit2,
  Save,
  X,
  Clock,
  Calendar,
  Zap,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { API_URL } from '../config';
import { useToast } from '@shared/components/feedback/ToastProvider';
import type { FilterState } from './FilterBar';
import { useBetterAuthStore } from '../store/betterAuthStore';

interface EmailAlert {
  id: number;
  name: string;
  filters: FilterState;
  frequency: 'immediate' | 'daily' | 'weekly';
  isActive: boolean;
  lastSentAt?: string;
  matchesFound: number;
  createdAt: string;
  updatedAt: string;
}

interface EmailAlertsProps {
  currentFilters: FilterState;
  className?: string;
}

export default function EmailAlerts({ 
  currentFilters,
  className = '' 
}: EmailAlertsProps) {
  const { user } = useBetterAuthStore();
  const toast = useToast();
  const [emailAlerts, setEmailAlerts] = useState<EmailAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [editingAlert, setEditingAlert] = useState<EmailAlert | null>(null);
  const [alertName, setAlertName] = useState('');
  const [frequency, setFrequency] = useState<'immediate' | 'daily' | 'weekly'>('daily');
  const [isActive, setIsActive] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  useEffect(() => {
    if (user) {
      void loadEmailAlerts();
      void checkEmailPreferences();
    }
  }, [user]);

  const checkEmailPreferences = async () => {
    try {
      const response = await fetch(`${API_URL}/api/endpoint`, {
        method: 'GET',
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (response.ok) {
        const data = await response.json() as { alertPreferences?: { emailAlerts?: boolean } };
        setEmailEnabled(data.alertPreferences?.emailAlerts !== false);
      }
    } catch (error) {
      console.error('Failed to check email preferences:', error);
    }
  };

  const loadEmailAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/endpoint`, {
        method: 'GET',
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (response.ok) {
        const data = await response.json() as { alerts?: EmailAlert[] };
        setEmailAlerts(data.alerts ?? []);
      }
    } catch (error) {
      console.error('Failed to load email alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async () => {
    if (!alertName.trim()) {
      toast.error('Please enter a name for your alert');
      return;
    }

    if (!emailEnabled) {
      toast.error('Please enable email notifications in your settings first');
      return;
    }

    try {
      setLoading(true);
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        toast.success(editingAlert ? 'Alert updated!' : 'Email alert created!');
        await loadEmailAlerts();
        resetCreateDialog();
      } else {
        throw new Error('Failed to save alert');
      }
    } catch (error) {
      console.error('Failed to save alert:', error);
      toast.error('Failed to save email alert');
    } finally {
      setLoading(false);
    }
  };

  const deleteAlert = async (_alertId: number) => {
    if (!confirm('Are you sure you want to delete this email alert?')) {
      return;
    }

    try {
      setLoading(true);
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'DELETE',
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        toast.success('Alert deleted');
        await loadEmailAlerts();
      } else {
        throw new Error('Failed to delete alert');
      }
    } catch (error) {
      console.error('Failed to delete alert:', error);
      toast.error('Failed to delete alert');
    } finally {
      setLoading(false);
    }
  };

  const toggleAlert = async (alert: EmailAlert) => {
    try {
      setLoading(true);
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'PUT',
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        await loadEmailAlerts();
        toast.success(alert.isActive ? 'Alert paused' : 'Alert activated');
      }
    } catch (error) {
      console.error('Failed to toggle alert:', error);
      toast.error('Failed to update alert');
    } finally {
      setLoading(false);
    }
  };

  const resetCreateDialog = () => {
    setShowCreateDialog(false);
    setEditingAlert(null);
    setAlertName('');
    setFrequency('daily');
    setIsActive(true);
  };

  const openEditDialog = (alert: EmailAlert) => {
    setEditingAlert(alert);
    setAlertName(alert.name);
    setFrequency(alert.frequency);
    setIsActive(alert.isActive);
    setShowCreateDialog(true);
  };

  const hasActiveFilters = () => {
    return (
      currentFilters.genres.length > 0 ||
      currentFilters.formats.length > 0 ||
      currentFilters.developmentStages.length > 0 ||
      currentFilters.creatorTypes.length > 0 ||
      (currentFilters.budgetMin !== undefined && currentFilters.budgetMin > 0) ||
      (currentFilters.budgetMax !== undefined && currentFilters.budgetMax < 999999999) ||
      currentFilters.searchQuery !== '' ||
      currentFilters.hasNDA === true ||
      currentFilters.seekingInvestment === true
    );
  };

  const getFrequencyIcon = (freq: string) => {
    switch (freq) {
      case 'immediate':
        return <Zap className="w-4 h-4 text-yellow-600" />;
      case 'daily':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'weekly':
        return <Calendar className="w-4 h-4 text-green-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'immediate':
        return 'Instant';
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      default:
        return freq;
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main Buttons */}
      <div className="flex items-center gap-2">
        {/* Create Alert Button */}
        {hasActiveFilters() && (
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            disabled={loading}
          >
            <BellPlus className="w-4 h-4" />
            Create Alert
          </button>
        )}

        {/* Manage Alerts Button */}
        {emailAlerts.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowManageDialog(!showManageDialog)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm relative"
            >
              <Bell className="w-4 h-4" />
              <span>Email Alerts ({emailAlerts.length})</span>
              {emailAlerts.some(a => a.isActive) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </button>

            {showManageDialog && (
              <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[360px] max-h-[450px] overflow-y-auto z-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Your Email Alerts
                  </h3>
                  {!emailEnabled && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Email disabled
                    </span>
                  )}
                </div>
                
                {!emailEnabled && (
                  <div className="mb-3 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                    Email notifications are disabled. Enable them in your account settings to receive alerts.
                  </div>
                )}
                
                <div className="space-y-2">
                  {emailAlerts.map(alert => (
                    <div
                      key={alert.id}
                      className={`p-3 border rounded-lg transition-colors ${
                        alert.isActive 
                          ? 'border-gray-200 hover:bg-gray-50' 
                          : 'border-gray-100 bg-gray-50 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{alert.name}</h4>
                            {alert.isActive ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                Active
                              </span>
                            ) : (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                Paused
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              {getFrequencyIcon(alert.frequency)}
                              {getFrequencyLabel(alert.frequency)}
                            </span>
                            {alert.lastSentAt !== undefined && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                Last sent: {new Date(alert.lastSentAt).toLocaleDateString()}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {alert.matchesFound} matches
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { void toggleAlert(alert); }}
                            className={`p-1.5 rounded transition-colors ${
                              alert.isActive 
                                ? 'text-green-600 hover:bg-green-50' 
                                : 'text-gray-400 hover:bg-gray-100'
                            }`}
                            title={alert.isActive ? 'Pause Alert' : 'Activate Alert'}
                          >
                            {alert.isActive ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => openEditDialog(alert)}
                            className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                            title="Edit Alert"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { void deleteAlert(alert.id); }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Alert"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {emailAlerts.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Bell className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p>No email alerts yet</p>
                      <p className="text-xs mt-1">Create an alert to get notified about new matching pitches</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Alert Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingAlert ? 'Edit Email Alert' : 'Create Email Alert'}
              </h3>
              <button
                onClick={resetCreateDialog}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alert Name *
                </label>
                <input
                  type="text"
                  value={alertName}
                  onChange={(e) => setAlertName(e.target.value)}
                  placeholder="e.g., New Action Films Alert"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Frequency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['immediate', 'daily', 'weekly'] as const).map(freq => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setFrequency(freq)}
                      className={`flex flex-col items-center gap-1 p-3 border rounded-lg transition-colors ${
                        frequency === freq
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {getFrequencyIcon(freq)}
                      <span className="text-xs font-medium">{getFrequencyLabel(freq)}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {frequency === 'immediate' && "Get notified as soon as a matching pitch is posted"}
                  {frequency === 'daily' && "Receive a daily digest of matching pitches"}
                  {frequency === 'weekly' && "Get a weekly summary of matching pitches"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="alertActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="alertActive" className="text-sm text-gray-700">
                  Start receiving alerts immediately
                </label>
              </div>

              {!emailEnabled && (
                <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Email notifications are currently disabled in your settings
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={resetCreateDialog}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { void createAlert(); }}
                disabled={!alertName.trim() || loading || !emailEnabled}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {editingAlert ? 'Update' : 'Create'} Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showManageDialog && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowManageDialog(false)}
        />
      )}
    </div>
  );
}