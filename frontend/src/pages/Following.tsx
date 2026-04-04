import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Users, Film, Calendar, MapPin, Eye, Heart, AlertCircle, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_URL } from '../config';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { SocialService } from '@features/browse/services/social.service';

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
  type: 'pitch_created' | 'pitch_updated' | 'new_follower';
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
  };
  createdAt: string;
}

const Following: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = (['activity', 'followers', 'following'] as const).includes(searchParams.get('tab') as any)
    ? (searchParams.get('tab') as 'activity' | 'followers' | 'following')
    : 'followers';
  const [activeTab, setActiveTab] = useState<'activity' | 'followers' | 'following'>(initialTab);
  const [data, setData] = useState<(Creator[] | ActivityUpdate[])>([]);
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

    try {
      // Note: Better Auth uses cookies, not localStorage tokens
      // The route protection in App.tsx handles unauthenticated users

      let endpoint: string;
      
      // Use different endpoints based on the active tab
      if (activeTab === 'activity') {
        endpoint = '/api/pitches/following';
      } else if (activeTab === 'followers') {
        endpoint = '/api/follows/followers';
      } else if (activeTab === 'following') {
        endpoint = '/api/follows/following';
      } else {
        endpoint = '/api/follows/following'; // default
      }
      
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = timeframe && timeframe !== 'all' ? `${API_URL}${endpoint}${separator}timeframe=${timeframe}` : `${API_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) {
        throw new Error('Failed to fetch following data');
      }

      const result = await response.json();
      
      if (result.success) {
        // Handle different response formats based on the tab
        if (activeTab === 'activity') {
          // Transform pitches from followed creators into activity items
          const pitches = result.data?.pitches || result.pitches || result.data || [];
          const activities = pitches.map((p: any) => ({
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
            },
            createdAt: p.created_at || p.createdAt || '',
          }));
          setData(activities);
        } else if (activeTab === 'followers') {
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
    return new Date(dateString).toLocaleDateString('en-US', {
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
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="px-2 py-1 bg-gray-100 rounded-full">
                            {update.pitch.genre}
                          </span>
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
                  const dashboardRoute = userType === 'creator' ? '/creator/dashboard' :
                                       userType === 'investor' ? '/investor/dashboard' :
                                       userType === 'production' ? '/production/dashboard' :
                                       '/';
                  navigate(dashboardRoute);
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
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'activity' && renderActivityTab()}
        {activeTab === 'followers' && renderFollowersTab()}
        {activeTab === 'following' && renderFollowingTab()}
      </div>
    </div>
  );
};

export default Following;