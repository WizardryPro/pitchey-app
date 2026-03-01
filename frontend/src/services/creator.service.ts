// Creator Service - Dashboard and creator-specific operations
import { apiClient } from '../lib/api-client';
import type { Pitch } from '@shared/types/api';
import type { User } from '@shared/types/api';

const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:8001' : '');

// Types for creator dashboard data
export interface CreatorStats {
  totalPitches: number;
  publishedPitches: number;
  draftPitches: number;
  totalViews: number;
  totalLikes: number;
  totalNDAs: number;
  avgEngagementRate: number;
  monthlyGrowth: number;
}

export interface CreatorAnalytics {
  current?: Record<string, number>;
  trend?: { month: string; views: number; likes: number; ndas: number; engagement: number }[];
  topPitches: {
    id: number;
    title: string;
    views: number;
    likes: number;
    ndas: number;
  }[];
  audienceBreakdown: {
    userType: 'investor' | 'production';
    count: number;
    percentage: number;
  }[];
  engagementByGenre?: {
    genre: string;
    views: number;
    likes: number;
    conversionRate: number;
  }[];
}

export interface CreatorNotification {
  id: number;
  type: 'pitch_view' | 'pitch_like' | 'nda_request' | 'nda_approved' | 'message' | 'follow';
  title: string;
  message: string;
  relatedId?: number;
  relatedType?: 'pitch' | 'user' | 'nda';
  isRead: boolean;
  createdAt: string;
}

export interface CreatorActivity {
  id: number;
  type: 'pitch_created' | 'pitch_published' | 'pitch_updated' | 'nda_signed' | 'message_sent';
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export class CreatorService {
  // Get creator dashboard data
  static async getDashboard(): Promise<{
    stats: CreatorStats;
    recentPitches: Pitch[];
    notifications: CreatorNotification[];
    activities: CreatorActivity[];
  }> {
    const response = await apiClient.get<{
      success: boolean;
      dashboard: {
        stats: CreatorStats;
        recentPitches: Pitch[];
        notifications: CreatorNotification[];
        activities: CreatorActivity[];
      };
    }>('/api/creator/dashboard');

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch dashboard');
    }

    return response.data?.dashboard || {
      stats: {
        totalPitches: 0,
        publishedPitches: 0,
        draftPitches: 0,
        totalViews: 0,
        totalLikes: 0,
        totalNDAs: 0,
        avgEngagementRate: 0,
        monthlyGrowth: 0
      },
      recentPitches: [],
      notifications: [],
      activities: []
    };
  }

  // Get creator statistics
  static async getStats(period?: 'week' | 'month' | 'year' | 'all'): Promise<CreatorStats> {
    const params = new URLSearchParams();
    if (period) params.append('period', period);

    const response = await apiClient.get<{
      success: boolean;
      stats: CreatorStats;
    }>(`/api/creator/stats?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch statistics');
    }

    return response.data?.stats || {
      totalPitches: 0,
      publishedPitches: 0,
      draftPitches: 0,
      totalViews: 0,
      totalLikes: 0,
      totalNDAs: 0,
      avgEngagementRate: 0,
      monthlyGrowth: 0
    };
  }

  // Get detailed analytics
  static async getAnalytics(options?: {
    startDate?: string;
    endDate?: string;
    pitchId?: number;
  }): Promise<CreatorAnalytics> {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    if (options?.pitchId) params.append('pitchId', options.pitchId.toString());

    const response = await apiClient.get<CreatorAnalytics>(`/api/creator/analytics?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch analytics');
    }

    return response.data || {
      topPitches: [],
      audienceBreakdown: []
    };
  }

  // Get notifications
  static async getNotifications(options?: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ notifications: CreatorNotification[]; total: number; unread: number }> {
    const params = new URLSearchParams();
    if (options?.unreadOnly) params.append('unreadOnly', 'true');
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response = await apiClient.get<{
      success: boolean;
      notifications: CreatorNotification[];
      total: number;
      unread: number;
    }>(`/api/creator/notifications?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch notifications');
    }

    return {
      notifications: response.data?.notifications || [],
      total: response.data?.total || 0,
      unread: response.data?.unread || 0
    };
  }

  // Mark notification as read
  static async markNotificationRead(notificationId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/creator/notifications/${notificationId}/read`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to mark notification as read');
    }
  }

  // Mark all notifications as read
  static async markAllNotificationsRead(): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/creator/notifications/read-all',
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to mark all notifications as read');
    }
  }

  // Get activity feed
  static async getActivityFeed(options?: {
    limit?: number;
    offset?: number;
    type?: string;
  }): Promise<{ activities: CreatorActivity[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.type) params.append('type', options.type);

    const response = await apiClient.get<{
      success: boolean;
      activities: CreatorActivity[];
      total: number;
    }>(`/api/creator/activities?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch activities');
    }

    return {
      activities: response.data?.activities || [],
      total: response.data?.total || 0
    };
  }

  // Get followers
  static async getFollowers(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ followers: User[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response = await apiClient.get<{
      success: boolean;
      followers: User[];
      total: number;
    }>(`/api/creator/followers?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch followers');
    }

    return {
      followers: response.data?.followers || [],
      total: response.data?.total || 0
    };
  }

  // Get earnings (if monetization is enabled)
  static async getEarnings(period?: 'week' | 'month' | 'year' | 'all'): Promise<{
    total: number;
    pending: number;
    paid: number;
    transactions: Array<{
      id: number;
      amount: number;
      type: string;
      description: string;
      status: string;
      date: string;
    }>;
  }> {
    const params = new URLSearchParams();
    if (period) params.append('period', period);

    const response = await apiClient.get<{
      success: boolean;
      earnings: any;
    }>(`/api/creator/earnings?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch earnings');
    }

    return response.data?.earnings || {
      total: 0,
      pending: 0,
      paid: 0,
      transactions: []
    };
  }

  // Export data for creator
  static async exportData(format: 'csv' | 'json' | 'pdf'): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/api/creator/export?format=${format}`, {
        headers: {
          }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to export data');
    }

    return response.blob();
  }

  // Upload profile image
  static async uploadProfileImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(
      `${API_BASE_URL}/api/creator/profile/image`, {
        method: 'POST',
        headers: {
          },
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload profile image');
    }

    const data = await response.json();
    return data.url;
  }

  // Get recommended actions for creator
  static async getRecommendedActions(): Promise<Array<{
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    action: string;
  }>> {
    const response = await apiClient.get<{
      success: boolean;
      recommendations: any[];
    }>('/api/creator/recommendations');

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch recommendations');
    }

    return response.data?.recommendations || [];
  }
}

// Export singleton instance
export const creatorService = CreatorService;
