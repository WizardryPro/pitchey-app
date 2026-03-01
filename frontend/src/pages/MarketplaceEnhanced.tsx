import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pitchAPI } from '../lib/api';
import type { Pitch } from '../lib/api';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { PitchCardSkeleton } from '@shared/components/feedback/Skeleton';
import EmptyState from '../components/EmptyState';
import { useToast } from '@shared/components/feedback/ToastProvider';
import Pagination from '../components/Pagination';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import { configService } from '../services/config.service';

import FormatDisplay from '../components/FormatDisplay';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  TrendingUp,
  Eye,
  Heart,
  Clock,
  User,
  Star,
  MessageCircle,
  Film,
  Wallet,
  DollarSign,
  BookOpen,
  Shield,
  Grid,
  List,
  SlidersHorizontal,
  X,
  BarChart3,
  Zap,
  WifiOff,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

// Get the best available image URL from a pitch (handles snake_case API + camelCase)
function getPitchImageUrl(pitch: Pitch): string | undefined {
  const p = pitch as unknown as Record<string, unknown>;
  const url = (p.titleImage as string | undefined) || (p.title_image as string | undefined) ||
    (p.thumbnailUrl as string | undefined) || (p.thumbnail_url as string | undefined) ||
    (p.posterUrl as string | undefined) || (p.poster_url as string | undefined);
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
  } catch { /* invalid URL */ }
  return undefined;
}

// Enhanced filtering and sorting options
const SORT_OPTIONS = [
  { value: 'trending', label: 'Trending Now', icon: TrendingUp },
  { value: 'newest', label: 'Newest First', icon: Clock },
  { value: 'popular', label: 'Most Popular', icon: Heart },
  { value: 'views', label: 'Most Viewed', icon: Eye },
  { value: 'budget_high', label: 'Highest Budget', icon: DollarSign },
  { value: 'budget_low', label: 'Lowest Budget', icon: Wallet },
  { value: 'alphabetical', label: 'A-Z', icon: BookOpen },
  { value: 'investment_ready', label: 'Investment Ready', icon: Zap }
];

const VIEW_MODES = {
  grid: { icon: Grid, label: 'Grid View', cols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' },
  list: { icon: List, label: 'List View', cols: 'grid-cols-1' },
  compact: { icon: BarChart3, label: 'Compact View', cols: 'grid-cols-1 md:grid-cols-2' }
};

interface FilterState {
  genres: string[];
  formats: string[];
  budgetRange: { min: number; max: number };
  status: string[];
  hasNDA: boolean | null;
  hasInvestment: boolean | null;
  dateRange: { start: Date | null; end: Date | null };
}

export default function MarketplaceEnhanced() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useBetterAuthStore();
  const toast = useToast();
  const { isMobile } = useResponsive();
  
  // Per-tab state management to prevent content bleeding
  interface TabState {
    pitches: Pitch[];
    loading: boolean;
    error: string | null;
    loaded: boolean;
  }
  const [tabStates, setTabStates] = useState<Record<string, TabState>>({});
  const [viewMode, setViewMode] = useState<keyof typeof VIEW_MODES>('grid');
  const [showFilters, setShowFilters] = useState(!isMobile);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'trending');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(16);
  const fetchRequestIdRef = useRef(0);
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

  // Enhanced filter state
  const [filters, setFilters] = useState<FilterState>({
    genres: searchParams.get('genres')?.split(',').filter(Boolean) || [],
    formats: searchParams.get('formats')?.split(',').filter(Boolean) || [],
    budgetRange: { 
      min: parseInt(searchParams.get('budgetMin') || '0'), 
      max: parseInt(searchParams.get('budgetMax') || '10000000') 
    },
    status: searchParams.get('status')?.split(',').filter(Boolean) || [],
    hasNDA: searchParams.get('hasNDA') === 'true' ? true : searchParams.get('hasNDA') === 'false' ? false : null,
    hasInvestment: searchParams.get('hasInvestment') === 'true' ? true : searchParams.get('hasInvestment') === 'false' ? false : null,
    dateRange: { start: null, end: null }
  });

  // Statistics
  const [stats, setStats] = useState({
    totalPitches: 0,
    totalInvestment: 0,
    avgBudget: 0,
    activeCreators: 0
  });

  // Config
  const [config, setConfig] = useState<{ genres?: string[]; formats?: string[] } | null>(null);
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Load config
  useEffect(() => {
    void configService.getConfiguration().then((cfg) => { setConfig(cfg as { genres?: string[]; formats?: string[] }); }).catch(console.error);
  }, []);

  // Derive current tab's pitches from per-tab state
  const currentTabState = tabStates[sortBy];
  const pitches = currentTabState?.pitches ?? [];
  const loading = currentTabState?.loading ?? !currentTabState?.loaded;

  // Load pitches for the current sort/tab — only fetch if not already loaded
  useEffect(() => {
    const tab = sortBy;
    if (tabStates[tab]?.loaded) return;
    void fetchPitchesForTab(tab);
  }, [sortBy]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (sortBy !== 'trending') params.set('sort', sortBy);
    if (filters.genres.length) params.set('genres', filters.genres.join(','));
    if (filters.formats.length) params.set('formats', filters.formats.join(','));
    if (filters.status.length) params.set('status', filters.status.join(','));
    if (filters.budgetRange.min > 0) params.set('budgetMin', filters.budgetRange.min.toString());
    if (filters.budgetRange.max < 10000000) params.set('budgetMax', filters.budgetRange.max.toString());
    if (filters.hasNDA !== null) params.set('hasNDA', filters.hasNDA.toString());
    if (filters.hasInvestment !== null) params.set('hasInvestment', filters.hasInvestment.toString());

    setSearchParams(params, { replace: true });
  }, [searchQuery, sortBy, filters]);

  // Apply filters and sorting whenever pitches or filter criteria change
  const [filteredPitches, setFilteredPitches] = useState<Pitch[]>([]);
  useEffect(() => {
    applyFiltersAndSort();
  }, [pitches, debouncedSearch, sortBy, filters]);

  const fetchPitchesForTab = async (tab: string) => {
    const requestId = ++fetchRequestIdRef.current;

    setTabStates(prev => ({
      ...prev,
      [tab]: { pitches: prev[tab]?.pitches ?? [], loading: true, error: null, loaded: false }
    }));

    try {
      // Map sort options to browse API tabs
      const browseTab = tab === 'newest' ? 'new' : tab === 'popular' || tab === 'views' ? 'popular' : 'trending';
      const result = await pitchAPI.browse(browseTab, { limit: 100 });

      // Guard against stale responses from rapid tab switching
      if (requestId !== fetchRequestIdRef.current) return;

      const validPitches: Pitch[] = Array.isArray(result.items) ? (result.items as Pitch[]) : [];

      setTabStates(prev => ({
        ...prev,
        [tab]: { pitches: validPitches, loading: false, error: null, loaded: true }
      }));
      calculateStats(validPitches);
    } catch (error) {
      if (requestId !== fetchRequestIdRef.current) return;
      console.error('Error fetching pitches:', error);
      toast.error('Failed to load pitches');
      setTabStates(prev => ({
        ...prev,
        [tab]: { pitches: [], loading: false, error: 'Failed to load pitches', loaded: true }
      }));
      calculateStats([]);
    }
  };

  const calculateStats = (pitchData: Pitch[]) => {
    // Ensure pitchData is an array
    if (!Array.isArray(pitchData)) {
      console.warn('calculateStats received non-array data:', pitchData);
      setStats({
        totalPitches: 0,
        totalInvestment: 0,
        avgBudget: 0,
        activeCreators: 0
      });
      return;
    }
    
    const totalInvestment = pitchData.reduce((sum, p) => {
      const pp = p as unknown as Record<string, unknown>;
      return sum + (Number(pp.totalInvestment) || Number(pp.total_investment) || 0);
    }, 0);
    // Use estimatedBudget (camelCase from interface) with fallbacks for API snake_case
    const avgBudget = pitchData.reduce((sum, p) => {
      const pp = p as unknown as Record<string, unknown>;
      const budget = Number(p.estimatedBudget) || Number(pp.estimated_budget) || 0;
      return sum + budget;
    }, 0) / (pitchData.length || 1);
    const activeCreators = new Set(pitchData.map(p => {
      const pp = p as unknown as Record<string, unknown>;
      return p.creator?.id || (pp.creator_id as string | undefined) || p.userId;
    })).size;
    
    setStats({
      totalPitches: pitchData.length,
      totalInvestment,
      avgBudget,
      activeCreators
    });
  };

  const applyFiltersAndSort = useCallback(() => {
    // Ensure pitches is an array before spreading
    if (!Array.isArray(pitches)) {
      console.warn('pitches is not an array:', pitches);
      setFilteredPitches([]);
      return;
    }
    
    let filtered = [...pitches];

    // Search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(pitch =>
        pitch.title.toLowerCase().includes(query) ||
        pitch.logline?.toLowerCase().includes(query) ||
        pitch.genre?.toLowerCase().includes(query) ||
        (pitch.creator?.name || ((pitch as unknown as Record<string, unknown>).creator_name as string | undefined) || '').toLowerCase().includes(query)
      );
    }

    // Genre filter
    if (filters.genres.length > 0) {
      filtered = filtered.filter(pitch => 
        filters.genres.includes(pitch.genre || '')
      );
    }

    // Format filter
    if (filters.formats.length > 0) {
      filtered = filtered.filter(pitch => 
        filters.formats.includes(pitch.format || '')
      );
    }

    // Budget range filter
    filtered = filtered.filter(pitch => {
      // Parse budget if it's a string like "5-8 million"
      let budgetValue = 0;
      const budgetStr = pitch.estimatedBudget || pitch.budgetBracket || '';
      if (budgetStr) {
        // Extract numeric value from strings like "5-8 million" or "15-25 million"
        const match = String(budgetStr).match(/(\d+)/);
        if (match) {
          budgetValue = parseInt(match[1], 10) * 1000000; // Convert to actual number
        }
      }

      // If no budget specified, don't filter it out
      if (!budgetStr) return true;

      return budgetValue >= filters.budgetRange.min && budgetValue <= filters.budgetRange.max;
    });

    // Status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(pitch => 
        filters.status.includes(pitch.status || 'active')
      );
    }

    // NDA filter
    if (filters.hasNDA !== null) {
      filtered = filtered.filter(pitch =>
        filters.hasNDA ? (pitch.hasNDA || pitch.requireNDA) : !(pitch.hasNDA || pitch.requireNDA)
      );
    }

    // Investment filter
    if (filters.hasInvestment !== null) {
      const getInvestment = (p: Pitch) => {
        const pp = p as unknown as Record<string, unknown>;
        return Number(pp.totalInvestment) || Number(pp.total_investment) || 0;
      };
      filtered = filtered.filter(pitch =>
        filters.hasInvestment ? getInvestment(pitch) > 0 : getInvestment(pitch) === 0
      );
    }

    // Sorting - helper functions for accessing properties with both naming conventions
    const getViewCount = (p: Pitch) => {
      const pp = p as unknown as Record<string, unknown>;
      return p.viewCount || Number(pp.view_count) || 0;
    };
    const getLikeCount = (p: Pitch) => {
      const pp = p as unknown as Record<string, unknown>;
      return p.likeCount || Number(pp.like_count) || 0;
    };
    const getCreatedAt = (p: Pitch) => {
      const pp = p as unknown as Record<string, unknown>;
      return p.createdAt || (pp.created_at as string) || '';
    };
    const getBudgetNum = (p: Pitch) => {
      const budgetStr = p.estimatedBudget || p.budgetBracket || '';
      if (!budgetStr) return 0;
      const match = String(budgetStr).match(/(\d+)/);
      return match ? parseInt(match[1], 10) * 1000000 : 0;
    };
    const getInvestmentGoal = (p: Pitch) => {
      const pp = p as unknown as Record<string, unknown>;
      return Number(pp.investmentGoal) || Number(pp.investment_goal) || 0;
    };
    const getTotalInvestment = (p: Pitch) => {
      const pp = p as unknown as Record<string, unknown>;
      return Number(pp.totalInvestment) || Number(pp.total_investment) || 0;
    };

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'trending':
          return (getViewCount(b) + getLikeCount(b)) - (getViewCount(a) + getLikeCount(a));
        case 'newest':
          return new Date(getCreatedAt(b)).getTime() - new Date(getCreatedAt(a)).getTime();
        case 'popular':
          return getLikeCount(b) - getLikeCount(a);
        case 'views':
          return getViewCount(b) - getViewCount(a);
        case 'budget_high':
          return getBudgetNum(b) - getBudgetNum(a);
        case 'budget_low':
          return getBudgetNum(a) - getBudgetNum(b);
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'investment_ready':
          return (getInvestmentGoal(b) - getTotalInvestment(b)) - (getInvestmentGoal(a) - getTotalInvestment(a));
        default:
          return 0;
      }
    });

    setFilteredPitches(filtered);
    setCurrentPage(1);
  }, [pitches, debouncedSearch, sortBy, filters]);

  // Pagination
  const paginatedPitches = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPitches.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPitches, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPitches.length / itemsPerPage);

  const handlePitchClick = (pitch: Pitch) => {
    const userType = localStorage.getItem('userType');
    if (!isAuthenticated) {
      void navigate(`/pitch/${pitch.id}`);
    } else if (userType === 'investor') {
      void navigate(`/investor/pitch/${pitch.id}`);
    } else if (userType === 'production') {
      void navigate(`/production/pitch/${pitch.id}`);
    } else if (userType === 'creator' && (pitch.creator?.id || pitch.userId) === user?.id) {
      void navigate(`/creator/pitch/${pitch.id}`);
    } else {
      void navigate(`/pitch/${pitch.id}`);
    }
  };

  const clearFilters = () => {
    setFilters({
      genres: [],
      formats: [],
      budgetRange: { min: 0, max: 10000000 },
      status: [],
      hasNDA: null,
      hasInvestment: null,
      dateRange: { start: null, end: null }
    });
    setSearchQuery('');
    setSortBy('trending');
  };

  const hasActiveFilters = filters.genres.length > 0 || 
    filters.formats.length > 0 || 
    filters.status.length > 0 ||
    filters.budgetRange.min > 0 || 
    filters.budgetRange.max < 10000000 ||
    filters.hasNDA !== null ||
    filters.hasInvestment !== null ||
    searchQuery !== '';

  // Render pitch card based on view mode
  const renderPitchCard = (pitch: Pitch) => {
    if (viewMode === 'list') {
      return (
        <motion.div
          key={pitch.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          whileHover={{ x: 4 }}
          className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-4 cursor-pointer"
          onClick={() => handlePitchClick(pitch)}
        >
          <div className="flex gap-4">
            {getPitchImageUrl(pitch) && (
              <img
                src={getPitchImageUrl(pitch)}
                alt={pitch.title}
                className="w-24 h-36 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-semibold">{pitch.title}</h3>
                  <p className="text-sm text-gray-600">{pitch.creator?.name || pitch.creator?.username || ((pitch as unknown as Record<string, unknown>).creator_username as string | undefined) || ((pitch as unknown as Record<string, unknown>).creator_name as string | undefined) || 'Unknown'}</p>
                </div>
                <div className="flex gap-2">
                  {pitch.genre && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {pitch.genre}
                    </span>
                  )}
                  {pitch.format && <FormatDisplay format={pitch.format} />}
                </div>
              </div>
              <p className="text-gray-700 mb-3 line-clamp-2">{pitch.logline}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {pitch.viewCount || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    {pitch.likeCount || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    {((pitch as unknown as Record<string, unknown>).commentCount as number | undefined) || 0}
                  </span>
                </div>
                {(pitch.estimatedBudget || pitch.budgetBracket) && (
                  <span className="text-sm font-medium text-green-600">
                    {pitch.estimatedBudget || pitch.budgetBracket}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    // Default grid/compact view
    return (
      <motion.div
        key={pitch.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -4 }}
        className="group bg-white rounded-lg shadow-sm hover:shadow-xl transition-all overflow-hidden cursor-pointer"
        onClick={() => handlePitchClick(pitch)}
      >
        <div className="aspect-[3/4] relative overflow-hidden bg-gray-100">
          {getPitchImageUrl(pitch) ? (
            <img
              src={getPitchImageUrl(pitch)}
              alt={pitch.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-12 h-12 text-gray-400" />
            </div>
          )}

          {/* Overlay with quick info */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <p className="text-sm line-clamp-3 mb-2">{pitch.logline}</p>
              <div className="flex gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {pitch.viewCount || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  {pitch.likeCount || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {(pitch.hasNDA || pitch.requireNDA) && (
              <span className="bg-purple-600 text-white px-2 py-1 text-xs rounded flex items-center gap-1">
                <Shield className="w-3 h-3" />
                NDA
              </span>
            )}
            {((pitch as unknown as Record<string, unknown>).isFeatured as boolean | undefined) && (
              <span className="bg-yellow-500 text-white px-2 py-1 text-xs rounded flex items-center gap-1">
                <Star className="w-3 h-3" />
                Featured
              </span>
            )}
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
            {pitch.title}
          </h3>
          <p className="text-sm text-gray-600 mb-2">{pitch.creator?.name || pitch.creator?.username || ((pitch as unknown as Record<string, unknown>).creator_username as string | undefined) || ((pitch as unknown as Record<string, unknown>).creator_name as string | undefined) || 'Unknown'}</p>

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {pitch.genre && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  {pitch.genre}
                </span>
              )}
            </div>
            {(pitch.estimatedBudget || pitch.budgetBracket) && (
              <span className="text-sm font-medium text-green-600">
                {pitch.estimatedBudget || pitch.budgetBracket}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo and main nav */}
            <div className="flex items-center gap-8">
              <a href="/" className="flex items-center">
                <span className="text-2xl font-bold text-purple-600">Pitchey</span>
              </a>
              <nav className="hidden md:flex items-center gap-6">
                <button
                  onClick={() => { void navigate('/marketplace'); }}
                  className="text-gray-700 hover:text-purple-600 transition font-medium"
                >
                  Browse Pitches
                </button>
                <button
                  onClick={() => { void navigate('/how-it-works'); }}
                  className="text-gray-700 hover:text-purple-600 transition"
                >
                  How It Works
                </button>
                <button
                  onClick={() => { void navigate('/about'); }}
                  className="text-gray-700 hover:text-purple-600 transition"
                >
                  About
                </button>
              </nav>
            </div>

            {/* Auth buttons */}
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  {/* User info */}
                  <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg">
                    <User className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-700">{user?.username || user?.email}</span>
                  </div>
                  
                  {/* Dashboard button */}
                  <button
                    onClick={() => {
                      const userType = localStorage.getItem('userType');
                      void navigate(userType ? `/${userType}/dashboard` : '/dashboard');
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { void navigate('/portals'); }}
                    className="px-4 py-2 text-purple-600 hover:text-purple-700 transition font-medium"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { void navigate('/portals'); }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Header with stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Marketplace Enhanced</h1>
              <p className="text-blue-100">Discover and invest in the next big hit</p>
            </div>
            
            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                <div className="text-2xl font-bold">{stats.totalPitches}</div>
                <div className="text-xs text-blue-100">Active Pitches</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                <div className="text-2xl font-bold">{stats.activeCreators}</div>
                <div className="text-xs text-blue-100">Creators</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                <div className="text-2xl font-bold">
                  ${(stats.totalInvestment / 1000000).toFixed(1)}M
                </div>
                <div className="text-xs text-blue-100">Total Invested</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                <div className="text-2xl font-bold">
                  {stats.avgBudget >= 1000000
                    ? `$${(stats.avgBudget / 1000000).toFixed(1)}M`
                    : stats.avgBudget >= 1000
                      ? `$${(stats.avgBudget / 1000).toFixed(0)}K`
                      : `$${stats.avgBudget.toFixed(0)}`}
                </div>
                <div className="text-xs text-blue-100">Avg Budget</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connectivity Banner */}
      {!isOnline && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="container mx-auto px-4 py-2 flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-red-700 text-sm">You are offline. Browse results may be outdated.</p>
          </div>
        </div>
      )}

      {/* Per-tab error banner */}
      {currentTabState?.error && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="container mx-auto px-4 py-2 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-red-700 text-sm flex-1">{currentTabState.error}</p>
            <button
              onClick={() => {
                setTabStates(prev => ({ ...prev, [sortBy]: { ...prev[sortBy], loaded: false, error: null } }));
                void fetchPitchesForTab(sortBy);
              }}
              className="flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Search and controls bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="marketplace-search"
                name="search"
                type="text"
                placeholder="Search pitches, creators, genres..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Search pitches"
              />
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {/* Sort dropdown */}
              <select
                id="marketplace-sort"
                name="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                aria-label="Sort pitches by"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* View mode toggle */}
              <div className="flex border rounded-lg">
                {Object.entries(VIEW_MODES).map(([mode, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode as keyof typeof VIEW_MODES)}
                      className={`p-2 ${viewMode === mode ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                      title={config.label}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  );
                })}
              </div>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${showFilters ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
              >
                <SlidersHorizontal className="w-5 h-5" />
                Filters
                {hasActiveFilters && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {filters.genres.length + filters.formats.length + filters.status.length + (searchQuery ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active filters display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-4">
              {searchQuery && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1">
                  Search: {searchQuery}
                  <button onClick={() => setSearchQuery('')}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.genres.map(genre => (
                <span key={genre} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-1">
                  {genre}
                  <button onClick={() => setFilters(f => ({ ...f, genres: f.genres.filter(g => g !== genre) }))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {filters.formats.map(format => (
                <span key={format} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-1">
                  {format}
                  <button onClick={() => setFilters(f => ({ ...f, formats: f.formats.filter(fo => fo !== format) }))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Filters sidebar */}
          <AnimatePresence>
            {showFilters && (
              <motion.aside
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                className="w-64 shrink-0"
              >
                <div className="bg-white rounded-lg shadow-sm p-6 sticky top-20">
                  <h3 className="font-semibold text-gray-900 mb-4">Filters</h3>
                  
                  {/* Genre filter */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Genre</h4>
                    <div className="space-y-2">
                      {(config?.genres || ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller']).map((genre) => (
                        <label key={genre} className="flex items-center">
                          <input
                            id={`genre-filter-${genre.toLowerCase().replace(/\s+/g, '-')}`}
                            name={`genre-${genre.toLowerCase().replace(/\s+/g, '-')}`}
                            type="checkbox"
                            checked={filters.genres.includes(genre)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilters(f => ({ ...f, genres: [...f.genres, genre] }));
                              } else {
                                setFilters(f => ({ ...f, genres: f.genres.filter(g => g !== genre) }));
                              }
                            }}
                            className="mr-2"
                            aria-label={`Filter by ${genre}`}
                          />
                          <span className="text-sm">{genre}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Format filter */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Format</h4>
                    <div className="space-y-2">
                      {(config?.formats || ['Feature Film', 'Short Film', 'TV Series', 'Web Series']).map((format) => (
                        <label key={format} className="flex items-center">
                          <input
                            id={`format-filter-${format.toLowerCase().replace(/\s+/g, '-')}`}
                            name={`format-filter-${format.toLowerCase().replace(/\s+/g, '-')}`}
                            aria-label={`Filter by ${format} format`}
                            type="checkbox"
                            checked={filters.formats.includes(format)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilters(f => ({ ...f, formats: [...f.formats, format] }));
                              } else {
                                setFilters(f => ({ ...f, formats: f.formats.filter(fo => fo !== format) }));
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">{format}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Budget range */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Budget Range</h4>
                    <div className="space-y-2">
                      <input
                        id="budget-range-slider"
                        name="budget-range-slider"
                        aria-label="Budget range slider"
                        type="range"
                        min="0"
                        max="10000000"
                        step="100000"
                        value={filters.budgetRange.max}
                        onChange={(e) => setFilters(f => ({ ...f, budgetRange: { ...f.budgetRange, max: parseInt(e.target.value) } }))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>${(filters.budgetRange.min / 1000).toFixed(0)}K</span>
                        <span>${(filters.budgetRange.max / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                  </div>

                  {/* Special filters */}
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        id="filter-has-nda"
                        name="filter-has-nda"
                        aria-label="Filter pitches with NDA"
                        type="checkbox"
                        checked={filters.hasNDA === true}
                        onChange={(e) => setFilters(f => ({ ...f, hasNDA: e.target.checked ? true : null }))}
                        className="mr-2"
                      />
                      <span className="text-sm">Has NDA</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        id="filter-has-investment"
                        name="filter-has-investment"
                        aria-label="Filter pitches with investment"
                        type="checkbox"
                        checked={filters.hasInvestment === true}
                        onChange={(e) => setFilters(f => ({ ...f, hasInvestment: e.target.checked ? true : null }))}
                        className="mr-2"
                      />
                      <span className="text-sm">Has Investment</span>
                    </label>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main content */}
          <div className="flex-1">
            {/* Results info */}
            <div className="mb-4 flex justify-between items-center">
              <p className="text-gray-600">
                Showing {paginatedPitches.length} of {filteredPitches.length} pitches
              </p>
            </div>

            {/* Pitches grid */}
            {loading ? (
              <div className={`grid ${VIEW_MODES[viewMode].cols} gap-6`}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <PitchCardSkeleton key={i} />
                ))}
              </div>
            ) : paginatedPitches.length > 0 ? (
              <>
                <AnimatePresence mode="popLayout">
                  <div className={`grid ${VIEW_MODES[viewMode].cols} gap-6`}>
                    {paginatedPitches.map(pitch => renderPitchCard(pitch))}
                  </div>
                </AnimatePresence>
                
                {totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                title="No pitches found"
                description="Try adjusting your filters or search query"
                action={{
                  label: 'Clear filters',
                  onClick: clearFilters
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}