import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { UserService } from '../../services/user.service';

const MAX_BIO_LENGTH = 500;

const PORTAL_CONFIG = {
  creator: {
    subtitle: 'Complete your creator profile to get started',
    bioPlaceholder: 'Tell us about yourself and your creative work...',
    gradient: 'from-indigo-50 via-white to-purple-50',
    accent: 'indigo',
  },
  investor: {
    subtitle: 'Complete your investor profile to get started',
    bioPlaceholder: 'Tell us about your investment focus and experience...',
    gradient: 'from-emerald-50 via-white to-teal-50',
    accent: 'emerald',
  },
  production: {
    subtitle: 'Complete your production profile to get started',
    bioPlaceholder: 'Tell us about your production company and projects...',
    gradient: 'from-amber-50 via-white to-orange-50',
    accent: 'amber',
  },
} as const;

// Tailwind classes can't be dynamically composed — map them explicitly
const ACCENT_CLASSES = {
  indigo: {
    title: 'text-indigo-600',
    photoBorder: 'hover:border-indigo-400',
    photoRing: 'focus:ring-indigo-500',
    inputRing: 'focus:ring-indigo-500 focus:border-indigo-500',
    button: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500',
  },
  emerald: {
    title: 'text-emerald-600',
    photoBorder: 'hover:border-emerald-400',
    photoRing: 'focus:ring-emerald-500',
    inputRing: 'focus:ring-emerald-500 focus:border-emerald-500',
    button: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
  },
  amber: {
    title: 'text-amber-600',
    photoBorder: 'hover:border-amber-400',
    photoRing: 'focus:ring-amber-500',
    inputRing: 'focus:ring-amber-500 focus:border-amber-500',
    button: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
  },
} as const;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, checkSession, logout } = useBetterAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userType = (user?.userType || 'creator') as keyof typeof PORTAL_CONFIG;
  const cfg = PORTAL_CONFIG[userType] || PORTAL_CONFIG.creator;
  const colors = ACCENT_CLASSES[cfg.accent];

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0 && bio.trim().length > 0 && termsAccepted && !submitting;

  const handleSignOut = async () => {
    await logout();
    void navigate('/login', { replace: true });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      if (photoFile) {
        try {
          await UserService.uploadProfileImage(photoFile);
        } catch (err) {
          console.warn('Profile photo upload failed:', err);
        }
      }

      const name = `${firstName.trim()} ${lastName.trim()}`;
      await UserService.updateProfile({ name, bio: bio.trim() });
      await checkSession();
      void navigate(`/${userType}/dashboard`, { replace: true });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${cfg.gradient} flex items-center justify-center px-4 py-12`}>
      <div className="w-full max-w-lg">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold ${colors.title}`}>Pitchey</h1>
          <p className="mt-2 text-gray-600">{cfg.subtitle}</p>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          {/* Profile Photo */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`relative w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 ${colors.photoBorder} transition-colors flex items-center justify-center overflow-hidden focus:outline-none focus:ring-2 ${colors.photoRing} focus:ring-offset-2`}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <span className="mt-2 text-sm text-gray-500">Add a photo (optional)</span>
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${colors.inputRing} transition-colors`}
                placeholder="First"
                required
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${colors.inputRing} transition-colors`}
                placeholder="Last"
                required
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
              rows={4}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${colors.inputRing} transition-colors resize-none`}
              placeholder={cfg.bioPlaceholder}
              required
            />
            <p className="mt-1 text-sm text-gray-400 text-right">
              {bio.length}/{MAX_BIO_LENGTH}
            </p>
          </div>

          {/* Terms & Conditions */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <input
              id="terms-accept"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className={`mt-0.5 h-5 w-5 rounded border-gray-300 text-${cfg.accent}-600 focus:ring-${cfg.accent}-500 cursor-pointer`}
            />
            <label htmlFor="terms-accept" className="text-sm text-gray-700 cursor-pointer select-none">
              I have read and agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className={`${colors.title} hover:underline font-medium`}>
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className={`${colors.title} hover:underline font-medium`}>
                Privacy Policy
              </a>
              , including the handling of confidential materials and NDA obligations.
            </label>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-3 px-4 ${colors.button} text-white font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          >
            {submitting ? 'Saving...' : 'Complete Profile'}
          </button>

          <p className="text-center text-sm text-gray-500 mt-4">
            Wrong account?{' '}
            <button type="button" onClick={() => { void handleSignOut(); }} className="text-red-600 hover:text-red-700 font-medium">
              Sign out
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
