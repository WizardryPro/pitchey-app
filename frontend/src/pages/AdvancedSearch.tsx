import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, Filter, SlidersHorizontal, Grid, List,
  Star, Clock, DollarSign, Calendar, Users,
  MapPin, Film, Award, Eye, Heart, ChevronDown,
  X, RefreshCw, Download, ArrowUpDown, User,
  ArrowLeft, Home, ShoppingBag, LogOut
} from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { toast } from 'react-hot-toast';
import { API_URL } from '../config';
import { getPortalPath } from '@/utils/navigation';

interface SearchFilters {
  query: string;
  type: 'all' | 'pitches' | 'creators' | 'production';
  genres: string[];
  budgetRange: {
    min: number;
    max: number;
  };
  budget?: {
    min: number;
    max: number;
  };
  dateRange: {
    start: string;
    end: string;
  };
  format: string[];
  status: string[];
  location: string;
  rating: number;
  sortBy: 'relevance' | 'date' | 'rating' | 'budget' | 'popularity';
  sortOrder: 'asc' | 'desc';
}

interface SearchResult {
  id: string;
  type: 'pitch' | 'creator' | 'production';
  title: string;
  description: string;
  image?: string;
  rating?: number;
  genre?: string[];
  budget?: number;
  format?: string;
  status?: string;
  location?: string;
  createdAt: string;
  author?: string;
  views?: number;
  likes?: number;
}

export default function AdvancedSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    type: 'all',
    genres: [],
    budgetRange: { min: 0, max: 50000000 },
    dateRange: { start: '', end: '' },
    format: [],
    status: [],
    location: '',
    rating: 0,
    sortBy: 'relevance',
    sortOrder: 'desc'
  });

  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const resultsPerPage = 12;

  // Available filter options
  const genreOptions = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
    'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'Documentary', 'Animation'
  ];

  const formatOptions = [
    'Feature Film', 'Short Film', 'TV Series', 'Limited Series', 
    'Documentary', 'Web Series', 'Commercial', 'Music Video'
  ];

  const statusOptions = [
    'Development', 'Pre-Production', 'Production', 'Post-Production',
    'Completed', 'Released', 'In Review', 'Greenlit'
  ];

  // Initialize from URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const query = searchParams.get('q') || '';
    if (query) {
      setFilters(prev => ({ ...prev, query }));
    }
  }, [location.search]);

  // Debounced search — runs on any filter change, including initial load
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.query) params.set('q', filters.query);
      if (filters.type !== 'all') params.set('type', filters.type);
      if (filters.genres.length > 0) params.set('genres', filters.genres.join(','));
      if (filters.budgetRange.max < 50000000) params.set('maxBudget', String(filters.budgetRange.max));
      if (filters.budgetRange.min > 0) params.set('minBudget', String(filters.budgetRange.min));
      if (filters.rating > 0) params.set('minRating', String(filters.rating));
      if (filters.location) params.set('location', filters.location);
      if (filters.sortBy !== 'relevance') params.set('sort', filters.sortBy);
      if (filters.sortOrder !== 'desc') params.set('order', filters.sortOrder);
      params.set('page', String(currentPage));
      params.set('limit', String(resultsPerPage));

      const response = await fetch(`${API_URL}/api/search?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const result = await response.json();

      // Backend returns { data: { pitches: [], users: [], companies: [] } }
      // Handle multiple response formats:
      // 1. searchPitches: { success, data: [...pitches], meta: { pagination } }
      // 2. search (SearchFiltersHandler): { success, data: { pitches, users, companies } }
      const data = result.data;
      let rawItems: any[] = [];

      if (Array.isArray(data)) {
        // Format 1: flat array of pitches from searchPitches
        rawItems = data;
      } else if (data && typeof data === 'object') {
        // Format 2: { pitches, users, companies } from SearchFiltersHandler
        const pitches = Array.isArray(data.pitches) ? data.pitches : [];
        const users = Array.isArray(data.users) ? data.users : [];
        const companies = Array.isArray(data.companies) ? data.companies : [];
        rawItems = [
          ...pitches,
          ...users.map((u: any) => ({ ...u, _type: u.role === 'production' ? 'production' : 'creator' })),
          ...companies.map((c: any) => ({ ...c, _type: 'production' })),
        ];
      }

      const mapped: SearchResult[] = rawItems.map((r: any) => ({
        id: String(r.id),
        type: (r._type || r.type || (r.user_type ? (r.user_type === 'production' ? 'production' : 'creator') : 'pitch')) as 'pitch' | 'creator' | 'production',
        title: r.title || r.name || r.display_name || 'Untitled',
        description: r.logline || r.description || r.bio || '',
        image: r.title_image || r.titleImage || r.thumbnail_url || r.cover_image || r.avatar_url || undefined,
        rating: r.rating ? Number(r.rating) : undefined,
        genre: r.genre ? (Array.isArray(r.genre) ? r.genre : [r.genre]) : undefined,
        budget: r.budget ? Number(r.budget) : undefined,
        format: r.format,
        status: r.status,
        location: r.location,
        createdAt: r.created_at || new Date().toISOString(),
        author: r.creator_name,
        views: Number(r.view_count || r.views || r.pitch_count) || undefined,
        likes: Number(r.like_count || r.likes || r.follower_count) || undefined,
      }));

      setResults(mapped);
      const total = result.meta?.pagination?.total || result.total || mapped.length;
      setTotalResults(total);
      setCurrentPage(1);

    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Search failed:', e);
      toast.error('Search failed. Please try again.');
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleArrayFilterToggle = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: (prev[key] as string[]).includes(value)
        ? (prev[key] as string[]).filter(item => item !== value)
        : [...(prev[key] as string[]), value]
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      type: 'all',
      genres: [],
      budgetRange: { min: 0, max: 50000000 },
      dateRange: { start: '', end: '' },
      format: [],
      status: [],
      location: '',
      rating: 0,
      sortBy: 'relevance',
      sortOrder: 'desc'
    });
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'pitch') {
      navigate(`/pitch/${result.id}`);
    } else if (result.type === 'creator') {
      navigate(`/creator/${result.id}`);
    } else if (result.type === 'production') {
      navigate(`/production/company/${result.id}`);
    }
  };

  const handleLike = async (e: React.MouseEvent, result: SearchResult) => {
    e.stopPropagation();
    if (result.type !== 'pitch') return;
    try {
      const isLiked = likedIds.has(result.id);
      const response = await fetch(`${API_URL}/api/pitches/${result.id}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        setLikedIds(prev => {
          const next = new Set(prev);
          if (isLiked) next.delete(result.id); else next.add(result.id);
          return next;
        });
        toast.success(isLiked ? 'Removed like' : 'Liked!');
      }
    } catch {
      toast.error('Failed to update like');
    }
  };

  const handleFollow = async (e: React.MouseEvent, result: SearchResult) => {
    e.stopPropagation();
    // For pitches, follow the creator; for users, follow the user
    const targetId = result.type === 'pitch' ? result.id : result.id;
    const isFollowed = followedIds.has(result.id);
    try {
      const response = await fetch(`${API_URL}/api/follows`, {
        method: isFollowed ? 'DELETE' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, targetType: result.type === 'pitch' ? 'pitch' : 'user' }),
      });
      if (response.ok) {
        setFollowedIds(prev => {
          const next = new Set(prev);
          if (isFollowed) next.delete(result.id); else next.add(result.id);
          return next;
        });
        toast.success(isFollowed ? 'Unfollowed' : 'Following!');
      }
    } catch {
      toast.error('Failed to update follow');
    }
  };

  const exportResults = () => {
    toast.success('Search results exported to CSV');
  };

  const formatBudget = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * resultsPerPage;
    return results.slice(start, start + resultsPerPage);
  }, [results, currentPage]);

  const totalPages = Math.ceil(totalResults / resultsPerPage);

  const dashboardPath = user?.userType ? `/${getPortalPath(user.userType)}/dashboard` : '/dashboard';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-3 sm:gap-6">
              <button
                onClick={() => navigate('/')}
                className="text-xl sm:text-2xl font-bold text-purple-600"
              >
                Pitchey
              </button>
              <nav className="hidden sm:flex items-center gap-4">
                <button
                  onClick={() => navigate('/marketplace')}
                  className="text-sm text-gray-600 hover:text-purple-600 transition"
                >
                  Marketplace
                </button>
                <span className="text-sm text-purple-600 font-medium">
                  Advanced Search
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {user && (
                <>
                  <span className="hidden md:block text-sm text-gray-600">
                    {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email}
                  </span>
                  <button
                    onClick={() => navigate(dashboardPath)}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={async () => { await logout(); navigate('/'); }}
                    className="p-2 text-gray-400 hover:text-red-600 transition"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              )}
              {!user && (
                <button
                  onClick={() => navigate('/portals')}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Page title — mobile gets a back button */}
        <div className="mb-6 sm:mb-8 flex items-start gap-3">
          <button
            onClick={() => navigate(-1)}
            className="sm:hidden mt-1 p-1 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Advanced Search</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Find pitches, creators, and production companies</p>
          </div>
        </div>

        <div className="flex gap-8 relative">
          {/* Mobile filter overlay backdrop */}
          {showFilters && (
            <div
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              onClick={() => setShowFilters(false)}
            />
          )}

          {/* Filters Sidebar — slide-over on mobile, sticky sidebar on desktop */}
          {showFilters && (
            <div className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] overflow-y-auto bg-white shadow-xl lg:shadow-none lg:static lg:z-auto lg:w-80 lg:flex-shrink-0">
              <Card className="lg:sticky lg:top-4 border-0 lg:border rounded-none lg:rounded-lg h-full lg:h-auto">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Filter className="w-5 h-5" />
                      Filters
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={clearFilters}
                        className="text-sm text-purple-600 hover:text-purple-800"
                      >
                        Clear All
                      </button>
                      <button
                        onClick={() => setShowFilters(false)}
                        className="lg:hidden p-1 hover:bg-gray-100 rounded"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Search Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Search Type</label>
                    <select
                      value={filters.type}
                      onChange={(e) => handleFilterChange('type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="all">All Results</option>
                      <option value="pitches">Pitches Only</option>
                      <option value="creators">Creators Only</option>
                      <option value="production">Production Companies</option>
                    </select>
                  </div>

                  {/* Genres */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Genres</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {genreOptions.map(genre => (
                        <label key={genre} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={filters.genres.includes(genre)}
                            onChange={() => handleArrayFilterToggle('genres', genre)}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{genre}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Budget Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget Range</label>
                    <div className="space-y-2">
                      <input
                        type="range"
                        min="0"
                        max="50000000"
                        step="100000"
                        value={filters.budgetRange.max}
                        onChange={(e) => handleFilterChange('budgetRange', { 
                          ...filters.budgetRange, 
                          max: parseInt(e.target.value) 
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>$0</span>
                        <span>{formatBudget(filters.budgetRange.max)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Date Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={filters.dateRange.start}
                        onChange={(e) => handleFilterChange('dateRange', { 
                          ...filters.dateRange, 
                          start: e.target.value 
                        })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <input
                        type="date"
                        value={filters.dateRange.end}
                        onChange={(e) => handleFilterChange('dateRange', { 
                          ...filters.dateRange, 
                          end: e.target.value 
                        })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Format */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                    <div className="space-y-2">
                      {formatOptions.map(format => (
                        <label key={format} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={filters.format.includes(format)}
                            onChange={() => handleArrayFilterToggle('format', format)}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{format}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Minimum Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rating</label>
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map(rating => (
                        <button
                          key={rating}
                          onClick={() => handleFilterChange('rating', rating === filters.rating ? 0 : rating)}
                          className={`p-1 ${rating <= filters.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                        >
                          <Star className="w-5 h-5 fill-current" />
                        </button>
                      ))}
                      <span className="ml-2 text-sm text-gray-600">
                        {filters.rating > 0 ? `${filters.rating}+` : 'Any'}
                      </span>
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={filters.location}
                      onChange={(e) => handleFilterChange('location', e.target.value)}
                      placeholder="City, State or Country"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Search Bar and Controls */}
            <Card className="mb-6">
              <CardContent className="pt-4 sm:pt-6">
                <div className="flex gap-2 sm:gap-4 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={filters.query}
                      onChange={(e) => handleFilterChange('query', e.target.value)}
                      placeholder="Search pitches, creators..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                    />
                  </div>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-3 sm:px-4 py-3 border border-gray-300 rounded-lg transition flex items-center gap-2 flex-shrink-0 ${
                      showFilters ? 'bg-purple-50 border-purple-300 text-purple-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">Filters</span>
                  </button>
                </div>

                {/* Controls — stacks on mobile */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                      {loading ? 'Searching...' : `${totalResults} results`}
                    </span>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 hidden sm:inline">Sort by:</label>
                      <select
                        value={filters.sortBy}
                        onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                        className="px-2 sm:px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="relevance">Relevance</option>
                        <option value="date">Date</option>
                        <option value="rating">Rating</option>
                        <option value="budget">Budget</option>
                        <option value="popularity">Popular</option>
                      </select>

                      <button
                        onClick={() => handleFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <ArrowUpDown className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportResults}
                      className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Export</span>
                    </button>

                    <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 ${viewMode === 'grid' ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        <Grid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 ${viewMode === 'list' ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
                  <span className="text-gray-600">Searching...</span>
                </div>
              </div>
            )}

            {/* Results */}
            {!loading && (
              <>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
                    {paginatedResults.map(result => (
                      <Card key={result.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleResultClick(result)}>
                        <div className="aspect-video bg-gray-200 rounded-t-xl relative overflow-hidden">
                          {result.image ? (
                            <img src={result.image} alt={result.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                              {result.type === 'pitch' && <Film className="w-12 h-12 text-white" />}
                              {result.type === 'creator' && <User className="w-12 h-12 text-white" />}
                              {result.type === 'production' && <Award className="w-12 h-12 text-white" />}
                            </div>
                          )}
                          <div className="absolute top-2 left-2">
                            <Badge className="bg-black/60 text-white border-transparent backdrop-blur-sm">
                              {result.type}
                            </Badge>
                          </div>
                          {result.rating && (
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500 fill-current" />
                              <span className="text-sm font-medium text-white">{result.rating}</span>
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg mb-2 line-clamp-1">{result.title}</h3>
                          {result.author && (
                            <p className="text-sm text-purple-600 mb-1">by {result.author}</p>
                          )}
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{result.description}</p>

                          <div className="space-y-2">
                            {result.genre && (
                              <div className="flex flex-wrap gap-1">
                                {result.genre.slice(0, 2).map(genre => (
                                  <Badge key={genre} variant="outline" className="text-xs">
                                    {genre}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <div className="flex items-center gap-3">
                                {result.budget && (
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" />
                                    {formatBudget(result.budget)}
                                  </span>
                                )}
                                {result.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {result.location.split(',')[0]}
                                  </span>
                                )}
                              </div>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(result.createdAt)}
                              </span>
                            </div>

                            {/* Action buttons + stats */}
                            <div className="flex items-center justify-between pt-2 border-t">
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                {result.views != null && (
                                  <span className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    {result.views.toLocaleString()}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {result.type === 'pitch' && (
                                  <button
                                    onClick={(e) => handleLike(e, result)}
                                    className={`p-1.5 rounded-full hover:bg-red-50 transition ${likedIds.has(result.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                                    title={likedIds.has(result.id) ? 'Unlike' : 'Like'}
                                  >
                                    <Heart className={`w-4 h-4 ${likedIds.has(result.id) ? 'fill-current' : ''}`} />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => handleFollow(e, result)}
                                  className={`p-1.5 rounded-full hover:bg-purple-50 transition ${followedIds.has(result.id) ? 'text-purple-600' : 'text-gray-400 hover:text-purple-600'}`}
                                  title={followedIds.has(result.id) ? 'Unfollow' : 'Follow'}
                                >
                                  <Users className={`w-4 h-4 ${followedIds.has(result.id) ? 'fill-current' : ''}`} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4 mb-8">
                    {paginatedResults.map(result => (
                      <Card key={result.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleResultClick(result)}>
                        <CardContent className="p-4 sm:p-6">
                          <div className="flex gap-3 sm:gap-4">
                            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                              {result.image ? (
                                <img src={result.image} alt={result.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                  {result.type === 'pitch' && <Film className="w-6 h-6 sm:w-8 sm:h-8 text-white" />}
                                  {result.type === 'creator' && <User className="w-6 h-6 sm:w-8 sm:h-8 text-white" />}
                                  {result.type === 'production' && <Award className="w-6 h-6 sm:w-8 sm:h-8 text-white" />}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1 sm:mb-2">
                                <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                                  <h3 className="font-semibold text-base sm:text-lg truncate">{result.title}</h3>
                                  <Badge variant="secondary" className="text-xs flex-shrink-0">{result.type}</Badge>
                                  {result.rating && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 fill-current" />
                                      <span className="text-xs sm:text-sm font-medium">{result.rating}</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs sm:text-sm text-gray-500 flex-shrink-0 hidden sm:block">{formatDate(result.createdAt)}</span>
                              </div>

                              {result.author && (
                                <p className="text-xs sm:text-sm text-purple-600 mb-1">by {result.author}</p>
                              )}
                              <p className="text-gray-600 text-sm mb-2 sm:mb-3 line-clamp-1 sm:line-clamp-2">{result.description}</p>

                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 flex-wrap">
                                  {result.genre && (
                                    <div className="flex gap-1">
                                      {result.genre.slice(0, 2).map(genre => (
                                        <Badge key={genre} variant="outline" className="text-xs">
                                          {genre}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {result.budget && (
                                    <span className="flex items-center gap-1">
                                      <DollarSign className="w-3 h-3" />
                                      {formatBudget(result.budget)}
                                    </span>
                                  )}
                                  {result.location && (
                                    <span className="flex items-center gap-1 hidden sm:flex">
                                      <MapPin className="w-3 h-3" />
                                      {result.location.split(',')[0]}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 sm:gap-3">
                                  {result.views != null && (
                                    <span className="flex items-center gap-1 text-xs sm:text-sm text-gray-500">
                                      <Eye className="w-3 h-3" />
                                      {result.views.toLocaleString()}
                                    </span>
                                  )}
                                  {result.type === 'pitch' && (
                                    <button
                                      onClick={(e) => handleLike(e, result)}
                                      className={`p-1.5 rounded-full hover:bg-red-50 transition ${likedIds.has(result.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                                      title={likedIds.has(result.id) ? 'Unlike' : 'Like'}
                                    >
                                      <Heart className={`w-4 h-4 ${likedIds.has(result.id) ? 'fill-current' : ''}`} />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => handleFollow(e, result)}
                                    className={`p-1.5 rounded-full hover:bg-purple-50 transition ${followedIds.has(result.id) ? 'text-purple-600' : 'text-gray-400 hover:text-purple-600'}`}
                                    title={followedIds.has(result.id) ? 'Unfollow' : 'Follow'}
                                  >
                                    <Users className={`w-4 h-4 ${followedIds.has(result.id) ? 'fill-current' : ''}`} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-2 sm:px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                    >
                      <span className="hidden sm:inline">Previous</span>
                      <span className="sm:hidden">&lsaquo;</span>
                    </button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + Math.max(1, currentPage - 2);
                      if (page > totalPages) return null;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-2.5 sm:px-3 py-2 border rounded-lg text-sm ${
                            page === currentPage
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 sm:px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <span className="sm:hidden">&rsaquo;</span>
                    </button>
                  </div>
                )}

                {/* No Results */}
                {!loading && results.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                    <p className="text-gray-600 mb-4">
                      Try adjusting your search terms or filters to find what you're looking for.
                    </p>
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}