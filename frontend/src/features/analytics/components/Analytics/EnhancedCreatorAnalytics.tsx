import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Eye,
  Heart,
  Share2,
  Users,
  DollarSign,
  Film,
  MessageSquare,
  RefreshCw
} from 'lucide-react';

import { AnalyticCard } from './AnalyticCard';
import { TimeRangeFilter } from './TimeRangeFilter';
import { AnalyticsExport } from './AnalyticsExport';
import { analyticsService } from '../../services/analytics.service';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { 
  LineChart, 
  BarChart, 
  PieChart, 
  ChartContainer,
  MultiLineChart,
  AreaChart
} from './AnalyticsCharts';

interface CreatorAnalyticsProps {
  pitchPerformance?: {
    totalViews: number;
    viewsChange: number;
    totalLikes: number;
    likesChange: number;
    totalShares: number;
    sharesChange: number;
    potentialInvestment: number;
    investmentChange: number;
  };
  // When true, skip remote analytics API calls and use mock/fallback data only
  disableRemoteFetch?: boolean;
}

interface CreatorAnalyticsData {
  kpis: {
    totalPitches: number;
    totalViews: number;
    totalLikes: number;
    totalShares: number;
    engagementRate: number;
    fundingReceived: number;
    averageRating: number;
    responseRate: number;
    totalFollowers: number;
    ndaRequests: number;
  };
  changes: {
    pitchesChange: number;
    viewsChange: number;
    likesChange: number;
    sharesChange: number;
    engagementChange: number;
    fundingChange: number;
    ratingChange: number;
    responseChange: number;
    followersChange: number;
    ndaChange: number;
  };
  charts: {
    pitchViews: { date: string; value: number }[];
    engagementTrends: { date: string; value: number }[];
    fundingProgress: { date: string; value: number }[];
    categoryPerformance: { category: string; views: number; funding: number; pitches: number }[];
    viewerDemographics: { type: string; count: number }[];
    topPitches: { title: string; views: number; engagement: number; funding: number }[];
    monthlyMetrics: { month: string; pitches: number; views: number; funding: number }[];
  };
}

export const EnhancedCreatorAnalytics: React.FC<CreatorAnalyticsProps> = ({
  pitchPerformance: _pitchPerformance,
  disableRemoteFetch = false,
}) => {
  const { user } = useBetterAuthStore();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [analyticsData, setAnalyticsData] = useState<CreatorAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Map time range to preset
      const preset = timeRange === '7d' ? 'week' :
                     timeRange === '30d' ? 'month' :
                     timeRange === '90d' ? 'quarter' : 'year';

      // If user is not loaded yet, show empty state
      if (!user?.id) {
        setAnalyticsData(null);
        setLoading(false);
        return;
      }

      const now = new Date();
      const rangeStart = new Date(now);
      if (preset === 'week') rangeStart.setDate(now.getDate() - 7);
      else if (preset === 'month') rangeStart.setMonth(now.getMonth() - 1);
      else if (preset === 'quarter') rangeStart.setMonth(now.getMonth() - 3);
      else rangeStart.setFullYear(now.getFullYear() - 1);

      const timeRangeArg = {
        start: rangeStart.toISOString(),
        end: now.toISOString(),
        preset: preset as 'week' | 'month' | 'quarter' | 'year',
      };

      const [dashboardMetrics, userAnalytics] = await Promise.all([
        analyticsService.getDashboardMetrics(timeRangeArg),
        analyticsService.getUserAnalytics(user.id, timeRangeArg)
      ]);

      // Transform the data with null safety checks
      const overview = dashboardMetrics?.overview || {
        totalPitches: 0,
        totalViews: 0,
        totalLikes: 0,
        totalFollowers: 0,
        pitchesChange: 0,
        viewsChange: 0,
        likesChange: 0,
        followersChange: 0
      };

      const performance = dashboardMetrics?.performance || {
        engagementTrend: []
      };

      const transformedData: CreatorAnalyticsData = {
        kpis: {
          totalPitches: overview.totalPitches || 0,
          totalViews: overview.totalViews || 0,
          totalLikes: overview.totalLikes || 0,
          totalShares: 0,
          engagementRate: performance.engagementTrend?.length ?
            performance.engagementTrend.reduce((acc, curr) => acc + (curr?.rate || 0), 0) / performance.engagementTrend.length : 0,
          fundingReceived: dashboardMetrics?.revenue?.total || 0,
          averageRating: 0,
          responseRate: 0,
          totalFollowers: overview.totalFollowers || 0,
          ndaRequests: userAnalytics?.totalNDAs || 0,
        },
        changes: {
          pitchesChange: overview.pitchesChange || 0,
          viewsChange: overview.viewsChange || 0,
          likesChange: overview.likesChange || 0,
          sharesChange: 0,
          engagementChange: 0,
          fundingChange: dashboardMetrics?.revenue?.growth || 0,
          ratingChange: 0,
          responseChange: 0,
          followersChange: overview.followersChange || 0,
          ndaChange: 0,
        },
        charts: {
          pitchViews: (performance.engagementTrend && performance.engagementTrend.length > 0)
            ? performance.engagementTrend.map((item) => ({
                date: item.date,
                value: item.rate
              }))
            : [],
          engagementTrends: (performance.engagementTrend && performance.engagementTrend.length > 0)
            ? performance.engagementTrend.map((item) => ({
                date: item.date,
                value: item.rate
              }))
            : [],
          fundingProgress: (() => {
            const investLabels = dashboardMetrics?.trends?.investmentsOverTime?.labels || [];
            const investData = dashboardMetrics?.trends?.investmentsOverTime?.datasets?.[0]?.data || [];
            const points = investLabels.map((label: string, i: number) => ({
              date: label,
              value: investData[i] || 0
            }));
            // If no funding data, show zero baseline using view timeline dates
            if (points.length === 0 || points.every((p: any) => p.value === 0)) {
              const fallbackLabels = dashboardMetrics?.trends?.viewsOverTime?.labels || dashboardMetrics?.trends?.pitchesOverTime?.labels || [];
              if (fallbackLabels.length > 0) {
                return fallbackLabels.map((label: string) => ({ date: label, value: 0 }));
              }
              // Last resort: show today with 0
              return [{ date: new Date().toISOString().split('T')[0], value: 0 }];
            }
            // Build cumulative sum
            let cumulative = 0;
            return points.map((p: any) => ({ date: p.date, value: (cumulative += p.value) }));
          })(),
          categoryPerformance: (dashboardMetrics?.demographics?.pitchesByGenre?.labels || []).map((label: string, i: number) => ({
            category: label,
            views: dashboardMetrics?.demographics?.pitchesByGenre?.datasets?.[0]?.data?.[i] || 0,
            funding: 0,
            pitches: 1
          })),
          viewerDemographics: (dashboardMetrics?.demographics?.viewerTypes || []).map((v: any) => ({
            type: v.category || v.type || 'Unknown',
            count: v.value || v.count || 0
          })),
          topPitches: (userAnalytics?.topPitches && userAnalytics.topPitches.length > 0)
            ? userAnalytics.topPitches.map(pitch => ({
                title: pitch.title,
                views: pitch.views,
                engagement: pitch.engagement,
                funding: 0
              }))
            : [],
          monthlyMetrics: (dashboardMetrics?.trends?.pitchesOverTime?.labels || []).map((label: string, i: number) => ({
            month: label,
            pitches: dashboardMetrics?.trends?.pitchesOverTime?.datasets?.[0]?.data?.[i] || 0,
            views: dashboardMetrics?.trends?.viewsOverTime?.datasets?.[0]?.data?.[i] || 0,
            funding: 0
          })).filter((d: any) => d.pitches > 0 || d.views > 0)
        }
      };

      setAnalyticsData(transformedData);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Error fetching analytics data:', e);
      setError(e.message);
      setAnalyticsData(null);
    } finally {
      setLoading(false);
    }
  }, [timeRange, user?.id]);

  useEffect(() => {
    if (disableRemoteFetch) {
      // Skip remote fetch — show null (empty state)
      setAnalyticsData(null);
      setLoading(false);
      return;
    }

    void fetchAnalyticsData();

    // Set up auto-refresh every 5 minutes if enabled
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoRefresh && !disableRemoteFetch) {
      interval = setInterval(() => { void fetchAnalyticsData(); }, 5 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeRange, autoRefresh, disableRemoteFetch, fetchAnalyticsData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p className="mb-2">{error ? `Error: ${error}` : 'No analytics data available yet.'}</p>
        {!disableRemoteFetch && (
          <button
            onClick={() => { void fetchAnalyticsData(); }}
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Creator Analytics Dashboard</h2>
            <p className="text-gray-600">Track your pitch performance and audience engagement</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                autoRefresh 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              <span>Auto Refresh</span>
            </button>
            
            <TimeRangeFilter 
              value={timeRange}
              onChange={(range) => setTimeRange(range)}
              defaultRange="30d"
            />
            
            <AnalyticsExport
              data={[analyticsData] as unknown as Record<string, unknown>[]}
              title="Creator Analytics"
            />
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AnalyticCard 
          title="Total Pitches"
          value={analyticsData.kpis.totalPitches}
          change={analyticsData.changes.pitchesChange}
          icon={<Film className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="Total Views"
          value={analyticsData.kpis.totalViews}
          change={analyticsData.changes.viewsChange}
          icon={<Eye className="w-5 h-5 text-green-500" />}
          variant="success"
        />
        <AnalyticCard 
          title="Engagement Rate"
          value={analyticsData.kpis.engagementRate.toFixed(1)}
          change={analyticsData.changes.engagementChange}
          icon={<Heart className="w-5 h-5 text-red-500" />}
          variant="danger"
          format="percentage"
        />
        <AnalyticCard 
          title="Funding Received"
          value={analyticsData.kpis.fundingReceived}
          change={analyticsData.changes.fundingChange}
          icon={<DollarSign className="w-5 h-5 text-purple-500" />}
          variant="primary"
          format="currency"
        />
        <AnalyticCard 
          title="Followers"
          value={analyticsData.kpis.totalFollowers}
          change={analyticsData.changes.followersChange}
          icon={<Users className="w-5 h-5 text-indigo-500" />}
          variant="secondary"
        />
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AnalyticCard 
          title="Total Likes"
          value={analyticsData.kpis.totalLikes}
          change={analyticsData.changes.likesChange}
          icon={<Heart className="w-5 h-5 text-pink-500" />}
          variant="danger"
        />
        <AnalyticCard 
          title="Shares"
          value={analyticsData.kpis.totalShares}
          change={analyticsData.changes.sharesChange}
          icon={<Share2 className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="NDA Requests"
          value={analyticsData.kpis.ndaRequests}
          change={analyticsData.changes.ndaChange}
          icon={<MessageSquare className="w-5 h-5 text-orange-500" />}
          variant="warning"
        />
        <AnalyticCard 
          title="Average Rating"
          value={analyticsData.kpis.averageRating.toFixed(1)}
          change={analyticsData.changes.ratingChange}
          icon={<TrendingUp className="w-5 h-5 text-yellow-500" />}
          variant="warning"
        />
        <AnalyticCard 
          title="Response Rate"
          value={analyticsData.kpis.responseRate}
          change={analyticsData.changes.responseChange}
          icon={<MessageSquare className="w-5 h-5 text-teal-500" />}
          variant="success"
          format="percentage"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pitch Views Over Time */}
        <ChartContainer title="Pitch Views Over Time">
          <LineChart
            data={analyticsData.charts.pitchViews}
            title="Views"
            color="#3B82F6"
            height={300}
          />
        </ChartContainer>

        {/* Engagement Trends */}
        <ChartContainer title="Engagement Rate Trends">
          <AreaChart
            data={analyticsData.charts.engagementTrends}
            title="Engagement Rate (%)"
            color="#10B981"
            height={300}
          />
        </ChartContainer>

        {/* Category Performance */}
        <ChartContainer title="Performance by Category">
          <BarChart
            data={analyticsData.charts.categoryPerformance.map(item => ({
              category: item.category,
              value: item.views
            }))}
            title="Views by Category"
            height={300}
          />
        </ChartContainer>

        {/* Viewer Demographics */}
        <ChartContainer title="Audience Demographics">
          <PieChart
            data={analyticsData.charts.viewerDemographics.map(item => ({
              category: item.type,
              value: item.count
            }))}
            title="Viewer Types"
            type="doughnut"
            height={300}
          />
        </ChartContainer>

        {/* Funding Progress */}
        <ChartContainer title="Cumulative Funding Progress">
          <AreaChart
            data={analyticsData.charts.fundingProgress}
            title="Funding ($)"
            color="#F59E0B"
            height={300}
          />
        </ChartContainer>

        {/* Monthly Overview */}
        <ChartContainer title="Monthly Performance Overview">
          <MultiLineChart
            datasets={[
              {
                label: 'Pitches',
                data: analyticsData.charts.monthlyMetrics.map(item => ({
                  date: item.month,
                  value: item.pitches
                })),
                color: '#3B82F6'
              },
              {
                label: 'Views',
                data: analyticsData.charts.monthlyMetrics.map(item => ({
                  date: item.month,
                  value: item.views
                })),
                color: '#10B981'
              }
            ]}
            height={300}
          />
        </ChartContainer>
      </div>

      {/* Top Performing Pitches */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Top Performing Pitches</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyticsData.charts.topPitches.slice(0, 6).map((pitch, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-gray-900 truncate flex-1">{pitch.title}</h4>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-2">
                  #{index + 1}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">Views</p>
                  <p className="font-semibold">{pitch.views.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Engagement</p>
                  <p className="font-semibold">{(pitch.engagement * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Funding</p>
                  <p className="font-semibold">${(pitch.funding / 1000).toFixed(0)}k</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnhancedCreatorAnalytics;