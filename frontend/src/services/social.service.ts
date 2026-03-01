// Social Service - Follows, likes, and social interactions
import { apiClient } from '../lib/api-client';
import type { User, Pitch } from '@shared/types/api';

export interface Follow {
  id: number;
  followerId: number;
  creatorId?: number;  // For following users
  pitchId?: number;    // For following pitches
  followedAt: string;  // Matches database column name
  follower?: User;
  creator?: User;      // When following a user
  pitch?: Pitch;       // When following a pitch
}

export interface Activity {
  id: number;
  userId: number;
  type: 'follow' | 'like' | 'pitch_created' | 'pitch_published' | 'nda_signed';
  entityType: 'user' | 'pitch';
  entityId: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  user?: User;
  entity?: User | Pitch;
}

export interface SocialStats {
  followers: number;
  following: number;
  totalLikes: number;
  totalViews: number;
  engagement: number;
}

// API response types
interface FollowersResponseData {
  followers: Follow[];
  total: number;
}

interface FollowingResponseData {
  following: Follow[];
  total: number;
}

interface UsersResponseData {
  users: User[];
}

interface ActivityFeedResponseData {
  activities: Activity[];
  total: number;
}

interface SocialStatsResponseData {
  stats: SocialStats;
}

// Helper function to extract error message
function getErrorMessage(error: { message: string } | string | undefined, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    return error.message;
  }
  return error ?? fallback;
}

export class SocialService {
  // Follow a user
  static async followUser(userId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      '/api/follows/action',
      {
        targetId: userId,
        targetType: 'user',
        action: 'follow'
      }
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to follow user'));
    }
  }

  // Unfollow a user
  static async unfollowUser(userId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      '/api/follows/action',
      {
        targetId: userId,
        targetType: 'user',
        action: 'unfollow'
      }
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to unfollow user'));
    }
  }

  // Follow a pitch
  static async followPitch(pitchId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      '/api/follows/action',
      {
        targetId: pitchId,
        targetType: 'pitch',
        action: 'follow'
      }
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to follow pitch'));
    }
  }

  // Unfollow a pitch
  static async unfollowPitch(pitchId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      '/api/follows/action',
      {
        targetId: pitchId,
        targetType: 'pitch',
        action: 'unfollow'
      }
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to unfollow pitch'));
    }
  }

  // Check if following a target by looking up the follow list
  static async checkFollowStatus(targetId: number, type: 'user' | 'pitch'): Promise<boolean> {
    try {
      // Use /api/follows/list and check if targetId appears in the results
      const params = new URLSearchParams();
      params.append('targetId', targetId.toString());
      params.append('type', type);

      const response = await apiClient.get<{ follows: Follow[]; total: number }>(
        `/api/follows/list?${params.toString()}`
      );

      if (response.success !== true) {
        return false;
      }

      // If any results are returned for this targetId, the user is following
      return (response.data?.total ?? 0) > 0;
    } catch {
      // Gracefully handle if backend does not support this query
      return false;
    }
  }

  // Get followers
  static async getFollowers(userId?: number, options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ followers: Follow[]; total: number }> {
    const params = new URLSearchParams();
    if (userId !== undefined && userId !== 0) params.append('userId', userId.toString());
    if (options?.limit !== undefined && options.limit !== 0) params.append('limit', options.limit.toString());
    if (options?.offset !== undefined && options.offset !== 0) params.append('offset', options.offset.toString());

    const response = await apiClient.get<FollowersResponseData>(
      `/api/follows/followers?${params.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch followers'));
    }

    return {
      followers: response.data?.followers ?? [],
      total: response.data?.total ?? 0
    };
  }

  // Get following
  static async getFollowing(userId?: number, options?: {
    type?: 'user' | 'pitch' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<{ following: Follow[]; total: number }> {
    const params = new URLSearchParams();
    if (userId !== undefined && userId !== 0) params.append('userId', userId.toString());
    if (options?.type !== undefined) params.append('type', options.type);
    if (options?.limit !== undefined && options.limit !== 0) params.append('limit', options.limit.toString());
    if (options?.offset !== undefined && options.offset !== 0) params.append('offset', options.offset.toString());

    const response = await apiClient.get<FollowingResponseData>(
      `/api/follows/following?${params.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch following'));
    }

    return {
      following: response.data?.following ?? [],
      total: response.data?.total ?? 0
    };
  }

  // Get mutual followers
  // NOTE: No backend route exists for mutual followers yet. Returns empty gracefully.
  static getMutualFollowers(_userId: number): Promise<User[]> {
    // Backend route /api/follows/mutual does not exist yet.
    // Return empty array until the endpoint is implemented.
    return Promise.resolve([]);
  }

  // Get suggested users to follow
  static async getSuggestedUsers(limit: number = 5): Promise<User[]> {
    const response = await apiClient.get<UsersResponseData>(
      `/api/follows/suggestions?limit=${limit.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch suggestions'));
    }

    return response.data?.users ?? [];
  }

  // Get activity feed
  // Uses /api/investor/activity/feed as the primary backend route
  static async getActivityFeed(options?: {
    userId?: number;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ activities: Activity[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.userId !== undefined && options.userId !== 0) params.append('userId', options.userId.toString());
    if (options?.type !== undefined && options.type !== '') params.append('type', options.type);
    if (options?.limit !== undefined && options.limit !== 0) params.append('limit', options.limit.toString());
    if (options?.offset !== undefined && options.offset !== 0) params.append('offset', options.offset.toString());

    try {
      const response = await apiClient.get<ActivityFeedResponseData>(
        `/api/investor/activity/feed?${params.toString()}`
      );

      if (response.success !== true) {
        // Gracefully return empty if the endpoint is not available
        return { activities: [], total: 0 };
      }

      return {
        activities: response.data?.activities ?? [],
        total: response.data?.total ?? 0
      };
    } catch {
      // Gracefully handle if the activity feed endpoint is not available
      return { activities: [], total: 0 };
    }
  }

  // Get social stats
  static async getSocialStats(userId?: number): Promise<SocialStats> {
    const params = new URLSearchParams();
    if (userId !== undefined && userId !== 0) params.append('userId', userId.toString());
    const queryString = params.toString();
    const endpoint = `/api/follows/stats${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<SocialStatsResponseData>(endpoint);

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch social stats'));
    }

    return response.data?.stats ?? {
      followers: 0,
      following: 0,
      totalLikes: 0,
      totalViews: 0,
      engagement: 0
    };
  }

  // Like a pitch
  static async likePitch(pitchId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      `/api/creator/pitches/${pitchId.toString()}/like`,
      {}
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to like pitch'));
    }
  }

  // Unlike a pitch (uses DELETE method on the like endpoint)
  static async unlikePitch(pitchId: number): Promise<void> {
    const response = await apiClient.delete<Record<string, unknown>>(
      `/api/creator/pitches/${pitchId.toString()}/like`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to unlike pitch'));
    }
  }

  // Check if liked
  static async checkLikeStatus(pitchId: number): Promise<boolean> {
    try {
      const response = await apiClient.get<{ liked: boolean }>(
        `/api/pitches/${pitchId.toString()}/like-status`
      );
      return response.success === true && response.data?.liked === true;
    } catch {
      return false;
    }
  }

  // Get pitch likes
  // NOTE: No dedicated /likes listing endpoint exists on the backend yet.
  // Returns empty gracefully until the endpoint is implemented.
  static getPitchLikes(_pitchId: number): Promise<{ users: User[]; total: number }> {
    // Backend does not have a /pitches/:id/likes listing route yet.
    return Promise.resolve({ users: [], total: 0 });
  }

  // Block user
  // NOTE: No backend route exists for blocking users yet. Fails gracefully.
  static async blockUser(userId: number): Promise<void> {
    try {
      const response = await apiClient.post<Record<string, unknown>>(
        `/api/users/${userId.toString()}/block`,
        {}
      );

      if (response.success !== true) {
        console.warn('Block user endpoint not available yet');
      }
    } catch {
      console.warn('Block user endpoint not available yet');
    }
  }

  // Unblock user
  // NOTE: No backend route exists for unblocking users yet. Fails gracefully.
  static async unblockUser(userId: number): Promise<void> {
    try {
      const response = await apiClient.post<Record<string, unknown>>(
        `/api/users/${userId.toString()}/unblock`,
        {}
      );

      if (response.success !== true) {
        console.warn('Unblock user endpoint not available yet');
      }
    } catch {
      console.warn('Unblock user endpoint not available yet');
    }
  }

  // Get blocked users
  // NOTE: No backend route exists for listing blocked users yet. Returns empty gracefully.
  static async getBlockedUsers(): Promise<User[]> {
    try {
      const response = await apiClient.get<UsersResponseData>(
        '/api/users/blocked'
      );

      if (response.success !== true) {
        return [];
      }

      return response.data?.users ?? [];
    } catch {
      return [];
    }
  }

  // Report content
  // NOTE: No backend route exists for reporting content yet. Fails gracefully.
  static async reportContent(data: {
    contentType: 'user' | 'pitch' | 'message';
    contentId: number;
    reason: string;
    details?: string;
  }): Promise<void> {
    try {
      const response = await apiClient.post<Record<string, unknown>>(
        '/api/reports',
        data
      );

      if (response.success !== true) {
        console.warn('Report content endpoint not available yet');
      }
    } catch {
      console.warn('Report content endpoint not available yet');
    }
  }
}

// Export singleton instance
export const socialService = SocialService;
