import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, TrendingUp, TrendingDown, Calendar, Filter,
  Search, Download, Eye, MoreVertical, ArrowUpDown,
  Building, Film, Users, Award, Clock, AlertCircle,
  CheckCircle, XCircle, PauseCircle, PlayCircle, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { investorApi } from '@/services/investor.service';

interface Investment {
  id: number;
  pitch_id: number;
  pitch_title: string;
  pitchTitle?: string;
  pitch_genre?: string;
  creator_name?: string;
  company_name?: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  current_value?: number;
  currentValue?: number;
  roi_percentage?: number;
  stage?: string;
  ownership_percentage?: number;
  distribution_received?: number;
  exit_date?: string;
  // UI helper fields
  company?: string;
  creator?: string;
  genre?: string;
  investmentDate?: string;
  initialAmount?: number;
  roi?: number;
  ownership?: number;
  lastValuation?: string;
  distributions?: number;
  totalReturn?: number;
  performance?: 'outperforming' | 'meeting-expectations' | 'underperforming';
  nextMilestone?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  exitDate?: string;
}

const AllInvestments = () => {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [filteredInvestments, setFilteredInvestments] = useState<Investment[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'roi' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  useEffect(() => {
    loadInvestments();
  }, []);

  useEffect(() => {
    filterAndSortInvestments();
  }, [investments, selectedStatus, selectedStage, sortBy, sortOrder, searchQuery]);

  const loadInvestments = async () => {
    try {
      setLoading(true);
      const response = await investorApi.getAllInvestments();
      
      if (response.success && response.data) {
        // Transform API data to match component expectations
        const transformedInvestments = ((response.data as any)?.investments || []).map((investment: any) => {
          return {
            id: investment.id,
            pitch_id: investment.pitch_id,
            pitch_title: investment.pitch_title,
            pitch_genre: investment.pitch_genre,
            creator_name: investment.creator_name,
            company_name: investment.company_name,
            amount: investment.amount,
            status: investment.status,
            created_at: investment.created_at,
            updated_at: investment.updated_at,
            current_value: investment.current_value,
            roi_percentage: investment.roi_percentage,
            stage: investment.stage,
            ownership_percentage: investment.ownership_percentage,
            distribution_received: investment.distribution_received,
            exit_date: investment.exit_date,
            // Map to expected field names for UI
            pitchTitle: investment.pitch_title,
            company: investment.company_name || 'Unknown Company',
            creator: investment.creator_name || 'Unknown Creator',
            genre: investment.pitch_genre || 'Unknown',
            investmentDate: investment.created_at,
            initialAmount: investment.amount,
            currentValue: investment.current_value || investment.amount,
            roi: investment.roi_percentage || 0,
            ownership: investment.ownership_percentage || 0,
            lastValuation: investment.updated_at,
            distributions: investment.distribution_received || 0,
            totalReturn: (investment.current_value || investment.amount) - investment.amount,
            performance: investment.roi_percentage >= 20 ? 'outperforming' : investment.roi_percentage >= 0 ? 'meeting-expectations' : 'underperforming',
            nextMilestone: investment.stage === 'pre-production' ? 'Begin production' : investment.stage === 'production' ? 'Complete filming' : investment.stage === 'post-production' ? 'Complete editing' : 'Market release',
            riskLevel: investment.roi_percentage < 0 ? 'high' : investment.roi_percentage < 20 ? 'medium' : 'low',
            exitDate: investment.exit_date
          };
        });
        
        setInvestments(transformedInvestments);
      } else {
        console.error('Failed to load investments:', response.error || 'Unknown error');
        setInvestments([]);
      }
    } catch (error) {
      console.error('Failed to load investments:', error);
      setInvestments([]);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortInvestments = () => {
    let filtered = [...investments];

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(inv => inv.status === selectedStatus);
    }

    // Filter by stage
    if (selectedStage !== 'all') {
      filtered = filtered.filter(inv => inv.stage === selectedStage);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(inv =>
        (inv.pitchTitle || '').toLowerCase().includes(query) ||
        (inv.company || '').toLowerCase().includes(query) ||
        (inv.creator || '').toLowerCase().includes(query) ||
        (inv.genre || '').toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.investmentDate || 0).getTime() - new Date(b.investmentDate || 0).getTime();
          break;
        case 'value':
          comparison = (a.currentValue || 0) - (b.currentValue || 0);
          break;
        case 'roi':
          comparison = (a.roi || 0) - (b.roi || 0);
          break;
        case 'name':
          comparison = (a.pitchTitle || '').localeCompare(b.pitchTitle || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredInvestments(filtered);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <PlayCircle className="h-4 w-4 text-green-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'on-hold':
        return <PauseCircle className="h-4 w-4 text-yellow-600" />;
      case 'exited':
        return <CheckCircle className="h-4 w-4 text-purple-600" />;
      case 'written-off':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'completed':
        return 'text-blue-600 bg-blue-100';
      case 'on-hold':
        return 'text-yellow-600 bg-yellow-100';
      case 'exited':
        return 'text-purple-600 bg-purple-100';
      case 'written-off':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'outperforming':
        return 'text-green-600';
      case 'meeting-expectations':
        return 'text-blue-600';
      case 'underperforming':
        return 'text-red-600';
      default:
        return 'text-gray-600';
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

  // Calculate portfolio statistics
  const portfolioStats = {
    totalInvested: investments.reduce((sum, inv) => sum + (inv.initialAmount || 0), 0),
    currentValue: investments.reduce((sum, inv) => sum + (inv.currentValue || 0), 0),
    totalReturns: investments.reduce((sum, inv) => sum + (inv.totalReturn || 0), 0),
    activeCount: investments.filter(inv => inv.status === 'active').length,
    avgROI: investments.length > 0
      ? investments.reduce((sum, inv) => sum + (inv.roi || inv.roi_percentage || 0), 0) / investments.length
      : 0
  };

  return (
    <div>
            <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">All Investments</h1>
          <p className="text-gray-600 mt-2">
            Complete overview of your investment portfolio
          </p>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Invested</p>
                  <p className="text-xl font-bold">{formatCurrency(portfolioStats.totalInvested)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Current Value</p>
                  <p className="text-xl font-bold">{formatCurrency(portfolioStats.currentValue)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Returns</p>
                  <p className={`text-xl font-bold ${portfolioStats.totalReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(portfolioStats.totalReturns)}
                  </p>
                </div>
                <Award className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-xl font-bold">{portfolioStats.activeCount}</p>
                </div>
                <Film className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg ROI</p>
                  <p className={`text-xl font-bold ${portfolioStats.avgROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {portfolioStats.avgROI.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="all-investments-search"
                    name="all-investments-search"
                    placeholder="Search investments..."
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
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on-hold">On Hold</option>
                <option value="exited">Exited</option>
                <option value="written-off">Written Off</option>
              </select>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Stages</option>
                <option value="pre-production">Pre-Production</option>
                <option value="production">Production</option>
                <option value="post-production">Post-Production</option>
                <option value="distribution">Distribution</option>
                <option value="released">Released</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="date">Sort by Date</option>
                <option value="value">Sort by Value</option>
                <option value="roi">Sort by ROI</option>
                <option value="name">Sort by Name</option>
              </select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Investments Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Investment Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ROI
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvestments.map((investment) => (
                    <tr key={investment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {investment.pitchTitle || investment.pitch_title}
                          </div>
                          <div className="text-sm text-gray-500">
                            {investment.company || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {investment.genre || 'Unknown'} • {investment.creator || 'Unknown'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900">
                            {formatCurrency(investment.initialAmount || 0)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {investment.investmentDate ? new Date(investment.investmentDate).toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {investment.ownership || 0}% ownership
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(investment.currentValue || 0)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Last: {investment.lastValuation ? new Date(investment.lastValuation).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center text-sm font-medium ${
                          (investment.roi || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(investment.roi || 0) >= 0 ? (
                            <TrendingUp className="h-4 w-4 mr-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 mr-1" />
                          )}
                          {Math.abs(investment.roi || 0)}%
                        </div>
                        <div className={`text-xs ${getPerformanceColor(investment.performance || 'meeting-expectations')}`}>
                          {(investment.performance || 'meeting-expectations').replace('-', ' ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(investment.status)}
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(investment.status)}`}>
                            {investment.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {(investment.stage || 'unknown').replace('-', ' ')}
                        </div>
                        {investment.nextMilestone && (
                          <div className="text-xs text-gray-500">
                            Next: {investment.nextMilestone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Empty State */}
        {filteredInvestments.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Film className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No investments found</h3>
              <p className="text-gray-600">Try adjusting your filters or search criteria</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AllInvestments;