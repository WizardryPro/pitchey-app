import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2, User, Film, Calendar, MapPin, Globe, Mail, Phone,
  Heart, Eye, Shield, Star, CheckCircle, ArrowLeft, Share2,
  MessageSquare, Bookmark, UserPlus, UserCheck, TrendingUp
} from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import FollowButton from '../components/FollowButton';
import { config } from '../config';
import FormatDisplay from '../components/FormatDisplay';
import { followService } from '../services/follow.service';

interface CreatorData {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email: string;
  phone?: string;
  bio?: string;
  location?: string;
  website?: string;
  userType: 'creator' | 'production' | 'investor';
  joinedDate: string;
  followers: number;
  following: number;
  pitchesCount: number;
  viewsCount: number;
  verified?: boolean;
  profileImage?: string;
  coverImage?: string;
  specialties?: string[];
  awards?: string[];
}

interface CreatorPitch {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  formatCategory?: string;
  formatSubtype?: string;
  status: string;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  ndaRequired: boolean;
}

const CreatorProfile = () => {
  const { creatorId } = useParams();
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  const [creator, setCreator] = useState<CreatorData | null>(null);
  const [pitches, setPitches] = useState<CreatorPitch[]>([]);
  const [activeTab, setActiveTab] = useState<'pitches' | 'about' | 'contact'>('pitches');
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreatorData();
    fetchCreatorPitches();
  }, [creatorId]);

  const fetchCreatorData = async () => {
    if (!creatorId) {
      console.error('No creator ID provided');
      setLoading(false);
      return;
    }
    
    try {
      // Fetch creator profile from users API
      const response = await fetch(`${config.API_URL}/api/users/${creatorId}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const raw = await response.json() as Record<string, unknown>;
        const u = (raw.data as Record<string, unknown>) ?? (raw.user as Record<string, unknown>) ?? raw;
        setCreator({
          id: Number(u.id) || 0,
          username: String(u.username ?? u.email ?? ''),
          firstName: u.first_name as string | undefined ?? u.firstName as string | undefined,
          lastName: u.last_name as string | undefined ?? u.lastName as string | undefined,
          companyName: u.company_name as string | undefined ?? u.companyName as string | undefined,
          email: String(u.email ?? ''),
          phone: u.phone as string | undefined,
          bio: u.bio as string | undefined,
          location: u.location as string | undefined,
          website: u.website as string | undefined,
          userType: (u.user_type ?? u.userType ?? 'creator') as CreatorData['userType'],
          joinedDate: String(u.created_at ?? u.joinedDate ?? ''),
          followers: Number(u.follower_count ?? u.followers) || 0,
          following: Number(u.following_count ?? u.following) || 0,
          pitchesCount: Number(u.pitches_count ?? u.pitchesCount) || 0,
          viewsCount: Number(u.views_count ?? u.viewsCount) || 0,
          verified: Boolean(u.verified),
          profileImage: u.profile_image as string | undefined ?? u.image as string | undefined,
          specialties: Array.isArray(u.specialties) ? u.specialties as string[] : undefined,
          awards: Array.isArray(u.awards) ? u.awards as string[] : undefined,
        });
        // Check if current user follows this creator
        try {
          const following = await followService.isFollowing(creatorId);
          setIsFollowing(following);
        } catch {
          // Non-critical — leave as default false
        }
      } else {
        console.error('Failed to fetch creator:', response.status, response.statusText);
        setCreator(null);
      }
    } catch (error) {
      console.error('Failed to fetch creator data:', error);
      setCreator(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchCreatorPitches = async () => {
    if (!creatorId) return;
    
    try {
      // Fetch creator's published pitches via public search
      const response = await fetch(`${config.API_URL}/api/pitches/public/search?q=*&limit=50&offset=0`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json() as Record<string, unknown>;
        const dataObj = (data.data as Record<string, unknown>) ?? data;
        const allPitches = Array.isArray(dataObj.pitches) ? dataObj.pitches as Record<string, unknown>[] : [];
        // Filter pitches by this creator's ID
        const creatorPitches = allPitches
          .filter(p => String(p.user_id) === String(creatorId))
          .map(p => ({
            id: Number(p.id),
            title: String(p.title ?? ''),
            logline: String(p.logline ?? ''),
            genre: String(p.genre ?? ''),
            format: String(p.format ?? ''),
            formatCategory: p.format_category as string | undefined,
            formatSubtype: p.format_subtype as string | undefined,
            status: String(p.status ?? 'published'),
            viewCount: Number(p.view_count ?? 0),
            likeCount: Number(p.like_count ?? 0),
            createdAt: String(p.created_at ?? ''),
            ndaRequired: Boolean(p.nda_required),
          }));
        setPitches(creatorPitches);
      } else {
        console.error('Failed to fetch creator pitches:', response.status, response.statusText);
        setPitches([]);
      }
    } catch (error) {
      console.error('Failed to fetch creator pitches:', error);
      setPitches([]);
    }
  };

  const handleFollowToggle = async () => {
    const action = isFollowing ? 'unfollow' : 'follow';
    const previous = isFollowing;
    setIsFollowing(!isFollowing); // optimistic
    try {
      await followService.toggleFollow(String(creator?.id ?? ''), action);
    } catch {
      setIsFollowing(previous); // revert on error
    }
  };

  const handleContactCreator = () => {
    // In production, open messaging modal or navigate to messages
    alert('Opening message composer...');
  };

  const handleShareProfile = () => {
    // Copy profile URL to clipboard
    navigator.clipboard.writeText(window.location.href);
    alert('Profile link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Creator Not Found</h2>
          <p className="text-gray-600 mb-4">This creator profile doesn't exist.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Cover Image */}
      <div className="relative h-64 bg-gradient-to-br from-purple-400 via-purple-600 to-indigo-700">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur rounded-lg text-white hover:bg-white/30 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Info */}
      <div className="max-w-6xl mx-auto px-4 -mt-24 relative z-10">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-6">
              {/* Profile Image */}
              <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center text-white">
                {creator.userType === 'production' ? (
                  <Building2 className="w-12 h-12" />
                ) : (
                  <User className="w-12 h-12" />
                )}
              </div>

              {/* Creator Info */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {creator.companyName || `${creator.firstName} ${creator.lastName}`}
                  </h1>
                  {creator.verified && (
                    <CheckCircle className="w-6 h-6 text-blue-500" />
                  )}
                </div>
                <p className="text-gray-600 mb-2">@{creator.username}</p>
                <p className="text-gray-700 max-w-2xl mb-4">{creator.bio}</p>
                
                {/* Stats */}
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="font-bold text-gray-900">{creator.followers.toLocaleString()}</span>
                    <span className="text-gray-600 ml-1">Followers</span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-900">{creator.following}</span>
                    <span className="text-gray-600 ml-1">Following</span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-900">{creator.pitchesCount}</span>
                    <span className="text-gray-600 ml-1">Pitches</span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-900">{creator.viewsCount.toLocaleString()}</span>
                    <span className="text-gray-600 ml-1">Total Views</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <FollowButton
                creatorId={creator.id}
                variant="default"
                className="min-w-[120px]"
              />
              <button
                onClick={handleContactCreator}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Message
              </button>
              <button
                onClick={handleShareProfile}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t mt-6 pt-6">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('pitches')}
                className={`pb-2 border-b-2 font-medium transition-colors ${
                  activeTab === 'pitches'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Pitches ({creator.pitchesCount})
              </button>
              <button
                onClick={() => setActiveTab('about')}
                className={`pb-2 border-b-2 font-medium transition-colors ${
                  activeTab === 'about'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                About
              </button>
              <button
                onClick={() => setActiveTab('contact')}
                className={`pb-2 border-b-2 font-medium transition-colors ${
                  activeTab === 'contact'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Contact
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === 'pitches' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pitches.map((pitch) => (
                <div key={pitch.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center relative">
                    <Film className="w-12 h-12 text-white" />
                    {pitch.ndaRequired && (
                      <span className="absolute top-2 right-2 bg-white/20 backdrop-blur px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        NDA Required
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{pitch.title}</h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{pitch.logline}</p>
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                      <span>{pitch.genre}</span>
                      <FormatDisplay 
                        formatCategory={pitch.formatCategory}
                        formatSubtype={pitch.formatSubtype}
                        format={pitch.format}
                        variant="compact"
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {pitch.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-4 h-4" />
                          {pitch.likeCount}
                        </span>
                      </div>
                      <Link
                        to={`/pitch/${pitch.id}`}
                        className="text-purple-600 hover:text-purple-700"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">About {creator.companyName || `${creator.firstName}`}</h2>
              
              {/* Specialties */}
              {creator.specialties && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {creator.specialties.map((specialty, index) => (
                      <span key={index} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Awards */}
              {creator.awards && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Awards & Recognition</h3>
                  <div className="space-y-2">
                    {creator.awards.map((award, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="text-gray-700">{award}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {new Date(creator.joinedDate).toLocaleDateString()}</span>
                </div>
                {creator.location && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{creator.location}</span>
                  </div>
                )}
                {creator.website && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Globe className="w-4 h-4" />
                    <a href={creator.website} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700">
                      {creator.website}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Contact Information</h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="text-gray-900">{creator.email}</p>
                  </div>
                </div>
                
                {creator.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="text-gray-900">{creator.phone}</p>
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    onClick={handleContactCreator}
                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Send Message
                  </button>
                </div>

                <p className="text-sm text-gray-500 text-center mt-4">
                  All communications are subject to NDA agreements where applicable
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatorProfile;