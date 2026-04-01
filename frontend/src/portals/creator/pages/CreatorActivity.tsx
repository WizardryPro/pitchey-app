import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Bell, Heart, MessageSquare, Eye, Star,
  TrendingUp, Award, Users, FileText, PlayCircle,
  Calendar, Clock, ChevronRight, Filter, RefreshCw,
  AlertCircle
} from 'lucide-react';
import { CreatorService, type CreatorActivity as CreatorActivityType } from '@features/analytics/services/creator.service';

interface ActivityItem {
  id: string;
  type: 'view' | 'like' | 'comment' | 'follow' | 'investment' | 'nda' | 'milestone';
  title: string;
  description: string;
  timestamp: Date;
  user?: {
    name: string;
    role: string;
    avatar?: string;
  };
  pitch?: {
    id: string;
    title: string;
  };
  metadata?: {
    amount?: number;
    status?: string;
    milestone?: string;
  };
  read: boolean;
}

// Map API activity types to local types
function mapActivityType(apiType: string): ActivityItem['type'] {
  const typeMap: Record<string, ActivityItem['type']> = {
    'pitch_created': 'milestone',
    'pitch_published': 'milestone',
    'pitch_updated': 'milestone',
    'nda_signed': 'nda',
    'message_sent': 'comment',
    'pitch_view': 'view',
    'pitch_like': 'like',
    'nda_request': 'nda',
    'follow': 'follow',
    'investment': 'investment',
  };
  return typeMap[apiType] || 'milestone';
}

// Transform API activity to local format
function transformActivity(apiActivity: CreatorActivityType & { user?: { name: string; role: string } }): ActivityItem {
  return {
    id: String(apiActivity.id),
    type: mapActivityType(apiActivity.type),
    title: apiActivity.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: apiActivity.description,
    timestamp: new Date(apiActivity.createdAt),
    metadata: apiActivity.metadata,
    read: true, // API doesn't have read status yet
    ...(apiActivity.user ? {
      user: {
        name: apiActivity.user.name,
        role: apiActivity.user.role,
      }
    } : {}),
    ...(apiActivity.metadata?.pitchId ? {
      pitch: {
        id: String(apiActivity.metadata.pitchId),
        title: apiActivity.metadata.pitchTitle || ''
      }
    } : {}),
  };
}

export default function CreatorActivity() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    unreadCount: 0,
    todayViews: 0,
    newFollowers: 0,
    engagementRate: 0
  });

  const isInitialLoad = useRef(true);

  const loadActivities = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const response = await CreatorService.getActivityFeed({ limit: 50 });

      if (response.activities && response.activities.length > 0) {
        const transformedActivities = response.activities.map(transformActivity);
        setActivities(transformedActivities);
      } else {
        setActivities([]);
      }
    } catch (err) {
      console.error('Failed to load activities:', err);
      if (!silent) {
        setError('Failed to load activity feed. Please try again.');
      }
      if (!silent) {
        setActivities([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      isInitialLoad.current = false;
    }
  }, []);

  // Load activities from API on mount
  useEffect(() => {
    loadActivities();
    loadStats();
  }, [loadActivities]);

  // Auto-poll every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadActivities(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadActivities]);

  const loadStats = async () => {
    try {
      const [dashboardData, followerData] = await Promise.all([
        CreatorService.getDashboard(),
        CreatorService.getFollowers({ limit: 1 }).catch(() => ({ followers: [], total: 0 }))
      ]);

      // Calculate stats from dashboard data
      const unreadNotifications = dashboardData.notifications?.filter(n => !n.isRead).length || 0;
      const todayViews = dashboardData.stats?.totalViews || 0;
      const engagementRate = dashboardData.stats?.avgEngagementRate || 0;

      setStats({
        unreadCount: unreadNotifications,
        todayViews: todayViews,
        newFollowers: followerData.total || 0,
        engagementRate: engagementRate
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
      // Keep default stats on error
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadActivities(), loadStats()]);
    setRefreshing(false);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'view': return Eye;
      case 'like': return Heart;
      case 'comment': return MessageSquare;
      case 'follow': return Users;
      case 'investment': return TrendingUp;
      case 'nda': return FileText;
      case 'milestone': return Award;
      default: return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'view': return 'text-blue-600 bg-blue-50';
      case 'like': return 'text-red-600 bg-red-50';
      case 'comment': return 'text-green-600 bg-green-50';
      case 'follow': return 'text-purple-600 bg-purple-50';
      case 'investment': return 'text-yellow-600 bg-yellow-50';
      case 'nda': return 'text-indigo-600 bg-indigo-50';
      case 'milestone': return 'text-pink-600 bg-pink-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.type === filter);

  const unreadCount = stats.unreadCount || activities.filter(a => !a.read).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Activity Feed</h1>
            <p className="mt-2 text-gray-600">
              Stay updated with all interactions on your pitches
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unread</p>
                <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
              </div>
              <Bell className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Views</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todayViews.toLocaleString()}</p>
              </div>
              <Eye className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Followers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.newFollowers}</p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Engagement Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.engagementRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
              filter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border'
            }`}
          >
            All Activity
          </button>
          {['view', 'like', 'comment', 'follow', 'investment', 'nda', 'milestone'].map((type) => {
            const Icon = getActivityIcon(type);
            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                  filter === type
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border'
                }`}
              >
                <Icon className="w-4 h-4" />
                {type.charAt(0).toUpperCase() + type.slice(1)}s
              </button>
            );
          })}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
            <button
              onClick={handleRefresh}
              className="ml-auto text-red-600 hover:text-red-800 font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Activity List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredActivities.length > 0 ? (
        <div className="space-y-4">
          {filteredActivities.map((activity) => {
            const Icon = getActivityIcon(activity.type);
            const colorClass = getActivityColor(activity.type);
            
            return (
              <div
                key={activity.id}
                className={`bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition cursor-pointer ${
                  !activity.read ? 'border-l-4 border-l-purple-600' : ''
                }`}
                onClick={() => activity.pitch && navigate(`/pitch/${activity.pitch.id}`)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClass}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{activity.title}</h3>
                        <p className="text-gray-600 mt-1">{activity.description}</p>
                        {activity.metadata && (
                          <div className="mt-2 flex items-center gap-4 text-sm">
                            {activity.metadata.amount && (
                              <span className="text-green-600 font-semibold">
                                ${activity.metadata.amount.toLocaleString()}
                              </span>
                            )}
                            {activity.metadata.status && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                                {activity.metadata.status}
                              </span>
                            )}
                            {activity.metadata.milestone && (
                              <span className="text-purple-600 font-medium">
                                🎉 {activity.metadata.milestone}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        {formatTimestamp(activity.timestamp)}
                      </div>
                    </div>
                    {activity.user && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-sm">
                          {activity.user.name.charAt(0)}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">{activity.user.name}</span>
                          <span className="text-gray-500"> • {activity.user.role}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No activity yet</h3>
          <p className="text-gray-600 mb-6">
            Activity related to your pitches will appear here
          </p>
          <button
            onClick={() => navigate('/creator/pitch/new')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Create Your First Pitch
          </button>
        </div>
      )}
    </div>
  );
}