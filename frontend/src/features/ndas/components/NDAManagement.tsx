import React, { useState, useEffect } from 'react';
import { 
  Shield, Clock, CheckCircle, XCircle, AlertCircle, 
  Calendar, User, Building2, FileText, Download,
  Send, Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import { API_URL } from '@/config';
import { format, formatDistanceToNow, isPast } from 'date-fns';

interface NDARequest {
  requestId: number;
  pitchId: number;
  pitchTitle: string;
  requesterId?: number;
  requesterName?: string;
  requesterCompany?: string;
  requesterType?: string;
  creatorId?: number;
  creatorName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  message: string;
  approverMessage?: string;
  customTerms?: string;
  documentUrl?: string;
  createdAt: string;
  signedAt?: string;
  expiresAt?: string;
}

interface NDAManagementProps {
  userType: 'creator' | 'investor' | 'production';
  userId: number;
}

const NDAManagement: React.FC<NDAManagementProps> = ({ userType, userId }) => {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [requests, setRequests] = useState<NDARequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<NDARequest | null>(null);
  const [approvalModal, setApprovalModal] = useState(false);
  const [approvalForm, setApprovalForm] = useState({
    approved: true,
    message: '',
    customTerms: '',
    expiryDays: 90
  });
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'expired'>('all');

  useEffect(() => {
    void fetchNDARequests();
  }, [activeTab, filter]);

  const fetchNDARequests = async () => {
    try {
      setLoading(true);

      const endpoint = activeTab === 'incoming' 
        ? `/api/ndas/incoming-requests`
        : `/api/ndas/outgoing-requests`;
      
      const params = filter !== 'all' ? `?status=${filter}` : '';
      
    const response = await fetch(`${API_URL}${endpoint}${params}`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.data || []);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching NDA requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalSubmit = async () => {
    if (!selectedRequest) return;

    try {
    const response = await fetch(`${API_URL}/api/ndas/${selectedRequest.requestId}/${approvalForm.approved ? 'approve' : 'reject'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send cookies for Better Auth session
      body: JSON.stringify({
        notes: approvalForm.message,
        reason: approvalForm.approved ? undefined : approvalForm.message,
        customTerms: approvalForm.customTerms
      })
    });

      if (response.ok) {
        // Show success message
        const message = approvalForm.approved ? 'NDA approved successfully' : 'NDA request rejected';
        alert(message);
        
        // Refresh requests
        void fetchNDARequests();
        
        // Close modal
        setApprovalModal(false);
        setSelectedRequest(null);
        setApprovalForm({
          approved: true,
          message: '',
          customTerms: '',
          expiryDays: 90
        });
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to process NDA request'}`);
      }
    } catch (error) {
      console.error('Error processing NDA:', error);
      alert('Failed to process NDA request');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'expired': return <AlertCircle className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  return (
    <div className="nda-management">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">NDA Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your non-disclosure agreements and access requests
          </p>
        </div>
        
        {/* Tab Switcher */}
        {userType === 'creator' && (
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('incoming')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === 'incoming'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Incoming Requests
            </button>
            <button
              onClick={() => setActiveTab('outgoing')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === 'outgoing'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              My Requests
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2 mb-6">
        <span className="text-sm text-gray-600">Filter:</span>
        {['all', 'pending', 'approved', 'rejected', 'expired'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              filter === status
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-1 text-xs">
                ({requests.filter(r => r.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* NDA Requests List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No NDA Requests</h3>
          <p className="text-gray-500">
            {activeTab === 'incoming' 
              ? 'You have no incoming NDA requests at this time.'
              : 'You haven\'t made any NDA requests yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div
              key={request.requestId}
              className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Pitch Title and Status */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {request.pitchTitle}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                            {getStatusIcon(request.status)}
                            {request.status.toUpperCase()}
                          </span>
                          {request.expiresAt && !isPast(new Date(request.expiresAt)) && (
                            <span className="text-xs text-gray-500">
                              Expires {formatDistanceToNow(new Date(request.expiresAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Requester/Creator Info */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">
                          {activeTab === 'incoming' ? 'Requester' : 'Creator'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {activeTab === 'incoming' ? (
                            request.requesterType === 'production' ? (
                              <Building2 className="w-4 h-4 text-gray-400" />
                            ) : (
                              <User className="w-4 h-4 text-gray-400" />
                            )
                          ) : (
                            <User className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-sm font-medium text-gray-900">
                            {activeTab === 'incoming' 
                              ? (request.requesterCompany || request.requesterName)
                              : request.creatorName}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">Requested</p>
                        <p className="text-sm text-gray-900 mt-1">
                          {format(new Date(request.createdAt), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>

                    {/* Message */}
                    {request.message && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-500 mb-1">Message</p>
                        <p className="text-sm text-gray-700 italic">"{request.message}"</p>
                      </div>
                    )}

                    {/* Approval/Rejection Message */}
                    {request.approverMessage && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500 mb-1">
                          {request.status === 'approved' ? 'Approval Note' : 'Rejection Reason'}
                        </p>
                        <p className="text-sm text-gray-700">{request.approverMessage}</p>
                      </div>
                    )}

                    {/* Custom Terms */}
                    {request.customTerms && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-500 mb-1">Additional Terms</p>
                        <p className="text-sm text-gray-700">{request.customTerms}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {activeTab === 'incoming' && request.status === 'pending' && userType === 'creator' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setApprovalForm({ ...approvalForm, approved: true });
                              setApprovalModal(true);
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setApprovalForm({ ...approvalForm, approved: false });
                              setApprovalModal(true);
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {request.status === 'approved' && request.documentUrl && (
                        <a
                          href={request.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                        >
                          <Download className="w-4 h-4" />
                          Download NDA
                        </a>
                      )}

                      {request.status === 'approved' && activeTab === 'outgoing' && (
                        <button
                          onClick={() => window.location.href = `/pitch/${request.pitchId}`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          View Pitch
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval Modal */}
      {approvalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {approvalForm.approved ? 'Approve' : 'Reject'} NDA Request
            </h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Pitch: <span className="font-medium">{selectedRequest.pitchTitle}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Requester: <span className="font-medium">
                    {selectedRequest.requesterCompany || selectedRequest.requesterName}
                  </span>
                </p>
              </div>

              {approvalForm.approved && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Validity Period (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={approvalForm.expiryDays}
                      onChange={(e) => setApprovalForm({
                        ...approvalForm,
                        expiryDays: parseInt(e.target.value) || 90
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Terms (optional)
                    </label>
                    <textarea
                      value={approvalForm.customTerms}
                      onChange={(e) => setApprovalForm({
                        ...approvalForm,
                        customTerms: e.target.value
                      })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Any additional terms or conditions..."
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message {approvalForm.approved ? '(optional)' : ''}
                </label>
                <textarea
                  value={approvalForm.message}
                  onChange={(e) => setApprovalForm({
                    ...approvalForm,
                    message: e.target.value
                  })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={approvalForm.approved 
                    ? "Add a message for the requester..." 
                    : "Please provide a reason for rejection..."}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setApprovalModal(false);
                    setSelectedRequest(null);
                    setApprovalForm({
                      approved: true,
                      message: '',
                      customTerms: '',
                      expiryDays: 90
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprovalSubmit}
                  className={`px-4 py-2 rounded-lg transition text-white font-medium ${
                    approvalForm.approved
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {approvalForm.approved ? 'Approve Request' : 'Reject Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NDAManagement;