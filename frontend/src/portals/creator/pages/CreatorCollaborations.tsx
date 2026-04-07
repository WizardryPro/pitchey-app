import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Handshake, Star, Clock, CheckCircle, XCircle,
  AlertCircle, Search, Calendar,
  DollarSign, MessageSquare, Eye, FileText,
  Building, Users as UsersIcon, Award, TrendingUp,
  Globe, Lock, Plus, Download, Share2, User
} from 'lucide-react';
import { CollaborationService, type Collaboration as ApiCollaboration } from '@/services/collaboration.service';
import CollaborationTimeline from '@/components/CollaborationTimeline';

interface Collaboration {
  id: string;
  title: string;
  type: 'co-creation' | 'investment' | 'production' | 'distribution' | 'talent';
  status: 'pending' | 'active' | 'completed' | 'declined' | 'cancelled';
  partner: {
    id: string;
    name: string;
    type: 'creator' | 'investor' | 'production' | 'distributor' | 'talent';
    avatar?: string;
    company?: string;
    verified: boolean;
  };
  project?: {
    id: string;
    title: string;
    genre: string;
  };
  description: string;
  terms?: {
    budget?: number;
    equity?: number;
    timeline?: string;
    deliverables?: string[];
  };
  proposedDate: string;
  startDate?: string;
  endDate?: string;
  lastUpdate: string;
  priority: 'low' | 'medium' | 'high';
  isPublic: boolean;
  metrics?: {
    rating?: number;
    reviews?: number;
    completionRate?: number;
  };
}

interface CollaborationFilters {
  type: 'all' | 'co-creation' | 'investment' | 'production' | 'distribution' | 'talent';
  status: 'all' | 'pending' | 'active' | 'completed' | 'declined' | 'cancelled';
  partner: 'all' | 'creator' | 'investor' | 'production' | 'distributor' | 'talent';
  timeRange: '7d' | '30d' | '90d' | 'all';
}

export default function CreatorCollaborations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [filteredCollaborations, setFilteredCollaborations] = useState<Collaboration[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CollaborationFilters>({
    type: 'all',
    status: 'all',
    partner: 'all',
    timeRange: 'all'
  });

  useEffect(() => {
    loadCollaborations();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [collaborations, filters, searchQuery]);

  const loadCollaborations = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch collaborations from API
      const apiCollaborations = await CollaborationService.getCollaborations({
        type: filters.type !== 'all' ? filters.type : undefined,
        status: filters.status !== 'all' ? filters.status : undefined
      });

      // Transform API response to component's Collaboration interface
      const transformedCollaborations: Collaboration[] = apiCollaborations.map((c: ApiCollaboration) => ({
        id: c.id,
        title: c.title,
        type: c.type,
        status: c.status,
        partner: c.partner,
        project: c.project,
        description: c.description,
        terms: c.terms,
        proposedDate: c.proposedDate,
        startDate: c.startDate,
        endDate: c.endDate,
        lastUpdate: c.lastUpdate,
        priority: c.priority,
        isPublic: c.isPublic,
        metrics: c.metrics
      }));

      setCollaborations(transformedCollaborations);
    } catch (err) {
      console.error('Failed to load collaborations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load collaborations');
      setCollaborations([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...collaborations];

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(collab =>
        collab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        collab.partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        collab.partner.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        collab.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        collab.project?.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(collab => collab.type === filters.type);
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(collab => collab.status === filters.status);
    }

    // Apply partner type filter
    if (filters.partner !== 'all') {
      filtered = filtered.filter(collab => collab.partner.type === filters.partner);
    }

    // Apply time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const timeRanges: Record<string, number> = {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
      };

      const rangeMs = timeRanges[filters.timeRange];
      if (rangeMs) {
        const cutoff = new Date(now.getTime() - rangeMs);
        filtered = filtered.filter(collab => new Date(collab.lastUpdate) > cutoff);
      }
    }

    setFilteredCollaborations(filtered);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'co-creation': return 'bg-purple-100 text-purple-800';
      case 'investment': return 'bg-green-100 text-green-800';
      case 'production': return 'bg-blue-100 text-blue-800';
      case 'distribution': return 'bg-orange-100 text-orange-800';
      case 'talent': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return Clock;
      case 'active': return CheckCircle;
      case 'completed': return Award;
      case 'declined': return XCircle;
      case 'cancelled': return AlertCircle;
      default: return Clock;
    }
  };

  const getPartnerIcon = (type: string) => {
    switch (type) {
      case 'creator': return User;
      case 'investor': return DollarSign;
      case 'production': return Building;
      case 'distributor': return Globe;
      case 'talent': return Star;
      default: return User;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  const statusCounts = collaborations.reduce((counts, collab) => {
    counts[collab.status] = (counts[collab.status] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Collaborations</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage partnerships, investments, and creative collaborations
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <button
              onClick={() => {
                const csvContent = ['Partner,Type,Status,Value'].concat(
                  collaborations.map(c => `"${c.title}",${c.type},${c.status},${c.terms?.budget || 0}`)
                ).join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'collaborations-export.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
            <button
              onClick={() => navigate('/creator/collaborations/new')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Collaboration
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total</span>
              <Handshake className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{collaborations.length}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Active</span>
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{statusCounts.active || 0}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Pending</span>
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{statusCounts.pending || 0}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Completed</span>
              <Award className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{statusCounts.completed || 0}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Success Rate</span>
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {Math.round(((statusCounts.completed || 0) / Math.max(collaborations.length, 1)) * 100)}%
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search collaborations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Types</option>
                <option value="co-creation">Co-Creation</option>
                <option value="investment">Investment</option>
                <option value="production">Production</option>
                <option value="distribution">Distribution</option>
                <option value="talent">Talent</option>
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="declined">Declined</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={filters.partner}
                onChange={(e) => setFilters(prev => ({ ...prev, partner: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Partners</option>
                <option value="creator">Creators</option>
                <option value="investor">Investors</option>
                <option value="production">Production</option>
                <option value="distributor">Distributors</option>
                <option value="talent">Talent</option>
              </select>

              <select
                value={filters.timeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Time</option>
                <option value="7d">Last Week</option>
                <option value="30d">Last Month</option>
                <option value="90d">Last Quarter</option>
              </select>
            </div>
          </div>
        </div>

        {/* Collaborations List */}
        {filteredCollaborations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <Handshake className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No collaborations found</h3>
            <p className="text-gray-600 mb-6">
              {collaborations.length === 0 
                ? "Start building partnerships to grow your creative projects."
                : "No collaborations match your current filters."
              }
            </p>
            <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Create First Collaboration
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCollaborations.map((collaboration) => {
              const StatusIcon = getStatusIcon(collaboration.status);
              const PartnerIcon = getPartnerIcon(collaboration.partner.type);
              
              return (
                <div key={collaboration.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{collaboration.title}</h3>
                          
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(collaboration.type)}`}>
                            {collaboration.type.replace('-', ' ')}
                          </span>
                          
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(collaboration.status)}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {collaboration.status}
                          </span>
                          
                          {collaboration.isPublic ? (
                            <Globe className="w-4 h-4 text-green-600" />
                          ) : (
                            <Lock className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">{collaboration.description}</p>
                      </div>
                    </div>

                    {/* Partner Info */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <PartnerIcon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{collaboration.partner.name}</p>
                            {collaboration.partner.verified && (
                              <CheckCircle className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {collaboration.partner.company || collaboration.partner.type}
                            {collaboration.project && (
                              <span> • {collaboration.project.title}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {collaboration.priority === 'high' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          High Priority
                        </span>
                      )}
                    </div>

                    {/* Terms & Metrics */}
                    {collaboration.terms && (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        {collaboration.terms.budget && (
                          <div>
                            <p className="text-xs text-gray-500">Budget</p>
                            <p className="text-sm font-medium text-gray-900">
                              {formatCurrency(collaboration.terms.budget)}
                            </p>
                          </div>
                        )}
                        
                        {collaboration.terms.equity && (
                          <div>
                            <p className="text-xs text-gray-500">Equity</p>
                            <p className="text-sm font-medium text-gray-900">
                              {collaboration.terms.equity}%
                            </p>
                          </div>
                        )}
                        
                        {collaboration.terms.timeline && (
                          <div>
                            <p className="text-xs text-gray-500">Timeline</p>
                            <p className="text-sm font-medium text-gray-900">
                              {collaboration.terms.timeline}
                            </p>
                          </div>
                        )}

                        {collaboration.metrics && (
                          <div>
                            <p className="text-xs text-gray-500">Rating</p>
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-400 fill-current" />
                              <p className="text-sm font-medium text-gray-900">
                                {collaboration.metrics.rating}/10
                              </p>
                              <span className="text-xs text-gray-500">
                                ({collaboration.metrics.reviews} reviews)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dates & Progress */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Proposed {formatDate(collaboration.proposedDate)}</span>
                        </div>
                        
                        {collaboration.startDate && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Started {formatDate(collaboration.startDate)}</span>
                          </div>
                        )}
                        
                        {collaboration.endDate && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            <span>Completed {formatDate(collaboration.endDate)}</span>
                          </div>
                        )}
                      </div>
                      
                      <span>Updated {formatDate(collaboration.lastUpdate)}</span>
                    </div>

                    {/* Progress Timeline */}
                    <div className="pt-3">
                      <CollaborationTimeline collaborationId={collaboration.id} />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <button
                        onClick={() => navigate(`/collaboration/${collaboration.id}`)}
                        className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                      >
                        <Eye className="w-4 h-4 mr-1 inline" />
                        View Details
                      </button>
                      
                      <button
                        onClick={() => navigate(`/creator/messages?subject=${encodeURIComponent('Re: ' + collaboration.title)}`)}
                        className="px-3 py-2 text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/collaboration/${collaboration.id}`)}
                        className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}