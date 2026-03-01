/**
 * Polling Context for Cloudflare Free Tier
 * Replaces WebSocket functionality with efficient polling
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { useBetterAuthStore } from '@/store/betterAuthStore';

interface PollResponse {
  notifications?: any[];
  messages?: any[];
  updates?: any[];
  timestamp: number;
  nextPollIn: number;
}

interface PollingContextType {
  notifications: any[];
  messages: any[];
  dashboardUpdates: any;
  isPolling: boolean;
  lastPollTime: number;
  startPolling: () => void;
  stopPolling: () => void;
  forcePoll: () => Promise<void>;
  setPollingInterval: (interval: number) => void;
}

const PollingContext = createContext<PollingContextType | undefined>(undefined);

export const usePolling = () => {
  const context = useContext(PollingContext);
  if (!context) {
    throw new Error('usePolling must be used within a PollingProvider');
  }
  return context;
};

interface PollingProviderProps {
  children: React.ReactNode;
  defaultInterval?: number;
  enablePolling?: boolean;
}

export const PollingProvider: React.FC<PollingProviderProps> = ({
  children,
  defaultInterval = 30000, // 30 seconds default
  enablePolling = true
}) => {
  const { user, isAuthenticated } = useBetterAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [dashboardUpdates, setDashboardUpdates] = useState<any>({});
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollTime, setLastPollTime] = useState(0);
  const [pollingInterval, setPollingIntervalState] = useState(defaultInterval);
  
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  /**
   * Perform a single poll
   */
  const performPoll = useCallback(async () => {
    if (!isAuthenticated || !user) {
      return;
    }

    try {
      const response = await apiClient.get('/api/poll/all') as any;

      if ((response as any).notifications) {
        setNotifications(prev => {
          // Merge new notifications, avoiding duplicates
          const existingIds = new Set(prev.map(n => n.id));
          const newNotifs = (response as any).notifications.filter((n: any) => !existingIds.has(n.id));
          return [...newNotifs, ...prev].slice(0, 50); // Keep last 50
        });
      }

      if ((response as any).messages) {
        setMessages((response as any).messages);
      }

      if ((response as any).updates && (response as any).updates.length > 0) {
        setDashboardUpdates((response as any).updates[0]);
      }

      setLastPollTime(Date.now());

      // Use server-suggested interval if provided
      if ((response as any).nextPollIn && (response as any).nextPollIn > 0) {
        setPollingIntervalState((response as any).nextPollIn);
      }
    } catch (error) {
      console.error('Polling error:', error);
      // On error, increase interval to avoid hammering the server
      setPollingIntervalState(prev => Math.min(prev * 1.5, 300000)); // Max 5 minutes
    }
  }, [isAuthenticated, user]);

  /**
   * Start polling loop
   */
  const startPolling = useCallback(() => {
    if (isPollingRef.current || !enablePolling) {
      return;
    }

    isPollingRef.current = true;
    setIsPolling(true);

    const poll = async () => {
      if (!isPollingRef.current) {
        return;
      }

      await performPoll();

      // Schedule next poll
      if (isPollingRef.current) {
        pollTimeoutRef.current = setTimeout(poll, pollingInterval);
      }
    };

    // Start immediately
    poll();
  }, [performPoll, pollingInterval, enablePolling]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    setIsPolling(false);

    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  /**
   * Force an immediate poll
   */
  const forcePoll = useCallback(async () => {
    await performPoll();
  }, [performPoll]);

  /**
   * Update polling interval
   */
  const setPollingInterval = useCallback((interval: number) => {
    setPollingIntervalState(interval);
    
    // Restart polling with new interval if currently polling
    if (isPollingRef.current) {
      stopPolling();
      startPolling();
    }
  }, [startPolling, stopPolling]);

  /**
   * Start/stop polling based on authentication and visibility
   */
  useEffect(() => {
    if (isAuthenticated && enablePolling && document.visibilityState === 'visible') {
      startPolling();
    } else {
      stopPolling();
    }

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        forcePoll(); // Immediate poll when returning to tab
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, enablePolling, startPolling, stopPolling, forcePoll]);

  /**
   * Adjust polling rate based on user activity
   */
  useEffect(() => {
    let activityTimeout: NodeJS.Timeout;

    const handleActivity = () => {
      // User is active, use normal polling rate
      setPollingIntervalState(defaultInterval);
      
      // Set timeout to reduce polling after inactivity
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        // User inactive for 2 minutes, slow down polling
        setPollingIntervalState(defaultInterval * 2);
      }, 120000);
    };

    // Listen for user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      clearTimeout(activityTimeout);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [defaultInterval]);

  return (
    <PollingContext.Provider
      value={{
        notifications,
        messages,
        dashboardUpdates,
        isPolling,
        lastPollTime,
        startPolling,
        stopPolling,
        forcePoll,
        setPollingInterval
      }}
    >
      {children}
    </PollingContext.Provider>
  );
};

/**
 * Hook for specific polling use cases
 */
export const useNotificationPolling = () => {
  const { notifications, forcePoll } = usePolling();
  
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await apiClient.post(`/api/notifications/${notificationId}/read`);
      // Force poll to get updated list
      await forcePoll();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [forcePoll]);

  return {
    notifications,
    markAsRead,
    refresh: forcePoll
  };
};

/**
 * Hook for message polling with conversation context
 */
export const useMessagePolling = (conversationId?: string) => {
  const { user } = useBetterAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user || !conversationId) {
      return;
    }

    const pollMessages = async () => {
      try {
        const response = await apiClient.get(`/api/poll/messages?conversation=${conversationId}`) as any;
        if ((response as any).messages) {
          setMessages((response as any).messages);
        }
      } catch (error) {
        console.error('Message polling error:', error);
      }
    };

    // Start polling
    setIsPolling(true);
    pollMessages(); // Initial poll

    // Set up interval (5 seconds for active conversation)
    intervalRef.current = setInterval(pollMessages, 5000);

    return () => {
      setIsPolling(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, conversationId]);

  return { messages, isPolling };
};

/**
 * Hook for dashboard-specific polling
 */
export const useDashboardPolling = (role: 'creator' | 'investor' | 'production') => {
  const { dashboardUpdates, forcePoll, setPollingInterval } = usePolling();

  useEffect(() => {
    // Dashboard can use slower polling rate
    setPollingInterval(60000); // 1 minute for dashboard

    return () => {
      setPollingInterval(30000); // Reset to default
    };
  }, [setPollingInterval]);

  return {
    stats: dashboardUpdates,
    refresh: forcePoll
  };
};