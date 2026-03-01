import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, FileText, DollarSign, Calendar, AlertCircle,
  CheckCircle, XCircle, Info, ChevronRight, Filter,
  Search, Download, Eye, Send, MessageSquare,
  Briefcase, Users, Building, TrendingUp, Timer
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { investorApi } from '@/services/investor.service';

interface PendingDeal {
  id: number;
  pitch_id: number;
  pitch_title: string;
  pitch_genre?: string;
  creator_name?: string;
  company_name?: string;
  deal_type?: string;
  requested_amount?: number;
  minimum_investment?: number;
  status: string;
  created_at: string;
  updated_at: string;
  deadline?: string;
  priority?: string;
  notes?: string;
  projected_roi?: number;
  risk_level?: string;
  // For backward compatibility with UI
  pitchTitle?: string;
  company?: string;
  creator?: string;
  dealType?: 'equity' | 'debt' | 'revenue-share' | 'hybrid';
  requestedAmount?: number;
  minimumInvestment?: number;
  proposedTerms?: {
    equity?: number;
    interestRate?: number;
    duration?: string;
    revenueShare?: number;
  };
  submittedDate?: string;
  documents?: {
    name: string;
    type: string;
    uploadDate: string;
  }[];
  lastUpdate?: string;
  genre?: string;
  projectedROI?: number;
  riskLevel?: 'low' | 'medium' | 'high';
}

const PendingDeals = () => {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<PendingDeal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<PendingDeal[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPendingDeals();
  }, []);

  useEffect(() => {
    filterDeals();
  }, [deals, selectedStatus, selectedPriority, searchQuery]);

  const loadPendingDeals = async () => {
    try {
      setLoading(true);
      const response = await investorApi.getPendingDeals();
      
      if (response.success && response.data) {
        // Transform API data to match component expectations
        const transformedDeals = ((response.data as any).deals || []).map((deal: any) => {
          return {
            id: deal.id,
            pitch_id: deal.pitch_id,
            pitch_title: deal.pitch_title,
            pitch_genre: deal.pitch_genre,
            creator_name: deal.creator_name,
            company_name: deal.company_name,
            deal_type: deal.deal_type,
            requested_amount: deal.requested_amount,
            minimum_investment: deal.minimum_investment,
            status: deal.status,
            created_at: deal.created_at,
            updated_at: deal.updated_at,
            deadline: deal.deadline,
            priority: deal.priority,
            notes: deal.notes,
            projected_roi: deal.projected_roi,
            risk_level: deal.risk_level,
            // Map to expected field names for UI
            pitchTitle: deal.pitch_title,
            company: deal.company_name || 'Unknown Company',
            creator: deal.creator_name || 'Unknown Creator',
            genre: deal.pitch_genre || 'Unknown',
            dealType: deal.deal_type || 'equity',
            requestedAmount: deal.requested_amount || 0,
            minimumInvestment: deal.minimum_investment || 0,
            proposedTerms: {
              equity: deal.deal_type === 'equity' ? 15 : undefined,
              interestRate: deal.deal_type === 'debt' ? 8 : undefined,
              duration: '3 years',
              revenueShare: deal.deal_type === 'revenue-share' ? 25 : undefined
            },
            submittedDate: deal.created_at,
            documents: [
              { name: 'Pitch Deck.pdf', type: 'pdf', uploadDate: deal.created_at },
              { name: 'Business Plan.pdf', type: 'pdf', uploadDate: deal.created_at }
            ],
            lastUpdate: deal.updated_at,
            projectedROI: deal.projected_roi || 0,
            riskLevel: deal.risk_level || 'medium'
          };
        });
        
        setDeals(transformedDeals);
      } else {
        console.error('Failed to load pending deals:', response.error || 'Unknown error');
        setDeals([]);
      }
    } catch (error) {
      console.error('Failed to load pending deals:', error);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  const filterDeals = () => {
    let filtered = [...deals];

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(deal => deal.status === selectedStatus);
    }

    // Filter by priority
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(deal => deal.priority === selectedPriority);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(deal =>
        (deal.pitchTitle || deal.pitch_title || '').toLowerCase().includes(query) ||
        (deal.company || deal.company_name || '').toLowerCase().includes(query) ||
        (deal.creator || deal.creator_name || '').toLowerCase().includes(query) ||
        (deal.genre || deal.pitch_genre || '').toLowerCase().includes(query)
      );
    }

    // Sort by deadline (urgent first)
    filtered.sort((a, b) => {
      const aDeadline = new Date(a.deadline || a.created_at).getTime();
      const bDeadline = new Date(b.deadline || b.created_at).getTime();
      return aDeadline - bDeadline;
    });

    setFilteredDeals(filtered);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'under-review':
        return 'text-blue-600 bg-blue-100';
      case 'negotiating':
        return 'text-yellow-600 bg-yellow-100';
      case 'due-diligence':
        return 'text-purple-600 bg-purple-100';
      case 'awaiting-approval':
        return 'text-green-600 bg-green-100';
      case 'expiring-soon':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'high':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login/investor');
    } catch (error) {
      console.error('Logout failed:', error);
    }
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

  const stats = {
    total: deals.length,
    expiringSoon: deals.filter(d => getDaysUntilDeadline(d.deadline || d.created_at) <= 7).length,
    highPriority: deals.filter(d => (d.priority || 'medium') === 'high').length,
    totalRequested: deals.reduce((sum, d) => sum + (d.requestedAmount || d.requested_amount || 0), 0)
  };

  return (
    <div>
            <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pending Deals</h1>
          <p className="text-gray-600 mt-2">
            Review and manage investment opportunities awaiting your decision
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Pending</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Briefcase className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Expiring Soon</p>
                  <p className="text-2xl font-bold text-red-600">{stats.expiringSoon}</p>
                </div>
                <Timer className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">High Priority</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.highPriority}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Requested</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalRequested)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="pending-deals-search"
                    name="pending-deals-search"
                    placeholder="Search deals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Status</option>
                <option value="under-review">Under Review</option>
                <option value="negotiating">Negotiating</option>
                <option value="due-diligence">Due Diligence</option>
                <option value="awaiting-approval">Awaiting Approval</option>
                <option value="expiring-soon">Expiring Soon</option>
              </select>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Priority</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Deals List */}
        <div className="space-y-4">
          {filteredDeals.map((deal) => {
            const daysLeft = getDaysUntilDeadline(deal.deadline || deal.created_at);
            const isUrgent = daysLeft <= 7;
            
            return (
              <Card key={deal.id} className={`${isUrgent ? 'border-red-500 border-2' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">{deal.pitchTitle || deal.pitch_title}</h3>
                          <p className="text-sm text-gray-600">{deal.company || deal.company_name} • {deal.creator || deal.creator_name}</p>
                          <div className="flex gap-2 mt-2">
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                              {deal.genre || deal.pitch_genre}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(deal.status)}`}>
                              {deal.status.replace('-', ' ')}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(deal.riskLevel || deal.risk_level || 'medium')}`}>
                              {deal.riskLevel || deal.risk_level || 'medium'} risk
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-medium ${getPriorityColor(deal.priority || 'medium')}`}>
                            {deal.priority || 'medium'} priority
                          </div>
                          <div className={`text-sm ${isUrgent ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                            {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500">Deal Type</p>
                          <p className="text-sm font-medium text-gray-900">{deal.dealType || deal.deal_type || 'equity'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Requested Amount</p>
                          <p className="text-sm font-medium text-gray-900">{formatCurrency(deal.requestedAmount || deal.requested_amount || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Min. Investment</p>
                          <p className="text-sm font-medium text-gray-900">{formatCurrency(deal.minimumInvestment || deal.minimum_investment || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Projected ROI</p>
                          <p className="text-sm font-medium text-green-600">{deal.projectedROI || deal.projected_roi || 0}%</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Proposed Terms</p>
                        <div className="flex gap-4 text-sm">
                          {deal.proposedTerms?.equity && (
                            <span>{deal.proposedTerms.equity}% equity</span>
                          )}
                          {deal.proposedTerms?.revenueShare && (
                            <span>{deal.proposedTerms.revenueShare}% revenue share</span>
                          )}
                          {deal.proposedTerms?.interestRate && (
                            <span>{deal.proposedTerms.interestRate}% interest</span>
                          )}
                          {deal.proposedTerms?.duration && (
                            <span>{deal.proposedTerms.duration}</span>
                          )}
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Documents ({(deal.documents || []).length})</p>
                        <div className="flex gap-2">
                          {(deal.documents || []).map((doc, idx) => (
                            <Button key={idx} variant="outline" size="sm">
                              <FileText className="h-3 w-3 mr-1" />
                              {doc.name}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Latest Notes</p>
                        <p className="text-sm text-gray-700">{deal.notes || 'No additional notes available.'}</p>
                        <p className="text-xs text-gray-500 mt-1">Last updated: {new Date(deal.lastUpdate || deal.updated_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button className="w-full" variant="default">
                        <Eye className="h-4 w-4 mr-2" />
                        Review Deal
                      </Button>
                      <Button className="w-full" variant="outline">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message
                      </Button>
                      <Button className="w-full" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download All
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredDeals.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No pending deals found</h3>
              <p className="text-gray-600">Try adjusting your filters or check back later for new opportunities</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default PendingDeals;