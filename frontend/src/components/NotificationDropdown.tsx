import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../contexts/WebSocketContext';
import { NotificationsService, type Notification as BackendNotification } from '../services/notifications.service';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { useToast } from '@shared/components/feedback/ToastProvider';

interface NotificationAction {
  label: string;
  action: () => void;
  type?: 'primary' | 'secondary';
}

interface NotificationItemProps {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actions?: NotificationAction[];
  onMarkAsRead: (id: string) => void;
}

function NotificationItem({ 
  id, 
  type, 
  title, 
  message, 
  timestamp, 
  read, 
  actions, 
  onMarkAsRead 
}: NotificationItemProps) {
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50 text-green-800';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-800';
      default:
        return 'border-blue-200 bg-blue-50 text-blue-800';
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleClick = () => {
    if (!read) {
      onMarkAsRead(id);
    }
  };

  return (
    <div
      className={`border-l-4 p-4 mb-3 cursor-pointer transition-all duration-200 hover:shadow-md ${
        read ? 'opacity-60' : ''
      } ${getTypeStyles()}`}
      onClick={handleClick}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getTypeIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium truncate">{title}</h4>
            {!read && (
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2"></div>
            )}
          </div>
          <p className="text-sm mt-1 text-gray-600">{message}</p>
          <p className="text-xs text-gray-500 mt-2">{formatTime(timestamp)}</p>
          
          {actions && actions.length > 0 && (
            <div className="flex space-x-2 mt-3">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.action();
                  }}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
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
  );
}

interface NotificationDropdownProps {
  className?: string;
}

export function NotificationDropdown({ className = '' }: NotificationDropdownProps) {
  const { notifications: wsNotifications, markNotificationAsRead, clearAllNotifications } = useNotifications();
  const { isAuthenticated } = useBetterAuthStore();
  const toast = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [apiNotifications, setApiNotifications] = useState<BackendNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previousNotificationCount = useRef(wsNotifications.length);

  // Load notifications from API
  const loadNotifications = async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoading(true);
      const notifications = await NotificationsService.getNotifications(50);
      setApiNotifications(notifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  // Load notifications on mount and when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
    }
  }, [isAuthenticated]);

  // Reload notifications when dropdown opens
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadNotifications();
    }
  }, [isOpen, isAuthenticated]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle marking notifications as read
  const handleMarkAsRead = async (id: string) => {
    // Try to find the notification in API notifications first
    const apiNotification = apiNotifications.find(n => n.id.toString() === id);
    
    if (apiNotification && !apiNotification.isRead) {
      try {
        const success = await NotificationsService.markAsRead(apiNotification.id);
        if (success) {
          // Update local state
          setApiNotifications(prev => 
            prev.map(n => n.id === apiNotification.id ? { ...n, isRead: true } : n)
          );
          toast.success('Notification marked as read');
        } else {
          toast.error('Failed to mark notification as read');
        }
      } catch (error) {
        console.error('Error marking notification as read:', error);
        toast.error('Failed to mark notification as read');
      }
    } else {
      // Fall back to WebSocket notification handling
      markNotificationAsRead(id);
    }
  };

  // Handle clearing all notifications
  const handleClearAll = async () => {
    try {
      const success = await NotificationsService.markAllAsRead();
      if (success) {
        setApiNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        clearAllNotifications(); // Clear WebSocket notifications too
        toast.success('All notifications marked as read');
      } else {
        toast.error('Failed to mark all notifications as read');
      }
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      toast.error('Failed to clear all notifications');
    }
  };

  // Combine and convert notifications from both sources
  const allNotifications = [
    // API notifications (converted to frontend format)
    ...apiNotifications.map(notification => ({
      ...NotificationsService.convertToFrontendFormat(notification),
      actions: NotificationsService.getNotificationActions(notification)
    })),
    // WebSocket notifications (already in frontend format)
    ...wsNotifications
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Track new notifications
  useEffect(() => {
    if (allNotifications.length > previousNotificationCount.current) {
      setHasNewNotifications(true);
      // Auto-hide the "new" indicator after 3 seconds
      setTimeout(() => setHasNewNotifications(false), 3000);
    }
    previousNotificationCount.current = allNotifications.length;
  }, [allNotifications.length]);

  // Reset new notifications when dropdown is opened
  useEffect(() => {
    if (isOpen) {
      setHasNewNotifications(false);
    }
  }, [isOpen]);

  const unreadCount = allNotifications.filter(n => !n.read).length;
  const recentNotifications = allNotifications.slice(0, 10); // Show last 10 notifications

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full transition-all duration-200 ${
          hasNewNotifications ? 'animate-pulse' : ''
        }`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        
        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
        
        {/* New Notification Indicator */}
        {hasNewNotifications && (
          <div className="absolute -top-1 -right-1 bg-blue-400 rounded-full h-3 w-3 animate-ping"></div>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              {allNotifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                  disabled={isLoading}
                >
                  Clear all
                </button>
              )}
            </div>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-sm">Loading notifications...</p>
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  You'll see notifications here when they arrive
                </p>
              </div>
            ) : (
              <div className="p-2">
                {recentNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    {...notification}
                    onMarkAsRead={handleMarkAsRead}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {allNotifications.length > 10 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-center">
              <button 
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                onClick={() => {
                  // You can implement a full notifications page later
                  setIsOpen(false);
                }}
              >
                View all {allNotifications.length} notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;