import React, { useState, useEffect } from 'react';
import {
  Activity, Users, Eye, Heart, MessageSquare,
  FileText, Film, Star, ArrowRight, Bell, Filter,
  RefreshCw, CheckCircle, AlertCircle, TrendingUp,
  User, DollarSign,
} from 'lucide-react';
import { API_URL } from '@/config';
import { NotificationsService } from '@features/notifications/services/notifications.service';

interface ActivityItem {
  id: string;
  type: 'pitch_view' | 'pitch_like' | 'nda_request' | 'nda_signed' | 'project_update' | 'team_activity' | 'system_notification' | 'collaboration' | 'milestone' | 'review';
  title: string;
  description: string;
  timestamp: string;
  user?: {
    id: string;
    name: string;
    avatar?: string;
    type: 'creator' | 'investor' | 'production' | 'admin';
  };
  project?: {
    id: string;
    title: string;
    genre?: string;
  };
  metadata?: {
    pitchId?: string;
    projectId?: string;
    amount?: number;
    status?: string;
    priority?: 'low' | 'medium' | 'high';
  };
  isRead: boolean;
  isImportant: boolean;
}

interface ActivityFilters {
  type: 'all' | 'pitches' | 'projects' | 'team' | 'notifications' | 'collaborations';
  timeRange: '1h' | '24h' | '7d' | '30d' | 'all';
  importance: 'all' | 'important' | 'normal';
  readStatus: 'all' | 'unread' | 'read';
}

export default function ProductionActivity() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [filters, setFilters] = useState<ActivityFilters>({
    type: 'all',
    timeRange: '24h',
    importance: 'all',
    readStatus: 'all'
  });

  // Load activity feed from API (re-fetch when time range changes)
  useEffect(() => {
    void loadActivityFeed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.timeRange]);

  // Apply filters when activities or filters change
  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, filters]);

  const loadActivityFeed = async () => {
    try {
      setError(null);
    const params = new URLSearchParams();
    if (filters.timeRange !== 'all') params.set('timeRange', filters.timeRange);
    const qs = params.toString();
    const response = await fetch(`${API_URL}/api/production/activity${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) {
        throw new Error(`Activity feed API error: ${response.status}`);
      }

      const data = await response.json() as { data?: { activities?: ActivityItem[] }; activities?: ActivityItem[] };
      setActivities(data.data?.activities ?? data.activities ?? []);
      
    } catch (err) {
      console.error('Failed to load activity feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activity feed');
      setActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...activities];

    // Filter by type
    if (filters.type !== 'all') {
      const typeFilters: Record<string, string[]> = {
        pitches: ['pitch_view', 'pitch_like'],
        projects: ['project_update', 'milestone'],
        team: ['team_activity'],
        notifications: ['system_notification'],
        collaborations: ['collaboration', 'nda_request', 'nda_signed', 'review']
      };
      
      if (typeFilters[filters.type]) {
        filtered = filtered.filter(activity => typeFilters[filters.type].includes(activity.type));
      }
    }

    // Filter by time range
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const timeRanges: Record<string, number> = {
        '1h': 1 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const rangeMs = timeRanges[filters.timeRange];
      if (rangeMs) {
        const cutoff = new Date(now.getTime() - rangeMs);
        filtered = filtered.filter(activity => new Date(activity.timestamp) > cutoff);
      }
    }

    // Filter by importance
    if (filters.importance !== 'all') {
      filtered = filtered.filter(activity => 
        filters.importance === 'important' ? activity.isImportant : !activity.isImportant
      );
    }

    // Filter by read status
    if (filters.readStatus !== 'all') {
      filtered = filtered.filter(activity => 
        filters.readStatus === 'unread' ? !activity.isRead : activity.isRead
      );
    }

    setFilteredActivities(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActivityFeed();
  };

  const markAsRead = async (activityId: string) => {
    setActivities(prev => prev.map(activity =>
      activity.id === activityId ? { ...activity, isRead: true } : activity
    ));
    try {
      await NotificationsService.markAsRead(parseInt(activityId, 10));
    } catch {
      setActivities(prev => prev.map(activity =>
        activity.id === activityId ? { ...activity, isRead: false } : activity
      ));
    }
  };

  const markAllAsRead = async () => {
    const prev = [...activities];
    setActivities(a => a.map(activity => ({ ...activity, isRead: true })));
    try {
      await NotificationsService.markAllAsRead();
    } catch {
      setActivities(prev);
    }
  };

  const getActivityIcon = (type: string) => {
    const iconMap: Record<string, React.ElementType> = {
      pitch_view: Eye,
      pitch_like: Heart,
      nda_request: FileText,
      nda_signed: CheckCircle,
      project_update: Film,
      team_activity: Users,
      system_notification: Bell,
      collaboration: Star,
      milestone: TrendingUp,
      review: MessageSquare
    };
    
    return iconMap[type] || Activity;
  };

  const getActivityColor = (type: string, isImportant: boolean) => {
    if (isImportant) return 'text-red-500 bg-red-50';
    
    const colorMap: Record<string, string> = {
      pitch_view: 'text-blue-500 bg-blue-50',
      pitch_like: 'text-pink-500 bg-pink-50',
      nda_request: 'text-orange-500 bg-orange-50',
      nda_signed: 'text-green-500 bg-green-50',
      project_update: 'text-purple-500 bg-purple-50',
      team_activity: 'text-indigo-500 bg-indigo-50',
      system_notification: 'text-gray-500 bg-gray-50',
      collaboration: 'text-yellow-500 bg-yellow-50',
      milestone: 'text-emerald-500 bg-emerald-50',
      review: 'text-teal-500 bg-teal-50'
    };
    
    return colorMap[type] || 'text-gray-500 bg-gray-50';
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading activity feed...</span>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = activities.filter(a => !a.isRead).length;

  return (
    <div>
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity Feed</h1>
            <p className="mt-2 text-sm text-gray-600">
              Real-time updates on projects, team activities, and collaboration opportunities
            </p>
            {unreadCount > 0 && (
              <p className="mt-1 text-sm font-medium text-blue-600">
                {unreadCount} unread {unreadCount === 1 ? 'activity' : 'activities'}
              </p>
            )}
          </div>
          
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark All Read
            </button>
            
            <button
              onClick={() => { void handleRefresh(); }}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error != null && error !== '' && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  API Connection Issue
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Unable to connect to activity feed API. {error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Activity Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activity Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as ActivityFilters['type'] }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Activities</option>
                <option value="pitches">Pitches</option>
                <option value="projects">Projects</option>
                <option value="team">Team</option>
                <option value="collaborations">Collaborations</option>
                <option value="notifications">Notifications</option>
              </select>
            </div>

            {/* Time Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Range
              </label>
              <select
                value={filters.timeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as ActivityFilters['timeRange'] }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Importance Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Importance
              </label>
              <select
                value={filters.importance}
                onChange={(e) => setFilters(prev => ({ ...prev, importance: e.target.value as ActivityFilters['importance'] }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="important">Important Only</option>
                <option value="normal">Normal Only</option>
              </select>
            </div>

            {/* Read Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Read Status
              </label>
              <select
                value={filters.readStatus}
                onChange={(e) => setFilters(prev => ({ ...prev, readStatus: e.target.value as ActivityFilters['readStatus'] }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="unread">Unread Only</option>
                <option value="read">Read Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No activities found</h3>
              <p className="text-gray-600">
                {activities.length === 0 
                  ? "No activities to display. Check back later for updates."
                  : "No activities match your current filters. Try adjusting the filter criteria."
                }
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredActivities.map((activity) => {
                const IconComponent = getActivityIcon(activity.type);
                const iconColor = getActivityColor(activity.type, activity.isImportant);
                
                return (
                  <li key={activity.id} className={`px-6 py-4 hover:bg-gray-50 ${!activity.isRead ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-start space-x-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconColor}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <p className={`text-sm font-medium ${!activity.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                              {activity.title}
                            </p>
                            {activity.isImportant && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                Important
                              </span>
                            )}
                            {!activity.isRead && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {formatTimestamp(activity.timestamp)}
                          </p>
                        </div>
                        
                        <p className="mt-1 text-sm text-gray-600">{activity.description}</p>
                        
                        {activity.user && (
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <User className="w-4 h-4 mr-1" />
                            <span className="font-medium">{activity.user.name}</span>
                            <span className="mx-2">•</span>
                            <span className="capitalize">{activity.user.type}</span>
                          </div>
                        )}
                        
                        {activity.project && (
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <Film className="w-4 h-4 mr-1" />
                            <span className="font-medium">{activity.project.title}</span>
                            {activity.project.genre && (
                              <>
                                <span className="mx-2">•</span>
                                <span>{activity.project.genre}</span>
                              </>
                            )}
                          </div>
                        )}
                        
                        {activity.metadata?.amount && (
                          <div className="mt-2 flex items-center text-sm text-gray-600">
                            <DollarSign className="w-4 h-4 mr-1" />
                            <span className="font-semibold">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 0
                              }).format(activity.metadata.amount)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-shrink-0 flex items-center space-x-2">
                        {!activity.isRead && (
                          <button
                            onClick={() => markAsRead(activity.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Mark Read
                          </button>
                        )}
                        {(activity.metadata?.pitchId || activity.metadata?.projectId) && (
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}