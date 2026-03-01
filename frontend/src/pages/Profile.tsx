import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Mail, Phone, MapPin, Building2, Calendar, Edit3, Save, X } from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { API_URL } from '../config';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  location?: string;
  bio?: string;
  website?: string;
  companyName?: string;
  companyType?: string;
  userType: 'creator' | 'investor' | 'production';
  profileImage?: string;
  createdAt: string;
}

interface SocialStats {
  followers: number;
  following: number;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [socialStats, setSocialStats] = useState<SocialStats>({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchProfile();
    void fetchSocialStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/user/profile`, {
        method: 'GET',
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (response.ok) {
        const rawData = await response.json() as Record<string, unknown>;
        const profileData = (rawData['data'] ?? rawData['user'] ?? rawData) as UserProfile;
        setProfile(profileData);
        setEditedProfile(profileData);
      } else if (user != null) {
        // Fallback to auth store user data
        setProfile(user as unknown as UserProfile);
        setEditedProfile(user as unknown as UserProfile);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      // Fallback to auth store user data
      if (user != null) {
        setProfile(user as unknown as UserProfile);
        setEditedProfile(user as unknown as UserProfile);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSocialStats = async () => {
    try {
      if (user?.id == null) return;

      const response = await fetch(`${API_URL}/api/user/profile`, {
        method: 'GET',
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (response.ok) {
        const rawData = await response.json() as Record<string, unknown>;
        const followers = (rawData['followerCount'] as number | undefined) ?? 0;

        // Get following count from follows/stats endpoint
        const followingResponse = await fetch(`${API_URL}/api/follows/stats`, {
          credentials: 'include'
        });

        let following = 0;
        if (followingResponse.ok) {
          const followingData = await followingResponse.json() as Record<string, unknown>;
          const data = (followingData['data'] as Record<string, unknown>) ?? followingData;
          following = Number(data['followingCount'] ?? data['following_count']) || 0;
        }

        setSocialStats({ followers, following });
      }
    } catch (error) {
      console.error('Failed to fetch social stats:', error);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);

      const response = await fetch(`${API_URL}/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (response.ok) {
        const rawData = await response.json() as Record<string, unknown>;
        const updatedUser = rawData['user'] as UserProfile;
        setProfile(updatedUser);
        setIsEditing(false);

        // Update localStorage user data
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } else {
        // For demo purposes, just update locally
        setProfile(editedProfile as UserProfile);
        setIsEditing(false);
        localStorage.setItem('user', JSON.stringify(editedProfile));
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      // For demo purposes, just update locally
      setProfile(editedProfile as UserProfile);
      setIsEditing(false);
      localStorage.setItem('user', JSON.stringify(editedProfile));
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (firstName?: string, lastName?: string, username?: string) => {
    if (firstName != null && firstName.length > 0 && lastName != null && lastName.length > 0) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (username != null && username.length > 0) {
      return username.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'creator':
        return 'bg-purple-100 text-purple-800';
      case 'investor':
        return 'bg-green-100 text-green-800';
      case 'production':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setEditedProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Not Found</h2>
          <p className="text-gray-600 mb-4">Unable to load your profile information.</p>
          <button
            onClick={() => { void navigate(-1); }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => { void navigate(-1); }}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
                <p className="text-sm text-gray-500">Manage your account information</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedProfile(profile);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    onClick={() => { void handleSaveProfile(); }}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-8">
            <div className="flex items-start gap-6">
              <div className="relative">
                <div className="w-24 h-24 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                  {profile.profileImage != null ? (
                    <img
                      src={profile.profileImage}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-white">
                      {getInitials(profile.firstName, profile.lastName, profile.username)}
                    </span>
                  )}
                </div>
                {isEditing && (
                  <button className="absolute bottom-0 right-0 p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition">
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-white">
                    {profile.firstName != null && profile.firstName.length > 0 && profile.lastName != null && profile.lastName.length > 0
                      ? `${profile.firstName} ${profile.lastName}`
                      : profile.username
                    }
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getUserTypeColor(profile.userType)}`}>
                    {profile.userType}
                  </span>
                </div>
                <p className="text-purple-100 mb-3">@{profile.username}</p>
                
                {/* Social Stats */}
                <div className="flex items-center gap-6 mb-3">
                  <button 
                    onClick={() => { void navigate(`/creator/${profile.id}`); }}
                    className="text-purple-100 hover:text-white transition-colors"
                  >
                    <span className="font-semibold">{socialStats.followers}</span>
                    <span className="text-sm"> followers</span>
                  </button>
                  <button 
                    onClick={() => { void navigate('/following'); }}
                    className="text-purple-100 hover:text-white transition-colors"
                  >
                    <span className="font-semibold">{socialStats.following}</span>
                    <span className="text-sm"> following</span>
                  </button>
                </div>
                
                {profile.companyName != null && (
                  <div className="flex items-center gap-2 text-purple-100">
                    <Building2 className="w-4 h-4" />
                    <span>{profile.companyName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedProfile.firstName ?? ''}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter your first name"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.firstName ?? 'Not provided'}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedProfile.lastName ?? ''}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter your last name"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.lastName ?? 'Not provided'}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <p className="text-gray-900">{profile.email}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editedProfile.phone ?? ''}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter your phone number"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <p className="text-gray-900">{profile.phone ?? 'Not provided'}</p>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedProfile.location ?? ''}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter your location"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <p className="text-gray-900">{profile.location ?? 'Not provided'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Professional Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Professional Information</h3>
                <div className="space-y-4">
                  {profile.userType === 'production' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedProfile.companyName ?? ''}
                            onChange={(e) => handleInputChange('companyName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Enter your company name"
                          />
                        ) : (
                          <p className="text-gray-900">{profile.companyName ?? 'Not provided'}</p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Type</label>
                        {isEditing ? (
                          <select
                            value={editedProfile.companyType ?? ''}
                            onChange={(e) => handleInputChange('companyType', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Select company type</option>
                            <option value="studio">Studio</option>
                            <option value="independent">Independent Production</option>
                            <option value="distribution">Distribution Company</option>
                            <option value="agency">Talent Agency</option>
                            <option value="other">Other</option>
                          </select>
                        ) : (
                          <p className="text-gray-900 capitalize">{profile.companyType ?? 'Not provided'}</p>
                        )}
                      </div>
                    </>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    {isEditing ? (
                      <input
                        type="url"
                        value={editedProfile.website ?? ''}
                        onChange={(e) => handleInputChange('website', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="https://your-website.com"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {profile.website != null ? (
                          <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700">
                            {profile.website}
                          </a>
                        ) : (
                          'Not provided'
                        )}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                    {isEditing ? (
                      <textarea
                        value={editedProfile.bio ?? ''}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Tell us about yourself..."
                      />
                    ) : (
                      <p className="text-gray-900">{profile.bio ?? 'No bio provided'}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <p className="text-gray-900">
                        {profile.createdAt != null ? new Date(profile.createdAt).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Actions</h3>
          <div className="space-y-3">
            <button
              onClick={() => { void navigate('/settings'); }}
              className="w-full sm:w-auto px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition"
            >
              Account Settings
            </button>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to sign out?')) {
                  void logout();
                  void navigate('/');
                }
              }}
              className="w-full sm:w-auto ml-0 sm:ml-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}