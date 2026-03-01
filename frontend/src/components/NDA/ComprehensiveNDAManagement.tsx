import { useState, useEffect } from 'react';
import { 
  Shield, CheckCircle, Clock, XCircle, AlertTriangle,
  Download, Eye, Mail, Calendar, Search, Filter,
  MoreHorizontal, Bell, Users, TrendingUp, FileText,
  ArrowUp, ArrowDown, RefreshCw, Trash2, Send
} from 'lucide-react';
import { ndaService } from '../../services/nda.service';
import type { NDA, NDARequest } from '@shared/types/nda.types';
import NDAManagementPanel from '../NDAManagementPanel';
import NDAStatusBadge from '../NDAStatusBadge';
import { useBetterAuthStore } from '../../store/betterAuthStore';

interface ComprehensiveNDAManagementProps {
  userType: 'creator' | 'investor' | 'production';
  userId: number;
}

interface NDAAnalytics {
  totalRequests: number;
  approvalRate: number;
  avgResponseTime: number;
  monthlyTrends: Array<{
    month: string;
    requests: number;
    approved: number;
  }>;
}

interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  requiresConfirmation: boolean;
}

export default function ComprehensiveNDAManagement({ 
  userType, 
  userId 
}: ComprehensiveNDAManagementProps) {
  const { isAuthenticated } = useBetterAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'incoming' | 'outgoing' | 'signed' | 'analytics'>('overview');
  const [incomingNDAs, setIncomingNDAs] = useState<NDARequest[]>([]);
  const [outgoingNDAs, setOutgoingNDAs] = useState<NDARequest[]>([]);
  const [signedNDAs, setSignedNDAs] = useState<NDARequest[]>([]);
  const [analytics, setAnalytics] = useState<NDAAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNDAs, setSelectedNDAs] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'expired'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'status' | 'urgency'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showBulkActions, setShowBulkActions] = useState(false);

  const bulkActions: BulkAction[] = userType === 'creator' ? [
    {
      id: 'approve',
      label: 'Approve Selected',
      icon: CheckCircle,
      color: 'text-green-600 bg-green-100 hover:bg-green-200',
      requiresConfirmation: false
    },
    {
      id: 'reject',
      label: 'Reject Selected',
      icon: XCircle,
      color: 'text-red-600 bg-red-100 hover:bg-red-200',
      requiresConfirmation: true
    },
    {
      id: 'remind',
      label: 'Send Reminders',
      icon: Bell,
      color: 'text-blue-600 bg-blue-100 hover:bg-blue-200',
      requiresConfirmation: false
    }
  ] : [
    {
      id: 'download',
      label: 'Download Selected',
      icon: Download,
      color: 'text-purple-600 bg-purple-100 hover:bg-purple-200',
      requiresConfirmation: false
    },
    {
      id: 'remind',
      label: 'Send Follow-ups',
      icon: Send,
      color: 'text-blue-600 bg-blue-100 hover:bg-blue-200',
      requiresConfirmation: false
    }
  ];

  useEffect(() => {
    // Only fetch NDA data if we have a valid userId AND user is authenticated
    if (isAuthenticated && userId && userId > 0) {
      fetchAllNDAData();
    } else {
      // Clear data if not authenticated
      setIncomingNDAs([]);
      setOutgoingNDAs([]);
      setSignedNDAs([]);
      setAnalytics(null);
      setLoading(false);
    }
  }, [userType, userId, isAuthenticated]);

  const fetchAllNDAData = async () => {
    // Double-check authentication before making API calls
    if (!isAuthenticated || !userId || userId <= 0) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      if (userType === 'creator') {
        // For creators: incoming requests from others (pending approval)
        const incomingResult = await ndaService.getIncomingRequests();
        setIncomingNDAs(incomingResult.ndaRequests);
        
        // Get signed NDAs where creator approved
        const signedResult = await ndaService.getSignedNDAs();
        setSignedNDAs(signedResult.ndaRequests);
      } else {
        // For investors/production: outgoing requests to creators
        const outgoingResult = await ndaService.getOutgoingRequests();
        setOutgoingNDAs(outgoingResult.ndaRequests);
        
        // Get signed NDAs where they are the requester
        const signedResult = await ndaService.getSignedNDAs();
        setSignedNDAs(signedResult.ndaRequests);
      }

      // Fetch analytics
      const stats = await ndaService.getNDAStats();
      setAnalytics({
        totalRequests: stats.total,
        approvalRate: stats.approvalRate || 0,
        avgResponseTime: stats.avgResponseTime || 0,
        monthlyTrends: [] // Would need additional API endpoint
      });

    } catch (error: any) {
      // Handle authentication errors silently - user might not be logged in yet
      if (error?.response?.status === 401 || error?.message?.includes('401')) {
        // Clear any stale data
        setIncomingNDAs([]);
        setOutgoingNDAs([]);
        setSignedNDAs([]);
      } else {
        console.error('Failed to fetch NDA data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNDAAction = async (ndaId: number, action: 'approve' | 'reject', reason?: string) => {
    try {
      if (action === 'approve') {
        await ndaService.approveNDA(ndaId);
      } else {
        await ndaService.rejectNDA(ndaId, reason || 'Request declined');
      }
      
      await fetchAllNDAData();
    } catch (error) {
      console.error(`Failed to ${action} NDA:`, error);
    }
  };

  const handleBulkAction = async (actionId: string) => {
    if (selectedNDAs.size === 0) return;
    
    setBulkActionLoading(true);
    const ndaIds = Array.from(selectedNDAs);
    
    try {
      switch (actionId) {
        case 'approve':
          await ndaService.bulkApprove(ndaIds);
          break;
        case 'reject':
          const reason = prompt('Enter rejection reason (optional):') || 'Bulk rejection';
          await ndaService.bulkReject(ndaIds, reason);
          break;
        case 'remind':
          for (const ndaId of ndaIds) {
            await ndaService.sendReminder(ndaId);
          }
          break;
        case 'download':
          for (const ndaId of ndaIds) {
            const blob = await ndaService.downloadNDA(ndaId, true);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `NDA-${ndaId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }
          break;
      }
      
      setSelectedNDAs(new Set());
      await fetchAllNDAData();
    } catch (error) {
      console.error('Bulk action failed:', error);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const toggleNDASelection = (ndaId: number) => {
    const newSelection = new Set(selectedNDAs);
    if (newSelection.has(ndaId)) {
      newSelection.delete(ndaId);
    } else {
      newSelection.add(ndaId);
    }
    setSelectedNDAs(newSelection);
  };

  const selectAllNDAs = (ndas: NDA[]) => {
    const allIds = ndas.map(nda => nda.id);
    if (allIds.every(id => selectedNDAs.has(id))) {
      // Deselect all
      setSelectedNDAs(new Set());
    } else {
      // Select all
      setSelectedNDAs(new Set([...selectedNDAs, ...allIds]));
    }
  };

  const sortNDAs = (ndas: NDARequest[]) => {
    return [...ndas].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.respondedAt || a.requestedAt).getTime() - 
                      new Date(b.respondedAt || b.requestedAt).getTime();
          break;
        case 'title':
          comparison = (a.pitch?.title || '').localeCompare(b.pitch?.title || '');
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'urgency':
          // Custom urgency logic based on days since request
          const aDays = Math.floor((Date.now() - new Date(a.requestedAt).getTime()) / (1000 * 60 * 60 * 24));
          const bDays = Math.floor((Date.now() - new Date(b.requestedAt).getTime()) / (1000 * 60 * 60 * 24));
          comparison = bDays - aDays; // More days = higher urgency
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const filterNDAs = (ndas: NDARequest[]) => {
    return ndas.filter(nda => {
      // Status filter
      if (filterStatus !== 'all' && nda.status !== filterStatus) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          (nda.pitch?.title || '').toLowerCase().includes(query) ||
          (nda.requester?.username || '').toLowerCase().includes(query) ||
          (nda.owner?.username || '').toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  };

  const getUrgencyColor = (nda: NDARequest) => {
    if (nda.status !== 'pending') return '';
    
    const daysSinceRequest = Math.floor(
      (Date.now() - new Date(nda.requestedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceRequest > 7) return 'text-red-600';
    if (daysSinceRequest > 3) return 'text-orange-600';
    return 'text-gray-600';
  };

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'incoming': return incomingNDAs.length;
      case 'outgoing': return outgoingNDAs.length;
      case 'signed': return signedNDAs.length;
      default: return 0;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading NDA management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Shield className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">NDA Management</h1>
                <p className="text-gray-600">
                  Manage your confidentiality agreements and access requests
                </p>
              </div>
            </div>
            
            {/* Header Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={fetchAllNDAData}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              
              {selectedNDAs.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedNDAs.size} selected
                  </span>
                  <button
                    onClick={() => setShowBulkActions(!showBulkActions)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    Actions
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          {analytics && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{analytics.totalRequests}</p>
                    <p className="text-sm text-blue-700">Total Requests</p>
                  </div>
                  <FileText className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{Math.round(analytics.approvalRate)}%</p>
                    <p className="text-sm text-green-700">Approval Rate</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{Math.round(analytics.avgResponseTime)}h</p>
                    <p className="text-sm text-amber-700">Avg Response</p>
                  </div>
                  <Clock className="w-8 h-8 text-amber-500" />
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{signedNDAs.length}</p>
                    <p className="text-sm text-purple-700">Active NDAs</p>
                  </div>
                  <Shield className="w-8 h-8 text-purple-500" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { 
                id: userType === 'creator' ? 'incoming' : 'outgoing', 
                label: userType === 'creator' ? 'Incoming Requests' : 'My Requests', 
                icon: userType === 'creator' ? Mail : Send
              },
              { id: 'signed', label: 'Active NDAs', icon: Shield },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp }
            ].map((tab) => {
              const Icon = tab.icon;
              const count = getTabCount(tab.id);
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {count > 0 && (
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      activeTab === tab.id ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bulk Actions Dropdown */}
      {showBulkActions && selectedNDAs.size > 0 && (
        <div className="absolute top-20 right-4 z-50 bg-white rounded-lg shadow-lg border p-2 min-w-48">
          {bulkActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleBulkAction(action.id)}
                disabled={bulkActionLoading}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${action.color} ${
                  bulkActionLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Icon className="w-4 h-4" />
                {action.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {[...incomingNDAs, ...outgoingNDAs, ...signedNDAs]
                  .sort((a, b) => new Date(b.respondedAt || b.requestedAt).getTime() - new Date(a.respondedAt || a.requestedAt).getTime())
                  .slice(0, 5)
                  .map((nda) => (
                    <div key={nda.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <NDAStatusBadge status={nda.status as any} showLabel={false} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {nda.pitch?.title || 'Unknown Pitch'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {userType === 'creator' ? nda.requester?.username : nda.owner?.username} • 
                          {new Date(nda.respondedAt || nda.requestedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {userType === 'creator' && incomingNDAs.filter(nda => nda.status === 'pending').length > 0 && (
                  <button
                    onClick={() => setActiveTab('incoming')}
                    className="w-full flex items-center gap-3 p-3 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition"
                  >
                    <Bell className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-medium">Pending Requests</p>
                      <p className="text-sm">
                        {incomingNDAs.filter(nda => nda.status === 'pending').length} requests need review
                      </p>
                    </div>
                  </button>
                )}
                
                <button
                  onClick={() => setActiveTab('signed')}
                  className="w-full flex items-center gap-3 p-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition"
                >
                  <Shield className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Active NDAs</p>
                    <p className="text-sm">{signedNDAs.length} active agreements</p>
                  </div>
                </button>
                
                <button
                  onClick={() => setActiveTab('analytics')}
                  className="w-full flex items-center gap-3 p-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition"
                >
                  <TrendingUp className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">View Analytics</p>
                    <p className="text-sm">Performance insights and trends</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'incoming' || activeTab === 'outgoing') && (
          <div className="space-y-6">
            {/* Filters and Search */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search NDAs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                </select>
                
                <div className="flex items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="date">Sort by Date</option>
                    <option value="title">Sort by Title</option>
                    <option value="status">Sort by Status</option>
                    <option value="urgency">Sort by Urgency</option>
                  </select>
                  
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Bulk Selection */}
              {(activeTab === 'incoming' ? incomingNDAs : outgoingNDAs).length > 0 && (
                <div className="mt-4 flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        (activeTab === 'incoming' ? incomingNDAs : outgoingNDAs)
                          .every(nda => selectedNDAs.has(nda.id))
                      }
                      onChange={() => selectAllNDAs(activeTab === 'incoming' ? incomingNDAs : outgoingNDAs as any)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-600">Select all</span>
                  </label>
                  
                  {selectedNDAs.size > 0 && (
                    <span className="text-sm text-purple-600">
                      {selectedNDAs.size} selected
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* NDA List */}
            <div className="bg-white rounded-xl shadow-sm">
              {(() => {
                const ndas = activeTab === 'incoming' ? incomingNDAs : outgoingNDAs;
                const filteredAndSorted = sortNDAs(filterNDAs(ndas));
                
                if (filteredAndSorted.length === 0) {
                  return (
                    <div className="p-12 text-center">
                      <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No NDAs found
                      </h3>
                      <p className="text-gray-500">
                        {searchQuery || filterStatus !== 'all' 
                          ? 'Try adjusting your filters or search terms'
                          : `No ${activeTab} NDAs at this time`
                        }
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div className="divide-y divide-gray-200">
                    {filteredAndSorted.map((nda) => (
                      <div key={nda.id} className="p-6 hover:bg-gray-50 transition">
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={selectedNDAs.has(nda.id)}
                            onChange={() => toggleNDASelection(nda.id)}
                            className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-lg font-medium text-gray-900 mb-2">
                                  {nda.pitch?.title || 'Unknown Pitch'}
                                </h4>
                                
                                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                                  <span>
                                    {userType === 'creator' ? 'From' : 'To'}: {' '}
                                    {userType === 'creator' ? nda.requester?.username : nda.owner?.username}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {new Date(nda.requestedAt).toLocaleDateString()}
                                  </span>
                                  <span className={getUrgencyColor(nda)}>
                                    {nda.status === 'pending' && 
                                      Math.floor((Date.now() - new Date(nda.requestedAt).getTime()) / (1000 * 60 * 60 * 24))
                                    } days ago
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <NDAStatusBadge status={nda.status as any} />
                                  
                                  {nda.requestMessage && (
                                    <button className="text-xs text-gray-500 hover:text-gray-700">
                                      View message
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 ml-4">
                                {userType === 'creator' && nda.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleNDAAction(nda.id, 'approve')}
                                      className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleNDAAction(nda.id, 'reject')}
                                      className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                
                                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                                  <Eye className="w-4 h-4" />
                                </button>
                                
                                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === 'signed' && (
          <NDAManagementPanel
            category="incoming-signed"
            items={signedNDAs.map(nda => ({
              id: nda.id,
              pitchId: nda.pitchId,
              pitchTitle: nda.pitch?.title || 'Untitled',
              status: nda.status as any,
              ndaType: 'basic' as const,
              signedDate: nda.respondedAt,
              expiresAt: nda.expiresAt,
              expiresIn: nda.expiresAt ?
                Math.ceil((new Date(nda.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) + ' days' :
                'No expiry',
              signerName: userType === 'creator' ? (nda.requester as any)?.username : (nda.owner as any)?.username,
              signerType: userType === 'creator' ? ('investor' as const) : ('creator' as const),
              accessGranted: true as const
            })) as any}
            onViewPitch={(pitchId) => window.open(`/pitch/${pitchId}`, '_blank')}
            onDownloadNDA={(item) => ndaService.downloadNDA(item.id, true)}
            title="Active NDAs"
            description="Signed confidentiality agreements"
            emptyMessage="No active NDAs found"
            showActions={false}
          />
        )}

        {activeTab === 'analytics' && analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Requests</span>
                  <span className="font-semibold">{analytics.totalRequests}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Approval Rate</span>
                  <span className="font-semibold">{Math.round(analytics.approvalRate)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Avg Response Time</span>
                  <span className="font-semibold">{Math.round(analytics.avgResponseTime)}h</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
              <div className="space-y-3">
                {analytics.avgResponseTime > 48 && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-amber-800">
                      Consider faster response times to improve relationships
                    </p>
                  </div>
                )}
                {analytics.approvalRate < 60 && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      Review rejection reasons to improve acceptance rates
                    </p>
                  </div>
                )}
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-800">
                    Great job maintaining active NDA relationships
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}