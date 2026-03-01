import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { TrendingUp, Star, Film, Search, Filter, Grid, List, ArrowLeft, Home, RefreshCw, AlertCircle, WifiOff } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { InvestorService, type InvestmentOpportunity } from '../../services/investor.service';

interface PitchItem {
  id: number;
  title: string;
  genre: string;
  budget: string;
  roi: string;
  status: string;
  thumbnail: string;
  description: string;
  rating: number;
}

const InvestorDiscover = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-tab state to prevent content bleeding between tabs
  interface TabState {
    pitches: PitchItem[];
    loaded: boolean;
  }
  const [tabStates, setTabStates] = useState<Record<string, TabState>>({});
  const fetchRequestIdRef = useRef(0);

  // Get current tab from URL params or default to 'featured'
  const currentTab = searchParams.get('tab') ?? 'featured';

  // Derive pitches from per-tab state
  const pitches = tabStates[currentTab]?.pitches ?? [];

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Track online/offline status
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Check if we're on the genres page
  const isGenresPage = location.pathname.includes('/genres');

  const tabs = [
    { id: 'featured', label: 'Featured', icon: Star },
    { id: 'high-potential', label: 'High Potential', icon: TrendingUp },
    { id: 'genres', label: 'Browse by Genre', icon: Film },
  ];

  const genres = [
    'All Genres', 'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 
    'Thriller', 'Romance', 'Documentary', 'Animation'
  ];

  const handleTabChange = (tabId: string) => {
    if (tabId === 'genres') {
      void navigate('/investor/discover/genres');
    } else {
      setSearchParams({ tab: tabId });
    }
  };

  useEffect(() => {
    // If we're on the genres page, set tab to genres
    if (isGenresPage && currentTab !== 'genres') {
      setSearchParams({ tab: 'genres' });
    }
  }, [isGenresPage, currentTab, setSearchParams]);

  // Load pitches on mount and when filters change
  useEffect(() => {
    void loadPitches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, selectedGenre]);

  const loadPitches = async () => {
    const requestId = ++fetchRequestIdRef.current;
    const tab = currentTab;

    // Skip if already loaded for this tab (unless genre changed)
    try {
      setLoading(true);
      setError(null);

      const filters: {
        genre?: string;
        sortBy?: 'matchScore' | 'deadline' | 'roi' | 'popularity';
        limit?: number;
      } = {
        limit: 50
      };

      // Apply genre filter
      if (selectedGenre && selectedGenre !== 'all' && selectedGenre !== 'all-genres') {
        filters.genre = selectedGenre.replace('-', ' ');
      }

      // Apply sorting based on tab
      if (currentTab === 'high-potential') {
        filters.sortBy = 'roi';
      } else if (currentTab === 'featured') {
        filters.sortBy = 'popularity';
      }

      const response = await InvestorService.getOpportunities(filters);

      // Guard against stale responses from rapid tab switching
      if (requestId !== fetchRequestIdRef.current) return;

      // Transform API response to match component interface
      const opportunities = (response.opportunities ?? []) as InvestmentOpportunity[];
      const transformedPitches: PitchItem[] = opportunities.map((opp: InvestmentOpportunity) => ({
        id: opp.id,
        title: opp.title ?? 'Untitled',
        genre: opp.genre ?? 'Unknown',
        budget: formatBudget(opp.minInvestment ?? opp.targetAmount ?? 0),
        roi: opp.expectedROI !== undefined && opp.expectedROI !== null ? `${opp.expectedROI}%` : 'TBD',
        status: mapStatus(opp.status ?? 'active'),
        thumbnail: opp.thumbnailUrl ?? '/images/pitch-placeholder.svg',
        description: opp.logline ?? opp.description ?? '',
        rating: opp.matchScore !== undefined && opp.matchScore !== null ? opp.matchScore / 20 : 4.5  // Convert match score to 5-star rating
      }));

      setTabStates(prev => ({
        ...prev,
        [tab]: { pitches: transformedPitches, loaded: true }
      }));
    } catch (err) {
      if (requestId !== fetchRequestIdRef.current) return;
      console.error('Failed to load pitches:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pitches');
      setTabStates(prev => ({
        ...prev,
        [tab]: { pitches: [], loaded: true }
      }));
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const formatBudget = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  };

  const mapStatus = (apiStatus: string): string => {
    const statusMap: Record<string, string> = {
      'active': 'Seeking Investment',
      'published': 'Seeking Investment',
      'in_development': 'In Development',
      'pre_production': 'Pre-Production',
      'production': 'In Production',
      'post_production': 'Post-Production',
      'completed': 'Completed',
      'funded': 'Fully Funded'
    };
    return statusMap[apiStatus.toLowerCase()] || apiStatus;
  };

  // Filter pitches by search query
  const filteredPitches = pitches.filter(pitch =>
    pitch.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pitch.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pitch.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderContent = () => {
    // Loading state — skeleton cards
    if (loading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
              <div className="w-full h-48 bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Error state
    if (error !== null) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Failed to load opportunities</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => { void loadPitches(); }} variant="outline" className="text-red-700 border-red-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      );
    }

    // Empty state
    if (filteredPitches.length === 0) {
      return (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <Film className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No opportunities found</h3>
          <p className="text-gray-600">
            {searchQuery
              ? 'Try adjusting your search or filters.'
              : 'Check back later for new investment opportunities.'}
          </p>
        </div>
      );
    }

    if (isGenresPage || currentTab === 'genres') {
      return (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">Browse by Genre</h2>
            <div className="flex flex-wrap gap-2">
              {genres.map(genre => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre.toLowerCase().replace(' ', '-'))}
                  className={`px-4 py-2 rounded-full border ${
                    selectedGenre === genre.toLowerCase().replace(' ', '-') || (selectedGenre === 'all' && genre === 'All Genres')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:border-blue-600'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPitches.map(pitch => (
              <PitchCard key={pitch.id} pitch={pitch} viewMode="grid" />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
        {filteredPitches.map(pitch => (
          <PitchCard key={pitch.id} pitch={pitch} viewMode={viewMode} />
        ))}
      </div>
    );
  };

  return (
    <div>
            
      {/* Connectivity Banner */}
      {!isOnline && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="container mx-auto px-4 py-2 flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-red-700 text-sm">You are offline. Results may be outdated.</p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void navigate('/investor/dashboard'); }}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          
          <Link 
            to="/marketplace" 
            className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
          >
            <Home className="w-4 h-4" />
            All Pitches
          </Link>
        </div>
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Discover Investment Opportunities</h1>
          <p className="text-gray-600">Find your next successful film investment</p>
        </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              id="pitch-search"
              name="pitch-search"
              placeholder="Search pitches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <div className="flex border rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {!isGenresPage && (
        <div className="border-b mb-6">
          <div className="flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    currentTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  );
};

const PitchCard = ({ pitch, viewMode }: { pitch: PitchItem; viewMode: 'grid' | 'list' }) => {
  const navigate = useNavigate();

  if (viewMode === 'list') {
    return (
      <div
        className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => { void navigate(`/investor/pitches/${pitch.id}`); }}
      >
        <div className="flex gap-4">
          <img
            src={pitch.thumbnail}
            alt={pitch.title}
            className="w-24 h-16 object-cover rounded"
          />
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{pitch.title}</h3>
                <p className="text-sm text-gray-600">{pitch.genre} • {pitch.budget}</p>
                <p className="text-sm text-gray-500 mt-1">{pitch.description}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">{pitch.roi}</div>
                <div className="text-sm text-gray-500">Est. ROI</div>
                <div className="mt-2">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                    {pitch.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <img
        src={pitch.thumbnail}
        alt={pitch.title}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-lg">{pitch.title}</h3>
            <p className="text-sm text-gray-600">{pitch.genre}</p>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span className="text-sm">{pitch.rating}</span>
          </div>
        </div>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{pitch.description}</p>
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="text-xs text-gray-500">Budget</div>
            <div className="font-semibold">{pitch.budget}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Est. ROI</div>
            <div className="font-semibold text-green-600">{pitch.roi}</div>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
            {pitch.status}
          </span>
          <button
            onClick={() => { void navigate(`/investor/pitches/${pitch.id}`); }}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View Details →
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvestorDiscover;