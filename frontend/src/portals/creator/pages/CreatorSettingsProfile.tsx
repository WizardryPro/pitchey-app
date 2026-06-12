import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Camera, Mail, Phone, MapPin, Globe, Film,
  FileSignature, Save, X, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { toast } from 'react-hot-toast';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { sessionManager } from '@/lib/session-manager';
import { sessionCache } from '@/store/sessionCache';
import { UserService } from '@/services/user.service';
import { API_URL } from '@/config';
import { prepareImageForUpload, PRE_COMPRESSION_MAX_BYTES } from '@/utils/imageUpload';

// Creator-facing profile settings. A creator is an individual filmmaker, so this
// leads with personal identity and a creative statement (the pitch investors and
// producers read), not company branding. Every field maps to a real `users`
// column persisted by PUT /api/user/profile.
interface CreatorProfileForm {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  bio: string;           // Creative statement
  website: string;       // Portfolio / website
  phone: string;
  location: string;
  companyAddress: string; // Used as address on NDAs
  profileImage: string;
}

const EMPTY: CreatorProfileForm = {
  username: '', firstName: '', lastName: '', email: '', bio: '',
  website: '', phone: '', location: '', companyAddress: '', profileImage: '',
};

const BRAND = '#7B3FBF';

export default function CreatorSettingsProfile() {
  const navigate = useNavigate();
  const { user, checkSession } = useBetterAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState<CreatorProfileForm>(EMPTY);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/api/user/profile`, {
          method: 'GET',
          credentials: 'include',
        });
        if (response.ok) {
          const raw = await response.json() as Record<string, unknown>;
          const d = (raw['data'] ?? raw['user'] ?? raw) as Record<string, unknown>;
          setForm({
            username: (d.username as string) ?? '',
            firstName: (d.firstName as string) ?? '',
            lastName: (d.lastName as string) ?? '',
            email: (d.email as string) ?? '',
            bio: (d.bio as string) ?? '',
            website: (d.website as string) ?? '',
            phone: (d.phone as string) ?? '',
            location: (d.location as string) ?? '',
            companyAddress: (d.companyAddress as string) ?? '',
            profileImage: (d.profileImage as string) ?? '',
          });
        } else if (user) {
          setForm(prev => ({
            ...prev,
            username: user.username ?? '',
            email: user.email ?? '',
            bio: user.bio ?? '',
          }));
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to load creator profile:', e.message);
      } finally {
        setLoading(false);
      }
    };
    void fetchProfile();
  }, [user]);

  const set = (field: keyof CreatorProfileForm, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const refreshSession = async () => {
    // Same sequence Settings.tsx uses (the #280 fix): clear the dedup cache,
    // re-check the session, then re-write the localStorage cache with the fresh
    // user so a refresh inside the 5-min TTL doesn't surface the stale username.
    sessionManager.clearCache();
    await checkSession();
    const freshUser = useBetterAuthStore.getState().user;
    if (freshUser) sessionCache.set(freshUser);
  };

  const handleSave = async () => {
    const username = form.username.trim().toLowerCase();
    if (username && username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }
    const email = form.email.trim().toLowerCase();
    const originalEmail = (user?.email ?? '').trim().toLowerCase();
    setSaving(true);
    try {
      await UserService.updateProfile({
        username: username || undefined,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        email: email && email !== originalEmail ? email : undefined,
        bio: form.bio,
        website: form.website,
        phone: form.phone,
        location: form.location,
        companyAddress: form.companyAddress,
      });
      await refreshSession();
      toast.success('Profile updated');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > PRE_COMPRESSION_MAX_BYTES) {
      toast.error('File too large. Please pick an image under 30MB.');
      return;
    }
    setUploadingImage(true);
    try {
      const compressed = await prepareImageForUpload(file, 'avatar');
      const formData = new FormData();
      formData.append('file', compressed);
      formData.append('folder', 'profiles');
      const uploadRes = await fetch(`${API_URL}/api/upload/profile`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ message: 'Upload failed' })) as { message?: string };
        throw new Error(err.message || 'Upload failed');
      }
      const { url } = await uploadRes.json() as { url: string };
      await UserService.updateProfile({ profileImage: url });
      setForm(prev => ({ ...prev, profileImage: url }));
      await refreshSession();
      toast.success('Photo updated');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const initials = (form.firstName && form.lastName)
    ? `${form.firstName[0]}${form.lastName[0]}`.toUpperCase()
    : (form.username ? form.username.slice(0, 2).toUpperCase() : 'CR');

  const inputCls = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7B3FBF] focus:border-transparent';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Creator Profile</h1>
          <p className="mt-2 text-gray-600">
            Your identity and creative statement — what investors and producers see when they find your work.
          </p>
        </div>

        <div className="space-y-6">
          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Identity
              </CardTitle>
              <CardDescription>How you appear across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <div className="relative w-20 h-20 rounded-full border-2 border-gray-200 overflow-hidden shrink-0">
                  {form.profileImage ? (
                    <img src={form.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#7B3FBF] to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                      {initials}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 hover:opacity-100 transition-opacity"
                    aria-label="Change profile photo"
                  >
                    {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  <p>Profile photo</p>
                  <p className="text-xs">JPG, PNG or HEIC. Square works best.</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { void handleImageUpload(e); }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => set('username', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    placeholder="your-username"
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-500 mt-1">Letters, numbers, dots, hyphens, underscores. Min 3 characters. Must be unique.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input type="text" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input type="text" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="inline w-4 h-4 mr-2" />Email
                  </label>
                  <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
                  <p className="text-xs text-gray-500 mt-1">This is the email you sign in with.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Work */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="h-5 w-5" />
                Your Work
              </CardTitle>
              <CardDescription>Your creative statement and where to see more</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">About Your Work</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => set('bio', e.target.value)}
                  rows={4}
                  placeholder="Your style, the genres you work in, notable projects and what you're building toward. Investors and producers read this before they back you."
                  className={inputCls}
                />
                <p className="text-xs text-gray-500 mt-1">Shown on your public creator profile.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Globe className="inline w-4 h-4 mr-2" />Portfolio / Website
                </label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => set('website', e.target.value)}
                  placeholder="https://your-portfolio.com"
                  className={inputCls}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact & Legal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                Contact &amp; Legal
              </CardTitle>
              <CardDescription>How you're reached, and the address used on NDAs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="inline w-4 h-4 mr-2" />Phone
                  </label>
                  <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="inline w-4 h-4 mr-2" />Location
                  </label>
                  <input type="text" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="City, Country" className={inputCls} />
                </div>
              </div>
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Address</label>
                <textarea
                  value={form.companyAddress}
                  onChange={(e) => set('companyAddress', e.target.value)}
                  rows={2}
                  placeholder="e.g. 12 Example St, Dublin, D02 XY00, Ireland"
                  className={inputCls}
                />
                <p className="text-xs text-gray-500 mt-1">Used as your address when you sign NDAs.</p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <button
                  onClick={() => { void handleSave(); }}
                  disabled={saving}
                  className="flex-1 px-6 py-3 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: BRAND }}
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Changes
                </button>
                <button
                  onClick={() => navigate('/creator/settings')}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
