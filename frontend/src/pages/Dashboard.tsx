import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { pitchAPI } from '../lib/api';
import type { Pitch } from '../lib/api';
import { useBetterAuthStore } from '../store/betterAuthStore';
import {
  Plus, TrendingUp, Eye, Heart, Shield, Search,
  Film, Tv, Video, FileText, Grid, List
} from 'lucide-react';
import { pitchUrl } from '@/utils/pitchUrl';

export default function Dashboard() {
  const { user } = useBetterAuthStore();
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [trending, setTrending] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState({
    genre: '',
    format: '',
  });

  useEffect(() => {
    void fetchPitches();
    void fetchTrending();
  }, [filter]);

  const fetchPitches = async () => {
    try {
      setLoading(true);
      const data = await pitchAPI.getAll({
        genre: filter.genre || undefined,
        format: filter.format || undefined,
        search: searchQuery || undefined,
      });
      setPitches(data);
    } catch (error) {
      console.error('Failed to fetch pitches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrending = async () => {
    try {
      const data = await pitchAPI.getTrending();
      setTrending(data.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch trending:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchPitches();
  };

  const formatIcon = (format: string) => {
    switch (format) {
      case 'feature': return <Film className="h-4 w-4" />;
      case 'tv': return <Tv className="h-4 w-4" />;
      case 'short': return <Video className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.username}!
            </h1>
            {user?.userType === 'creator' && (
              <Link to="/pitch/new" className="btn-primary">
                <Plus className="h-5 w-5 mr-2" />
                New Pitch
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Search */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pitches..."
                  className="input-field pl-10"
                />
              </div>
            </form>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Filters</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Genre
                </label>
                <select
                  value={filter.genre}
                  onChange={(e) => setFilter({ ...filter, genre: e.target.value })}
                  className="input-field"
                >
                  <option value="">All Genres</option>
                  <option value="drama">Drama</option>
                  <option value="comedy">Comedy</option>
                  <option value="thriller">Thriller</option>
                  <option value="horror">Horror</option>
                  <option value="scifi">Sci-Fi</option>
                  <option value="fantasy">Fantasy</option>
                  <option value="documentary">Documentary</option>
                  <option value="animation">Animation</option>
                  <option value="action">Action</option>
                  <option value="romance">Romance</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format
                </label>
                <select
                  value={filter.format}
                  onChange={(e) => setFilter({ ...filter, format: e.target.value })}
                  className="input-field"
                >
                  <option value="">All Formats</option>
                  <option value="feature">Feature Film</option>
                  <option value="tv">TV Series</option>
                  <option value="short">Short Film</option>
                  <option value="webseries">Web Series</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setFilter({ genre: '', format: '' });
                  setSearchQuery('');
                }}
                className="w-full btn-secondary text-sm"
              >
                Clear Filters
              </button>
            </div>

            {/* Trending */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-primary-600" />
                Trending Now
              </h3>
              <div className="space-y-3">
                {trending.map((pitch, index) => (
                  <Link
                    key={pitch.id}
                    to={pitchUrl(pitch)}
                    className="block hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
                  >
                    <div className="flex items-start">
                      <span className="text-2xl font-bold text-gray-400 mr-3">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {pitch.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {pitch.viewCount} views
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* View Toggle */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {searchQuery ? `Search Results for "${searchQuery}"` : 'All Pitches'}
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${
                    viewMode === 'grid'
                      ? 'bg-primary-100 text-primary-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Grid className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${
                    viewMode === 'list'
                      ? 'bg-primary-100 text-primary-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <List className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            )}

            {/* Pitches Grid/List */}
            {!loading && pitches.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No pitches found</p>
              </div>
            )}

            {!loading && pitches.length > 0 && (
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
                    : 'space-y-4'
                }
              >
                {pitches.map((pitch) => (
                  <Link
                    key={pitch.id}
                    to={pitchUrl(pitch)}
                    className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow ${
                      viewMode === 'list' ? 'p-4' : 'overflow-hidden'
                    }`}
                  >
                    {viewMode === 'grid' ? (
                      <>
                        <div className="h-48 bg-gradient-to-br from-primary-400 to-primary-600 p-6 flex items-end">
                          <div>
                            <h3 className="text-xl font-bold text-white mb-2">
                              {pitch.title}
                            </h3>
                            <div className="flex items-center space-x-4 text-white/80 text-sm">
                              <span className="flex items-center">
                                {formatIcon(pitch.format)}
                                <span className="ml-1 capitalize">{pitch.format}</span>
                              </span>
                              <span className="capitalize">{pitch.genre}</span>
                            </div>
                          </div>
                        </div>
                        <div className="p-6">
                          <p className="text-gray-600 mb-4 line-clamp-2">
                            {pitch.logline}
                          </p>
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>By @{pitch.creator?.username || pitch.creator?.name || 'Unknown'}</span>
                            <div className="flex items-center space-x-3">
                              <span className="flex items-center">
                                <Eye className="h-4 w-4 mr-1" />
                                {pitch.viewCount}
                              </span>
                              <span className="flex items-center">
                                <Heart className="h-4 w-4 mr-1" />
                                {pitch.likeCount}
                              </span>
                              <span className="flex items-center">
                                <Shield className="h-4 w-4 mr-1" />
                                {pitch.ndaCount}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {pitch.title}
                          </h3>
                          <p className="text-gray-600 mb-2">{pitch.logline}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>By @{pitch.creator?.username || pitch.creator?.name || 'Unknown'}</span>
                            <span className="flex items-center">
                              {formatIcon(pitch.format)}
                              <span className="ml-1 capitalize">{pitch.format}</span>
                            </span>
                            <span className="capitalize">{pitch.genre}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Eye className="h-4 w-4 mr-1" />
                            {pitch.viewCount}
                          </span>
                          <span className="flex items-center">
                            <Heart className="h-4 w-4 mr-1" />
                            {pitch.likeCount}
                          </span>
                          <span className="flex items-center">
                            <Shield className="h-4 w-4 mr-1" />
                            {pitch.ndaCount}
                          </span>
                        </div>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}