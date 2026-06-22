import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Camera, Mail, Phone, MapPin, Globe, Building2,
  TrendingUp, FileSignature, Save, X, Loader2, Target, Plus,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { toast } from 'react-hot-toast';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { sessionManager } from '@/lib/session-manager';
import { sessionCache } from '@/store/sessionCache';
import { UserService } from '@/services/user.service';
import { InvestorThesisService, EMPTY_THESIS, type InvestorThesis } from '@/services/investor-thesis.service';
import { getGenres, getFormats, getStages, getGenresSync, getFormatsSync, getStagesSync } from '@config/pitchConstants';
import { API_URL } from '@/config';
import { prepareImageForUpload, PRE_COMPRESSION_MAX_BYTES } from '@/utils/imageUpload';

// Deal types are a fixed small platform set (not part of the pitch taxonomy).
// Stored lower-cased; displayed title-cased.
const DEAL_TYPES = ['option', 'acquisition', 'licensing', 'development', 'production'] as const;
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Investor-facing profile settings. Deliberately NOT a clone of the production
// company page — an investor cares about their fund identity, the thesis
// creators/producers read before pitching, and the legal address that lands on
// NDAs. Every field here maps to a real `users` column persisted by
// PUT /api/user/profile; nothing decorative.
interface InvestorProfileForm {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;   // Fund / firm name
  website: string;       // Firm website
  phone: string;
  location: string;
  companyAddress: string; // Used as address on NDAs
  profileImage: string;
}

const EMPTY: InvestorProfileForm = {
  username: '', firstName: '', lastName: '', email: '', companyName: '',
  website: '', phone: '', location: '', companyAddress: '', profileImage: '',
};

// Chip-style multi-select — matches the marketplace genre-chip pattern.
function ChipMultiSelect({
  options, selected, onToggle,
}: { options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              active
                ? 'bg-[#5B4FC7] text-white border-[#5B4FC7]'
                : 'bg-white text-gray-700 border-gray-300 hover:border-[#5B4FC7]'
            }`}
            aria-pressed={active}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// Free-text tag input (Enter / comma adds; click x removes) for territories & themes.
function TagInput({
  tags, onChange, placeholder,
}: { tags: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-[#5B4FC7] text-sm border border-indigo-200">
            {t}
            <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} aria-label={`Remove ${t}`}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
          }}
          placeholder={placeholder}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B4FC7] focus:border-transparent"
        />
        <button
          type="button"
          onClick={commit}
          className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
    </div>
  );
}

export default function InvestorSettingsProfile() {
  const navigate = useNavigate();
  const { user, checkSession } = useBetterAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingThesis, setSavingThesis] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState<InvestorProfileForm>(EMPTY);

  // Structured investment mandate — separate resource from the profile above.
  const [thesis, setThesis] = useState<InvestorThesis>(EMPTY_THESIS);

  // Taxonomy lists — SAME source the pitch CREATE form uses (configService via
  // @config/pitchConstants). Seed synchronously from the cached/fallback config,
  // then refresh from the API.
  const [genreOptions, setGenreOptions] = useState<string[]>([...getGenresSync()]);
  const [formatOptions, setFormatOptions] = useState<string[]>([...getFormatsSync()]);
  const [stageOptions, setStageOptions] = useState<string[]>([...getStagesSync()]);

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const [g, f, s] = await Promise.all([getGenres(), getFormats(), getStages()]);
        setGenreOptions(g);
        setFormatOptions(f);
        setStageOptions(s);
      } catch {
        // Already seeded with sync fallback values.
      }
    };
    void loadTaxonomy();
  }, []);

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
            companyName: (d.companyName as string) ?? '',
            website: (d.website as string) ?? '',
            phone: (d.phone as string) ?? '',
            location: (d.location as string) ?? '',
            companyAddress: (d.companyAddress as string) ?? '',
            profileImage: (d.profileImage as string) ?? '',
          });
        } else if (user) {
          // Fall back to the auth-store snapshot if the fetch 401s/5xxs.
          setForm(prev => ({
            ...prev,
            username: user.username ?? '',
            email: user.email ?? '',
            companyName: user.companyName ?? '',
          }));
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to load investor profile:', e.message);
      } finally {
        setLoading(false);
      }
    };
    void fetchProfile();
  }, [user]);

  // Load the structured thesis independently of the profile.
  useEffect(() => {
    const fetchThesis = async () => {
      try {
        const t = await InvestorThesisService.getThesis();
        setThesis(t);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to load investment thesis:', e.message);
      }
    };
    void fetchThesis();
  }, []);

  const set = (field: keyof InvestorProfileForm, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // Toggle a value in one of the thesis multi-select arrays.
  const toggleThesisArray = (
    field: 'genres' | 'formats' | 'stages' | 'dealTypes',
    value: string,
  ) =>
    setThesis(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }));

  // Parse a numeric input into number|null (empty → null), clamped non-negative.
  const setThesisNum = (
    field: 'budgetMinUsd' | 'budgetMaxUsd' | 'checkSizeMinUsd' | 'checkSizeMaxUsd',
    raw: string,
  ) => {
    const digits = raw.replace(/[^0-9]/g, '');
    setThesis(prev => ({ ...prev, [field]: digits ? Number(digits) : null }));
  };

  const handleSaveThesis = async () => {
    setSavingThesis(true);
    try {
      const saved = await InvestorThesisService.updateThesis(thesis);
      setThesis(saved);
      toast.success('Investment thesis saved');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to save investment thesis');
    } finally {
      setSavingThesis(false);
    }
  };

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
        companyName: form.companyName,
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
    : (form.username ? form.username.slice(0, 2).toUpperCase() : 'IN');

  const inputCls = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B4FC7] focus:border-transparent';

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
          <h1 className="text-2xl font-bold text-gray-900">Investor Profile</h1>
          <p className="mt-2 text-gray-600">
            Your identity and investment thesis — what creators and producers see when you reach out.
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
                    <div className="w-full h-full bg-gradient-to-br from-[#5B4FC7] to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
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

          {/* Investor Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Investment Profile
              </CardTitle>
              <CardDescription>Your fund and what you back</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building2 className="inline w-4 h-4 mr-2" />Fund / Firm Name
                  </label>
                  <input
                    type="text"
                    value={form.companyName}
                    onChange={(e) => set('companyName', e.target.value)}
                    placeholder="e.g. Thompson Ventures"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Globe className="inline w-4 h-4 mr-2" />Firm Website
                  </label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => set('website', e.target.value)}
                    placeholder="https://yourfund.com"
                    className={inputCls}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Investment Thesis (structured mandate) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Investment Thesis
              </CardTitle>
              <CardDescription>
                Your structured mandate — what you back, at what stage, and for how much.
                Creators and producers read this before they pitch you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Genres</label>
                  <ChipMultiSelect
                    options={genreOptions}
                    selected={thesis.genres}
                    onToggle={(v) => toggleThesisArray('genres', v)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Formats</label>
                  <ChipMultiSelect
                    options={formatOptions}
                    selected={thesis.formats}
                    onToggle={(v) => toggleThesisArray('formats', v)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Development Stages</label>
                  <ChipMultiSelect
                    options={stageOptions}
                    selected={thesis.stages}
                    onToggle={(v) => toggleThesisArray('stages', v)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deal Types</label>
                  <ChipMultiSelect
                    options={DEAL_TYPES.map(titleCase)}
                    selected={thesis.dealTypes.map(titleCase)}
                    onToggle={(label) => toggleThesisArray('dealTypes', label.toLowerCase())}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Territories</label>
                    <TagInput
                      tags={thesis.territories}
                      onChange={(next) => setThesis(prev => ({ ...prev, territories: next }))}
                      placeholder="e.g. North America, EU, UK…"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Themes</label>
                    <TagInput
                      tags={thesis.themes}
                      onChange={(next) => setThesis(prev => ({ ...prev, themes: next }))}
                      placeholder="e.g. climate, female-led, sci-fi…"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget Range <span className="text-gray-400 font-normal">(project budget, USD)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={thesis.budgetMinUsd != null ? thesis.budgetMinUsd.toLocaleString('en-US') : ''}
                        onChange={(e) => setThesisNum('budgetMinUsd', e.target.value)}
                        placeholder="Min"
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B4FC7] focus:border-transparent"
                      />
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={thesis.budgetMaxUsd != null ? thesis.budgetMaxUsd.toLocaleString('en-US') : ''}
                        onChange={(e) => setThesisNum('budgetMaxUsd', e.target.value)}
                        placeholder="Max"
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B4FC7] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cheque Size <span className="text-gray-400 font-normal">(your typical investment, USD)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={thesis.checkSizeMinUsd != null ? thesis.checkSizeMinUsd.toLocaleString('en-US') : ''}
                        onChange={(e) => setThesisNum('checkSizeMinUsd', e.target.value)}
                        placeholder="Min"
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B4FC7] focus:border-transparent"
                      />
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={thesis.checkSizeMaxUsd != null ? thesis.checkSizeMaxUsd.toLocaleString('en-US') : ''}
                        onChange={(e) => setThesisNum('checkSizeMaxUsd', e.target.value)}
                        placeholder="Max"
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B4FC7] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Positioning statement</label>
                  <textarea
                    value={thesis.positioning}
                    onChange={(e) => setThesis(prev => ({ ...prev, positioning: e.target.value }))}
                    rows={4}
                    placeholder="What makes a project a fit beyond the filters above — your angle, the kind of stories you back, what makes a project a fit. Creators and producers read this before they pitch you."
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-500 mt-1">Shown on your public investor profile.</p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={thesis.isPublic}
                    onChange={(e) => setThesis(prev => ({ ...prev, isPublic: e.target.checked }))}
                    className="mt-1 w-4 h-4 text-[#5B4FC7] border-gray-300 rounded focus:ring-[#5B4FC7]"
                  />
                  <span>
                    <span className="text-sm font-medium text-gray-900 block">Show my thesis on my public profile</span>
                    <span className="text-xs text-gray-500">When off, your mandate stays private and is used only for matching.</span>
                  </span>
                </label>

                <div className="pt-2">
                  <button
                    onClick={() => { void handleSaveThesis(); }}
                    disabled={savingThesis}
                    className="px-6 py-3 bg-[#5B4FC7] text-white rounded-lg hover:bg-[#4d42b0] transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingThesis ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Thesis
                  </button>
                </div>
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
                  className="flex-1 px-6 py-3 bg-[#5B4FC7] text-white rounded-lg hover:bg-[#4d42b0] transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Changes
                </button>
                <button
                  onClick={() => navigate('/investor/settings')}
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
