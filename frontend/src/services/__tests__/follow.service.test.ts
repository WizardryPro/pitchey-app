import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.fn();
const mockAxiosGet = vi.fn();
vi.mock('axios', () => ({
  default: {
    post: (...args: any[]) => mockAxiosPost(...args),
    get: (...args: any[]) => mockAxiosGet(...args),
  },
}));

vi.mock('../../config', () => ({
  config: { API_URL: 'http://localhost:8001' },
}));

import { followService } from '../follow.service';

describe('followService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── toggleFollow ────────────────────────────────────────────────

  describe('toggleFollow', () => {
    it('sends POST to /api/follows/action with follow action', async () => {
      mockAxiosPost.mockResolvedValue({
        data: { data: { isFollowing: true, followerCount: 10, followingCount: 5 } },
      });

      const result = await followService.toggleFollow('user-42', 'follow');

      expect(mockAxiosPost).toHaveBeenCalledWith(
        'http://localhost:8001/api/follows/action',
        { userId: 'user-42', action: 'follow' },
        { withCredentials: true }
      );
      expect(result.isFollowing).toBe(true);
    });

    it('sends POST with unfollow action', async () => {
      mockAxiosPost.mockResolvedValue({
        data: { data: { isFollowing: false, followerCount: 9, followingCount: 5 } },
      });

      const result = await followService.toggleFollow('user-42', 'unfollow');

      expect(mockAxiosPost).toHaveBeenCalledWith(
        'http://localhost:8001/api/follows/action',
        { userId: 'user-42', action: 'unfollow' },
        { withCredentials: true }
      );
      expect(result.isFollowing).toBe(false);
    });

    it('returns followerCount and followingCount', async () => {
      mockAxiosPost.mockResolvedValue({
        data: { data: { isFollowing: true, followerCount: 25, followingCount: 12 } },
      });

      const result = await followService.toggleFollow('user-1', 'follow');

      expect(result.followerCount).toBe(25);
      expect(result.followingCount).toBe(12);
    });

    it('throws on network error', async () => {
      mockAxiosPost.mockRejectedValue(new Error('Network Error'));

      await expect(followService.toggleFollow('user-42', 'follow')).rejects.toThrow('Network Error');
    });
  });

  // ─── follow / unfollow (delegates to toggleFollow) ──────────────

  describe('follow', () => {
    it('delegates to toggleFollow with follow action', async () => {
      mockAxiosPost.mockResolvedValue({
        data: { data: { isFollowing: true, followerCount: 10, followingCount: 5 } },
      });

      await followService.follow('user-99');

      expect(mockAxiosPost).toHaveBeenCalledWith(
        'http://localhost:8001/api/follows/action',
        { userId: 'user-99', action: 'follow' },
        { withCredentials: true }
      );
    });
  });

  describe('unfollow', () => {
    it('delegates to toggleFollow with unfollow action', async () => {
      mockAxiosPost.mockResolvedValue({
        data: { data: { isFollowing: false, followerCount: 9, followingCount: 5 } },
      });

      await followService.unfollow('user-99');

      expect(mockAxiosPost).toHaveBeenCalledWith(
        'http://localhost:8001/api/follows/action',
        { userId: 'user-99', action: 'unfollow' },
        { withCredentials: true }
      );
    });
  });

  // ─── getFollowers ────────────────────────────────────────────────

  describe('getFollowers', () => {
    it('sends GET with type=followers query param', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { data: { users: [], total: 0, mutualFollows: [], hasMore: false } },
      });

      await followService.getFollowers();

      const calledUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/follows/list');
      expect(calledUrl).toContain('type=followers');
    });

    it('includes userId when provided', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { data: { users: [], total: 0, mutualFollows: [], hasMore: false } },
      });

      await followService.getFollowers('user-42');

      const calledUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('userId=user-42');
    });

    it('includes limit and offset params', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { data: { users: [], total: 0, mutualFollows: [], hasMore: false } },
      });

      await followService.getFollowers(undefined, 20, 10);

      const calledUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=20');
      expect(calledUrl).toContain('offset=10');
    });

    it('returns response data with users array', async () => {
      const mockUser = {
        id: '1', username: 'creator1', email: 'c@test.com',
        user_type: 'creator', created_at: '2026-01-01', is_following: true,
        follower_count: 5, following_count: 3, pitch_count: 2,
      };
      mockAxiosGet.mockResolvedValue({
        data: { data: { users: [mockUser], total: 1, mutualFollows: [], hasMore: false } },
      });

      const result = await followService.getFollowers();

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('throws on error', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network Error'));

      await expect(followService.getFollowers()).rejects.toThrow('Network Error');
    });
  });

  // ─── getFollowing ────────────────────────────────────────────────

  describe('getFollowing', () => {
    it('sends GET with type=following query param', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { data: { users: [], total: 0, mutualFollows: [], hasMore: false } },
      });

      await followService.getFollowing();

      const calledUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('type=following');
    });

    it('includes userId when provided', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { data: { users: [], total: 0, mutualFollows: [], hasMore: false } },
      });

      await followService.getFollowing('user-7');

      const calledUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('userId=user-7');
    });

    it('returns response data', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { data: { users: [{ id: '1' }], total: 1, mutualFollows: [], hasMore: true } },
      });

      const result = await followService.getFollowing();

      expect(result.hasMore).toBe(true);
      expect(result.users).toHaveLength(1);
    });
  });

  // ─── getFollowStats ──────────────────────────────────────────────

  describe('getFollowStats', () => {
    it('calls /api/follows/stats without userId param', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          data: {
            stats: { followers: 10, following: 5, mutual: 3, isFollowing: false, followsYou: false },
            recentFollowers: [],
            growth: [],
          },
        },
      });

      await followService.getFollowStats();

      const calledUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/follows/stats');
      expect(calledUrl).not.toContain('userId=');
    });

    it('includes userId when provided', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          data: {
            stats: { followers: 10, following: 5, mutual: 3, isFollowing: true, followsYou: true },
            recentFollowers: [],
            growth: [],
          },
        },
      });

      await followService.getFollowStats('user-42');

      const calledUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('userId=user-42');
    });

    it('returns stats, recentFollowers, and growth', async () => {
      const statsResponse = {
        stats: { followers: 100, following: 50, mutual: 20, isFollowing: false, followsYou: false },
        recentFollowers: [{ id: '1', username: 'new_follower', user_type: 'creator', followed_at: '2026-02-20' }],
        growth: [{ date: '2026-02-20', new_followers: 3, cumulative: 100 }],
      };
      mockAxiosGet.mockResolvedValue({ data: { data: statsResponse } });

      const result = await followService.getFollowStats();

      expect(result.stats.followers).toBe(100);
      expect(result.recentFollowers).toHaveLength(1);
      expect(result.growth).toHaveLength(1);
    });

    it('throws on error', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Server Error'));

      await expect(followService.getFollowStats()).rejects.toThrow('Server Error');
    });
  });

  // ─── getFollowSuggestions ────────────────────────────────────────

  describe('getFollowSuggestions', () => {
    it('calls /api/follows/suggestions', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } });

      await followService.getFollowSuggestions();

      const calledUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/follows/suggestions');
    });

    it('returns array of suggested users', async () => {
      const suggestions = [
        { id: '1', username: 'creator1', email: 'c@test.com', user_type: 'creator', created_at: '2026-01-01', is_following: false, follower_count: 50, following_count: 10, pitch_count: 8, relevance_score: 0.9 },
      ];
      mockAxiosGet.mockResolvedValue({ data: { data: suggestions } });

      const result = await followService.getFollowSuggestions();

      expect(result).toHaveLength(1);
      expect(result[0].relevance_score).toBe(0.9);
    });
  });

  // ─── isFollowing ─────────────────────────────────────────────────

  describe('isFollowing', () => {
    it('returns true when user is following', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          data: {
            stats: { followers: 10, following: 5, mutual: 3, isFollowing: true, followsYou: false },
            recentFollowers: [],
            growth: [],
          },
        },
      });

      const result = await followService.isFollowing('user-42');

      expect(result).toBe(true);
    });

    it('returns false when user is not following', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          data: {
            stats: { followers: 10, following: 5, mutual: 3, isFollowing: false, followsYou: false },
            recentFollowers: [],
            growth: [],
          },
        },
      });

      const result = await followService.isFollowing('user-42');

      expect(result).toBe(false);
    });

    it('returns false on error (graceful fallback)', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network Error'));

      const result = await followService.isFollowing('user-42');

      expect(result).toBe(false);
    });
  });
});
