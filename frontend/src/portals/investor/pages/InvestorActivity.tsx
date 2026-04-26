import { useState, useEffect } from 'react';
import {
  Activity, TrendingUp, DollarSign, Eye, Heart,
  MessageSquare, FileText, Bell, Filter, RefreshCw,
  CheckCircle, AlertCircle, Calendar, User, Film,
  ArrowRight, Star, Award, Building, Clock,
  ThumbsUp, ThumbsDown, Share2, Bookmark
} from 'lucide-react';
import { config } from '@/config';
import { apiClient } from '@/lib/api-client';

interface ActivityItem {
  id: string;
  type: 'pitch_view' | 'investment' | 'due_diligence' | 'portfolio_update' | 'market_alert' | 'creator_follow' | 'collaboration' | 'funding_round' | 'exit' | 'dividend';
  title: string;
  description: string;
  timestamp: string;
  creator?: {
    id: string;
    name: string;
    avatar?: string;
  };
  project?: {
    id: string;
    title: string;
    genre?: string;
    budget?: number;
  };
  investment?: {
    amount: number;
    stake: number;
    valuation?: number;
    roi?: number;
  };
  metadata?: {
    priority?: 'low' | 'medium' | 'high';
    category?: string;
    status?: string;
    attachments?: number;
  };
  isRead: boolean;
  isImportant: boolean;
}

interface ActivityFilters {
  type: 'all' | 'investments' | 'portfolio' | 'opportunities' | 'market' | 'social';
  timeRange: '1h' | '24h' | '7d' | '30d' | 'all';
  importance: 'all' | 'important' | 'normal';
  readStatus: 'all' | 'unread' | 'read';
}

export default function InvestorActivity() {
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

  // Load activity feed from API
  useEffect(() => {
    loadActivityFeed();
  }, []);

  // Apply filters when activities or filters change
  useEffect(() => {
    applyFilters();
  }, [activities, filters]);

  const loadActivityFeed = async () => {
    try {
      setError(null);

      // Fetch activity feed from API
      const response = await apiClient.get<{
        success: boolean;
        data?: {
          activities: any[];
          total: number;
        };
        activities?: any[];
        error?: { message: string };
      }>('/api/investor/activity/feed');

      if (response.success) {
        const apiActivities = response.data?.activities || (response as any).activities || [];

        // Transform API response to match component interface
        const transformedActivities: ActivityItem[] = apiActivities.map((activity: any, index: number) => ({
          id: String(activity.id || index + 1),
          type: mapActivityType(activity.type || activity.activityType || 'pitch_view'),
          title: activity.title || getActivityTitle(activity.type),
          description: activity.description || activity.message || '',
          timestamp: activity.timestamp || activity.createdAt || new Date().toISOString(),
          creator: activity.creator ? {
            id: String(activity.creator.id),
            name: activity.creator.name || activity.creator.username || 'Unknown',
            avatar: activity.creator.avatar
          } : undefined,
          project: activity.project || activity.pitch ? {
            id: String(activity.project?.id || activity.pitch?.id || ''),
            title: activity.project?.title || activity.pitch?.title || '',
            genre: activity.project?.genre || activity.pitch?.genre,
            budget: activity.project?.budget || activity.pitch?.estimatedBudget
          } : undefined,
          investment: activity.investment ? {
            amount: activity.investment.amount || 0,
            stake: activity.investment.stake || activity.investment.equityPercentage || 0,
            valuation: activity.investment.valuation,
            roi: activity.investment.roi || activity.investment.returnPercentage
          } : undefined,
          metadata: {
            priority: activity.priority || activity.metadata?.priority || 'medium',
            status: activity.status || activity.metadata?.status,
            category: activity.category || activity.metadata?.category,
            attachments: activity.attachments || activity.metadata?.attachments
          },
          isRead: activity.isRead ?? activity.read ?? false,
          isImportant: activity.isImportant ?? activity.important ?? activity.priority === 'high'
        }));

        setActivities(transformedActivities);
      } else {
        // API returned error, use empty state
        console.warn('Activity feed API returned error:', response.error?.message);
        setActivities([]);
      }
    } catch (err) {
      console.error('Failed to load activity feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activity feed');
      setActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper to map API activity types to component types
  const mapActivityType = (apiType: string): ActivityItem['type'] => {
    const typeMap: Record<string, ActivityItem['type']> = {
      'investment': 'investment',
      'pitch_view': 'pitch_view',
      'view': 'pitch_view',
      'due_diligence': 'due_diligence',
      'diligence': 'due_diligence',
      'portfolio_update': 'portfolio_update',
      'portfolio': 'portfolio_update',
      'market_alert': 'market_alert',
      'alert': 'market_alert',
      'creator_follow': 'creator_follow',
      'follow': 'creator_follow',
      'collaboration': 'collaboration',
      'funding_round': 'funding_round',
      'funding': 'funding_round',
      'exit': 'exit',
      'dividend': 'dividend'
    };
    return typeMap[apiType.toLowerCase()] || 'pitch_view';
  };

  // Helper to generate title based on activity type
  const getActivityTitle = (type: string): string => {
    const titleMap: Record<string, string> = {
      'investment': 'Investment activity',
      'pitch_view': 'Pitch viewed',
      'due_diligence': 'Due diligence update',
      'portfolio_update': 'Portfolio update',
      'market_alert': 'Market alert',
      'creator_follow': 'Creator activity',
      'collaboration': 'Collaboration update',
      'funding_round': 'Funding opportunity',
      'exit': 'Exit event',
      'dividend': 'Dividend distribution'
    };
    return titleMap[type] || 'Activity';
  };

  const applyFilters = () => {
    let filtered = [...activities];

    // Filter by type
    if (filters.type !== 'all') {
      const typeFilters: Record<string, string[]> = {
        investments: ['investment', 'due_diligence', 'funding_round'],
        portfolio: ['portfolio_update', 'exit', 'dividend'],
        opportunities: ['pitch_view', 'collaboration'],
        market: ['market_alert'],
        social: ['creator_follow']
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

  const markAsRead = (activityId: string) => {
    setActivities(prev => prev.map(activity =>
      activity.id === activityId ? { ...activity, isRead: true } : activity
    ));
  };

  const markAllAsRead = () => {
    setActivities(prev => prev.map(activity => ({ ...activity, isRead: true })));
  };

  const getActivityIcon = (type: string) => {
    const iconMap: Record<string, React.ElementType> = {
      investment: DollarSign,
      pitch_view: Eye,
      due_diligence: FileText,
      portfolio_update: TrendingUp,
      market_alert: Bell,
      creator_follow: User,
      collaboration: Star,
      funding_round: Building,
      exit: Award,
      dividend: DollarSign
    };
    
    return iconMap[type] || Activity;
  };

  const getActivityColor = (type: string, isImportant: boolean) => {
    if (isImportant) return 'text-red-500 bg-red-50';
    
    const colorMap: Record<string, string> = {
      investment: 'text-indigo-500 bg-indigo-50',
      pitch_view: 'text-blue-500 bg-blue-50',
      due_diligence: 'text-purple-500 bg-purple-50',
      portfolio_update: 'text-indigo-500 bg-indigo-50',
      market_alert: 'text-orange-500 bg-orange-50',
      creator_follow: 'text-violet-500 bg-violet-50',
      collaboration: 'text-pink-500 bg-pink-50',
      funding_round: 'text-blue-500 bg-blue-50',
      exit: 'text-yellow-500 bg-yellow-50',
      dividend: 'text-indigo-500 bg-indigo-50'
    };
    
    return colorMap[type] || 'text-gray-500 bg-gray-50';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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
            <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
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
              Track investment opportunities, portfolio updates, and market insights
            </p>
            {unreadCount > 0 && (
              <p className="mt-1 text-sm font-medium text-purple-600">
                {unreadCount} unread {unreadCount === 1 ? 'activity' : 'activities'}
              </p>
            )}
          </div>
          
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark All Read
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
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
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Activities</option>
                <option value="investments">Investments</option>
                <option value="portfolio">Portfolio</option>
                <option value="opportunities">Opportunities</option>
                <option value="market">Market Alerts</option>
                <option value="social">Social Updates</option>
              </select>
            </div>

            {/* Time Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Range
              </label>
              <select
                value={filters.timeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                onChange={(e) => setFilters(prev => ({ ...prev, importance: e.target.value as any }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                onChange={(e) => setFilters(prev => ({ ...prev, readStatus: e.target.value as any }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  <li key={activity.id} className={`px-6 py-4 hover:bg-gray-50 ${!activity.isRead ? 'bg-purple-50' : ''}`}>
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
                              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {formatTimestamp(activity.timestamp)}
                          </p>
                        </div>
                        
                        <p className="mt-1 text-sm text-gray-600">{activity.description}</p>
                        
                        {/* Project Info */}
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
                            {activity.project.budget && (
                              <>
                                <span className="mx-2">•</span>
                                <span>{formatCurrency(activity.project.budget)} budget</span>
                              </>
                            )}
                          </div>
                        )}
                        
                        {/* Creator Info */}
                        {activity.creator && (
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <User className="w-4 h-4 mr-1" />
                            <span className="font-medium">{activity.creator.name}</span>
                          </div>
                        )}
                        
                        {/* Investment Info */}
                        {activity.investment && (
                          <div className="mt-2 flex items-center text-sm text-gray-600 space-x-4">
                            <div className="flex items-center">
                              <DollarSign className="w-4 h-4 mr-1" />
                              <span className="font-semibold">
                                {formatCurrency(activity.investment.amount)}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">{activity.investment.stake}% stake</span>
                            </div>
                            {activity.investment.roi && (
                              <div className="flex items-center">
                                <TrendingUp className="w-4 h-4 mr-1 text-indigo-500" />
                                <span className="font-medium text-indigo-600">
                                  +{activity.investment.roi}% ROI
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Metadata */}
                        {activity.metadata && (
                          <div className="mt-2 flex items-center text-xs text-gray-500 space-x-3">
                            {activity.metadata.status && (
                              <span className="capitalize">{activity.metadata.status}</span>
                            )}
                            {activity.metadata.category && (
                              <span>{activity.metadata.category}</span>
                            )}
                            {activity.metadata.attachments && (
                              <span>{activity.metadata.attachments} attachments</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-shrink-0 flex items-center space-x-2">
                        {!activity.isRead && (
                          <button
                            onClick={() => markAsRead(activity.id)}
                            className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                          >
                            Mark Read
                          </button>
                        )}
                        <ArrowRight className="w-4 h-4 text-gray-400" />
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