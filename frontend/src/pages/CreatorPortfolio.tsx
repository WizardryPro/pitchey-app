import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Eye, TrendingUp, Film, MapPin, Calendar, BadgeCheck, Edit2, Share2 } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useBetterAuthStore } from '../store/betterAuthStore';
import ShareLinksModal from '../components/portfolio/ShareLinksModal';

interface Pitch {
  id: string;
  title: string;
  logline: string;
  genre: string;
  cover_image: string;
  view_count: number;
  like_count: number;
  status: string;
  investment_total: number;
  created_at: string;
}

interface PortfolioData {
  pitches: Pitch[];
  totalInvestment: number;
}

const GENRE_COLORS: Record<string, string> = {
  'Action': 'bg-red-100 text-red-700',
  'Comedy': 'bg-yellow-100 text-yellow-700',
  'Drama': 'bg-blue-100 text-blue-700',
  'Horror': 'bg-gray-100 text-gray-700',
  'Sci-Fi': 'bg-purple-100 text-purple-700',
  'Romance': 'bg-pink-100 text-pink-700',
  'Thriller': 'bg-orange-100 text-orange-700',
  'Documentary': 'bg-green-100 text-green-700',
  'Animation': 'bg-indigo-100 text-indigo-700',
  'Fantasy': 'bg-violet-100 text-violet-700',
};

function getGenreColor(genre: string) {
  return GENRE_COLORS[genre] || 'bg-gray-100 text-gray-700';
}

function formatNumber(num: number) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatCurrency(amount: number) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return '$' + (amount / 1000).toFixed(0) + 'K';
  return '$' + amount.toLocaleString();
}

export default function CreatorPortfolio() {
  const { creatorId } = useParams<{ creatorId: string }>();
  const { user } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortfolioData | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const navigate = useNavigate();

  const effectiveCreatorId = creatorId || user?.id?.toString() || null;
  const isOwnProfile = !creatorId && !!user?.id;

  useEffect(() => {
    if (!effectiveCreatorId) return;

    const fetchPortfolio = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = creatorId ? `/api/creator/portfolio/${creatorId}` : '/api/creator/portfolio';
        const response = await apiClient.get(url);
        if (!response.success) throw new Error(response.error?.message || 'Failed to fetch portfolio');
        setData(response.data as PortfolioData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load portfolio');
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [effectiveCreatorId, creatorId]);

  if (!effectiveCreatorId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Film className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in to view your portfolio</h2>
          <button
            onClick={() => navigate('/login/creator')}
            className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 p-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate('/creator/dashboard')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pitches = data?.pitches || [];
  const totalInvestment = data?.totalInvestment || 0;
  const totalViews = pitches.reduce((sum, p) => sum + (p.view_count || 0), 0);
  const totalLikes = pitches.reduce((sum, p) => sum + (p.like_count || 0), 0);

  const creatorName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Creator';
  const creatorUsername = user?.username || '';
  const creatorBio = (user as any)?.bio || '';
  const creatorLocation = (user as any)?.location || '';
  const joinedDate = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/creator/dashboard')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
            {isOwnProfile && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowShareModal(true)} className="flex items-center gap-2 px-4 py-2 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium">
                  <Share2 className="w-4 h-4" />
                  Share Portfolio
                </button>
                <button onClick={() => navigate('/profile')} className="flex items-center gap-2 px-4 py-2 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium">
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Creator Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt={creatorName} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                creatorName.charAt(0).toUpperCase()
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-gray-900 truncate">{creatorName}</h1>
                {(user as any)?.verified && <BadgeCheck className="w-5 h-5 text-blue-500 flex-shrink-0" />}
              </div>
              {creatorUsername && <p className="text-gray-500 text-sm mb-2">@{creatorUsername}</p>}
              {creatorBio && <p className="text-gray-700 mb-3 max-w-2xl">{creatorBio}</p>}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                {creatorLocation && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {creatorLocation}
                  </span>
                )}
                {joinedDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Joined {joinedDate}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{pitches.length}</div>
              <div className="text-sm text-gray-500">Pitches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{formatNumber(totalViews)}</div>
              <div className="text-sm text-gray-500">Views</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{formatNumber(totalLikes)}</div>
              <div className="text-sm text-gray-500">Likes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalInvestment)}</div>
              <div className="text-sm text-gray-500">Invested</div>
            </div>
          </div>
        </div>

        {/* Pitches Grid */}
        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Pitches</h2>
            {isOwnProfile && (
              <Link
                to="/creator/pitch/new"
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Pitch
              </Link>
            )}
          </div>

          {pitches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pitches.map((pitch) => (
                <Link
                  key={pitch.id}
                  to={`/pitch/${pitch.id}`}
                  className="group block bg-white border rounded-xl overflow-hidden hover:shadow-lg transition-all"
                >
                  {/* Thumbnail */}
                  <div className="relative h-44 overflow-hidden">
                    {pitch.cover_image ? (
                      <img
                        src={pitch.cover_image}
                        alt={pitch.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                        <Film className="w-10 h-10 text-white/60" />
                      </div>
                    )}
                    {pitch.genre && (
                      <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium ${getGenreColor(pitch.genre)}`}>
                        {pitch.genre}
                      </span>
                    )}
                    <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium ${
                      pitch.status === 'published' ? 'bg-green-100 text-green-700' :
                      pitch.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {pitch.status}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-purple-600 transition-colors">
                      {pitch.title}
                    </h3>
                    {pitch.logline && (
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{pitch.logline}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> {formatNumber(pitch.view_count || 0)}
                        </span>
                        {pitch.investment_total > 0 && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" /> {formatCurrency(Number(pitch.investment_total))}
                          </span>
                        )}
                      </div>
                      <span>{new Date(pitch.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Film className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No pitches yet</h3>
              <p className="text-gray-500 mb-6">
                {isOwnProfile
                  ? 'Create your first pitch to start building your portfolio.'
                  : "This creator hasn't shared any pitches yet."}
              </p>
              {isOwnProfile && (
                <Link
                  to="/creator/pitch/new"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Pitch
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
      {showShareModal && <ShareLinksModal onClose={() => setShowShareModal(false)} />}
    </div>
  );
}
