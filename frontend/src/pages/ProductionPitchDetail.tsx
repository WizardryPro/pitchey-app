import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Eye, Heart, Shield, Users, Film, 
  Calendar, DollarSign, Download, Play, Share2,
  Edit, BarChart3, FileText, BookOpen, Video,
  Clock, CheckCircle, X, Maximize2, Star, TrendingUp
} from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import PitchMediaGallery from '../components/PitchMediaGallery';
import { API_URL } from '../config';
import FormatDisplay from '../components/FormatDisplay';

interface PitchDetails {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  formatCategory?: string;
  formatSubtype?: string;
  shortSynopsis: string;
  longSynopsis: string;
  budget: string;
  estimatedBudget?: number;
  productionTimeline?: string;
  targetReleaseDate?: string;
  targetAudience?: string;
  comparableTitles?: string;
  characters?: Array<{
    name: string;
    description: string;
    age?: string;
    gender?: string;
    actor?: string;
  }>;
  themes?: string[];
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  followersCount: number;
  status: string;
  createdAt: string;
  publishedAt?: string;
  titleImage?: string;
  mediaFiles?: Array<{
    id: string;
    type: string;
    url: string;
    title: string;
    description?: string;
    uploadedAt: string;
    size?: string;
    requiresNDA?: boolean;
  }>;
  analytics?: {
    dailyViews: Array<{ date: string; views: number }>;
    topViewers: Array<{ name: string; company?: string; type: string }>;
    engagementRate: number;
  };
}

export default function ProductionPitchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  const [pitch, setPitch] = useState<PitchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'media' | 'analytics' | 'engagement'>('overview');
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  useEffect(() => {
    fetchPitchDetails();
  }, [id]);

  const fetchPitchDetails = async () => {
    try {
      setLoading(true);
      
      if (!id) {
        console.error('No pitch ID provided');
        return;
      }
      
      // Fetch from API using public pitch endpoint
      const response = await fetch(`${API_URL}/api/pitches/public/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        const raw = await response.json() as Record<string, unknown>;
        const p = (raw.data as Record<string, unknown>) ?? raw;
        // Map snake_case API response to PitchDetails interface
        setPitch({
          id: Number(p.id) || 0,
          title: String(p.title ?? ''),
          logline: String(p.logline ?? ''),
          genre: String(p.genre ?? ''),
          format: String(p.format ?? ''),
          formatCategory: p.format_category as string | undefined,
          formatSubtype: p.format_subtype as string | undefined,
          shortSynopsis: String(p.short_synopsis ?? p.shortSynopsis ?? ''),
          longSynopsis: String(p.long_synopsis ?? p.longSynopsis ?? ''),
          budget: String(p.budget ?? p.budget_range ?? ''),
          estimatedBudget: Number(p.estimated_budget) || undefined,
          productionTimeline: p.production_timeline as string | undefined,
          targetReleaseDate: p.target_release_date as string | undefined,
          targetAudience: p.target_audience as string | undefined,
          comparableTitles: p.comparable_films as string | undefined,
          characters: Array.isArray(p.characters) ? p.characters as PitchDetails['characters'] : [],
          themes: Array.isArray(p.themes) ? p.themes as string[] : [],
          viewCount: Number(p.view_count ?? p.viewCount) || 0,
          likeCount: Number(p.like_count ?? p.likeCount) || 0,
          ndaCount: Number(p.nda_count ?? p.ndaCount) || 0,
          followersCount: Number(p.followers_count ?? p.followersCount) || 0,
          status: String(p.status ?? 'draft'),
          createdAt: String(p.created_at ?? ''),
          publishedAt: p.published_at as string | undefined,
          titleImage: p.title_image as string | undefined,
          mediaFiles: Array.isArray(p.media_files) ? p.media_files as PitchDetails['mediaFiles'] : undefined,
        });
      } else {
        console.error('Failed to fetch pitch:', response.status, response.statusText);
        // Don't set any fallback data - let the "not found" state show
        setPitch(null);
      }
    } catch (error) {
      console.error('Failed to fetch pitch details:', error);
      setPitch(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayTrailer = (url: string) => {
    setSelectedVideo(url);
    setShowVideoPlayer(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!pitch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pitch Not Found</h2>
          <p className="text-gray-600 mb-4">The pitch you're looking for doesn't exist.</p>
          <Link to="/production/dashboard" className="text-purple-600 hover:text-purple-700">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/production/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{pitch.title}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                  <span>{pitch.genre}</span>
                  <span>•</span>
                  <FormatDisplay 
                    formatCategory={pitch.formatCategory}
                    formatSubtype={pitch.formatSubtype}
                    format={pitch.format}
                    variant="compact"
                  />
                  <span>•</span>
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    {pitch.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Link
                to={`/pitch/${pitch.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-4 h-4" />
                Edit Pitch
              </Link>
              <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="grid grid-cols-5 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pitch.viewCount}</p>
                <p className="text-xs text-gray-600">Total Views</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Heart className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pitch.likeCount}</p>
                <p className="text-xs text-gray-600">Likes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pitch.ndaCount}</p>
                <p className="text-xs text-gray-600">NDAs Signed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pitch.followersCount}</p>
                <p className="text-xs text-gray-600">Followers</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pitch.analytics?.engagementRate}%</p>
                <p className="text-xs text-gray-600">Engagement Rate</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('media')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'media'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Media & Documents ({pitch.mediaFiles?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'analytics'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('engagement')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'engagement'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Engagement
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title Image */}
              {pitch.titleImage && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden relative">
                  <img 
                    src={pitch.titleImage} 
                    alt={pitch.title}
                    className="w-full aspect-video object-cover"
                  />
                  {pitch.mediaFiles?.find(m => m.type === 'trailer') && (
                    <button
                      onClick={() => handlePlayTrailer(pitch.mediaFiles?.find(m => m.type === 'trailer')?.url || '')}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 group hover:bg-black/50 transition-colors"
                    >
                      <div className="p-4 bg-white/90 rounded-full group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-purple-600" />
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Logline */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Logline</h2>
                <p className="text-gray-700 leading-relaxed">{pitch.logline}</p>
              </div>

              {/* Synopsis */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Synopsis</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Short Synopsis</h3>
                    <p className="text-gray-700 leading-relaxed">{pitch.shortSynopsis}</p>
                  </div>
                  {pitch.longSynopsis && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Full Synopsis</h3>
                      <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {pitch.longSynopsis}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Characters */}
              {pitch.characters && pitch.characters.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Main Characters</h2>
                  <div className="space-y-4">
                    {pitch.characters.map((character, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-gray-900">{character.name}</h3>
                          {character.actor && (
                            <span className="text-sm text-purple-600 font-medium">{character.actor}</span>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2">{character.description}</p>
                        <div className="flex gap-4 text-sm text-gray-600">
                          {character.age && <span>Age: {character.age}</span>}
                          {character.gender && <span>Gender: {character.gender}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Production Info */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Production Details</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-gray-600">Budget</dt>
                    <dd className="font-semibold text-gray-900">{pitch.budget}</dd>
                  </div>
                  {pitch.productionTimeline && (
                    <div>
                      <dt className="text-sm text-gray-600">Production Timeline</dt>
                      <dd className="text-gray-900">{pitch.productionTimeline}</dd>
                    </div>
                  )}
                  {pitch.targetReleaseDate && (
                    <div>
                      <dt className="text-sm text-gray-600">Target Release</dt>
                      <dd className="text-gray-900">
                        {new Date(pitch.targetReleaseDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Market Info */}
              {(pitch.targetAudience || pitch.comparableTitles) && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Market Analysis</h2>
                  <div className="space-y-4">
                    {pitch.targetAudience && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Target Audience</h3>
                        <p className="text-gray-900 text-sm">{pitch.targetAudience}</p>
                      </div>
                    )}
                    {pitch.comparableTitles && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Comparable Titles</h3>
                        <p className="text-gray-900 text-sm">{pitch.comparableTitles}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Themes */}
              {pitch.themes && pitch.themes.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Themes</h2>
                  <div className="flex flex-wrap gap-2">
                    {pitch.themes.map(theme => (
                      <span
                        key={theme}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  <button className="w-full py-2 px-4 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-left flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Download All Materials
                  </button>
                  <button className="w-full py-2 px-4 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-left flex items-center gap-2">
                    <Share2 className="w-4 h-4" />
                    Generate Share Link
                  </button>
                  <Link
                    to={`/pitch/${pitch.id}/analytics`}
                    className="w-full py-2 px-4 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-left flex items-center gap-2 block"
                  >
                    <BarChart3 className="w-4 h-4" />
                    View Full Analytics
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Media Files & Documents</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Shield className="w-4 h-4" />
                  <span>Some files require NDA</span>
                </div>
              </div>
              
              {pitch.mediaFiles && (
                <PitchMediaGallery
                  mediaItems={pitch.mediaFiles.map(file => ({
                    ...file,
                    type: file.type as any
                  }))}
                  hasNDAAccess={true} // Since it's their own pitch
                  titleImage={pitch.titleImage}
                  showTitleImage={false}
                  onView={(item) => {
                    if (item.type === 'trailer') {
                      handlePlayTrailer(item.url);
                    } else {
                      window.open(item.url, '_blank');
                    }
                  }}
                  onDownload={(item) => {
                    // In production, this would trigger a download
                  }}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* View Trends */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">View Trends (Last 7 Days)</h2>
                <div className="h-64 flex items-end justify-between gap-2">
                  {pitch.analytics?.dailyViews.map((day, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-purple-500 rounded-t"
                        style={{ height: `${(day.views / 100) * 200}px` }}
                      />
                      <span className="text-xs text-gray-600 mt-2">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className="text-xs font-semibold">{day.views}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Viewers */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Viewers</h2>
                <div className="space-y-3">
                  {pitch.analytics?.topViewers.map((viewer, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{viewer.name}</p>
                        <p className="text-sm text-gray-600">{viewer.company}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        viewer.type === 'production' ? 'bg-purple-100 text-purple-700' :
                        viewer.type === 'investor' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {viewer.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Engagement Metrics */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Metrics</h2>
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <p className="text-3xl font-bold text-purple-600">{pitch.analytics?.engagementRate}%</p>
                  <p className="text-sm text-gray-600 mt-1">Engagement Rate</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-600">3:45</p>
                  <p className="text-sm text-gray-600 mt-1">Avg. View Time</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-600">67%</p>
                  <p className="text-sm text-gray-600 mt-1">Complete Views</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-yellow-600">23</p>
                  <p className="text-sm text-gray-600 mt-1">Repeat Viewers</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'engagement' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Shield className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900">
                      <span className="font-medium">Netflix Studios</span> signed an NDA
                    </p>
                    <p className="text-sm text-gray-600">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Heart className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900">
                      <span className="font-medium">Warner Bros</span> liked your pitch
                    </p>
                    <p className="text-sm text-gray-600">5 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900">
                      <span className="font-medium">A24 Films</span> started following
                    </p>
                    <p className="text-sm text-gray-600">1 day ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Eye className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900">
                      <span className="font-medium">Silver Screen Ventures</span> viewed your pitch
                    </p>
                    <p className="text-sm text-gray-600">2 days ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {showVideoPlayer && selectedVideo && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowVideoPlayer(false)}
        >
          <div className="relative max-w-6xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowVideoPlayer(false)}
              className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="bg-black rounded-lg overflow-hidden">
              {/* For demo purposes, showing a placeholder video message */}
              <div className="aspect-video bg-gray-900 flex items-center justify-center">
                <div className="text-center text-white p-8">
                  <Play className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                  <h3 className="text-xl font-semibold mb-2">Video Player</h3>
                  <p className="text-gray-400 mb-4">
                    In production, your trailer would play here.
                  </p>
                  <p className="text-sm text-gray-500">
                    Video URL: {selectedVideo}
                  </p>
                </div>
              </div>
              {/* Actual video element (uncomment when you have real video files) */}
              {/* <video 
                controls 
                autoPlay 
                className="w-full max-h-[80vh]"
                src={selectedVideo}
                onError={(e) => {
                  console.error('Video playback error:', e);
                  alert('Unable to play video. Please check the file format.');
                }}
              >
                Your browser does not support the video tag.
              </video> */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}