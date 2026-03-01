import { useEffect, useRef, useState, useCallback } from 'react';
import { notificationService } from '../services/notification.service';
import { getUserId } from '../lib/apiServices';
import { useWebSocket as useWebSocketContext } from '@shared/contexts/WebSocketContext';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    reconnectInterval = 5000,
  } = options;

  // Use the WebSocketContext instead of creating a new connection
  const { isConnected, sendMessage: contextSendMessage, subscribeToMessages } = useWebSocketContext();
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const callbacksRef = useRef({ onMessage, onConnect, onDisconnect });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onMessage, onConnect, onDisconnect };
  }, [onMessage, onConnect, onDisconnect]);

  // Handle connection state changes
  useEffect(() => {
    if (isConnected) {
      callbacksRef.current.onConnect?.();
    } else {
      callbacksRef.current.onDisconnect?.();
    }
  }, [isConnected]);

  const connect = useCallback(() => {
    // The WebSocketContext handles connection automatically
    // This is here for compatibility but does nothing
  }, []);

  const disconnect = useCallback(() => {
    // The WebSocketContext handles disconnection
    // This is here for compatibility but does nothing
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    // Delegate to the WebSocketContext
    return contextSendMessage(message);
  }, [contextSendMessage]);

  // Subscribe to WebSocket messages from context
  useEffect(() => {
    const unsubscribe = subscribeToMessages((message: WebSocketMessage) => {
      setLastMessage(message);
      if (callbacksRef.current.onMessage) {
        callbacksRef.current.onMessage(message);
      }
    });
    
    return unsubscribe;
  }, [subscribeToMessages]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
  };
}

// Specific hooks for different features
export function usePitchUpdates(pitchId: number) {
  const [views, setViews] = useState(0);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const { sendMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.pitchId !== pitchId) return;
      
      switch (message.type) {
        case 'pitch_viewed':
          setViews(v => v + 1);
          break;
        case 'pitch_liked':
          setLikes(l => l + 1);
          break;
        case 'new_comment':
          setComments(c => [...c, {
            username: message.username,
            comment: message.comment,
            timestamp: message.timestamp,
          }]);
          break;
        case 'user_typing':
          if (message.isTyping) {
            setTypingUsers(users => [...users, message.username]);
          } else {
            setTypingUsers(users => users.filter(u => u !== message.username));
          }
          break;
      }
    },
  });

  const trackView = () => {
    sendMessage({ type: 'pitch_view', pitchId });
  };

  const trackLike = () => {
    sendMessage({ type: 'pitch_like', pitchId });
  };

  const sendComment = (comment: string) => {
    sendMessage({ type: 'pitch_comment', pitchId, comment });
  };

  const setTyping = (isTyping: boolean) => {
    sendMessage({ type: 'typing', pitchId, isTyping });
  };

  return {
    views,
    likes,
    comments,
    typingUsers,
    trackView,
    trackLike,
    sendComment,
    setTyping,
  };
}

// Hook for messaging with real-time features
export function useMessaging() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentMessages, setCurrentMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ [conversationId: number]: string[] }>({});
  const [onlineUsers, setOnlineUsers] = useState<{ [userId: number]: boolean }>({});
  const [unreadCounts, setUnreadCounts] = useState<{ [conversationId: number]: number }>({});

  const { sendMessage, isConnected } = useWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case 'new_message':
          // Add new message to current conversation if it matches
          if (message.conversationId) {
            setCurrentMessages(prev => {
              const existing = prev.find(m => m.id === message.messageId);
              if (!existing) {
                return [...prev, {
                  id: message.messageId,
                  conversationId: message.conversationId,
                  senderId: message.senderId,
                  senderName: message.senderName,
                  content: message.content,
                  timestamp: message.timestamp,
                  delivered: true,
                }];
              }
              return prev;
            });
          }

          // Update conversation list
          setConversations(prev => prev.map(conv => 
            conv.id === message.conversationId
              ? { 
                  ...conv, 
                  lastMessage: {
                    content: message.content,
                    timestamp: message.timestamp,
                    senderName: message.senderName,
                  },
                  lastMessageAt: message.timestamp,
                }
              : conv
          ));

          // Update unread count and show notification if message is not from current user
          const currentUserId = getUserId();
          if (message.senderId !== parseInt(currentUserId || '0')) {
            setUnreadCounts(prev => ({
              ...prev,
              [message.conversationId]: (prev[message.conversationId] || 0) + 1,
            }));

            // Show notification for new message
            notificationService.notifyNewMessage(
              message.senderName || 'Unknown User',
              message.content,
              message.conversationId
            );
          }
          break;

        case 'message_read':
          // Update message as read
          setCurrentMessages(prev => prev.map(msg =>
            msg.id === message.messageId
              ? { ...msg, isRead: true, readAt: message.readAt }
              : msg
          ));

          // Show read receipt notification (silent)
          if (message.readByName) {
            notificationService.notifyMessageRead(message.messageId, message.readByName);
          }
          break;

        case 'user_typing':
          if (message.conversationId) {
            setTypingUsers(prev => {
              const conversationTyping = prev[message.conversationId] || [];
              if (message.isTyping) {
                return {
                  ...prev,
                  [message.conversationId]: [...conversationTyping.filter(u => u !== message.username), message.username],
                };
              } else {
                return {
                  ...prev,
                  [message.conversationId]: conversationTyping.filter(u => u !== message.username),
                };
              }
            });
          }
          break;

        case 'user_online':
          setOnlineUsers(prev => ({ ...prev, [message.userId]: true }));
          
          // Show user online notification (silent)
          if (message.username) {
            notificationService.notifyUserOnline(message.username);
          }
          break;

        case 'user_offline':
          setOnlineUsers(prev => ({ ...prev, [message.userId]: false }));
          break;
          
        case 'message_sent':
          // Update the temporary message with the confirmed ID and mark as delivered
          if (message.messageId && message.conversationId) {
            setCurrentMessages(prev => prev.map(msg => {
              // Find the temporary message (has timestamp close to the confirmed one)
              const msgTime = new Date(msg.timestamp).getTime();
              const confirmTime = new Date(message.timestamp).getTime();
              const timeDiff = Math.abs(msgTime - confirmTime);
              
              // If within 5 seconds and same conversation, it's likely our message
              if (msg.conversationId === message.conversationId && timeDiff < 5000 && !msg.delivered) {
                return {
                  ...msg,
                  id: message.messageId,
                  delivered: true,
                };
              }
              return msg;
            }));
          }
          break;
      }
    },
  });

  // getCurrentUserId function removed - now using centralized getUserId from apiServices

  const sendChatMessage = (conversationId: number, content: string, recipientId?: number) => {
    const requestId = `msg_${Date.now()}_${Math.random()}`;
    sendMessage({
      type: 'send_message',
      conversationId,
      content,
      recipientId,
      requestId,
    });
  };

  const markMessageAsRead = (messageId: number) => {
    sendMessage({
      type: 'mark_read',
      messageId,
    });
  };

  const startTyping = (conversationId: number) => {
    sendMessage({
      type: 'typing_start',
      conversationId,
    });
  };

  const stopTyping = (conversationId: number) => {
    sendMessage({
      type: 'typing_stop',
      conversationId,
    });
  };

  const joinConversation = (conversationId: number) => {
    sendMessage({
      type: 'join_conversation',
      conversationId,
    });
  };

  const markConversationAsRead = (conversationId: number) => {
    setUnreadCounts(prev => ({ ...prev, [conversationId]: 0 }));
  };

  return {
    conversations,
    setConversations,
    currentMessages,
    setCurrentMessages,
    typingUsers,
    onlineUsers,
    unreadCounts,
    isConnected,
    sendChatMessage,
    markMessageAsRead,
    startTyping,
    stopTyping,
    joinConversation,
    markConversationAsRead,
  };
}

// Hook for notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useWebSocket({
    onMessage: (message) => {
      if (message.type === 'nda_signed') {
        setNotifications(n => [...n, {
          type: 'nda',
          message: `${message.signedBy} signed an NDA for your pitch`,
          timestamp: message.timestamp,
          pitchId: message.pitchId,
        }]);
      }
    },
  });

  const clearNotifications = () => {
    setNotifications([]);
  };

  return {
    notifications,
    clearNotifications,
  };
}