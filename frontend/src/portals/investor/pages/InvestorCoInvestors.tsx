import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, TrendingUp, DollarSign, Award,
  Search, Filter, Globe, Star, Building,
  Briefcase, Film, Calendar, MapPin,
  ChevronRight, UserPlus, Check, Eye,
  BarChart3, PieChart, Activity, Zap
} from 'lucide-react';
import { investorApi } from '@features/deals/services/investor.service';

interface CoInvestor {
  id: string;
  name: string;
  avatar?: string;
  title: string;
  company?: string;
  location?: string;
  investmentStyle: 'aggressive' | 'moderate' | 'conservative';
  connectionStatus: 'connected' | 'pending' | 'suggested';
  stats: {
    totalInvestments: number;
    sharedDeals: number;
    avgDealSize: number;
    successRate: number;
    portfolioValue: number;
  };
  specializations: string[];
  recentActivity?: {
    type: string;
    project: string;
    amount: number;
    date: string;
  };
  compatibility: number; // 0-100 compatibility score
}

export default function InvestorCoInvestors() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStyle, setFilterStyle] = useState<'all' | 'aggressive' | 'moderate' | 'conservative'>('all');
  const [sortBy, setSortBy] = useState<'compatibility' | 'sharedDeals' | 'successRate'>('compatibility');
  const [coInvestors, setCoInvestors] = useState<CoInvestor[]>([]);
  const [filteredInvestors, setFilteredInvestors] = useState<CoInvestor[]>([]);

  useEffect(() => {
    loadCoInvestors();
  }, []);

  useEffect(() => {
    filterAndSortInvestors();
  }, [coInvestors, searchQuery, filterStyle, sortBy]);

  const loadCoInvestors = async () => {
    try {
      const response = await investorApi.getCoInvestors();
      if (response.success && response.data) {
        const data = response.data as any;
        const items: any[] = data.coInvestors || data.co_investors || [];
        const mapped: CoInvestor[] = items.map((c: any) => ({
          id: String(c.id || ''),
          name: c.name || c.username || 'Unknown',
          avatar: c.avatar_url || c.avatar,
          title: c.title || c.role || '',
          company: c.company_name || c.company,
          location: c.location || '',
          investmentStyle: (c.investment_style || c.investmentStyle || 'moderate') as 'aggressive' | 'moderate' | 'conservative',
          connectionStatus: (c.connection_status || c.status || 'suggested') as 'connected' | 'pending' | 'suggested',
          stats: {
            totalInvestments: c.total_investments || c.totalInvestments || 0,
            sharedDeals: c.shared_deals || c.sharedDeals || 0,
            avgDealSize: c.avg_deal_size || c.avgDealSize || 0,
            successRate: c.success_rate || c.successRate || 0,
            portfolioValue: c.portfolio_value || c.portfolioValue || 0
          },
          specializations: c.specializations || c.genres || [],
          recentActivity: c.recent_activity ? {
            type: c.recent_activity.type || '',
            project: c.recent_activity.project || '',
            amount: c.recent_activity.amount || 0,
            date: c.recent_activity.date || ''
          } : undefined,
          compatibility: c.compatibility || c.compatibility_score || 0
        }));
        setCoInvestors(mapped);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load co-investors:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortInvestors = () => {
    let filtered = [...coInvestors];

    // Filter by investment style
    if (filterStyle !== 'all') {
      filtered = filtered.filter(investor => investor.investmentStyle === filterStyle);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(investor =>
        investor.name.toLowerCase().includes(query) ||
        investor.company?.toLowerCase().includes(query) ||
        investor.specializations.some(spec => spec.toLowerCase().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'compatibility':
          return b.compatibility - a.compatibility;
        case 'sharedDeals':
          return b.stats.sharedDeals - a.stats.sharedDeals;
        case 'successRate':
          return b.stats.successRate - a.stats.successRate;
        default:
          return 0;
      }
    });

    setFilteredInvestors(filtered);
  };

  const handleConnect = async (investorId: string) => {
    const API_URL = import.meta.env.VITE_API_URL || '';
    try {
      await fetch(`${API_URL}/api/investor/connections/${investorId}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to send connection request:', error);
    }
    setCoInvestors(prev => prev.map(investor =>
      investor.id === investorId
        ? { ...investor, connectionStatus: 'pending' }
        : investor
    ));
  };

  const getStyleColor = (style: string) => {
    switch (style) {
      case 'aggressive':
        return 'text-red-600 bg-red-100';
      case 'moderate':
        return 'text-blue-600 bg-blue-100';
      case 'conservative':
        return 'text-indigo-600 bg-indigo-100';
      default:
        return 'text-gray-600 bg-gray-100';
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

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading co-investors...</div>
        </div>
      </div>
    );
  }

  const connectedCount = coInvestors.filter(i => i.connectionStatus === 'connected').length;
  const totalSharedDeals = coInvestors.reduce((sum, i) => sum + i.stats.sharedDeals, 0);
  const avgCompatibility = Math.round(coInvestors.reduce((sum, i) => sum + i.compatibility, 0) / coInvestors.length);

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header with Stats */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Co-Investor Network</h1>
          <p className="mt-2 text-sm text-gray-600">
            Connect with other investors for joint opportunities and syndicated deals
          </p>
          
          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-purple-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Connected</p>
                  <p className="text-xl font-semibold text-gray-900">{connectedCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Briefcase className="w-8 h-8 text-blue-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Shared Deals</p>
                  <p className="text-xl font-semibold text-gray-900">{totalSharedDeals}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Zap className="w-8 h-8 text-yellow-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Avg Compatibility</p>
                  <p className="text-xl font-semibold text-gray-900">{avgCompatibility}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-indigo-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Opportunities</p>
                  <p className="text-xl font-semibold text-gray-900">{coInvestors.filter(i => i.connectionStatus === 'connected').length} Active</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  id="coinvestors-search"
                  name="coinvestors-search"
                  placeholder="Search co-investors by name, company, or specialization..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={filterStyle}
                onChange={(e) => setFilterStyle(e.target.value as any)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Styles</option>
                <option value="aggressive">Aggressive</option>
                <option value="moderate">Moderate</option>
                <option value="conservative">Conservative</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="compatibility">Sort by Compatibility</option>
                <option value="sharedDeals">Sort by Shared Deals</option>
                <option value="successRate">Sort by Success Rate</option>
              </select>
            </div>
          </div>
        </div>

        {/* Co-Investors List */}
        <div className="space-y-6">
          {filteredInvestors.map((investor) => (
            <div key={investor.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{investor.name}</h3>
                        <p className="text-sm text-gray-600">{investor.title}</p>
                        {investor.company && (
                          <p className="text-sm text-gray-500">{investor.company}</p>
                        )}
                        <div className="mt-2 flex items-center space-x-4 text-sm">
                          {investor.location && (
                            <div className="flex items-center text-gray-500">
                              <MapPin className="w-3 h-3 mr-1" />
                              {investor.location}
                            </div>
                          )}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStyleColor(investor.investmentStyle)}`}>
                            {investor.investmentStyle} investor
                          </span>
                        </div>
                      </div>
                      
                      {/* Compatibility Score */}
                      <div className="text-right">
                        <div className="relative w-20 h-20">
                          <svg className="w-20 h-20 transform -rotate-90">
                            <circle
                              cx="40"
                              cy="40"
                              r="36"
                              stroke="#e5e7eb"
                              strokeWidth="8"
                              fill="none"
                            />
                            <circle
                              cx="40"
                              cy="40"
                              r="36"
                              stroke={investor.compatibility >= 80 ? '#6366f1' : investor.compatibility >= 60 ? '#3b82f6' : '#f59e0b'}
                              strokeWidth="8"
                              fill="none"
                              strokeDasharray={`${(investor.compatibility / 100) * 226.2} 226.2`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold text-gray-900">{investor.compatibility}%</span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">Compatibility</p>
                      </div>
                    </div>

                    {/* Investment Stats */}
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4 pb-4 border-b border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500">Total Investments</p>
                        <p className="text-lg font-semibold text-gray-900">{investor.stats.totalInvestments}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Shared Deals</p>
                        <p className="text-lg font-semibold text-purple-600">{investor.stats.sharedDeals}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Avg Deal Size</p>
                        <p className="text-lg font-semibold text-gray-900">{formatCurrency(investor.stats.avgDealSize)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Success Rate</p>
                        <p className="text-lg font-semibold text-indigo-600">{investor.stats.successRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Portfolio Value</p>
                        <p className="text-lg font-semibold text-gray-900">{formatCurrency(investor.stats.portfolioValue)}</p>
                      </div>
                    </div>

                    {/* Specializations */}
                    <div className="mt-4">
                      <p className="text-xs text-gray-500 mb-2">Investment Focus</p>
                      <div className="flex flex-wrap gap-2">
                        {investor.specializations.map((spec, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    {investor.recentActivity && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">Recent Activity</p>
                            <p className="text-sm font-medium text-gray-900">
                              {investor.recentActivity.type}: {investor.recentActivity.project}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatCurrency(investor.recentActivity.amount)} • {new Date(investor.recentActivity.date).toLocaleDateString()}
                            </p>
                          </div>
                          <Activity className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-6 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {investor.connectionStatus === 'connected' ? (
                          <>
                            <button
                              onClick={() => navigate('/investor/deals')}
                              className="inline-flex items-center px-4 py-2 border border-indigo-600 rounded-md text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Shared Deals
                            </button>
                            <button
                              onClick={() => navigate('/investor/discover')}
                              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                            >
                              <DollarSign className="w-4 h-4 mr-2" />
                              Propose Co-Investment
                            </button>
                          </>
                        ) : investor.connectionStatus === 'pending' ? (
                          <span className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-yellow-100 text-yellow-800">
                            Connection Pending
                          </span>
                        ) : (
                          <button
                            onClick={() => handleConnect(investor.id)}
                            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700"
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Connect
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => navigate(`/investor/co-investor/${investor.id}`)}
                        className="text-indigo-600 hover:text-purple-700 text-sm font-medium"
                      >
                        View Full Profile →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredInvestors.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No co-investors found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}