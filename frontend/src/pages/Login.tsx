import React, { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useBetterAuthStore, MFARequiredError } from '../store/betterAuthStore';
import { Film, Briefcase, DollarSign, Eye, LogIn, Mail, AlertCircle, CheckCircle, ChevronRight, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PasswordInput from '../components/PasswordInput';
import Turnstile, { TURNSTILE_ENABLED } from '../components/Turnstile';
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
  const [turnstileKey, setTurnstileKey] = useState(0);
  // Turnstile tokens are single-use; force a fresh token after every attempt so a
  // retry never resends a consumed token (which Cloudflare rejects as timeout-or-duplicate).
  const resetTurnstile = () => { setTurnstileToken(''); setTurnstileKey((k) => k + 1); };
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
      resetTurnstile();
    }
  };

  const setDemoCredentials = async () => {
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

    // Demo accounts bypass Turnstile on the backend, so log in directly instead of just
    // pre-filling — otherwise the user is stranded behind the Turnstile gate. Mirrors the
    // dedicated /login/<portal> pages.
    try {
      if (selectedPortal === 'creator') {
        await loginCreator(demo.email, demo.password, turnstileToken);
        void navigate(resolvePostLoginRedirect(rawFrom, '/creator/dashboard'));
      } else if (selectedPortal === 'investor') {
        await loginInvestor(demo.email, demo.password, turnstileToken);
        void navigate(resolvePostLoginRedirect(rawFrom, '/investor/dashboard'));
      } else if (selectedPortal === 'production') {
        await loginProduction(demo.email, demo.password, turnstileToken);
        void navigate(resolvePostLoginRedirect(rawFrom, '/production/dashboard'));
      }
    } catch (err) {
      console.error('Demo login failed:', err);
      resetTurnstile();
    }
  };

  // Accent classes are full literal strings per portal. The old code interpolated
  // `bg-${portal.color}-500` etc., which Tailwind's JIT can't see — and the investor accent
  // had drifted to green; the brand investor color is indigo. Sourced from the brand.portal-*
  // tokens so the chooser matches each portal's identity.
  // Creator/Investor/Production open the inline login form on this page. Watcher has no inline
  // handler here, so its card routes to the dedicated /login/watcher page (forwarding any
  // return-path). `route` distinguishes the two behaviours.
  type PortalOption = {
    id: 'creator' | 'investor' | 'production' | 'watcher';
    title: string;
    icon: LucideIcon;
    description: string;
    chip: string;
    hoverBorder: string;
    route?: string;
  };
  const portals: PortalOption[] = [
    {
      id: 'creator',
      title: 'Creator Portal',
      icon: Film,
      description: 'For filmmakers and content creators',
      chip: 'bg-brand-portal-creator/20 text-brand-portal-creator',
      hoverBorder: 'hover:border-brand-portal-creator/70',
    },
    {
      id: 'investor',
      title: 'Investor Portal',
      icon: DollarSign,
      description: 'For accredited investors',
      chip: 'bg-brand-portal-investor/20 text-brand-portal-investor',
      hoverBorder: 'hover:border-brand-portal-investor/70',
    },
    {
      id: 'production',
      title: 'Production Portal',
      icon: Briefcase,
      description: 'For production companies',
      chip: 'bg-brand-portal-production/20 text-brand-portal-production',
      hoverBorder: 'hover:border-brand-portal-production/70',
    },
    {
      id: 'watcher',
      title: 'Watcher Portal',
      icon: Eye,
      description: 'Browse, save, and draft pitches for free',
      chip: 'bg-brand-portal-watcher/20 text-brand-portal-watcher',
      hoverBorder: 'hover:border-brand-portal-watcher/70',
      route: '/login/watcher',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex flex-col items-center">
          <img src="/pitchey-logotype-white.png" alt="Pitchey" className="h-12 w-auto" />
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
                    onClick={() => {
                      if (portal.route) {
                        void navigate(portal.route, isSafeReturnPath(rawFrom) ? { state: { from: rawFrom } } : undefined);
                      } else {
                        setSelectedPortal(portal.id as 'creator' | 'investor' | 'production');
                      }
                    }}
                    className={`group w-full p-4 rounded-xl border border-gray-700 bg-gray-700/40 transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-700/70 ${portal.hoverBorder}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex-shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-xl ${portal.chip} transition-transform duration-200 group-hover:scale-105`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="text-left flex-1">
                        <h3 className="text-white font-semibold">{portal.title}</h3>
                        <p className="text-gray-400 text-sm">{portal.description}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-500 transition-all group-hover:translate-x-0.5 group-hover:text-gray-300" />
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
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  inputClassName="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="••••••••"
                />
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

              <Turnstile key={turnstileKey} onVerify={setTurnstileToken} onExpire={resetTurnstile} theme="dark" />

              <div>
                <button
                  type="submit"
                  disabled={loading || (TURNSTILE_ENABLED && !turnstileToken)}
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
                  disabled={loading}
                  onClick={() => { void setDemoCredentials(); }}
                  className="w-full py-2 bg-purple-500/30 hover:bg-purple-500/40 text-purple-100 rounded-lg text-sm font-medium transition border border-purple-400/30 disabled:opacity-50"
                >
                  Use Demo {selectedPortal === 'creator' ? 'Creator' : selectedPortal === 'investor' ? 'Investor' : 'Production'} Account
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Discreet admin entrance — bottom-right shield routes to the admin login. */}
      <Link
        to="/login/admin"
        aria-label="Admin sign in"
        title="Admin"
        className="fixed bottom-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-800/60 hover:text-gray-300"
      >
        <Shield className="h-5 w-5" />
      </Link>
    </div>
  );
}