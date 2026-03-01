import React, { useState, useEffect } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import { NotificationsService } from '../../services/notifications.service';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
    type?: 'primary' | 'secondary';
  }>;
}

interface NotificationWidgetProps {
  maxNotifications?: number;
  compact?: boolean;
  className?: string;
}

function NotificationWidgetSafe({
  maxNotifications = 5,
  compact = false,
  className = ''
}: NotificationWidgetProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiNotifications = await NotificationsService.getNotifications(maxNotifications);
        const mapped: Notification[] = apiNotifications.map((n) => ({
          id: String(n.id),
          type: (n.type === 'success' || n.type === 'warning' || n.type === 'error') ? n.type : 'info',
          title: n.title || 'Notification',
          message: n.message || '',
          timestamp: new Date(n.createdAt),
          read: n.isRead,
        }));

        setNotifications(mapped);
      } catch (err) {
        console.warn('NotificationWidget: Failed to load notifications:', err);
        setError('Could not load notifications');
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [maxNotifications]);

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
    try {
      await NotificationsService.markAsRead(parseInt(notificationId, 10));
    } catch {
      // Best effort — UI already updated
    }
  };

  const dismissNotification = (notificationId: string) => {
    setNotifications(prev =>
      prev.filter(notification => notification.id !== notificationId)
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    try {
      const now = new Date();
      const diff = now.getTime() - timestamp.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));

      if (hours < 1) return 'Just now';
      if (hours === 1) return '1 hour ago';
      if (hours < 24) return `${hours} hours ago`;

      return timestamp.toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center mb-3">
            <div className="w-5 h-5 bg-gray-300 rounded mr-2"></div>
            <div className="w-32 h-4 bg-gray-300 rounded"></div>
          </div>
          <div className="space-y-2">
            <div className="w-full h-3 bg-gray-200 rounded"></div>
            <div className="w-3/4 h-3 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="text-center py-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="flex items-center mb-3">
          <Bell className="w-5 h-5 text-gray-400 mr-2" />
          <h3 className="font-medium text-gray-700">Notifications</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">No new notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center">
          <BellRing className="w-5 h-5 text-blue-600 mr-2" />
          <h3 className="font-medium text-gray-900">
            Notifications {notifications.filter(n => !n.read).length > 0 &&
            `(${notifications.filter(n => !n.read).length})`}
          </h3>
        </div>
      </div>

      {/* Notifications List */}
      <div className={`${compact ? 'max-h-64' : 'max-h-96'} overflow-y-auto`}>
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 border-b last:border-b-0 transition-colors hover:bg-gray-50 ${
              !notification.read ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start flex-1">
                <span className="text-lg mr-3 mt-0.5">
                  {getNotificationIcon(notification.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={`text-sm font-medium ${
                      !notification.read ? 'text-gray-900' : 'text-gray-700'
                    }`}>
                      {notification.title}
                    </h4>
                    <span className="text-xs text-gray-500 ml-2">
                      {formatTimestamp(notification.timestamp)}
                    </span>
                  </div>
                  <p className={`text-sm ${
                    !notification.read ? 'text-gray-800' : 'text-gray-600'
                  }`}>
                    {notification.message}
                  </p>

                  {/* Actions */}
                  {notification.actions && (
                    <div className="flex gap-2 mt-2">
                      {notification.actions.map((action, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            try {
                              action.action();
                              markAsRead(notification.id);
                            } catch (err) {
                              console.warn('Notification action error:', err);
                            }
                          }}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            action.type === 'primary'
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => dismissNotification(notification.id)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NotificationWidgetSafe;
export { NotificationWidgetSafe };
