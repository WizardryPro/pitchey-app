import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface ProfileStats {
  totalWorks: number;
  totalViews: number;
  totalFollowers: number;
  avgRating?: number;
  successRate?: number;
}

interface UserProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  location: string;
  joinedDate: string;
  verified?: boolean;
  userType: 'creator' | 'production' | 'investor';
  companyName?: string;
  stats: ProfileStats;
  socialLinks?: {
    website?: string;
    twitter?: string;
    linkedin?: string;
  };
}

interface ProfileHeaderProps {
  profile: UserProfile;
  isOwnProfile?: boolean;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profile, isOwnProfile = false }) => {
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(profile.stats.totalFollowers);

  const handleFollowToggle = async () => {
    try {
      // Toggle follow state
      setIsFollowing(!isFollowing);
      setFollowersCount(prev => isFollowing ? prev - 1 : prev + 1);
      
      // Here you would make an API call to update the follow status
      // const response = await api.post(`/api/user/${profile.id}/follow`);
    } catch (error) {
      console.error('Failed to toggle follow:', error);
      // Revert on error
      setIsFollowing(isFollowing);
      setFollowersCount(profile.stats.totalFollowers);
    }
  };

  const handleEditProfile = () => {
    void navigate('/profile');
  };

  // Get display text based on user type
  const getWorkLabel = () => {
    switch (profile.userType) {
      case 'production':
        return 'Projects';
      case 'investor':
        return 'Investments';
      default:
        return 'Pitches';
    }
  };

  const getRatingLabel = () => {
    if (profile.userType === 'production' && profile.stats.successRate !== undefined) {
      return `${profile.stats.successRate}% Success`;
    }
    if (profile.stats.avgRating !== undefined) {
      return `${profile.stats.avgRating.toFixed(1)} Rating`;
    }
    return null;
  };

  const getUserTypeLabel = () => {
    switch (profile.userType) {
      case 'production':
        return 'Production Company';
      case 'investor':
        return 'Investor';
      default:
        return 'Creator';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8 mb-6 md:mb-0">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="relative">
              <img 
                src={profile.avatar} 
                alt={profile.name}
                className="w-32 h-32 rounded-full object-cover border-4 border-purple-100"
              />
              {profile.verified && (
                <div className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-gray-900">
                {profile.companyName || profile.name}
              </h1>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                {getUserTypeLabel()}
              </span>
            </div>
            <p className="text-gray-500 mb-4">@{profile.username}</p>
            
            {profile.bio && (
              <p className="text-gray-700 mb-4 max-w-2xl">
                {profile.bio}
              </p>
            )}
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              {profile.location && (
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/>
                  </svg>
                  {profile.location}
                </span>
              )}
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"/>
                </svg>
                Joined {profile.joinedDate}
              </span>
              {profile.socialLinks?.website && (
                <a 
                  href={profile.socialLinks.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center hover:text-purple-600 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z"/>
                    <path d="M10 4a6 6 0 100 12 6 6 0 000-12zm0 10.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"/>
                  </svg>
                  Website
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3">
          {isOwnProfile ? (
            <button 
              onClick={handleEditProfile}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Edit Profile
            </button>
          ) : (
            <button 
              onClick={handleFollowToggle}
              className={`px-6 py-3 rounded-lg transition-colors font-medium ${
                isFollowing 
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 pt-8 border-t">
        <div>
          <div className="text-3xl font-bold text-gray-900">
            {profile.stats.totalWorks}
          </div>
          <div className="text-gray-500">{getWorkLabel()}</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-gray-900">
            {(profile.stats.totalViews / 1000).toFixed(1)}K
          </div>
          <div className="text-gray-500">Total Views</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-gray-900">
            {followersCount}
          </div>
          <div className="text-gray-500">Followers</div>
        </div>
        {getRatingLabel() && (
          <div>
            <div className="text-3xl font-bold text-gray-900">
              {profile.stats.avgRating ? profile.stats.avgRating.toFixed(1) : `${profile.stats.successRate}%`}
            </div>
            <div className="text-gray-500">
              {profile.stats.avgRating ? 'Avg Rating' : 'Success Rate'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;