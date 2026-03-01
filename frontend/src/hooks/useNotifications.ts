import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationService } from '../services/notification.service';
import { useWebSocket as useWebSocketContext } from '@shared/contexts/WebSocketContext';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { BRAND } from '../constants/brand';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata: any;
  relatedUserId?: number;
  relatedPitchId?: number;
  actionUrl?: string;
  actionText?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  groupId?: string;
  groupCount?: number;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (notificationIds: number[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: number) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  refetch: () => Promise<void>;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  
  const { user } = useBetterAuthStore();
  const webSocketContext = useWebSocketContext();
  const isConnected = webSocketContext.isConnected;
  const limit = 20;

  // Fetch notifications with authentication guard
  const fetchNotifications = useCallback(async (reset = false) => {
    // ✅ CRITICAL FIX: Check authentication first
    if (!user || !user.id) {
      setLoading(false);
      setNotifications([]);
      setUnreadCount(0);
      setError(null);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const currentOffset = reset ? 0 : offset;
      const data = await notificationService.getNotifications({
        limit,
        offset: currentOffset
      });

      if (reset) {
        setNotifications(data.notifications || []);
        setOffset(limit);
      } else {
        setNotifications(prev => [...prev, ...(data.notifications || [])]);
        setOffset(prev => prev + limit);
      }

      setHasMore(data.hasMore || false);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: any) {
      // ✅ Handle 401 errors gracefully
      if (err?.response?.status === 401 || err?.status === 401) {
        setNotifications([]);
        setUnreadCount(0);
        setError(null); // Don't show error for auth issues
        return;
      }
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user, offset]);

  // Initial load
  useEffect(() => {
    fetchNotifications(true);
  }, [user]);

  // WebSocket listeners
  useEffect(() => {
    if (!isConnected) return;

    const handleNewNotification = (data: any) => {
      if (data.type === 'notification') {
        setNotifications(prev => [data.data, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // Show browser notification if permitted
        if (Notification.permission === 'granted') {
          new Notification(data.data.title, {
            body: data.data.message,
            icon: BRAND.logo,
            tag: `notification-${data.data.id}`
          });
        }
      }
    };

    const handleNotificationUpdate = (data: any) => {
      if (data.type === 'notifications_read') {
        setNotifications(prev => 
          prev.map(n => 
            data.notificationIds.includes(n.id) 
              ? { ...n, isRead: true, readAt: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - data.notificationIds.length));
      }
      
      if (data.type === 'notifications_deleted') {
        setNotifications(prev => 
          prev.filter(n => !data.notificationIds.includes(n.id))
        );
      }
    };

    const handleUnreadCount = (data: any) => {
      if (data.type === 'unread_count') {
        setUnreadCount(data.count);
      }
    };

    // Subscribe to messages from WebSocket context
    const unsubscribe = webSocketContext.subscribeToMessages((message: any) => {
      try {
        if (message.type === 'notification') {
          handleNewNotification(message);
        } else if (message.type === 'notification_update') {
          handleNotificationUpdate(message.data);
        } else if (message.type === 'unread_count') {
          handleUnreadCount(message);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    });

    // Request initial unread count
    webSocketContext.sendMessage({ type: 'get_unread_count' });

    return () => {
      unsubscribe();
    };
  }, [isConnected, webSocketContext.subscribeToMessages, webSocketContext.sendMessage]);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Mark notifications as read
  const markAsRead = useCallback(async (notificationIds: number[]) => {
    try {
      // notificationService doesn't have markAsRead method - using mock implementation
      // await notificationService.markAsRead(notificationIds);
      
      setNotifications(prev =>
        prev.map(n =>
          notificationIds.includes(n.id)
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));

      // Send via WebSocket for real-time sync
      if (isConnected) {
        webSocketContext.sendMessage({
          type: 'notification_read',
          data: { notificationIds }
        });
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err);
      setError('Failed to mark as read');
    }
  }, [isConnected, webSocketContext]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      // notificationService doesn't have markAllAsRead method - using mock implementation
      // await notificationService.markAllAsRead();
      
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      
      setUnreadCount(0);

      // Send via WebSocket for real-time sync
      if (isConnected) {
        webSocketContext.sendMessage({
          type: 'notification_read',
          data: { notificationIds: notifications.filter(n => !n.isRead).map(n => n.id) }
        });
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
      setError('Failed to mark all as read');
    }
  }, [notifications, isConnected, webSocketContext]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: number) => {
    try {
      // notificationService doesn't have deleteNotification method - using mock implementation
      // await notificationService.deleteNotification(notificationId);
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError('Failed to delete notification');
    }
  }, [notifications]);

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchNotifications(false);
  }, [hasMore, loading, fetchNotifications]);

  // Refetch notifications
  const refetch = useCallback(async () => {
    setOffset(0);
    await fetchNotifications(true);
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    hasMore,
    refetch
  };
};