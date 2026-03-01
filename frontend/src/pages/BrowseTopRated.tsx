import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pitchService } from '../services/pitch.service';
import type { Pitch } from '../services/pitch.service';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { PitchCardSkeleton } from '@shared/components/feedback/Skeleton';
import EmptyState from '../components/EmptyState';
import { useToast } from '@shared/components/feedback/ToastProvider';
import Pagination from '../components/Pagination';
import { configService } from '../services/config.service';
import FormatDisplay from '../components/FormatDisplay';
import { getApiUrl } from '../config';
import { 
  Eye, 
  Heart, 
  Clock, 
  User,
  LogIn,
  UserPlus,
  Film,
  Building2,
  Wallet,
  DollarSign,
  Shield,
  Calendar,
  TrendingUp,
  Filter,
  Grid,
  Star,
  ArrowLeft,
  Trophy,
  Award,
  Target,
  ChevronDown
} from 'lucide-react';

type SortBy = 'rating' | 'views' | 'recent' | 'likes';
type TimeFilter = 'all' | 'week' | 'month' | 'year';

interface RatingStats {
  totalRated: number;
  averageRating: number;
  ratingDistribution: {
    [key: number]: number;
  };
}

export default function BrowseTopRated() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useBetterAuthStore();
  const toast = useToast();
  const userType = localStorage.getItem('userType');
  
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const itemsPerPage = 24;
  
  // Filter state
  const [sortBy, setSortBy] = useState<SortBy>('rating');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [minRating, setMinRating] = useState<number>(0);
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);

  // AbortController for cancelling stale top-rated pitch requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configData = await configService.getConfiguration();
        setConfig(configData);
      } catch (error) {
        console.error('Failed to load configuration:', error);
      }
    };
    loadConfig();
  }, []);

  // Fetch rating statistics
  const fetchRatingStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`${getApiUrl()}/api/browse/top-rated/stats`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRatingStats(data.stats);
      } else {
        // Fallback: Generate stats from public pitches
        const { pitches: allPitches } = await pitchService.getPublicPitches();
        const ratedPitches = allPitches?.filter(p => p.rating && p.rating > 0) || [];
        
        if (ratedPitches.length > 0) {
          const totalRating = ratedPitches.reduce((sum, p) => sum + (p.rating || 0), 0);
          const distribution: { [key: number]: number } = {};
          
          ratedPitches.forEach(pitch => {
            const rating = Math.floor(pitch.rating || 0);
            distribution[rating] = (distribution[rating] || 0) + 1;
          });
          
          setRatingStats({
            totalRated: ratedPitches.length,
            averageRating: totalRating / ratedPitches.length,
            ratingDistribution: distribution
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch rating stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch top rated pitches
  const fetchTopRatedPitches = useCallback(async () => {
    // Abort any in-flight request to prevent stale data
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      const params = new URLSearchParams({
        sort: sortBy === 'rating' ? 'rating' :
              sortBy === 'views' ? 'views' :
              sortBy === 'recent' ? 'date' : 'likes',
        order: 'desc',
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString()
      });

      if (minRating > 0) {
        params.set('minRating', minRating.toString());
      }

      if (timeFilter !== 'all') {
        params.set('timeFilter', timeFilter);
      }

      const response = await fetch(`${getApiUrl()}/api/browse/top-rated?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        signal: controller.signal
      });

      if (response.ok) {
        const data = await response.json();
        const resultPitches = data.items || data.data || [];

        setPitches(resultPitches);
        setTotalPages(data.totalPages || Math.ceil(resultPitches.length / itemsPerPage));
        setTotalResults(data.total || resultPitches.length);
      } else {
        // Fallback to client-side sorting
        const { pitches: allPitches } = await pitchService.getPublicPitches();
        if (controller.signal.aborted) return;

        let filtered = allPitches?.filter(p => (p.rating || 0) >= minRating) || [];

        // Apply time filter
        if (timeFilter !== 'all') {
          const now = new Date();
          const cutoffDate = new Date();

          switch (timeFilter) {
            case 'week':
              cutoffDate.setDate(now.getDate() - 7);
              break;
            case 'month':
              cutoffDate.setMonth(now.getMonth() - 1);
              break;
            case 'year':
              cutoffDate.setFullYear(now.getFullYear() - 1);
              break;
          }

          filtered = filtered.filter(p => new Date(p.createdAt) >= cutoffDate);
        }

        // Sort
        filtered.sort((a, b) => {
          switch (sortBy) {
            case 'rating':
              return (b.rating || 0) - (a.rating || 0);
            case 'views':
              return (b.viewCount || 0) - (a.viewCount || 0);
            case 'recent':
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            case 'likes':
              return (b.likeCount || 0) - (a.likeCount || 0);
            default:
              return 0;
          }
        });

        // Paginate client-side
        const start = (currentPage - 1) * itemsPerPage;
        const paginatedPitches = filtered.slice(start, start + itemsPerPage);

        setPitches(paginatedPitches);
        setTotalPages(Math.ceil(filtered.length / itemsPerPage));
        setTotalResults(filtered.length);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to fetch top rated pitches:', error);
      toast.error('Failed to load top rated pitches');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [sortBy, timeFilter, minRating, currentPage, toast]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchRatingStats();
  }, [fetchRatingStats]);

  useEffect(() => {
    fetchTopRatedPitches();
  }, [fetchTopRatedPitches]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, timeFilter, minRating]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatBudget = (budget: any) => {
    if (!budget) return 'TBD';
    const value = typeof budget === 'string' ? parseInt(budget.replace(/[^\d]/g, '')) : budget;
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStageColor = (stage?: string) => {
    switch (stage?.toLowerCase()) {
      case 'concept': return 'bg-blue-100 text-blue-800';
      case 'script development': return 'bg-purple-100 text-purple-800';
      case 'pre-production': return 'bg-yellow-100 text-yellow-800';
      case 'financing': return 'bg-orange-100 text-orange-800';
      case 'production': return 'bg-green-100 text-green-800';
      case 'post-production': return 'bg-indigo-100 text-indigo-800';
      case 'distribution': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const renderRatingStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-4 h-4 ${
            i <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
          }`}
        />
      );
    }
    return stars;
  };

  const getSortLabel = (sort: SortBy) => {
    switch (sort) {
      case 'rating': return 'Highest Rated';
      case 'views': return 'Most Viewed';
      case 'recent': return 'Recently Added';
      case 'likes': return 'Most Liked';
      default: return 'Highest Rated';
    }
  };

  const getTimeFilterLabel = (time: TimeFilter) => {
    switch (time) {
      case 'all': return 'All Time';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'year': return 'This Year';
      default: return 'All Time';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b" data-testid="top-rated-navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <a href="/" className="text-2xl font-bold text-purple-600">
                Pitchey
              </a>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <button
                  onClick={() => navigate('/marketplace')}
                  className="hover:text-purple-600 transition-colors"
                >
                  Browse
                </button>
                <span>/</span>
                <span className="font-medium text-gray-900">Top Rated</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated && user ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg border border-gray-200">
                    {userType === 'production' && (
                      <>
                        <Building2 className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">Production</span>
                      </>
                    )}
                    {userType === 'investor' && (
                      <>
                        <Wallet className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-700">Investor</span>
                      </>
                    )}
                    {userType === 'creator' && (
                      <>
                        <User className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">Creator</span>
                      </>
                    )}
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-sm text-gray-700">{user.companyName || user.username}</span>
                  </div>
                  
                  <button
                    onClick={() => navigate(`/${userType}/dashboard`)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
                  >
                    Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/portals')}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-purple-600 font-medium"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </button>
                  <button
                    onClick={() => navigate('/portals')}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Join Pitchey</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Page Header */}
      <div className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/marketplace')}
              className="flex items-center gap-2 text-yellow-100 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Browse</span>
            </button>
          </div>
          
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-10 h-10 text-yellow-200" />
            <div>
              <h1 className="text-4xl font-bold mb-2">Top Rated Pitches</h1>
              <p className="text-lg text-orange-100">
                Discover the highest-rated movie pitches on the platform
              </p>
            </div>
          </div>

          {/* Rating Stats */}
          {!statsLoading && ratingStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-yellow-200" />
                  <span className="font-semibold">Average Rating</span>
                </div>
                <div className="text-2xl font-bold">
                  {ratingStats.averageRating.toFixed(1)}/5.0
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-yellow-200" />
                  <span className="font-semibold">Rated Pitches</span>
                </div>
                <div className="text-2xl font-bold">
                  {ratingStats.totalRated.toLocaleString()}
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-yellow-200" />
                  <span className="font-semibold">5-Star Pitches</span>
                </div>
                <div className="text-2xl font-bold">
                  {ratingStats.ratingDistribution[5] || 0}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="p-4 border-b">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Filters & Sorting</span>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-gray-600 transition-transform ${
                  showFilters ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
          
          {showFilters && (
            <div className="p-4 space-y-6">
              {/* Sort Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort by
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['rating', 'views', 'recent', 'likes'] as SortBy[]).map((sort) => (
                    <button
                      key={sort}
                      onClick={() => setSortBy(sort)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        sortBy === sort
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {getSortLabel(sort)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time period
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['all', 'week', 'month', 'year'] as TimeFilter[]).map((time) => (
                    <button
                      key={time}
                      onClick={() => setTimeFilter(time)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        timeFilter === time
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {getTimeFilterLabel(time)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minimum Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum rating: {minRating > 0 ? `${minRating}+ stars` : 'Any rating'}
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={minRating}
                  onChange={(e) => setMinRating(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Any</span>
                  <span>1+</span>
                  <span>2+</span>
                  <span>3+</span>
                  <span>4+</span>
                  <span>5 only</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {getSortLabel(sortBy)} Pitches
            </h2>
            <p className="text-gray-600 mt-1">
              {totalResults} {totalResults === 1 ? 'pitch' : 'pitches'} found
              {minRating > 0 && ` with ${minRating}+ stars`}
              {timeFilter !== 'all' && ` from ${getTimeFilterLabel(timeFilter).toLowerCase()}`}
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="w-4 h-4" />
            <span>Updated in real-time</span>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <PitchCardSkeleton key={i} />
            ))}
          </div>
        ) : pitches.length === 0 ? (
          <EmptyState
            title="No top rated pitches found"
            description="Try adjusting your filters or check back later for more rated pitches"
            icon={Trophy}
            action={{
              label: "Reset Filters",
              onClick: () => {
                setSortBy('rating');
                setTimeFilter('all');
                setMinRating(0);
              }
            }}
          />
        ) : (
          <>
            {/* Pitch Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="top-rated-pitch-grid">
              {pitches.map((pitch, index) => (
                <div
                  key={pitch.id}
                  className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group relative"
                  onClick={() => navigate(`/pitch/${pitch.id}`)}
                  data-testid={`top-rated-pitch-card-${pitch.id}`}
                >
                  {/* Ranking Badge */}
                  {index < 3 && (
                    <div className="absolute top-2 left-2 z-10">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                        index === 1 ? 'bg-gray-300 text-gray-800' :
                        'bg-orange-300 text-orange-900'
                      }`}>
                        <Trophy className="w-3 h-3" />
                        #{index + 1}
                      </div>
                    </div>
                  )}

                  {/* Pitch Thumbnail */}
                  <div className="aspect-video bg-gradient-to-br from-purple-400 to-indigo-600 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="w-12 h-12 text-white opacity-50 group-hover:scale-110 transition-transform" />
                    </div>
                    
                    {/* Rating Badge */}
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center gap-1 px-2 py-1 bg-black/70 text-white text-xs rounded-full">
                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                        <span className="font-bold">{(pitch.rating || 0).toFixed(1)}</span>
                      </div>
                    </div>
                    
                    {/* Additional Badges */}
                    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                      {pitch.productionStage && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageColor(pitch.productionStage)}`}>
                          {pitch.productionStage}
                        </span>
                      )}
                      {pitch.hasNDA && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          <Shield className="w-3 h-3 inline mr-1" />
                          NDA
                        </span>
                      )}
                    </div>
                    
                    {/* Stats Overlay */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                      <span className="flex items-center gap-1 px-2 py-1 bg-black/50 text-white text-xs rounded-full">
                        <Eye className="w-3 h-3" />
                        {formatNumber(pitch.viewCount || 0)}
                      </span>
                      <span className="flex items-center gap-1 px-2 py-1 bg-black/50 text-white text-xs rounded-full">
                        <Heart className="w-3 h-3" />
                        {pitch.likeCount || 0}
                      </span>
                    </div>
                  </div>
                  
                  {/* Pitch Content */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-purple-600 transition-colors flex-1">
                        {pitch.title}
                      </h3>
                    </div>
                    
                    {/* Rating Stars */}
                    <div className="flex items-center gap-1 mb-2">
                      {renderRatingStars(Math.round(pitch.rating || 0))}
                      <span className="text-sm text-gray-600 ml-1">
                        ({(pitch as any).reviewCount || pitch.viewCount || 0} reviews)
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {pitch.logline}
                    </p>
                    
                    {/* Meta Info */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Film className="w-3 h-3" />
                          {pitch.genre}
                        </span>
                        <FormatDisplay
                          formatCategory={pitch.formatCategory}
                          formatSubtype={pitch.formatSubtype}
                          format={pitch.format}
                          variant="compact"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatBudget(pitch.estimatedBudget || pitch.budget)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(pitch.createdAt)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-xs text-gray-600 pt-2 border-t">
                        {pitch.creator?.userType === 'production' ? (
                          <>
                            <Building2 className="w-3 h-3 text-purple-600" />
                            <span className="font-medium">{pitch.creator?.companyName || pitch.creator?.username}</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-blue-600" />
                            <span className="font-medium">@{pitch.creator?.username || 'unknown'}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}