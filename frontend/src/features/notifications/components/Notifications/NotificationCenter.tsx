/**
 * Notification Center - Dropdown with real-time notifications and quick actions
 */

import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Bell,
  BellRing,
  X,
  Settings,
  RefreshCw,
  AlertCircle,
  Info,
  TrendingUp,
  DollarSign,
  FileText,
  Briefcase
} from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';

export interface Notification {
  id: string;
  type: 'investment' | 'project' | 'system' | 'analytics' | 'market';
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  contextType?: string;
  contextId?: string;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationCenterProps {
  className?: string;
  maxWidth?: string;
}

const NOTIFICATION_ICONS = {
  investment: DollarSign,
  project: FileText,
  system: Info,
  analytics: TrendingUp,
  market: Briefcase,
};

const PRIORITY_COLORS = {
  critical: 'text-red-600 bg-red-50 border-red-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  medium: 'text-blue-600 bg-blue-50 border-blue-200',
  low: 'text-gray-600 bg-gray-50 border-gray-200',
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  className = '',
  maxWidth = 'max-w-sm',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'today'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        bellRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !bellRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Load notifications
  const loadNotifications = async (reset: boolean = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        unreadOnly: filter === 'unread' ? 'true' : 'false',
      });

      if (filter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        params.append('startDate', today);
      }

      const response = await fetch(`/api/notifications?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to load notifications');

      const data = await response.json() as { data: Notification[]; unreadCount: number };

      if (reset) {
        setNotifications(data.data);
        setPage(2);
      } else {
        setNotifications(prev => [...prev, ...data.data]);
        setPage(prev => prev + 1);
      }

      setUnreadCount(data.unreadCount);
      setHasMore(data.data.length === 10);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load notifications on mount and filter change
  useEffect(() => {
    void loadNotifications(true);
  }, [filter]);

  // Real-time notifications via WebSocket
  useEffect(() => {
    const handleNotification = (event: CustomEvent) => {
      const newNotification = event.detail;
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(newNotification.title, {
          body: newNotification.message,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: `notification-${newNotification.id}`,
        });
      }
    };

    window.addEventListener('notification' as any, handleNotification);
    return () => window.removeEventListener('notification' as any, handleNotification);
  }, []);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to mark as read');

      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );

      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(n => !n.isRead)
        .map(n => n.id);

      if (unreadIds.length === 0) return;

      const response = await fetch('/api/notifications/read-multiple', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notificationIds: unreadIds }),
      });

      if (!response.ok) throw new Error('Failed to mark all as read');

      setNotifications(prev =>
        prev.map(notification => ({ ...notification, isRead: true }))
      );

      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Couldn\'t mark notifications as read. Please try again.');
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank');
    }
  };

  // Format notification time
  const formatNotificationTime = (createdAt: string) => {
    const date = new Date(createdAt);
    
    if (isToday(date)) {
      return formatDistanceToNow(date, { addSuffix: true });
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };

  // Get filtered notifications
  const getFilteredNotifications = () => {
    let filtered = notifications;

    switch (filter) {
      case 'unread':
        filtered = notifications.filter(n => !n.isRead);
        break;
      case 'today':
        filtered = notifications.filter(n => isToday(new Date(n.createdAt)));
        break;
      default:
        filtered = notifications;
    }

    return filtered;
  };

  const filteredNotifications = getFilteredNotifications();

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-800 transition-colors"
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-6 h-6" />
        ) : (
          <Bell className="w-6 h-6" />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center min-w-[20px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute right-0 top-full mt-2 ${maxWidth} w-80 bg-white rounded-lg shadow-xl border z-50`}
        >
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => loadNotifications(true)}
                  className="p-1 hover:bg-gray-100 rounded"
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between">
              <div className="flex space-x-1">
                {(['all', 'unread', 'today'] as const).map((filterOption) => (
                  <button
                    key={filterOption}
                    onClick={() => setFilter(filterOption)}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      filter === filterOption
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {filterOption === 'all' ? 'All' : 
                     filterOption === 'unread' ? 'Unread' : 'Today'}
                  </button>
                ))}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">
                  {filter === 'unread' 
                    ? 'No unread notifications' 
                    : filter === 'today'
                    ? 'No notifications today'
                    : 'No notifications'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredNotifications.map((notification) => {
                  const IconComponent = NOTIFICATION_ICONS[notification.type] || Info;
                  const priorityStyle = PRIORITY_COLORS[notification.priority];
                  
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${priorityStyle}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </h4>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 flex-shrink-0 mt-1" />
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              {formatNotificationTime(notification.createdAt)}
                            </span>
                            
                            {notification.priority === 'critical' && (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Urgent
                              </span>
                            )}
                          </div>

                          {notification.actionText && notification.actionUrl && (
                            <button
                              className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(notification.actionUrl, '_blank');
                              }}
                            >
                              {notification.actionText} →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Load More */}
            {hasMore && filteredNotifications.length > 0 && (
              <div className="p-4 border-t">
                <button
                  onClick={() => loadNotifications()}
                  disabled={loading}
                  className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400"
                >
                  {loading ? 'Loading...' : 'Load more notifications'}
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to full notification history
                  window.location.href = '/notifications';
                }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                View all notifications
              </button>
              
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to notification settings
                  window.location.href = '/settings/notifications';
                }}
                className="flex items-center text-sm text-gray-600 hover:text-gray-800"
              >
                <Settings className="w-4 h-4 mr-1" />
                Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;