import { useEffect } from 'react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { useRealTimeNotifications } from '../hooks/useRealTimeNotifications';
import { useWebSocket } from '@shared/contexts/WebSocketContext';

/**
 * Component that initializes the notification system when user is authenticated
 * Should be placed high in the component tree to ensure notifications work everywhere
 */
export function NotificationInitializer() {
  const { isAuthenticated, user } = useBetterAuthStore();
  const { isConnected } = useWebSocket();
  const { requestNotificationPermission } = useRealTimeNotifications();

  // Initialize real-time notifications when user is authenticated
  useRealTimeNotifications();

  // Request browser notification permission after authentication
  useEffect(() => {
    if (isAuthenticated && isConnected) {
      // Small delay to let the UI settle
      const timer = setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'default') {
          // Show a user-friendly prompt instead of immediately requesting
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isConnected, requestNotificationPermission]);

  // Log notification system status in development
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info('🔔 Notification System Status:', {
        authenticated: isAuthenticated,
        webSocketConnected: isConnected,
        browserSupport: 'Notification' in window,
        permission: window.Notification?.permission || 'N/A',
        userId: user?.id || 'N/A'
      });
    }
  }, [isAuthenticated, isConnected, user]);

  // This component doesn't render anything
  return null;
}