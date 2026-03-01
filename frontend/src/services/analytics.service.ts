// Analytics Service - Complete analytics and reporting
import { apiClient } from '../lib/api-client';
import {
  safeAccess,
  safeNumber,
  safeString,
  safeArray,
  safeExecute,
  isValidDate,
  safeTimestamp
} from '@shared/utils/defensive';

const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:8001' : '');

// Types for analytics data
export interface TimeRange {
  start: string;
  end: string;
  preset?: 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'all';
}

export interface PitchAnalytics {
  pitchId: number;
  title: string;
  views: number;
  uniqueViews: number;
  likes: number;
  shares: number;
  ndaRequests: number;
  ndaApproved: number;
  messages: number;
  avgViewDuration: number;
  bounceRate: number;
  conversionRate: number;
  engagementRate: number;
  viewsByDate: { date: string; count: number }[];
  viewsBySource: { source: string; count: number }[];
  viewsByLocation: { location: string; count: number }[];
  viewerDemographics: {
    userType: { type: string; count: number }[];
    industry: { industry: string; count: number }[];
  };
  // Aggregate fields used by PitchAnalytics page
  totalViews?: number;
  totalLikes?: number;
  totalShares?: number;
  totalMessages?: number;
  viewsThisWeek?: number;
  viewsThisMonth?: number;
  engagement?: any;
  demographics?: any;
  viewerTypes?: any;
  topReferrers?: any[];
}

export interface UserAnalytics {
  userId: number;
  username: string;
  totalPitches: number;
  publishedPitches: number;
  totalViews: number;
  totalLikes: number;
  totalFollowers: number;
  totalNDAs: number;
  avgEngagement: number;
  topPitches: {
    id: number;
    title: string;
    views: number;
    engagement: number;
  }[];
  growthMetrics: {
    date: string;
    followers: number;
    views: number;
    engagement: number;
  }[];
  audienceInsights: {
    topLocations: { location: string; percentage: number }[];
    topUserTypes: { type: string; percentage: number }[];
    peakActivity: { hour: number; activity: number }[];
  };
}

export interface DashboardMetrics {
  overview: {
    totalViews: number;
    totalLikes: number;
    totalFollowers: number;
    totalPitches: number;
    viewsChange: number;
    likesChange: number;
    followersChange: number;
    pitchesChange: number;
  };
  performance: {
    topPitches: PitchAnalytics[];
    recentActivity: Activity[];
    engagementTrend: { date: string; rate: number }[];
  };
  revenue?: {
    total: number;
    subscriptions: number;
    transactions: number;
    growth: number;
  };
}

export interface Activity {
  id: number;
  type: 'view' | 'like' | 'follow' | 'nda' | 'message' | 'share';
  entityType: 'pitch' | 'user';
  entityId: number;
  entityName: string;
  userId?: number;
  username?: string;
  timestamp: string;
  metadata?: any;
}

export interface ExportOptions {
  format: 'csv' | 'pdf' | 'excel';
  dateRange: TimeRange;
  metrics: string[];
  groupBy?: 'day' | 'week' | 'month';
  includeCharts?: boolean;
}

export interface ComparisonData {
  current: any;
  previous: any;
  change: number;
  changePercentage: number;
}

export class AnalyticsService {
  // Default fallback data to prevent infinite polling loops
  private static getDefaultPitchAnalytics(pitchId: number): PitchAnalytics {
    return {
      pitchId,
      title: '',
      views: 0,
      uniqueViews: 0,
      likes: 0,
      shares: 0,
      ndaRequests: 0,
      ndaApproved: 0,
      messages: 0,
      avgViewDuration: 0,
      bounceRate: 0,
      conversionRate: 0,
      engagementRate: 0,
      viewsByDate: [],
      viewsBySource: [],
      viewsByLocation: [],
      viewerDemographics: {
        userType: [],
        industry: [],
      }
    };
  }

  private static getDefaultUserAnalytics(userId: number): UserAnalytics {
    return {
      userId,
      username: '',
      totalPitches: 0,
      publishedPitches: 0,
      totalViews: 0,
      totalLikes: 0,
      totalFollowers: 0,
      totalNDAs: 0,
      avgEngagement: 0,
      topPitches: [],
      growthMetrics: [],
      audienceInsights: {
        topLocations: [],
        topUserTypes: [],
        peakActivity: [],
      }
    };
  }

  private static getDefaultDashboardMetrics(): DashboardMetrics {
    return {
      overview: {
        totalViews: 0,
        totalLikes: 0,
        totalFollowers: 0,
        totalPitches: 0,
        viewsChange: 0,
        likesChange: 0,
        followersChange: 0,
        pitchesChange: 0,
      },
      performance: {
        topPitches: [],
        recentActivity: [],
        engagementTrend: [],
      },
      revenue: {
        total: 0,
        subscriptions: 0,
        transactions: 0,
        growth: 0,
      }
    };
  }
  // Get pitch analytics
  static async getPitchAnalytics(
    pitchId: number, 
    timeRange?: TimeRange
  ): Promise<PitchAnalytics> {
    try {
      const params = new URLSearchParams();
      if (timeRange?.start) params.append('start', timeRange.start);
      if (timeRange?.end) params.append('end', timeRange.end);
      if (timeRange?.preset) params.append('preset', timeRange.preset);

      const response = await apiClient.get<{ analytics: any }>(
        `/api/analytics/pitch/${pitchId}?${params}`
      );

      // api-client already unwraps { success, data } to just return data
      if (!response.success || !response.data?.analytics) {
        console.warn('Pitch analytics not available:', response.error?.message);
        return this.getDefaultPitchAnalytics(pitchId);
      }

      // Transform the API response with defensive parsing
      const apiAnalytics = safeAccess(response, 'data.analytics', {});
      return {
        pitchId,
        title: safeString(safeAccess(apiAnalytics, 'title', 'Untitled Pitch')),
        views: safeNumber(safeAccess(apiAnalytics, 'views', 0)),
        uniqueViews: safeNumber(safeAccess(apiAnalytics, 'uniqueViews', 0)),
        likes: safeNumber(safeAccess(apiAnalytics, 'likes', 0)),
        shares: safeNumber(safeAccess(apiAnalytics, 'shares', 0)),
        ndaRequests: safeNumber(safeAccess(apiAnalytics, 'ndaRequests', 0)),
        ndaApproved: safeNumber(safeAccess(apiAnalytics, 'ndaApproved', 0)),
        messages: safeNumber(safeAccess(apiAnalytics, 'messages', 0)),
        avgViewDuration: safeNumber(safeAccess(apiAnalytics, 'avgViewDuration', 0)),
        bounceRate: safeNumber(safeAccess(apiAnalytics, 'bounceRate', 0)),
        conversionRate: safeNumber(safeAccess(apiAnalytics, 'conversionRate', 0)),
        engagementRate: safeNumber(safeAccess(apiAnalytics, 'engagementRate', 0)),
        viewsByDate: safeArray(safeAccess(apiAnalytics, 'viewsByDate', [])),
        viewsBySource: safeArray(safeAccess(apiAnalytics, 'viewsBySource', [])),
        viewsByLocation: safeArray(safeAccess(apiAnalytics, 'viewsByLocation', [])),
        viewerDemographics: {
          userType: safeArray(safeAccess(apiAnalytics, 'viewerDemographics.userType', [])),
          industry: safeArray(safeAccess(apiAnalytics, 'viewerDemographics.industry', [])),
        }
      };
    } catch (error) {
      console.error('Failed to fetch pitch analytics:', error);
      return this.getDefaultPitchAnalytics(pitchId);
    }
  }

  // Get user analytics
  static async getUserAnalytics(
    userId?: number,
    timeRange?: TimeRange
  ): Promise<UserAnalytics> {
    try {
      const params = new URLSearchParams();
      if (timeRange?.start) params.append('start', timeRange.start);
      if (timeRange?.end) params.append('end', timeRange.end);
      if (timeRange?.preset) params.append('preset', timeRange.preset);

      const endpoint = userId ? `/api/analytics/user/${userId}` : '/api/analytics/user';
      const response = await apiClient.get<{ analytics: any }>(
        `${endpoint}?${params}`
      );

      // api-client already unwraps { success, data } to just return data
      // So response.data is { analytics: {...} }
      if (!response.success || !response.data?.analytics) {
        console.warn('User analytics not available:', response.error?.message);
        return this.getDefaultUserAnalytics(userId ?? 0);
      }

      // Transform the API response with defensive parsing
      const apiAnalytics = safeAccess(response, 'data.analytics', {});

      return {
        userId: userId ?? 0,
        username: safeString(safeAccess(apiAnalytics, 'username', 'User')),
        totalPitches: safeNumber(safeAccess(apiAnalytics, 'totalPitches', 0)),
        publishedPitches: safeNumber(safeAccess(apiAnalytics, 'publishedPitches', 0)),
        totalViews: safeNumber(
          safeAccess(apiAnalytics, 'profileViews', 0) ||
          safeAccess(apiAnalytics, 'pitchViews', 0)
        ),
        totalLikes: safeNumber(safeAccess(apiAnalytics, 'totalLikes', 0)),
        totalFollowers: safeNumber(safeAccess(apiAnalytics, 'totalFollowers', 0)),
        totalNDAs: safeNumber(safeAccess(apiAnalytics, 'totalNDAs', 0)),
        avgEngagement: safeNumber(safeAccess(apiAnalytics, 'engagement', 0)),
        topPitches: safeArray(safeAccess(apiAnalytics, 'topPitches', [])),
        growthMetrics: safeArray(safeAccess(apiAnalytics, 'growthMetrics', [])),
        audienceInsights: {
          topLocations: safeArray(safeAccess(apiAnalytics, 'audienceInsights.topLocations', [])),
          topUserTypes: safeArray(safeAccess(apiAnalytics, 'audienceInsights.topUserTypes', [])),
          peakActivity: safeArray(safeAccess(apiAnalytics, 'audienceInsights.peakActivity', [])),
        }
      };
    } catch (error) {
      console.error('Failed to fetch user analytics:', error);
      return this.getDefaultUserAnalytics(userId ?? 0);
    }
  }

  // Get dashboard metrics
  static async getDashboardMetrics(timeRange?: TimeRange): Promise<DashboardMetrics> {
    try {
      const params = new URLSearchParams();
      if (timeRange?.start) params.append('start', timeRange.start);
      if (timeRange?.end) params.append('end', timeRange.end);
      if (timeRange?.preset) params.append('preset', timeRange.preset);

      const response = await apiClient.get<{ metrics: any }>(
        `/api/analytics/dashboard?${params}`
      );

      if (!response.success || !response.data?.metrics) {
        if (response.error) {
          console.warn('Dashboard metrics not available:', response.error.message || 'No metrics data returned');
        }
        return this.getDefaultDashboardMetrics();
      }

      // Transform the API response with defensive parsing
      const apiMetrics = safeAccess(response, 'data.metrics', {});
      
      return {
        overview: {
          totalViews: safeNumber(safeAccess(apiMetrics, 'totalViews', 0)),
          totalLikes: safeNumber(safeAccess(apiMetrics, 'totalLikes', 0)),
          totalFollowers: safeNumber(safeAccess(apiMetrics, 'totalFollowers', 0)),
          totalPitches: safeNumber(safeAccess(apiMetrics, 'totalPitches', 0)),
          viewsChange: safeNumber(safeAccess(apiMetrics, 'viewsChange', 0)),
          likesChange: safeNumber(safeAccess(apiMetrics, 'likesChange', 0)),
          followersChange: safeNumber(safeAccess(apiMetrics, 'followersChange', 0)),
          pitchesChange: safeNumber(safeAccess(apiMetrics, 'pitchesChange', 0)),
        },
        performance: {
          topPitches: safeArray(safeAccess(apiMetrics, 'topPitches', [])),
          recentActivity: safeArray(safeAccess(apiMetrics, 'recentActivity', [])),
          engagementTrend: safeArray(safeAccess(apiMetrics, 'engagementTrend', [])),
        },
        revenue: {
          total: safeNumber(safeAccess(apiMetrics, 'revenue', 0)),
          subscriptions: safeNumber(safeAccess(apiMetrics, 'subscriptions', 0)),
          transactions: safeNumber(safeAccess(apiMetrics, 'transactions', 0)),
          growth: safeNumber(safeAccess(apiMetrics, 'growth', 0)),
        }
      };
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error);
      return this.getDefaultDashboardMetrics();
    }
  }

  // Get activity feed
  static async getActivityFeed(options?: {
    userId?: number;
    pitchId?: number;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ activities: Activity[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (options?.userId) params.append('userId', options.userId.toString());
      if (options?.pitchId) params.append('pitchId', options.pitchId.toString());
      if (options?.type) params.append('type', options.type);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const response = await apiClient.get<{ 
        success: boolean; 
        data?: { activities: Activity[]; total: number };
        activities?: Activity[]; 
        total?: number 
      }>(`/api/analytics/activity?${params}`);

      if (!response.success) {
        console.warn('Activity feed not available:', response.error?.message);
        return { activities: [], total: 0 };
      }

      // api-client already unwraps { success, data }, so response.data is the payload
      const activities = safeArray(safeAccess(response, 'data.activities', [])) as Activity[];
      const total = safeNumber(safeAccess(response, 'data.total', 0));

      return { activities, total };
    } catch (error) {
      console.error('Failed to fetch activity feed:', error);
      return { activities: [], total: 0 };
    }
  }

  // Track event
  static async trackEvent(event: {
    type: string;
    entityType: string;
    entityId: number | null;
    metadata?: any;
  }): Promise<void> {
    try {
      const response = await apiClient.post<{ success: boolean }>(
        '/api/analytics/track',
        event
      );

      if (!response.success) {
        console.warn('Failed to track event:', response.error?.message);
      }
    } catch (error) {
      // Silently fail for tracking events to prevent disrupting user experience
      console.warn('Event tracking failed:', error);
    }
  }

  // Track page view
  static async trackPageView(page: string, metadata?: any): Promise<void> {
    await this.trackEvent({
      type: 'page_view',
      entityType: 'page',
      entityId: null,
      metadata: { page, ...metadata }
    });
  }

  // Export analytics data
  static async exportAnalytics(options: ExportOptions): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/api/analytics/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to export analytics');
    }

    return response.blob();
  }

  // Get comparison data
  static async getComparison(
    type: 'pitch' | 'user' | 'dashboard',
    currentRange: TimeRange,
    previousRange: TimeRange,
    id?: number
  ): Promise<ComparisonData> {
    const params = new URLSearchParams();
    params.append('currentStart', currentRange.start);
    params.append('currentEnd', currentRange.end);
    params.append('previousStart', previousRange.start);
    params.append('previousEnd', previousRange.end);

    const endpoint = id ? `/api/analytics/compare/${type}/${id}` : `/api/analytics/compare/${type}`;
    const response = await apiClient.get<{ success: boolean; comparison: ComparisonData }>(
      `${endpoint}?${params}`
    );

    if (!safeAccess(response, 'success', false) || !safeAccess(response, 'data.comparison', null)) {
      throw new Error(safeAccess(response, 'error.message', 'Failed to fetch comparison data'));
    }

    const comparison = safeAccess(response, 'data.comparison', {});
    return {
      current: safeAccess(comparison, 'current', null),
      previous: safeAccess(comparison, 'previous', null),
      change: safeNumber(safeAccess(comparison, 'change', 0)),
      changePercentage: safeNumber(safeAccess(comparison, 'changePercentage', 0))
    };
  }

  // Get trending pitches
  static async getTrendingPitches(options?: {
    period?: 'day' | 'week' | 'month';
    limit?: number;
    genre?: string;
  }): Promise<PitchAnalytics[]> {
    try {
      const params = new URLSearchParams();
      if (options?.period) params.append('period', options.period);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.genre) params.append('genre', options.genre);

      const response = await apiClient.get<{ 
        success: boolean; 
        data?: { pitches: PitchAnalytics[] };
        pitches?: PitchAnalytics[] 
      }>(`/api/analytics/trending?${params}`);

      if (!response.success) {
        console.warn('Trending pitches not available:', response.error?.message);
        return [];
      }

      // api-client already unwraps { success, data }
      return safeArray(safeAccess(response, 'data.pitches', []));
    } catch (error) {
      console.error('Failed to fetch trending pitches:', error);
      return [];
    }
  }

  // Get engagement metrics
  static async getEngagementMetrics(
    entityType: 'pitch' | 'user',
    entityId: number,
    timeRange?: TimeRange
  ): Promise<{
    engagementRate: number;
    averageTimeSpent: number;
    bounceRate: number;
    interactionRate: number;
    shareRate: number;
    conversionRate: number;
    trends: { date: string; rate: number }[];
  }> {
    const params = new URLSearchParams();
    params.append('entityType', entityType);
    params.append('entityId', entityId.toString());
    if (timeRange?.start) params.append('start', timeRange.start);
    if (timeRange?.end) params.append('end', timeRange.end);

    const response = await apiClient.get<{ success: boolean; metrics: any }>(
      `/api/analytics/engagement?${params}`
    );

    if (!safeAccess(response, 'success', false) || !safeAccess(response, 'data.metrics', null)) {
      throw new Error(safeAccess(response, 'error.message', 'Failed to fetch engagement metrics'));
    }

    const metrics = safeAccess(response, 'data.metrics', {});
    return {
      engagementRate: safeNumber(safeAccess(metrics, 'engagementRate', 0)),
      averageTimeSpent: safeNumber(safeAccess(metrics, 'averageTimeSpent', 0)),
      bounceRate: safeNumber(safeAccess(metrics, 'bounceRate', 0)),
      interactionRate: safeNumber(safeAccess(metrics, 'interactionRate', 0)),
      shareRate: safeNumber(safeAccess(metrics, 'shareRate', 0)),
      conversionRate: safeNumber(safeAccess(metrics, 'conversionRate', 0)),
      trends: safeArray(safeAccess(metrics, 'trends', [])),
    };
  }

  // Get funnel analytics
  static async getFunnelAnalytics(pitchId: number): Promise<{
    views: number;
    detailViews: number;
    ndaRequests: number;
    ndaSigned: number;
    messages: number;
    conversions: number;
    dropoffRates: {
      viewToDetail: number;
      detailToNDA: number;
      ndaToMessage: number;
      messageToConversion: number;
    };
  }> {
    const response = await apiClient.get<{ success: boolean; funnel: any }>(
      `/api/analytics/funnel/${pitchId}`
    );

    if (!safeAccess(response, 'success', false) || !safeAccess(response, 'data.funnel', null)) {
      throw new Error(safeAccess(response, 'error.message', 'Failed to fetch funnel analytics'));
    }

    const funnel = safeAccess(response, 'data.funnel', {});
    const dropoffRates = safeAccess(funnel, 'dropoffRates', {});
    
    return {
      views: safeNumber(safeAccess(funnel, 'views', 0)),
      detailViews: safeNumber(safeAccess(funnel, 'detailViews', 0)),
      ndaRequests: safeNumber(safeAccess(funnel, 'ndaRequests', 0)),
      ndaSigned: safeNumber(safeAccess(funnel, 'ndaSigned', 0)),
      messages: safeNumber(safeAccess(funnel, 'messages', 0)),
      conversions: safeNumber(safeAccess(funnel, 'conversions', 0)),
      dropoffRates: {
        viewToDetail: safeNumber(safeAccess(dropoffRates, 'viewToDetail', 0)),
        detailToNDA: safeNumber(safeAccess(dropoffRates, 'detailToNDA', 0)),
        ndaToMessage: safeNumber(safeAccess(dropoffRates, 'ndaToMessage', 0)),
        messageToConversion: safeNumber(safeAccess(dropoffRates, 'messageToConversion', 0))
      }
    };
  }

  // Get revenue analytics (for applicable accounts)
  static async getRevenueAnalytics(timeRange?: TimeRange): Promise<{
    totalRevenue: number;
    subscriptionRevenue: number;
    transactionRevenue: number;
    averageOrderValue: number;
    customerLifetimeValue: number;
    churnRate: number;
    growthRate: number;
    revenueByDate: { date: string; amount: number }[];
    revenueBySource: { source: string; amount: number }[];
  }> {
    const params = new URLSearchParams();
    if (timeRange?.start) params.append('start', timeRange.start);
    if (timeRange?.end) params.append('end', timeRange.end);

    const response = await apiClient.get<{ success: boolean; revenue: any }>(
      `/api/analytics/revenue?${params}`
    );

    if (!safeAccess(response, 'success', false) || !safeAccess(response, 'data.revenue', null)) {
      throw new Error(safeAccess(response, 'error.message', 'Failed to fetch revenue analytics'));
    }

    const revenue = safeAccess(response, 'data.revenue', {});
    return {
      totalRevenue: safeNumber(safeAccess(revenue, 'totalRevenue', 0)),
      subscriptionRevenue: safeNumber(safeAccess(revenue, 'subscriptionRevenue', 0)),
      transactionRevenue: safeNumber(safeAccess(revenue, 'transactionRevenue', 0)),
      averageOrderValue: safeNumber(safeAccess(revenue, 'averageOrderValue', 0)),
      customerLifetimeValue: safeNumber(safeAccess(revenue, 'customerLifetimeValue', 0)),
      churnRate: safeNumber(safeAccess(revenue, 'churnRate', 0)),
      growthRate: safeNumber(safeAccess(revenue, 'growthRate', 0)),
      revenueByDate: safeArray(safeAccess(revenue, 'revenueByDate', [])),
      revenueBySource: safeArray(safeAccess(revenue, 'revenueBySource', [])),
    };
  }

  // Get real-time stats
  static async getRealTimeStats(): Promise<{
    activeUsers: number;
    currentViews: number;
    recentActivities: Activity[];
    trending: { type: string; items: any[] }[];
  }> {
    const response = await apiClient.get<{ success: boolean; stats: any }>(
      '/api/analytics/realtime'
    );

    if (!response.success || !response.data?.stats) {
      throw new Error(response.error?.message || 'Failed to fetch real-time stats');
    }

    return response.data.stats;
  }

  // Schedule report
  static async scheduleReport(config: {
    type: 'daily' | 'weekly' | 'monthly';
    metrics: string[];
    recipients: string[];
    format: 'pdf' | 'excel';
    timeOfDay?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  }): Promise<{ id: number; nextRun: string }> {
    const response = await apiClient.post<{ 
      success: boolean; 
      reportId: number; 
      nextRun: string 
    }>('/api/analytics/schedule-report', config);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to schedule report');
    }

    return {
      id: response.data?.reportId || 0,
      nextRun: response.data?.nextRun || ''
    };
  }

  // Get scheduled reports
  static async getScheduledReports(): Promise<any[]> {
    const response = await apiClient.get<{ success: boolean; reports: any[] }>(
      '/api/analytics/scheduled-reports'
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch scheduled reports');
    }

    return response.data?.reports || [];
  }

  // Cancel scheduled report
  static async cancelScheduledReport(reportId: number): Promise<void> {
    const response = await apiClient.delete<{ success: boolean }>(
      `/api/analytics/scheduled-reports/${reportId}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to cancel scheduled report');
    }
  }
}

// Export singleton instance
export const analyticsService = AnalyticsService;

// Re-export types for better module resolution
export type { TimeRange as AnalyticsTimeRange };