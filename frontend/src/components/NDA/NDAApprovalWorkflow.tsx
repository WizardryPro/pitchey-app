import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  CheckCircle,
  XCircle,
  Send,
  MessageSquare,
  Calendar,
  User,
  Building,
  Mail,
  Search,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { useToast } from '@shared/components/feedback/ToastProvider';
import { ndaService } from '../../services/nda.service';

export interface NDAApprovalRequest {
  id: number;
  pitchId: number;
  pitchTitle: string;
  requesterId: number;
  requesterName: string;
  requesterEmail: string;
  requesterCompany?: string;
  requesterType: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  urgency: 'low' | 'medium' | 'high';
  hasCustomTerms: boolean;
}

interface NDAApprovalWorkflowProps {
  creatorId: number;
  onRequestProcessed?: (requestId: number, action: 'approved' | 'rejected') => void;
}

interface ApprovalModalData {
  request: NDAApprovalRequest;
  action: 'approve' | 'reject';
}

const URGENCY_COLORS = {
  low: 'text-green-600 bg-green-50 border-green-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  high: 'text-red-600 bg-red-50 border-red-200'
};

const STATUS_COLORS = {
  pending: 'text-blue-600 bg-blue-50 border-blue-200',
  approved: 'text-green-600 bg-green-50 border-green-200',
  rejected: 'text-red-600 bg-red-50 border-red-200',
  expired: 'text-gray-600 bg-gray-50 border-gray-200'
};

export default function NDAApprovalWorkflow({
  creatorId,
  onRequestProcessed
}: NDAApprovalWorkflowProps) {
  const [requests, setRequests] = useState<NDAApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [selectedRequests, setSelectedRequests] = useState<Set<number>>(new Set());
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalModalData, setApprovalModalData] = useState<ApprovalModalData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'urgency' | 'requester'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [_showBulkActions, setShowBulkActions] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    void loadNDARequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorId]);

  const loadNDARequests = async () => {
    try {
      setLoading(true);
      const data = await ndaService.getNDAs({
        creatorId,
        limit: 50
      });
      
      // Transform the data to include urgency calculation
      const transformedRequests = data.ndas.map(nda => ({
        id: nda.id,
        pitchId: nda.pitchId || 0,
        pitchTitle: nda.pitch?.title || 'Unknown Pitch',
        requesterId: nda.requesterId || 0,
        requesterName: nda.requester?.firstName || nda.requester?.username || 'Unknown User',
        requesterEmail: nda.requester?.email || '',
        requesterCompany: nda.requester?.companyName || '',
        requesterType: nda.requester?.userType || 'investor',
        message: nda.message || '',
        status: nda.status as 'pending' | 'approved' | 'rejected' | 'expired',
        createdAt: nda.createdAt,
        urgency: calculateUrgency(nda.createdAt, nda.requester?.userType || 'investor'),
        hasCustomTerms: Boolean(nda.customTerms)
      }));
      
      setRequests(transformedRequests);
    } catch (err) {
      console.error('Failed to load NDA requests:', err);
      error('Failed to Load', 'Unable to load NDA requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateUrgency = (createdAt: string, requesterType: string): 'low' | 'medium' | 'high' => {
    const now = new Date();
    const created = new Date(createdAt);
    const hoursSinceCreated = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    
    // High-value requesters get higher urgency
    const isHighValue = ['production', 'distributor', 'investor'].includes(requesterType.toLowerCase());
    
    if (hoursSinceCreated > 72) return 'high'; // Over 3 days
    if (hoursSinceCreated > 24 && isHighValue) return 'high'; // Over 1 day for high-value
    if (hoursSinceCreated > 48) return 'medium'; // Over 2 days
    if (hoursSinceCreated > 12 && isHighValue) return 'medium'; // Over 12 hours for high-value
    return 'low';
  };

  const filteredAndSortedRequests = useMemo(() => {
    const filtered = requests.filter(request => {
      const matchesSearch = searchTerm === '' || 
        request.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.pitchTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.requesterCompany?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      const matchesUrgency = urgencyFilter === 'all' || request.urgency === urgencyFilter;
      
      return matchesSearch && matchesStatus && matchesUrgency;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'urgency': {
          const urgencyOrder = { high: 3, medium: 2, low: 1 };
          comparison = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
          break;
        }
        case 'requester':
          comparison = a.requesterName.localeCompare(b.requesterName);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [requests, searchTerm, statusFilter, urgencyFilter, sortBy, sortOrder]);

  const handleApprovalAction = (request: NDAApprovalRequest, action: 'approve' | 'reject') => {
    setApprovalModalData({ request, action });
    setShowApprovalModal(true);
  };

  const processApproval = async (notes: string, customTerms?: string, expiryDays?: number) => {
    if (!approvalModalData) return;
    
    const { request, action } = approvalModalData;
    
    try {
      setProcessingIds(prev => new Set([...prev, request.id]));
      
      if (action === 'approve') {
        await ndaService.approveNDA(request.id, notes, customTerms, expiryDays);
        success('NDA Approved', `NDA request from ${request.requesterName} has been approved.`);
      } else {
        await ndaService.rejectNDA(request.id, notes);
        success('NDA Rejected', `NDA request from ${request.requesterName} has been rejected.`);
      }
      
      // Update local state
      setRequests(prev => prev.map(r => 
        r.id === request.id 
          ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' }
          : r
      ));
      
      onRequestProcessed?.(request.id, action === 'approve' ? 'approved' : 'rejected');
      
    } catch (err) {
      console.error(`Failed to ${action} NDA:`, err);
      error(`${action === 'approve' ? 'Approval' : 'Rejection'} Failed`, 
        `Unable to ${action} the NDA request. Please try again.`);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(request.id);
        return newSet;
      });
      setShowApprovalModal(false);
      setApprovalModalData(null);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject', reason?: string) => {
    const selectedRequestIds = Array.from(selectedRequests);
    
    try {
      if (action === 'approve') {
        const result = await ndaService.bulkApprove(selectedRequestIds);
        success('Bulk Approval Complete', 
          `${result.successful.length} NDAs approved successfully. ${result.failed.length} failed.`);
      } else if (reason) {
        const result = await ndaService.bulkReject(selectedRequestIds, reason);
        success('Bulk Rejection Complete', 
          `${result.successful.length} NDAs rejected successfully. ${result.failed.length} failed.`);
      }
      
      await loadNDARequests();
      setSelectedRequests(new Set());
      setShowBulkActions(false);
      
    } catch (_err) {
      error('Bulk Action Failed', 'Unable to complete bulk action. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const urgentCount = requests.filter(r => r.urgency === 'high' && r.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">NDA Approval Workflow</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{pendingCount}</div>
              <div className="text-xs text-gray-500">Pending</div>
            </div>
            {urgentCount > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{urgentCount}</div>
                <div className="text-xs text-gray-500">Urgent</div>
              </div>
            )}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
          
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Urgency</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'urgency' | 'requester')}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="date">Sort by Date</option>
              <option value="urgency">Sort by Urgency</option>
              <option value="requester">Sort by Requester</option>
            </select>
            
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedRequests.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedRequests.size} request(s) selected
            </span>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => { void handleBulkAction('approve'); }}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Bulk Approve
              </button>
              <button
                onClick={() => setShowBulkActions(true)}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Bulk Reject
              </button>
              <button
                onClick={() => setSelectedRequests(new Set())}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NDA Requests List */}
      <div className="space-y-4">
        {filteredAndSortedRequests.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No NDA Requests</h3>
            <p className="text-gray-500">
              {requests.length === 0 
                ? "You haven't received any NDA requests yet."
                : "No requests match your current filters."}
            </p>
          </div>
        ) : (
          filteredAndSortedRequests.map((request) => (
            <div key={request.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedRequests.has(request.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRequests(prev => new Set([...prev, request.id]));
                      } else {
                        setSelectedRequests(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(request.id);
                          return newSet;
                        });
                      }
                    }}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{request.pitchTitle}</h3>
                      
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_COLORS[request.status]}`}>
                        {request.status}
                      </span>
                      
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${URGENCY_COLORS[request.urgency]}`}>
                        {request.urgency} priority
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span className="font-medium">{request.requesterName}</span>
                        <span className="text-gray-400">({request.requesterType})</span>
                      </div>
                      
                      {request.requesterCompany && (
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          <span>{request.requesterCompany}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span>{request.requesterEmail}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(request.createdAt)}</span>
                      </div>
                    </div>
                    
                    {request.message && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
                          <p className="text-sm text-gray-700">{request.message}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                {request.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprovalAction(request, 'approve')}
                      disabled={processingIds.has(request.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    
                    <button
                      onClick={() => handleApprovalAction(request, 'reject')}
                      disabled={processingIds.has(request.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => { void ndaService.sendReminder(request.id); }}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Send className="w-4 h-4" />
                  Send Reminder
                </button>
                
                {processingIds.has(request.id) && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    Processing...
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Approval/Rejection Modal */}
      {showApprovalModal && approvalModalData && (
        <ApprovalModal
          request={approvalModalData.request}
          action={approvalModalData.action}
          onConfirm={processApproval}
          onCancel={() => {
            setShowApprovalModal(false);
            setApprovalModalData(null);
          }}
        />
      )}
    </div>
  );
}

interface ApprovalModalProps {
  request: NDAApprovalRequest;
  action: 'approve' | 'reject';
  onConfirm: (notes: string, customTerms?: string, expiryDays?: number) => Promise<void>;
  onCancel: () => void;
}

function ApprovalModal({ request, action, onConfirm, onCancel }: ApprovalModalProps) {
  const [notes, setNotes] = useState('');
  const [customTerms, setCustomTerms] = useState('');
  const [expiryDays, setExpiryDays] = useState(90);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onConfirm(notes, customTerms, expiryDays);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {action === 'approve' ? 'Approve' : 'Reject'} NDA Request
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {request.requesterName} • {request.pitchTitle}
            </p>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {action === 'approve' ? 'Approval Notes (Optional)' : 'Rejection Reason'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={action === 'approve' 
                  ? 'Add any notes for the requester...'
                  : 'Please provide a reason for rejection...'}
                required={action === 'reject'}
              />
            </div>

            {action === 'approve' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NDA Validity Period
                  </label>
                  <select
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days (recommended)</option>
                    <option value={180}>6 months</option>
                    <option value={365}>1 year</option>
                  </select>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                  </button>
                </div>

                {showAdvanced && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Terms (Optional)
                    </label>
                    <textarea
                      value={customTerms}
                      onChange={(e) => setCustomTerms(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Add any custom terms or conditions..."
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-lg text-white ${
                action === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {action === 'approve' ? 'Approve NDA' : 'Reject NDA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}