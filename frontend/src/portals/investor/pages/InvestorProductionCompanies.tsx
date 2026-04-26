import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Film, Award, TrendingUp, Globe,
  Search, Filter, MapPin, Calendar, Users,
  DollarSign, Star, BarChart3, Play, ChevronRight,
  Briefcase, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import { investorApi } from '@features/deals/services/investor.service';

interface ProductionCompany {
  id: string;
  name: string;
  logo?: string;
  type: 'major' | 'independent' | 'boutique' | 'streaming';
  location: string;
  founded: string;
  connectionStatus: 'partner' | 'in-talks' | 'available';
  description: string;
  stats: {
    totalProductions: number;
    activeProjects: number;
    avgBudget: number;
    successRate: number;
    awardsWon: number;
    distributionReach: string;
  };
  genres: string[];
  currentProjects: {
    id: string;
    title: string;
    status: 'pre-production' | 'production' | 'post-production' | 'distribution';
    budget: number;
    investmentNeeded?: number;
  }[];
  pastSuccesses: {
    title: string;
    year: number;
    boxOffice?: number;
    awards?: string[];
  }[];
  investmentHistory: {
    totalRaised: number;
    investorCount: number;
    avgROI: number;
  };
}

export default function InvestorProductionCompanies() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'major' | 'independent' | 'boutique' | 'streaming'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'partner' | 'in-talks' | 'available'>('all');
  const [companies, setCompanies] = useState<ProductionCompany[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<ProductionCompany[]>([]);

  useEffect(() => {
    loadProductionCompanies();
  }, []);

  useEffect(() => {
    filterCompanies();
  }, [companies, searchQuery, filterType, filterStatus]);

  const loadProductionCompanies = async () => {
    try {
      const response = await investorApi.getProductionCompanies();
      if (response.success && response.data) {
        const data = response.data as any;
        const items: any[] = data.companies || data.productionCompanies || [];
        const mapped: ProductionCompany[] = items.map((c: any) => ({
          id: String(c.id || ''),
          name: c.name || c.company_name || 'Unknown',
          logo: c.logo_url || c.logo,
          type: (c.type || c.company_type || 'independent') as ProductionCompany['type'],
          location: c.location || '',
          founded: c.founded || c.founded_year || '',
          connectionStatus: (c.connection_status || c.status || 'available') as ProductionCompany['connectionStatus'],
          description: c.description || '',
          stats: {
            totalProductions: c.total_productions || c.totalProductions || 0,
            activeProjects: c.active_projects || c.activeProjects || 0,
            avgBudget: c.avg_budget || c.avgBudget || 0,
            successRate: c.success_rate || c.successRate || 0,
            awardsWon: c.awards_won || c.awardsWon || 0,
            distributionReach: c.distribution_reach || c.distributionReach || ''
          },
          genres: c.genres || [],
          currentProjects: (c.current_projects || c.currentProjects || []).map((p: any) => ({
            id: String(p.id || ''),
            title: p.title || '',
            status: (p.status || 'pre-production') as 'pre-production' | 'production' | 'post-production' | 'distribution',
            budget: p.budget || 0,
            investmentNeeded: p.investment_needed || p.investmentNeeded
          })),
          pastSuccesses: (c.past_successes || c.pastSuccesses || []).map((s: any) => ({
            title: s.title || '',
            year: s.year || 0,
            boxOffice: s.box_office || s.boxOffice,
            awards: s.awards || []
          })),
          investmentHistory: {
            totalRaised: c.total_raised || c.investmentHistory?.totalRaised || 0,
            investorCount: c.investor_count || c.investmentHistory?.investorCount || 0,
            avgROI: c.avg_roi || c.investmentHistory?.avgROI || 0
          }
        }));
        setCompanies(mapped);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load production companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCompanies = () => {
    let filtered = [...companies];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(company => company.type === filterType);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(company => company.connectionStatus === filterStatus);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(company =>
        company.name.toLowerCase().includes(query) ||
        company.description.toLowerCase().includes(query) ||
        company.genres.some(genre => genre.toLowerCase().includes(query)) ||
        company.currentProjects.some(project => project.title.toLowerCase().includes(query))
      );
    }

    setFilteredCompanies(filtered);
  };

  const handleConnect = async (companyId: string) => {
    const API_URL = import.meta.env.VITE_API_URL || '';
    try {
      await fetch(`${API_URL}/api/investor/connections/${companyId}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to send connection request:', error);
    }
    setCompanies(prev => prev.map(company =>
      company.id === companyId
        ? { ...company, connectionStatus: 'in-talks' }
        : company
    ));
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'major':
        return 'text-purple-600 bg-purple-100';
      case 'independent':
        return 'text-blue-600 bg-blue-100';
      case 'boutique':
        return 'text-indigo-600 bg-indigo-100';
      case 'streaming':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'partner':
        return 'text-indigo-800 bg-indigo-100';
      case 'in-talks':
        return 'text-yellow-800 bg-yellow-100';
      case 'available':
        return 'text-blue-800 bg-blue-100';
      default:
        return 'text-gray-800 bg-gray-100';
    }
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'pre-production':
        return 'text-blue-600';
      case 'production':
        return 'text-purple-600';
      case 'post-production':
        return 'text-orange-600';
      case 'distribution':
        return 'text-indigo-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
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
          <div className="text-gray-600">Loading production companies...</div>
        </div>
      </div>
    );
  }

  const partnerCount = companies.filter(c => c.connectionStatus === 'partner').length;
  const totalActiveProjects = companies.reduce((sum, c) => sum + c.stats.activeProjects, 0);
  const totalInvestmentOpportunities = companies.reduce((sum, c) => 
    sum + c.currentProjects.filter(p => p.investmentNeeded).length, 0
  );

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Production Companies</h1>
          <p className="mt-2 text-sm text-gray-600">
            Partner with leading production companies and studios
          </p>
          
          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Building2 className="w-8 h-8 text-purple-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Partners</p>
                  <p className="text-xl font-semibold text-gray-900">{partnerCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Film className="w-8 h-8 text-blue-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Active Projects</p>
                  <p className="text-xl font-semibold text-gray-900">{totalActiveProjects}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <DollarSign className="w-8 h-8 text-indigo-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Opportunities</p>
                  <p className="text-xl font-semibold text-gray-900">{totalInvestmentOpportunities}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Award className="w-8 h-8 text-yellow-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Total Awards</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {companies.reduce((sum, c) => sum + c.stats.awardsWon, 0)}
                  </p>
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
                  id="production-companies-search"
                  name="production-companies-search"
                  placeholder="Search companies, projects, or genres..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Types</option>
                <option value="major">Major Studios</option>
                <option value="independent">Independent</option>
                <option value="boutique">Boutique</option>
                <option value="streaming">Streaming</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Status</option>
                <option value="partner">Partners</option>
                <option value="in-talks">In Talks</option>
                <option value="available">Available</option>
              </select>
            </div>
          </div>
        </div>

        {/* Production Companies List */}
        <div className="space-y-6">
          {filteredCompanies.map((company) => (
            <div key={company.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <div className="p-6">
                {/* Company Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h3 className="text-xl font-semibold text-gray-900">{company.name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(company.type)}`}>
                        {company.type}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(company.connectionStatus)}`}>
                        {company.connectionStatus === 'partner' ? 'Partner' : 
                         company.connectionStatus === 'in-talks' ? 'In Talks' : 'Available'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        {company.location}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        Founded {company.founded}
                      </div>
                      <div className="flex items-center">
                        <Globe className="w-3 h-3 mr-1" />
                        {company.stats.distributionReach}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{company.description}</p>
                  </div>
                </div>

                {/* Company Stats */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 py-4 border-y border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500">Productions</p>
                    <p className="text-lg font-semibold text-gray-900">{company.stats.totalProductions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Active</p>
                    <p className="text-lg font-semibold text-purple-600">{company.stats.activeProjects}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Budget</p>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(company.stats.avgBudget)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Success Rate</p>
                    <p className="text-lg font-semibold text-indigo-600">{company.stats.successRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Awards</p>
                    <p className="text-lg font-semibold text-yellow-600">{company.stats.awardsWon}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg ROI</p>
                    <p className="text-lg font-semibold text-indigo-600">{company.investmentHistory.avgROI}%</p>
                  </div>
                </div>

                {/* Genres */}
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">Specializes In</p>
                  <div className="flex flex-wrap gap-2">
                    {company.genres.map((genre, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Current Projects */}
                {company.currentProjects.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">Current Projects</p>
                    <div className="space-y-2">
                      {company.currentProjects.map((project) => (
                        <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Play className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{project.title}</p>
                              <p className="text-xs text-gray-500">
                                <span className={getProjectStatusColor(project.status)}>
                                  {project.status.replace('-', ' ')}
                                </span>
                                {' • '}
                                Budget: {formatCurrency(project.budget)}
                              </p>
                            </div>
                          </div>
                          {project.investmentNeeded && (
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Seeking</p>
                              <p className="text-sm font-semibold text-indigo-600">
                                {formatCurrency(project.investmentNeeded)}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Past Successes */}
                {company.pastSuccesses.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">Notable Successes</p>
                    <div className="flex items-center space-x-4">
                      {company.pastSuccesses.slice(0, 2).map((success, idx) => (
                        <div key={idx} className="flex items-center space-x-2 text-sm">
                          <Star className="w-4 h-4 text-yellow-400" />
                          <span className="text-gray-700">{success.title} ({success.year})</span>
                          {success.boxOffice && (
                            <span className="text-indigo-600 font-medium">
                              {formatCurrency(success.boxOffice)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {company.connectionStatus === 'partner' ? (
                      <button
                        onClick={() => navigate('/investor/discover')}
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                      >
                        <Briefcase className="w-4 h-4 mr-2" />
                        View Opportunities
                      </button>
                    ) : company.connectionStatus === 'in-talks' ? (
                      <button className="inline-flex items-center px-4 py-2 border border-yellow-600 rounded-md text-sm font-medium text-yellow-600 hover:bg-yellow-50">
                        <Clock className="w-4 h-4 mr-2" />
                        Discussion in Progress
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(company.id)}
                        className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700"
                      >
                        <Building2 className="w-4 h-4 mr-2" />
                        Start Partnership Discussion
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/production/${company.id}`)}
                    className="text-indigo-600 hover:text-purple-700 text-sm font-medium"
                  >
                    View Full Profile →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredCompanies.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No production companies found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}