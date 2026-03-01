import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { notificationService } from '@/services/notification.service';
// WebSocket removed - was causing circular dependency and reload issues
// import { useWebSocket } from './WebSocketContext';

export interface Notification {
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

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  fetchNotifications: () => Promise<void>;
  isLoading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // WebSocket notifications temporarily disabled to fix circular dependency
  // const { notifications: wsNotifications } = useWebSocket();

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await notificationService.getNotifications() as any;
      const data = (response as any).notifications || [];

      // Transform API notifications to context format
      const formattedNotifications: Notification[] = data.map((n: any) => ({
        id: n.id.toString(),
        type: n.type as Notification['type'],
        title: n.title,
        message: n.message,
        timestamp: new Date(n.createdAt),
        read: n.isRead,
      }));
      
      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );

    // Mark as read on server
    (notificationService as any).markAsRead?.(parseInt(id)).catch(console.error);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );

    // Mark all as read on server
    (notificationService as any).markAllAsRead?.().catch(console.error);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // WebSocket notifications disabled - was causing circular dependency
  // useEffect(() => {
  //   if (wsNotifications && wsNotifications.length > 0) {
  //     // Transform WebSocket notifications to context format
  //     const formattedNotifications: Notification[] = wsNotifications.map(n => ({
  //       id: n.id.toString(),
  //       type: n.type as Notification['type'],
  //       title: n.title,
  //       message: n.message,
  //       timestamp: n.timestamp,
  //       read: n.read,
  //     }));
  //     
  //     setNotifications(formattedNotifications);
  //   }
  // }, [wsNotifications]);

  // Initial fetch only once on mount (no aggressive polling)
  useEffect(() => {
    // Single initial fetch with delay to avoid rate limiting on page load
    const timer = setTimeout(() => {
      fetchNotifications();
    }, 3000);

    return () => clearTimeout(timer);
  }, []); // Empty dependency array - only run once on mount

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    fetchNotifications,
    isLoading,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};