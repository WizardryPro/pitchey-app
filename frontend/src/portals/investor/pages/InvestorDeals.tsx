import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Handshake, Clock, CheckCircle, XCircle, AlertCircle,
  Calendar, FileText, Search,
  Eye, MessageSquare, Download, Users,
  Building, ArrowRight,
  RefreshCw
} from 'lucide-react';
import { API_URL } from '@/config';

interface Deal {
  id: string;
  title: string;
  type: 'equity' | 'debt' | 'revenue-share' | 'pre-purchase' | 'partnership';
  status: 'pipeline' | 'negotiation' | 'due-diligence' | 'term-sheet' | 'closed' | 'declined' | 'cancelled';
  stage: 'seed' | 'series-a' | 'series-b' | 'bridge' | 'growth';
  creator: {
    id: string;
    name: string;
    company?: string;
    avatar?: string;
    verified: boolean;
  };
  project: {
    id: string;
    title: string;
    genre: string[];
    budget: number;
    description: string;
  };
  investment: {
    amountRequested: number;
    amountOffered?: number;
    equityPercentage?: number;
    valuation?: number;
    minimumInvestment?: number;
  };
  timeline: {
    submittedDate: string;
    lastUpdated: string;
    expectedCloseDate?: string;
    actualCloseDate?: string;
  };
  documents: {
    pitchDeck: boolean;
    businessPlan: boolean;
    financials: boolean;
    termSheet: boolean;
    legalDocs: boolean;
  };
  metrics: {
    roi?: number;
    irr?: number;
    paybackPeriod?: number;
    riskScore: 'low' | 'medium' | 'high';
  };
  notes?: string;
  priority: 'low' | 'medium' | 'high';
}

interface DealFilters {
  status: 'all' | string;
  type: 'all' | string;
  stage: 'all' | string;
  priority: 'all' | string;
  timeRange: '30d' | '90d' | '1y' | 'all';
}

export default function InvestorDeals() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<DealFilters>({
    status: 'all',
    type: 'all',
    stage: 'all',
    priority: 'all',
    timeRange: 'all'
  });

  useEffect(() => {
    void loadDeals();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [deals, filters, searchQuery]);

  const [error, setError] = useState<string | null>(null);

  const loadDeals = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/investor/deals`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to load deals: ${response.status}`);
      }

      const result = await response.json() as Record<string, unknown>;
      const rawDeals = Array.isArray(result.deals) ? (result.deals as unknown[]) : [];

      // Map backend snake_case fields to frontend Deal interface
      type RawDeal = Record<string, unknown>;
      const mapped: Deal[] = (rawDeals as RawDeal[]).map((d) => {
        const creator = d.creator as Record<string, unknown> | undefined;
        const project = d.project as Record<string, unknown> | undefined;
        const investment = d.investment as Record<string, unknown> | undefined;
        const timeline = d.timeline as Record<string, unknown> | undefined;
        const metrics = d.metrics as Record<string, unknown> | undefined;
        const genre = d.genre ?? project?.genre;
        return {
          id: String(d.id),
          title: (d.title as string) || `Deal #${String(d.id)}`,
          type: (d.type as Deal['type']) || 'equity',
          status: (d.status as Deal['status']) || 'pipeline',
          stage: (d.stage as Deal['stage']) || 'seed',
          creator: {
            id: String(d.creator_id ?? creator?.id ?? ''),
            name: (d.creator_name as string) ?? (creator?.name as string) ?? 'Unknown',
            company: (d.creator_company as string | undefined) ?? (creator?.company as string | undefined),
            avatar: (d.creator_avatar as string | undefined) ?? (creator?.avatar as string | undefined),
            verified: (d.creator_verified as boolean | undefined) ?? (creator?.verified as boolean | undefined) ?? false,
          },
          project: {
            id: String(d.project_id ?? project?.id ?? d.pitch_id ?? ''),
            title: (d.project_title as string) ?? (project?.title as string) ?? (d.title as string) ?? '',
            genre: genre != null ? (Array.isArray(genre) ? (genre as string[]) : [genre as string]) : [],
            budget: Number(d.budget ?? project?.budget ?? 0),
            description: (d.description as string) ?? (project?.description as string) ?? '',
          },
          investment: {
            amountRequested: Number(d.amount_requested ?? investment?.amountRequested ?? d.amount ?? 0),
            amountOffered: d.amount_offered != null ? Number(d.amount_offered) : (investment?.amountOffered as number | undefined),
            equityPercentage: d.equity_percentage != null ? Number(d.equity_percentage) : (investment?.equityPercentage as number | undefined),
            valuation: d.valuation != null ? Number(d.valuation) : (investment?.valuation as number | undefined),
            minimumInvestment: d.minimum_investment != null ? Number(d.minimum_investment) : (investment?.minimumInvestment as number | undefined),
          },
          timeline: {
            submittedDate: (d.created_at as string) ?? (timeline?.submittedDate as string) ?? new Date().toISOString(),
            lastUpdated: (d.updated_at as string) ?? (timeline?.lastUpdated as string) ?? new Date().toISOString(),
            expectedCloseDate: (d.expected_close_date as string | undefined) ?? (timeline?.expectedCloseDate as string | undefined),
            actualCloseDate: (d.actual_close_date as string | undefined) ?? (timeline?.actualCloseDate as string | undefined),
          },
          documents: (d.documents as Deal['documents'] | null | undefined) ?? {
            pitchDeck: false,
            businessPlan: false,
            financials: false,
            termSheet: false,
            legalDocs: false,
          },
          metrics: {
            roi: d.roi != null ? Number(d.roi) : (metrics?.roi as number | undefined),
            irr: d.irr != null ? Number(d.irr) : (metrics?.irr as number | undefined),
            paybackPeriod: d.payback_period != null ? Number(d.payback_period) : (metrics?.paybackPeriod as number | undefined),
            riskScore: (d.risk_score as Deal['metrics']['riskScore']) ?? (metrics?.riskScore as Deal['metrics']['riskScore']) ?? 'medium',
          },
          notes: d.notes as string | undefined,
          priority: (d.priority as Deal['priority']) || 'medium',
        };
      });

      setDeals(mapped);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load deals:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...deals];

    // Apply search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(deal =>
        deal.title.toLowerCase().includes(q) ||
        deal.project.title.toLowerCase().includes(q) ||
        deal.creator.name.toLowerCase().includes(q) ||
        (deal.creator.company?.toLowerCase().includes(q) === true)
      );
    }

    // Apply filters
    if (filters.status !== 'all') {
      filtered = filtered.filter(deal => deal.status === filters.status);
    }

    if (filters.type !== 'all') {
      filtered = filtered.filter(deal => deal.type === filters.type);
    }

    if (filters.stage !== 'all') {
      filtered = filtered.filter(deal => deal.stage === filters.stage);
    }

    if (filters.priority !== 'all') {
      filtered = filtered.filter(deal => deal.priority === filters.priority);
    }

    if (filters.timeRange !== 'all') {
      const now = new Date();
      const timeRanges: Record<string, number> = {
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000,
        '1y': 365 * 24 * 60 * 60 * 1000
      };

      const rangeMs = timeRanges[filters.timeRange];
      if (rangeMs) {
        const cutoff = new Date(now.getTime() - rangeMs);
        filtered = filtered.filter(deal => new Date(deal.timeline.submittedDate) > cutoff);
      }
    }

    setFilteredDeals(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pipeline': return 'bg-gray-100 text-gray-800';
      case 'negotiation': return 'bg-yellow-100 text-yellow-800';
      case 'due-diligence': return 'bg-blue-100 text-blue-800';
      case 'term-sheet': return 'bg-purple-100 text-purple-800';
      case 'closed': return 'bg-indigo-100 text-indigo-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pipeline': return Clock;
      case 'negotiation': return MessageSquare;
      case 'due-diligence': return FileText;
      case 'term-sheet': return Handshake;
      case 'closed': return CheckCircle;
      case 'declined': return XCircle;
      case 'cancelled': return AlertCircle;
      default: return Clock;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'equity': return 'bg-blue-100 text-blue-800';
      case 'debt': return 'bg-indigo-100 text-indigo-800';
      case 'revenue-share': return 'bg-purple-100 text-purple-800';
      case 'pre-purchase': return 'bg-orange-100 text-orange-800';
      case 'partnership': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-indigo-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
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

  const getDocumentCompleteness = (documents: Deal['documents']) => {
    const total = Object.keys(documents).length;
    const completed = Object.values(documents).filter(Boolean).length;
    return Math.round((completed / total) * 100);
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

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12 bg-white rounded-lg">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load deals</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => { void loadDeals(); }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statusCounts = deals.reduce((counts, deal) => {
    counts[deal.status] = (counts[deal.status] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Deal Pipeline</h1>
            <p className="mt-2 text-sm text-gray-600">
              Track and manage your investment opportunities and deals
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" onClick={() => {
              const csvContent = ['Title,Status,Type,Stage,Priority,Creator,Company,Amount Requested,Risk Score,Submitted Date'].concat(
                filteredDeals.map(d => `"${d.title}","${d.status}","${d.type}","${d.stage}","${d.priority}","${d.creator.name}","${d.creator.company || ''}",${d.investment.amountRequested},"${d.metrics.riskScore}","${d.timeline.submittedDate}"`)
              ).join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'deal-pipeline.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="w-4 h-4 mr-2" />
              Export Pipeline
            </button>
            <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate('/investor/discover')}>
              <Handshake className="w-4 h-4 mr-2" />
              New Deal
            </button>
          </div>
        </div>

        {/* Pipeline Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Active Pipeline</span>
              <Handshake className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{deals.length}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">In Negotiation</span>
              <MessageSquare className="w-4 h-4 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{statusCounts.negotiation || 0}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Due Diligence</span>
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{statusCounts['due-diligence'] || 0}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Closed Deals</span>
              <CheckCircle className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{statusCounts.closed || 0}</p>
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
                  id="deals-search"
                  name="deals-search"
                  placeholder="Search deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="pipeline">Pipeline</option>
                <option value="negotiation">Negotiation</option>
                <option value="due-diligence">Due Diligence</option>
                <option value="term-sheet">Term Sheet</option>
                <option value="closed">Closed</option>
                <option value="declined">Declined</option>
              </select>

              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Types</option>
                <option value="equity">Equity</option>
                <option value="debt">Debt</option>
                <option value="revenue-share">Revenue Share</option>
                <option value="partnership">Partnership</option>
              </select>

              <select
                value={filters.stage}
                onChange={(e) => setFilters(prev => ({ ...prev, stage: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Stages</option>
                <option value="seed">Seed</option>
                <option value="series-a">Series A</option>
                <option value="series-b">Series B</option>
                <option value="bridge">Bridge</option>
                <option value="growth">Growth</option>
              </select>

              <select
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                value={filters.timeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as DealFilters['timeRange'] }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Time</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
              </select>
            </div>
          </div>
        </div>

        {/* Deals List */}
        {filteredDeals.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <Handshake className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No deals found</h3>
            <p className="text-gray-600">
              {deals.length === 0 
                ? "Your deal pipeline is empty. Start by exploring investment opportunities."
                : "No deals match your current filters."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDeals.map((deal) => {
              const StatusIcon = getStatusIcon(deal.status);
              const documentCompleteness = getDocumentCompleteness(deal.documents);
              
              return (
                <div key={deal.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{deal.title}</h3>
                          
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(deal.status)}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {deal.status.replace('-', ' ')}
                          </span>
                          
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(deal.type)}`}>
                            {deal.type.replace('-', ' ')}
                          </span>
                          
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(deal.priority)}`}>
                            {deal.priority} priority
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">{deal.project.description}</p>
                      </div>
                    </div>

                    {/* Deal Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                      {/* Investment Terms */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Investment Terms</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Requested:</span>
                            <span className="font-medium">{formatCurrency(deal.investment.amountRequested)}</span>
                          </div>
                          {deal.investment.amountOffered && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Offered:</span>
                              <span className="font-medium text-purple-600">{formatCurrency(deal.investment.amountOffered)}</span>
                            </div>
                          )}
                          {deal.investment.equityPercentage && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Equity:</span>
                              <span className="font-medium">{deal.investment.equityPercentage}%</span>
                            </div>
                          )}
                          {deal.investment.valuation && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Valuation:</span>
                              <span className="font-medium">{formatCurrency(deal.investment.valuation)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Metrics */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Financial Metrics</h4>
                        <div className="space-y-2 text-sm">
                          {deal.metrics.roi && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Projected ROI:</span>
                              <span className="font-medium text-indigo-600">{deal.metrics.roi}%</span>
                            </div>
                          )}
                          {deal.metrics.irr && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">IRR:</span>
                              <span className="font-medium">{deal.metrics.irr}%</span>
                            </div>
                          )}
                          {deal.metrics.paybackPeriod && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Payback:</span>
                              <span className="font-medium">{deal.metrics.paybackPeriod} years</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-600">Risk Score:</span>
                            <span className={`font-medium ${getRiskColor(deal.metrics.riskScore)}`}>
                              {deal.metrics.riskScore}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Timeline & Documents */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Progress</h4>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Documents</span>
                              <span className="font-medium">{documentCompleteness}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${documentCompleteness}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="text-sm">
                            <div className="flex items-center gap-1 text-gray-600">
                              <Calendar className="w-3 h-3" />
                              <span>Submitted {formatDate(deal.timeline.submittedDate)}</span>
                            </div>
                            {deal.timeline.expectedCloseDate && (
                              <div className="flex items-center gap-1 text-gray-600 mt-1">
                                <Clock className="w-3 h-3" />
                                <span>Expected close {formatDate(deal.timeline.expectedCloseDate)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Creator and Project Info */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{deal.creator.name}</p>
                            <p className="text-xs text-gray-500">
                              {deal.creator.company || 'Independent Creator'}
                              {deal.creator.verified && (
                                <CheckCircle className="w-3 h-3 inline ml-1 text-blue-600" />
                              )}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{deal.project.title}</p>
                            <p className="text-xs text-gray-500">
                              {deal.project.genre.join(', ')} • {formatCurrency(deal.project.budget)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { void navigate(`/deal/${deal.id}`); }}
                          className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </button>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
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