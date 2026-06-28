import React from 'react';
import { Eye, Heart, Shield, Star, MapPin, Calendar, Play, FileText, Image} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface SearchResult {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  shortSynopsis?: string;
  titleImage?: string;
  budgetBracket?: string;
  estimatedBudget?: string;
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  status: string;
  createdAt: Date;
  publishedAt?: Date;
  relevanceScore?: number;
  hasNDA?: boolean;
  ndaType?: string;
  isFollowing?: boolean;
  hasLookbook: boolean;
  hasScript: boolean;
  hasTrailer: boolean;
  hasPitchDeck: boolean;
  creator: {
    id: number;
    username: string;
    userType: string;
    companyName?: string;
    companyVerified: boolean;
    location?: string;
  };
}

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  error?: string;
  query?: string;
  searchHistoryId?: number;
  onResultClick?: (result: SearchResult, position: number) => void;
  className?: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  loading,
  error,
  query,
  searchHistoryId,
  onResultClick,
  className = ""
}) => {
  const handleResultClick = async (result: SearchResult, position: number) => {
    // Track click
    if (query && searchHistoryId) {
      try {
        await apiClient.post('/api/search/track-click', {
          pitchId: result.id,
          resultPosition: position + 1,
          query,
          searchHistoryId,
          sessionId: sessionStorage.getItem('sessionId') || undefined,
        });
      } catch (error) {
        console.error('Failed to track search click:', error);
      }
    }

    // Call external handler
    onResultClick?.(result, position);
  };

  const formatBudget = (budget?: string) => {
    if (!budget) return 'N/A';
    const num = parseFloat(budget);
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    return `$${num.toLocaleString()}`;
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getMediaIcons = (result: SearchResult) => {
    const icons = [];
    if (result.hasTrailer) icons.push({ icon: Play, label: 'Trailer' });
    if (result.hasScript) icons.push({ icon: FileText, label: 'Script' });
    if (result.hasLookbook) icons.push({ icon: Image, label: 'Lookbook' });
    if (result.hasPitchDeck) icons.push({ icon: FileText, label: 'Pitch Deck' });
    return icons;
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
            <div className="flex gap-4">
              <div className="w-24 h-16 bg-gray-200 rounded"></div>
              <div className="flex-1">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 text-center ${className}`}>
        <div className="text-red-600 font-medium mb-2">Search Error</div>
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-12 text-center ${className}`}>
        <div className="text-gray-600 font-medium mb-2">No results found</div>
        <div className="text-gray-500 text-sm">
          {query ? `No pitches match your search for "${query}"` : 'Try adjusting your filters'}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {results.map((result, index) => (
        <div
          key={result.id}
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => handleResultClick(result, index)}
        >
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            {/* Thumbnail */}
            <div className="w-24 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
              {result.titleImage ? (
                <img
                  src={result.titleImage}
                  alt={result.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Play className="h-6 w-6" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Title and Creator */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {result.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>{result.creator.username}</span>
                    {result.creator.companyVerified && (
                      <Star className="h-3 w-3 text-blue-500" fill="currentColor" />
                    )}
                    <span>•</span>
                    <span className="capitalize">{result.creator.userType}</span>
                    {result.creator.location && (
                      <>
                        <span>•</span>
                        <MapPin className="h-3 w-3" />
                        <span>{result.creator.location}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Relevance Score */}
                {result.relevanceScore && (
                  <div className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded">
                    {Math.round(result.relevanceScore)}% match
                  </div>
                )}
              </div>

              {/* Genre and Format */}
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                  {result.genre.charAt(0).toUpperCase() + result.genre.slice(1)}
                </span>
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                  {result.format.charAt(0).toUpperCase() + result.format.slice(1)}
                </span>
                {result.estimatedBudget && (
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">
                    {formatBudget(result.estimatedBudget)}
                  </span>
                )}
              </div>

              {/* Logline */}
              <p className="text-gray-700 text-sm leading-relaxed mb-3">
                {result.logline}
              </p>

              {/* Synopsis */}
              {result.shortSynopsis && (
                <p className="text-gray-600 text-sm leading-relaxed mb-3 line-clamp-2">
                  {result.shortSynopsis}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{result.viewCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span>{result.likeCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                <span>{result.ndaCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(result.publishedAt || result.createdAt)}</span>
              </div>
            </div>

            {/* Media Icons */}
            <div className="flex items-center gap-2">
              {getMediaIcons(result).map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="text-gray-400 hover:text-gray-600"
                  title={label}
                >
                  <Icon className="h-4 w-4" />
                </div>
              ))}
            </div>

            {/* User Status */}
            <div className="flex items-center gap-2">
              {result.hasNDA && (
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">
                  NDA Signed
                </span>
              )}
              {result.isFollowing && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                  Following
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};