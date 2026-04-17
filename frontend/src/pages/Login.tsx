import React, { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useBetterAuthStore, MFARequiredError } from '../store/betterAuthStore';
import { Film, Briefcase, DollarSign, LogIn, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import Turnstile from '../components/Turnstile';
import { isSafeReturnPath, resolvePostLoginRedirect } from '@/utils/postLoginRedirect';


export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const verified = searchParams.get('verified');
  const rawFrom = (location.state as { from?: unknown } | null)?.from;
  const mfaFromQuery = isSafeReturnPath(rawFrom) ? `&from=${encodeURIComponent(rawFrom)}` : '';
  const { loginCreator, loginInvestor, loginProduction, loading, error } = useBetterAuthStore();
  const [selectedPortal, setSelectedPortal] = useState<'creator' | 'investor' | 'production' | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortal) {
      alert('Please select a portal type');
      return;
    }

    try {
      if (selectedPortal === 'creator') {
        await loginCreator(formData.email, formData.password, turnstileToken);
        void navigate(resolvePostLoginRedirect(rawFrom, '/creator/dashboard'));
      } else if (selectedPortal === 'investor') {
        await loginInvestor(formData.email, formData.password, turnstileToken);
        void navigate(resolvePostLoginRedirect(rawFrom, '/investor/dashboard'));
      } else if (selectedPortal === 'production') {
        await loginProduction(formData.email, formData.password, turnstileToken);
        void navigate(resolvePostLoginRedirect(rawFrom, '/production/dashboard'));
      }
    } catch (err) {
      if (err instanceof MFARequiredError) {
        void navigate(`/mfa/challenge?challengeId=${err.challengeId}&userType=${err.user.userType}&name=${encodeURIComponent(err.user.name)}&email=${encodeURIComponent(err.user.email)}${mfaFromQuery}`);
        return;
      }
      console.error('Login failed:', err);
    }
  };

  const setDemoCredentials = () => {
    if (!selectedPortal) {
      alert('Please select a portal type first');
      return;
    }

    const demoAccounts = {
      creator: { email: 'alex.creator@demo.com', password: 'Demo123' },
      investor: { email: 'sarah.investor@demo.com', password: 'Demo123' },
      production: { email: 'stellar.production@demo.com', password: 'Demo123' },
    };

    const demo = demoAccounts[selectedPortal];
    setFormData({ email: demo.email, password: demo.password });
  };

  const portals = [
    {
      id: 'creator',
      title: 'Creator Portal',
      icon: Film,
      description: 'For filmmakers and content creators',
      color: 'purple',
    },
    {
      id: 'investor',
      title: 'Investor Portal',
      icon: DollarSign,
      description: 'For accredited investors',
      color: 'green',
    },
    {
      id: 'production',
      title: 'Production Portal',
      icon: Briefcase,
      description: 'For production companies',
      color: 'blue',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex flex-col items-center">
          <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Pitchey
          </span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          Or{' '}
          <Link
            to="/register"
            className="font-medium text-purple-400 hover:text-purple-300"
          >
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-800 py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-gray-700">
          {verified === 'true' && (
            <div className="mb-6 bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              Email verified successfully! You can now sign in.
            </div>
          )}
          {verified === 'false' && (
            <div className="mb-6 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              Verification link is invalid or expired. Please request a new one.
            </div>
          )}
          {/* Portal Selection */}
          {!selectedPortal ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white mb-4">Select your portal</h3>
              {portals.map((portal) => {
                const Icon = portal.icon;
                return (
                  <button
                    key={portal.id}
                    onClick={() => setSelectedPortal(portal.id as 'creator' | 'investor' | 'production')}
                    className={`w-full p-4 rounded-lg border-2 transition-all duration-200 hover:scale-[1.02] bg-gray-700/50 border-gray-600 hover:border-${portal.color}-500 hover:bg-gray-700`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-lg bg-${portal.color}-500/20`}>
                        <Icon className={`h-6 w-6 text-${portal.color}-400`} />
                      </div>
                      <div className="text-left flex-1">
                        <h3 className="text-white font-semibold">{portal.title}</h3>
                        <p className="text-gray-400 text-sm">{portal.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Login Form */
            <form className="space-y-6" onSubmit={(e) => { void handleSubmit(e); }}>
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setSelectedPortal(null)}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  ← Change portal
                </button>
                <h3 className="text-lg font-medium text-white mt-2">
                  {selectedPortal === 'creator' && 'Creator Login'}
                  {selectedPortal === 'investor' && 'Investor Login'}
                  {selectedPortal === 'production' && 'Production Login'}
                </h3>
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                  Email address
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 rounded bg-gray-700"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <Link to="/forgot-password" className="font-medium text-purple-400 hover:text-purple-300">
                    Forgot password?
                  </Link>
                </div>
              </div>

              <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} theme="dark" />

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* Demo Account Button */}
              <div className="mt-4 p-4 bg-purple-600/20 rounded-lg border border-purple-500/30">
                <p className="text-purple-200 text-xs text-center mb-3">Try our demo account</p>
                <button
                  type="button"
                  onClick={setDemoCredentials}
                  className="w-full py-2 bg-purple-500/30 hover:bg-purple-500/40 text-purple-100 rounded-lg text-sm font-medium transition border border-purple-400/30"
                >
                  Use Demo {selectedPortal === 'creator' ? 'Creator' : selectedPortal === 'investor' ? 'Investor' : 'Production'} Account
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-400">
                  Direct portal links
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <Link
                to="/login/creator"
                className="inline-flex justify-center py-2 px-4 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600"
              >
                Creator
              </Link>
              <Link
                to="/login/investor"
                className="inline-flex justify-center py-2 px-4 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600"
              >
                Investor
              </Link>
              <Link
                to="/login/production"
                className="inline-flex justify-center py-2 px-4 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600"
              >
                Production
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}