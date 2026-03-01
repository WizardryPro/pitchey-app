/**
 * Comprehensive Notification Preferences Component
 * Manages all notification settings including channels, frequencies, and categories
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@shared/components/feedback/ToastProvider';
import api from '../lib/api';
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Settings,
  Clock,
  Moon,
  Sun,
  Globe,
  TrendingUp,
  DollarSign,
  FileText,
  Users,
  Star,
  AlertCircle,
  CheckCircle,
  Info,
  Zap,
  Calendar,
  BarChart3,
  Heart,
  Eye,
  MessageCircle,
  Building2,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  Loader2
} from 'lucide-react';

export interface NotificationPreferences {
  // Channel preferences
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  inAppNotifications: boolean;

  // General settings
  marketingEmails: boolean;
  digestFrequency: 'instant' | 'hourly' | 'daily' | 'weekly' | 'never';
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm format
  quietHoursEnd: string;   // HH:mm format
  timezone: string;

  // Category-specific preferences
  ndaNotifications: boolean;
  investmentNotifications: boolean;
  messageNotifications: boolean;
  pitchUpdateNotifications: boolean;
  systemNotifications: boolean;

  // Production-specific notifications
  submissionStatusUpdates: boolean;
  meetingReminders: boolean;
  contractNotifications: boolean;
  milestoneUpdates: boolean;
  dealNotifications: boolean;

  // Marketplace-specific notifications
  newPitchMatches: boolean;
  priceAlerts: boolean;
  trendingPitches: boolean;
  featuredContent: boolean;
  recommendationsEnabled: boolean;
  savedPitchUpdates: boolean;

  // Digest preferences
  dailyDigest: boolean;
  weeklyDigest: boolean;
  monthlyDigest: boolean;
  marketInsights: boolean;
  portfolioUpdates: boolean;

  // Advanced settings
  notificationPriority: 'all' | 'high_only' | 'urgent_only';
  batchNotifications: boolean;
  smartFiltering: boolean; // AI-powered notification filtering
}

interface NotificationCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  preferences: Array<{
    key: keyof NotificationPreferences;
    label: string;
    description: string;
    channels?: ('email' | 'push' | 'sms' | 'app')[];
    premium?: boolean;
  }>;
  expandedByDefault?: boolean;
}

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    id: 'general',
    title: 'General Notifications',
    description: 'Core platform notifications and system updates',
    icon: Bell,
    expandedByDefault: true,
    preferences: [
      {
        key: 'systemNotifications',
        label: 'System Updates',
        description: 'Platform updates, maintenance, and important announcements',
        channels: ['email', 'app']
      },
      {
        key: 'messageNotifications',
        label: 'Direct Messages',
        description: 'New messages from other users',
        channels: ['email', 'push', 'app']
      },
      {
        key: 'marketingEmails',
        label: 'Marketing Communications',
        description: 'Product updates, tips, and promotional content',
        channels: ['email']
      }
    ]
  },
  {
    id: 'pitches',
    title: 'Pitch & Submission Updates',
    description: 'Notifications about your pitches and submissions',
    icon: FileText,
    preferences: [
      {
        key: 'pitchUpdateNotifications',
        label: 'Pitch Updates',
        description: 'Changes to your pitch content, status, or feedback',
        channels: ['email', 'push', 'app']
      },
      {
        key: 'submissionStatusUpdates',
        label: 'Submission Status Changes',
        description: 'Updates on pitch submissions to production companies',
        channels: ['email', 'push', 'app']
      },
      {
        key: 'ndaNotifications',
        label: 'NDA Requests & Approvals',
        description: 'Non-disclosure agreement requests and status updates',
        channels: ['email', 'app']
      }
    ]
  },
  {
    id: 'investment',
    title: 'Investment & Financial',
    description: 'Investment opportunities and financial updates',
    icon: DollarSign,
    preferences: [
      {
        key: 'investmentNotifications',
        label: 'Investment Opportunities',
        description: 'New investment opportunities matching your criteria',
        channels: ['email', 'push', 'app']
      },
      {
        key: 'priceAlerts',
        label: 'Price Alerts',
        description: 'Price changes on watched investments and pitches',
        channels: ['email', 'push', 'sms', 'app']
      },
      {
        key: 'dealNotifications',
        label: 'Deal Updates',
        description: 'Contract offers, negotiations, and deal closures',
        channels: ['email', 'push', 'app']
      },
      {
        key: 'portfolioUpdates',
        label: 'Portfolio Performance',
        description: 'Updates on your investment portfolio performance',
        channels: ['email', 'app']
      }
    ]
  },
  {
    id: 'production',
    title: 'Production Management',
    description: 'Production company and project management notifications',
    icon: Building2,
    preferences: [
      {
        key: 'meetingReminders',
        label: 'Meeting Reminders',
        description: 'Upcoming meetings and scheduling updates',
        channels: ['email', 'push', 'sms', 'app']
      },
      {
        key: 'contractNotifications',
        label: 'Contract Management',
        description: 'Contract drafts, signatures, and legal updates',
        channels: ['email', 'app']
      },
      {
        key: 'milestoneUpdates',
        label: 'Project Milestones',
        description: 'Production milestone updates and deadline reminders',
        channels: ['email', 'push', 'app']
      }
    ]
  },
  {
    id: 'marketplace',
    title: 'Marketplace & Discovery',
    description: 'Marketplace activity and content discovery',
    icon: TrendingUp,
    preferences: [
      {
        key: 'newPitchMatches',
        label: 'New Pitch Matches',
        description: 'Pitches matching your investment criteria',
        channels: ['email', 'push', 'app']
      },
      {
        key: 'trendingPitches',
        label: 'Trending Content',
        description: 'Popular and trending pitches in your areas of interest',
        channels: ['email', 'app']
      },
      {
        key: 'featuredContent',
        label: 'Featured Content',
        description: 'Curated and featured pitches from the editorial team',
        channels: ['app']
      },
      {
        key: 'savedPitchUpdates',
        label: 'Saved Pitch Updates',
        description: 'Updates to pitches you\'ve saved or bookmarked',
        channels: ['email', 'app']
      },
      {
        key: 'recommendationsEnabled',
        label: 'AI Recommendations',
        description: 'Personalized pitch recommendations powered by AI',
        channels: ['email', 'app'],
        premium: true
      }
    ]
  },
  {
    id: 'digest',
    title: 'Digest & Summary',
    description: 'Consolidated updates and periodic summaries',
    icon: BarChart3,
    preferences: [
      {
        key: 'dailyDigest',
        label: 'Daily Digest',
        description: 'Daily summary of activity and opportunities',
        channels: ['email']
      },
      {
        key: 'weeklyDigest',
        label: 'Weekly Report',
        description: 'Comprehensive weekly performance and market report',
        channels: ['email']
      },
      {
        key: 'monthlyDigest',
        label: 'Monthly Analytics',
        description: 'Detailed monthly analytics and insights',
        channels: ['email']
      },
      {
        key: 'marketInsights',
        label: 'Market Insights',
        description: 'Market trends and analysis reports',
        channels: ['email', 'app']
      }
    ]
  }
];

const DIGEST_FREQUENCIES = [
  { value: 'instant', label: 'Instant', description: 'Receive notifications immediately' },
  { value: 'hourly', label: 'Hourly', description: 'Batch notifications every hour' },
  { value: 'daily', label: 'Daily', description: 'One digest per day' },
  { value: 'weekly', label: 'Weekly', description: 'Weekly summary on Mondays' },
  { value: 'never', label: 'Never', description: 'Disable all digest notifications' }
];

const PRIORITY_LEVELS = [
  { value: 'all', label: 'All Notifications', description: 'Receive all notifications' },
  { value: 'high_only', label: 'High Priority Only', description: 'Only important notifications' },
  { value: 'urgent_only', label: 'Urgent Only', description: 'Only critical notifications' }
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Mumbai', 'Asia/Dubai',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland'
];

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    // Channel preferences
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    inAppNotifications: true,

    // General settings
    marketingEmails: false,
    digestFrequency: 'daily',
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    timezone: 'America/New_York',

    // Category-specific preferences
    ndaNotifications: true,
    investmentNotifications: true,
    messageNotifications: true,
    pitchUpdateNotifications: true,
    systemNotifications: true,

    // Production-specific notifications
    submissionStatusUpdates: true,
    meetingReminders: true,
    contractNotifications: true,
    milestoneUpdates: true,
    dealNotifications: true,

    // Marketplace-specific notifications
    newPitchMatches: true,
    priceAlerts: true,
    trendingPitches: false,
    featuredContent: false,
    recommendationsEnabled: true,
    savedPitchUpdates: true,

    // Digest preferences
    dailyDigest: true,
    weeklyDigest: true,
    monthlyDigest: false,
    marketInsights: true,
    portfolioUpdates: true,

    // Advanced settings
    notificationPriority: 'all',
    batchNotifications: false,
    smartFiltering: true
  });

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['general']) // General category expanded by default
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPreferences, setOriginalPreferences] = useState<NotificationPreferences | null>(null);

  const toast = useToast();

  // Load preferences from API
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/notifications/preferences') as any;

      if (response && response.ok) {
        const loadedPreferences = response.data;
        setPreferences(loadedPreferences);
        setOriginalPreferences(loadedPreferences);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  // Track changes
  useEffect(() => {
    if (originalPreferences) {
      const hasChanges = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);
      setHasChanges(hasChanges);
    }
  }, [preferences, originalPreferences]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const updatePreference = useCallback((key: keyof NotificationPreferences, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const savePreferences = async () => {
    try {
      setSaving(true);

      const response = await api.put('/api/notifications/preferences', preferences) as any;

      if (response && response.ok) {
        setOriginalPreferences(preferences);
        setHasChanges(false);
        toast.success('Notification preferences saved successfully');
      } else {
        throw new Error(response?.data?.message || 'Failed to save preferences');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const resetPreferences = () => {
    if (originalPreferences) {
      setPreferences(originalPreferences);
      setHasChanges(false);
    }
  };

  const testNotification = async (channel: string) => {
    try {
      await api.post('/api/notifications/test', { channel });
      toast.success(`Test ${channel} notification sent`);
    } catch (error) {
      toast.error(`Failed to send test ${channel} notification`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading notification preferences...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Notification Preferences</h2>
            <p className="text-gray-600">
              Customize how and when you receive notifications across all platform features.
            </p>
          </div>
          <Bell className="w-8 h-8 text-blue-600" />
        </div>

        {/* Quick Channel Toggle */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ChannelToggle
            icon={Mail}
            label="Email"
            enabled={preferences.emailNotifications}
            onChange={(enabled) => updatePreference('emailNotifications', enabled)}
            onTest={() => testNotification('email')}
          />
          <ChannelToggle
            icon={Smartphone}
            label="Push"
            enabled={preferences.pushNotifications}
            onChange={(enabled) => updatePreference('pushNotifications', enabled)}
            onTest={() => testNotification('push')}
          />
          <ChannelToggle
            icon={MessageSquare}
            label="SMS"
            enabled={preferences.smsNotifications}
            onChange={(enabled) => updatePreference('smsNotifications', enabled)}
            onTest={() => testNotification('sms')}
            premium
          />
          <ChannelToggle
            icon={Bell}
            label="In-App"
            enabled={preferences.inAppNotifications}
            onChange={(enabled) => updatePreference('inAppNotifications', enabled)}
            onTest={() => testNotification('app')}
          />
        </div>
      </div>

      {/* Digest Frequency */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Clock className="w-6 h-6 text-blue-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">Digest Frequency</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {DIGEST_FREQUENCIES.map((frequency) => (
            <button
              key={frequency.value}
              onClick={() => updatePreference('digestFrequency', frequency.value)}
              className={`p-4 rounded-lg border-2 transition-all ${
                preferences.digestFrequency === frequency.value
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm">{frequency.label}</div>
              <div className="text-xs text-gray-500 mt-1">{frequency.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Quiet Hours */}
      <QuietHoursSettings
        enabled={preferences.quietHoursEnabled}
        startTime={preferences.quietHoursStart}
        endTime={preferences.quietHoursEnd}
        timezone={preferences.timezone}
        onEnabledChange={(enabled) => updatePreference('quietHoursEnabled', enabled)}
        onStartTimeChange={(time) => updatePreference('quietHoursStart', time)}
        onEndTimeChange={(time) => updatePreference('quietHoursEnd', time)}
        onTimezoneChange={(timezone) => updatePreference('timezone', timezone)}
      />

      {/* Notification Categories */}
      <div className="space-y-4">
        {NOTIFICATION_CATEGORIES.map((category) => (
          <NotificationCategoryCard
            key={category.id}
            category={category}
            preferences={preferences}
            expanded={expandedCategories.has(category.id)}
            onToggle={() => toggleCategory(category.id)}
            onPreferenceChange={updatePreference}
          />
        ))}
      </div>

      {/* Advanced Settings */}
      <AdvancedSettings
        priority={preferences.notificationPriority}
        batchNotifications={preferences.batchNotifications}
        smartFiltering={preferences.smartFiltering}
        onPriorityChange={(priority) => updatePreference('notificationPriority', priority)}
        onBatchNotificationsChange={(enabled) => updatePreference('batchNotifications', enabled)}
        onSmartFilteringChange={(enabled) => updatePreference('smartFiltering', enabled)}
      />

      {/* Save Actions */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-6 bg-white rounded-xl shadow-lg border border-gray-200 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center text-amber-600">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">You have unsaved changes</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={resetPreferences}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-2 inline" />
                Reset
              </button>
              <button
                onClick={savePreferences}
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2 inline" />
                )}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Channel Toggle Component
interface ChannelToggleProps {
  icon: React.ComponentType<any>;
  label: string;
  enabled: boolean;
  premium?: boolean;
  onChange: (enabled: boolean) => void;
  onTest: () => void;
}

function ChannelToggle({ icon: Icon, label, enabled, premium, onChange, onTest }: ChannelToggleProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Icon className="w-5 h-5 text-gray-600 mr-2" />
          <span className="font-medium text-gray-900">{label}</span>
          {premium && <Star className="w-4 h-4 text-amber-500 ml-1" />}
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      <button
        onClick={onTest}
        disabled={!enabled}
        className="w-full text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send test
      </button>
    </div>
  );
}

// Quiet Hours Settings Component
interface QuietHoursSettingsProps {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
  onEnabledChange: (enabled: boolean) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onTimezoneChange: (timezone: string) => void;
}

function QuietHoursSettings({
  enabled,
  startTime,
  endTime,
  timezone,
  onEnabledChange,
  onStartTimeChange,
  onEndTimeChange,
  onTimezoneChange
}: QuietHoursSettingsProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Moon className="w-6 h-6 text-blue-600 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Quiet Hours</h3>
            <p className="text-sm text-gray-600">Reduce notifications during specified hours</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => onTimezoneChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Notification Category Card Component
interface NotificationCategoryCardProps {
  category: NotificationCategory;
  preferences: NotificationPreferences;
  expanded: boolean;
  onToggle: () => void;
  onPreferenceChange: (key: keyof NotificationPreferences, value: any) => void;
}

function NotificationCategoryCard({
  category,
  preferences,
  expanded,
  onToggle,
  onPreferenceChange
}: NotificationCategoryCardProps) {
  const Icon = category.icon;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center">
          <Icon className="w-6 h-6 text-blue-600 mr-3" />
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{category.title}</h3>
            <p className="text-sm text-gray-600">{category.description}</p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-200"
          >
            <div className="p-6 space-y-4">
              {category.preferences.map((pref) => (
                <NotificationPreferenceRow
                  key={pref.key}
                  preference={pref}
                  enabled={preferences[pref.key] as boolean}
                  onChange={(enabled) => onPreferenceChange(pref.key, enabled)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Notification Preference Row Component
interface NotificationPreferenceRowProps {
  preference: {
    key: keyof NotificationPreferences;
    label: string;
    description: string;
    channels?: ('email' | 'push' | 'sms' | 'app')[];
    premium?: boolean;
  };
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function NotificationPreferenceRow({ preference, enabled, onChange }: NotificationPreferenceRowProps) {
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1">
        <div className="flex items-center">
          <h4 className="font-medium text-gray-900">{preference.label}</h4>
          {preference.premium && <Star className="w-4 h-4 text-amber-500 ml-2" />}
        </div>
        <p className="text-sm text-gray-600 mt-1">{preference.description}</p>
        {preference.channels && (
          <div className="flex gap-2 mt-2">
            {preference.channels.map((channel) => (
              <span
                key={channel}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md capitalize"
              >
                {channel}
              </span>
            ))}
          </div>
        )}
      </div>
      <label className="relative inline-flex items-center cursor-pointer ml-4">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );
}

// Advanced Settings Component
interface AdvancedSettingsProps {
  priority: string;
  batchNotifications: boolean;
  smartFiltering: boolean;
  onPriorityChange: (priority: string) => void;
  onBatchNotificationsChange: (enabled: boolean) => void;
  onSmartFilteringChange: (enabled: boolean) => void;
}

function AdvancedSettings({
  priority,
  batchNotifications,
  smartFiltering,
  onPriorityChange,
  onBatchNotificationsChange,
  onSmartFilteringChange
}: AdvancedSettingsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center">
          <Settings className="w-6 h-6 text-blue-600 mr-3" />
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Advanced Settings</h3>
            <p className="text-sm text-gray-600">Fine-tune notification behavior</p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-200 p-6 space-y-6"
          >
            {/* Priority Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Notification Priority Level
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PRIORITY_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => onPriorityChange(level.value)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      priority === level.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm">{level.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{level.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Features */}
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Batch Similar Notifications</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Group similar notifications together to reduce noise
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchNotifications}
                    onChange={(e) => onBatchNotificationsChange(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-start justify-between">
                <div className="flex items-start">
                  <div>
                    <h4 className="font-medium text-gray-900 flex items-center">
                      Smart Filtering
                      <Zap className="w-4 h-4 text-amber-500 ml-2" />
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Use AI to filter out notifications you're less likely to find relevant
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smartFiltering}
                    onChange={(e) => onSmartFilteringChange(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}