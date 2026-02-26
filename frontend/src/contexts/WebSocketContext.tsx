import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode, useMemo } from 'react';
import { useWebSocketAdvanced } from '../hooks/useWebSocketAdvanced';
import type { WebSocketMessage, ConnectionStatus, MessageQueueStatus, ConnectionQuality } from '../types/websocket';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { config } from '../config';
import { presenceFallbackService } from '../services/presence-fallback.service';
import { pollingService } from '../services/polling.service';
import { BRAND } from '../constants/brand';

interface NotificationData {
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

interface NDAStatusUpdate {
  ndaId: number;
  pitchId: number;
  status: 'pending' | 'approved' | 'rejected' | 'signed' | 'expired' | 'revoked';
  previousStatus?: string;
  creatorName?: string;
  requesterName?: string;
  pitchTitle?: string;
  timestamp: Date;
  reason?: string;
  notes?: string;
  read?: boolean;
}

interface DashboardMetrics {
  pitchViews: number;
  totalRevenue: number;
  activeInvestors: number;
  newMessages: number;
  lastUpdated: Date;
}

interface PresenceData {
  userId: number;
  username: string;
  status: 'online' | 'away' | 'offline' | 'dnd';
  lastSeen: Date;
  activity?: string;
}

interface TypingData {
  conversationId: number;
  userId: number;
  username: string;
  isTyping: boolean;
}

interface UploadProgress {
  uploadId: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface PitchViewData {
  pitchId: number;
  viewCount: number;
  uniqueViewers: number;
  recentViewers: Array<{
    userId: number;
    username: string;
    timestamp: Date;
  }>;
}

interface WebSocketContextType {
  // Enhanced connection state
  connectionStatus: ConnectionStatus;
  queueStatus: MessageQueueStatus;
  isConnected: boolean;
  isReconnecting: boolean;
  isDisconnecting: boolean;
  
  // Connection quality and reliability
  connectionQuality: ConnectionQuality;
  retryCount: number;
  isHealthy: boolean;
  
  // Real-time data
  notifications: NotificationData[];
  dashboardMetrics: DashboardMetrics | null;
  onlineUsers: PresenceData[];
  typingIndicators: TypingData[];
  uploadProgress: UploadProgress[];
  pitchViews: Map<number, PitchViewData>;
  ndaUpdates: NDAStatusUpdate[];
  
  // Actions
  sendMessage: (message: WebSocketMessage) => boolean;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  updatePresence: (status: PresenceData['status'], activity?: string) => void;
  startTyping: (conversationId: number) => void;
  stopTyping: (conversationId: number) => void;
  trackPitchView: (pitchId: number) => void;
  
  // NDA-specific actions
  subscribeToNDAUpdates: (callback: (update: NDAStatusUpdate) => void) => () => void;
  markNDAUpdateAsRead: (ndaId: number) => void;
  clearNDAUpdates: () => void;
  
  // Enhanced connection control
  connect: () => void;
  disconnect: () => void;
  manualReconnect: () => void;
  clearQueue: () => void;
  
  // Emergency controls
  disableWebSocket: () => void;
  enableWebSocket: () => void;
  isWebSocketDisabled: boolean;
  
  // Subscriptions
  subscribeToNotifications: (callback: (notification: NotificationData) => void) => () => void;
  subscribeToDashboard: (callback: (metrics: DashboardMetrics) => void) => () => void;
  subscribeToPresence: (callback: (users: PresenceData[]) => void) => () => void;
  subscribeToTyping: (conversationId: number, callback: (typing: TypingData[]) => void) => () => void;
  subscribeToUploads: (callback: (uploads: UploadProgress[]) => void) => () => void;
  subscribeToPitchViews: (pitchId: number, callback: (data: PitchViewData) => void) => () => void;
  
  // General message subscription for custom hooks
  subscribeToMessages: (callback: (message: WebSocketMessage) => void) => () => void;
  
  // Notification permission (must be called from user interaction)
  requestNotificationPermission: () => Promise<NotificationPermission>;
  
  // Debug and monitoring
  getConnectionStats: () => any;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { user, isAuthenticated, loading } = useBetterAuthStore();
  const [authStabilized, setAuthStabilized] = useState(false);
  
  // CRITICAL: Enhanced timing control to prevent premature WebSocket connections
  // This addresses the "WebSocket is closed before connection is established" error
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      // Only allow WebSocket connection after authentication is fully stable
      const timer = setTimeout(() => {
        setAuthStabilized(true);
      }, 500); // Increased delay to ensure complete authentication stability
      
      return () => clearTimeout(timer);
    } else if (!isAuthenticated) {
      // Immediately disable WebSocket if user logs out
      setAuthStabilized(false);
    }
  }, [loading, isAuthenticated, user]);
  
  // Emergency disable state - ENABLED by default to test new WebSocket service
  const [isWebSocketDisabled, setIsWebSocketDisabled] = useState(false);
  
  // Fallback state - will automatically switch to polling if WebSocket fails
  const [usingFallback, setUsingFallback] = useState(false);
  
  // State
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceData[]>([]);
  const [typingIndicators, setTypingIndicators] = useState<TypingData[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [ndaUpdates, setNDAUpdates] = useState<NDAStatusUpdate[]>([]);
  const [pitchViews, setPitchViews] = useState<Map<number, PitchViewData>>(new Map());
  
  // Subscription callbacks
  const [subscriptions] = useState({
    notifications: new Set<(notification: NotificationData) => void>(),
    dashboard: new Set<(metrics: DashboardMetrics) => void>(),
    presence: new Set<(users: PresenceData[]) => void>(),
    typing: new Map<number, Set<(typing: TypingData[]) => void>>(),
    uploads: new Set<(uploads: UploadProgress[]) => void>(),
    pitchViews: new Map<number, Set<(data: PitchViewData) => void>>(),
    messages: new Set<(message: WebSocketMessage) => void>(), // General message subscriptions
    ndaUpdates: new Set<(update: NDAStatusUpdate) => void>(),
  });
  
  // Track previous user type for portal switching detection
  const previousUserType = useRef<string | null>(localStorage.getItem('userType'));
  
  // CRITICAL: Enhanced connection control - only connect when auth is completely stable
  // This prevents the "WebSocket is closed before connection is established" error
  const shouldAutoConnect = !!(authStabilized && isAuthenticated && user && !isWebSocketDisabled && config.WEBSOCKET_ENABLED);
  
  // Enhanced WebSocket connection with comprehensive error handling
  const {
    connectionStatus,
    queueStatus,
    isConnected,
    isReconnecting,
    isDisconnecting,
    connectionQuality,
    retryCount,
    isHealthy,
    sendMessage: wsSendMessage,
    connect,
    disconnect,
    manualReconnect,
    clearQueue,
    getStats,
  } = useWebSocketAdvanced({
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError, // Add comprehensive error handler
    onReconnect: handleReconnect, // Add reconnection handler
    onConnectionQualityChange: handleConnectionQualityChange,
    autoConnect: shouldAutoConnect,
    reconnection: {
      enabled: !!shouldAutoConnect, // Only enable reconnection if we should connect
      maxAttempts: 10,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitter: true,
    },
    heartbeat: {
      enabled: !!shouldAutoConnect, // Only enable heartbeat if we should connect
      interval: 30000,
      timeout: 10000,
      maxMissed: 3,
    },
    maxQueueSize: 100,
    enablePersistence: true,
    rateLimit: {
      maxMessages: 120,
      windowMs: 60000,
    },
  });
  
  // CRITICAL: Handle authentication state changes
  // Disconnect immediately when authentication is lost to prevent 400 errors
  useEffect(() => {
    if (!shouldAutoConnect && isConnected) {
      disconnect();
    }
  }, [shouldAutoConnect, isConnected, disconnect]);
  
  // Handle incoming messages
  function handleMessage(message: WebSocketMessage) {
    // Notify all general message subscribers first
    subscriptions.messages.forEach(callback => callback(message));
    
    switch (message.type) {
      case 'notification':
        handleNotificationMessage(message);
        break;
      case 'dashboard_update':
        handleDashboardUpdate(message);
        break;
      case 'presence_update':
        handlePresenceUpdate(message);
        break;
      case 'typing_indicator':
        handleTypingIndicator(message);
        break;
      case 'typing':
        // Legacy support - redirect to new handler
        handleTypingIndicator(message);
        break;
      case 'upload_progress':
        handleUploadProgress(message);
        break;
      case 'pitch_view_update':
        handlePitchView(message);
        break;
      case 'pitch_view':
        // Legacy support - redirect to new handler
        handlePitchView(message);
        break;
      case 'nda_status_update':
        handleNDAStatusUpdate(message);
        break;
      case 'nda_update':
        // Legacy support - redirect to new handler
        handleNDAStatusUpdate(message);
        break;
      case 'chat_message':
        handleChatMessage(message);
        break;
      case 'draft_sync':
        // Forward to specific draft sync handlers via general message subscribers
        // The useDraftSync hook subscribes via subscribeToMessages
        break;
      case 'connection':
        // Enhanced connection confirmation from real-time service
        break;
      case 'subscribed':
        // Channel subscription confirmation
        break;
      case 'unsubscribed':
        // Channel unsubscription confirmation
        break;
      case 'ping':
      case 'pong':
      case 'connected':
      case 'error':
        // These are handled by the lower-level WebSocket hooks
        break;
      case 'initial_data':
        // Handle initial data from server
        // Store notifications if present
        if (message.data?.notifications && Array.isArray(message.data.notifications)) {
          setNotifications(message.data.notifications.map((n: any) => ({
            id: n.id?.toString() || Math.random().toString(),
            type: n.type || 'info',
            title: n.title || 'Notification',
            message: n.message || '',
            timestamp: new Date(n.createdAt || Date.now()),
            read: n.isRead || false
          })));
        }
        break;
      default:
        // Only log unhandled messages in development mode
        if (process.env.NODE_ENV === 'development') {
        }
    }
  }
  
  function handleNotificationMessage(message: WebSocketMessage) {
    // Support both payload and data formats for compatibility
    const msgData = (message as any).payload || message.data;
    
    const notification: NotificationData = {
      id: message.id || `notif_${Date.now()}`,
      type: msgData?.type || 'info',
      title: msgData?.title || 'Notification',
      message: msgData?.message || msgData?.content || '',
      timestamp: new Date(message.timestamp || Date.now()),
      read: false,
      actions: msgData?.actions,
    };
    
    setNotifications(prev => [notification, ...prev]);
    
    // Notify subscribers
    subscriptions.notifications.forEach(callback => callback(notification));
    
    // Show browser notification if supported and permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: BRAND.logo,
        tag: notification.id,
      });
    }
  }
  
  function handleDashboardUpdate(message: WebSocketMessage) {
    // Support both payload and data formats for compatibility
    const msgData = (message as any).payload || message.data;
    
    const metrics: DashboardMetrics = {
      pitchViews: msgData?.pitchViews || msgData?.metrics?.pitchViews || 0,
      totalRevenue: msgData?.totalRevenue || msgData?.metrics?.totalRevenue || 0,
      activeInvestors: msgData?.activeInvestors || msgData?.metrics?.activeInvestors || 0,
      newMessages: msgData?.newMessages || msgData?.metrics?.newMessages || 0,
      lastUpdated: new Date(msgData?.timestamp || message.timestamp || Date.now()),
    };
    
    setDashboardMetrics(metrics);
    
    // Notify subscribers
    subscriptions.dashboard.forEach(callback => callback(metrics));
  }
  
  function handlePresenceUpdate(message: WebSocketMessage) {
    // Support both payload and data formats for compatibility
    const msgData = (message as any).payload || message.data;
    
    const presenceData: PresenceData = {
      userId: msgData?.userId,
      username: msgData?.username,
      status: msgData?.status || 'offline',
      lastSeen: new Date(msgData?.lastSeen || msgData?.timestamp || Date.now()),
      activity: msgData?.activity,
    };
    
    setOnlineUsers(prev => {
      const filtered = prev.filter(user => user.userId !== presenceData.userId);
      if (presenceData.status !== 'offline') {
        return [...filtered, presenceData];
      }
      return filtered;
    });
    
    // Notify subscribers
    subscriptions.presence.forEach(callback => callback(onlineUsers));
  }
  
  function handleTypingIndicator(message: WebSocketMessage) {
    // Support both payload and data formats for compatibility
    const msgData = (message as any).payload || message.data;
    
    const typingData: TypingData = {
      conversationId: msgData?.conversationId,
      userId: msgData?.userId,
      username: msgData?.username,
      isTyping: msgData?.isTyping !== undefined ? msgData?.isTyping : true,
    };
    
    setTypingIndicators(prev => {
      const filtered = prev.filter(
        t => !(t.conversationId === typingData.conversationId && t.userId === typingData.userId)
      );
      
      if (typingData.isTyping) {
        return [...filtered, typingData];
      }
      return filtered;
    });
    
    // Notify conversation-specific subscribers
    const conversationSubs = subscriptions.typing.get(typingData.conversationId);
    if (conversationSubs) {
      const conversationTyping = typingIndicators.filter(
        t => t.conversationId === typingData.conversationId
      );
      conversationSubs.forEach(callback => callback(conversationTyping));
    }
  }
  
  function handleUploadProgress(message: WebSocketMessage) {
    const progressData: UploadProgress = {
      uploadId: message.data?.uploadId,
      filename: message.data?.filename,
      progress: message.data?.progress || 0,
      status: message.data?.status || 'uploading',
      error: message.data?.error,
    };
    
    setUploadProgress(prev => {
      const filtered = prev.filter(u => u.uploadId !== progressData.uploadId);
      return [...filtered, progressData];
    });
    
    // Notify subscribers
    subscriptions.uploads.forEach(callback => callback(uploadProgress));
    
    // Auto-remove completed/errored uploads after 5 seconds
    if (progressData.status === 'completed' || progressData.status === 'error') {
      setTimeout(() => {
        setUploadProgress(prev => prev.filter(u => u.uploadId !== progressData.uploadId));
      }, 5000);
    }
  }
  
  function handlePitchView(message: WebSocketMessage) {
    const viewData: PitchViewData = {
      pitchId: message.data?.pitchId,
      viewCount: message.data?.viewCount || 0,
      uniqueViewers: message.data?.uniqueViewers || 0,
      recentViewers: message.data?.recentViewers || [],
    };
    
    setPitchViews(prev => new Map(prev.set(viewData.pitchId, viewData)));
    
    // Notify pitch-specific subscribers
    const pitchSubs = subscriptions.pitchViews.get(viewData.pitchId);
    if (pitchSubs) {
      pitchSubs.forEach(callback => callback(viewData));
    }
  }

  function handleNDAStatusUpdate(message: WebSocketMessage) {
    const updateData: NDAStatusUpdate = {
      ndaId: message.data?.ndaId,
      pitchId: message.data?.pitchId,
      status: message.data?.status,
      previousStatus: message.data?.previousStatus,
      creatorName: message.data?.creatorName,
      requesterName: message.data?.requesterName,
      pitchTitle: message.data?.pitchTitle,
      timestamp: message.data?.timestamp ? new Date(message.data.timestamp) : new Date(),
      reason: message.data?.reason,
      notes: message.data?.notes,
      read: false,
    };
    
    // Add to NDA updates list (keep only recent 50 updates)
    setNDAUpdates(prev => {
      const newUpdates = [updateData, ...prev];
      return newUpdates.slice(0, 50);
    });
    
    // Notify subscribers
    subscriptions.ndaUpdates.forEach(callback => callback(updateData));
    
    // Create a user notification based on the update
    const isCreator = user?.userType === 'creator';
    const isRequester = !isCreator;
    
    let notificationTitle = '';
    let notificationMessage = '';
    let notificationType: 'info' | 'success' | 'warning' | 'error' = 'info';
    
    switch (updateData.status) {
      case 'pending':
        if (isCreator) {
          notificationTitle = 'New NDA Request';
          notificationMessage = `${updateData.requesterName || 'Someone'} requested access to "${updateData.pitchTitle}"`;
          notificationType = 'info';
        }
        break;
      case 'approved':
        if (isRequester) {
          notificationTitle = 'NDA Approved';
          notificationMessage = `Your access request for "${updateData.pitchTitle}" has been approved`;
          notificationType = 'success';
        }
        break;
      case 'rejected':
        if (isRequester) {
          notificationTitle = 'NDA Rejected';
          notificationMessage = `Your access request for "${updateData.pitchTitle}" was rejected`;
          if (updateData.reason) {
            notificationMessage += `: ${updateData.reason}`;
          }
          notificationType = 'error';
        }
        break;
      case 'signed':
        if (isCreator) {
          notificationTitle = 'NDA Signed';
          notificationMessage = `${updateData.requesterName} has signed the NDA for "${updateData.pitchTitle}"`;
          notificationType = 'success';
        }
        break;
      case 'expired':
        notificationTitle = 'NDA Expired';
        notificationMessage = `The NDA for "${updateData.pitchTitle}" has expired`;
        notificationType = 'warning';
        break;
      case 'revoked':
        if (isRequester) {
          notificationTitle = 'NDA Revoked';
          notificationMessage = `Your access to "${updateData.pitchTitle}" has been revoked`;
          if (updateData.reason) {
            notificationMessage += `: ${updateData.reason}`;
          }
          notificationType = 'warning';
        }
        break;
    }
    
    // Add notification if relevant to this user
    if (notificationTitle) {
      const notification: NotificationData = {
        id: `nda-${updateData.ndaId}-${Date.now()}`,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        timestamp: updateData.timestamp,
        read: false,
        actions: updateData.status === 'approved' && isRequester ? [
          {
            label: 'View Details',
            action: () => {
              // Navigate to pitch detail
              window.location.href = `/pitch/${updateData.pitchId}`;
            },
            type: 'primary'
          }
        ] : updateData.status === 'pending' && isCreator ? [
          {
            label: 'Review',
            action: () => {
              // Navigate to NDA management
              window.location.href = `/creator/nda-management`;
            },
            type: 'primary'
          }
        ] : undefined
      };
      
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      
      // Notify notification subscribers
      subscriptions.notifications.forEach(callback => callback(notification));
    }
  }
  
  function handleChatMessage(message: WebSocketMessage) {
    // Handle real-time chat messages
    const chatData = (message as any).payload || message.data;
    
    if (chatData?.conversationId && chatData?.senderId && chatData?.content) {
      // Create a notification for the chat message
      const chatNotification: NotificationData = {
        id: `chat_${Date.now()}_${chatData.senderId}`,
        type: 'info',
        title: 'New Message',
        message: `${chatData.senderName || 'Someone'}: ${chatData.content.substring(0, 100)}${chatData.content.length > 100 ? '...' : ''}`,
        timestamp: new Date(chatData.timestamp || Date.now()),
        read: false,
        actions: [{
          label: 'View Conversation',
          action: () => {
            // Navigate to conversation - this would be implemented based on your routing
          },
          type: 'primary'
        }]
      };
      
      setNotifications(prev => [chatNotification, ...prev]);
      
      // Notify subscribers
      subscriptions.notifications.forEach(callback => callback(chatNotification));
      
      // Show browser notification if permitted and user is not in conversation
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(chatNotification.title, {
          body: chatNotification.message,
          icon: '/favicon.ico',
          tag: `chat_${chatData.conversationId}` // Prevent duplicate notifications
        });
      }
    }
    
    // Emit general message for chat-specific hooks
    subscriptions.messages.forEach(callback => callback(message));
  }
  
  function handleConnect() {
    setUsingFallback(false); // We're now using WebSocket successfully

    // Stop polling services — WebSocket is active, no need for fallback traffic
    pollingService.stop();
    presenceFallbackService.stop();

    // Update presence to online when connected
    if (user) {
      updatePresence('online');
    }
    
    // Subscribe to user-specific channels
    if (user?.id) {
      // Subscribe to user's notification channel
      wsSendMessage({
        type: 'subscribe',
        data: {
          channelId: `user_${user.id}_notifications`
        }
      });
      
      // Subscribe to user's dashboard updates
      wsSendMessage({
        type: 'subscribe', 
        data: {
          channelId: `user_${user.id}_dashboard`
        }
      });
      
      // Subscribe to general presence updates
      wsSendMessage({
        type: 'subscribe',
        data: {
          channelId: `presence_updates`
        }
      });
      
      // Subscribe to draft sync updates
      wsSendMessage({
        type: 'subscribe',
        data: {
          channelId: `user_${user.id}_drafts`
        }
      });
    }
    
    // Request initial data with enhanced format
    wsSendMessage({
      type: 'request_initial_data',
      data: {
        includeDashboard: true,
        includePresence: true,
        includeNotifications: true,
        clientVersion: '2.0', // Indicate enhanced client
      },
    });
  }
  
  function handleDisconnect() {

    // Update local state to reflect disconnection
    setOnlineUsers(prev => prev.filter(u => u.userId !== user?.id));
    
    // Enhanced circuit breaker for bundling-induced loops
    const recentAttempts = connectionStatus.reconnectAttempts;
    if (recentAttempts >= 5) { // Increased threshold for enhanced service
      console.warn(`🚨 WebSocket reconnection loop detected (${recentAttempts} attempts). Falling back to polling.`);
      setTimeout(() => {
        setUsingFallback(true);
        localStorage.setItem('pitchey_websocket_fallback', 'true');
        localStorage.setItem('pitchey_websocket_loop_detected', Date.now().toString());
        
        // Start enhanced polling service when WebSocket consistently fails
        if (isAuthenticated) {
          pollingService.start();
          presenceFallbackService.start();
        }
      }, 1000);
    } else if (recentAttempts >= 4) {
      // Enable fallback after sustained WebSocket failure but keep trying
      if (!usingFallback) {
        setUsingFallback(true);
        pollingService.start();
      }
    }
  }
  
  // Enhanced error handler
  function handleError(error: Event) {
    // Serialize Event/ErrorEvent to a string so Sentry doesn't log [object Object]
    const errorMsg = error instanceof ErrorEvent
      ? `message=${error.message}, filename=${error.filename}, lineno=${error.lineno}`
      : `type=${error.type}, eventPhase=${error.eventPhase}`;
    console.error(`[WebSocketContext] WebSocket error: ${errorMsg}`);
    
    // Create user-friendly error notification
    const errorNotification: NotificationData = {
      id: `error_${Date.now()}`,
      type: 'error',
      title: 'Connection Error',
      message: 'Real-time connection encountered an error. Reconnecting automatically...',
      timestamp: new Date(),
      read: false,
    };
    
    setNotifications(prev => [errorNotification, ...prev.slice(0, 49)]);
    
    // Notify subscribers
    subscriptions.notifications.forEach(callback => callback(errorNotification));
  }
  
  // Reconnection handler
  function handleReconnect(attempt: number) {
    
    // Show reconnection notification for long reconnection attempts
    if (attempt > 3) {
      const reconnectNotification: NotificationData = {
        id: `reconnect_${Date.now()}`,
        type: 'warning',
        title: 'Reconnecting',
        message: `Attempting to reconnect... (attempt ${attempt})`,
        timestamp: new Date(),
        read: false,
      };
      
      setNotifications(prev => [reconnectNotification, ...prev.slice(0, 49)]);
      subscriptions.notifications.forEach(callback => callback(reconnectNotification));
    }
  }
  
  // Connection quality change handler
  function handleConnectionQualityChange(quality: ConnectionQuality) {
    // Provide user feedback for poor connection quality
    if (quality.strength === 'poor' && quality.consecutiveFailures > 2) {
      const qualityNotification: NotificationData = {
        id: `quality_${Date.now()}`,
        type: 'warning',
        title: 'Poor Connection',
        message: 'Real-time features may be delayed due to poor connection quality.',
        timestamp: new Date(),
        read: false,
      };
      
      setNotifications(prev => [qualityNotification, ...prev.slice(0, 49)]);
      subscriptions.notifications.forEach(callback => callback(qualityNotification));
    }
    
    // Automatically enable fallback for consistently poor connections
    if (quality.strength === 'poor' && quality.consecutiveFailures >= 5) {
      console.warn('[WebSocketContext] Switching to fallback mode due to poor connection quality');
      setUsingFallback(true);
      
      // Start fallback services
      if (isAuthenticated) {
        pollingService.start();
        presenceFallbackService.start();
      }
    }
  }
  
  // Public methods
  const sendMessage = useCallback((message: WebSocketMessage) => {
    return wsSendMessage(message);
  }, [wsSendMessage]);
  
  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
    
    sendMessage({
      type: 'notification_read',
      data: { notificationId: id },
    });
  }, [sendMessage]);
  
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    sendMessage({
      type: 'notifications_clear_all',
    });
  }, [sendMessage]);
  
  const updatePresence = useCallback(async (status: PresenceData['status'], activity?: string) => {
    // Try WebSocket first
    if (isConnected && !usingFallback) {
      sendMessage({
        type: 'presence_update',
        data: { status, activity },
      });
    } else {
      // Use fallback service
      await presenceFallbackService.updatePresence({ status, activity });
    }
  }, [sendMessage, isConnected, usingFallback]);
  
  const startTyping = useCallback((conversationId: number) => {
    sendMessage({
      type: 'typing',
      data: { conversationId, isTyping: true },
    });
  }, [sendMessage]);
  
  const stopTyping = useCallback((conversationId: number) => {
    sendMessage({
      type: 'typing',
      data: { conversationId, isTyping: false },
    });
  }, [sendMessage]);
  
  const trackPitchView = useCallback((pitchId: number) => {
    sendMessage({
      type: 'pitch_view_update',
      data: { pitchId },
    });
  }, [sendMessage]);
  
  // NDA-specific action methods
  const subscribeToNDAUpdates = useCallback((callback: (update: NDAStatusUpdate) => void) => {
    subscriptions.ndaUpdates.add(callback);
    
    // Return unsubscribe function
    return () => {
      subscriptions.ndaUpdates.delete(callback);
    };
  }, [subscriptions.ndaUpdates]);
  
  const markNDAUpdateAsRead = useCallback((ndaId: number) => {
    setNDAUpdates(prev => 
      prev.map(update => 
        update.ndaId === ndaId 
          ? { ...update, read: true } 
          : update
      )
    );
  }, []);
  
  const clearNDAUpdates = useCallback(() => {
    setNDAUpdates([]);
  }, []);
  
  // Subscription methods
  const subscribeToNotifications = useCallback((callback: (notification: NotificationData) => void) => {
    subscriptions.notifications.add(callback);
    return () => subscriptions.notifications.delete(callback);
  }, []);

  const subscribeToMessages = useCallback((callback: (message: WebSocketMessage) => void) => {
    subscriptions.messages.add(callback);
    return () => subscriptions.messages.delete(callback);
  }, []);
  
  const subscribeToDashboard = useCallback((callback: (metrics: DashboardMetrics) => void) => {
    subscriptions.dashboard.add(callback);
    return () => subscriptions.dashboard.delete(callback);
  }, []);
  
  const subscribeToPresence = useCallback((callback: (users: PresenceData[]) => void) => {
    subscriptions.presence.add(callback);
    return () => subscriptions.presence.delete(callback);
  }, []);
  
  const subscribeToTyping = useCallback((
    conversationId: number, 
    callback: (typing: TypingData[]) => void
  ) => {
    if (!subscriptions.typing.has(conversationId)) {
      subscriptions.typing.set(conversationId, new Set());
    }
    subscriptions.typing.get(conversationId)!.add(callback);
    
    return () => {
      const subs = subscriptions.typing.get(conversationId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          subscriptions.typing.delete(conversationId);
        }
      }
    };
  }, []);
  
  const subscribeToUploads = useCallback((callback: (uploads: UploadProgress[]) => void) => {
    subscriptions.uploads.add(callback);
    return () => subscriptions.uploads.delete(callback);
  }, []);
  
  const subscribeToPitchViews = useCallback((
    pitchId: number, 
    callback: (data: PitchViewData) => void
  ) => {
    if (!subscriptions.pitchViews.has(pitchId)) {
      subscriptions.pitchViews.set(pitchId, new Set());
    }
    subscriptions.pitchViews.get(pitchId)!.add(callback);
    
    return () => {
      const subs = subscriptions.pitchViews.get(pitchId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          subscriptions.pitchViews.delete(pitchId);
        }
      }
    };
  }, []);
  
  // Handle authentication state changes and portal switches
  useEffect(() => {
    // Check for portal type change (cross-portal authentication issue fix)
    const currentUserType = localStorage.getItem('userType');
    
    // If user type changed, we're switching portals - disconnect WebSocket to prevent conflicts
    if (previousUserType.current && currentUserType && previousUserType.current !== currentUserType) {
      disconnect();
      
      // Clear all real-time data for portal switch
      setNotifications([]);
      setDashboardMetrics(null);
      setOnlineUsers([]);
      setTypingIndicators([]);
      setUploadProgress([]);
      setPitchViews(new Map());
      
      // Stop fallback services
      if (usingFallback) {
        presenceFallbackService.stop();
        pollingService.stop();
        setUsingFallback(false);
      }
      
      // Allow time for cleanup before reconnecting
      setTimeout(() => {
        if (authStabilized && isAuthenticated && !isWebSocketDisabled && config.WEBSOCKET_ENABLED) {
          connect();
        }
      }, 1000);
    }
    
    previousUserType.current = currentUserType;
    
    if (authStabilized && isAuthenticated && !isConnected && !isWebSocketDisabled && config.WEBSOCKET_ENABLED) {
      connect();
    } else if (!isAuthenticated && isConnected) {
      disconnect();
      // Clear all real-time data when user logs out
      setNotifications([]);
      setDashboardMetrics(null);
      setOnlineUsers([]);
      setTypingIndicators([]);
      setUploadProgress([]);
      setPitchViews(new Map());
      
      // Stop fallback services
      if (usingFallback) {
        presenceFallbackService.stop();
        pollingService.stop();
        setUsingFallback(false);
      }
    } else if (isAuthenticated && (isWebSocketDisabled || !config.WEBSOCKET_ENABLED)) {
      // Start fallback service if WebSocket is disabled but user is authenticated
      if (!usingFallback) {
        setUsingFallback(true);
        
        // Start presence fallback service
        presenceFallbackService.start();
        
        // Subscribe to fallback presence updates
        presenceFallbackService.subscribe((users) => {
          setOnlineUsers(users.map(user => ({
            ...user,
            lastSeen: new Date(user.lastSeen)
          })));
        });
        
        // Start polling service for notifications and real-time updates
        pollingService.start();
        
        // Add message handler for polling responses
        pollingService.addMessageHandler(handleMessage);
      }
    }
  }, [authStabilized, isAuthenticated, isConnected, isWebSocketDisabled, usingFallback]); // Added authStabilized and other deps
  
  // Emergency control functions
  const disableWebSocket = useCallback(() => {
    setIsWebSocketDisabled(true);
    disconnect();
    localStorage.setItem('pitchey_websocket_disabled', 'true');
  }, [disconnect]);

  const enableWebSocket = useCallback(() => {
    setIsWebSocketDisabled(false);
    localStorage.removeItem('pitchey_websocket_disabled');
    if (isAuthenticated && config.WEBSOCKET_ENABLED) {
      setTimeout(connect, 1000); // Small delay before reconnecting
    }
  }, [connect, isAuthenticated]);

  // Check if WebSocket was manually disabled or loop detected
  useEffect(() => {
    const wasDisabled = localStorage.getItem('pitchey_websocket_disabled') === 'true';
    const loopDetected = localStorage.getItem('pitchey_websocket_loop_detected');
    
    if (wasDisabled) {
      setIsWebSocketDisabled(true);
    }
    
    // Auto-recover from loop detection after 5 minutes
    if (loopDetected) {
      const detectedTime = parseInt(loopDetected);
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      
      if (detectedTime < fiveMinutesAgo) {
        localStorage.removeItem('pitchey_websocket_loop_detected');
      } else {
        setIsWebSocketDisabled(true);
      }
    }
  }, []);

  // Function to request notification permission (must be called from user interaction)
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        return permission;
      } catch (error) {
        console.warn('Failed to request notification permission:', error);
        return 'denied';
      }
    }
    return Notification.permission;
  }, []);
  
  const contextValue: WebSocketContextType = {
    // Enhanced connection state
    connectionStatus,
    queueStatus,
    isConnected,
    isReconnecting,
    isDisconnecting,
    
    // Connection quality and reliability
    connectionQuality,
    retryCount,
    isHealthy,
    
    // Real-time data
    notifications,
    dashboardMetrics,
    onlineUsers,
    typingIndicators,
    uploadProgress,
    pitchViews,
    ndaUpdates,
    
    // Actions
    sendMessage,
    markNotificationAsRead,
    clearAllNotifications,
    updatePresence,
    startTyping,
    stopTyping,
    trackPitchView,
    
    // NDA-specific actions
    subscribeToNDAUpdates,
    markNDAUpdateAsRead,
    clearNDAUpdates,
    
    // Enhanced connection control
    connect,
    disconnect,
    manualReconnect,
    clearQueue,
    
    // Emergency controls
    disableWebSocket,
    enableWebSocket,
    isWebSocketDisabled,
    
    // Subscriptions
    subscribeToNotifications,
    subscribeToDashboard,
    subscribeToPresence,
    subscribeToTyping,
    subscribeToUploads,
    subscribeToPitchViews,
    subscribeToMessages,
    
    // Notification permission
    requestNotificationPermission,
    
    // Debug and monitoring
    getConnectionStats: getStats,
  };
  
  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Safe default values for when WebSocket provider is not yet available
const safeWebSocketDefaults: WebSocketContextType = {
  isConnected: false,
  connectionStatus: { status: 'disconnected', reconnectAttempts: 0 } as unknown as ConnectionStatus,
  queueStatus: { pending: 0, failed: 0, sent: 0 } as unknown as MessageQueueStatus,
  isReconnecting: false,
  isDisconnecting: false,
  connectionQuality: { strength: 'unknown', latency: 0, consecutiveFailures: 0 } as unknown as ConnectionQuality,
  retryCount: 0,
  isHealthy: false,
  notifications: [],
  dashboardMetrics: null,
  onlineUsers: [],
  typingIndicators: [],
  uploadProgress: [],
  pitchViews: new Map(),
  ndaUpdates: [],
  sendMessage: () => false,
  markNotificationAsRead: () => {},
  clearAllNotifications: () => {},
  updatePresence: () => {},
  startTyping: () => {},
  stopTyping: () => {},
  trackPitchView: () => {},
  subscribeToNDAUpdates: () => () => {},
  markNDAUpdateAsRead: () => {},
  clearNDAUpdates: () => {},
  connect: () => {},
  disconnect: () => {},
  manualReconnect: () => {},
  clearQueue: () => {},
  disableWebSocket: () => {},
  enableWebSocket: () => {},
  isWebSocketDisabled: true,
  subscribeToNotifications: () => () => {},
  subscribeToDashboard: () => () => {},
  subscribeToPresence: () => () => {},
  subscribeToTyping: () => () => {},
  subscribeToUploads: () => () => {},
  subscribeToPitchViews: () => () => {},
  subscribeToMessages: () => () => {},
  requestNotificationPermission: async () => 'denied' as NotificationPermission,
  getConnectionStats: () => ({}),
};

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  // Return safe defaults if provider not available (e.g., during auth loading)
  if (!context) {
    return safeWebSocketDefaults;
  }
  return context;
}

// Convenience hooks for specific features
export function useNotifications() {
  const { notifications, markNotificationAsRead, clearAllNotifications, subscribeToNotifications } = useWebSocket();
  return { notifications, markNotificationAsRead, clearAllNotifications, subscribeToNotifications };
}

export function useDashboardMetrics() {
  const { dashboardMetrics, subscribeToDashboard } = useWebSocket();
  return { dashboardMetrics, subscribeToDashboard };
}

export function usePresence() {
  const { onlineUsers, updatePresence, subscribeToPresence } = useWebSocket();
  return { onlineUsers, updatePresence, subscribeToPresence };
}

export function useTyping(conversationId: number) {
  const { startTyping, stopTyping, subscribeToTyping } = useWebSocket();
  
  const startTypingForConversation = useCallback(() => {
    startTyping(conversationId);
  }, [conversationId, startTyping]);
  
  const stopTypingForConversation = useCallback(() => {
    stopTyping(conversationId);
  }, [conversationId, stopTyping]);
  
  return { 
    startTyping: startTypingForConversation, 
    stopTyping: stopTypingForConversation, 
    subscribeToTyping: (callback: (typing: any[]) => void) => subscribeToTyping(conversationId, callback)
  };
}

export function useUploadProgress() {
  const { uploadProgress, subscribeToUploads } = useWebSocket();
  return { uploadProgress, subscribeToUploads };
}

export function usePitchViews(pitchId: number) {
  const { pitchViews, trackPitchView, subscribeToPitchViews } = useWebSocket();
  
  const trackView = useCallback(() => {
    trackPitchView(pitchId);
  }, [pitchId, trackPitchView]);
  
  const pitchData = pitchViews.get(pitchId);
  
  return { 
    pitchData, 
    trackView, 
    subscribeToViews: (callback: (data: any) => void) => subscribeToPitchViews(pitchId, callback)
  };
}

export function useNDAUpdates() {
  const { 
    ndaUpdates, 
    subscribeToNDAUpdates, 
    markNDAUpdateAsRead, 
    clearNDAUpdates 
  } = useWebSocket();
  
  const unreadCount = useMemo(() => {
    return ndaUpdates.filter(update => !update.read).length;
  }, [ndaUpdates]);
  
  const getUpdatesForPitch = useCallback((pitchId: number) => {
    return ndaUpdates.filter(update => update.pitchId === pitchId);
  }, [ndaUpdates]);
  
  const getUpdatesForNDA = useCallback((ndaId: number) => {
    return ndaUpdates.filter(update => update.ndaId === ndaId);
  }, [ndaUpdates]);
  
  return {
    ndaUpdates,
    unreadCount,
    subscribeToNDAUpdates,
    markNDAUpdateAsRead,
    clearNDAUpdates,
    getUpdatesForPitch,
    getUpdatesForNDA
  };
}