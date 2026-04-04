import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBetterAuthStore, MFARequiredError } from '../store/betterAuthStore';
import { Briefcase, LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import BackButton from '../components/BackButton';
import Turnstile from '../components/Turnstile';

export default function ProductionLogin() {
  const navigate = useNavigate();
  const { loginProduction, loading, error } = useBetterAuthStore();
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginProduction(formData.email, formData.password, turnstileToken);
      void navigate('/production/dashboard');
    } catch (err) {
      if (err instanceof MFARequiredError) {
        void navigate(`/mfa/challenge?challengeId=${err.challengeId}&userType=${err.user.userType}&name=${encodeURIComponent(err.user.name)}&email=${encodeURIComponent(err.user.email)}`);
        return;
      }
      console.error('Production login failed:', err);
    }
  };

  const setDemoCredentials = async () => {
    const demoData = { 
      email: 'stellar.production@demo.com', 
      password: 'Demo123' 
    };
    setFormData(demoData);
    
    // Auto-submit the form with demo credentials
    try {
      await loginProduction(demoData.email, demoData.password, turnstileToken);
      void navigate('/production/dashboard');
    } catch (error) {
      console.error('Demo production login failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
      {/* Back Button */}
      <div className="absolute top-6 left-6">
        <BackButton variant="light" />
      </div>

      <div className="max-w-md w-full">
        <div className="bg-white py-8 px-6 shadow-xl rounded-lg border border-gray-200">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-lg bg-orange-100">
                <Briefcase className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Production Portal</h2>
            <p className="text-gray-600 mt-2">Sign in to manage productions</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
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
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link to="/forgot-password" className="font-medium text-orange-600 hover:text-orange-500">
                  Forgot password?
                </Link>
              </div>
            </div>

            <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Demo Account Button */}
            <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-orange-700 text-xs text-center mb-3">Try our demo account</p>
              <button
                type="button"
                onClick={() => { void setDemoCredentials(); }}
                className="w-full py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-sm font-medium transition border border-orange-300"
              >
                Use Demo Production Account
              </button>
            </div>
          </form>

          {/* Other Portals */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Try other portals
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link
                to="/login/creator"
                className="inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Creator Portal
              </Link>
              <Link
                to="/login/investor"
                className="inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Investor Portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}