import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bell,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Trash2,
  Filter,
  Calendar,
  User,
  FileText,
  ExternalLink,
  Zap
} from 'lucide-react';
import { useToast } from '@shared/components/feedback/ToastProvider';
import { NDAService } from '../../services/nda.service';
import type { NDA } from '@shared/types/api';
import { formatDistanceToNow } from 'date-fns';

export interface NDANotification {
  id: number;
  type: 'nda_request' | 'nda_approved' | 'nda_rejected' | 'nda_expiring' | 'nda_expired' | 'nda_reminder';
  title: string;
  message: string;
  data?: {
    requestId?: number;
    pitchId?: number;
    pitchTitle?: string;
    requesterName?: string;
    expiresAt?: string;
    reason?: string;
  };
  isRead: boolean;
  isUrgent: boolean;
  createdAt: string;
  actionRequired?: boolean;
}

interface NDANotificationCenterProps {
  userId: number;
  onNotificationAction?: (notificationId: number, action: 'read' | 'delete' | 'view') => void;
  onNDAAction?: (requestId: number, action: 'approve' | 'reject' | 'view') => void;
}

const NOTIFICATION_ICONS = {
  nda_request: Shield,
  nda_approved: CheckCircle,
  nda_rejected: XCircle,
  nda_expiring: Clock,
  nda_expired: AlertTriangle,
  nda_reminder: Bell
};

const NOTIFICATION_COLORS = {
  nda_request: 'text-blue-600 bg-blue-50 border-blue-200',
  nda_approved: 'text-green-600 bg-green-50 border-green-200',
  nda_rejected: 'text-red-600 bg-red-50 border-red-200',
  nda_expiring: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  nda_expired: 'text-red-600 bg-red-50 border-red-200',
  nda_reminder: 'text-purple-600 bg-purple-50 border-purple-200'
};

const STORAGE_KEY_READ = 'pitchey:nda-read-notifications';
const STORAGE_KEY_DELETED = 'pitchey:nda-deleted-notifications';

function getStoredIds(key: string): Set<number> {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return new Set(JSON.parse(stored) as number[]);
    }
  } catch {
    // ignore parse errors
  }
  return new Set();
}

function storeIds(key: string, ids: Set<number>): void {
  localStorage.setItem(key, JSON.stringify([...ids]));
}

function ndaToNotification(nda: NDA, userId: number): NDANotification | null {
  const pitchTitle = nda.pitch?.title || nda.pitchTitle || 'Unknown Pitch';
  const requesterName = nda.requester?.firstName
    ? `${nda.requester.firstName} ${nda.requester.lastName || ''}`.trim()
    : nda.requesterName || 'Someone';
  const createdAt = nda.createdAt || new Date().toISOString();
  const hoursSinceCreated = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);

  // Determine notification type based on NDA status and user's role
  const isOwner = nda.userId === userId;
  const isRequester = nda.requesterId === userId || nda.signerId === userId;

  if (nda.status === 'expired') {
    return {
      id: nda.id * 10 + 5,
      type: 'nda_expired',
      title: 'NDA Expired',
      message: `Your NDA for "${pitchTitle}" has expired.`,
      data: { requestId: nda.id, pitchId: nda.pitchId, pitchTitle, expiresAt: nda.expiresAt },
      isRead: false,
      isUrgent: false,
      createdAt: nda.expiresAt || createdAt,
      actionRequired: false
    };
  }

  // Check if approved NDA is expiring within 14 days
  if ((nda.status === 'approved' || nda.status === 'signed') && nda.expiresAt) {
    const daysUntilExpiry = (new Date(nda.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry > 0 && daysUntilExpiry <= 14) {
      return {
        id: nda.id * 10 + 4,
        type: 'nda_expiring',
        title: 'NDA Expiring Soon',
        message: `Your NDA for "${pitchTitle}" will expire in ${Math.ceil(daysUntilExpiry)} days.`,
        data: { requestId: nda.id, pitchId: nda.pitchId, pitchTitle, expiresAt: nda.expiresAt },
        isRead: false,
        isUrgent: daysUntilExpiry <= 3,
        createdAt,
        actionRequired: false
      };
    }
  }

  if (nda.status === 'pending' && isOwner) {
    return {
      id: nda.id * 10 + 1,
      type: 'nda_request',
      title: 'New NDA Request',
      message: `${requesterName} has requested NDA access to "${pitchTitle}".`,
      data: { requestId: nda.id, pitchId: nda.pitchId, pitchTitle, requesterName },
      isRead: false,
      isUrgent: hoursSinceCreated > 72,
      createdAt,
      actionRequired: true
    };
  }

  if (nda.status === 'approved' && isRequester) {
    return {
      id: nda.id * 10 + 2,
      type: 'nda_approved',
      title: 'NDA Approved',
      message: `Your NDA request for "${pitchTitle}" has been approved.`,
      data: { requestId: nda.id, pitchId: nda.pitchId, pitchTitle, expiresAt: nda.expiresAt },
      isRead: false,
      isUrgent: false,
      createdAt: nda.respondedAt || createdAt,
      actionRequired: false
    };
  }

  if (nda.status === 'rejected' && isRequester) {
    return {
      id: nda.id * 10 + 3,
      type: 'nda_rejected',
      title: 'NDA Request Declined',
      message: `Your NDA request for "${pitchTitle}" has been declined.`,
      data: {
        requestId: nda.id,
        pitchId: nda.pitchId,
        pitchTitle,
        reason: nda.rejectionReason || nda.notes
      },
      isRead: false,
      isUrgent: false,
      createdAt: nda.respondedAt || createdAt,
      actionRequired: false
    };
  }

  return null;
}

export default function NDANotificationCenter({
  userId,
  onNotificationAction,
  onNDAAction
}: NDANotificationCenterProps) {
  const [notifications, setNotifications] = useState<NDANotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');
  const [readIds, setReadIds] = useState<Set<number>>(() => getStoredIds(STORAGE_KEY_READ));
  const [deletedIds, setDeletedIds] = useState<Set<number>>(() => getStoredIds(STORAGE_KEY_DELETED));

  const { success, error } = useToast();

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);

      const data = await NDAService.getNDAs({ limit: 20 });
      const ndas = data.ndas || [];

      const currentDeletedIds = getStoredIds(STORAGE_KEY_DELETED);
      const currentReadIds = getStoredIds(STORAGE_KEY_READ);

      const derived: NDANotification[] = [];
      for (const nda of ndas) {
        const notification = ndaToNotification(nda, userId);
        if (notification && !currentDeletedIds.has(notification.id)) {
          notification.isRead = currentReadIds.has(notification.id);
          derived.push(notification);
        }
      }

      setNotifications(derived);

    } catch (err) {
      console.error('Failed to load notifications:', err);
      error('Loading Failed', 'Unable to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId, error]);

  useEffect(() => {
    loadNotifications();

    // Refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000);

    return () => clearInterval(interval);
  }, [loadNotifications]);

  const filteredAndSortedNotifications = useMemo(() => {
    const filtered = notifications.filter(notification => {
      const typeMatch = filterType === 'all' || notification.type === filterType;
      const readMatch = !showUnreadOnly || !notification.isRead;

      return typeMatch && readMatch;
    });

    // Sort notifications
    filtered.sort((a, b) => {
      if (sortBy === 'priority') {
        // Urgent and unread first
        if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      }

      // Then by date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [notifications, filterType, showUnreadOnly, sortBy]);

  const handleMarkAsRead = async (notificationIds: number[]) => {
    try {
      const newReadIds = new Set(readIds);
      notificationIds.forEach(id => newReadIds.add(id));
      setReadIds(newReadIds);
      storeIds(STORAGE_KEY_READ, newReadIds);

      setNotifications(prev =>
        prev.map(n =>
          notificationIds.includes(n.id)
            ? { ...n, isRead: true }
            : n
        )
      );

      notificationIds.forEach(id => onNotificationAction?.(id, 'read'));
      success('Marked as Read', `${notificationIds.length} notification(s) marked as read.`);

    } catch (err) {
      error('Update Failed', 'Unable to mark notifications as read.');
    }
  };

  const handleDelete = async (notificationIds: number[]) => {
    try {
      const newDeletedIds = new Set(deletedIds);
      notificationIds.forEach(id => newDeletedIds.add(id));
      setDeletedIds(newDeletedIds);
      storeIds(STORAGE_KEY_DELETED, newDeletedIds);

      setNotifications(prev => prev.filter(n => !notificationIds.includes(n.id)));

      notificationIds.forEach(id => onNotificationAction?.(id, 'delete'));
      success('Deleted', `${notificationIds.length} notification(s) deleted.`);

    } catch (err) {
      error('Delete Failed', 'Unable to delete notifications.');
    }
  };

  const handleNotificationClick = (notification: NDANotification) => {
    // Mark as read if not already read
    if (!notification.isRead) {
      handleMarkAsRead([notification.id]);
    }

    // Handle notification-specific actions
    if (notification.data?.requestId && notification.actionRequired) {
      onNDAAction?.(notification.data.requestId, 'view');
    }

    onNotificationAction?.(notification.id, 'view');
  };

  const handleBulkAction = (action: 'read' | 'delete') => {
    const selectedNotifications = Array.from(selectedIds);

    if (action === 'read') {
      handleMarkAsRead(selectedNotifications);
    } else {
      handleDelete(selectedNotifications);
    }

    setSelectedIds(new Set());
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const urgentCount = notifications.filter(n => n.isUrgent && !n.isRead).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">NDA Notifications</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
              <div className="text-xs text-gray-500">Unread</div>
            </div>
            {urgentCount > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{urgentCount}</div>
                <div className="text-xs text-gray-500">Urgent</div>
              </div>
            )}
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="nda_request">NDA Requests</option>
            <option value="nda_approved">Approvals</option>
            <option value="nda_rejected">Rejections</option>
            <option value="nda_expiring">Expiring</option>
            <option value="nda_expired">Expired</option>
          </select>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Unread only</span>
          </label>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'priority')}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="date">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => handleMarkAsRead(notifications.filter(n => !n.isRead).map(n => n.id))}
              disabled={unreadCount === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Mark All Read
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedIds.size} notification(s) selected
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkAction('read')}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Mark as Read
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredAndSortedNotifications.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Notifications</h3>
            <p className="text-gray-500">
              {notifications.length === 0
                ? "You're all caught up! No new notifications."
                : "No notifications match your current filters."}
            </p>
          </div>
        ) : (
          filteredAndSortedNotifications.map((notification) => {
            const IconComponent = NOTIFICATION_ICONS[notification.type];
            const colorClasses = NOTIFICATION_COLORS[notification.type];

            return (
              <div
                key={notification.id}
                className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer ${
                  !notification.isRead ? 'border-l-4 border-l-blue-500' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(notification.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.checked) {
                        setSelectedIds(prev => new Set([...prev, notification.id]));
                      } else {
                        setSelectedIds(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(notification.id);
                          return newSet;
                        });
                      }
                    }}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />

                  <div className={`p-2 rounded-lg border ${colorClasses}`}>
                    <IconComponent className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`text-sm font-semibold ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </h3>

                          {notification.isUrgent && (
                            <Zap className="w-4 h-4 text-yellow-500" />
                          )}

                          {notification.actionRequired && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                              Action Required
                            </span>
                          )}

                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full" />
                          )}
                        </div>

                        <p className={`text-sm ${!notification.isRead ? 'text-gray-800' : 'text-gray-600'}`}>
                          {notification.message}
                        </p>

                        {/* Additional context based on notification type */}
                        {notification.data?.expiresAt && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>
                              Expires in {formatDistanceToNow(new Date(notification.data.expiresAt))}
                            </span>
                          </div>
                        )}

                        {notification.data?.reason && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                            <strong>Reason:</strong> {notification.data.reason}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>

                        <div className="flex items-center gap-1">
                          {notification.actionRequired && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (notification.data?.requestId) {
                                  onNDAAction?.(notification.data.requestId, 'view');
                                }
                              }}
                              className="p-1 text-blue-600 hover:text-blue-700"
                              title="Take Action"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete([notification.id]);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}