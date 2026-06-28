import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe, Eye, Heart, Star, TrendingUp,
  Calendar, Clock, Edit, MoreVertical, Filter, Search,
  Download, Share2, BarChart3, Users, AlertCircle
} from 'lucide-react';
import { PitchService, type Pitch } from '@features/pitches/services/pitch.service';

interface PublishedPitch {
  id: string;
  title: string;
  tagline: string;
  genre: string;
  budget: string;
  status: 'active' | 'paused' | 'archived';
  publishedDate: Date;
  lastModified: Date;
  stats: {
    views: number;
    likes: number;
    ndas: number;
    rating: number;
  };
  thumbnail?: string;
  visibility: 'public' | 'private' | 'nda_required';
}

// Transform API pitch to local format
function transformPitch(apiPitch: Pitch): PublishedPitch {
  // Map status to our local status
  const statusMap: Record<string, 'active' | 'paused' | 'archived'> = {
    'published': 'active',
    'under_review': 'paused',
    'archived': 'archived',
    'draft': 'paused'
  };

  // Determine visibility
  let visibility: 'public' | 'private' | 'nda_required' = 'public';
  if (apiPitch.requireNDA) {
    visibility = 'nda_required';
  } else if (apiPitch.visibilitySettings && !apiPitch.visibilitySettings.showShortSynopsis) {
    visibility = 'private';
  }

  return {
    id: String(apiPitch.id),
    title: apiPitch.title,
    tagline: apiPitch.logline || '',
    genre: apiPitch.genre?.charAt(0).toUpperCase() + apiPitch.genre?.slice(1) || 'Other',
    budget: apiPitch.budgetBracket || apiPitch.estimatedBudget || 'Not specified',
    status: statusMap[apiPitch.status] || 'active',
    publishedDate: new Date(apiPitch.publishedAt || apiPitch.createdAt),
    lastModified: new Date(apiPitch.updatedAt),
    stats: {
      // All real, from the creator-pitches API. Comments/shares/investment-interest
      // were dropped — no backend source exists (they only ever rendered 0).
      views: apiPitch.viewCount || 0,
      likes: apiPitch.likeCount || 0,
      ndas: apiPitch.ndaCount || 0,
      rating: Number(apiPitch.ratingAverage) || 0,
    },
    thumbnail: apiPitch.titleImage,
    visibility
  };
}

export default function CreatorPitchesPublished() {
  const navigate = useNavigate();
  const [pitches, setPitches] = useState<PublishedPitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');

  useEffect(() => {
    loadPublishedPitches();
  }, []);

  const loadPublishedPitches = async () => {
    try {
      setLoading(true);
      setError(null);

      const myPitches = await PitchService.getMyPitches();

      // Filter to only published pitches
      const publishedPitches = myPitches
        .filter((p: Pitch) => p.status === 'published')
        .map(transformPitch);

      setPitches(publishedPitches);
    } catch (err) {
      console.error('Failed to load pitches:', err);
      setError('Failed to load your pitches. Please try again.');
      setPitches([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public': return { icon: Globe, color: 'text-green-600' };
      case 'private': return { icon: Users, color: 'text-yellow-600' };
      case 'nda_required': return { icon: Star, color: 'text-purple-600' };
      default: return { icon: Globe, color: 'text-gray-600' };
    }
  };

  const filteredPitches = pitches.filter(pitch => {
    const matchesSearch = pitch.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          pitch.tagline.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          pitch.genre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || pitch.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const sortedPitches = [...filteredPitches].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return b.publishedDate.getTime() - a.publishedDate.getTime();
      case 'views':
        return b.stats.views - a.stats.views;
      case 'engagement':
        return (b.stats.likes + b.stats.ndas) - (a.stats.likes + a.stats.ndas);
      case 'rating':
        return b.stats.rating - a.stats.rating;
      default:
        return 0;
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
            <button
              onClick={loadPublishedPitches}
              className="ml-auto text-red-600 hover:text-red-800 font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Published Pitches</h1>
            <p className="mt-2 text-gray-600">
              Manage and track your live pitches
            </p>
          </div>
          <button
            onClick={() => navigate('/creator/pitch/new')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Create New Pitch
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Published</p>
                <p className="text-2xl font-bold text-gray-900">{pitches.length}</p>
              </div>
              <Globe className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Views</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(pitches.reduce((acc, p) => acc + p.stats.views, 0))}
                </p>
              </div>
              <Eye className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg. Rating</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(pitches.reduce((acc, p) => acc + p.stats.rating, 0) / pitches.length || 0).toFixed(1)}
                </p>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total NDAs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(pitches.reduce((acc, p) => acc + p.stats.ndas, 0))}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search pitches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="recent">Most Recent</option>
            <option value="views">Most Viewed</option>
            <option value="engagement">Most Engaged</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>
      </div>

      {/* Pitches Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
              <div className="h-40 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : sortedPitches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPitches.map((pitch) => {
            const VisibilityIcon = getVisibilityIcon(pitch.visibility);
            
            return (
              <div
                key={pitch.id}
                className="bg-white rounded-lg shadow-sm border hover:shadow-md transition cursor-pointer"
                onClick={() => navigate(`/pitch/${pitch.id}`)}
              >
                {/* Thumbnail */}
                <div className="h-48 rounded-t-lg relative overflow-hidden">
                  {pitch.thumbnail ? (
                    <img
                      src={pitch.thumbnail}
                      alt={pitch.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-600" />
                  )}
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(pitch.status)}`}>
                      {pitch.status}
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <VisibilityIcon.icon className={`w-5 h-5 ${VisibilityIcon.color}`} />
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{pitch.title}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">{pitch.tagline}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(pitch.publishedDate)}
                    </span>
                    <span>{pitch.genre}</span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900">{formatNumber(pitch.stats.views)}</p>
                      <p className="text-xs text-gray-500">Views</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900">{formatNumber(pitch.stats.likes)}</p>
                      <p className="text-xs text-gray-500">Likes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900">{formatNumber(pitch.stats.ndas)}</p>
                      <p className="text-xs text-gray-500">NDAs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900">{pitch.stats.rating.toFixed(1)}</p>
                      <p className="text-xs text-gray-500">Rating</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void navigate(`/creator/pitch/${pitch.id}/edit`);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void navigate(`/creator/pitch/${pitch.id}/analytics`);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Analytics
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(`${window.location.origin}/pitch/${pitch.id}`);
                      }}
                      className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No published pitches</h3>
          <p className="text-gray-600 mb-6">
            Your published pitches will appear here
          </p>
          <button
            onClick={() => navigate('/creator/pitch/new')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Publish Your First Pitch
          </button>
        </div>
      )}
    </div>
  );
}