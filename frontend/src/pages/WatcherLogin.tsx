import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useBetterAuthStore, MFARequiredError } from '../store/betterAuthStore';
import { Eye, LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import BackButton from '../components/BackButton';
import Turnstile from '../components/Turnstile';
import { isSafeReturnPath, resolvePostLoginRedirect } from '@/utils/postLoginRedirect';

export default function WatcherLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const rawFrom = (location.state as { from?: unknown } | null)?.from;
  const mfaFromQuery = isSafeReturnPath(rawFrom) ? `&from=${encodeURIComponent(rawFrom)}` : '';
  const resolveDest = () => resolvePostLoginRedirect(rawFrom, '/watcher/dashboard');
  const { loginWatcher, loading, error } = useBetterAuthStore();
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginWatcher(formData.email, formData.password, turnstileToken);
      void navigate(resolveDest());
    } catch (err) {
      if (err instanceof MFARequiredError) {
        void navigate(`/mfa/challenge?challengeId=${err.challengeId}&userType=${err.user.userType}&name=${encodeURIComponent(err.user.name)}&email=${encodeURIComponent(err.user.email)}${mfaFromQuery}`);
        return;
      }
      console.error('Watcher login failed:', err);
    }
  };

  const setDemoCredentials = async () => {
    const demoData = { email: 'jamie.watcher@demo.com', password: 'Demo123' };
    setFormData(demoData);
    try {
      await loginWatcher(demoData.email, demoData.password, turnstileToken);
      void navigate(resolveDest());
    } catch (err) {
      if (err instanceof MFARequiredError) {
        void navigate(`/mfa/challenge?challengeId=${err.challengeId}&userType=${err.user.userType}&name=${encodeURIComponent(err.user.name)}&email=${encodeURIComponent(err.user.email)}${mfaFromQuery}`);
        return;
      }
      console.error('Demo watcher login failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-portal-watcher/10 via-white to-brand-portal-watcher/5 flex items-center justify-center p-4">
      <div className="absolute top-6 left-6">
        <BackButton variant="light" />
      </div>

      <div className="max-w-md w-full">
        <div className="bg-white py-8 px-6 shadow-xl rounded-lg border border-gray-200">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-lg bg-brand-portal-watcher/10">
                <Eye className="h-8 w-8 text-brand-portal-watcher" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Watcher Portal</h2>
            <p className="text-gray-600 mt-2">Browse, discover, and save pitches</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

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
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-portal-watcher focus:border-transparent"
                  placeholder="you@example.com"
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
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-portal-watcher focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link to="/forgot-password" className="font-medium text-brand-portal-watcher hover:opacity-80">
                  Forgot password?
                </Link>
              </div>
            </div>

            <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-portal-watcher hover:bg-brand-portal-watcher/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-portal-watcher disabled:opacity-50 disabled:cursor-not-allowed"
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

            <div className="mt-4 p-4 bg-brand-portal-watcher/5 rounded-lg border border-brand-portal-watcher/20">
              <p className="text-brand-portal-watcher text-xs text-center mb-3">Try our demo account</p>
              <button
                type="button"
                onClick={() => { void setDemoCredentials(); }}
                className="w-full py-2 bg-brand-portal-watcher/10 hover:bg-brand-portal-watcher/20 text-brand-portal-watcher rounded-lg text-sm font-medium transition border border-brand-portal-watcher/30"
              >
                Use Demo Watcher Account
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Try other portals</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Link to="/login/creator" className="inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">Creator</Link>
              <Link to="/login/investor" className="inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">Investor</Link>
              <Link to="/login/production" className="inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">Production</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
