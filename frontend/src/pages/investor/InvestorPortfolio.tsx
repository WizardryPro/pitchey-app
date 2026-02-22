import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, DollarSign, PieChart, Calendar,
  Film, Eye, Star, Clock, AlertCircle, CheckCircle,
  ArrowUp, ArrowDown, MoreVertical, Filter, Download,
  BarChart3, Target, RefreshCw, Search, Grid3X3, List,
  Heart, MessageSquare, Settings, Plus, Minus, X
} from 'lucide-react';
import { InvestmentService } from '../../services/investment.service';

interface Investment {
  id: string;
  pitchTitle: string;
  creator: string;
  investmentDate: string;
  amount: number;
  stake: number;
  status: 'active' | 'completed' | 'pending';
  currentValue: number;
  roi: number;
  genre: string;
  stage: 'development' | 'production' | 'post-production' | 'released';
  riskLevel: 'low' | 'medium' | 'high';
}

interface PortfolioStats {
  totalInvested: number;
  currentValue: number;
  totalReturns: number;
  averageROI: number;
  activeInvestments: number;
  completedDeals: number;
}

export default function InvestorPortfolio() {
  const navigate = useNavigate();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'roi' | 'title'>('date');

  const [stats, setStats] = useState<PortfolioStats>({
    totalInvested: 0,
    currentValue: 0,
    totalReturns: 0,
    averageROI: 0,
    activeInvestments: 0,
    completedDeals: 0
  });

  useEffect(() => {
    loadPortfolioData();
  }, []);

  const loadPortfolioData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch portfolio summary
      const portfolioResponse = await InvestmentService.getInvestorPortfolio();
      if (portfolioResponse.success && portfolioResponse.data) {
        const portfolio = portfolioResponse.data;
        setStats({
          totalInvested: portfolio.totalInvested || 0,
          currentValue: portfolio.currentValue || 0,
          totalReturns: portfolio.totalReturn || 0,
          averageROI: portfolio.returnPercentage || 0,
          activeInvestments: portfolio.activeInvestments || 0,
          completedDeals: portfolio.completedInvestments || 0
        });
      }

      // Fetch investment history
      const historyResponse = await InvestmentService.getInvestmentHistory({ limit: 50 });
      if (historyResponse.success && historyResponse.data) {
        const transformedInvestments: Investment[] = (historyResponse.data?.investments ?? []).map((inv: any) => {
          // Derive stage from pitch_status if backend provides it
          const pitchStatus = inv.pitch_status || inv.pitchStatus || '';
          const derivedStage = inv.derived_stage || inv.derivedStage || (
            pitchStatus === 'produced' ? 'released' :
            pitchStatus === 'optioned' ? 'post-production' :
            pitchStatus === 'in_review' ? 'production' :
            'development'
          );
          // Derive risk from ROI if backend provides it
          const roi = inv.returnPercentage || inv.roi_percentage || 0;
          const derivedRisk = inv.derived_risk_level || inv.derivedRiskLevel || (
            roi < 0 ? 'high' : roi <= 15 ? 'medium' : 'low'
          );
          return {
            id: String(inv.id),
            pitchTitle: inv.pitchTitle || inv.pitch_title || 'Unknown Project',
            creator: inv.creatorName || inv.creator_name || 'Unknown Creator',
            investmentDate: inv.createdAt || inv.invested_at || inv.created_at,
            amount: inv.amount,
            stake: Number(inv.stake ?? inv.equity_percentage ?? 0),
            status: inv.status === 'active' ? 'active' : inv.status === 'completed' ? 'completed' : 'pending',
            currentValue: inv.currentValue ?? inv.current_value ?? inv.amount,
            roi,
            genre: inv.pitchGenre || inv.genre || 'Unknown',
            stage: derivedStage as Investment['stage'],
            riskLevel: derivedRisk as Investment['riskLevel']
          };
        });
        setInvestments(transformedInvestments);
      } else {
        // No investments found - that's okay, show empty state
        setInvestments([]);
      }
    } catch (err) {
      console.error('Error loading portfolio data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load portfolio data');
      setInvestments([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvestments = investments
    .filter(inv => {
      const matchesFilter = filter === 'all' || inv.status === filter;
      const matchesSearch = searchQuery === '' || 
        inv.pitchTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.creator.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.genre.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.investmentDate).getTime() - new Date(a.investmentDate).getTime();
        case 'amount':
          return b.amount - a.amount;
        case 'roi':
          return b.roi - a.roi;
        case 'title':
          return a.pitchTitle.localeCompare(b.pitchTitle);
        default:
          return 0;
      }
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Failed to load portfolio data</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 p-1"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={loadPortfolioData}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-red-300 rounded-md text-sm text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Portfolio Overview */}
        <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-xl shadow-xl p-6 mb-8 text-white">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <div>
              <p className="text-green-100 text-sm">Total Invested</p>
              <p className="text-3xl font-bold">${(stats.totalInvested / 1000000).toFixed(1)}M</p>
            </div>
            <div>
              <p className="text-green-100 text-sm">Current Value</p>
              <p className="text-3xl font-bold">${(stats.currentValue / 1000000).toFixed(1)}M</p>
            </div>
            <div>
              <p className="text-green-100 text-sm">Total Returns</p>
              <p className="text-3xl font-bold flex items-center gap-1">
                <ArrowUp className="w-5 h-5" />
                ${(stats.totalReturns / 1000).toFixed(0)}K
              </p>
            </div>
            <div>
              <p className="text-green-100 text-sm">Average ROI</p>
              <p className="text-3xl font-bold">{stats.averageROI}%</p>
            </div>
            <div>
              <p className="text-green-100 text-sm">Active</p>
              <p className="text-3xl font-bold">{stats.activeInvestments}</p>
            </div>
            <div>
              <p className="text-green-100 text-sm">Completed</p>
              <p className="text-3xl font-bold">{stats.completedDeals}</p>
            </div>
          </div>
        </div>

        {/* Enhanced Filters and Actions */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                id="portfolio-search"
                name="portfolio-search"
                placeholder="Search investments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            
            {/* Filter Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg transition ${
                  filter === 'all' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-lg transition ${
                  filter === 'active' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`px-4 py-2 rounded-lg transition ${
                  filter === 'completed' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg transition ${
                  filter === 'pending' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending
              </button>
            </div>

            {/* Sort and View Controls */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="date">Sort by Date</option>
                <option value="amount">Sort by Amount</option>
                <option value="roi">Sort by ROI</option>
                <option value="title">Sort by Title</option>
              </select>
              
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="all">All Time</option>
                <option value="year">This Year</option>
                <option value="quarter">This Quarter</option>
                <option value="month">This Month</option>
              </select>
              
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button className="px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 flex items-center gap-2 text-sm">
                <Download className="w-4 h-4" />
                Export
              </button>
              
              <button 
                onClick={() => window.location.reload()}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Investment Display */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredInvestments.map((investment) => (
              <div key={investment.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{investment.pitchTitle}</h3>
                      <p className="text-sm text-gray-600">by {investment.creator}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(investment.status)}`}>
                        {investment.status}
                      </span>
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Investment</p>
                      <p className="text-lg font-semibold">${(investment.amount / 1000).toFixed(0)}K</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Value</p>
                      <p className="text-lg font-semibold">${(investment.currentValue / 1000).toFixed(0)}K</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Stake</p>
                      <p className="text-lg font-semibold">{investment.stake}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">ROI</p>
                      <p className={`text-lg font-semibold flex items-center gap-1 ${
                        investment.roi > 0 ? 'text-green-600' : investment.roi < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {investment.roi > 0 ? <ArrowUp className="w-4 h-4" /> : investment.roi < 0 ? <ArrowDown className="w-4 h-4" /> : null}
                        {investment.roi}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(investment.investmentDate).toLocaleDateString()}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                      {investment.genre}
                    </span>
                    <span className={`font-medium ${getRiskColor(investment.riskLevel)}`}>
                      {investment.riskLevel} risk
                    </span>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Production Stage</span>
                      <span className="text-sm font-medium capitalize">{investment.stage.replace('-', ' ')}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-green-600 to-teal-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${
                            investment.stage === 'development' ? 25 :
                            investment.stage === 'production' ? 50 :
                            investment.stage === 'post-production' ? 75 :
                            100
                          }%` 
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => navigate(`/investor/investment/${investment.id}`)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                    >
                      View Details
                    </button>
                    <button className="px-3 py-2 text-green-600 border border-green-600 rounded-lg hover:bg-green-50 transition">
                      <Heart className="w-4 h-4" />
                    </button>
                    <button className="px-3 py-2 text-green-600 border border-green-600 rounded-lg hover:bg-green-50 transition">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Investment
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Value
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ROI
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvestments.map((investment) => (
                    <tr key={investment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{investment.pitchTitle}</div>
                          <div className="text-sm text-gray-500">{investment.creator} • {investment.genre}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        ${(investment.amount / 1000).toFixed(0)}K
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        ${(investment.currentValue / 1000).toFixed(0)}K
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`text-sm font-medium flex items-center justify-center gap-1 ${
                          investment.roi > 0 ? 'text-green-600' : investment.roi < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {investment.roi > 0 ? <ArrowUp className="w-3 h-3" /> : investment.roi < 0 ? <ArrowDown className="w-3 h-3" /> : null}
                          {investment.roi}%
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(investment.status)}`}>
                          {investment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900 capitalize">
                        {investment.stage.replace('-', ' ')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => navigate(`/investor/investment/${investment.id}`)}
                            className="text-green-600 hover:text-green-800"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <Heart className="w-4 h-4" />
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredInvestments.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-lg">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No investments found</p>
          </div>
        )}

        {/* Investment Tips */}
        {investments.length > 0 && (() => {
          const topPerformer = investments.reduce((best, inv) => inv.roi > best.roi ? inv : best, investments[0]);
          const needsReview = investments.filter(inv => inv.roi < 0 || inv.status === 'pending').length;
          const genres = Array.from(new Set(investments.map(inv => inv.genre)));
          return (
            <div className="mt-8 bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">Investment Insights</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Best Performer</p>
                    <p className="text-sm text-blue-700">
                      {topPerformer.pitchTitle} with {topPerformer.roi}% ROI
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Attention Needed</p>
                    <p className="text-sm text-blue-700">
                      {needsReview > 0 ? `${needsReview} investment${needsReview > 1 ? 's' : ''} require review` : 'All investments on track'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Recommended Action</p>
                    <p className="text-sm text-blue-700">
                      {genres.length < 3 ? 'Consider diversifying genres' : `Invested across ${genres.length} genres`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}