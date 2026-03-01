import { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  FileText, 
  User, 
  Clock, 
  Check, 
  X, 
  Eye,
  MessageSquare,
  AlertCircle,
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { ndaService, type NDA } from '../services/nda.service';
import { useToast } from '@shared/components/feedback/ToastProvider';
import { useWebSocket } from '../hooks/useWebSocket';
import { notificationService } from '../services/notification.service';

interface NDANotificationItem {
  id: number;
  type: 'request' | 'signed' | 'expired' | 'reminder';
  nda: NDA;
  pitchTitle: string;
  requesterName: string;
  timestamp: string;
  read: boolean;
}

interface NDANotificationsProps {
  className?: string;
  compact?: boolean;
}

export default function NDANotifications({ className = '', compact = false }: NDANotificationsProps) {
  const { user } = useBetterAuthStore();
  const { success, error: showError, info } = useToast();
  const [notifications, setNotifications] = useState<NDANotificationItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<NDA[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  
  // WebSocket for real-time notifications (using polling fallback as per requirements)
  const { isConnected } = useWebSocket({
    onMessage: useCallback((message: any) => {
      if (message.type === 'nda_request' || message.type === 'nda_update') {
        fetchNDANotifications();
        info('New NDA notification received');
      }
    }, [])
  });

  useEffect(() => {
    if (user?.userType === 'creator') {
      fetchNDANotifications();
    }
  }, [user]);

  const fetchNDANotifications = async () => {
    try {
      setLoading(true);
      
      // Fetch pending NDA requests for creator's pitches
      const ndaResponse = await ndaService.getNDAs({
        status: 'pending',
        creatorId: user?.id,
        limit: 20
      });
      
      setPendingRequests(ndaResponse.ndas);
      
      // Transform into notification format
      const notificationItems: NDANotificationItem[] = ndaResponse.ndas.map(nda => ({
        id: nda.id,
        type: 'request' as const,
        nda,
        pitchTitle: nda.pitch?.title || (nda as any).pitch_title || 'Unknown Pitch',
        requesterName: nda.requester?.username || (nda as any).requester_username || 'Unknown User',
        timestamp: nda.createdAt || (nda as any).created_at,
        read: false
      }));
      
      setNotifications(notificationItems);
    } catch (error) {
      console.error('Failed to fetch NDA notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveNDA = async (ndaId: number) => {
    try {
      setProcessingIds(prev => new Set(prev).add(ndaId));
      
      const approvedNDA = await ndaService.approveNDA(ndaId, 'Request approved. Please review and sign the NDA.');
      
      // Send notification to requester via notification service
      try {
        await notificationService.showNotification({
          type: 'nda_approved',
          title: 'NDA Request Approved',
          message: `Your NDA request for "${approvedNDA.pitch?.title || 'the pitch'}" has been approved. You can now sign the NDA to access protected content.`,
        } as any);
      } catch (notifError) {
        console.warn('Failed to send notification:', notifError);
      }
      
      // Refresh notifications
      await fetchNDANotifications();
      
      // Show success message
      success('NDA Approved', 'The requester has been notified and can now sign the NDA.');
    } catch (error: any) {
      console.error('Failed to approve NDA:', error);
      showError('Approval Failed', error.message || 'Failed to approve NDA request');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(ndaId);
        return newSet;
      });
    }
  };

  const rejectNDA = async (ndaId: number, reason?: string) => {
    // Use a modal or inline input instead of prompt for better UX
    const rejectionReason = reason || 'Request declined by creator';
    
    try {
      setProcessingIds(prev => new Set(prev).add(ndaId));
      
      const rejectedNDA = await ndaService.rejectNDA(ndaId, rejectionReason);
      
      // Send notification to requester
      try {
        await notificationService.showNotification({
          type: 'nda_rejected',
          title: 'NDA Request Declined',
          message: `Your NDA request for "${rejectedNDA.pitch?.title || 'the pitch'}" has been declined. Reason: ${rejectionReason}`,
        } as any);
      } catch (notifError) {
        console.warn('Failed to send notification:', notifError);
      }
      
      // Refresh notifications
      await fetchNDANotifications();
      
      info('NDA Request Declined', 'The requester has been notified.');
    } catch (error: any) {
      console.error('Failed to reject NDA:', error);
      showError('Rejection Failed', error.message || 'Failed to reject NDA request');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(ndaId);
        return newSet;
      });
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (user?.userType !== 'creator') {
    return null;
  }

  return (
    <div className={`${className}`}>
      {/* Notification Bell/Badge */}
      <div className="relative">
        <button
          onClick={() => setExpanded(!expanded)}
          className={`relative p-2 text-gray-600 hover:text-gray-900 transition-colors ${
            compact ? 'rounded-full hover:bg-gray-100' : 'rounded-lg hover:bg-gray-50'
          }`}
        >
          <Bell className={`${compact ? 'w-5 h-5' : 'w-6 h-6'}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Notifications Panel */}
        {expanded && (
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                NDA Requests
              </h3>
              <button
                onClick={() => setExpanded(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading requests...</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && notifications.length === 0 && (
              <div className="p-6 text-center">
                <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h4 className="font-medium text-gray-900 mb-1">No NDA Requests</h4>
                <p className="text-sm text-gray-600">
                  You'll see requests here when investors want access to your protected content.
                </p>
              </div>
            )}

            {/* Notification List */}
            {!loading && notifications.length > 0 && (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => {
                  const isProcessing = processingIds.has(notification.id);
                  
                  return (
                    <div key={notification.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start space-x-3">
                        {/* Icon */}
                        <div className="flex-shrink-0">
                          {notification.type === 'request' ? (
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                              <FileText className="w-4 h-4 text-purple-600" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-green-600" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                NDA Request for "{notification.pitchTitle}"
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">{notification.requesterName}</span> is requesting 
                                access to protected information
                              </p>
                              
                              {/* Requester Details */}
                              {notification.nda.requester && (
                                <div className="mt-2 text-xs text-gray-500">
                                  <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {notification.nda.requester.userType || 'User'}
                                    </span>
                                    {notification.nda.requester.companyName && (
                                      <span>{notification.nda.requester.companyName}</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Request Message */}
                              {notification.nda.message && (
                                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                                  <MessageSquare className="w-3 h-3 inline mr-1" />
                                  {notification.nda.message}
                                </div>
                              )}
                            </div>

                            <div className="flex-shrink-0 ml-2">
                              <div className="flex items-center text-xs text-gray-500">
                                <Clock className="w-3 h-3 mr-1" />
                                {formatTimeAgo(notification.timestamp)}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          {notification.type === 'request' && notification.nda.status === 'pending' && (
                            <div className="mt-3 flex space-x-2">
                              <button
                                onClick={() => approveNDA(notification.id)}
                                disabled={isProcessing}
                                className="flex items-center px-3 py-1.5 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isProcessing ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
                                ) : (
                                  <Check className="w-3 h-3 mr-1" />
                                )}
                                Approve
                              </button>
                              
                              <button
                                onClick={() => rejectNDA(notification.id)}
                                disabled={isProcessing}
                                className="flex items-center px-3 py-1.5 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Reject
                              </button>

                              <button
                                onClick={() => {
                                  // Navigate to detailed view
                                  window.location.href = `/creator/pitches/${notification.nda.pitchId}/ndas/${notification.id}`;
                                }}
                                className="flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-md hover:bg-gray-50"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View Details
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-100 text-center">
                <button
                  onClick={fetchNDANotifications}
                  disabled={loading}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Compact notification badge for headers
export function NDANotificationBadge({ className = '' }: { className?: string }) {
  return <NDANotifications className={className} compact={true} />;
}

// Full notification panel for dashboard
export function NDANotificationPanel({ className = '' }: { className?: string }) {
  const { user } = useBetterAuthStore();
  const [requests, setRequests] = useState<NDA[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.userType === 'creator') {
      fetchRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await ndaService.getNDAs({
        status: 'pending',
        creatorId: user?.id,
        limit: 10
      });
      setRequests(response.ndas);
    } catch (error) {
      console.error('Failed to fetch NDA requests:', error);
    } finally {
      setLoading(false);
    }
  };

  if (user?.userType !== 'creator') {
    return null;
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Pending NDA Requests
          </h2>
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading requests...</p>
          </div>
        )}

        {!loading && requests.length === 0 && (
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900 mb-1">No Pending Requests</h3>
            <p className="text-sm text-gray-600">
              NDA requests from investors will appear here.
            </p>
          </div>
        )}

        {!loading && requests.length > 0 && (
          <div className="space-y-4">
            {requests.slice(0, 3).map((nda) => (
              <div key={nda.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {nda.pitch?.title || (nda as any).pitch_title || 'Unknown Pitch'}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Request from <span className="font-medium">{nda.requester?.username || (nda as any).requester_username || 'Unknown User'}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(nda.createdAt || (nda as any).created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                      Approve
                    </button>
                    <button className="px-3 py-1 border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50">
                      Review
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {requests.length > 3 && (
              <div className="text-center pt-2">
                <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                  View All {requests.length} Requests
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}