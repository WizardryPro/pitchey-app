import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock axios BEFORE importing the service ────────────────────────
const mockAxiosPost = vi.fn();
const mockAxiosGet = vi.fn();

vi.mock('axios', () => ({
  default: {
    post: (...args: any[]) => mockAxiosPost(...args),
    get: (...args: any[]) => mockAxiosGet(...args),
  },
}));

// ─── Mock config to avoid import.meta.env issues ────────────────────
vi.mock('../../config', () => ({
  config: { API_URL: 'http://localhost:8001' },
  default: { API_URL: 'http://localhost:8001' },
}));

// ─── Mock document.cookie (jsdom provides it, but we need cookie read/write) ──
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
});

import { viewService } from '../view.service';

describe('viewService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset cookie so each test gets a fresh session ID
    Object.defineProperty(document, 'cookie', { writable: true, value: '' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── trackView ──────────────────────────────────────────────────
  describe('trackView', () => {
    it('posts to /api/views/track with pitch data', async () => {
      const mockResponse = { data: { success: true, viewCount: 1 } };
      mockAxiosPost.mockResolvedValue(mockResponse);

      const result = await viewService.trackView({ pitchId: '42' });

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/api/views/track'),
        expect.objectContaining({ pitchId: '42' }),
        expect.objectContaining({ withCredentials: true })
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('includes X-Session-ID header', async () => {
      mockAxiosPost.mockResolvedValue({ data: { success: true } });

      await viewService.trackView({ pitchId: '1' });

      const callArgs = mockAxiosPost.mock.calls[0];
      const headers = callArgs[2]?.headers;
      expect(headers).toHaveProperty('X-Session-ID');
    });

    it('includes duration when provided', async () => {
      mockAxiosPost.mockResolvedValue({ data: { success: true } });

      await viewService.trackView({ pitchId: '10', duration: 120 });

      const body = mockAxiosPost.mock.calls[0][1];
      expect(body.duration).toBe(120);
    });

    it('throws when axios throws', async () => {
      mockAxiosPost.mockRejectedValue(new Error('Network error'));

      await expect(viewService.trackView({ pitchId: '1' })).rejects.toThrow('Network error');
    });
  });

  // ─── startViewTracking ───────────────────────────────────────────
  describe('startViewTracking', () => {
    it('calls trackView with pitchId on start', () => {
      mockAxiosPost.mockResolvedValue({ data: { success: true } });

      viewService.startViewTracking('42');

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/api/views/track'),
        expect.objectContaining({ pitchId: '42' }),
        expect.any(Object)
      );
    });

    it('records start time for the pitch', () => {
      mockAxiosPost.mockResolvedValue({ data: {} });

      viewService.startViewTracking('test-pitch');

      // Internal state - verify by stopping and checking a final trackView call
      mockAxiosPost.mockResolvedValue({ data: {} });
      viewService.stopViewTracking('test-pitch');

      // stopViewTracking should call trackView with a duration
      const calls = mockAxiosPost.mock.calls;
      const stopCall = calls[calls.length - 1];
      expect(stopCall[1]).toHaveProperty('duration');
    });
  });

  // ─── stopViewTracking ────────────────────────────────────────────
  describe('stopViewTracking', () => {
    it('calls trackView with duration on stop', async () => {
      mockAxiosPost.mockResolvedValue({ data: {} });

      viewService.startViewTracking('pitch-99');

      vi.advanceTimersByTime ? vi.useFakeTimers() : null;

      viewService.stopViewTracking('pitch-99');

      // Should have been called: once for start, once for stop
      expect(mockAxiosPost).toHaveBeenCalledTimes(2);

      const stopCallBody = mockAxiosPost.mock.calls[1][1];
      expect(stopCallBody).toHaveProperty('duration');
      expect(typeof stopCallBody.duration).toBe('number');
    });

    it('does not throw when stopping a pitch that was not started', () => {
      expect(() => viewService.stopViewTracking('never-started')).not.toThrow();
    });
  });

  // ─── getViewAnalytics ────────────────────────────────────────────
  describe('getViewAnalytics', () => {
    it('fetches from /api/views/analytics with query params', async () => {
      const mockData = {
        analytics: [{ period: '2026-01-01', views: 10, unique_viewers: 5, avg_duration: 60, countries: 3, mobile_views: 4, desktop_views: 5, tablet_views: 1 }],
        topViewers: [],
        sources: [],
        summary: { totalViews: 10, uniqueViewers: 5, avgDuration: 60 },
      };

      mockAxiosGet.mockResolvedValue({ data: { data: mockData } });

      const result = await viewService.getViewAnalytics({
        pitchId: '42',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        groupBy: 'day',
      });

      const callUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(callUrl).toContain('/api/views/analytics');
      expect(callUrl).toContain('pitchId=42');
      expect(callUrl).toContain('startDate=2026-01-01');
      expect(callUrl).toContain('groupBy=day');
      expect(result).toEqual(mockData);
    });

    it('fetches without params when not provided', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: { analytics: [], topViewers: [], sources: [], summary: { totalViews: 0, uniqueViewers: 0, avgDuration: 0 } } } });

      await viewService.getViewAnalytics({});

      const callUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(callUrl).toContain('/api/views/analytics');
    });

    it('throws when axios throws', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      await expect(viewService.getViewAnalytics({ pitchId: '1' })).rejects.toThrow('Network error');
    });
  });

  // ─── getPitchViewers ────────────────────────────────────────────
  describe('getPitchViewers', () => {
    it('fetches viewers for a pitch', async () => {
      const mockData = {
        viewers: [
          { username: 'alice', user_type: 'investor', viewed_at: '2026-01-01', duration_seconds: 90, device_type: 'desktop', country: 'US', visit_count: 1 },
        ],
        isOwner: true,
      };

      mockAxiosGet.mockResolvedValue({ data: { data: mockData } });

      const result = await viewService.getPitchViewers('42');

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/views/pitch/42'),
        expect.objectContaining({ withCredentials: true })
      );
      expect(result.viewers).toHaveLength(1);
      expect(result.isOwner).toBe(true);
    });

    it('throws when axios throws', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Not found'));

      await expect(viewService.getPitchViewers('99')).rejects.toThrow('Not found');
    });
  });

  // ─── trackEngagement ────────────────────────────────────────────
  describe('trackEngagement', () => {
    it('posts engagement type to pitch endpoint', async () => {
      mockAxiosPost.mockResolvedValue({ data: { success: true } });

      await viewService.trackEngagement('42', 'like');

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/api/pitches/42/engagement'),
        { type: 'like' },
        expect.objectContaining({ withCredentials: true })
      );
    });

    it('posts share engagement', async () => {
      mockAxiosPost.mockResolvedValue({ data: { success: true } });

      await viewService.trackEngagement('10', 'share');

      const body = mockAxiosPost.mock.calls[0][1];
      expect(body.type).toBe('share');
    });

    it('does not throw when axios fails (silent failure)', async () => {
      mockAxiosPost.mockRejectedValue(new Error('Server error'));

      await expect(viewService.trackEngagement('1', 'save')).resolves.toBeUndefined();
    });
  });

  // ─── getRealTimeViewCount ────────────────────────────────────────
  describe('getRealTimeViewCount', () => {
    it('returns view count on success', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: { viewCount: 250 } } });

      const result = await viewService.getRealTimeViewCount('42');

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/pitches/42/view-count'),
        expect.objectContaining({ withCredentials: true })
      );
      expect(result).toBe(250);
    });

    it('returns 0 when axios throws', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      const result = await viewService.getRealTimeViewCount('1');

      expect(result).toBe(0);
    });
  });
});
