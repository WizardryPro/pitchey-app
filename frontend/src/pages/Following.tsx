import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Users, Film, Calendar, MapPin, Eye, Heart, AlertCircle, Search, Bookmark, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_URL } from '../config';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { SocialService } from '@features/browse/services/social.service';
import { SavedPitchesService, type SavedPitch } from '@features/pitches/services/saved-pitches.service';
import { getPortalPath } from '@/utils/navigation';

interface Creator {
  id: number;
  type: 'creator';
  username: string;
  firstName?: string;
  lastName?: string;
  userType: string;
  companyName?: string;
  profileImage?: string;
  bio?: string;
  location?: string;
  followedAt: string;
  createdAt: string;
  pitchCount: number;
}


interface ActivityUpdate {
  id: number;
  type: 'pitch_created' | 'pitch_updated' | 'new_follower' | 'message_attachment';
  creator: {
    id: number;
    username: string;
    companyName?: string;
    profileImage?: string;
    userType: string;
  };
  action: string;
  pitch?: {
    id: number;
    title: string;
    genre: string;
    logline: string;
    requireNda?: boolean;
    ndaSigned?: boolean;
    ndaPending?: boolean;
  };
  // Present for message_attachment events (a creator shared a file with you).
  attachment?: {
    fileName: string;
    count: number;
    conversationId?: number;
    pitchId?: number;
  };
  createdAt: string;
}

// Map a followed-creator pitch row (from /api/pitches/following) into an activity item.
// Used as the fallback when the unified activity_feed is empty (e.g. pre-migration).
const mapPitchesToActivities = (pitches: any[]): ActivityUpdate[] =>
  pitches.map((p: any) => ({
    id: p.id,
    type: 'pitch_created' as const,
    creator: {
      id: p.user_id || p.userId,
      username: p.creator_name || p.creator_email?.split('@')[0] || 'Creator',
      profileImage: p.creator_profile_image || p.profile_image,
      userType: 'creator',
    },
    action: 'published a pitch',
    pitch: {
      id: p.id,
      title: p.title,
      genre: p.genre || '',
      logline: p.logline || p.short_synopsis || '',
      requireNda: Boolean(p.requireNda ?? p.require_nda),
      ndaSigned: Boolean(p.ndaSigned ?? p.nda_signed),
      ndaPending: Boolean(p.ndaPending ?? p.nda_pending),
    },
    createdAt: p.created_at || p.createdAt || '',
  }));

// Map a unified activity_feed item (from /api/activity/feed) into an activity item.
const mapFeedItem = (item: any): ActivityUpdate | null => {
  if (!item || !item.actor) return null;

  // Messaged attachment — a creator shared a file with you (recipient-only event).
  if (item.action === 'message_attachment') {
    const md = item.metadata || {};
    const count = Number(md.attachmentCount) || 1;
    return {
      id: item.id,
      type: 'message_attachment',
      creator: {
        id: item.actor.id,
        username: item.actor.name || item.actor.username || 'Someone',
        profileImage: item.actor.profileImage,
        userType: item.actor.userType || 'creator',
      },
      action: count > 1 ? `shared ${count} files with you` : 'shared a document with you',
      attachment: {
        fileName: md.fileName || 'a file',
        count,
        conversationId: md.conversationId,
        pitchId: md.pitchId,
      },
      createdAt: item.createdAt || '',
    };
  }

  const isUpdate = item.action === 'pitch_updated';
  return {
    id: item.id,
    type: isUpdate ? 'pitch_updated' : 'pitch_created',
    creator: {
      id: item.actor.id,
      username: item.actor.name || item.actor.username || 'Creator',
      profileImage: item.actor.profileImage,
      userType: item.actor.userType || 'creator',
    },
    action: isUpdate ? 'updated a pitch' : 'published a pitch',
    pitch: item.pitch
      ? {
          id: item.pitch.id,
          title: item.pitch.title,
          genre: item.pitch.genre || '',
          logline: item.pitch.logline || '',
          requireNda: Boolean(item.pitch.requireNda),
        }
      : undefined,
    createdAt: item.createdAt || '',
  };
};

const Following: React.FC = () => {
  const [searchParams] = useSearchParams();
  type TabKey = 'activity' | 'followers' | 'following' | 'saved';
  const initialTab = (['activity', 'followers', 'following', 'saved'] as const).includes(searchParams.get('tab') as any)
    ? (searchParams.get('tab') as TabKey)
    : 'followers';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [data, setData] = useState<(Creator[] | ActivityUpdate[])>([]);
  const [savedPitches, setSavedPitches] = useState<SavedPitch[]>([]);
  const [summary, setSummary] = useState({
    newPitches: 0,
    activeCreators: 0,
    engagementRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('7d');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  const userType = user?.userType;

  useEffect(() => {
    fetchFollowingData();
  }, [activeTab, timeframe]);

  const fetchFollowingData = async () => {
    setLoading(true);
    setError(null);
    setData([]);
    setSavedPitches([]);

    try {
      // Saved tab — reuse the saved-pitches service (its own data shape).
      if (activeTab === 'saved') {
        const res = await SavedPitchesService.getSavedPitches({ limit: 50 });
        setSavedPitches(res.savedPitches || []);
        return;
      }

      // Activity tab — prefer the unified activity_feed; fall back to
      // followed-creator pitches when the feed is empty (e.g. pre-migration,
      // or no events emitted yet).
      if (activeTab === 'activity') {
        let activities: ActivityUpdate[] = [];
        let summaryFromApi: typeof summary | null = null;
        try {
          const feedRes = await fetch(`${API_URL}/api/activity/feed?limit=30`, {
            method: 'GET',
            credentials: 'include',
          });
          if (feedRes.ok) {
            const fr = await feedRes.json();
            if (fr?.summary) summaryFromApi = fr.summary;
            const items = fr?.data?.items || fr?.items || [];
            activities = items.map(mapFeedItem).filter(Boolean) as ActivityUpdate[];
          }
        } catch {
          // ignore — fall through to the pitches-following fallback
        }
        if (activities.length === 0) {
          const tf = timeframe && timeframe !== 'all' ? `?timeframe=${timeframe}` : '';
          const fb = await fetch(`${API_URL}/api/pitches/following${tf}`, {
            method: 'GET',
            credentials: 'include',
          });
          if (!fb.ok) {
            throw new Error('Failed to fetch following data');
          }
          const result = await fb.json();
          if (result.success) {
            if (result.summary) summaryFromApi = result.summary;
            const pitches = result.data?.pitches || result.pitches || result.data || [];
            activities = mapPitchesToActivities(pitches);
          }
        }
        setData(activities);
        if (summaryFromApi) setSummary(summaryFromApi);
        return;
      }

      // Followers / Following lists.
      const endpoint = activeTab === 'followers' ? '/api/follows/followers' : '/api/follows/following';
      const separator = endpoint.includes('?') ? '&' : '?';
      const url = timeframe && timeframe !== 'all' ? `${API_URL}${endpoint}${separator}timeframe=${timeframe}` : `${API_URL}${endpoint}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include' // Send cookies for session
      });

      if (!response.ok) {
        throw new Error('Failed to fetch following data');
      }

      const result = await response.json();

      if (result.success) {
        // Handle different response formats based on the tab
        if (activeTab === 'followers') {
          const raw = result.data?.followers || result.data?.users || result.followers || result.data || [];
          setData(raw.map((f: any) => ({
            ...f,
            profileImage: f.profileImage || f.profile_image,
            userType: f.userType || f.user_type || 'user',
            companyName: f.companyName || f.company_name,
            firstName: f.firstName || f.first_name,
            lastName: f.lastName || f.last_name,
            pitchCount: f.pitchCount ?? f.pitch_count ?? 0,
            followedAt: f.followedAt || f.followed_at || f.created_at || '',
            createdAt: f.createdAt || f.created_at || '',
          })));
        } else if (activeTab === 'following') {
          const raw = result.data?.following || result.data?.users || result.following || result.data || [];
          setData(raw.map((f: any) => ({
            ...f,
            profileImage: f.profileImage || f.profile_image,
            userType: f.userType || f.user_type || 'user',
            companyName: f.companyName || f.company_name,
            firstName: f.firstName || f.first_name,
            lastName: f.lastName || f.last_name,
            pitchCount: f.pitchCount ?? f.pitch_count ?? 0,
            followedAt: f.followedAt || f.followed_at || f.created_at || '',
            createdAt: f.createdAt || f.created_at || '',
          })));
        } else {
          // Fallback to data directly if it's an array
          setData(Array.isArray(result.data) ? result.data : []);
        }
        if (result.summary) {
          setSummary(result.summary);
        } else if (activeTab === 'following') {
          const total = result.data?.total ?? (result.data?.users?.length || result.data?.following?.length || 0);
          setSummary(prev => ({ ...prev, activeCreators: total }));
        }
      } else {
        throw new Error(result.error || 'Failed to load data');
      }
    } catch (err) {
      console.error('Error fetching following data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load following data');
      // Set empty data on error
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'recently';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'recently';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDisplayName = (creator: any) => {
    if (!creator) return 'Unknown';
    if (creator.companyName) return creator.companyName;
    if (creator.firstName) {
      return `${creator.firstName} ${creator.lastName || ''}`.trim();
    }
    if (creator.username) return creator.username;
    if (creator.name) return creator.name;
    if (creator.email) return creator.email.split('@')[0];
    return 'Unknown';
  };

  const renderActivityTab = () => {
    const activities = data as ActivityUpdate[];
    
    return (
      <div className="space-y-6">
        {/* Activity Summary */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Activity Summary</h3>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.newPitches}</div>
              <div className="text-sm text-gray-600">New Pitches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.activeCreators}</div>
              <div className="text-sm text-gray-600">Active Creators</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{summary.engagementRate}%</div>
              <div className="text-sm text-gray-600">Engagement Rate</div>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No recent activity from followed creators</p>
              <button 
                onClick={() => navigate('/marketplace')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Browse Marketplace →
              </button>
            </div>
          ) : (
            activities.filter(u => u && u.creator).map((update) => (
              <div key={update.id} className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {update.creator?.profileImage || (update.creator as any)?.profile_image ? (
                      <img
                        src={update.creator.profileImage || (update.creator as any).profile_image}
                        alt={getDisplayName(update.creator)}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 font-medium">
                          {(getDisplayName(update.creator) || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium text-gray-900">
                        {getDisplayName(update.creator)}
                      </span>
                      <span className="text-gray-500">{update.action}</span>
                      <span className="text-gray-400 text-sm">
                        • {new Date(update.createdAt || (update as any).created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {update.pitch && (
                      <div 
                        className="cursor-pointer group"
                        onClick={() => navigate(`/pitch/${update.pitch!.id}`)}
                      >
                        <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 mb-1">
                          {update.pitch.title}
                        </h4>
                        <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                          {update.pitch.logline}
                        </p>
                        <div className="flex items-center flex-wrap gap-2 text-sm text-gray-500">
                          <span className="px-2 py-1 bg-gray-100 rounded-full">
                            {update.pitch.genre}
                          </span>
                          {update.pitch.requireNda && (
                            update.pitch.ndaSigned ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                NDA Signed
                              </span>
                            ) : update.pitch.ndaPending ? (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                NDA Pending
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium border border-red-200">
                                NDA Required
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {update.attachment && (
                      <div
                        className="cursor-pointer group flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200"
                        onClick={() => navigate(
                          update.attachment!.conversationId
                            ? `/messages?conversation=${update.attachment!.conversationId}`
                            : '/messages'
                        )}
                      >
                        <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 group-hover:text-blue-600 truncate">
                            {update.attachment.fileName}
                          </p>
                          <p className="text-xs text-gray-500">View in Messages →</p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // Client-side filtering for followers/following lists
  const filteredUsers = useMemo(() => {
    if (activeTab === 'activity') return data;
    const users = data as Creator[];
    return users.filter(u => {
      if (!u) return false;
      const matchesType = userTypeFilter === 'all' || u.userType === userTypeFilter;
      if (!matchesType) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const name = getDisplayName(u).toLowerCase();
      const username = (u.username || '').toLowerCase();
      return name.includes(term) || username.includes(term);
    });
  }, [data, activeTab, userTypeFilter, searchTerm]);

  const renderUserFilterBar = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border mb-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {(['all', 'creator', 'investor', 'production'] as const).map(type => (
          <button
            key={type}
            onClick={() => setUserTypeFilter(type)}
            className={`px-3 py-1 rounded-full text-sm transition ${
              userTypeFilter === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
          </button>
        ))}
      </div>
    </div>
  );

  const renderFollowersTab = () => {
    const followers = filteredUsers as Creator[];

    return (
      <div className="space-y-4">
        {renderUserFilterBar()}
        {followers.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">You don't have any followers yet</p>
            <button 
              onClick={() => navigate('/marketplace')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Create Great Content
            </button>
          </div>
        ) : (
          followers.filter(Boolean).map((follower) => (
            <div key={follower.id} className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {follower?.profileImage ? (
                    <img 
                      src={follower.profileImage} 
                      alt={getDisplayName(follower)}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-medium text-lg">
                        {(getDisplayName(follower) || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-gray-900">
                      {getDisplayName(follower)}
                    </h3>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {follower.userType}
                    </span>
                  </div>
                  
                  {follower.bio && (
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {follower.bio}
                    </p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {follower.pitchCount || 0} pitches
                    </span>
                    {follower.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {follower.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Followed you {formatDate(follower.followedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0 space-x-2">
                  <button 
                    onClick={() => navigate(`/creator/${follower.id}`)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderFollowingTab = () => {
    const following = filteredUsers as Creator[];

    return (
      <div className="space-y-4">
        {renderUserFilterBar()}
        {following.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">You're not following anyone yet</p>
            <button 
              onClick={() => navigate('/marketplace')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Discover Creators
            </button>
          </div>
        ) : (
          following.filter(Boolean).map((creator) => (
            <div key={creator.id} className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {creator?.profileImage ? (
                    <img 
                      src={creator.profileImage} 
                      alt={getDisplayName(creator)}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-medium text-lg">
                        {(getDisplayName(creator) || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-gray-900">
                      {getDisplayName(creator)}
                    </h3>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {creator.userType}
                    </span>
                  </div>
                  
                  {creator.bio && (
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {creator.bio}
                    </p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {creator.pitchCount || 0} pitches
                    </span>
                    {creator.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {creator.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Following since {formatDate(creator.followedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0 space-x-2">
                  <button 
                    onClick={() => navigate(`/creator/${creator.id}`)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    View Portfolio
                  </button>
                  <button
                    className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50"
                    onClick={async () => {
                      try {
                        await SocialService.unfollowUser(creator.id);
                        setData(prev => (prev as Creator[]).filter(c => c.id !== creator.id));
                        toast.success(`Unfollowed ${getDisplayName(creator)}`);
                      } catch (err) {
                        const e = err instanceof Error ? err : new Error(String(err));
                        toast.error(`Failed to unfollow: ${e.message}`);
                      }
                    }}
                  >
                    Unfollow
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderSavedTab = () => {
    return (
      <div className="space-y-4">
        {savedPitches.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
            <Bookmark className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">You haven't saved any pitches yet</p>
            <button
              onClick={() => navigate('/marketplace')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Browse Marketplace
            </button>
          </div>
        ) : (
          savedPitches.filter(sp => sp && (sp.pitch || sp.pitchId)).map((sp) => {
            const p: any = sp.pitch || {};
            const pitchId = sp.pitchId || p.id;
            return (
              <div
                key={sp.id || pitchId}
                className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/pitch/${pitchId}`)}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Film className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 hover:text-blue-600">
                        {p.title || 'Untitled pitch'}
                      </h4>
                      <Bookmark className="w-4 h-4 text-blue-600 fill-current" />
                    </div>
                    {(p.logline || p.shortSynopsis) && (
                      <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                        {p.logline || p.shortSynopsis}
                      </p>
                    )}
                    <div className="flex items-center flex-wrap gap-2 text-sm text-gray-500">
                      {p.genre && (
                        <span className="px-2 py-1 bg-gray-100 rounded-full">{p.genre}</span>
                      )}
                      {sp.savedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Saved {formatDate(sp.savedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white p-6 rounded-lg">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  void navigate(userType ? `/${getPortalPath(userType)}/dashboard` : '/');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Following</h1>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-600">
                {summary.activeCreators} active creators
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 py-4 px-6 text-center font-medium transition ${
                activeTab === 'activity'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Activity Feed
              </div>
            </button>
            <button
              onClick={() => setActiveTab('followers')}
              className={`flex-1 py-4 px-6 text-center font-medium transition ${
                activeTab === 'followers'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                Followers
              </div>
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`flex-1 py-4 px-6 text-center font-medium transition ${
                activeTab === 'following'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                Following
              </div>
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 py-4 px-6 text-center font-medium transition ${
                activeTab === 'saved'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Bookmark className="w-4 h-4" />
                Saved
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'activity' && renderActivityTab()}
        {activeTab === 'followers' && renderFollowersTab()}
        {activeTab === 'following' && renderFollowingTab()}
        {activeTab === 'saved' && renderSavedTab()}
      </div>
    </div>
  );
};

export default Following;