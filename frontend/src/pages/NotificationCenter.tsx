import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, Check, CheckCheck, Trash2, Settings, Bell, BellOff } from 'lucide-react';
import { useNotifications } from '../contexts/WebSocketContext';
import { NotificationsService, type Notification as BackendNotification } from '../services/notifications.service';
import { useNotificationToast } from '@shared/components/feedback/NotificationToastContainer';

type NotificationFilter = 'all' | 'unread' | 'nda' | 'investment' | 'message' | 'follow' | 'system';

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  marketing: boolean;
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { notifications: wsNotifications, markNotificationAsRead, clearAllNotifications } = useNotifications();
  const toast = useNotificationToast();
  
  const [apiNotifications, setApiNotifications] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: true,
    push: true,
    sms: false,
    marketing: false,
  });

  // Load notifications and preferences
  useEffect(() => {
    loadNotifications();
    loadPreferences();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const notifications = await NotificationsService.getNotifications(100);
      setApiNotifications(notifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      toast.error('Failed to load notifications', 'Please try again later');
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const prefs = await NotificationsService.getPreferences();
      if (prefs) {
        setPreferences(prefs);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  // Combine and filter notifications
  const allNotifications = [
    ...apiNotifications.map(notification => ({
      ...NotificationsService.convertToFrontendFormat(notification),
      actions: NotificationsService.getNotificationActions(notification)
    })),
    ...wsNotifications
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredNotifications = allNotifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.read;
      case 'nda':
        return notification.type === 'warning' || 
               notification.title.toLowerCase().includes('nda') ||
               notification.title.toLowerCase().includes('approval') ||
               notification.title.toLowerCase().includes('rejection') ||
               notification.title.toLowerCase().includes('expir') ||
               notification.title.toLowerCase().includes('reminder');
      case 'investment':
        return notification.title.toLowerCase().includes('investment') || 
               notification.title.toLowerCase().includes('funding') ||
               notification.title.toLowerCase().includes('investor');
      case 'message':
        return notification.title.toLowerCase().includes('message') ||
               notification.title.toLowerCase().includes('chat');
      case 'follow':
        return notification.title.toLowerCase().includes('follow') ||
               notification.title.toLowerCase().includes('connection');
      case 'system':
        return notification.type === 'info' || 
               notification.title.toLowerCase().includes('digest') ||
               notification.title.toLowerCase().includes('summary') ||
               notification.title.toLowerCase().includes('weekly');
      default:
        return true;
    }
  });

  const unreadCount = allNotifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    const apiNotification = apiNotifications.find(n => n.id.toString() === id);
    
    if (apiNotification && !apiNotification.isRead) {
      try {
        const success = await NotificationsService.markAsRead(apiNotification.id);
        if (success) {
          setApiNotifications(prev => 
            prev.map(n => n.id === apiNotification.id ? { ...n, isRead: true } : n)
          );
          toast.success('Marked as read', 'Notification updated');
        }
      } catch (error) {
        toast.error('Failed to mark as read', 'Please try again');
      }
    } else {
      markNotificationAsRead(id);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const success = await NotificationsService.markAllAsRead();
      if (success) {
        setApiNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        clearAllNotifications();
        toast.success('All notifications marked as read', 'Your inbox is now clear');
      }
    } catch (error) {
      toast.error('Failed to mark all as read', 'Please try again');
    }
  };

  const handleBulkAction = async (action: 'read' | 'delete') => {
    if (selectedIds.size === 0) return;

    try {
      if (action === 'read') {
        const apiIds = Array.from(selectedIds)
          .map(id => apiNotifications.find(n => n.id.toString() === id)?.id)
          .filter(Boolean) as number[];
        
        if (apiIds.length > 0) {
          await NotificationsService.markMultipleAsRead(apiIds);
          setApiNotifications(prev => 
            prev.map(n => apiIds.includes(n.id) ? { ...n, isRead: true } : n)
          );
        }
        
        // Handle WebSocket notifications
        selectedIds.forEach(id => {
          if (!apiIds.includes(parseInt(id))) {
            markNotificationAsRead(id);
          }
        });
        
        toast.success(`Marked ${selectedIds.size} notifications as read`, 'Bulk action completed');
      }
      
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Bulk action failed', 'Please try again');
    }
  };

  const handlePreferencesUpdate = async (newPreferences: NotificationPreferences) => {
    try {
      const success = await NotificationsService.updatePreferences(newPreferences);
      if (success) {
        setPreferences(newPreferences);
        toast.success('Preferences updated', 'Your notification settings have been saved');
      }
    } catch (error) {
      toast.error('Failed to update preferences', 'Please try again');
    }
  };

  const getFilterLabel = (filterType: NotificationFilter) => {
    switch (filterType) {
      case 'all': return 'All';
      case 'unread': return 'Unread';
      case 'nda': return 'NDA Requests';
      case 'investment': return 'Investments';
      case 'message': return 'Messages';
      case 'follow': return 'Follows';
      case 'system': return 'System';
      default: return 'All';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
                {unreadCount > 0 && (
                  <p className="text-sm text-gray-500">{unreadCount} unread</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Notification preferences"
              >
                <Settings className="w-5 h-5" />
              </button>
              
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar - Filters */}
          <div className="lg:w-64">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Filter by</h3>
              <div className="space-y-1">
                {(['all', 'unread', 'nda', 'investment', 'message', 'follow', 'system'] as NotificationFilter[]).map((filterType) => (
                  <button
                    key={filterType}
                    onClick={() => setFilter(filterType)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                      filter === filterType
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {getFilterLabel(filterType)}
                    {filterType === 'unread' && unreadCount > 0 && (
                      <span className="ml-2 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Preferences Panel */}
            {showPreferences && (
              <div className="mt-4 bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Notification Preferences</h3>
                <div className="space-y-3">
                  {Object.entries(preferences).map(([key, value]) => (
                    <label key={key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => {
                          const newPrefs = { ...preferences, [key]: e.target.checked };
                          handlePreferencesUpdate(newPrefs);
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">
                        {key === 'sms' ? 'SMS' : key} notifications
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">
                    {selectedIds.size} notification{selectedIds.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleBulkAction('read')}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <Check className="w-4 h-4" />
                      <span>Mark read</span>
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications List */}
            <div className="bg-white rounded-lg shadow-sm">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No notifications</h3>
                  <p className="text-gray-500">
                    {filter === 'all' 
                      ? "You're all caught up! New notifications will appear here."
                      : `No ${getFilterLabel(filter).toLowerCase()} notifications found.`
                    }
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(notification.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedIds);
                            if (e.target.checked) {
                              newSelected.add(notification.id);
                            } else {
                              newSelected.delete(notification.id);
                            }
                            setSelectedIds(newSelected);
                          }}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        
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
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="p-1 text-blue-600 hover:text-blue-800"
                                  title="Mark as read"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          
                          {notification.actions && notification.actions.length > 0 && (
                            <div className="flex space-x-2 mt-3">
                              {notification.actions.map((action, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    action.action();
                                    handleMarkAsRead(notification.id);
                                  }}
                                  className={`px-3 py-1 text-xs rounded transition-colors ${
                                    (action.type as string) === 'primary'
                                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                                      : (action.type as string) === 'success'
                                      ? 'bg-green-600 text-white hover:bg-green-700'
                                      : (action.type as string) === 'danger'
                                      ? 'bg-red-600 text-white hover:bg-red-700'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {/* NDA-specific quick actions */}
                          {(notification.title.toLowerCase().includes('nda request') && 
                            notification.title.toLowerCase().includes('new')) && (
                            <div className="flex space-x-2 mt-3">
                              <button
                                onClick={() => {
                                  navigate('/creator/nda-requests');
                                  handleMarkAsRead(notification.id);
                                }}
                                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  navigate('/creator/nda-requests');
                                  handleMarkAsRead(notification.id);
                                }}
                                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => {
                                  navigate('/creator/nda-requests');
                                  handleMarkAsRead(notification.id);
                                }}
                                className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                              >
                                Review
                              </button>
                            </div>
                          )}
                          
                          {/* Investment notification actions */}
                          {notification.title.toLowerCase().includes('investment') && (
                            <div className="flex space-x-2 mt-3">
                              <button
                                onClick={() => {
                                  navigate('/investor/investments');
                                  handleMarkAsRead(notification.id);
                                }}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                              >
                                View Details
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}