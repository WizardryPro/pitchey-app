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
  ArrowLeft
} from 'lucide-react';

interface GenreStats {
  genre: string;
  count: number;
  averageRating: number;
  totalViews: number;
  latestPitch?: {
    id: string;
    title: string;
    createdAt: string;
  };
}

export default function BrowseGenres() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useBetterAuthStore();
  const toast = useToast();
  const userType = localStorage.getItem('userType');
  
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [genreStats, setGenreStats] = useState<GenreStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const itemsPerPage = 24;

  // AbortController for cancelling stale genre pitch requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Get selected genre from URL params
  const selectedGenre = searchParams.get('genre') || '';
  
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

  // Fetch genre statistics
  const fetchGenreStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`${getApiUrl()}/api/browse/genres`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGenreStats(data.genres || []);
      } else {
        // Fallback: Generate stats from public pitches
        const { pitches: allPitches } = await pitchService.getPublicPitches();
        const genreMap = new Map<string, {
          count: number;
          totalViews: number;
          totalRating: number;
          latestPitch?: any;
        }>();
        
        allPitches?.forEach(pitch => {
          if (pitch.genre) {
            const current = genreMap.get(pitch.genre) || {
              count: 0,
              totalViews: 0,
              totalRating: 0
            };
            
            current.count += 1;
            current.totalViews += pitch.viewCount || 0;
            current.totalRating += pitch.rating || 0;
            
            if (!current.latestPitch || new Date(pitch.createdAt) > new Date(current.latestPitch.createdAt)) {
              current.latestPitch = {
                id: pitch.id,
                title: pitch.title,
                createdAt: pitch.createdAt
              };
            }
            
            genreMap.set(pitch.genre, current);
          }
        });
        
        const stats: GenreStats[] = Array.from(genreMap.entries()).map(([genre, data]) => ({
          genre,
          count: data.count,
          averageRating: data.count > 0 ? data.totalRating / data.count : 0,
          totalViews: data.totalViews,
          latestPitch: data.latestPitch
        }));
        
        setGenreStats(stats.sort((a, b) => b.count - a.count));
      }
    } catch (error) {
      console.error('Failed to fetch genre stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch pitches for selected genre
  const fetchGenrePitches = useCallback(async () => {
    if (!selectedGenre) return;

    // Abort any in-flight request to prevent stale data
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      const params = new URLSearchParams({
        genre: selectedGenre,
        sort: 'date',
        order: 'desc',
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString()
      });

      const response = await fetch(`${getApiUrl()}/api/pitches/browse/enhanced?${params.toString()}`, {
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
        // Fallback to client-side filtering
        const { pitches: allPitches } = await pitchService.getPublicPitches();
        if (controller.signal.aborted) return;

        const filtered = allPitches?.filter(p =>
          p.genre?.toLowerCase() === selectedGenre.toLowerCase()
        ) || [];

        const start = (currentPage - 1) * itemsPerPage;
        const paginatedPitches = filtered.slice(start, start + itemsPerPage);

        setPitches(paginatedPitches);
        setTotalPages(Math.ceil(filtered.length / itemsPerPage));
        setTotalResults(filtered.length);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to fetch genre pitches:', error);
      toast.error('Failed to load pitches for this genre');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [selectedGenre, currentPage, toast]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchGenreStats();
  }, [fetchGenreStats]);

  useEffect(() => {
    if (selectedGenre) {
      fetchGenrePitches();
    } else {
      setLoading(false);
      setPitches([]);
    }
  }, [fetchGenrePitches, selectedGenre]);

  // Reset page when genre changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGenre]);

  const handleGenreSelect = (genre: string) => {
    setSearchParams({ genre });
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b" data-testid="genres-navigation">
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
                <span className="font-medium text-gray-900">Genres</span>
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
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/marketplace')}
              className="flex items-center gap-2 text-purple-100 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Browse</span>
            </button>
          </div>
          <h1 className="text-4xl font-bold mb-2">Browse by Genres</h1>
          <p className="text-lg text-purple-100">
            Discover pitches across different movie genres and categories
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedGenre ? (
          <>
            {/* Genre Grid */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Choose a Genre</h2>
              
              {statsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
                      <div className="h-6 bg-gray-200 rounded mb-4"></div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : genreStats.length === 0 ? (
                <EmptyState
                  title="No genres available"
                  description="No pitches have been categorized yet"
                  icon={Film}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {genreStats.map((genre) => (
                    <div
                      key={genre.genre}
                      className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer group"
                      onClick={() => handleGenreSelect(genre.genre)}
                    >
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                            {genre.genre}
                          </h3>
                          <Film className="w-6 h-6 text-purple-600" />
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Pitches</span>
                            <span className="font-semibold text-gray-900">{genre.count}</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Total Views</span>
                            <span className="font-semibold text-gray-900">{formatNumber(genre.totalViews)}</span>
                          </div>
                          
                          {genre.averageRating > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Avg Rating</span>
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                <span className="font-semibold text-gray-900">{genre.averageRating.toFixed(1)}</span>
                              </div>
                            </div>
                          )}
                          
                          {genre.latestPitch && (
                            <div className="pt-3 border-t">
                              <p className="text-xs text-gray-500 mb-1">Latest pitch:</p>
                              <p className="text-sm font-medium text-gray-900 line-clamp-1">
                                {genre.latestPitch.title}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatDate(genre.latestPitch.createdAt)}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-4 pt-4 border-t">
                          <div className="text-center">
                            <span className="text-sm text-purple-600 font-medium group-hover:text-purple-700 transition-colors">
                              View All →
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Genre Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSearchParams({})}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>All Genres</span>
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedGenre} Pitches
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {totalResults} {totalResults === 1 ? 'pitch' : 'pitches'} found
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <TrendingUp className="w-4 h-4" />
                <span>Sorted by newest</span>
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
                title={`No ${selectedGenre} pitches found`}
                description="Try selecting a different genre or check back later"
                icon={Film}
                action={{
                  label: "Browse All Genres",
                  onClick: () => setSearchParams({})
                }}
              />
            ) : (
              <>
                {/* Pitch Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="genre-pitch-grid">
                  {pitches.map((pitch) => (
                    <div
                      key={pitch.id}
                      className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group"
                      onClick={() => navigate(`/pitch/${pitch.id}`)}
                      data-testid={`genre-pitch-card-${pitch.id}`}
                    >
                      {/* Pitch Thumbnail */}
                      <div className="aspect-video bg-gradient-to-br from-purple-400 to-indigo-600 relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Film className="w-12 h-12 text-white opacity-50 group-hover:scale-110 transition-transform" />
                        </div>
                        
                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
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
                            {pitch.viewCount || 0}
                          </span>
                          <span className="flex items-center gap-1 px-2 py-1 bg-black/50 text-white text-xs rounded-full">
                            <Heart className="w-3 h-3" />
                            {pitch.likeCount || 0}
                          </span>
                        </div>
                      </div>
                      
                      {/* Pitch Content */}
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-purple-600 transition-colors">
                          {pitch.title}
                        </h3>
                        
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
          </>
        )}
      </div>
    </div>
  );
}