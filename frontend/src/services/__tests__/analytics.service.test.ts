import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock apiClient BEFORE importing the service ────────────────────
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: vi.fn(),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

// Mock defensive utils
vi.mock('../../utils/defensive', () => ({
  safeAccess: (obj: any, path: string, def: any) => {
    if (!obj) return def;
    const keys = path.split('.');
    let cur = obj;
    for (const k of keys) {
      if (cur == null) return def;
      cur = cur[k];
    }
    return cur ?? def;
  },
  safeNumber: (v: any, def: number = 0) => (typeof v === 'number' ? v : def),
  safeString: (v: any, def: string = '') => (typeof v === 'string' ? v : def),
  safeArray: (v: any) => (Array.isArray(v) ? v : v || []),
  safeExecute: (fn: any) => { try { return fn(); } catch { return undefined; } },
  isValidDate: () => true,
  safeTimestamp: (v: any) => v || '',
}));

import { AnalyticsService } from '../analytics.service';

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getPitchAnalytics ───────────────────────────────────────────
  describe('getPitchAnalytics', () => {
    it('returns transformed pitch analytics on success', async () => {
      const mockAnalytics = {
        title: 'Test Pitch',
        views: 500,
        uniqueViews: 300,
        likes: 50,
        shares: 10,
        ndaRequests: 5,
        ndaApproved: 3,
        messages: 8,
        avgViewDuration: 120,
        bounceRate: 0.4,
        conversionRate: 0.1,
        engagementRate: 0.25,
        viewsByDate: [{ date: '2026-01-01', count: 10 }],
        viewsBySource: [],
        viewsByLocation: [],
        viewerDemographics: { userType: [], industry: [] },
      };

      mockGet.mockResolvedValue({
        success: true,
        data: { analytics: mockAnalytics },
      });

      const result = await AnalyticsService.getPitchAnalytics(42);

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/pitch/42'));
      expect(result.pitchId).toBe(42);
      expect(result.title).toBe('Test Pitch');
      expect(result.views).toBe(500);
      expect(result.likes).toBe(50);
    });

    it('returns default analytics when API returns no data', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Not found' } });

      const result = await AnalyticsService.getPitchAnalytics(99);

      expect(result.pitchId).toBe(99);
      expect(result.views).toBe(0);
      expect(result.title).toBe('');
    });

    it('returns default analytics when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await AnalyticsService.getPitchAnalytics(1);

      expect(result.pitchId).toBe(1);
      expect(result.views).toBe(0);
    });

    it('appends time range params when provided', async () => {
      mockGet.mockResolvedValue({ success: false });

      await AnalyticsService.getPitchAnalytics(1, {
        start: '2026-01-01',
        end: '2026-01-31',
        preset: 'month',
      });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain('start=2026-01-01');
      expect(url).toContain('end=2026-01-31');
      expect(url).toContain('preset=month');
    });
  });

  // ─── getUserAnalytics ────────────────────────────────────────────
  describe('getUserAnalytics', () => {
    it('returns transformed user analytics on success', async () => {
      const mockAnalytics = {
        username: 'TestUser',
        totalPitches: 10,
        publishedPitches: 7,
        profileViews: 200,
        totalLikes: 80,
        totalFollowers: 150,
        totalNDAs: 12,
        engagement: 0.3,
        topPitches: [],
        growthMetrics: [],
        audienceInsights: {
          topLocations: [],
          topUserTypes: [],
          peakActivity: [],
        },
      };

      mockGet.mockResolvedValue({
        success: true,
        data: { analytics: mockAnalytics },
      });

      const result = await AnalyticsService.getUserAnalytics(5);

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/user/5'));
      expect(result.userId).toBe(5);
      expect(result.username).toBe('TestUser');
      expect(result.totalPitches).toBe(10);
    });

    it('uses /api/analytics/user when no userId provided', async () => {
      mockGet.mockResolvedValue({ success: false });

      await AnalyticsService.getUserAnalytics();

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/user?'));
    });

    it('returns default user analytics on failure', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await AnalyticsService.getUserAnalytics(10);

      expect(result.userId).toBe(10);
      expect(result.totalPitches).toBe(0);
    });
  });

  // ─── getDashboardMetrics ─────────────────────────────────────────
  describe('getDashboardMetrics', () => {
    it('returns transformed dashboard metrics on success', async () => {
      const mockMetrics = {
        totalViews: 1000,
        totalLikes: 200,
        totalFollowers: 500,
        totalPitches: 20,
        viewsChange: 0.1,
        likesChange: 0.05,
        followersChange: 0.2,
        pitchesChange: 0.0,
        topPitches: [],
        recentActivity: [],
        engagementTrend: [],
        revenue: 5000,
        subscriptions: 2000,
        transactions: 3000,
        growth: 0.15,
      };

      mockGet.mockResolvedValue({
        success: true,
        data: { metrics: mockMetrics },
      });

      const result = await AnalyticsService.getDashboardMetrics();

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/dashboard'));
      expect(result.overview.totalViews).toBe(1000);
      expect(result.overview.totalFollowers).toBe(500);
    });

    it('returns default metrics on failure', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await AnalyticsService.getDashboardMetrics();

      expect(result.overview.totalViews).toBe(0);
      expect(result.performance.topPitches).toEqual([]);
    });

    it('returns default metrics when no data field', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await AnalyticsService.getDashboardMetrics();

      expect(result.overview.totalViews).toBe(0);
    });
  });

  // ─── getActivityFeed ─────────────────────────────────────────────
  describe('getActivityFeed', () => {
    it('returns activity feed on success', async () => {
      const mockActivities = [
        { id: 1, type: 'view', entityType: 'pitch', entityId: 42, entityName: 'My Pitch', timestamp: '2026-01-01' },
      ];

      mockGet.mockResolvedValue({
        success: true,
        data: { activities: mockActivities, total: 1 },
      });

      const result = await AnalyticsService.getActivityFeed({ limit: 10 });

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/activity'));
      expect(result.activities).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('returns empty feed on API failure', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await AnalyticsService.getActivityFeed();

      expect(result.activities).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns empty feed when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await AnalyticsService.getActivityFeed();

      expect(result.activities).toEqual([]);
    });

    it('appends filter params correctly', async () => {
      mockGet.mockResolvedValue({ success: false });

      await AnalyticsService.getActivityFeed({ userId: 5, pitchId: 10, type: 'view', limit: 20, offset: 5 });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain('userId=5');
      expect(url).toContain('pitchId=10');
      expect(url).toContain('type=view');
      expect(url).toContain('limit=20');
      expect(url).toContain('offset=5');
    });
  });

  // ─── trackEvent ──────────────────────────────────────────────────
  describe('trackEvent', () => {
    it('posts event to correct endpoint', async () => {
      mockPost.mockResolvedValue({ success: true });

      await AnalyticsService.trackEvent({ type: 'view', entityType: 'pitch', entityId: 1 });

      expect(mockPost).toHaveBeenCalledWith('/api/analytics/track', {
        type: 'view',
        entityType: 'pitch',
        entityId: 1,
      });
    });

    it('silently fails without throwing when API errors', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      await expect(
        AnalyticsService.trackEvent({ type: 'view', entityType: 'pitch', entityId: 1 })
      ).resolves.toBeUndefined();
    });
  });

  // ─── trackPageView ───────────────────────────────────────────────
  describe('trackPageView', () => {
    it('calls trackEvent with page_view type', async () => {
      mockPost.mockResolvedValue({ success: true });

      await AnalyticsService.trackPageView('/dashboard');

      expect(mockPost).toHaveBeenCalledWith('/api/analytics/track', expect.objectContaining({
        type: 'page_view',
        entityType: 'page',
        entityId: null,
        metadata: expect.objectContaining({ page: '/dashboard' }),
      }));
    });
  });

  // ─── getTrendingPitches ──────────────────────────────────────────
  describe('getTrendingPitches', () => {
    it('returns trending pitches on success', async () => {
      const mockPitches = [{ pitchId: 1, title: 'Trending Pitch', views: 1000 }];

      mockGet.mockResolvedValue({
        success: true,
        data: { pitches: mockPitches },
      });

      const result = await AnalyticsService.getTrendingPitches({ period: 'week', limit: 5 });

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/trending'));
      expect(result).toEqual(mockPitches);
    });

    it('returns empty array on failure', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await AnalyticsService.getTrendingPitches();

      expect(result).toEqual([]);
    });

    it('returns empty array when throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await AnalyticsService.getTrendingPitches();

      expect(result).toEqual([]);
    });
  });

  // ─── getComparison ───────────────────────────────────────────────
  describe('getComparison', () => {
    it('returns comparison data on success', async () => {
      const mockComparison = { current: 100, previous: 80, change: 20, changePercentage: 0.25 };

      mockGet.mockResolvedValue({
        success: true,
        data: { comparison: mockComparison },
      });

      const result = await AnalyticsService.getComparison(
        'pitch',
        { start: '2026-01-01', end: '2026-01-31' },
        { start: '2025-12-01', end: '2025-12-31' },
        42
      );

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/compare/pitch/42'));
      expect(result.change).toBe(20);
      expect(result.changePercentage).toBe(0.25);
    });

    it('throws on failure', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Failed' } });

      await expect(
        AnalyticsService.getComparison(
          'user',
          { start: '2026-01-01', end: '2026-01-31' },
          { start: '2025-12-01', end: '2025-12-31' }
        )
      ).rejects.toThrow();
    });
  });

  // ─── getEngagementMetrics ────────────────────────────────────────
  describe('getEngagementMetrics', () => {
    it('returns engagement metrics on success', async () => {
      const mockMetrics = {
        engagementRate: 0.3,
        averageTimeSpent: 90,
        bounceRate: 0.4,
        interactionRate: 0.2,
        shareRate: 0.05,
        conversionRate: 0.1,
        trends: [],
      };

      mockGet.mockResolvedValue({
        success: true,
        data: { metrics: mockMetrics },
      });

      const result = await AnalyticsService.getEngagementMetrics('pitch', 5);

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/engagement'));
      expect(result.engagementRate).toBe(0.3);
    });

    it('throws on failure', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Failed' } });

      await expect(
        AnalyticsService.getEngagementMetrics('pitch', 5)
      ).rejects.toThrow();
    });
  });

  // ─── getFunnelAnalytics ──────────────────────────────────────────
  describe('getFunnelAnalytics', () => {
    it('returns funnel analytics on success', async () => {
      const mockFunnel = {
        views: 1000,
        detailViews: 500,
        ndaRequests: 50,
        ndaSigned: 30,
        messages: 20,
        conversions: 5,
        dropoffRates: {
          viewToDetail: 0.5,
          detailToNDA: 0.1,
          ndaToMessage: 0.4,
          messageToConversion: 0.25,
        },
      };

      mockGet.mockResolvedValue({
        success: true,
        data: { funnel: mockFunnel },
      });

      const result = await AnalyticsService.getFunnelAnalytics(42);

      expect(mockGet).toHaveBeenCalledWith('/api/analytics/funnel/42');
      expect(result.views).toBe(1000);
      expect(result.ndaRequests).toBe(50);
    });

    it('throws on failure', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Failed' } });

      await expect(AnalyticsService.getFunnelAnalytics(99)).rejects.toThrow();
    });
  });

  // ─── getRevenueAnalytics ─────────────────────────────────────────
  describe('getRevenueAnalytics', () => {
    it('returns revenue analytics on success', async () => {
      const mockRevenue = {
        totalRevenue: 50000,
        subscriptionRevenue: 30000,
        transactionRevenue: 20000,
        averageOrderValue: 500,
        customerLifetimeValue: 2000,
        churnRate: 0.05,
        growthRate: 0.2,
        revenueByDate: [],
        revenueBySource: [],
      };

      mockGet.mockResolvedValue({
        success: true,
        data: { revenue: mockRevenue },
      });

      const result = await AnalyticsService.getRevenueAnalytics();

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/revenue'));
      expect(result.totalRevenue).toBe(50000);
    });

    it('throws on failure', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Failed' } });

      await expect(AnalyticsService.getRevenueAnalytics()).rejects.toThrow();
    });
  });

  // ─── getRealTimeStats ────────────────────────────────────────────
  describe('getRealTimeStats', () => {
    it('returns real-time stats on success', async () => {
      const mockStats = { activeUsers: 25, currentViews: 100, recentActivities: [], trending: [] };

      mockGet.mockResolvedValue({
        success: true,
        data: { stats: mockStats },
      });

      const result = await AnalyticsService.getRealTimeStats();

      expect(mockGet).toHaveBeenCalledWith('/api/analytics/realtime');
      expect(result.activeUsers).toBe(25);
    });

    it('throws when no stats in response', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Failed' } });

      await expect(AnalyticsService.getRealTimeStats()).rejects.toThrow();
    });
  });

  // ─── scheduleReport ──────────────────────────────────────────────
  describe('scheduleReport', () => {
    it('posts schedule config and returns id/nextRun', async () => {
      mockPost.mockResolvedValue({
        success: true,
        data: { reportId: 7, nextRun: '2026-02-23T08:00:00Z' },
      });

      const result = await AnalyticsService.scheduleReport({
        type: 'weekly',
        metrics: ['views', 'likes'],
        recipients: ['test@example.com'],
        format: 'pdf',
      });

      expect(mockPost).toHaveBeenCalledWith('/api/analytics/schedule-report', expect.any(Object));
      expect(result.id).toBe(7);
      expect(result.nextRun).toBe('2026-02-23T08:00:00Z');
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Failed to schedule' } });

      await expect(
        AnalyticsService.scheduleReport({
          type: 'daily',
          metrics: ['views'],
          recipients: ['test@example.com'],
          format: 'excel',
        })
      ).rejects.toThrow('Failed to schedule');
    });
  });

  // ─── getScheduledReports ─────────────────────────────────────────
  describe('getScheduledReports', () => {
    it('returns scheduled reports on success', async () => {
      const mockReports = [{ id: 1, type: 'daily' }];

      mockGet.mockResolvedValue({
        success: true,
        data: { reports: mockReports },
      });

      const result = await AnalyticsService.getScheduledReports();

      expect(mockGet).toHaveBeenCalledWith('/api/analytics/scheduled-reports');
      expect(result).toEqual(mockReports);
    });

    it('throws on failure', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Not found' } });

      await expect(AnalyticsService.getScheduledReports()).rejects.toThrow();
    });
  });

  // ─── cancelScheduledReport ───────────────────────────────────────
  describe('cancelScheduledReport', () => {
    it('calls delete on correct endpoint', async () => {
      mockDelete.mockResolvedValue({ success: true });

      await AnalyticsService.cancelScheduledReport(3);

      expect(mockDelete).toHaveBeenCalledWith('/api/analytics/scheduled-reports/3');
    });

    it('throws on failure', async () => {
      mockDelete.mockResolvedValue({ success: false, error: { message: 'Not found' } });

      await expect(AnalyticsService.cancelScheduledReport(99)).rejects.toThrow();
    });
  });
});
