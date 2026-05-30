import { config } from '@/config';
import axios from 'axios';

const API_URL = config.API_URL;

// Generate or retrieve session ID from a persistent cookie (survives tab close)
const getSessionId = (): string => {
  const cookieName = 'pitchey-view-sid';
  const match = document.cookie.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`));
  if (match) return match[1];

  const sessionId = crypto.randomUUID();
  // Set cookie with 24h expiry, SameSite=Lax for same-origin requests
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${cookieName}=${sessionId}; expires=${expires}; path=/; SameSite=Lax`;
  return sessionId;
};

export interface ViewTrackingData {
  pitchId: string;
  duration?: number;
  referrer?: string;
  userAgent?: string;
}

export interface ViewAnalyticsQuery {
  pitchId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}

export interface ViewAnalytics {
  analytics: Array<{
    period: string;
    views: number;
    unique_viewers: number;
    avg_duration: number;
    countries: number;
    mobile_views: number;
    desktop_views: number;
    tablet_views: number;
  }>;
  topViewers: Array<{
    id: string;
    username: string;
    user_type: string;
    view_count: number;
    last_viewed: string;
  }>;
  sources: Array<{
    source: string;
    count: number;
  }>;
  summary: {
    totalViews: number;
    uniqueViewers: number;
    avgDuration: number;
  };
}

export interface PitchViewer {
  id?: string;
  user_id?: string;
  username: string;
  user_type?: string;
  viewed_at: string;
  duration_seconds: number;
  device_type: string;
  country: string;
  visit_count: number;
}

class ViewService {
  private viewStartTime: Map<string, number> = new Map();
  private viewInterval: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Track a view for a pitch
   */
  async trackView(data: ViewTrackingData): Promise<any> {
    try {
      const sessionId = getSessionId();
      const response = await axios.post(
        `${API_URL}/api/views/track`,
        {
          ...data,
          referrer: data.referrer || document.referrer,
          userAgent: data.userAgent || navigator.userAgent
        },
        {
          headers: {
            'X-Session-ID': sessionId,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to track view:', error);
      throw error;
    }
  }

  /**
   * Start tracking view duration for a pitch
   */
  startViewTracking(pitchId: string): void {
    // Record start time
    this.viewStartTime.set(pitchId, Date.now());
    
    // Send initial view
    this.trackView({ pitchId }).catch(console.error);
    
    // Update duration every 10s so view_duration accumulates before the 30s feedback
    // consumption gate (was 30s, which left the progress bar stuck at 0% the whole time
    // and made users think feedback was broken and retry).
    const interval = setInterval(() => {
      const startTime = this.viewStartTime.get(pitchId);
      if (startTime) {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        this.trackView({ pitchId, duration }).catch(console.error);
      }
    }, 10000); // 10 seconds
    
    this.viewInterval.set(pitchId, interval);
  }

  /**
   * Stop tracking view duration for a pitch
   */
  stopViewTracking(pitchId: string): void {
    const interval = this.viewInterval.get(pitchId);
    if (interval) {
      clearInterval(interval);
      this.viewInterval.delete(pitchId);
    }
    
    // Send final duration
    const startTime = this.viewStartTime.get(pitchId);
    if (startTime) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      this.trackView({ pitchId, duration }).catch(console.error);
      this.viewStartTime.delete(pitchId);
    }
  }

  /**
   * Get view analytics
   */
  async getViewAnalytics(query: ViewAnalyticsQuery): Promise<ViewAnalytics> {
    try {
      const params = new URLSearchParams();
      if (query.pitchId) params.append('pitchId', query.pitchId);
      if (query.userId) params.append('userId', query.userId);
      if (query.startDate) params.append('startDate', query.startDate);
      if (query.endDate) params.append('endDate', query.endDate);
      if (query.groupBy) params.append('groupBy', query.groupBy);
      
      const response = await axios.get(
        `${API_URL}/api/views/analytics?${params.toString()}`,
        { withCredentials: true }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get view analytics:', error);
      throw error;
    }
  }

  /**
   * Get viewers for a specific pitch
   */
  async getPitchViewers(pitchId: string): Promise<{
    viewers: PitchViewer[];
    isOwner: boolean;
  }> {
    try {
      const response = await axios.get(
        `${API_URL}/api/views/pitch/${pitchId}`,
        { withCredentials: true }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get pitch viewers:', error);
      throw error;
    }
  }

  /**
   * Track engagement metrics (likes, shares, etc.)
   */
  async trackEngagement(pitchId: string, type: 'like' | 'share' | 'save'): Promise<void> {
    try {
      await axios.post(
        `${API_URL}/api/pitches/${pitchId}/engagement`,
        { type },
        { withCredentials: true }
      );
    } catch (error) {
      console.error(`Failed to track ${type}:`, error);
    }
  }

  /**
   * Get real-time view count for a pitch
   */
  async getRealTimeViewCount(pitchId: string): Promise<number> {
    try {
      const response = await axios.get(
        `${API_URL}/api/pitches/${pitchId}/view-count`,
        { withCredentials: true }
      );
      return response.data.data.viewCount;
    } catch (error) {
      console.error('Failed to get view count:', error);
      return 0;
    }
  }
}

export const viewService = new ViewService();