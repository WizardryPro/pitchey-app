import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Filter, Eye, Heart, DollarSign, Calendar, Shield, Star, Film, TrendingUp, Building2, User } from 'lucide-react';
import { pitchAPI } from '../lib/api';
import { API_URL } from '../config';
import { configService } from '../services/config.service';
import FormatDisplay from '../components/FormatDisplay';
import { useDebounce } from '@/shared/hooks/useDebounce';

interface Pitch {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  formatCategory?: string;
  formatSubtype?: string;
  budget: string;
  creator: {
    id: number;
    username: string;
    userType: 'creator' | 'production' | 'investor';
    companyName?: string;
  };
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  createdAt: string;
  status: 'published' | 'draft';
  expectedROI?: string;
  productionStage?: string;
  attachedTalent?: string[];
  investmentTarget?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  similarProjects?: string[];
}

type InvestorTabType = 'trending' | 'new' | 'popular';

interface TabState {
  pitches: Pitch[];
  loading: boolean;
  error: string | null;
}

export default function InvestorBrowse() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filters, setFilters] = useState({
    genre: '',
    format: '',
    budgetRange: '',
    riskLevel: '',
    productionStage: ''
  });
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'budget' | 'roi'>('latest');
  const [showFilters, setShowFilters] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<InvestorTabType>('trending');

  // Request ID tracking — stale responses are silently discarded
  const fetchRequestIdRef = useRef<Record<InvestorTabType, number>>({
    trending: 0, new: 0, popular: 0
  });

  // Per-tab state prevents content mixing between tabs
  const [tabStates, setTabStates] = useState<Record<InvestorTabType, TabState>>({
    trending: { pitches: [], loading: true, error: null },
    new: { pitches: [], loading: false, error: null },
    popular: { pitches: [], loading: false, error: null },
  });

  const currentTabState = tabStates[activeTab];

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configData = await configService.getConfiguration();
        setConfig(configData);
      } catch (error) {
        console.error('Error loading config:', error);
      }
    };
    loadConfig();
  }, []);

  const fetchPitches = useCallback(async (tab: InvestorTabType) => {
    const requestId = ++fetchRequestIdRef.current[tab];

    setTabStates(prev => ({
      ...prev,
      [tab]: { ...prev[tab], loading: true, error: null }
    }));

    try {
      // Build query parameters
      const params = new URLSearchParams({
        tab,
        limit: '24',
        page: '1',
        ...filters
      });

      // Remove empty filter values
      Object.keys(filters).forEach(key => {
        if (!filters[key as keyof typeof filters]) {
          params.delete(key);
        }
      });

      // Use the correct browse endpoint with query parameters
      const response = await fetch(`${API_URL}/api/browse?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' // Send cookies for Better Auth session
      });

      // Stale response guard — another tab switch happened, discard this result
      if (requestId !== fetchRequestIdRef.current[tab]) return;

      if (response.ok) {
        const data = await response.json();
        setTabStates(prev => ({
          ...prev,
          [tab]: {
            pitches: data.success && data.items ? data.items : [],
            loading: false,
            error: null
          }
        }));
      } else {
        // Fallback to old endpoint
        try {
          const fallbackResponse = await fetch(`${API_URL}/api/pitches/public`);
          if (requestId !== fetchRequestIdRef.current[tab]) return;

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            let items: Pitch[] = [];
            if (Array.isArray(fallbackData)) {
              items = fallbackData;
            } else if (fallbackData && fallbackData.pitches) {
              items = fallbackData.pitches;
            }
            setTabStates(prev => ({
              ...prev,
              [tab]: { pitches: items, loading: false, error: null }
            }));
          } else {
            setTabStates(prev => ({
              ...prev,
              [tab]: { pitches: [], loading: false, error: null }
            }));
          }
        } catch (fallbackError) {
          if (requestId !== fetchRequestIdRef.current[tab]) return;
          console.error('Failed to fetch public pitches:', fallbackError);
          setTabStates(prev => ({
            ...prev,
            [tab]: { pitches: [], loading: false, error: 'Failed to load pitches' }
          }));
        }
      }
    } catch (error) {
      if (requestId !== fetchRequestIdRef.current[tab]) return;
      console.error('Failed to fetch pitches:', error);
      setTabStates(prev => ({
        ...prev,
        [tab]: { ...prev[tab], loading: false, error: 'Failed to load pitches' }
      }));
    }
  }, [filters]);

  // Fetch when tab or filters change
  useEffect(() => {
    fetchPitches(activeTab);
  }, [activeTab, filters, fetchPitches]);

  // Derive filtered + sorted pitches from current tab's data using debounced search
  const displayedPitches = useMemo(() => {
    const pitchArray = Array.isArray(currentTabState.pitches) ? currentTabState.pitches : [];

    const filtered = pitchArray.filter(pitch => {
      const matchesSearch = !debouncedSearch ||
        pitch.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        pitch.logline.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        pitch.genre.toLowerCase().includes(debouncedSearch.toLowerCase());

      const matchesGenre = !filters.genre || pitch.genre === filters.genre;
      const matchesFormat = !filters.format || pitch.format === filters.format;
      const matchesRisk = !filters.riskLevel || pitch.riskLevel === filters.riskLevel;
      const matchesStage = !filters.productionStage || pitch.productionStage === filters.productionStage;

      let matchesBudget = true;
      if (filters.budgetRange) {
        const budgetNum = parseInt(pitch.budget.replace(/[^\d]/g, ''));
        switch (filters.budgetRange) {
          case 'under-5m':
            matchesBudget = budgetNum < 5000000;
            break;
          case '5m-15m':
            matchesBudget = budgetNum >= 5000000 && budgetNum <= 15000000;
            break;
          case '15m-50m':
            matchesBudget = budgetNum > 15000000 && budgetNum <= 50000000;
            break;
          case 'over-50m':
            matchesBudget = budgetNum > 50000000;
            break;
        }
      }

      return matchesSearch && matchesGenre && matchesFormat && matchesRisk && matchesStage && matchesBudget;
    });

    // Sort the filtered results
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.viewCount - a.viewCount;
        case 'budget':
          return parseInt(b.budget.replace(/[^\d]/g, '')) - parseInt(a.budget.replace(/[^\d]/g, ''));
        case 'roi':
          const aROI = parseInt(a.expectedROI?.split('-')[1] || '0');
          const bROI = parseInt(b.expectedROI?.split('-')[1] || '0');
          return bROI - aROI;
        case 'latest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return sorted;
  }, [currentTabState.pitches, debouncedSearch, sortBy, filters]);

  const handleTabChange = (tab: InvestorTabType) => {
    setActiveTab(tab);
  };

  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageColor = (stage?: string) => {
    switch (stage) {
      case 'Development': return 'bg-blue-100 text-blue-800';
      case 'Pre-Production': return 'bg-purple-100 text-purple-800';
      case 'Financing': return 'bg-orange-100 text-orange-800';
      case 'Post-Production': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleRequestPitch = async (pitch: Pitch) => {
    try {
      await pitchAPI.requestNDA(pitch.id, `Interested in learning more about "${pitch.title}". Please share full pitch materials.`);
      alert(`NDA request sent successfully for "${pitch.title}". The creator will review your request.`);
    } catch (error) {
      console.error('Error requesting NDA:', error);
      alert(`Failed to send NDA request for "${pitch.title}". Please try again.`);
    }
  };

  const handleScheduleMeeting = (pitch: Pitch) => {
    const recipientId = pitch.creator?.id || (pitch as any).user_id || '';
    if (!recipientId) return;
    navigate(`/investor/messages?recipient=${recipientId}&subject=${encodeURIComponent(pitch.title)}`);
  };

  const handleMakeOffer = (pitch: Pitch) => {
    navigate(`/investor/invest/${pitch.id}`);
  };

  if (currentTabState.loading && currentTabState.pitches.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/investor/dashboard')}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Browse Investment Opportunities</h1>
                <p className="text-sm text-gray-500">Discover and invest in the next big entertainment projects</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="latest">Latest</option>
                <option value="popular">Most Popular</option>
                <option value="budget">Highest Budget</option>
                <option value="roi">Best ROI</option>
              </select>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition ${
                  showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Browse Tabs */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          {/* Tab Navigation */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => handleTabChange('trending')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                  ${activeTab === 'trending'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }
                `}
              >
                <TrendingUp className="w-4 h-4" />
                Trending
              </button>
              <button
                onClick={() => handleTabChange('new')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                  ${activeTab === 'new'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }
                `}
              >
                <Calendar className="w-4 h-4" />
                New
              </button>
              <button
                onClick={() => handleTabChange('popular')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                  ${activeTab === 'popular'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }
                `}
              >
                <Star className="w-4 h-4" />
                Popular
              </button>
            </div>

            <div className="text-sm text-gray-500">
              Showing {displayedPitches.length} investment opportunities
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by title, genre, or keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                <select
                  value={filters.genre}
                  onChange={(e) => setFilters(prev => ({ ...prev, genre: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Genres</option>
                  {config?.genres?.map((genre: string) => (
                    <option key={genre} value={genre}>{genre}</option>
                  )) || [
                    <option key="Action" value="Action">Action</option>,
                    <option key="Horror" value="Horror">Horror</option>,
                    <option key="Sci-Fi" value="Sci-Fi">Sci-Fi</option>,
                    <option key="Thriller" value="Thriller">Thriller</option>,
                    <option key="Documentary" value="Documentary">Documentary</option>,
                    <option key="Drama" value="Drama">Drama</option>,
                    <option key="Comedy" value="Comedy">Comedy</option>
                  ]}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                <select
                  value={filters.format}
                  onChange={(e) => setFilters(prev => ({ ...prev, format: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Formats</option>
                  {config?.formats?.map((format: string) => (
                    <option key={format} value={format}>{format}</option>
                  )) || [
                    <option key="Feature Film" value="Feature Film">Feature Film</option>,
                    <option key="Limited Series" value="Limited Series">Limited Series</option>,
                    <option key="TV Series" value="TV Series">TV Series</option>,
                    <option key="Short Film" value="Short Film">Short Film</option>
                  ]}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget Range</label>
                <select
                  value={filters.budgetRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, budgetRange: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Budgets</option>
                  {config?.budgetRanges?.map((range: {value: string, label: string}) => (
                    <option key={range.value} value={range.value}>{range.label}</option>
                  )) || [
                    <option key="under-5m" value="under-5m">Under $5M</option>,
                    <option key="5m-15m" value="5m-15m">$5M - $15M</option>,
                    <option key="15m-50m" value="15m-50m">$15M - $50M</option>,
                    <option key="over-50m" value="over-50m">Over $50M</option>
                  ]}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label>
                <select
                  value={filters.riskLevel}
                  onChange={(e) => setFilters(prev => ({ ...prev, riskLevel: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Risk Levels</option>
                  {config?.riskLevels?.map((level: {value: string, label: string}) => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  )) || [
                    <option key="low" value="low">Low Risk</option>,
                    <option key="medium" value="medium">Medium Risk</option>,
                    <option key="high" value="high">High Risk</option>
                  ]}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                <select
                  value={filters.productionStage}
                  onChange={(e) => setFilters(prev => ({ ...prev, productionStage: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Stages</option>
                  {config?.productionStages?.map((stage: string) => (
                    <option key={stage} value={stage}>{stage}</option>
                  )) || [
                    <option key="Development" value="Development">Development</option>,
                    <option key="Pre-Production" value="Pre-Production">Pre-Production</option>,
                    <option key="Financing" value="Financing">Financing</option>,
                    <option key="Post-Production" value="Post-Production">Post-Production</option>
                  ]}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            Showing {displayedPitches.length} of {currentTabState.pitches.length} opportunities
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="w-4 h-4" />
            <span>Market trends updated daily</span>
          </div>
        </div>

        {displayedPitches.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Film className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No opportunities found</h3>
            <p className="text-gray-500 mb-4">
              Try adjusting your search criteria or filters to find more investment opportunities.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilters({
                  genre: '',
                  format: '',
                  budgetRange: '',
                  riskLevel: '',
                  productionStage: ''
                });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {displayedPitches.map((pitch) => (
              <div key={pitch.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center relative">
                  <Film className="w-12 h-12 text-white" />
                  <div className="absolute top-4 left-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(pitch.riskLevel)}`}>
                      {pitch.riskLevel?.toUpperCase()} RISK
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStageColor(pitch.productionStage)}`}>
                      {pitch.productionStage}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{pitch.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {pitch.creator?.userType === 'production' ? (
                          <>
                            <Building2 className="w-4 h-4" />
                            <span>{pitch.creator?.companyName || pitch.creator?.username || (pitch as any).creator_name || 'Creator'}</span>
                          </>
                        ) : (
                          <>
                            <User className="w-4 h-4" />
                            <span>{pitch.creator?.username ? `@${pitch.creator.username}` : ((pitch as any).creator_name || 'Creator')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button className="text-gray-400 hover:text-red-500 transition">
                      <Heart className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{pitch.logline}</p>

                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>{pitch.genre} • <FormatDisplay
                      formatCategory={pitch.formatCategory}
                      formatSubtype={pitch.formatSubtype}
                      format={pitch.format}
                      variant="compact"
                    /></span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {pitch.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="w-4 h-4" />
                        {pitch.ndaCount}
                      </span>
                    </div>
                  </div>

                  {/* Investment Details */}
                  <div className="bg-blue-50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Total Budget</p>
                        <p className="font-semibold text-gray-900">{pitch.budget}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Investment Target</p>
                        <p className="font-semibold text-gray-900">{pitch.investmentTarget}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Expected ROI</p>
                        <p className="font-semibold text-green-600">{pitch.expectedROI}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Stage</p>
                        <p className="font-semibold text-gray-900">{pitch.productionStage}</p>
                      </div>
                    </div>
                  </div>

                  {/* Attached Talent */}
                  {pitch.attachedTalent && pitch.attachedTalent.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 mb-2">ATTACHED TALENT</p>
                      <div className="flex flex-wrap gap-1">
                        {pitch.attachedTalent.map((talent, index) => (
                          <span key={index} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                            {talent}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Similar Projects */}
                  {pitch.similarProjects && pitch.similarProjects.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 mb-2">SIMILAR TO</p>
                      <p className="text-sm text-gray-600">{pitch.similarProjects.join(', ')}</p>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <button
                      onClick={() => navigate(`/pitch/${pitch.id}`)}
                      className="flex-1 text-center py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleRequestPitch(pitch)}
                      className="flex-1 text-center py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-sm"
                    >
                      Request Pitch
                    </button>
                  </div>

                  <div className="flex space-x-2 mt-2">
                    <button
                      onClick={() => handleScheduleMeeting(pitch)}
                      className="flex-1 text-center py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm flex items-center justify-center gap-1"
                    >
                      <Calendar className="w-4 h-4" />
                      Schedule Meeting
                    </button>
                    <button
                      onClick={() => handleMakeOffer(pitch)}
                      className="flex-1 text-center py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition text-sm flex items-center justify-center gap-1"
                    >
                      <DollarSign className="w-4 h-4" />
                      Make Offer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
