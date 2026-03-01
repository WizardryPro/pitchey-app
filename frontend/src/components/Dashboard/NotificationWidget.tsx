import React, { useState, useEffect } from 'react';
import { Bell, BellRing, ArrowRight, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotifications } from '@shared/contexts/WebSocketContext';
import { NotificationsService, type Notification as BackendNotification } from '../../services/notifications.service';
import { useRealTimeNotifications } from '../../hooks/useRealTimeNotifications';

interface NotificationWidgetProps {
  maxNotifications?: number;
  showHeader?: boolean;
  className?: string;
  compact?: boolean;
}

export function NotificationWidget({ 
  maxNotifications = 5, 
  showHeader = true, 
  className = '',
  compact = false 
}: NotificationWidgetProps) {
  const { notifications: wsNotifications, markNotificationAsRead } = useNotifications();
  const { requestNotificationPermission } = useRealTimeNotifications();
  
  const [apiNotifications, setApiNotifications] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Load recent notifications
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const notifications = await NotificationsService.getNotifications(maxNotifications * 2);
        setApiNotifications(notifications);
      } catch (error) {
        console.error('Failed to load notifications:', error);
        // Fail gracefully - just show empty notifications
        setApiNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    void loadNotifications();
  }, [maxNotifications]);

  // Combine and sort notifications
  const allNotifications = [
    ...apiNotifications.map(notification => ({
      ...NotificationsService.convertToFrontendFormat(notification),
      actions: NotificationsService.getNotificationActions(notification)
    })),
    ...wsNotifications
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, maxNotifications);

  const unreadCount = allNotifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    const apiNotification = apiNotifications.find(n => n.id.toString() === id);
    
    if (apiNotification && !apiNotification.isRead) {
      try {
        await NotificationsService.markAsRead(apiNotification.id);
        setApiNotifications(prev => 
          prev.map(n => n.id === apiNotification.id ? { ...n, isRead: true } : n)
        );
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    } else {
      markNotificationAsRead(id);
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '🔔';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {showHeader && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {unreadCount > 0 ? (
                <BellRing className="w-5 h-5 text-blue-600" />
              ) : (
                <Bell className="w-5 h-5 text-gray-400" />
              )}
              <h3 className="text-lg font-medium text-gray-900">
                Recent Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-medium px-2 py-1 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <Link
              to="/notifications"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
            >
              <span>View all</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      <div className={compact ? 'p-3' : 'p-4'}>
        {allNotifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No notifications yet</p>
            <p className="text-gray-400 text-xs mt-1">You'll see important updates here</p>
            
            {/* Browser notification permission prompt */}
            {'Notification' in window && Notification.permission === 'default' && (
              <button
                onClick={() => { void requestNotificationPermission(); }}
                className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Enable browser notifications
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {allNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border transition-colors ${
                  !notification.read 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-gray-50 border-gray-200 opacity-75'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 text-lg">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-sm font-medium ${
                        !notification.read ? 'text-gray-900' : 'text-gray-700'
                      }`}>
                        {notification.title}
                      </h4>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {formatTime(notification.timestamp)}
                        </span>
                        {!notification.read && (
                          <button
                            onClick={() => { void handleMarkAsRead(notification.id); }}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Mark as read"
                          >
                            <EyeOff className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    
                    {notification.actions && notification.actions.length > 0 && !compact && (
                      <div className="flex space-x-2 mt-2">
                        {notification.actions.slice(0, 2).map((action, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              action.action();
                              void handleMarkAsRead(notification.id);
                            }}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              action.type === 'primary'
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer with link to full notification center */}
        {allNotifications.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <Link
              to="/notifications"
              className="block text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View all notifications
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}