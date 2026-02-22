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

import { SocialService } from '../social.service';

describe('SocialService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── followUser ──────────────────────────────────────────────────
  describe('followUser', () => {
    it('posts follow action for a user', async () => {
      mockPost.mockResolvedValue({ success: true });

      await SocialService.followUser(5);

      expect(mockPost).toHaveBeenCalledWith('/api/follows/action', {
        targetId: 5,
        targetType: 'user',
        action: 'follow',
      });
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Already following' } });

      await expect(SocialService.followUser(5)).rejects.toThrow('Already following');
    });

    it('throws with string error', async () => {
      mockPost.mockResolvedValue({ success: false, error: 'Unauthorized' });

      await expect(SocialService.followUser(1)).rejects.toThrow('Unauthorized');
    });
  });

  // ─── unfollowUser ────────────────────────────────────────────────
  describe('unfollowUser', () => {
    it('posts unfollow action for a user', async () => {
      mockPost.mockResolvedValue({ success: true });

      await SocialService.unfollowUser(5);

      expect(mockPost).toHaveBeenCalledWith('/api/follows/action', {
        targetId: 5,
        targetType: 'user',
        action: 'unfollow',
      });
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Not following' } });

      await expect(SocialService.unfollowUser(5)).rejects.toThrow('Not following');
    });
  });

  // ─── followPitch ─────────────────────────────────────────────────
  describe('followPitch', () => {
    it('posts follow action for a pitch', async () => {
      mockPost.mockResolvedValue({ success: true });

      await SocialService.followPitch(42);

      expect(mockPost).toHaveBeenCalledWith('/api/follows/action', {
        targetId: 42,
        targetType: 'pitch',
        action: 'follow',
      });
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Pitch not found' } });

      await expect(SocialService.followPitch(99)).rejects.toThrow('Pitch not found');
    });
  });

  // ─── unfollowPitch ───────────────────────────────────────────────
  describe('unfollowPitch', () => {
    it('posts unfollow action for a pitch', async () => {
      mockPost.mockResolvedValue({ success: true });

      await SocialService.unfollowPitch(42);

      expect(mockPost).toHaveBeenCalledWith('/api/follows/action', {
        targetId: 42,
        targetType: 'pitch',
        action: 'unfollow',
      });
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Not following' } });

      await expect(SocialService.unfollowPitch(42)).rejects.toThrow('Not following');
    });
  });

  // ─── checkFollowStatus ───────────────────────────────────────────
  describe('checkFollowStatus', () => {
    it('returns true when total > 0', async () => {
      mockGet.mockResolvedValue({ success: true, data: { follows: [], total: 1 } });

      const result = await SocialService.checkFollowStatus(5, 'user');

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/follows/list'));
      expect(result).toBe(true);
    });

    it('returns false when total is 0', async () => {
      mockGet.mockResolvedValue({ success: true, data: { follows: [], total: 0 } });

      const result = await SocialService.checkFollowStatus(5, 'user');

      expect(result).toBe(false);
    });

    it('returns false when API fails', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await SocialService.checkFollowStatus(5, 'pitch');

      expect(result).toBe(false);
    });

    it('returns false when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await SocialService.checkFollowStatus(5, 'user');

      expect(result).toBe(false);
    });

    it('includes targetId and type in query params', async () => {
      mockGet.mockResolvedValue({ success: true, data: { total: 0 } });

      await SocialService.checkFollowStatus(10, 'pitch');

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain('targetId=10');
      expect(url).toContain('type=pitch');
    });
  });

  // ─── getFollowers ────────────────────────────────────────────────
  describe('getFollowers', () => {
    it('returns followers and total on success', async () => {
      const mockFollowers = [{ id: 1, followerId: 10, followedAt: '2026-01-01' }];
      mockGet.mockResolvedValue({ success: true, data: { followers: mockFollowers, total: 1 } });

      const result = await SocialService.getFollowers(5);

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/follows/followers'));
      expect(result.followers).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('throws on API failure', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Unauthorized' } });

      await expect(SocialService.getFollowers()).rejects.toThrow('Unauthorized');
    });

    it('includes userId in query when provided', async () => {
      mockGet.mockResolvedValue({ success: true, data: { followers: [], total: 0 } });

      await SocialService.getFollowers(7, { limit: 10, offset: 0 });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain('userId=7');
    });
  });

  // ─── getFollowing ────────────────────────────────────────────────
  describe('getFollowing', () => {
    it('returns following and total on success', async () => {
      const mockFollowing = [{ id: 2, followerId: 10, creatorId: 5, followedAt: '2026-01-01' }];
      mockGet.mockResolvedValue({ success: true, data: { following: mockFollowing, total: 1 } });

      const result = await SocialService.getFollowing();

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/follows/following'));
      expect(result.following).toHaveLength(1);
    });

    it('throws on failure', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Not found' } });

      await expect(SocialService.getFollowing()).rejects.toThrow('Not found');
    });

    it('includes type filter param', async () => {
      mockGet.mockResolvedValue({ success: true, data: { following: [], total: 0 } });

      await SocialService.getFollowing(undefined, { type: 'pitch' });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain('type=pitch');
    });
  });

  // ─── getMutualFollowers ──────────────────────────────────────────
  describe('getMutualFollowers', () => {
    it('returns empty array gracefully (not yet implemented)', async () => {
      const result = await SocialService.getMutualFollowers(5);

      expect(result).toEqual([]);
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ─── getSuggestedUsers ───────────────────────────────────────────
  describe('getSuggestedUsers', () => {
    it('returns suggested users on success', async () => {
      const mockUsers = [{ id: 1, name: 'Suggested User' }];
      mockGet.mockResolvedValue({ success: true, data: { users: mockUsers } });

      const result = await SocialService.getSuggestedUsers(5);

      expect(mockGet).toHaveBeenCalledWith('/api/follows/suggestions?limit=5');
      expect(result).toHaveLength(1);
    });

    it('uses default limit of 5', async () => {
      mockGet.mockResolvedValue({ success: true, data: { users: [] } });

      await SocialService.getSuggestedUsers();

      expect(mockGet).toHaveBeenCalledWith('/api/follows/suggestions?limit=5');
    });

    it('throws on failure', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Not found' } });

      await expect(SocialService.getSuggestedUsers()).rejects.toThrow('Not found');
    });
  });

  // ─── getActivityFeed ────────────────────────────────────────────
  describe('getActivityFeed', () => {
    it('returns activity feed on success', async () => {
      const mockActivities = [{ id: 1, userId: 5, type: 'follow', entityType: 'user', entityId: 10, createdAt: '2026-01-01' }];
      mockGet.mockResolvedValue({ success: true, data: { activities: mockActivities, total: 1 } });

      const result = await SocialService.getActivityFeed({ limit: 10 });

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/investor/activity/feed'));
      expect(result.activities).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('returns empty feed when API fails (graceful)', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await SocialService.getActivityFeed();

      expect(result.activities).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns empty feed when API throws (graceful)', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await SocialService.getActivityFeed();

      expect(result.activities).toEqual([]);
    });
  });

  // ─── getSocialStats ──────────────────────────────────────────────
  describe('getSocialStats', () => {
    it('returns social stats on success', async () => {
      const mockStats = { followers: 100, following: 50, totalLikes: 200, totalViews: 1000, engagement: 0.3 };
      mockGet.mockResolvedValue({ success: true, data: { stats: mockStats } });

      const result = await SocialService.getSocialStats(5);

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/follows/stats'));
      expect(result.followers).toBe(100);
    });

    it('uses endpoint without query when no userId', async () => {
      mockGet.mockResolvedValue({ success: true, data: { stats: { followers: 0, following: 0, totalLikes: 0, totalViews: 0, engagement: 0 } } });

      await SocialService.getSocialStats();

      expect(mockGet).toHaveBeenCalledWith('/api/follows/stats');
    });

    it('throws on failure', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Stats not found' } });

      await expect(SocialService.getSocialStats()).rejects.toThrow('Stats not found');
    });
  });

  // ─── likePitch ───────────────────────────────────────────────────
  describe('likePitch', () => {
    it('posts like to correct endpoint', async () => {
      mockPost.mockResolvedValue({ success: true });

      await SocialService.likePitch(42);

      expect(mockPost).toHaveBeenCalledWith('/api/creator/pitches/42/like', {});
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Already liked' } });

      await expect(SocialService.likePitch(42)).rejects.toThrow('Already liked');
    });
  });

  // ─── unlikePitch ─────────────────────────────────────────────────
  describe('unlikePitch', () => {
    it('calls delete on like endpoint', async () => {
      mockDelete.mockResolvedValue({ success: true });

      await SocialService.unlikePitch(42);

      expect(mockDelete).toHaveBeenCalledWith('/api/creator/pitches/42/like');
    });

    it('throws on failure', async () => {
      mockDelete.mockResolvedValue({ success: false, error: { message: 'Not liked' } });

      await expect(SocialService.unlikePitch(42)).rejects.toThrow('Not liked');
    });
  });

  // ─── checkLikeStatus ────────────────────────────────────────────
  describe('checkLikeStatus', () => {
    it('returns true when pitch is liked', async () => {
      mockGet.mockResolvedValue({ success: true, data: { liked: true } });

      const result = await SocialService.checkLikeStatus(42);

      expect(mockGet).toHaveBeenCalledWith('/api/pitches/42/like-status');
      expect(result).toBe(true);
    });

    it('returns false when not liked', async () => {
      mockGet.mockResolvedValue({ success: true, data: { liked: false } });

      const result = await SocialService.checkLikeStatus(42);

      expect(result).toBe(false);
    });

    it('returns false when API fails', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await SocialService.checkLikeStatus(42);

      expect(result).toBe(false);
    });

    it('returns false when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await SocialService.checkLikeStatus(42);

      expect(result).toBe(false);
    });
  });

  // ─── getPitchLikes ───────────────────────────────────────────────
  describe('getPitchLikes', () => {
    it('returns empty gracefully (not yet implemented)', async () => {
      const result = await SocialService.getPitchLikes(42);

      expect(result).toEqual({ users: [], total: 0 });
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ─── blockUser ───────────────────────────────────────────────────
  describe('blockUser', () => {
    it('attempts block but fails gracefully without throw', async () => {
      mockPost.mockResolvedValue({ success: false });

      await expect(SocialService.blockUser(5)).resolves.toBeUndefined();
    });

    it('resolves even when API throws', async () => {
      mockPost.mockRejectedValue(new Error('Not implemented'));

      await expect(SocialService.blockUser(5)).resolves.toBeUndefined();
    });
  });

  // ─── unblockUser ─────────────────────────────────────────────────
  describe('unblockUser', () => {
    it('resolves even when API fails', async () => {
      mockPost.mockResolvedValue({ success: false });

      await expect(SocialService.unblockUser(5)).resolves.toBeUndefined();
    });
  });

  // ─── getBlockedUsers ─────────────────────────────────────────────
  describe('getBlockedUsers', () => {
    it('returns empty array when API fails', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await SocialService.getBlockedUsers();

      expect(result).toEqual([]);
    });

    it('returns users when available', async () => {
      const mockUsers = [{ id: 10, name: 'Blocked User' }];
      mockGet.mockResolvedValue({ success: true, data: { users: mockUsers } });

      const result = await SocialService.getBlockedUsers();

      expect(result).toHaveLength(1);
    });

    it('returns empty array when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Not found'));

      const result = await SocialService.getBlockedUsers();

      expect(result).toEqual([]);
    });
  });

  // ─── reportContent ───────────────────────────────────────────────
  describe('reportContent', () => {
    it('posts report without throwing even when API fails', async () => {
      mockPost.mockResolvedValue({ success: false });

      await expect(
        SocialService.reportContent({ contentType: 'pitch', contentId: 42, reason: 'Inappropriate' })
      ).resolves.toBeUndefined();
    });

    it('resolves even when API throws', async () => {
      mockPost.mockRejectedValue(new Error('Not implemented'));

      await expect(
        SocialService.reportContent({ contentType: 'user', contentId: 5, reason: 'Spam' })
      ).resolves.toBeUndefined();
    });
  });
});
