import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye, Bell, TrendingUp, TrendingDown, Calendar,
  Star, User, Building, DollarSign, Clock, AlertCircle,
  Search, Filter, RefreshCw, Plus, MoreVertical,
  CheckCircle, XCircle, Target, Activity, Globe
} from 'lucide-react';
import { InvestorService } from '@features/deals/services/investor.service';

interface WatchlistItem {
  id: string;
  type: 'creator' | 'project' | 'company' | 'genre' | 'market';
  name: string;
  description: string;
  avatar?: string;
  addedDate: string;
  lastUpdate: string;
  status: 'active' | 'funded' | 'completed' | 'paused';
  alerts: {
    newPitches: boolean;
    milestones: boolean;
    funding: boolean;
    performance: boolean;
  };
  metrics?: {
    totalPitches?: number;
    successRate?: number;
    averageROI?: number;
    lastActivity?: string;
    followers?: number;
    valuation?: number;
    fundingStage?: string;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface WatchlistFilters {
  type: 'all' | 'creator' | 'project' | 'company' | 'genre' | 'market';
  status: 'all' | 'active' | 'funded' | 'completed' | 'paused';
  alerts: 'all' | 'enabled' | 'disabled';
}

export default function InvestorWatchlist() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WatchlistItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<WatchlistFilters>({
    type: 'all',
    status: 'all',
    alerts: 'all'
  });

  useEffect(() => {
    loadWatchlist();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [watchlist, filters, searchQuery]);

  const loadWatchlist = async () => {
    try {
      setError(null);

      // Fetch watchlist from API
      const apiWatchlist = await InvestorService.getWatchlist();

      // Transform API response to match component interface
      const transformedWatchlist: WatchlistItem[] = apiWatchlist.map((item: any) => ({
        id: String(item.id || item.pitchId),
        type: mapItemType(item.type || 'project'),
        name: item.pitch?.title || item.name || 'Untitled',
        description: item.pitch?.logline || item.description || item.notes || '',
        avatar: item.pitch?.thumbnailUrl || item.avatar,
        addedDate: item.addedAt || item.createdAt || new Date().toISOString(),
        lastUpdate: item.updatedAt || item.lastUpdate || new Date().toISOString(),
        status: mapStatus(item.pitch?.status || item.status || 'active'),
        alerts: {
          newPitches: item.alerts?.newPitches ?? true,
          milestones: item.alerts?.milestones ?? true,
          funding: item.alerts?.funding ?? false,
          performance: item.alerts?.performance ?? true
        },
        metrics: {
          totalPitches: item.metrics?.totalPitches,
          successRate: item.metrics?.successRate,
          averageROI: item.metrics?.averageROI,
          lastActivity: item.metrics?.lastActivity,
          followers: item.metrics?.followers,
          valuation: item.pitch?.estimatedBudget || item.metrics?.valuation,
          fundingStage: item.pitch?.productionStage || item.metrics?.fundingStage
        },
        recentActivity: item.recentActivity || [],
        trend: item.trend || 'stable',
        trendValue: item.trendValue || 0
      }));

      setWatchlist(transformedWatchlist);
    } catch (err) {
      console.error('Failed to load watchlist:', err);
      setError(err instanceof Error ? err.message : 'Failed to load watchlist');
      setWatchlist([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to map API item types to component types
  const mapItemType = (apiType: string): WatchlistItem['type'] => {
    const typeMap: Record<string, WatchlistItem['type']> = {
      'creator': 'creator',
      'user': 'creator',
      'project': 'project',
      'pitch': 'project',
      'company': 'company',
      'studio': 'company',
      'genre': 'genre',
      'market': 'market'
    };
    return typeMap[apiType.toLowerCase()] || 'project';
  };

  // Helper to map API status to component status
  const mapStatus = (apiStatus: string): WatchlistItem['status'] => {
    const statusMap: Record<string, WatchlistItem['status']> = {
      'active': 'active',
      'published': 'active',
      'draft': 'paused',
      'funded': 'funded',
      'completed': 'completed',
      'archived': 'completed',
      'paused': 'paused'
    };
    return statusMap[apiStatus.toLowerCase()] || 'active';
  };

  const applyFilters = () => {
    let filtered = [...watchlist];

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(item => item.type === filters.type);
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(item => item.status === filters.status);
    }

    // Apply alerts filter
    if (filters.alerts !== 'all') {
      filtered = filtered.filter(item => {
        const hasEnabledAlerts = Object.values(item.alerts).some(alert => alert);
        return filters.alerts === 'enabled' ? hasEnabledAlerts : !hasEnabledAlerts;
      });
    }

    setFilteredItems(filtered);
  };

  const handleToggleAlert = async (itemId: string, alertType: keyof WatchlistItem['alerts']) => {
    setWatchlist(prev => prev.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            alerts: { 
              ...item.alerts, 
              [alertType]: !item.alerts[alertType] 
            } 
          }
        : item
    ));
  };

  const handleRemoveFromWatchlist = async (itemId: string) => {
    setWatchlist(prev => prev.filter(item => item.id !== itemId));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'creator': return User;
      case 'project': return Target;
      case 'company': return Building;
      case 'genre': return Star;
      case 'market': return Globe;
      default: return Eye;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'creator': return 'bg-blue-100 text-blue-800';
      case 'project': return 'bg-purple-100 text-purple-800';
      case 'company': return 'bg-indigo-100 text-indigo-800';
      case 'genre': return 'bg-yellow-100 text-yellow-800';
      case 'market': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-indigo-100 text-indigo-800';
      case 'funded': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return TrendingUp;
      case 'down': return TrendingDown;
      default: return Activity;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-indigo-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return formatDate(timestamp);
    }
  };

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Investment Watchlist</h1>
            <p className="mt-2 text-sm text-gray-600">
              Monitor creators, projects, and market opportunities you're tracking
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <button
              onClick={() => {
                setLoading(true);
                loadWatchlist();
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add to Watchlist
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Failed to load watchlist</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
              <button
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  loadWatchlist();
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-red-300 rounded-md text-sm text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  id="watchlist-search"
                  name="watchlist-search"
                  placeholder="Search watchlist..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Types</option>
                <option value="creator">Creators</option>
                <option value="project">Projects</option>
                <option value="company">Companies</option>
                <option value="genre">Genres</option>
                <option value="market">Markets</option>
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="funded">Funded</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
              </select>

              <select
                value={filters.alerts}
                onChange={(e) => setFilters(prev => ({ ...prev, alerts: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Alerts</option>
                <option value="enabled">Alerts Enabled</option>
                <option value="disabled">Alerts Disabled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-600">
            Showing {filteredItems.length} of {watchlist.length} watchlist items
          </p>
        </div>

        {/* Watchlist Items */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No watchlist items found</h3>
            <p className="text-gray-600 mb-6">
              {watchlist.length === 0 
                ? "Start building your watchlist by adding creators, projects, and opportunities you want to track."
                : "No items match your current filters."
              }
            </p>
            <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add First Item
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredItems.map((item) => {
              const TypeIcon = getTypeIcon(item.type);
              const TrendIcon = getTrendIcon(item.trend);
              const enabledAlertsCount = Object.values(item.alerts).filter(Boolean).length;
              
              return (
                <div key={item.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getTypeColor(item.type)}`}>
                          <TypeIcon className="w-6 h-6" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                            
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(item.type)}`}>
                              {item.type}
                            </span>
                            
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                            
                            {enabledAlertsCount > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Bell className="w-3 h-3 mr-1" />
                                {enabledAlertsCount} alert{enabledAlertsCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                          
                          {/* Metrics */}
                          {item.metrics && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                              {item.metrics.totalPitches !== undefined && (
                                <div>
                                  <p className="text-xs text-gray-500">Total Pitches</p>
                                  <p className="text-sm font-medium text-gray-900">{item.metrics.totalPitches}</p>
                                </div>
                              )}
                              
                              {item.metrics.successRate !== undefined && (
                                <div>
                                  <p className="text-xs text-gray-500">Success Rate</p>
                                  <p className="text-sm font-medium text-gray-900">{item.metrics.successRate}%</p>
                                </div>
                              )}
                              
                              {item.metrics.averageROI !== undefined && (
                                <div>
                                  <p className="text-xs text-gray-500">Average ROI</p>
                                  <p className="text-sm font-medium text-indigo-600">{item.metrics.averageROI}%</p>
                                </div>
                              )}
                              
                              {item.metrics.valuation !== undefined && (
                                <div>
                                  <p className="text-xs text-gray-500">Valuation</p>
                                  <p className="text-sm font-medium text-gray-900">{formatCurrency(item.metrics.valuation)}</p>
                                </div>
                              )}
                              
                              {item.metrics.followers !== undefined && (
                                <div>
                                  <p className="text-xs text-gray-500">Followers</p>
                                  <p className="text-sm font-medium text-gray-900">{item.metrics.followers.toLocaleString()}</p>
                                </div>
                              )}
                              
                              {item.metrics.fundingStage !== undefined && (
                                <div>
                                  <p className="text-xs text-gray-500">Stage</p>
                                  <p className="text-sm font-medium text-gray-900">{item.metrics.fundingStage}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {/* Trend Indicator */}
                        <div className={`flex items-center gap-1 ${getTrendColor(item.trend)}`}>
                          <TrendIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {item.trend === 'down' ? '' : '+'}{item.trendValue}%
                          </span>
                        </div>
                        
                        <div className="relative">
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Activity</h4>
                      <div className="space-y-2">
                        {item.recentActivity.slice(0, 2).map((activity, index) => (
                          <div key={index} className="flex items-start gap-3 text-sm">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                            <div className="flex-1">
                              <p className="text-gray-700">{activity.description}</p>
                              <p className="text-gray-500 text-xs">{formatTimestamp(activity.timestamp)}</p>
                            </div>
                          </div>
                        ))}
                        {item.recentActivity.length > 2 && (
                          <button className="text-sm text-indigo-600 hover:text-purple-700">
                            View all {item.recentActivity.length} activities
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Alert Settings */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Alert Settings</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {Object.entries(item.alerts).map(([alertType, enabled]) => (
                          <label key={alertType} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              id={`alert-${item.id}-${alertType}`}
                              name={`alert-${item.id}-${alertType}`}
                              checked={enabled}
                              onChange={() => handleToggleAlert(item.id, alertType as keyof WatchlistItem['alerts'])}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-xs text-gray-600 capitalize">
                              {alertType.replace(/([A-Z])/g, ' $1').toLowerCase()}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Metadata and Actions */}
                    <div className="flex items-center justify-between pt-4 border-t text-xs text-gray-500">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Added {formatDate(item.addedDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Updated {formatTimestamp(item.lastUpdate)}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/${item.type}/${item.id}`)}
                          className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => handleRemoveFromWatchlist(item.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}