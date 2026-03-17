import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Filter, Film, Users, Briefcase, DollarSign,
  Calendar, TrendingUp, Star, Clock, ChevronDown,
  Grid, List, SortAsc, SortDesc, WifiOff
} from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { apiClient } from '../lib/api-client';

interface SearchResult {
  id: string;
  type: 'pitch' | 'creator' | 'company';
  title: string;
  subtitle?: string;
  description: string;
  genre?: string;
  budget?: number;
  rating?: number;
  date: string;
  tags: string[];
  image?: string;
  stats?: {
    views?: number;
    likes?: number;
    projects?: number;
    followers?: number;
  };
}

const searchFilters = {
  type: ['all', 'pitches', 'creators', 'companies'],
  genre: ['All Genres', 'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller', 'Documentary'],
  budget: ['Any Budget', 'Under $1M', '$1M-$5M', '$5M-$10M', 'Over $10M'],
  timeframe: ['All Time', 'Last Week', 'Last Month', 'Last 3 Months', 'Last Year']
};

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useBetterAuthStore();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [selectedType, setSelectedType] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('All Genres');
  const [selectedBudget, setSelectedBudget] = useState('Any Budget');
  const [selectedTimeframe, setSelectedTimeframe] = useState('All Time');
  const [sortBy, setSortBy] = useState('relevance');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (searchQuery) {
      performSearch();
    }
  }, [searchQuery, selectedType, selectedGenre, selectedBudget, selectedTimeframe, sortBy]);

  const performSearch = async () => {
    if (!isOnline) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('q', searchQuery);
      if (selectedType !== 'all') params.append('type', selectedType);
      if (selectedGenre !== 'All Genres') params.append('genre', selectedGenre);
      if (selectedBudget !== 'Any Budget') params.append('budget', selectedBudget);
      if (selectedTimeframe !== 'All Time') params.append('timeframe', selectedTimeframe);
      if (sortBy) params.append('sort', sortBy);

      const response = await apiClient.get<{
        pitches?: Array<{ id: number; title: string; logline?: string; genre?: string; budget?: string; created_at?: string; view_count?: number; like_count?: number }>;
        users?: Array<{ id: number; name?: string; username?: string; user_type?: string; bio?: string; created_at?: string }>;
        companies?: Array<{ id: number; name?: string; company_name?: string; description?: string; created_at?: string }>;
      }>(`/api/search?${params}`);

      const mapped: SearchResult[] = [];

      if (response.success && response.data) {
        const data = response.data as any;
        for (const p of (data.pitches || [])) {
          mapped.push({
            id: String(p.id),
            type: 'pitch',
            title: p.title || 'Untitled',
            subtitle: p.genre || '',
            description: p.logline || '',
            genre: p.genre || '',
            budget: typeof p.budget === 'string' ? parseInt(p.budget.replace(/[^\d]/g, '')) || 0 : (p.budget || 0),
            date: p.created_at || '',
            tags: p.genre ? [p.genre] : [],
            stats: { views: p.view_count || 0, likes: p.like_count || 0 }
          });
        }
        for (const u of (data.users || [])) {
          mapped.push({
            id: String(u.id),
            type: 'creator',
            title: u.name || u.username || 'Unknown',
            subtitle: u.user_type || '',
            description: u.bio || '',
            date: u.created_at || '',
            tags: u.user_type ? [u.user_type] : []
          });
        }
        for (const c of (data.companies || [])) {
          mapped.push({
            id: String(c.id),
            type: 'company',
            title: c.name || c.company_name || 'Unknown',
            description: c.description || '',
            date: c.created_at || '',
            tags: ['Production']
          });
        }
      }
      setResults(mapped);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ q: searchQuery });
    performSearch();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pitch': return Film;
      case 'creator': return Users;
      case 'company': return Briefcase;
      default: return Film;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pitch': return 'bg-purple-100 text-purple-800';
      case 'creator': return 'bg-blue-100 text-blue-800';
      case 'company': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Offline banner */}
        {!isOnline && (
          <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">You are offline</p>
              <p className="text-xs text-yellow-600">Search requires an internet connection. Please check your connection.</p>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for pitches, creators, or companies..."
                className="w-full pl-12 pr-32 py-4 text-lg border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Search
              </button>
            </div>
          </form>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            
            {searchFilters.type.map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedType === type
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}

            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {searchFilters.genre.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget Range</label>
                <select
                  value={selectedBudget}
                  onChange={(e) => setSelectedBudget(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {searchFilters.budget.map(budget => (
                    <option key={budget} value={budget}>{budget}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
                <select
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {searchFilters.timeframe.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="relevance">Relevance</option>
                  <option value="date">Date</option>
                  <option value="popularity">Popularity</option>
                  <option value="rating">Rating</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        {results.length > 0 && !loading && (
          <div className="mb-4 text-gray-600">
            Found <span className="font-semibold text-gray-900">{results.length}</span> results 
            {searchQuery && ` for "${searchQuery}"`}
          </div>
        )}

        {/* Search Results */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {results.map((result) => {
              const Icon = getTypeIcon(result.type);
              
              return viewMode === 'grid' ? (
                <div key={result.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(result.type)}`}>
                        {result.type}
                      </span>
                      {result.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">{result.rating}</span>
                        </div>
                      )}
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-1">{result.title}</h3>
                    {result.subtitle && (
                      <p className="text-sm text-purple-600 mb-2">{result.subtitle}</p>
                    )}
                    <p className="text-gray-600 mb-4 line-clamp-3">{result.description}</p>

                    {result.stats && (
                      <div className="flex flex-wrap gap-3 mb-4 text-sm text-gray-500">
                        {result.stats.views && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            {result.stats.views} views
                          </span>
                        )}
                        {result.stats.projects && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-4 h-4" />
                            {result.stats.projects} projects
                          </span>
                        )}
                        {result.stats.followers && (
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {result.stats.followers} followers
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-4">
                      {result.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                      View Details
                    </button>
                  </div>
                </div>
              ) : (
                <div key={result.id} className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition">
                  <div className="flex gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{result.title}</h3>
                          {result.subtitle && (
                            <p className="text-sm text-purple-600">{result.subtitle}</p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(result.type)}`}>
                          {result.type}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 mb-3">{result.description}</p>
                      
                      <div className="flex flex-wrap gap-4 items-center">
                        {result.stats && Object.entries(result.stats).map(([key, value]) => (
                          <span key={key} className="text-sm text-gray-500">
                            <span className="font-medium text-gray-700">{value}</span> {key}
                          </span>
                        ))}
                        
                        <div className="flex gap-2 ml-auto">
                          {result.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {results.length === 0 && !loading && searchQuery && (
          <div className="text-center py-12 bg-white rounded-lg">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No results found for "{searchQuery}"</p>
            <p className="text-sm text-gray-400 mt-2">Try adjusting your filters or search terms</p>
          </div>
        )}
      </div>
    </div>
  );
}