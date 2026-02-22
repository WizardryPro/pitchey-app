import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock apiClient BEFORE importing the service ────────────────────
const mockGet = vi.fn();

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { contentService } from '../content.service';

describe('contentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the internal cache before each test to ensure fresh API calls
    contentService.clearCache();
  });

  // ─── getHowItWorks ───────────────────────────────────────────────
  describe('getHowItWorks', () => {
    it('fetches from API and returns success response', async () => {
      const mockData = { steps: [{ title: 'Create', description: 'Create your pitch' }] };
      mockGet.mockResolvedValue({ success: true, data: mockData });

      const result = await contentService.getHowItWorks();

      expect(mockGet).toHaveBeenCalledWith('/api/content/how-it-works');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('returns cached data on second call without re-fetching', async () => {
      const mockData = { steps: [] };
      mockGet.mockResolvedValue({ success: true, data: mockData });

      await contentService.getHowItWorks();
      await contentService.getHowItWorks();

      // Should only be called once due to caching
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('returns failure response when API fails', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await contentService.getHowItWorks();

      expect(result.success).toBe(false);
      expect(result.error).toBe('API unavailable');
    });

    it('returns failure response when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await contentService.getHowItWorks();

      expect(result.success).toBe(false);
    });
  });

  // ─── getAbout ────────────────────────────────────────────────────
  describe('getAbout', () => {
    it('fetches from /api/content/about', async () => {
      const mockData = { mission: 'Connect filmmakers', vision: 'Global platform' };
      mockGet.mockResolvedValue({ success: true, data: mockData });

      const result = await contentService.getAbout();

      expect(mockGet).toHaveBeenCalledWith('/api/content/about');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('returns cached data on second call', async () => {
      mockGet.mockResolvedValue({ success: true, data: { mission: 'Test' } });

      await contentService.getAbout();
      await contentService.getAbout();

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('returns failure response when API fails', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await contentService.getAbout();

      expect(result.success).toBe(false);
      expect(result.error).toBe('API unavailable');
    });

    it('returns failure response when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await contentService.getAbout();

      expect(result.success).toBe(false);
    });
  });

  // ─── getTeam ─────────────────────────────────────────────────────
  describe('getTeam', () => {
    it('fetches from /api/content/team', async () => {
      const mockData = { members: [{ name: 'Alice', role: 'CEO' }] };
      mockGet.mockResolvedValue({ success: true, data: mockData });

      const result = await contentService.getTeam();

      expect(mockGet).toHaveBeenCalledWith('/api/content/team');
      expect(result.success).toBe(true);
    });

    it('returns cached data on second call', async () => {
      mockGet.mockResolvedValue({ success: true, data: { members: [] } });

      await contentService.getTeam();
      await contentService.getTeam();

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('returns failure response when API fails', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await contentService.getTeam();

      expect(result.success).toBe(false);
    });

    it('returns failure response when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Server error'));

      const result = await contentService.getTeam();

      expect(result.success).toBe(false);
    });
  });

  // ─── getStats ────────────────────────────────────────────────────
  describe('getStats', () => {
    it('fetches from /api/content/stats', async () => {
      const mockData = { totalUsers: 5000, totalPitches: 1200, totalInvestments: 300 };
      mockGet.mockResolvedValue({ success: true, data: mockData });

      const result = await contentService.getStats();

      expect(mockGet).toHaveBeenCalledWith('/api/content/stats');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('returns cached data on second call', async () => {
      mockGet.mockResolvedValue({ success: true, data: { totalUsers: 100 } });

      await contentService.getStats();
      await contentService.getStats();

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('returns failure response when API fails', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await contentService.getStats();

      expect(result.success).toBe(false);
    });

    it('returns failure response when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Server error'));

      const result = await contentService.getStats();

      expect(result.success).toBe(false);
    });
  });

  // ─── cache management ────────────────────────────────────────────
  describe('clearCache', () => {
    it('clears all cached data so API is re-fetched', async () => {
      mockGet.mockResolvedValue({ success: true, data: { steps: [] } });

      await contentService.getHowItWorks();
      contentService.clearCache();
      await contentService.getHowItWorks();

      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearCacheItem', () => {
    it('clears a specific cache key so that item is re-fetched', async () => {
      mockGet.mockResolvedValue({ success: true, data: { steps: [] } });

      await contentService.getHowItWorks();
      contentService.clearCacheItem('how-it-works');
      await contentService.getHowItWorks();

      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('does not affect other cached items when clearing a specific key', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      await contentService.getAbout();
      await contentService.getStats();

      contentService.clearCacheItem('about');

      // Calling getAbout again should re-fetch (cache cleared)
      // Calling getStats again should use cache (not cleared)
      await contentService.getAbout();
      await contentService.getStats();

      // getAbout called twice (initial + after clear), getStats once (cached)
      const getCalls = mockGet.mock.calls.map(c => c[0] as string);
      const aboutCalls = getCalls.filter(url => url.includes('about'));
      const statsCalls = getCalls.filter(url => url.includes('stats'));

      expect(aboutCalls.length).toBe(2);
      expect(statsCalls.length).toBe(1);
    });
  });
});
