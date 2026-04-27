import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Save, X, Lock, Eye, EyeOff,
  Twitter, Linkedin, Instagram, Youtube
} from 'lucide-react';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { sessionManager } from '../../lib/session-manager';
import { UserService } from '../../services/user.service';
import { toast } from 'react-hot-toast';

interface ProfileData {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  bio: string;
  company: string;
  position: string;
  location: string;
  website: string;
  socialLinks: {
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
  };
  avatar?: string;
  coverImage?: string;
}

export default function SettingsProfile() {
  const navigate = useNavigate();
  const { user, checkSession } = useBetterAuthStore();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({ current: false, next: false });
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    bio: '',
    company: '',
    position: '',
    location: '',
    website: '',
    socialLinks: {}
  });

  // Pre-populate form from user store data
  useEffect(() => {
    if (user) {
      const nameParts = (user.name || user.username || '').split(' ');
      setProfileData({
        firstName: (user as any).firstName || nameParts[0] || '',
        lastName: (user as any).lastName || nameParts.slice(1).join(' ') || '',
        username: user.username || '',
        email: user.email || '',
        phone: (user as any).phone || '',
        bio: (user as any).bio || '',
        company: (user as any).professionalInfo?.company || (user as any).companyName || '',
        position: (user as any).professionalInfo?.position || '',
        location: (user as any).location || '',
        website: (user as any).website || '',
        socialLinks: (user as any).socialLinks || {},
        avatar: (user as any).profileImage || (user as any).image || undefined,
        coverImage: (user as any).coverImage || undefined
      });
    }
  }, [user]);

  const handleInputChange = (field: keyof ProfileData | string, value: string) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setProfileData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof ProfileData] as any),
          [child]: value
        }
      }));
    } else {
      setProfileData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const fullName = `${profileData.firstName} ${profileData.lastName}`.trim();
      const originalEmail = (user?.email || '').trim().toLowerCase();
      const newEmail = profileData.email.trim().toLowerCase();
      const emailChanged = !!newEmail && newEmail !== originalEmail;

      await UserService.updateProfile({
        name: fullName || undefined,
        username: profileData.username || undefined,
        email: emailChanged ? newEmail : undefined,
        phone: profileData.phone || undefined,
        bio: profileData.bio || undefined,
        location: profileData.location || undefined,
        website: profileData.website || undefined,
        socialLinks: profileData.socialLinks,
        professionalInfo: {
          company: profileData.company || undefined,
          position: profileData.position || undefined
        }
      });
      // Bypass the 60s sessionManager cache so we re-fetch the freshly-updated user
      sessionManager.clearCache();
      await checkSession();
      toast.success('Profile updated successfully!');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (type: 'avatar' | 'cover') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const imageUrl = type === 'avatar'
          ? await UserService.uploadProfileImage(file)
          : await UserService.uploadCoverImage(file);

        setProfileData(prev => ({
          ...prev,
          [type === 'avatar' ? 'avatar' : 'coverImage']: imageUrl
        }));
        sessionManager.clearCache();
        await checkSession();
        toast.success(`${type === 'avatar' ? 'Profile' : 'Cover'} image updated!`);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        toast.error(e.message || `Failed to upload ${type} image`);
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setPasswordLoading(true);
    try {
      await UserService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      });
      toast.success('Password changed');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cover Image */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="relative h-48 bg-gradient-to-r from-purple-500 to-indigo-600">
            {profileData.coverImage && (
              <img src={profileData.coverImage} alt="Cover" className="w-full h-full object-cover" />
            )}
            <button
              onClick={() => handleImageUpload('cover')}
              disabled={uploading}
              className="absolute bottom-4 right-4 px-4 py-2 bg-white/90 backdrop-blur text-gray-700 rounded-lg hover:bg-white transition flex items-center gap-2 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              Change Cover
            </button>
          </div>

          {/* Avatar and Basic Info */}
          <div className="px-8 pb-8">
            <div className="flex items-end -mt-12 mb-6">
              <div className="relative">
                <div className="w-24 h-24 bg-white rounded-full border-4 border-white overflow-hidden">
                  {profileData.avatar ? (
                    <img src={profileData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                      {profileData.firstName[0]}{profileData.lastName[0]}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleImageUpload('avatar')}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 p-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition disabled:opacity-50"
                >
                  <Camera className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={profileData.username}
                      onChange={(e) => handleInputChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="your-username"
                    />
                    <p className="text-xs text-gray-500 mt-1">Letters, numbers, dots, hyphens, underscores. Min 3 characters.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="you@example.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">Changing this updates the email you sign in with.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="+1 555 123 4567"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={profileData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={profileData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </div>

              {/* Professional Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Professional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                    <input
                      type="text"
                      value={profileData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                    <input
                      type="text"
                      value={profileData.position}
                      onChange={(e) => handleInputChange('position', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={profileData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      placeholder="https://your-website.com"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Media</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Twitter className="inline w-4 h-4 mr-1" />
                      Twitter
                    </label>
                    <input
                      type="text"
                      value={profileData.socialLinks.twitter || ''}
                      onChange={(e) => handleInputChange('socialLinks.twitter', e.target.value)}
                      placeholder="@username"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Linkedin className="inline w-4 h-4 mr-1" />
                      LinkedIn
                    </label>
                    <input
                      type="text"
                      value={profileData.socialLinks.linkedin || ''}
                      onChange={(e) => handleInputChange('socialLinks.linkedin', e.target.value)}
                      placeholder="linkedin.com/in/username"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Instagram className="inline w-4 h-4 mr-1" />
                      Instagram
                    </label>
                    <input
                      type="text"
                      value={profileData.socialLinks.instagram || ''}
                      onChange={(e) => handleInputChange('socialLinks.instagram', e.target.value)}
                      placeholder="@username"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Youtube className="inline w-4 h-4 mr-1" />
                      YouTube
                    </label>
                    <input
                      type="text"
                      value={profileData.socialLinks.youtube || ''}
                      onChange={(e) => handleInputChange('socialLinks.youtube', e.target.value)}
                      placeholder="youtube.com/@username"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Change Password
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        autoComplete="current-password"
                        className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter your current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(p => ({ ...p, current: !p.current }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-700"
                        aria-label={showPasswords.current ? 'Hide password' : 'Show password'}
                      >
                        {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showPasswords.next ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        autoComplete="new-password"
                        className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="At least 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(p => ({ ...p, next: !p.next }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-700"
                        aria-label={showPasswords.next ? 'Hide password' : 'Show password'}
                      >
                        {showPasswords.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <input
                      type={showPasswords.next ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      autoComplete="new-password"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleChangePassword}
                    disabled={passwordLoading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {passwordLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    Update Password
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Changes
                    </>
                  )}
                </button>

                <button
                  onClick={() => navigate(-1)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
