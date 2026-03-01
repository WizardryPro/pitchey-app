import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Eye, Heart, MessageSquare, Download, Calendar, Users, BarChart3 } from 'lucide-react';
import { API_URL } from '../config';
import { AnalyticsService } from '../services/analytics.service';

interface AnalyticsData {
  overview: {
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalDownloads: number;
    viewsThisMonth: number;
    likesThisMonth: number;
  };
  pitchPerformance: Array<{
    id: number;
    title: string;
    views: number;
    likes: number;
    comments: number;
    conversionRate: number;
  }>;
  viewsOverTime: Array<{
    date: string;
    views: number;
    likes: number;
  }>;
  audienceInsights: {
    topGenres: Array<{ genre: string; percentage: number }>;
    userTypes: Array<{ type: string; count: number }>;
    topRegions: Array<{ region: string; count: number }>;
  };
}

export default function Analytics() {
  const navigate = useNavigate();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    // Check for auth token
    const token = localStorage.getItem('authToken');
    if (!token) {
      // For debugging - auto-login if no token
      quickLogin();
    } else {
      fetchAnalytics();
    }
  }, [timeRange]);

  const quickLogin = async () => {
    try {
    const response = await fetch(`${API_URL}/api/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include' // Send cookies for Better Auth session
      });
      
      const data = await response.json();
      if (data.success && data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        fetchAnalytics();
      }
    } catch (err) {
      console.error('Auto-login failed:', err);
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      // Map timeRange to preset values used by the API
      const presetMap: Record<string, string> = {
        '7d': 'week',
        '30d': 'month',
        '90d': 'quarter',
        '1y': 'year'
      };
      const preset = presetMap[timeRange] || 'month';
      
      // Fetch both dashboard and user analytics
      const [dashboardResponse, userResponse] = await Promise.all([
        fetch(`${API_URL}/api/analytics/dashboard?preset=${preset}`, {
          credentials: 'include' // Send cookies for Better Auth session
        }),
        fetch(`${API_URL}/api/analytics/user?preset=${preset}`, {
          credentials: 'include'
        })
      ]);
      
      if (dashboardResponse.ok && userResponse.ok) {
        const [dashboardResult, userResult] = await Promise.all([
          dashboardResponse.json(),
          userResponse.json()
        ]);
        
        
        // Combine the data from both endpoints
        const combinedData: AnalyticsData = {
          overview: dashboardResult.data?.overview || dashboardResult.overview || {},
          pitchPerformance: dashboardResult.data?.pitchPerformance || dashboardResult.pitchPerformance || [],
          viewsOverTime: [],
          audienceInsights: userResult.data?.audienceInsights || userResult.audienceInsights || {}
        };

        setAnalyticsData(combinedData);
      } else {
        console.error('Analytics request failed:', dashboardResponse.status, userResponse.status);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getChangeIndicator = (current: number, previous: number) => {
    if (previous === 0) return { change: 0, trend: 'neutral' };
    const change = ((current - previous) / previous) * 100;
    return {
      change: Math.abs(change),
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Show empty state if no analytics data
  if (!analyticsData || !analyticsData.overview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate(-1)} 
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No analytics data available yet</p>
            <p className="text-sm text-gray-400 mt-2">Start creating pitches to see your analytics</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/creator/dashboard')}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
                <p className="text-sm text-gray-500">Track your pitch performance and audience insights</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 3 months</option>
                <option value="1y">Last year</option>
              </select>
              
              <button
                onClick={async () => {
                  try {
                    const blob = await AnalyticsService.exportAnalytics({ format: 'csv', dateRange: { start: '', end: '' }, metrics: ['views', 'likes', 'comments'] });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `analytics-report-${timeRange}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    const e = err instanceof Error ? err : new Error(String(err));
                    console.error('Export failed:', e);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {analyticsData ? (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 text-sm">Total Views</span>
                  <Eye className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(analyticsData.overview.totalViews)}</p>
                <p className="text-xs text-green-500 mt-1">+{analyticsData.overview.viewsThisMonth} this month</p>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 text-sm">Total Likes</span>
                  <Heart className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(analyticsData.overview.totalLikes)}</p>
                <p className="text-xs text-green-500 mt-1">+{analyticsData.overview.likesThisMonth} this month</p>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 text-sm">Comments</span>
                  <MessageSquare className="w-5 h-5 text-yellow-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(analyticsData.overview.totalComments)}</p>
                <p className="text-xs text-gray-500 mt-1">All time</p>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 text-sm">Downloads</span>
                  <Download className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(analyticsData.overview.totalDownloads)}</p>
                <p className="text-xs text-gray-500 mt-1">PDFs & Videos</p>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Performance Over Time</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Views</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Likes</span>
                  </div>
                </div>
              </div>
              
              {/* Interactive chart with numbers */}
              <div className="h-64 flex items-end justify-between gap-2">
                {(analyticsData.viewsOverTime || []).slice(-15).map((data, index) => {
                  const maxViews = Math.max(...(analyticsData.viewsOverTime || []).map(d => d.views || 0));
                  const maxLikes = Math.max(...(analyticsData.viewsOverTime || []).map(d => d.likes || 0));
                  const viewHeight = Math.max(10, (data.views / maxViews) * 180);
                  const likeHeight = Math.max(5, (data.likes / maxLikes) * 90);
                  
                  return (
                    <div key={index} className="flex flex-col items-center gap-1 flex-1 group relative">
                      <div className="w-full bg-gray-100 rounded-t relative" style={{ height: '200px' }}>
                        <div 
                          className="bg-blue-500 rounded-t absolute bottom-0 w-full hover:bg-blue-600 transition-colors cursor-pointer"
                          style={{ height: `${viewHeight}px` }}
                          title={`${data.views} views`}
                        ></div>
                        <div 
                          className="bg-red-500 rounded-t absolute bottom-0 w-1/2 hover:bg-red-600 transition-colors cursor-pointer"
                          style={{ height: `${likeHeight}px` }}
                          title={`${data.likes} likes`}
                        ></div>
                        
                        {/* Tooltip on hover */}
                        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                          <div className="text-blue-300">Views: {data.views}</div>
                          <div className="text-red-300">Likes: {data.likes}</div>
                        </div>
                        
                        {/* Always visible numbers for larger values */}
                        {data.views > maxViews * 0.3 && (
                          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-white text-xs font-semibold">
                            {data.views}
                          </div>
                        )}
                        {data.likes > maxLikes * 0.3 && (
                          <div className="absolute bottom-2 left-1/4 transform -translate-x-1/2 text-white text-xs font-semibold">
                            {data.likes}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 rotate-45 origin-left">
                        {new Date(data.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {/* Period Summary */}
              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  {timeRange === '7d' ? 'Last 7 Days' : 
                   timeRange === '30d' ? 'Last 30 Days' : 
                   timeRange === '90d' ? 'Last 3 Months' : 'Last Year'} Summary
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {(analyticsData.viewsOverTime || []).reduce((sum, day) => sum + (day.views || 0), 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">Total Views</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {(analyticsData.viewsOverTime || []).reduce((sum, day) => sum + (day.likes || 0), 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">Total Likes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round((analyticsData.viewsOverTime || []).reduce((sum, day) => sum + (day.views || 0), 0) / ((analyticsData.viewsOverTime || []).length || 1))}
                    </div>
                    <div className="text-xs text-gray-500">Avg Views/Day</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {(((analyticsData.viewsOverTime || []).reduce((sum, day) => sum + (day.likes || 0), 0) / 
                         Math.max(1, (analyticsData.viewsOverTime || []).reduce((sum, day) => sum + (day.views || 0), 0))) * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">Like Rate</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Performing Pitches */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Top Performing Pitches</h2>
                <div className="space-y-4">
                  {(analyticsData.pitchPerformance || []).slice(0, 5).map((pitch, index) => (
                    <div key={pitch.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{pitch.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Eye className="w-4 h-4" />
                              {formatNumber(pitch.views)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className="w-4 h-4" />
                              {formatNumber(pitch.likes)}
                            </div>
                            <span>{pitch.conversionRate}% conversion</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/creator/pitches/${pitch.id}/analytics`)}
                        className="text-purple-600 hover:text-purple-700"
                      >
                        <BarChart3 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audience Insights */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Audience Insights</h2>
                
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-3">Top Genres</h3>
                  <div className="space-y-2">
                    {(analyticsData.audienceInsights?.topGenres || []).slice(0, 5).map((genre, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{genre.genre}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full">
                            <div 
                              className="h-2 bg-purple-500 rounded-full"
                              style={{ width: `${genre.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-500 w-8">{genre.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-3">User Types</h3>
                  <div className="space-y-2">
                    {(analyticsData.audienceInsights?.userTypes || []).map((userType, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 capitalize">{userType.type}</span>
                        <span className="text-sm font-medium text-gray-900">{userType.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Top Regions</h3>
                  <div className="space-y-2">
                    {(analyticsData.audienceInsights?.topRegions || []).slice(0, 5).map((region, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{region.region}</span>
                        <span className="text-sm font-medium text-gray-900">{region.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
            <p className="text-gray-500 mb-4">
              Start by publishing some pitches to see your analytics data here.
            </p>
            <button
              onClick={() => navigate('/creator/pitch/new')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Create Your First Pitch
            </button>
          </div>
        )}
      </div>
    </div>
  );
}