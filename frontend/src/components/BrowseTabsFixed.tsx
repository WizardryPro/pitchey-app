import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, Clock, Star, Award, Search, Filter, Eye, Heart, User } from 'lucide-react';
import LoadingSpinner from '@shared/components/feedback/LoadingSpinner';
import { PitchService } from '../services/pitch.service';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface Pitch {
  id: number;
  title: string;
  description: string;
  genre: string;
  budget: string;
  creator: {
    id: number;
    name: string;
    username: string;
  };
  viewCount: number;
  likes: number;
  createdAt: string;
  updatedAt: string;
  featured: boolean;
  rating?: number;
  investmentInterest?: number;
}

type TabType = 'trending' | 'new' | 'featured' | 'topRated';

interface TabState {
  pitches: Pitch[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
  // Track which search/genre combination this data was fetched with
  fetchedWithSearch: string;
  fetchedWithGenre: string;
}

const BrowseTabsFixed: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('all');

  // Track in-flight requests to prevent race conditions
  const fetchRequestIdRef = useRef<Record<TabType, number>>({
    trending: 0,
    new: 0,
    featured: 0,
    topRated: 0
  });

  // Separate state for each tab to prevent content mixing
  const [tabStates, setTabStates] = useState<Record<TabType, TabState>>({
    trending: {
      pitches: [],
      loading: false,
      error: null,
      hasMore: true,
      page: 1,
      fetchedWithSearch: '',
      fetchedWithGenre: 'all'
    },
    new: {
      pitches: [],
      loading: false,
      error: null,
      hasMore: true,
      page: 1,
      fetchedWithSearch: '',
      fetchedWithGenre: 'all'
    },
    featured: {
      pitches: [],
      loading: false,
      error: null,
      hasMore: true,
      page: 1,
      fetchedWithSearch: '',
      fetchedWithGenre: 'all'
    },
    topRated: {
      pitches: [],
      loading: false,
      error: null,
      hasMore: true,
      page: 1,
      fetchedWithSearch: '',
      fetchedWithGenre: 'all'
    }
  });

  const genres = [
    'all', 'drama', 'comedy', 'thriller', 'horror', 'sci-fi', 
    'fantasy', 'documentary', 'animation', 'action', 'romance'
  ];

  // Fetch pitches for specific tab with unique sorting/filtering
  // This function is now called with explicit search/genre to prevent stale closures
  const fetchTabPitches = useCallback(async (
    tab: TabType,
    reset: boolean,
    currentSearch: string,
    currentGenre: string
  ) => {
    // Increment request ID for this tab to track if response is still valid
    const requestId = ++fetchRequestIdRef.current[tab];

    // Get current state synchronously to determine page
    let currentPage = 1;
    let shouldFetch = true;

    setTabStates(prev => {
      const currentState = prev[tab];

      // Skip if already loading (unless reset which cancels in-flight request)
      if (currentState.loading && !reset) {
        shouldFetch = false;
        return prev;
      }

      // Skip if no more data and not resetting
      if (!reset && !currentState.hasMore) {
        shouldFetch = false;
        return prev;
      }

      currentPage = reset ? 1 : currentState.page;

      return {
        ...prev,
        [tab]: {
          ...prev[tab],
          loading: true,
          error: null
        }
      };
    });

    if (!shouldFetch) {
      return;
    }

    try {
      const page = currentPage;

      // Use the enhanced public endpoints that route per tab
      const params: {
        page: number;
        limit: number;
        search?: string;
        genre?: string;
        tab?: 'trending' | 'new' | 'featured' | 'topRated' | 'all';
      } = {
        page,
        limit: 12,
        tab: tab as 'trending' | 'new' | 'featured' | 'topRated' | 'all'
      };
      if (currentSearch !== '') params.search = currentSearch;
      if (currentGenre !== 'all') params.genre = currentGenre;
      const response = await PitchService.getPublicPitchesEnhanced(params);

      // Check if this response is still valid (no newer request has been made)
      if (requestId !== fetchRequestIdRef.current[tab]) {
        return;
      }

      const newPitches = response?.pitches || [];
      const hasMore = newPitches.length === 12; // If we got full page, there might be more

      setTabStates(prev => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          loading: false,
          pitches: reset ? newPitches : [...prev[tab].pitches, ...newPitches],
          hasMore,
          page: reset ? 2 : page + 1,
          error: null,
          fetchedWithSearch: currentSearch,
          fetchedWithGenre: currentGenre
        }
      }));

    } catch (error) {
      // Check if this error is still relevant
      if (requestId !== fetchRequestIdRef.current[tab]) {
        return;
      }

      console.error(`Failed to fetch ${tab} pitches:`, error);
      setTabStates(prev => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          loading: false,
          error: `Failed to load ${tab} pitches. Please try again.`
        }
      }));
    }
  }, []); // No dependencies - search/genre passed as arguments

  // Track if initial fetch has been attempted for each tab
  const fetchAttemptedRef = useRef<Record<TabType, boolean>>({
    trending: false,
    new: false,
    featured: false,
    topRated: false
  });

  // Load data for active tab when tab changes or when search/genre changes
  useEffect(() => {
    const currentTabState = tabStates[activeTab];

    // Check if we need to fetch data:
    // 1. Tab has not been fetched yet (first time) AND no data
    // 2. Search/genre changed since last fetch (user action)
    const isFirstFetch = !fetchAttemptedRef.current[activeTab] && currentTabState.pitches.length === 0;
    const filtersChanged =
      currentTabState.fetchedWithSearch !== searchTerm ||
      currentTabState.fetchedWithGenre !== selectedGenre;

    // Only fetch if filters changed by user action, or if this is the first fetch for this tab
    const needsFetch = isFirstFetch || (filtersChanged && (searchTerm !== '' || selectedGenre !== 'all' || currentTabState.pitches.length > 0));

    if (needsFetch && !currentTabState.loading) {
      // Mark this tab as having been fetched
      fetchAttemptedRef.current[activeTab] = true;

      // Debounce only for search term changes
      const delay = currentTabState.fetchedWithSearch !== searchTerm ? 500 : 0;

      const timeoutId = setTimeout(() => {
        fetchTabPitches(activeTab, true, searchTerm, selectedGenre);
      }, delay);

      return () => clearTimeout(timeoutId);
    }
  }, [activeTab, searchTerm, selectedGenre, fetchTabPitches, tabStates]);

  // Handle tab switch - preserve individual tab states
  const handleTabSwitch = (tab: TabType) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
    }
    // Data will be loaded in useEffect if needed
  };

  // Load more pitches for current tab
  const loadMore = () => {
    fetchTabPitches(activeTab, false, searchTerm, selectedGenre);
  };

  const currentTabState = tabStates[activeTab];

  const tabs = [
    {
      id: 'trending' as TabType,
      label: 'Trending',
      icon: TrendingUp,
      description: 'Most viewed this week'
    },
    {
      id: 'new' as TabType,
      label: 'New',
      icon: Clock,
      description: 'Latest releases'
    },
    {
      id: 'featured' as TabType,
      label: 'Featured',
      icon: Star,
      description: 'Staff picks'
    },
    {
      id: 'topRated' as TabType,
      label: 'Top Rated',
      icon: Award,
      description: 'Highest rated pitches'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse Pitches</h1>
          <p className="text-gray-600">Discover amazing film projects across different categories</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabSwitch(tab.id)}
                  className={`relative px-6 py-4 font-medium text-sm transition-colors duration-200 border-b-2 ${
                    isActive
                      ? 'text-purple-600 border-purple-600 bg-purple-50'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-purple-600' : 'text-gray-400'}`} />
                    <span>{tab.label}</span>
                  </div>
                  <div className={`text-xs mt-1 ${isActive ? 'text-purple-500' : 'text-gray-400'}`}>
                    {tab.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={`Search ${activeTab} pitches...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center space-x-2 transition-colors ${
              showFilters
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span>Filters</span>
          </button>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Genre
                </label>
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {genres.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre === 'all' ? 'All Genres' : genre.charAt(0).toUpperCase() + genre.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="space-y-6">
          {/* Tab Content Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {tabs.find(t => t.id === activeTab)?.label} Pitches
              {currentTabState.pitches.length > 0 && (
                <span className="ml-2 text-sm text-gray-500">
                  ({currentTabState.pitches.length} pitches)
                </span>
              )}
            </h2>
          </div>

          {/* Error State */}
          {currentTabState.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{currentTabState.error}</p>
              <button
                onClick={() => fetchTabPitches(activeTab, true, searchTerm, selectedGenre)}
                className="mt-2 text-red-600 hover:text-red-800 font-medium"
              >
                Try again
              </button>
            </div>
          )}

          {/* Loading State */}
          {currentTabState.loading && currentTabState.pitches.length === 0 && (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" text={`Loading ${activeTab} pitches...`} />
            </div>
          )}

          {/* Empty State */}
          {!currentTabState.loading && currentTabState.pitches.length === 0 && !currentTabState.error && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🎬</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No pitches found
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'Try adjusting your search terms or filters.' : `No ${activeTab} pitches available yet.`}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-purple-600 hover:text-purple-800 font-medium"
                >
                  Clear search
                </button>
              )}
            </div>
          )}

          {/* Pitches Grid */}
          {currentTabState.pitches.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {currentTabState.pitches.map((pitch) => (
                  <motion.div
                    key={`${activeTab}-${pitch.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -4 }}
                    className="bg-white rounded-lg shadow-sm hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                    onClick={() => navigate(`/pitch/${pitch.id}`)}
                  >
                    {/* Poster/Thumbnail */}
                    <div className="relative aspect-video bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                      <Star className="w-8 h-8 text-purple-400" />
                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-1 bg-black bg-opacity-50 text-white text-xs rounded">
                          {pitch.genre}
                        </span>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-2 line-clamp-2">{pitch.title}</h3>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{pitch.description}</p>
                      
                      {/* Creator */}
                      <div className="flex items-center text-sm text-gray-500 mb-3">
                        <User className="w-4 h-4 mr-1" />
                        <span>{pitch.creator?.name || 'Anonymous'}</span>
                      </div>
                      
                      {/* Stats */}
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center">
                            <Eye className="w-4 h-4 mr-1" />
                            <span>{pitch.viewCount || 0}</span>
                          </div>
                          <div className="flex items-center">
                            <Heart className="w-4 h-4 mr-1" />
                            <span>{pitch.likes || 0}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          {pitch.budget && (
                            <div className="font-medium text-green-600">{pitch.budget}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Load More Button */}
              {currentTabState.hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={loadMore}
                    disabled={currentTabState.loading}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {currentTabState.loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrowseTabsFixed;