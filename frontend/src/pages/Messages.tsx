import { useState, useEffect, useRef, useCallback, type ChangeEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send, Search, Filter, MessageSquare, Paperclip, MoreVertical,
  RefreshCw, Users, Circle, Smile, FileText, Image, Video, Music,
  Lock, Unlock, Check, CheckCheck, Clock, X, WifiOff
} from 'lucide-react';
import { useMessaging } from '../hooks/useWebSocket';
import { getUserId } from '../lib/apiServices';
import { apiClient } from '../lib/api-client';
import { getCreditCost } from '../config/subscription-plans';
import { useBetterAuthStore } from '../store/betterAuthStore';

// Enhanced message and conversation interfaces
interface EnhancedMessage {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderType: 'investor' | 'production' | 'creator';
  content: string;
  message: string; // Alias for content
  timestamp: string; // Alias for sentAt
  isRead: boolean; // Computed from readReceipts
  hasAttachment: boolean; // Computed from attachments
  delivered?: boolean;
  reactions?: Array<{ type: string; users: string[]; count: number }>;
  isEncrypted?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

interface EnhancedConversation {
  id: number;
  participantName: string;
  participantType: 'investor' | 'production' | 'creator';
  lastMessageText?: string;
  timestamp: string;
  isOnline?: boolean;
  hasUnreadMessages?: boolean;
  pitchTitle?: string;
  unreadCount?: number;
}

export default function Messages() {
  const { user } = useBetterAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get messaging cost for creators
  const messageCost = getCreditCost('send_message');
  const isCreator = user?.userType === 'creator';
  const isFreeForUser = !isCreator;
  
  // State management
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [notifications, setNotifications] = useState<{message: string, type: 'success' | 'error', id: number}[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<EnhancedMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isEncryptionEnabled, setIsEncryptionEnabled] = useState(false);
  const [conversations, setConversations] = useState<EnhancedConversation[]>([]);
  const [currentMessages, setCurrentMessages] = useState<EnhancedMessage[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Enhanced messaging hook (simplified - useMessaging doesn't take params)
  const {
    conversations: hookConversations,
    currentMessages: hookMessages,
    typingUsers,
    onlineUsers,
    unreadCounts,
    isConnected,
    sendChatMessage,
    startTyping: hookStartTyping,
    stopTyping: hookStopTyping,
    joinConversation,
    markConversationAsRead: hookMarkConversationAsRead
  } = useMessaging();

  // REST-based initial conversation fetch (fallback when WebSocket is slow)
  useEffect(() => {
    let cancelled = false;
    const fetchConversations = async () => {
      try {
        const res = await apiClient.get<{ conversations: Array<Record<string, unknown>> }>('/api/conversations');
        if (cancelled || !res.success || !res.data?.conversations) return;
        // Only merge if hook hasn't loaded yet
        if (!hookConversations || hookConversations.length === 0) {
          const convs = res.data.conversations.map((conv: Record<string, unknown>) => {
            const convId = conv.id as number;
            return {
              ...conv,
              id: convId,
              participantName: (conv.participant_name as string) || (conv.participantName as string) || 'Unknown',
              participantType: ((conv.participant_type as string) || (conv.participantType as string) || 'creator') as 'investor' | 'production' | 'creator',
              lastMessageText: (conv.last_message as string) || '',
              timestamp: (conv.updated_at as string) || new Date().toISOString(),
              isOnline: false,
              hasUnreadMessages: false,
              unreadCount: 0,
            };
          });
          setConversations(convs);
          setLoading(false);
        }
      } catch {
        // Non-critical — WebSocket will provide data
      }
    };
    fetchConversations();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle recipient query param — find/create conversation and auto-select
  const recipientHandledRef = useRef(false);
  useEffect(() => {
    const recipient = searchParams.get('recipient');
    const pitchParam = searchParams.get('pitch');
    if (!recipient || recipientHandledRef.current) return;
    recipientHandledRef.current = true;

    const initConversation = async () => {
      try {
        const res = await apiClient.post<{ conversation: { id: number } }>('/api/conversations', {
          recipientId: parseInt(recipient),
          pitchId: pitchParam ? parseInt(pitchParam) : undefined,
        });
        if (res.success && res.data?.conversation?.id) {
          const convId = res.data.conversation.id;
          // Auto-select the conversation
          setSelectedConversation(convId);
          joinConversation(convId);
          hookMarkConversationAsRead(convId);
        }
      } catch {
        // Non-critical — user can still manually select
      }
      // Clear params to prevent re-triggering
      setSearchParams({}, { replace: true });
    };
    initConversation();
  }, [searchParams, setSearchParams, joinConversation, hookMarkConversationAsRead]);

  // Sync with hook conversations and messages
  useEffect(() => {
    if (hookConversations) {
      const enhancedConvs = hookConversations.map((conv: Record<string, unknown>) => {
        const convId = conv.id as number;
        const lastMsg = conv.lastMessage as Record<string, unknown> | undefined;
        return {
          ...conv,
          id: convId,
          participantName: (conv.participantName as string) || 'Unknown',
          participantType: ((conv.participantType as string) || 'creator') as 'investor' | 'production' | 'creator',
          lastMessageText: (lastMsg?.content as string) || '',
          timestamp: (lastMsg?.timestamp as string) || (conv.lastMessageAt as string) || new Date().toISOString(),
          isOnline: false,
          hasUnreadMessages: unreadCounts[convId] > 0,
          unreadCount: unreadCounts[convId] || 0,
          pitchTitle: conv.pitchTitle as string | undefined
        };
      });
      setConversations(enhancedConvs);
      setLoading(false);
    }
  }, [hookConversations, onlineUsers, unreadCounts]);

  // Sync messages for selected conversation from hook
  useEffect(() => {
    if (hookMessages) {
      const enhancedMessages = hookMessages.map((msg: Record<string, unknown>) => {
        const msgId = msg.id as number;
        const msgConversationId = msg.conversationId as number;
        const msgSenderId = msg.senderId as number;
        const currentUserId = parseInt(getUserId() || '0');
        return {
          id: msgId,
          conversationId: msgConversationId,
          senderId: msgSenderId,
          content: msg.content as string,
          senderName: (msg.senderName as string) || 'Unknown',
          senderType: ((msg.senderType as string) || 'creator') as 'investor' | 'production' | 'creator',
          message: msg.content as string,
          timestamp: msg.timestamp as string,
          isRead: (msg.isRead as boolean) || false,
          hasAttachment: false,
          delivered: (msg.delivered as boolean) || true,
          reactions: [],
          isEncrypted: false,
          canEdit: msgSenderId === currentUserId,
          canDelete: msgSenderId === currentUserId
        };
      });
      setCurrentMessages(enhancedMessages);
    }
  }, [hookMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);

  // Handle typing indicators
  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (newMessage.trim() && selectedConversation) {
      hookStartTyping(selectedConversation);
      
      typingTimeoutRef.current = setTimeout(() => {
        hookStopTyping(selectedConversation);
      }, 3000);
    }
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [newMessage, selectedConversation, hookStartTyping, hookStopTyping]);

  // Helper functions
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const addNotification = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { message, type, id }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  // File handling
  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  }, []);

  const removeSelectedFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Enhanced message handling
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() && selectedFiles.length === 0) return;
    if (!selectedConversation || sendingMessage) return;

    setSendingMessage(true);

    try {
      // Upload attachments first if any
      let attachments: Array<{ url: string; originalName: string; fileSize: number; mimeType: string }> = [];
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          const uploadRes = await fetch('/api/messages/attachments', {
            method: 'POST',
            credentials: 'include',
            body: formData
          });
          const uploadResult = await uploadRes.json();
          if (uploadResult.success) {
            attachments.push(uploadResult.data);
          }
        }
      }

      // Send message with attachments if any
      if (attachments.length > 0) {
        await fetch(`/api/conversations/${selectedConversation}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            content: newMessage.trim() || '[File attachment]',
            attachments
          })
        });
      } else {
        sendChatMessage(selectedConversation, newMessage.trim());
      }

      // Clear input and reset state
      setNewMessage('');
      setSelectedFiles([]);
      setReplyToMessage(null);
      setShowEmojiPicker(false);

      // Focus back to input
      messageInputRef.current?.focus();

      addNotification('Message sent successfully', 'success');
    } catch (error: unknown) {
      console.error('Failed to send message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      addNotification(errorMessage, 'error');
    } finally {
      setSendingMessage(false);
    }
  }, [newMessage, selectedFiles, selectedConversation, sendingMessage, sendChatMessage, addNotification]);

  const handleKeyPress = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const handleManualRefresh = useCallback(() => {
    setIsRefreshing(true);
    setLastUpdated(new Date());
    // Hook will handle the actual refresh
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  // Enhanced message interaction handlers
  const handleSelectConversation = useCallback((conversationId: number) => {
    setSelectedConversation(conversationId);
    joinConversation(conversationId);
    hookMarkConversationAsRead(conversationId);
  }, [joinConversation, hookMarkConversationAsRead]);

  const handleReplyToMessage = useCallback((message: EnhancedMessage) => {
    setReplyToMessage(message);
    messageInputRef.current?.focus();
  }, []);

  const handleEditMessage = useCallback(async (messageId: number, newContent: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newContent })
      });
      const result = await response.json();
      if (result.success) {
        addNotification('Message edited', 'success');
      } else {
        addNotification(result.error || 'Failed to edit message', 'error');
      }
    } catch {
      addNotification('Failed to edit message', 'error');
    }
    setEditingMessage(null);
  }, [addNotification]);

  const handleDeleteMessage = useCallback(async (messageId: number) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const result = await response.json();
      if (result.success) {
        addNotification('Message deleted', 'success');
      } else {
        addNotification(result.error || 'Failed to delete message', 'error');
      }
    } catch {
      addNotification('Failed to delete message', 'error');
    }
  }, [addNotification]);

  const handleReaction = useCallback((_messageId: number, _reaction: string) => {
    // Simplified - not implemented in hook yet
    addNotification('Reactions not implemented yet', 'error');
  }, [addNotification]);

  // UI helper functions
  const getFileIcon = useCallback((mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (mimeType.startsWith('video/')) return <Video className="w-4 h-4" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  }, []);


  const formatMessageTime = useCallback((timestamp: string | Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }, []);

  // Filter conversations based on search and filters
  const filteredConversations = useCallback(() => {
    return conversations.filter(conv => {
      const convExtra = conv as unknown as Record<string, unknown>;
      const pitch = convExtra.pitch as { title?: string } | undefined;
      const matchesSearch = !searchTerm || (
        conv.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (conv.lastMessageText?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (pitch?.title?.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      if (filter === 'all') return matchesSearch;
      if (filter === 'unread') return matchesSearch && (conv.unreadCount || 0) > 0;
      if (filter === 'investors') return matchesSearch && conv.participantType === 'investor';
      if (filter === 'production') return matchesSearch && conv.participantType === 'production';
      if (filter === 'online') return matchesSearch && conv.isOnline;

      return matchesSearch;
    });
  }, [conversations, searchTerm, filter]);

  // Enhanced emoji and formatting
  const commonEmojis = ['👍', '❤️', '😀', '😂', '😭', '😮', '😡', '🎉', '👏', '🔥'];
  
  const insertEmoji = useCallback((emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  }, []);

  // Connection status indicator
  const connectionStatus = useCallback(() => {
    if (isConnected) return { color: 'green', text: 'Connected' };
    return { color: 'gray', text: 'Disconnected' };
  }, [isConnected]);

  const getParticipantBadgeColor = useCallback((type: string) => {
    switch (type) {
      case 'investor':
        return 'bg-blue-100 text-blue-700';
      case 'production':
        return 'bg-green-100 text-green-700';
      case 'creator':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }, []);

  // Get filtered conversations
  const displayConversations = filteredConversations();
  
  // Handle cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (selectedConversation) {
        hookStopTyping(selectedConversation);
      }
    };
  }, [selectedConversation, hookStopTyping]);

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Offline banner */}
        {(!isOnline || !isConnected) && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                {!isOnline ? 'You are offline' : 'Disconnected from messaging server'}
              </p>
              <p className="text-xs text-yellow-600">
                {!isOnline ? 'Check your internet connection to send and receive messages.' : 'Attempting to reconnect...'}
              </p>
            </div>
          </div>
        )}

        {/* Notifications */}
        <div className="fixed top-4 right-4 space-y-2 z-50">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
                notification.type === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-sm font-medium">{notification.message}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Enhanced Real-time status */}
        <div className="flex items-center justify-between bg-white rounded-lg p-3 mb-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus().color === 'green' ? 'bg-green-500' :
                connectionStatus().color === 'yellow' ? 'bg-yellow-500 animate-pulse' :
                connectionStatus().color === 'red' ? 'bg-red-500' :
                'bg-gray-400'
              }`}></div>
              <span>{connectionStatus().text}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className={`flex items-center gap-2 px-3 py-1 border rounded text-xs transition ${
                  isRefreshing 
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                title="Refresh conversations"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Users className="w-3 h-3" />
                <span>{Object.values(onlineUsers).filter(Boolean).length} online</span>
              </div>
              
              {/* Encryption toggle */}
              <button
                onClick={() => setIsEncryptionEnabled(!isEncryptionEnabled)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${
                  isEncryptionEnabled 
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
                title={`Encryption ${isEncryptionEnabled ? 'enabled' : 'disabled'}`}
              >
                {isEncryptionEnabled ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                E2E
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
            {selectedConversation && typingUsers[selectedConversation]?.length > 0 && (
              <span className="flex items-center gap-1 text-purple-600">
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                Someone is typing...
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
          <div className="flex h-full">
            {/* Conversations List */}
            <div className="w-1/3 border-r border-gray-200 flex flex-col">
              {/* Search and Filter */}
              <div className="p-4 border-b border-gray-200">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Messages</option>
                    <option value="unread">Unread</option>
                    <option value="investors">Investors</option>
                    <option value="production">Production</option>
                    <option value="online">Online Users</option>
                  </select>
                </div>
              </div>

              {/* Conversations */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  </div>
                ) : displayConversations.length === 0 ? (
                  <div className="p-4 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">
                      {searchTerm ? 'No conversations match your search' : 'No conversations found'}
                    </p>
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')}
                        className="text-purple-600 text-sm mt-2 hover:underline"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  displayConversations.map((conversation) => {
                    const convExtra = conversation as unknown as Record<string, unknown>;
                    const participants = convExtra.participants as Array<{ userId: number }> | undefined;
                    const participant = participants?.find((p) => p.userId !== parseInt(getUserId() || '0'));
                    const isParticipantOnline = participant && onlineUsers[participant.userId];
                    
                    return (
                      <div
                        key={conversation.id}
                        onClick={() => handleSelectConversation(conversation.id)}
                        className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${
                          selectedConversation === conversation.id ? 'bg-purple-50 border-purple-200' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="relative flex items-center gap-2">
                              <h3 className="font-medium text-gray-900 text-sm">
                                {conversation.participantName}
                              </h3>
                              {isParticipantOnline && (
                                <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                              )}
                              {(convExtra.isEncrypted as boolean | undefined) && (
                                <Lock className="w-3 h-3 text-green-600" />
                              )}
                            </div>
                            <span className={`px-2 py-1 text-xs rounded-full ${getParticipantBadgeColor(conversation.participantType)}`}>
                              {conversation.participantType}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {(convExtra.muted as boolean | undefined) && (
                              <div className="w-3 h-3 text-gray-400" title="Muted">🔇</div>
                            )}
                            {(conversation.unreadCount || 0) > 0 && (
                              <span className="bg-purple-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                                {conversation.unreadCount || 0}
                              </span>
                            )}
                          </div>
                        </div>

                        {(convExtra.pitch as { title?: string } | undefined) && (
                          <p className="text-xs text-purple-600 mb-1">Re: {(convExtra.pitch as { title?: string }).title}</p>
                        )}

                        <div className="flex items-center gap-2 mb-1">
                          {(() => {
                            const lastMsg = convExtra.lastMessage as Record<string, unknown> | undefined;
                            const attachments = lastMsg?.attachments as Array<{ mimeType: string }> | undefined;
                            if (lastMsg?.contentType !== 'text') {
                              return getFileIcon(attachments?.[0]?.mimeType || '');
                            }
                            return null;
                          })()}
                          <p className="text-sm text-gray-600 truncate flex-1">
                            {(convExtra.lastMessage as { content?: string } | undefined)?.content || 'No messages yet'}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-400">
                            {formatMessageTime(conversation.timestamp)}
                          </p>
                          {typingUsers[conversation.id]?.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-purple-600">
                              <div className="flex space-x-1">
                                <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce"></div>
                                <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                              <span>typing...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Message View */}
            <div className="flex-1 flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Message Header */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        {(() => {
                          const conv = conversations.find(c => c.id === selectedConversation);
                          return conv ? (
                            <div>
                              <h2 className="font-semibold text-gray-900">{conv.participantName}</h2>
                              {conv.pitchTitle && (
                                <p className="text-sm text-gray-500">About: {conv.pitchTitle}</p>
                              )}
                            </div>
                          ) : null;
                        })()}
                      </div>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Reply indicator */}
                  {replyToMessage && (
                    <div className="p-3 bg-blue-50 border-b border-blue-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-1 h-8 bg-blue-500 rounded"></div>
                          <div>
                            <p className="font-medium text-blue-900">Replying to {replyToMessage.senderName}</p>
                            <p className="text-blue-700 truncate max-w-md">{replyToMessage.content}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setReplyToMessage(null)}
                          className="text-blue-500 hover:text-blue-700 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                      {currentMessages.map((message) => {
                        const currentUserId = getUserId();
                        const isCurrentUser = message.senderId === parseInt(currentUserId || '0');
                        const showReactions = message.reactions && message.reactions.length > 0;
                        
                        const msgExtra = message as unknown as Record<string, unknown>;
                        const parentMessage = msgExtra.parentMessage as { senderName?: string; content?: string } | undefined;
                        const msgAttachments = msgExtra.attachments as Array<{ mimeType: string; originalName: string; fileSize: number; url?: string }> | undefined;
                        return (
                          <div key={message.id} className="group">
                            {/* Reply context */}
                            {parentMessage && (
                              <div className={`mb-2 ml-4 ${isCurrentUser ? 'text-right mr-4' : ''}`}>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                  <div className="w-6 h-px bg-gray-300"></div>
                                  <span>Replying to {parentMessage.senderName}</span>
                                </div>
                                <div className="text-sm text-gray-600 italic truncate max-w-md">
                                  {parentMessage.content}
                                </div>
                              </div>
                            )}
                            
                            <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                              <div className={`relative max-w-xs lg:max-w-md group-hover:scale-[1.02] transition-transform`}>
                                {/* Message options */}
                                <div className={`absolute -top-2 ${isCurrentUser ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                                  <button
                                    onClick={() => handleReplyToMessage(message)}
                                    className="p-1 bg-white border rounded-full shadow hover:bg-gray-50 text-gray-600"
                                    title="Reply"
                                  >
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414L2.586 8l3.707-3.707a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                  
                                  <button
                                    onClick={() => setShowEmojiPicker(true)}
                                    className="p-1 bg-white border rounded-full shadow hover:bg-gray-50 text-gray-600"
                                    title="Add reaction"
                                  >
                                    <Smile className="w-3 h-3" />
                                  </button>
                                  
                                  {message.canEdit && (
                                    <button
                                      onClick={() => setEditingMessage(message.id)}
                                      className="p-1 bg-white border rounded-full shadow hover:bg-gray-50 text-gray-600"
                                      title="Edit"
                                    >
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                      </svg>
                                    </button>
                                  )}
                                  
                                  {message.canDelete && (
                                    <button
                                      onClick={() => handleDeleteMessage(message.id)}
                                      className="p-1 bg-white border rounded-full shadow hover:bg-red-50 text-red-600"
                                      title="Delete"
                                    >
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 102 0v-1a1 1 0 10-2 0v1zm2 3a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                                
                                <div className={`px-4 py-2 rounded-lg ${
                                  isCurrentUser
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-100 text-gray-900'
                                } ${
                                  message.isEncrypted ? 'border-2 border-green-300' : ''
                                }`}>
                                  {/* Encryption indicator */}
                                  {message.isEncrypted && (
                                    <div className="flex items-center gap-1 mb-1 text-xs opacity-75">
                                      <Lock className="w-3 h-3" />
                                      <span>End-to-end encrypted</span>
                                    </div>
                                  )}

                                  {/* Subject */}
                                  {(msgExtra.subject as string | undefined) && (
                                    <p className="font-medium text-sm mb-1">{msgExtra.subject as string}</p>
                                  )}
                                  
                                  {/* Content */}
                                  {editingMessage === message.id ? (
                                    <div className="space-y-2">
                                      <textarea
                                        defaultValue={message.content}
                                        className="w-full p-2 border rounded text-gray-900 text-sm"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && e.ctrlKey) {
                                            handleEditMessage(message.id, e.currentTarget.value);
                                          }
                                          if (e.key === 'Escape') {
                                            setEditingMessage(null);
                                          }
                                        }}
                                        autoFocus
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => {
                                            const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
                                            if (textarea) handleEditMessage(message.id, textarea.value);
                                          }}
                                          className="text-xs bg-purple-600 text-white px-2 py-1 rounded"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => setEditingMessage(null)}
                                          className="text-xs bg-gray-300 text-gray-700 px-2 py-1 rounded"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm whitespace-pre-wrap">{message.content || message.message}</p>
                                  )}

                                  {/* Attachments */}
                                  {msgAttachments && msgAttachments.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {msgAttachments.map((attachment, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs opacity-90 bg-black bg-opacity-20 rounded p-2">
                                          {getFileIcon(attachment.mimeType)}
                                          <span className="flex-1 truncate">{attachment.originalName}</span>
                                          <span>{formatFileSize(attachment.fileSize)}</span>
                                          <button
                                            onClick={() => {
                                              if (attachment.url) {
                                                window.open(attachment.url, '_blank');
                                              }
                                            }}
                                            className="hover:bg-black hover:bg-opacity-20 p-1 rounded"
                                            title="Download"
                                          >
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* Message footer */}
                                  <div className="flex items-center justify-between mt-2 text-xs">
                                    <div className={`flex items-center gap-2 ${
                                      isCurrentUser ? 'text-purple-200' : 'text-gray-500'
                                    }`}>
                                      <span>{formatMessageTime(message.timestamp)}</span>
                                      {(msgExtra.isEdited as boolean | undefined) && (
                                        <span className="opacity-75">(edited)</span>
                                      )}
                                    </div>

                                    {/* Read receipts */}
                                    {isCurrentUser && (
                                      <div className={`flex items-center gap-1 ${
                                        isCurrentUser ? 'text-purple-200' : 'text-gray-500'
                                      }`}>
                                        {(() => {
                                          const readReceipts = msgExtra.readReceipts as unknown[] | undefined;
                                          return readReceipts && readReceipts.length > 0 ? (
                                          <>
                                            <CheckCheck className="w-3 h-3" />
                                            <span>Read by {readReceipts.length}</span>
                                          </>
                                        ) : message.delivered ? (
                                          <>
                                            <Check className="w-3 h-3" />
                                            <span>Delivered</span>
                                          </>
                                        ) : (
                                          <>
                                            <Clock className="w-3 h-3" />
                                            <span>Sending...</span>
                                          </>
                                        );
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Reactions */}
                                {showReactions && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {message.reactions?.map((reaction, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() => handleReaction(message.id, reaction.type)}
                                        className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 rounded-full px-2 py-1 text-xs transition"
                                        title={reaction.users.join(', ')}
                                      >
                                        <span>{reaction.type}</span>
                                        <span>{reaction.count}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Typing indicators */}
                      {selectedConversation && typingUsers[selectedConversation]?.length > 0 && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg max-w-xs">
                            <div className="flex items-center gap-2">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                              <span className="text-xs text-gray-500">
                                {typingUsers[selectedConversation].join(', ')} typing...
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Message Input */}
                  <div className="border-t border-gray-200">
                    {/* File attachments preview */}
                    {selectedFiles.length > 0 && (
                      <div className="p-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                          <Paperclip className="w-4 h-4" />
                          <span>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</span>
                        </div>
                        <div className="space-y-2">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                              <div className="flex items-center gap-2">
                                {getFileIcon(file.type)}
                                <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                                <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                              </div>
                              <button
                                onClick={() => removeSelectedFile(index)}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Cost information for creators */}
                    {isCreator && (
                      <div className="p-3 bg-yellow-50 border-b border-yellow-200">
                        <p className="text-xs text-yellow-800">
                          💬 <strong>Messaging Cost:</strong> {messageCost} credits per message
                          {isFreeForUser && <span className="text-green-600 ml-1">(Free for you!)</span>}
                        </p>
                      </div>
                    )}
                    
                    {/* Free messaging notice for investors/production */}
                    {isFreeForUser && (
                      <div className="p-3 bg-green-50 border-b border-green-200">
                        <p className="text-xs text-green-800">
                          ✨ <strong>Free Messaging:</strong> You can send messages at no cost!
                        </p>
                      </div>
                    )}
                    
                    <div className="p-4">
                      <div className="flex items-end gap-2">
                        {/* File attachment button */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          onChange={handleFileSelect}
                          className="hidden"
                          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                          title="Attach files"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                        
                        {/* Emoji button */}
                        <div className="relative">
                          <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                            title="Add emoji"
                          >
                            <Smile className="w-5 h-5" />
                          </button>
                          
                          {/* Emoji picker */}
                          {showEmojiPicker && (
                            <div className="absolute bottom-full left-0 mb-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                              <div className="grid grid-cols-5 gap-2">
                                {commonEmojis.map((emoji, index) => (
                                  <button
                                    key={index}
                                    onClick={() => insertEmoji(emoji)}
                                    className="text-lg hover:bg-gray-100 p-2 rounded transition"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Message input */}
                        <div className="flex-1">
                          <textarea
                            ref={messageInputRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={selectedFiles.length > 0 ? "Add a message (optional)..." : "Type your message..."}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                            onKeyDown={handleKeyPress}
                          />
                        </div>
                        
                        {/* Send button */}
                        <button
                          onClick={sendMessage}
                          disabled={((!newMessage.trim() && selectedFiles.length === 0) || sendingMessage || !isOnline)}
                          className={`p-3 rounded-lg transition min-w-[60px] flex items-center justify-center ${
                            sendingMessage || !isOnline
                              ? 'bg-gray-400 cursor-not-allowed'
                              : (newMessage.trim() || selectedFiles.length > 0)
                                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                          title={!isOnline ? 'Cannot send while offline' : undefined}
                        >
                          {sendingMessage ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
                    <p className="text-gray-500">Choose a conversation from the left to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}