import React, { useState, useEffect } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationsService } from '../services/notifications.service';

interface NotificationBellProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function NotificationBellSafe({
  className = '',
  showLabel = false,
  size = 'md'
}: NotificationBellProps) {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        setLoading(true);
        const count = await NotificationsService.getUnreadCount();
        setUnreadCount(count);
      } catch (error) {
        console.warn('NotificationBell: Could not load unread count:', error);
        setUnreadCount(0);
      } finally {
        setLoading(false);
      }
    };

    loadUnreadCount();

    // Poll every 60 seconds for new notifications
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleBellClick = () => {
    try {
      setIsAnimating(true);
      navigate('/notifications');
      setTimeout(() => setIsAnimating(false), 300);
    } catch (error) {
      console.warn('NotificationBell: Navigation error:', error);
    }
  };

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const containerClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3'
  };

  const hasNew = unreadCount > 0;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={handleBellClick}
        disabled={loading}
        className={`
          ${containerClasses[size]}
          text-gray-600 hover:text-blue-600
          hover:bg-blue-50 rounded-lg transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isAnimating ? 'animate-pulse' : ''}
        `}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <div className="relative">
          {hasNew ? (
            <BellRing className={`${sizeClasses[size]} transition-transform ${isAnimating ? 'scale-110' : ''}`} />
          ) : (
            <Bell className={`${sizeClasses[size]} transition-transform ${isAnimating ? 'scale-110' : ''}`} />
          )}

          {/* Notification Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}

          {/* Pulse animation for new notifications */}
          {hasNew && (
            <span className="absolute -top-1 -right-1 bg-red-400 rounded-full w-[18px] h-[18px] animate-ping opacity-75"></span>
          )}
        </div>
      </button>

      {/* Label */}
      {showLabel && (
        <span className="ml-2 text-sm text-gray-700">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-1 text-red-600 font-medium">({unreadCount})</span>
          )}
        </span>
      )}
    </div>
  );
}

export default NotificationBellSafe;
export { NotificationBellSafe };
