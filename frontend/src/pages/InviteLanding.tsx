import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle, CheckCircle, Lock, Mail, User, Shield, BarChart3, Eye, Globe } from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { apiClient } from '@/lib/api-client';

export default function InviteLanding() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, register, loading: authLoading, error: authError } = useBetterAuthStore();

  const [invite, setInvite] = useState<{
    inviterName: string;
    email: string | null;
    valid: boolean;
    expired: boolean;
    redeemed: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!code) return;
    const loadInvite = async () => {
      try {
        const response = await apiClient.get<{
          inviterName: string;
          email: string | null;
          valid: boolean;
          expired: boolean;
          redeemed: boolean;
        }>(`/api/invites/${code}`);
        if (response.success && response.data) {
          setInvite(response.data);
          if (response.data.email) {
            setFormData((prev) => ({ ...prev, email: response.data!.email! }));
          }
        } else {
          setError('Invite not found');
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    void loadInvite();
  }, [code]);

  // If already authenticated, try to redeem and redirect
  useEffect(() => {
    if (isAuthenticated && code && invite?.valid) {
      apiClient.post(`/api/invites/${code}/redeem`, {}).catch(() => {});
      navigate('/creator/dashboard', { replace: true });
    }
  }, [isAuthenticated, code, invite, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError(null);
    try {
      // Store invite code before registering
      localStorage.setItem('pendingInviteCode', code || '');
      localStorage.setItem('pendingVerificationEmail', formData.email);

      await register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        userType: 'creator',
      });

      setRegistrationComplete(true);
    } catch (_err) {
      // Error handled by auth store
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (!invite || error === 'Invite not found') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <AlertCircle className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Invite Not Found</h1>
        <p className="text-gray-600 mb-6">This invite link doesn't exist or has been removed.</p>
        <Link to="/register" className="text-purple-600 hover:text-purple-700 font-medium">
          Sign up normally instead
        </Link>
      </div>
    );
  }

  if (invite.expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <AlertCircle className="w-16 h-16 text-yellow-400 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Invite Expired</h1>
        <p className="text-gray-600 mb-6">This invite link has expired. Ask {invite.inviterName} to send a new one.</p>
        <Link to="/register" className="text-purple-600 hover:text-purple-700 font-medium">
          Sign up normally instead
        </Link>
      </div>
    );
  }

  if (invite.redeemed) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Invite Already Used</h1>
        <p className="text-gray-600 mb-6">This invite has already been redeemed.</p>
        <Link to="/login" className="text-purple-600 hover:text-purple-700 font-medium">
          Sign in to your account
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex flex-col items-center">
          <span className="text-4xl font-bold text-purple-600">Pitchey</span>
        </Link>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-sm font-medium">
            <UserPlus className="w-4 h-4" />
            Invited by {invite.inviterName}
          </div>
        </div>

        <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900">
          Join Pitchey
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          The platform connecting filmmakers directly with investors and production companies.
        </p>

        <ul className="mt-6 space-y-3">
          <li className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <UserPlus className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900">Direct line to {invite.inviterName}</span>
              <p className="text-xs text-gray-500 mt-0.5">Submit pitches directly to industry decision-makers who are already looking for projects like yours.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900">Know who's reading your pitch</span>
              <p className="text-xs text-gray-500 mt-0.5">Analytics show you which investors and producers have viewed your project — no more guessing.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900">NDA-protected submissions</span>
              <p className="text-xs text-gray-500 mt-0.5">Reviewers must agree to an NDA before accessing your full pitch. Your IP stays yours.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <Globe className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900">Discoverable across the marketplace</span>
              <p className="text-xs text-gray-500 mt-0.5">Your published pitches are visible to the wider Pitchey network — not just your inviter.</p>
            </div>
          </li>
        </ul>

        <p className="mt-5 text-center text-xs text-gray-400">
          Join creators already pitching on Pitchey
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {registrationComplete ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Registration successful!
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                We've sent a verification email to <strong>{formData.email}</strong>.
                Check your inbox and click the link to get started.
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5">
              {(error || authError) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error || authError}</p>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                <div className="mt-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10 block w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                <div className="mt-1 relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="username"
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="pl-10 block w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="your_username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1 relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10 block w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Min. 8 characters"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <div className="mt-1 relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="pl-10 block w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Repeat password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition"
              >
                {authLoading ? 'Creating account...' : 'Create Creator Account'}
              </button>

              <p className="text-center text-xs text-gray-500 mt-4">
                Already have an account?{' '}
                <Link to="/login" className="text-purple-600 hover:text-purple-700 font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
