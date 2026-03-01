import { useEffect, useCallback, useRef } from 'react';
import { useNotificationToast } from '@shared/components/feedback/NotificationToastContainer';
import { notificationService } from '../services/notification.service';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { useWebSocket } from '../contexts/WebSocketContext';
import { BRAND } from '../constants/brand';

interface NotificationData {
  type: 'nda_request' | 'nda_approved' | 'nda_declined' | 'investment' | 'message' |
        'pitch_viewed' | 'follow' | 'comment' | 'like' | 'system' | 'nda_status_update' |
        'chat_message' | 'pitch_view_update';
  title: string;
  message: string;
  data?: any;
  userId?: number;
  pitchId?: number;
  conversationId?: number;
  requireInteraction?: boolean;
}

export function useRealTimeNotifications() {
  const toast = useNotificationToast();
  const { isAuthenticated } = useBetterAuthStore();
  const { subscribeToMessages, isConnected } = useWebSocket();
  const processedIds = useRef<Set<string>>(new Set());

  // Handle incoming real-time notifications — fires toast + browser notification
  const handleNotificationMessage = useCallback((message: any) => {
    // Deduplicate by message ID
    const msgId = message.id || message.data?.id;
    if (msgId && processedIds.current.has(msgId)) return;
    if (msgId) processedIds.current.add(msgId);

    // Determine notification data from message envelope
    // WebSocket messages arrive as { type: "notification"|"nda_status_update"|..., data: {...} }
    let notificationData: NotificationData;

    if (message.type === 'notification') {
      notificationData = message.data;
    } else if (message.type === 'nda_status_update') {
      const d = message.data || {};
      const status = d.status || 'updated';
      notificationData = {
        type: status === 'requested' ? 'nda_request' :
              status === 'approved' ? 'nda_approved' :
              status === 'rejected' ? 'nda_declined' : 'nda_request',
        title: `NDA ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: d.message || `NDA for "${d.pitchTitle || 'a pitch'}" was ${status}`,
        data: d,
        pitchId: d.pitchId,
      };
    } else if (message.type === 'chat_message') {
      const d = message.data || {};
      notificationData = {
        type: 'message',
        title: 'New Message',
        message: d.content || d.message || 'You have a new message',
        data: d,
        conversationId: d.conversationId,
      };
    } else if (message.type === 'pitch_view_update') {
      const d = message.data || {};
      notificationData = {
        type: 'pitch_viewed',
        title: 'Pitch Viewed',
        message: `Someone viewed "${d.pitchTitle || 'your pitch'}"`,
        data: d,
        pitchId: d.pitchId,
      };
    } else {
      // Unknown type — skip
      return;
    }

    if (!notificationData) return;

    // Show toast notification based on type
    switch (notificationData.type) {
      case 'nda_request':
        toast.notifyNDARequest(
          notificationData.data?.pitchTitle || 'Unknown Pitch',
          notificationData.data?.requesterName || 'Someone',
          notificationData.pitchId || 0
        );
        break;

      case 'nda_approved':
        toast.notifyNDAApproved(notificationData.data?.pitchTitle || 'Your pitch');
        break;

      case 'nda_declined':
        toast.notifyNDADeclined(notificationData.data?.pitchTitle || 'Your pitch');
        break;

      case 'investment':
        toast.notifyNewInvestment(
          notificationData.data?.amount || 0,
          notificationData.data?.pitchTitle || 'Your pitch'
        );
        break;

      case 'message':
      case 'chat_message':
        toast.notifyNewMessage(
          notificationData.data?.senderName || 'Someone',
          notificationData.message,
          notificationData.conversationId || 0
        );
        break;

      case 'pitch_viewed':
      case 'pitch_view_update':
        toast.notifyPitchViewed(
          notificationData.data?.pitchTitle || 'Your pitch',
          notificationData.data?.viewerName || 'Someone'
        );
        break;

      case 'follow':
        toast.notifyFollowReceived(
          notificationData.data?.followerName || 'Someone',
          notificationData.userId || 0
        );
        break;

      case 'comment':
        toast.info(
          'New Comment',
          `${notificationData.data?.commenterName || 'Someone'} commented on your pitch`,
          {
            duration: 5000,
            actions: [{
              label: 'View',
              action: () => window.location.href = `/pitch/${notificationData.pitchId}#comments`,
              variant: 'primary'
            }]
          }
        );
        break;

      case 'like':
        toast.info(
          'Pitch Liked',
          `${notificationData.data?.likerName || 'Someone'} liked your pitch`,
          { duration: 4000 }
        );
        break;

      case 'system':
        toast.info(notificationData.title, notificationData.message, {
          duration: notificationData.requireInteraction ? 0 : 6000,
          autoClose: !notificationData.requireInteraction
        });
        break;

      default:
        // Generic notification
        if (notificationData.title && notificationData.message) {
          toast.info(notificationData.title, notificationData.message);
        }
    }

    // Also show browser notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      notificationService.showNotification({
        title: notificationData.title,
        body: notificationData.message,
        icon: BRAND.logo,
        tag: `realtime_${msgId || Date.now()}`,
        data: notificationData.data,
        requireInteraction: notificationData.requireInteraction
      });
    }
  }, [toast]);

  // Subscribe to WebSocket messages for real-time toast notifications
  useEffect(() => {
    if (!isAuthenticated || !isConnected) return;

    const unsubscribe = subscribeToMessages((message: any) => {
      // Only handle message types that should trigger toasts
      const toastTypes = ['notification', 'nda_status_update', 'chat_message', 'pitch_view_update'];
      if (toastTypes.includes(message.type)) {
        handleNotificationMessage(message);
      }
    });

    return unsubscribe;
  }, [isAuthenticated, isConnected, subscribeToMessages, handleNotificationMessage]);

  // Cleanup processed IDs periodically to prevent memory leak
  useEffect(() => {
    const interval = setInterval(() => {
      if (processedIds.current.size > 200) {
        processedIds.current.clear();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          toast.success('Notifications enabled', 'You\'ll now receive browser notifications');
        }
        return permission;
      } catch (error) {
        console.error('Failed to request notification permission:', error);
        return 'denied';
      }
    }
    return Notification.permission;
  }, [toast]);

  return {
    requestNotificationPermission
  };
}
