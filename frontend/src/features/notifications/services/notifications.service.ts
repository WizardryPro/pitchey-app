import apiClient from '@/lib/api-client';

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedId?: number;
  relatedType?: string;
  data?: any;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  marketing: boolean;
}

export interface NotificationsResponse {
  success: boolean;
  data: {
    notifications: Notification[];
    message: string;
  };
}

// Translates the raw API payload's snake_case into the camelCase `Notification`
// shape the rest of the frontend expects. Keeps both keys on the object so any
// stragglers still resolve.
const PitcheyNotificationShape = {
  normalize(raw: any): Notification {
    return {
      ...raw,
      userId: raw.userId ?? raw.user_id,
      isRead: raw.isRead ?? raw.is_read ?? raw.read ?? false,
      createdAt: raw.createdAt ?? raw.created_at,
      relatedId: raw.relatedId ?? raw.related_id,
      relatedType: raw.relatedType ?? raw.related_type,
    };
  },
};

export class NotificationsService {
  /**
   * Get all notifications for the current user
   */
  static async getNotifications(limit: number = 20): Promise<Notification[]> {
    try {
      // Use the working /api/user/notifications endpoint
      const response = await apiClient.get<any>(`/api/user/notifications?limit=${limit}`);

      if (response.success && response.data?.notifications) {
        // Backend returns snake_case (created_at/is_read/related_id/related_type);
        // the rest of the client (convertToFrontendFormat, NotificationCenter) reads
        // camelCase. Without this normalisation `new Date(undefined)` → "Invalid Date".
        return response.data.notifications.map(PitcheyNotificationShape.normalize);
      }

      return [];
    } catch (error: unknown) {
      console.warn('Failed to fetch notifications:', error);
      return [];
    }
  }

  /**
   * Get unread notification count from the backend.
   * The /api/notifications/unread endpoint returns { count: N }.
   */
  static async getUnreadCount(): Promise<number> {
    try {
      const response = await apiClient.get<{ count: number }>('/api/notifications/unread');

      if (response.success && response.data) {
        return (response.data as any).count ?? 0;
      }

      return 0;
    } catch (error: unknown) {
      console.error('Failed to fetch unread count:', error);
      return 0;
    }
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(notificationId: number): Promise<boolean> {
    try {
      const response = await apiClient.put(`/api/notifications/${notificationId}/read`);
      return response.success;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  /**
   * Mark multiple notifications as read
   */
  static async markMultipleAsRead(notificationIds: number[]): Promise<boolean> {
    try {
      const response = await apiClient.put('/api/notifications/read-multiple', {
        notificationIds
      });
      return response.success;
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(): Promise<boolean> {
    try {
      // Get all notification IDs first
      const notifications = await this.getNotifications(1000); // Get a large number to cover all
      const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
      
      if (unreadIds.length === 0) {
        return true; // Nothing to mark as read
      }
      
      return await this.markMultipleAsRead(unreadIds);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return false;
    }
  }

  /**
   * Get notification preferences
   */
  static async getPreferences(): Promise<NotificationPreferences | null> {
    try {
      const response = await apiClient.get<{ preferences: NotificationPreferences }>('/api/notifications/preferences');
      return (response.data as any)?.preferences || null;
    } catch (error: unknown) {
      console.error('Failed to fetch notification preferences:', error);
      return null;
    }
  }

  /**
   * Update notification preferences
   */
  static async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<boolean> {
    try {
      const response = await apiClient.put('/api/notifications/preferences', preferences);
      return response.success;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      return false;
    }
  }

  /**
   * Convert backend notification to frontend format
   */
  static convertToFrontendFormat(notification: Notification) {
    return {
      id: notification.id.toString(),
      type: this.mapNotificationType(notification.type),
      title: notification.title,
      message: notification.message,
      timestamp: new Date(notification.createdAt),
      read: notification.isRead,
      metadata: {
        backendId: notification.id,
        relatedId: notification.relatedId,
        relatedType: notification.relatedType,
        data: notification.data
      }
    };
  }

  /**
   * Map backend notification types to frontend types
   */
  private static mapNotificationType(backendType: string): 'info' | 'success' | 'warning' | 'error' {
    switch (backendType) {
      case 'nda_approved':
      case 'investment':
      case 'follow':
        return 'success';
      case 'nda_rejected':
      case 'error':
        return 'error';
      case 'nda_request':
      case 'pitch_update':
      case 'info_request':
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Get notification actions based on type
   */
  static getNotificationActions(notification: Notification) {
    const actions: Array<{ label: string; action: () => void; type?: 'primary' | 'secondary' }> = [];

    switch (notification.type) {
      case 'nda_request':
        actions.push(
          {
            label: 'View Pitch',
            action: () => {
              if (notification.data?.pitchId) {
                window.location.href = `/pitch/${notification.data.pitchId}`;
              }
            },
            type: 'primary'
          },
          {
            label: 'Manage NDAs',
            action: () => {
              window.location.href = '/creator/ndas';
            },
            type: 'secondary'
          }
        );
        break;
      
      case 'message':
        actions.push({
          label: 'View Messages',
          action: () => {
            window.location.href = '/messages';
          },
          type: 'primary'
        });
        break;
      
      case 'investment':
        actions.push({
          label: 'View Investment',
          action: () => {
            window.location.href = '/creator/analytics';
          },
          type: 'primary'
        });
        break;
      
      case 'follow':
        actions.push({
          label: 'View Profile',
          action: () => {
            if (notification.data?.userId) {
              window.location.href = `/user/${notification.data.userId}`;
            }
          },
          type: 'primary'
        });
        break;
    }

    return actions;
  }
}