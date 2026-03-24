import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBetterAuthStore, MFARequiredError } from '../store/betterAuthStore';
import { Shield, LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import BackButton from '../components/BackButton';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login, loading, error } = useBetterAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      await login(formData.email, formData.password);
      // Verify the user has admin access (either native admin or admin_access flag)
      const user = useBetterAuthStore.getState().user;
      if (user?.userType !== 'admin' && !user?.adminAccess) {
        useBetterAuthStore.getState().logout();
        setAuthError('Access denied. This portal is restricted to administrators.');
        return;
      }
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof MFARequiredError) {
        navigate(`/mfa/challenge?challengeId=${err.challengeId}&userType=${err.user.userType}&name=${encodeURIComponent(err.user.name)}&email=${encodeURIComponent(err.user.email)}`);
        return;
      }
      console.error('Admin login failed:', err);
    }
  };

  const displayError = authError || error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-white to-indigo-50 flex items-center justify-center p-4">
      {/* Back Button */}
      <div className="absolute top-6 left-6">
        <BackButton variant="light" />
      </div>

      <div className="max-w-md w-full">
        <div className="bg-white py-8 px-6 shadow-xl rounded-lg border border-gray-200">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-lg bg-purple-100">
                <Shield className="h-8 w-8 text-purple-900" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Admin Portal</h2>
            <p className="text-gray-600 mt-2">Sign in to the administration panel</p>
          </div>

          {/* Error Message */}
          {displayError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              {displayError}
            </div>
          )}

          {/* Login Form */}
          <form className="space-y-6" onSubmit={(e) => { void handleSubmit(e); }}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-800 focus:border-transparent"
                  placeholder="admin@pitchey.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-800 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-900 hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 mr-2" />
                    Sign in
                  </>
                )}
              </button>
            </div>

            {/* Passwordless option */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-400">or</span></div>
            </div>

            <Link
              to="/login/email"
              className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition gap-2"
            >
              <Mail className="h-4 w-4" />
              Sign in with email code
            </Link>
          </form>

          {/* Back to portals */}
          <div className="mt-6 text-center">
            <Link
              to="/portals"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Back to portal selection
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
