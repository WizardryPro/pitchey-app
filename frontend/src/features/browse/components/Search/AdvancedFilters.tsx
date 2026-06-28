import React, { useState } from 'react';
import { Filter, ChevronDown, ChevronUp, Calendar, DollarSign, Users, Shield } from 'lucide-react';

interface SearchFilters {
  query?: string;
  genres?: string[];
  formats?: string[];
  budgetMin?: number;
  budgetMax?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: string[];
  hasNDA?: boolean;
  isFollowing?: boolean;
  hasMedia?: string[];
  viewCountMin?: number;
  viewCountMax?: number;
  likeCountMin?: number;
  likeCountMax?: number;
  ndaCountMin?: number;
  ndaCountMax?: number;
  creatorType?: 'creator' | 'production' | 'any';
  verifiedOnly?: boolean;
  location?: string;
  fundingProgress?: {
    min?: number;
    max?: number;
  };
  ndaRequirement?: 'none' | 'basic' | 'enhanced' | 'any';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface AdvancedFiltersProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onReset: () => void;
  availableOptions?: {
    genres: string[];
    formats: string[];
    mediaTypes: string[];
    budgetRanges: Array<{ label: string; min: number; max: number | null }>;
    creatorTypes: Array<{ value: string; label: string }>;
    sortOptions: Array<{ value: string; label: string }>;
  };
  className?: string;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onChange,
  onReset,
  availableOptions,
  className = ""
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const updateFilter = (key: keyof SearchFilters, value: SearchFilters[typeof key]) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: keyof SearchFilters, value: string) => {
    const currentArray = filters[key] as string[] || [];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFilter(key, newArray.length > 0 ? newArray : undefined);
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'query' || key === 'page' || key === 'limit' || key === 'sortBy' || key === 'sortOrder') return false;
    return value !== undefined && value !== null && 
           (Array.isArray(value) ? value.length > 0 : true);
  });

  const getActiveFilterCount = () => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'query' || key === 'page' || key === 'limit' || key === 'sortBy' || key === 'sortOrder') return false;
      return value !== undefined && value !== null && 
             (Array.isArray(value) ? value.length > 0 : true);
    }).length;
  };

  const defaultGenres = ['drama', 'comedy', 'thriller', 'horror', 'scifi', 'fantasy', 'documentary', 'animation', 'action', 'romance', 'other'];
  const defaultFormats = ['feature', 'tv', 'short', 'webseries', 'other'];
  const defaultMediaTypes = ['lookbook', 'script', 'trailer', 'pitch_deck'];

  const genres = availableOptions?.genres || defaultGenres;
  const formats = availableOptions?.formats || defaultFormats;
  const mediaTypes = availableOptions?.mediaTypes || defaultMediaTypes;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <span className="font-medium text-gray-900">Advanced Filters</span>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
              {getActiveFilterCount()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Basic Filters */}
          <div>
            <button
              onClick={() => toggleSection('basic')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900">Basic Filters</span>
              {expandedSections.has('basic') ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {expandedSections.has('basic') && (
              <div className="px-4 pb-4 space-y-4">
                {/* Genres */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Genres
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {genres.map(genre => (
                      <button
                        key={genre}
                        onClick={() => toggleArrayFilter('genres', genre)}
                        className={`
                          px-3 py-1 text-sm rounded-full border transition-colors
                          ${filters.genres?.includes(genre)
                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                            : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        {genre.charAt(0).toUpperCase() + genre.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Formats */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Format
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {formats.map(format => (
                      <button
                        key={format}
                        onClick={() => toggleArrayFilter('formats', format)}
                        className={`
                          px-3 py-1 text-sm rounded-full border transition-colors
                          ${filters.formats?.includes(format)
                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                            : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        {format.charAt(0).toUpperCase() + format.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Creator Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Creator Type
                  </label>
                  <select
                    value={filters.creatorType || 'any'}
                    onChange={(e) => updateFilter('creatorType', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="any">All Creators</option>
                    <option value="creator">Individual Creators</option>
                    <option value="production">Production Companies</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Budget & Metrics */}
          <div className="border-t border-gray-100">
            <button
              onClick={() => toggleSection('budget')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-900">Budget & Metrics</span>
              </div>
              {expandedSections.has('budget') ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {expandedSections.has('budget') && (
              <div className="px-4 pb-4 space-y-4">
                {/* Budget Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Min budget"
                      value={filters.budgetMin || ''}
                      onChange={(e) => updateFilter('budgetMin', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="number"
                      placeholder="Max budget"
                      value={filters.budgetMax || ''}
                      onChange={(e) => updateFilter('budgetMax', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* View Count Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    View Count Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Min views"
                      value={filters.viewCountMin || ''}
                      onChange={(e) => updateFilter('viewCountMin', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="number"
                      placeholder="Max views"
                      value={filters.viewCountMax || ''}
                      onChange={(e) => updateFilter('viewCountMax', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Like Count Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Like Count Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Min likes"
                      value={filters.likeCountMin || ''}
                      onChange={(e) => updateFilter('likeCountMin', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="number"
                      placeholder="Max likes"
                      value={filters.likeCountMax || ''}
                      onChange={(e) => updateFilter('likeCountMax', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Content & Media */}
          <div className="border-t border-gray-100">
            <button
              onClick={() => toggleSection('content')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-900">Content & Media</span>
              </div>
              {expandedSections.has('content') ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {expandedSections.has('content') && (
              <div className="px-4 pb-4 space-y-4">
                {/* Media Types */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Available Media
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {mediaTypes.map(mediaType => (
                      <button
                        key={mediaType}
                        onClick={() => toggleArrayFilter('hasMedia', mediaType)}
                        className={`
                          px-3 py-1 text-sm rounded-full border transition-colors
                          ${filters.hasMedia?.includes(mediaType)
                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                            : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        {mediaType.split('_').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['draft', 'published', 'hidden', 'archived'].map(status => (
                      <button
                        key={status}
                        onClick={() => toggleArrayFilter('status', status)}
                        className={`
                          px-3 py-1 text-sm rounded-full border transition-colors
                          ${filters.status?.includes(status)
                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                            : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Preferences */}
          <div className="border-t border-gray-100">
            <button
              onClick={() => toggleSection('preferences')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-900">User Preferences</span>
              </div>
              {expandedSections.has('preferences') ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {expandedSections.has('preferences') && (
              <div className="px-4 pb-4 space-y-4">
                {/* Verified Only */}
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.verifiedOnly || false}
                    onChange={(e) => updateFilter('verifiedOnly', e.target.checked || undefined)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Verified creators only</span>
                </label>

                {/* Has NDA */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NDA Status
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="hasNDA"
                        checked={filters.hasNDA === undefined}
                        onChange={() => updateFilter('hasNDA', undefined)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">All pitches</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="hasNDA"
                        checked={filters.hasNDA === true}
                        onChange={() => updateFilter('hasNDA', true)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">I have signed NDA</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="hasNDA"
                        checked={filters.hasNDA === false}
                        onChange={() => updateFilter('hasNDA', false)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">I haven't signed NDA</span>
                    </label>
                  </div>
                </div>

                {/* Following Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Following Status
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="isFollowing"
                        checked={filters.isFollowing === undefined}
                        onChange={() => updateFilter('isFollowing', undefined)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">All pitches</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="isFollowing"
                        checked={filters.isFollowing === true}
                        onChange={() => updateFilter('isFollowing', true)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Following only</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="isFollowing"
                        checked={filters.isFollowing === false}
                        onChange={() => updateFilter('isFollowing', false)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Not following</span>
                    </label>
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Creator Location
                  </label>
                  <input
                    type="text"
                    placeholder="Enter location..."
                    value={filters.location || ''}
                    onChange={(e) => updateFilter('location', e.target.value || undefined)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="border-t border-gray-100">
            <button
              onClick={() => toggleSection('date')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-900">Date Range</span>
              </div>
              {expandedSections.has('date') ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {expandedSections.has('date') && (
              <div className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={filters.dateFrom || ''}
                      onChange={(e) => updateFilter('dateFrom', e.target.value || undefined)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo || ''}
                      onChange={(e) => updateFilter('dateTo', e.target.value || undefined)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};