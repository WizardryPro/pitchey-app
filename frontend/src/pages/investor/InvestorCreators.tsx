import { useState, useEffect } from 'react';
import { 
  Users, Film, Award, TrendingUp, Star,
  Search, Filter, MapPin, Calendar, Eye,
  Heart, MessageSquare, Briefcase, Play,
  ChevronRight, UserPlus, Check, Clock,
  Video, Edit3, Camera, Zap, Target
} from 'lucide-react';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { investorApi } from '@/services/investor.service';

interface Creator {
  id: string;
  name: string;
  avatar?: string;
  role: 'director' | 'writer' | 'producer' | 'writer-director' | 'multi-role';
  location?: string;
  experience: 'emerging' | 'established' | 'veteran';
  followStatus: 'following' | 'not-following';
  bio: string;
  stats: {
    totalPitches: number;
    activePitches: number;
    fundedProjects: number;
    successRate: number;
    totalRaised: number;
    viewCount: number;
    followerCount: number;
  };
  genres: string[];
  skills: string[];
  currentProjects: {
    id: string;
    title: string;
    stage: 'pitch' | 'development' | 'pre-production' | 'production';
    genre: string;
    seekingAmount: number;
    percentageFunded: number;
  }[];
  achievements: {
    title: string;
    type: 'award' | 'festival' | 'milestone';
    year: number;
  }[];
  lastActive?: string;
  verified: boolean;
}

export default function InvestorCreators() {
    const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'director' | 'writer' | 'producer'>('all');
  const [filterExperience, setFilterExperience] = useState<'all' | 'emerging' | 'established' | 'veteran'>('all');
  const [sortBy, setSortBy] = useState<'trending' | 'successRate' | 'followerCount'>('trending');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [filteredCreators, setFilteredCreators] = useState<Creator[]>([]);

  useEffect(() => {
    loadCreators();
  }, []);

  useEffect(() => {
    filterAndSortCreators();
  }, [creators, searchQuery, filterRole, filterExperience, sortBy]);

  const loadCreators = async () => {
    try {
      const response = await investorApi.getCreators();
      if (response.success && response.data) {
        const data = response.data as any;
        const items: any[] = data.creators || [];
        const mapped: Creator[] = items.map((c: any) => ({
          id: String(c.id || ''),
          name: c.name || c.username || 'Unknown',
          avatar: c.avatar_url || c.avatar,
          role: (c.role || c.creator_role || 'multi-role') as Creator['role'],
          location: c.location || '',
          experience: (c.experience || 'emerging') as Creator['experience'],
          followStatus: (c.follow_status || c.followStatus || 'not-following') as 'following' | 'not-following',
          bio: c.bio || '',
          stats: {
            totalPitches: c.total_pitches || c.totalPitches || 0,
            activePitches: c.active_pitches || c.activePitches || 0,
            fundedProjects: c.funded_projects || c.fundedProjects || 0,
            successRate: c.success_rate || c.successRate || 0,
            totalRaised: c.total_raised || c.totalRaised || 0,
            viewCount: c.view_count || c.viewCount || 0,
            followerCount: c.follower_count || c.followerCount || 0
          },
          genres: c.genres || [],
          skills: c.skills || [],
          currentProjects: (c.current_projects || c.currentProjects || []).map((p: any) => ({
            id: String(p.id || ''),
            title: p.title || '',
            stage: (p.stage || 'pitch') as 'pitch' | 'development' | 'pre-production' | 'production',
            genre: p.genre || '',
            seekingAmount: p.seeking_amount || p.seekingAmount || 0,
            percentageFunded: p.percentage_funded || p.percentageFunded || 0
          })),
          achievements: (c.achievements || []).map((a: any) => ({
            title: a.title || '',
            type: (a.type || 'milestone') as 'award' | 'festival' | 'milestone',
            year: a.year || 0
          })),
          lastActive: c.last_active || c.lastActive || '',
          verified: c.verified || false
        }));
        setCreators(mapped);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load creators:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCreators = () => {
    let filtered = [...creators];

    // Filter by role
    if (filterRole !== 'all') {
      filtered = filtered.filter(creator => 
        creator.role.includes(filterRole) || creator.role === 'multi-role'
      );
    }

    // Filter by experience
    if (filterExperience !== 'all') {
      filtered = filtered.filter(creator => creator.experience === filterExperience);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(creator =>
        creator.name.toLowerCase().includes(query) ||
        creator.bio.toLowerCase().includes(query) ||
        creator.genres.some(genre => genre.toLowerCase().includes(query)) ||
        creator.skills.some(skill => skill.toLowerCase().includes(query)) ||
        creator.currentProjects.some(project => project.title.toLowerCase().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'trending':
          return b.stats.viewCount - a.stats.viewCount;
        case 'successRate':
          return b.stats.successRate - a.stats.successRate;
        case 'followerCount':
          return b.stats.followerCount - a.stats.followerCount;
        default:
          return 0;
      }
    });

    setFilteredCreators(filtered);
  };

  const handleFollow = (creatorId: string) => {
    setCreators(prev => prev.map(creator =>
      creator.id === creatorId
        ? { 
            ...creator, 
            followStatus: creator.followStatus === 'following' ? 'not-following' : 'following',
            stats: {
              ...creator.stats,
              followerCount: creator.followStatus === 'following'
                ? (creator.stats?.followerCount ?? 0) - 1
                : (creator.stats?.followerCount ?? 0) + 1
            }
          }
        : creator
    ));
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'director':
        return 'text-purple-600 bg-purple-100';
      case 'writer':
        return 'text-blue-600 bg-blue-100';
      case 'producer':
        return 'text-green-600 bg-green-100';
      case 'writer-director':
        return 'text-indigo-600 bg-indigo-100';
      case 'multi-role':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getExperienceColor = (experience: string) => {
    switch (experience) {
      case 'emerging':
        return 'text-yellow-600 bg-yellow-50';
      case 'established':
        return 'text-blue-600 bg-blue-50';
      case 'veteran':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'pitch':
        return Edit3;
      case 'development':
        return Target;
      case 'pre-production':
        return Camera;
      case 'production':
        return Video;
      default:
        return Film;
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading creators...</div>
        </div>
      </div>
    );
  }

  const followingCount = creators.filter(c => c.followStatus === 'following').length;
  const totalActivePitches = creators.reduce((sum, c) => sum + c.stats.activePitches, 0);
  const verifiedCount = creators.filter(c => c.verified).length;

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Connected Creators</h1>
          <p className="mt-2 text-sm text-gray-600">
            Discover and connect with talented filmmakers and content creators
          </p>
          
          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Heart className="w-8 h-8 text-red-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Following</p>
                  <p className="text-xl font-semibold text-gray-900">{followingCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Film className="w-8 h-8 text-purple-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Active Pitches</p>
                  <p className="text-xl font-semibold text-gray-900">{totalActivePitches}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Check className="w-8 h-8 text-green-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Verified</p>
                  <p className="text-xl font-semibold text-gray-900">{verifiedCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Zap className="w-8 h-8 text-yellow-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Total Creators</p>
                  <p className="text-xl font-semibold text-gray-900">{creators.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  id="creators-search"
                  name="creators-search"
                  placeholder="Search creators, projects, or genres..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Roles</option>
                <option value="director">Directors</option>
                <option value="writer">Writers</option>
                <option value="producer">Producers</option>
              </select>
              <select
                value={filterExperience}
                onChange={(e) => setFilterExperience(e.target.value as any)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Experience</option>
                <option value="emerging">Emerging</option>
                <option value="established">Established</option>
                <option value="veteran">Veteran</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="trending">Trending</option>
                <option value="successRate">Success Rate</option>
                <option value="followerCount">Followers</option>
              </select>
            </div>
          </div>
        </div>

        {/* Creators Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCreators.map((creator) => (
            <div key={creator.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <div className="p-6">
                {/* Creator Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {creator.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold text-gray-900">{creator.name}</h3>
                        {creator.verified && (
                          <Check className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="mt-1 flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(creator.role)}`}>
                          {creator.role.replace('-', ' ')}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getExperienceColor(creator.experience)}`}>
                          {creator.experience}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFollow(creator.id)}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      creator.followStatus === 'following'
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {creator.followStatus === 'following' ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3 mr-1" />
                        Follow
                      </>
                    )}
                  </button>
                </div>

                {/* Creator Info */}
                <p className="text-sm text-gray-600 mb-3">{creator.bio}</p>
                {creator.location && (
                  <div className="flex items-center text-sm text-gray-500 mb-3">
                    <MapPin className="w-3 h-3 mr-1" />
                    {creator.location}
                    {creator.lastActive && (
                      <>
                        <span className="mx-2">•</span>
                        <Clock className="w-3 h-3 mr-1" />
                        Active {creator.lastActive}
                      </>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 py-3 border-y border-gray-200">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900">{creator.stats?.fundedProjects ?? 0}</p>
                    <p className="text-xs text-gray-500">Funded</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-purple-600">{creator.stats?.activePitches ?? 0}</p>
                    <p className="text-xs text-gray-500">Active</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-green-600">{creator.stats?.successRate ?? 0}%</p>
                    <p className="text-xs text-gray-500">Success</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900">{creator.stats?.followerCount ?? 0}</p>
                    <p className="text-xs text-gray-500">Followers</p>
                  </div>
                </div>

                {/* Specializations */}
                <div className="mt-3">
                  <div className="flex flex-wrap gap-1">
                    {creator.genres.map((genre, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Current Projects */}
                {creator.currentProjects.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-2">Current Projects</p>
                    {creator.currentProjects.slice(0, 2).map((project) => {
                      const StageIcon = getStageIcon(project.stage);
                      return (
                        <div key={project.id} className="mb-2 p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <StageIcon className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{project.title}</p>
                                <p className="text-xs text-gray-500">
                                  {project.genre} • {project.stage}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Seeking</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {formatCurrency(project.seekingAmount)}
                              </p>
                              <div className="mt-1 w-20 bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-green-500 h-1.5 rounded-full"
                                  style={{ width: `${project.percentageFunded}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{project.percentageFunded}% funded</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Achievements */}
                {creator.achievements.length > 0 && (
                  <div className="mt-3 flex items-center space-x-3">
                    {creator.achievements.slice(0, 2).map((achievement, idx) => (
                      <div key={idx} className="flex items-center text-xs text-gray-600">
                        <Award className="w-3 h-3 text-yellow-500 mr-1" />
                        <span>{achievement.title}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3 text-sm">
                    <button className="flex items-center text-gray-600 hover:text-green-600">
                      <Eye className="w-4 h-4 mr-1" />
                      {creator.stats.viewCount.toLocaleString()}
                    </button>
                    <button className="flex items-center text-gray-600 hover:text-green-600">
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Message
                    </button>
                  </div>
                  <button className="text-green-600 hover:text-purple-700 text-sm font-medium">
                    View Profile →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredCreators.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No creators found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}