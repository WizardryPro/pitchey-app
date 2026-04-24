import React, { useState, useEffect } from 'react';
import {
  BarChart3, Activity, TrendingUp, Film, Target, AlertCircle, RefreshCw
} from 'lucide-react';
import { CreatorAnalytics } from '@features/analytics/components/Analytics/CreatorAnalytics';
import CreatorActivity from '@portals/creator/pages/CreatorActivity';
import CreatorStats from '@portals/creator/pages/CreatorStats';
import { CreatorService } from '@features/analytics/services/creator.service';
import { AnalyticsService } from '@features/analytics/services/analytics.service';

type TimeRange = '7d' | '30d' | '90d' | '1y';

const RANGE_TO_DAYS: Record<TimeRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365
};

export default function CreatorAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'stats'>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pitchPerformance, setPitchPerformance] = useState({
    totalViews: 0,
    viewsChange: 0,
    totalLikes: 0,
    likesChange: 0,
    potentialInvestment: 0,
    investmentChange: 0
  });
  const [followers, setFollowers] = useState(0);
  const [followersChange, setFollowersChange] = useState(0);
  const [trends, setTrends] = useState<any>(null);
  const [topPitches, setTopPitches] = useState<{ id: number; title: string; views: number; likes: number }[]>([]);
  const [audienceBreakdown, setAudienceBreakdown] = useState<{ userType: string; count: number; percentage: number }[]>([]);

  const loadAnalytics = async (range: TimeRange, isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const days = RANGE_TO_DAYS[range];
      const [dashboardMetrics, creatorAnalytics] = await Promise.all([
        AnalyticsService.getDashboardMetrics(undefined, { days }).catch(() => null),
        CreatorService.getAnalytics().catch(() => null)
      ]);

      // Map dashboard metrics to pitchPerformance format
      if (dashboardMetrics) {
        setPitchPerformance({
          totalViews: dashboardMetrics.overview.totalViews,
          viewsChange: dashboardMetrics.overview.viewsChange,
          totalLikes: dashboardMetrics.overview.totalLikes,
          likesChange: dashboardMetrics.overview.likesChange,
          potentialInvestment: dashboardMetrics.revenue?.total || 0,
          investmentChange: dashboardMetrics.revenue?.growth || 0
        });
        setFollowers(dashboardMetrics.overview.totalFollowers || 0);
        setFollowersChange(dashboardMetrics.overview.followersChange || 0);
        setTrends((dashboardMetrics as any).trends || null);
      }

      // Map creator analytics to top pitches & audience breakdown
      if (creatorAnalytics) {
        setTopPitches(creatorAnalytics.topPitches || []);
        setAudienceBreakdown(creatorAnalytics.audienceBreakdown || []);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load analytics:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAnalytics(timeRange, loading);
  }, [timeRange]);

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'stats', label: 'Quick Stats', icon: TrendingUp }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Failed to load analytics</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => void loadAnalytics(timeRange, true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 rounded-md text-sm text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Insights</h1>
        <p className="text-gray-600 mt-1">Track your pitch performance and audience engagement</p>
      </div>

      <div>
        {/* Tab Navigation — horizontally scrollable on mobile */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6 sm:space-x-8 px-4 sm:px-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'overview' | 'activity' | 'stats')}
                    className={`
                      flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap shrink-0
                      ${activeTab === tab.id
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-200 ease-in-out">
          {activeTab === 'overview' && (
            <div className={`space-y-6 transition-opacity duration-200 ${refreshing ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* Main Analytics Component */}
              <CreatorAnalytics
                pitchPerformance={pitchPerformance}
                followers={followers}
                followersChange={followersChange}
                trends={trends}
                timeRange={timeRange}
                onTimeRangeChange={handleTimeRangeChange}
              />

              {/* Additional Overview Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Performing Pitches */}
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Film className="w-5 h-5 text-purple-600" />
                    Top Performing Pitches
                  </h3>
                  <div className="space-y-3">
                    {topPitches.length > 0 ? topPitches.slice(0, 3).map((pitch, i) => (
                      <div key={pitch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-bold text-purple-600">#{i + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium">{pitch.title}</p>
                            <p className="text-sm text-gray-500">{pitch.views.toLocaleString()} views</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-purple-600">{pitch.likes} likes</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-gray-500 text-sm text-center py-4">No pitch data available yet</p>
                    )}
                  </div>
                </div>

                {/* Audience Insights */}
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    Audience Insights
                  </h3>
                  <div className="space-y-4">
                    {audienceBreakdown.length > 0 ? audienceBreakdown.map((segment) => {
                      const colors: Record<string, string> = {
                        investor: 'bg-purple-600',
                        production: 'bg-indigo-600',
                      };
                      return (
                        <div key={segment.userType}>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm text-gray-600 capitalize">{segment.userType}s</span>
                            <span className="text-sm font-semibold">{segment.percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className={`${colors[segment.userType] || 'bg-blue-600'} h-2 rounded-full`} style={{ width: `${segment.percentage}%` }}></div>
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="text-gray-500 text-sm text-center py-4">No audience data available yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <CreatorActivity />
          )}

          {activeTab === 'stats' && (
            <CreatorStats />
          )}
        </div>
      </div>
    </div>
  );
}