import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { pitchAPI } from '../lib/api';
import type { Pitch } from '../lib/api';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { PitchCardSkeleton } from '@shared/components/feedback/Skeleton';
import EmptyState from '../components/EmptyState';
import { useToast } from '@shared/components/feedback/ToastProvider';
import Pagination from '../components/Pagination';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { configService } from '../services/config.service';

import FormatDisplay from '../components/FormatDisplay';
import PitcheyRating from '../components/PitcheyRating';
import HeatBadge, { getHeatScore, getHeatLevel } from '../components/HeatBadge';
import VerificationBadge from '../components/VerificationBadge';
import HumanMadeBadge from '../components/HumanMadeBadge';
import GenrePlaceholder from '@shared/components/GenrePlaceholder';
import { motion, AnimatePresence } from 'framer-motion';
import PortalTopNav from '@shared/components/layout/PortalTopNav';
import SortPillRow from '@shared/components/ui/SortPillRow';
import {
  Search,
  TrendingUp,
  Eye,
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
  AlertTriangle,
  MapPin,
  Calendar as CalendarIcon,
  Building2,
} from 'lucide-react';
import { API_URL } from '../config';
import { formatBudgetCompact } from '@shared/utils/formatters';

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

// Badge helpers
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isNewPitch(pitch: Pitch): boolean {
  const published = (pitch as unknown as Record<string, unknown>).published_at as string | undefined
    || pitch.createdAt;
  if (!published) return false;
  return Date.now() - new Date(published).getTime() < SEVEN_DAYS_MS;
}

function getTrendingScore(pitch: Pitch): number {
  const pp = pitch as unknown as Record<string, unknown>;
  const rating = Number(pp.rating_average) || Number(pp.ratingAverage) || 0;
  return (pitch.viewCount || 0) * 0.7 + rating * 0.3;
}

// getHeatLevel and getHeatScore imported from HeatBadge component

function getCreatorTier(pitch: Pitch): string | null {
  const pp = pitch as unknown as Record<string, unknown>;
  return (pp.creator_verification_tier as string | null)
    || (pitch.creator as any)?.verificationTier || null;
}

function getPitchBudgetDisplay(pitch: Pitch): string {
  const pp = pitch as unknown as Record<string, unknown>;
  const raw = pp.estimated_budget || pitch.estimatedBudget;
  if (raw && Number(raw) > 0) return formatBudgetCompact(raw);
  const bracket = pp.budget_bracket || pitch.budgetBracket;
  if (bracket) return String(bracket);
  return '';
}

function getCreatorDisplay(pitch: Pitch): string {
  const pp = pitch as unknown as Record<string, unknown>;
  return pitch.creator?.name || pitch.creator?.username
    || (pp.creator_name as string | undefined)
    || (pp.creator_username as string | undefined)
    || 'Unknown';
}

// Enhanced filtering and sorting options.
// `shortLabel` is used in the compact pill row; `label` stays in the a11y/title.
const SORT_OPTIONS = [
  { value: 'hot', label: 'Hottest', shortLabel: 'Hot', icon: Zap },
  { value: 'trending', label: 'Trending Now', shortLabel: 'Trending', icon: TrendingUp },
  { value: 'newest', label: 'Newest First', shortLabel: 'New', icon: Clock },
  { value: 'popular', label: 'Most Popular', shortLabel: 'Popular', icon: Star },
  { value: 'views', label: 'Most Viewed', shortLabel: 'Most Viewed', icon: Eye },
  { value: 'budget_high', label: 'Highest Budget', shortLabel: 'High Budget', icon: DollarSign },
  { value: 'budget_low', label: 'Lowest Budget', shortLabel: 'Low Budget', icon: Wallet },
  { value: 'alphabetical', label: 'A-Z', shortLabel: 'A–Z', icon: BookOpen },
  { value: 'investment_ready', label: 'Investment Ready', shortLabel: 'Inv. Ready', icon: Zap }
];

// Active-state brand colors per sort mode. Hot/Trending/New get semantic accents
// that echo HeatBadge + the existing brand tokens; everything else anchors to the
// primary brand purple so the eye lands on the three marquee discovery modes first.
const SORT_ACTIVE_BG: Record<string, string> = {
  hot: 'bg-brand-featured',
  trending: 'bg-brand-trending',
  newest: 'bg-brand-new',
};
const SORT_DEFAULT_ACTIVE_BG = 'bg-brand-anchor';

const VIEW_MODES = {
  grid: { icon: Grid, label: 'Grid View', cols: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4' },
  list: { icon: List, label: 'List View', cols: 'grid-cols-1' },
  compact: { icon: BarChart3, label: 'Compact View', cols: 'grid-cols-1 sm:grid-cols-2' }
};

interface FilterState {
  genres: string[];
  formats: string[];
  budgetRange: { min: number; max: number };
  status: string[];
  hasNDA: boolean | null;
  hasInvestment: boolean | null;
  dateRange: { start: Date | null; end: Date | null };
  location: string;
  searchType: 'all' | 'pitches' | 'creators' | 'production';
}

export default function MarketplaceEnhanced() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useBetterAuthStore();
  const toast = useToast();
  const { isMobile } = useResponsive();

  // When rendered inside a portal (e.g. /watcher/browse), PortalLayout
  // already provides a header — hide the standalone one to avoid duplicates.
  const isInsidePortal = /^\/(watcher|creator|investor|production|admin)\//.test(location.pathname);
  
  // Per-tab state management to prevent content bleeding
  interface TabState {
    pitches: Pitch[];
    loading: boolean;
    error: string | null;
    loaded: boolean;
    fetchedAt: number;
  }
  const STALE_AFTER_MS = 3 * 60 * 1000; // re-fetch after 3 minutes
  const [tabStates, setTabStates] = useState<Record<string, TabState>>({});
  const [viewMode, setViewMode] = useState<keyof typeof VIEW_MODES>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'popular');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(16);
  const fetchRequestIdRef = useRef(0);
  const isOnline = useOnlineStatus();

  // Enhanced filter state
  const [filters, setFilters] = useState<FilterState>({
    genres: searchParams.get('genres')?.split(',').filter(Boolean) || [],
    formats: searchParams.get('formats')?.split(',').filter(Boolean) || [],
    budgetRange: { 
      min: parseInt(searchParams.get('budgetMin') || '0'), 
      max: parseInt(searchParams.get('budgetMax') || '500000000')
    },
    status: searchParams.get('status')?.split(',').filter(Boolean) || [],
    hasNDA: searchParams.get('hasNDA') === 'true' ? true : searchParams.get('hasNDA') === 'false' ? false : null,
    hasInvestment: searchParams.get('hasInvestment') === 'true' ? true : searchParams.get('hasInvestment') === 'false' ? false : null,
    dateRange: { start: null, end: null },
    location: '',
    searchType: 'all',
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

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const isSearchMode = debouncedSearch.length > 0;

  // Load config
  useEffect(() => {
    void configService.getConfiguration().then((cfg) => { setConfig(cfg as { genres?: string[]; formats?: string[] }); }).catch(console.error);
  }, []);

  // Derive current tab's pitches from per-tab state
  const currentTabState = tabStates[sortBy];
  const pitches = currentTabState?.pitches ?? [];
  const loading = currentTabState?.loading ?? !currentTabState?.loaded;

  // Load pitches for the current sort/tab — re-fetch when stale
  useEffect(() => {
    const tab = sortBy;
    const state = tabStates[tab];
    const isStale = state?.fetchedAt && Date.now() - state.fetchedAt > STALE_AFTER_MS;
    if (state?.loaded && !isStale) return;
    void fetchPitchesForTab(tab);
  }, [sortBy]);

  // Sync state FROM url on navigation. useState initializers only run once,
  // so without these effects the component's state drifts from the URL when
  // someone deep-links from elsewhere (e.g. top-nav "Hot" → ?sort=hot, or a
  // future marketplace link with ?search=… / ?genres=…). Equality guards
  // prevent ping-pong with the state→URL effect below.
  useEffect(() => {
    const urlSort = searchParams.get('sort') || 'popular';
    if (urlSort !== sortBy) setSortBy(urlSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== searchQuery) setSearchQuery(urlSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const urlFilters = {
      genres: searchParams.get('genres')?.split(',').filter(Boolean) || [],
      formats: searchParams.get('formats')?.split(',').filter(Boolean) || [],
      status: searchParams.get('status')?.split(',').filter(Boolean) || [],
      budgetMin: parseInt(searchParams.get('budgetMin') || '0'),
      budgetMax: parseInt(searchParams.get('budgetMax') || '500000000'),
      hasNDA: searchParams.get('hasNDA') === 'true' ? true : searchParams.get('hasNDA') === 'false' ? false : null,
      hasInvestment: searchParams.get('hasInvestment') === 'true' ? true : searchParams.get('hasInvestment') === 'false' ? false : null,
    };
    setFilters((prev) => {
      // Round-trip idempotency: only the fields the state→URL writer emits are
      // compared. dateRange/location/searchType are UI-only today (not written
      // to URL), so keep the previous values for those.
      const same =
        prev.genres.join(',') === urlFilters.genres.join(',') &&
        prev.formats.join(',') === urlFilters.formats.join(',') &&
        prev.status.join(',') === urlFilters.status.join(',') &&
        prev.budgetRange.min === urlFilters.budgetMin &&
        prev.budgetRange.max === urlFilters.budgetMax &&
        prev.hasNDA === urlFilters.hasNDA &&
        prev.hasInvestment === urlFilters.hasInvestment;
      if (same) return prev;
      return {
        ...prev,
        genres: urlFilters.genres,
        formats: urlFilters.formats,
        status: urlFilters.status,
        budgetRange: { min: urlFilters.budgetMin, max: urlFilters.budgetMax },
        hasNDA: urlFilters.hasNDA,
        hasInvestment: urlFilters.hasInvestment,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (sortBy !== 'popular') params.set('sort', sortBy);
    if (filters.genres.length) params.set('genres', filters.genres.join(','));
    if (filters.formats.length) params.set('formats', filters.formats.join(','));
    if (filters.status.length) params.set('status', filters.status.join(','));
    if (filters.budgetRange.min > 0) params.set('budgetMin', filters.budgetRange.min.toString());
    if (filters.budgetRange.max < 500000000) params.set('budgetMax', filters.budgetRange.max.toString());
    if (filters.hasNDA !== null) params.set('hasNDA', filters.hasNDA.toString());
    if (filters.hasInvestment !== null) params.set('hasInvestment', filters.hasInvestment.toString());

    setSearchParams(params, { replace: true });
  }, [searchQuery, sortBy, filters]);

  // Reset to page 1 when filter criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, sortBy, filters]);

  const fetchPitchesForTab = async (tab: string) => {
    const requestId = ++fetchRequestIdRef.current;

    setTabStates(prev => ({
      ...prev,
      [tab]: { pitches: prev[tab]?.pitches ?? [], loading: true, error: null, loaded: false, fetchedAt: 0 }
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
        [tab]: { pitches: validPitches, loading: false, error: null, loaded: true, fetchedAt: Date.now() }
      }));
      calculateStats(validPitches);
    } catch (error) {
      if (requestId !== fetchRequestIdRef.current) return;
      console.error('Error fetching pitches:', error);
      toast.error('Failed to load pitches');
      setTabStates(prev => ({
        ...prev,
        [tab]: { pitches: [], loading: false, error: 'Failed to load pitches', loaded: true, fetchedAt: Date.now() }
      }));
      calculateStats([]);
    }
  };

  const performServerSearch = async () => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (filters.searchType !== 'all') params.set('type', filters.searchType);
      if (filters.genres.length > 0) params.set('genres', filters.genres.join(','));
      if (filters.budgetRange.max < 500000000) params.set('maxBudget', String(filters.budgetRange.max));
      if (filters.budgetRange.min > 0) params.set('minBudget', String(filters.budgetRange.min));
      if (filters.location) params.set('location', filters.location);
      params.set('limit', '50');

      const response = await fetch(`${API_URL}/api/search?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Search failed');

      const result = await response.json();
      const data = result.data;
      let items: any[] = [];

      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === 'object') {
        const pitches = Array.isArray(data.pitches) ? data.pitches : [];
        const users = Array.isArray(data.users) ? data.users : [];
        const companies = Array.isArray(data.companies) ? data.companies : [];
        items = [
          ...pitches,
          ...users.map((u: any) => ({ ...u, _type: u.role === 'production' ? 'production' : 'creator' })),
          ...companies.map((c: any) => ({ ...c, _type: 'production' })),
        ];
      }

      setSearchResults(items.map((r: any) => ({
        id: r.id,
        type: r._type || r.type || (r.user_type ? (r.user_type === 'production' ? 'production' : 'creator') : 'pitch'),
        title: r.title || r.name || r.display_name || 'Untitled',
        description: r.logline || r.description || r.bio || '',
        image: r.title_image || r.titleImage || r.thumbnail_url || r.avatar_url,
        genre: r.genre,
        budget: r.budget || r.estimated_budget,
        views: Number(r.view_count || r.views || 0),
        likes: Number(r.like_count || r.likes || 0),
        createdAt: r.created_at || new Date().toISOString(),
        author: r.creator_name || r.company_name,
      })));
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Search failed:', e.message);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (isSearchMode) {
      performServerSearch();
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch, filters.searchType, filters.location, filters.genres]);

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

  const filteredPitches = useMemo(() => {
    // Ensure pitches is an array before spreading
    if (!Array.isArray(pitches)) {
      return [];
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
      let budgetValue = 0;
      const budgetStr = pitch.estimatedBudget || pitch.budgetBracket || '';
      if (budgetStr) {
        const match = String(budgetStr).match(/(\d+)/);
        if (match) {
          const raw = parseInt(match[1], 10);
          // If the value is already a large number (e.g. 45000000), use as-is.
          // Only multiply by 1M for short-form values like "5" or "25" (millions).
          budgetValue = raw >= 100000 ? raw : raw * 1000000;
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
      if (!match) return 0;
      const raw = parseInt(match[1], 10);
      return raw >= 100000 ? raw : raw * 1000000;
    };
    const getInvestmentGoal = (p: Pitch) => {
      const pp = p as unknown as Record<string, unknown>;
      return Number(pp.investmentGoal) || Number(pp.investment_goal) || 0;
    };
    const getTotalInvestment = (p: Pitch) => {
      const pp = p as unknown as Record<string, unknown>;
      return Number(pp.totalInvestment) || Number(pp.total_investment) || 0;
    };

    const getHeatScore = (p: Pitch) => {
      const pp = p as unknown as Record<string, unknown>;
      return Number(pp.heat_score) || Number(pp.heatScore) || p.heatScore || 0;
    };

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'hot':
          return getHeatScore(b) - getHeatScore(a);
        case 'trending':
          return (getHeatScore(b) || (getViewCount(b) + getLikeCount(b))) - (getHeatScore(a) || (getViewCount(a) + getLikeCount(a)));
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

    return filtered;
  }, [pitches, debouncedSearch, sortBy, filters]);

  // Pagination
  const paginatedPitches = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPitches.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPitches, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPitches.length / itemsPerPage);

  const handlePitchClick = (pitch: Pitch) => {
    if (!isAuthenticated) {
      void navigate(`/pitch/${pitch.id}`);
    } else if (user?.userType === 'investor') {
      void navigate(`/investor/pitch/${pitch.id}`);
    } else if (user?.userType === 'production') {
      void navigate(`/production/pitch/${pitch.id}`);
    } else if (user?.userType === 'creator' && (pitch.creator?.id || pitch.userId) === user?.id) {
      void navigate(`/creator/pitch/${pitch.id}`);
    } else {
      void navigate(`/pitch/${pitch.id}`);
    }
  };

  const clearFilters = () => {
    setFilters({
      genres: [],
      formats: [],
      budgetRange: { min: 0, max: 500000000 },
      status: [],
      hasNDA: null,
      hasInvestment: null,
      dateRange: { start: null, end: null },
      location: '',
      searchType: 'all',
    });
    setSearchQuery('');
    setSortBy('trending');
  };

  const hasActiveFilters = filters.genres.length > 0 || 
    filters.formats.length > 0 || 
    filters.status.length > 0 ||
    filters.budgetRange.min > 0 || 
    filters.budgetRange.max < 500000000 ||
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
          className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-3 sm:p-4 cursor-pointer"
          onClick={() => handlePitchClick(pitch)}
        >
          <div className="flex gap-3 sm:gap-4">
            <div className="w-16 h-24 sm:w-24 sm:h-36 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
              {getPitchImageUrl(pitch) ? (
                <img
                  src={getPitchImageUrl(pitch)}
                  alt={pitch.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <GenrePlaceholder genre={pitch.genre} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2 mb-1 sm:mb-2">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold truncate">{pitch.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">{getCreatorDisplay(pitch)}</p>
                </div>
                <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                  {pitch.genre && (
                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-100 text-purple-800 text-[10px] sm:text-xs rounded-full">
                      {pitch.genre}
                    </span>
                  )}
                  <span className="hidden sm:block">{pitch.format && <FormatDisplay format={pitch.format} />}</span>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-2 sm:mb-3 line-clamp-1 sm:line-clamp-2">{pitch.logline}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                    {pitch.viewCount || 0}
                  </span>
                  {(() => {
                    const r = Number((pitch as any).rating_average) || Number((pitch as any).ratingAverage) || 0;
                    return r > 0 ? <PitcheyRating mode="stars" value={r} showNumber /> : null;
                  })()}
                  <span className="hidden sm:flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    {((pitch as unknown as Record<string, unknown>).commentCount as number | undefined) || 0}
                  </span>
                </div>
                {getPitchBudgetDisplay(pitch) && (
                  <span className="text-xs sm:text-sm font-medium text-green-600 flex items-center gap-0.5">
                    <DollarSign className="w-3 h-3" />
                    {getPitchBudgetDisplay(pitch).replace('$', '')}
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
        <div className="aspect-[4/5] sm:aspect-[3/4] relative overflow-hidden bg-gray-100">
          {getPitchImageUrl(pitch) ? (
            <img
              src={getPitchImageUrl(pitch)}
              alt={pitch.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <GenrePlaceholder genre={pitch.genre} />
          )}

          {/* Overlay with quick info — always visible on mobile (no hover), hover on desktop */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent sm:from-black/80 sm:via-black/20 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-4 text-white">
              <p className="text-xs sm:text-sm line-clamp-2 sm:line-clamp-3 mb-1 sm:mb-2">{pitch.logline}</p>
              <div className="flex gap-2 text-[10px] sm:text-xs">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {pitch.viewCount || 0}
                </span>
                {(() => {
                  const r = Number((pitch as any).rating_average) || Number((pitch as any).ratingAverage) || 0;
                  return r > 0 ? <PitcheyRating mode="stars" value={r} showNumber /> : null;
                })()}
              </div>
            </div>
          </div>

          {/* Badges — lower-right over media, pill style */}
          <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
            {((pitch as unknown as Record<string, unknown>).isFeatured as boolean | undefined) && (
              <span className="bg-brand-featured/90 backdrop-blur-sm text-white px-2.5 py-0.5 text-xs rounded-full font-medium flex items-center gap-1">
                <Star className="w-3 h-3" />
                Featured
              </span>
            )}
            {!((pitch as unknown as Record<string, unknown>).isFeatured) && (
              <HeatBadge score={getHeatScore(pitch as unknown as Record<string, unknown>)} />
            )}
            {isNewPitch(pitch) && (
              <span className="bg-brand-new/90 backdrop-blur-sm text-white px-2.5 py-0.5 text-xs rounded-full font-medium flex items-center gap-1">
                <Zap className="w-3 h-3" />
                New
              </span>
            )}
            {(pitch.hasNDA || pitch.requireNDA) && (
              <span className="border border-white/60 backdrop-blur-sm text-white px-2.5 py-0.5 text-xs rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3" />
                NDA
              </span>
            )}
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 text-sm sm:text-base">
            {pitch.title}
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2 truncate flex items-center gap-1">
            {getCreatorDisplay(pitch)}
            <VerificationBadge tier={getCreatorTier(pitch) as any} />
          </p>

          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <div className="flex gap-1 sm:gap-2 items-center">
              {pitch.genre && (
                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-700 text-[10px] sm:text-xs rounded">
                  {pitch.genre}
                </span>
              )}
              <HumanMadeBadge aiUsed={(pitch as any).aiUsed ?? (pitch as any).ai_used} />
            </div>
            {getPitchBudgetDisplay(pitch) && (
              <span className="text-xs sm:text-sm font-medium text-green-600 flex items-center gap-0.5">
                <DollarSign className="w-3 h-3" />
                {getPitchBudgetDisplay(pitch).replace('$', '')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] sm:text-xs text-gray-500 pt-1.5 sm:pt-2 border-t">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {pitch.viewCount || 0}
            </span>
            {(() => {
              const r = Number((pitch as any).rating_average) || Number((pitch as any).ratingAverage) || 0;
              return r > 0 ? <PitcheyRating mode="stars" value={r} showNumber /> : null;
            })()}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Portal-aware top nav — hidden when inside a portal (PortalLayout has its own) */}
      {!isInsidePortal && <PortalTopNav />}

      {/* Header with stats */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-600 text-white">
        <div className="container mx-auto px-4 py-5 sm:py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Marketplace</h1>
              <p className="text-sm sm:text-base text-purple-200">Discover and invest in the next big hit</p>
            </div>

            {/* Quick stats — 2x2 on mobile, 4 across on tablet+ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4 w-full md:w-auto">
              <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2 sm:p-3">
                <div className="text-xl sm:text-2xl font-bold">{filteredPitches.length}</div>
                <div className="text-[10px] sm:text-xs text-purple-200">Active Pitches</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2 sm:p-3">
                <div className="text-xl sm:text-2xl font-bold">{stats.activeCreators}</div>
                <div className="text-[10px] sm:text-xs text-purple-200">Creators</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2 sm:p-3">
                <div className="text-xl sm:text-2xl font-bold">
                  {stats.totalInvestment > 0 ? formatBudgetCompact(stats.totalInvestment) : '$0'}
                </div>
                <div className="text-[10px] sm:text-xs text-purple-200">Total Invested</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2 sm:p-3">
                <div className="text-xl sm:text-2xl font-bold">
                  {formatBudgetCompact(stats.avgBudget) || '$0'}
                </div>
                <div className="text-[10px] sm:text-xs text-purple-200">Avg Budget</div>
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

      {/* Featured Pitches Row — shows top trending when no pitches are explicitly featured */}
      {!loading && pitches.length > 0 && (() => {
        const featured = pitches.filter((p: Pitch) => (p as unknown as Record<string, unknown>).isFeatured);
        const spotlight = featured.length > 0 ? featured : pitches.filter((p: Pitch) => getTrendingScore(p) >= 5).slice(0, 3);
        if (spotlight.length === 0) return null;
        return (
          <div className="bg-gradient-to-r from-brand-anchor/5 to-brand-featured/5 border-b">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-brand-featured" />
                <h2 className="text-sm font-semibold text-gray-900">{featured.length > 0 ? 'Featured' : 'Spotlight'}</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {spotlight.map((pitch: Pitch) => (
                  <div
                    key={`spotlight-${pitch.id}`}
                    onClick={() => handlePitchClick(pitch)}
                    className="flex-shrink-0 w-64 bg-white rounded-lg shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden flex"
                  >
                    <div className="w-20 h-20 bg-gray-100 flex-shrink-0 overflow-hidden">
                      {getPitchImageUrl(pitch) ? (
                        <img src={getPitchImageUrl(pitch)} alt={pitch.title} className="w-full h-full object-cover" />
                      ) : (
                        <GenrePlaceholder genre={pitch.genre} />
                      )}
                    </div>
                    <div className="p-2.5 min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{pitch.title}</h3>
                      <p className="text-xs text-gray-500 truncate">{getCreatorDisplay(pitch)}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{pitch.viewCount || 0}</span>
                        {(() => {
                          const r = Number((pitch as any).rating_average) || Number((pitch as any).ratingAverage) || 0;
                          return r > 0 ? <PitcheyRating mode="stars" value={r} showNumber /> : null;
                        })()}
                        {getPitchBudgetDisplay(pitch) && <span className="text-green-600 font-medium">{getPitchBudgetDisplay(pitch)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Search and controls bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          {/* Row 1: search + filters toggle + view mode — combined so secondary controls
              share the row and the sort pills (row 2) get the full horizontal canvas */}
          <div className="flex gap-2 sm:gap-3 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="marketplace-search"
                name="search"
                type="text"
                placeholder="Search pitches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                aria-label="Search pitches"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 sm:px-4 py-2 border rounded-lg flex items-center gap-2 flex-shrink-0 transition ${showFilters ? 'bg-brand-anchor text-white border-brand-anchor' : 'hover:bg-gray-100'}`}
            >
              <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Filters</span>
              {hasActiveFilters && (
                <span className="bg-brand-nda text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {filters.genres.length + filters.formats.length + filters.status.length + (searchQuery ? 1 : 0)}
                </span>
              )}
            </button>

            {/* View mode toggle — moved up from row 2; it's a display preference,
                not a discovery axis, so it doesn't need its own row */}
            <div className="hidden sm:flex border rounded-lg flex-shrink-0" role="group" aria-label="View mode">
              {Object.entries(VIEW_MODES).map(([mode, cfg]) => {
                const Icon = cfg.icon;
                const active = viewMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode as keyof typeof VIEW_MODES)}
                    className={`p-2 transition ${active ? 'bg-brand-anchor text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    title={cfg.label}
                    aria-label={cfg.label}
                    aria-pressed={active}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 2: sort pills — primary discovery axis, promoted from a <select>
              so the three marquee modes (Hot/Trending/New) are visible at a glance.
              Color-coded active states echo brand.featured/trending/new */}
          <SortPillRow
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={setSortBy}
            ariaLabel="Sort pitches by"
            activeAccents={SORT_ACTIVE_BG}
            defaultActiveBg={SORT_DEFAULT_ACTIVE_BG}
          />

          {/* Row 3: genre quick-chips — softer tinted palette signals "secondary
              filter" below sort. Config-driven with a sensible fallback list.
              Multi-select shares state with the sidebar's genre checkboxes. */}
          {(() => {
            const genreList = config?.genres?.length
              ? config.genres
              : ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller'];
            const noGenreActive = filters.genres.length === 0;
            return (
              <div
                className="flex gap-2 overflow-x-auto scrollbar-hide mt-2 -mx-1 px-1"
                role="group"
                aria-label="Quick genre filter"
              >
                <button
                  onClick={() => setFilters(f => ({ ...f, genres: [] }))}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition ${
                    noGenreActive
                      ? 'bg-purple-100 text-purple-700 border-purple-300'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  All
                </button>
                {genreList.map((genre) => {
                  const active = filters.genres.includes(genre);
                  return (
                    <button
                      key={`chip-${genre}`}
                      onClick={() => setFilters(f => ({
                        ...f,
                        genres: active ? f.genres.filter(g => g !== genre) : [...f.genres, genre],
                      }))}
                      aria-pressed={active}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition ${
                        active
                          ? 'bg-purple-100 text-purple-700 border-purple-300'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Active filters display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 sm:mt-4">
              {searchQuery && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-1">
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

      <div className="container mx-auto px-4 py-4 sm:py-6">
        {/* Mobile filter overlay backdrop */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              onClick={() => setShowFilters(false)}
            />
          )}
        </AnimatePresence>

        <div className="flex gap-6 relative">
          {/* Filters sidebar — slide-over on mobile, inline on desktop */}
          <AnimatePresence>
            {showFilters && (
              <motion.aside
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto bg-white shadow-xl lg:shadow-none lg:static lg:z-auto lg:w-64 lg:shrink-0"
              >
                <div className="bg-white lg:rounded-lg lg:shadow-sm p-6 lg:sticky lg:top-20 h-full lg:h-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Filters</h3>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="lg:hidden p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  
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
                        max="500000000"
                        step="100000"
                        value={filters.budgetRange.max}
                        onChange={(e) => setFilters(f => ({ ...f, budgetRange: { ...f.budgetRange, max: parseInt(e.target.value) } }))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>${(filters.budgetRange.min / 1000000).toFixed(0)}M</span>
                        <span>${(filters.budgetRange.max / 1000000).toFixed(0)}M</span>
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

                  {/* Location */}
                  <div className="mb-4">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="City, country..."
                        value={filters.location}
                        onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Search Type (only in search mode) */}
                  {isSearchMode && (
                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Search In</label>
                      <select
                        value={filters.searchType}
                        onChange={(e) => setFilters(prev => ({ ...prev, searchType: e.target.value as any }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        <option value="all">All Results</option>
                        <option value="pitches">Pitches Only</option>
                        <option value="creators">Creators Only</option>
                        <option value="production">Production Companies</option>
                      </select>
                    </div>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Results info */}
            <div className="mb-3 sm:mb-4 flex justify-between items-center">
              <p className="text-sm sm:text-base text-gray-600">
                {paginatedPitches.length} of {filteredPitches.length} pitches
              </p>
            </div>

            {/* Pitches grid */}
            {loading ? (
              <div className={`grid ${VIEW_MODES[viewMode].cols} gap-3 sm:gap-6`}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <PitchCardSkeleton key={i} />
                ))}
              </div>
            ) : paginatedPitches.length > 0 ? (
              <>
                <AnimatePresence mode="popLayout">
                  <div className={`grid ${VIEW_MODES[viewMode].cols} gap-3 sm:gap-6`}>
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
                title="No matches found"
                description="Try broadening your filters or checking your spelling."
                action={{
                  label: 'Clear All Filters',
                  onClick: clearFilters
                }}
              />
            )}

            {/* Search Results (non-pitch) */}
            {isSearchMode && searchResults.filter(r => r.type !== 'pitch').length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Creators & Companies</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.filter(r => r.type !== 'pitch').map((result) => (
                    <div
                      key={`${result.type}-${result.id}`}
                      onClick={() => navigate(result.type === 'creator' ? `/creator/${result.id}` : `/production/company/${result.id}`)}
                      className="bg-white rounded-lg shadow-sm hover:shadow-md transition p-4 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          {result.type === 'creator' ? <User className="w-5 h-5 text-purple-500" /> : <Building2 className="w-5 h-5 text-orange-500" />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{result.title}</h3>
                          <p className="text-xs text-gray-500 capitalize">{result.type}</p>
                        </div>
                      </div>
                      {result.description && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{result.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}