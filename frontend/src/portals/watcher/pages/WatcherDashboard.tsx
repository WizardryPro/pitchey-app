import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, Heart, TrendingUp, CreditCard, Search, ArrowRight, Sparkles, Info } from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { apiClient } from '@/lib/api-client';
import { WATCHER_ROUTES } from '@/config/navigation.routes';

export default function WatcherDashboard() {
  const navigate = useNavigate();
  const { user: authUser, isAuthenticated } = useBetterAuthStore();
  const [credits, setCredits] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login/watcher');
      return;
    }
    fetchDashboardData();
  }, [isAuthenticated]);

  const fetchDashboardData = async () => {
    try {
      const [creditsRes, savedRes] = await Promise.all([
        apiClient.get<{ data: { credits: number } }>('/api/payments/credits/balance').catch(() => ({ success: false, data: null })),
        apiClient.get<{ data: { totalSaved: number } }>('/api/saved-pitches/stats').catch(() => ({ success: false, data: null })),
      ]);
      if (creditsRes.success && creditsRes.data) setCredits(creditsRes.data.data?.credits || 0);
      if (savedRes.success && savedRes.data) setSavedCount(savedRes.data.data?.totalSaved || 0);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  };

  const firstName = authUser?.name?.split(' ')[0] || authUser?.email?.split('@')[0] || 'Watcher';

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="relative overflow-hidden bg-gradient-to-br from-cyan-600 via-sky-600 to-sky-700 rounded-2xl p-8 text-white shadow-lg shadow-cyan-500/20">
        <div aria-hidden className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 -left-10 w-72 h-72 bg-cyan-300/20 rounded-full blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-medium text-cyan-50 mb-4 ring-1 ring-white/20">
            <Sparkles className="w-3.5 h-3.5" />
            Watcher
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back, {firstName}</h1>
          <p className="text-cyan-50/90 max-w-lg leading-relaxed">
            Browse pitches, save your favourites, and leave feedback on stories you love.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-pink-50 to-rose-100 ring-1 ring-pink-100/60">
              <Heart className="w-5 h-5 text-pink-500" />
            </div>
            <span className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
              {loading ? '—' : savedCount}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Saved Pitches</p>
          <p className="text-xs text-gray-400 mt-0.5">Your bookmarked ideas</p>
        </div>

        <div className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-50 to-sky-100 ring-1 ring-cyan-100/60">
              <CreditCard className="w-5 h-5 text-cyan-600" />
            </div>
            <span className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
              {loading ? '—' : credits}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Credits Available</p>
          <p className="text-xs text-gray-400 mt-0.5">Unlock premium actions</p>
        </div>

        <div className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-sky-50 to-cyan-100 ring-1 ring-sky-100/60">
              <Eye className="w-5 h-5 text-sky-600" />
            </div>
            <span className="inline-flex items-center text-xs font-semibold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full ring-1 ring-cyan-100">
              Free
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">The Watcher</p>
          <p className="text-xs text-gray-400 mt-0.5">Current plan</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-baseline justify-between mb-4 px-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Quick Actions</h2>
          <span className="text-xs text-gray-400">3 shortcuts</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Link
            to="/marketplace"
            className="group relative overflow-hidden bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-cyan-200 transition-all duration-200"
          >
            <div aria-hidden className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-cyan-100/0 to-cyan-100/0 group-hover:from-cyan-100/60 group-hover:to-sky-100/40 rounded-full blur-2xl transition-all duration-300" />
            <div className="relative">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-sm shadow-cyan-500/30 mb-4 group-hover:scale-105 group-hover:shadow-cyan-500/40 transition-all duration-200">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
                Browse Marketplace
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-cyan-600 group-hover:translate-x-0.5 transition-all duration-200" />
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Discover pitches from creators worldwide
              </p>
            </div>
          </Link>

          <Link
            to={WATCHER_ROUTES.saved}
            className="group relative overflow-hidden bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-cyan-200 transition-all duration-200"
          >
            <div aria-hidden className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-cyan-100/0 to-cyan-100/0 group-hover:from-cyan-100/60 group-hover:to-sky-100/40 rounded-full blur-2xl transition-all duration-300" />
            <div className="relative">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-sm shadow-cyan-500/30 mb-4 group-hover:scale-105 group-hover:shadow-cyan-500/40 transition-all duration-200">
                <Heart className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
                Saved Pitches
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-cyan-600 group-hover:translate-x-0.5 transition-all duration-200" />
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Revisit pitches you bookmarked
              </p>
            </div>
          </Link>

          <Link
            to={WATCHER_ROUTES.billing}
            className="group relative overflow-hidden bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-cyan-200 transition-all duration-200"
          >
            <div aria-hidden className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-cyan-100/0 to-cyan-100/0 group-hover:from-cyan-100/60 group-hover:to-sky-100/40 rounded-full blur-2xl transition-all duration-300" />
            <div className="relative">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-sm shadow-cyan-500/30 mb-4 group-hover:scale-105 group-hover:shadow-cyan-500/40 transition-all duration-200">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
                Buy Credits
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-cyan-600 group-hover:translate-x-0.5 transition-all duration-200" />
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Purchase credits to unlock features
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* NDA notice */}
      <div className="flex gap-3 bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200/70 rounded-2xl p-5">
        <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100 text-amber-700">
          <Info className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900 mb-0.5">Watcher accounts are for browsing</p>
          <p className="text-sm text-amber-800/90 leading-relaxed">
            You can browse, like, and comment on pitches. To create, invest in, or produce pitches — or to sign NDAs and access protected content — sign up as a Creator, Investor, or Production account at <Link to="/signup" className="underline font-medium">pitchey.com/signup</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
