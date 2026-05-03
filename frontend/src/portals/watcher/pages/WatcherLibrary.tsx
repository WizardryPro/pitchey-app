import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, Clock, Users, Film, Eye, Star, Bookmark } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import GenrePlaceholder from '@shared/components/GenrePlaceholder';
import EmptyState from '@/components/EmptyState';

type TabId = 'saved' | 'liked' | 'recent' | 'following';

interface LibraryPitch {
  id: number;
  pitch_id?: number;
  title: string;
  logline?: string;
  genre?: string;
  format?: string;
  title_image?: string;
  thumbnail_url?: string;
  view_count?: number;
  like_count?: number;
  rating_average?: number;
  creator_name?: string;
  creator_id?: number;
  creator_verified?: boolean;
  viewed_at?: string;
  saved_at?: string;
  liked_at?: string;
}

interface FollowingCreator {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  userType?: string;
  profileImage?: string;
  verified?: boolean;
  pitchCount?: number;
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'liked', label: 'Liked', icon: Heart },
  { id: 'recent', label: 'Recently Viewed', icon: Clock },
  { id: 'following', label: 'Following', icon: Users },
];

export default function WatcherLibrary() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useBetterAuthStore();

  const tabFromUrl = (searchParams.get('tab') as TabId) || 'saved';
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some((t) => t.id === tabFromUrl) ? tabFromUrl : 'saved',
  );

  const [saved, setSaved] = useState<LibraryPitch[]>([]);
  const [liked, setLiked] = useState<LibraryPitch[]>([]);
  const [recent, setRecent] = useState<LibraryPitch[]>([]);
  const [following, setFollowing] = useState<FollowingCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [savedRes, likedRes, recentRes, followingRes] = await Promise.all([
        apiClient.get<{ savedPitches: LibraryPitch[] }>('/api/saved-pitches'),
        apiClient.get<{ data: LibraryPitch[] }>('/api/users/liked-pitches?limit=50'),
        apiClient.get<{ data: LibraryPitch[] }>('/api/users/recently-viewed?limit=30'),
        apiClient.get<{ following: FollowingCreator[] }>('/api/follows/following'),
      ]);

      if (savedRes.success && savedRes.data) {
        const raw: any = savedRes.data;
        setSaved(raw.savedPitches || raw.data?.savedPitches || []);
      }
      if (likedRes.success && likedRes.data) {
        const raw: any = likedRes.data;
        setLiked(raw.data || raw.likedPitches || []);
      }
      if (recentRes.success && recentRes.data) {
        const raw: any = recentRes.data;
        setRecent(raw.data || raw.recentlyViewed || []);
      }
      if (followingRes.success && followingRes.data) {
        const raw: any = followingRes.data;
        setFollowing(raw.following || raw.data?.following || []);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message || 'Failed to load library');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login/watcher');
      return;
    }
    void fetchLibrary();
  }, [isAuthenticated, navigate, fetchLibrary]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const goToPitch = (pitchId: number) => navigate(`/pitch/${pitchId}`);
  const goToCreator = (creatorId: number) => navigate(`/creator/${creatorId}`);

  const tabCounts: Record<TabId, number> = {
    saved: saved.length,
    liked: liked.length,
    recent: recent.length,
    following: following.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-sky-600 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">My Library</h1>
        <p className="text-cyan-100">Your saved pitches, viewing history, and followed creators.</p>
      </div>

      {/* Tabs — horizontally scrollable on mobile */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide" aria-label="Library tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0
                  ${isActive
                    ? 'text-cyan-600 border-cyan-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tabCounts[tab.id] > 0 && (
                  <span className={`
                    text-xs rounded-full px-2 py-0.5
                    ${isActive ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-600'}
                  `}>
                    {tabCounts[tab.id]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
              <div className="aspect-video bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && activeTab === 'saved' && (
        saved.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="No saved pitches yet"
            description="Browse the marketplace and save pitches you want to revisit."
            action={{
              label: 'Browse Marketplace',
              onClick: () => navigate('/marketplace'),
            }}
          />
        ) : (
          <PitchGrid pitches={saved} onClick={goToPitch} showTimestamp="saved" />
        )
      )}

      {!loading && !error && activeTab === 'liked' && (
        liked.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No liked pitches yet"
            description="Open a pitch and tap Like to add it here."
            action={{
              label: 'Browse Marketplace',
              onClick: () => navigate('/marketplace'),
            }}
          />
        ) : (
          <PitchGrid pitches={liked} onClick={goToPitch} showTimestamp="liked" />
        )
      )}

      {!loading && !error && activeTab === 'recent' && (
        recent.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No viewing history yet"
            description="Pitches you view will show up here for easy access."
            action={{
              label: 'Discover Pitches',
              onClick: () => navigate('/marketplace'),
            }}
          />
        ) : (
          <PitchGrid pitches={recent} onClick={goToPitch} showTimestamp="viewed" />
        )
      )}

      {!loading && !error && activeTab === 'following' && (
        following.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Not following anyone yet"
            description="Follow creators, investors, and production companies to see their latest activity."
            action={{
              label: 'Discover Creators',
              onClick: () => navigate('/marketplace'),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {following.map((creator) => (
              <button
                key={creator.id}
                onClick={() => goToCreator(creator.id)}
                className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 text-left hover:shadow-md hover:border-cyan-200 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  {creator.profileImage ? (
                    <img
                      src={creator.profileImage}
                      alt={creator.username || ''}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-sky-500 flex items-center justify-center text-white font-semibold">
                      {(creator.username || creator.firstName || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {creator.companyName || `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.username || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">{creator.userType || 'User'}</div>
                  </div>
                </div>
                {typeof creator.pitchCount === 'number' && (
                  <div className="text-sm text-gray-600 flex items-center gap-1">
                    <Film className="w-3.5 h-3.5" />
                    {creator.pitchCount} pitch{creator.pitchCount === 1 ? '' : 'es'}
                  </div>
                )}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ============ Pitch Grid ============

interface PitchGridProps {
  pitches: LibraryPitch[];
  onClick: (id: number) => void;
  showTimestamp?: 'saved' | 'viewed' | 'liked';
}

function PitchGrid({ pitches, onClick, showTimestamp }: PitchGridProps) {
  const formatRelative = (dateStr?: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {pitches.map((pitch) => {
        const pitchId = pitch.pitch_id || pitch.id;
        const image = pitch.title_image || pitch.thumbnail_url;
        const timestamp = showTimestamp === 'saved'
          ? pitch.saved_at
          : showTimestamp === 'viewed' ? pitch.viewed_at
          : showTimestamp === 'liked' ? pitch.liked_at
          : undefined;

        return (
          <button
            key={pitchId}
            onClick={() => onClick(pitchId)}
            className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 text-left hover:shadow-md hover:border-cyan-200 transition-all"
          >
            <div className="aspect-video bg-gray-100 relative overflow-hidden">
              {image ? (
                <img src={image} alt={pitch.title} className="w-full h-full object-cover" />
              ) : (
                <GenrePlaceholder genre={pitch.genre || ''} className="w-full h-full" />
              )}
              {timestamp && (
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                  {formatRelative(timestamp)}
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 truncate mb-1">{pitch.title}</h3>
              {pitch.logline && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{pitch.logline}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {pitch.genre && (
                  <span className="flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    {pitch.genre}
                  </span>
                )}
                {typeof pitch.view_count === 'number' && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {pitch.view_count}
                  </span>
                )}
                {typeof pitch.rating_average === 'number' && pitch.rating_average > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-500" />
                    {pitch.rating_average.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
