import React, { useState, useEffect } from 'react';
import {
  Star, Search, Calendar,
  MoreVertical, Eye, MessageSquare,
  Bookmark, BookmarkCheck, Film,
  AlertCircle, RefreshCw, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Skeleton } from '@shared/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { SavedPitchesService, type SavedPitch as ApiSavedPitch } from '../../services/saved-pitches.service';

// Loading skeleton for pitch cards
function PitchCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-48 w-full" />
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex items-center justify-between text-sm mb-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24 rounded-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SavedPitch {
  id: number;
  title: string;
  creator: string;
  genre: string;
  format: string;
  savedDate: string;
  pitchDate: string;
  status: string;
  thumbnail: string;
  views: number;
  rating: number;
  hasNDA: boolean;
  notes?: string;
}

export default function ProductionSaved() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGenre, setFilterGenre] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [savedPitches, setSavedPitches] = useState<SavedPitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSavedPitches();
  }, [filterGenre, sortBy]);

  const fetchSavedPitches = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch from real API
      const response = await SavedPitchesService.getSavedPitches({
        genre: filterGenre !== 'all' ? filterGenre : undefined,
        limit: 50
      });

      // Transform API response to component's SavedPitch interface
      const transformedPitches: SavedPitch[] = (response.savedPitches ?? []).map((sp: ApiSavedPitch) => {
        // Support both nested (sp.pitch.*) and flat (sp.*) response shapes
        const raw = sp as unknown as Record<string, unknown>;
        const title = (raw.title as string) || sp.pitch?.title || 'Untitled Pitch';
        const genre = (raw.genre as string) || sp.pitch?.genre || 'Unknown';
        const format = (raw.format as string) || sp.pitch?.budgetBracket || 'Feature Film';
        const status = (raw.status as string) || sp.pitch?.status || 'Under Review';
        const titleImage = (raw.title_image as string) || sp.pitch?.titleImage || '';
        const viewCount = Number(raw.view_count ?? 0);
        const likeCount = Number(raw.like_count ?? 0);
        const creator = (raw.creator_username as string) || (raw.creator_email as string) || sp.pitch?.creator?.username || sp.pitch?.creator?.name || 'Unknown Creator';
        const savedAt = (raw.saved_at as string) || sp.savedAt;
        const pitchId = Number(raw.pitch_id ?? sp.pitchId);

        return {
          id: pitchId,
          title,
          creator,
          genre,
          format,
          savedDate: savedAt,
          pitchDate: savedAt,
          status,
          thumbnail: titleImage || '',
          views: viewCount,
          rating: likeCount > 0 ? Math.min(5, Math.round((likeCount / Math.max(viewCount, 1)) * 50) / 10) : 0,
          hasNDA: false,
          notes: sp.notes
        };
      });

      // Apply sorting
      if (sortBy === 'recent') {
        transformedPitches.sort((a, b) => new Date(b.savedDate).getTime() - new Date(a.savedDate).getTime());
      } else if (sortBy === 'newest') {
        transformedPitches.sort((a, b) => new Date(b.pitchDate).getTime() - new Date(a.pitchDate).getTime());
      }

      setSavedPitches(transformedPitches);
    } catch (err) {
      console.error('Error fetching saved pitches:', err);
      setError(err instanceof Error ? err.message : 'Failed to load saved pitches');
      setSavedPitches([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredPitches = savedPitches.filter(pitch => {
    const matchesSearch = pitch.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pitch.creator.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = filterGenre === 'all' || pitch.genre === filterGenre;
    return matchesSearch && matchesGenre;
  });

  const handleRemoveSaved = async (pitchId: number) => {
    try {
      // Find the saved pitch entry to get its ID
      const savedPitch = savedPitches.find(p => p.id === pitchId);
      if (savedPitch) {
        await SavedPitchesService.unsavePitch(pitchId);
        setSavedPitches(prev => prev.filter(p => p.id !== pitchId));
      }
    } catch (err) {
      console.error('Error removing saved pitch:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove saved pitch');
    }
  };

  return (
    <div>
            
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Saved Pitches</h1>
            <p className="text-gray-600 mt-1">Your bookmarked pitches for future consideration</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {filteredPitches.length} saved pitches
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Error loading saved pitches</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSavedPitches}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search saved pitches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <select
            value={filterGenre}
            onChange={(e) => setFilterGenre(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            <option value="all">All Genres</option>
            <option value="Action">Action</option>
            <option value="Comedy">Comedy</option>
            <option value="Drama">Drama</option>
            <option value="Horror">Horror</option>
            <option value="Sci-Fi">Sci-Fi</option>
            <option value="Thriller">Thriller</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            <option value="recent">Recently Saved</option>
            <option value="rating">Highest Rated</option>
            <option value="views">Most Viewed</option>
            <option value="newest">Newest Pitches</option>
          </select>
        </div>

        {/* Saved Pitches Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <PitchCardSkeleton />
            <PitchCardSkeleton />
            <PitchCardSkeleton />
            <PitchCardSkeleton />
            <PitchCardSkeleton />
            <PitchCardSkeleton />
          </div>
        ) : filteredPitches.length === 0 ? (
          <Card className="p-12 text-center">
            <Bookmark className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No saved pitches</h3>
            <p className="text-gray-600 mb-6">Start browsing and save pitches you're interested in</p>
            <Button 
              onClick={() => navigate('/marketplace')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Browse Pitches
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPitches.map((pitch) => (
              <Card key={pitch.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                <div
                  className="relative h-48 bg-cover bg-center bg-gradient-to-br from-purple-600 to-blue-500"
                  style={pitch.thumbnail ? { backgroundImage: `url(${pitch.thumbnail})` } : undefined}
                  onClick={() => navigate(`/production/pitch/${pitch.id}`)}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute top-3 right-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="bg-white/90 hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSaved(pitch.id);
                      }}
                    >
                      <BookmarkCheck className="w-4 h-4 text-purple-600" />
                    </Button>
                  </div>
                  {pitch.hasNDA && (
                    <div className="absolute top-3 left-3 bg-purple-600 text-white px-2 py-1 rounded text-xs">
                      NDA Protected
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-white font-bold text-lg mb-1">{pitch.title}</h3>
                    <p className="text-white/90 text-sm">by {pitch.creator}</p>
                  </div>
                </div>

                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs mr-2">
                        {pitch.genre}
                      </span>
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {pitch.format}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-semibold">{pitch.rating}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {pitch.views.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Saved {new Date(pitch.savedDate).toLocaleDateString()}
                    </span>
                  </div>

                  {pitch.notes && (
                    <div className="p-2 bg-yellow-50 rounded text-sm text-gray-700 mb-3">
                      <span className="font-medium">Note:</span> {pitch.notes}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      pitch.status === 'Shortlisted' 
                        ? 'bg-green-100 text-green-700'
                        : pitch.status === 'Under Review'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {pitch.status}
                    </span>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/messages?pitch=${pitch.id}`);
                        }}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle more options
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Categories Section — computed from actual saved data */}
        {savedPitches.length > 0 && (() => {
          const categoryCounts: Record<string, number> = {};
          savedPitches.forEach(p => {
            const fmt = p.format || 'Other';
            categoryCounts[fmt] = (categoryCounts[fmt] || 0) + 1;
          });
          const categoryColors = ['bg-purple-50 text-purple-600', 'bg-blue-50 text-blue-600', 'bg-green-50 text-green-600', 'bg-orange-50 text-orange-600', 'bg-pink-50 text-pink-600', 'bg-teal-50 text-teal-600'];
          const entries = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
          return (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="w-5 h-5" />
                  Saved by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {entries.map(([category, count], i) => {
                    const color = categoryColors[i % categoryColors.length];
                    return (
                      <div key={category} className={`text-center p-4 rounded-lg ${color.split(' ')[0]}`}>
                        <div className={`text-2xl font-bold ${color.split(' ')[1]}`}>{count}</div>
                        <div className="text-sm text-gray-600">{category}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </main>
    </div>
  );
}