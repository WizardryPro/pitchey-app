import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, Heart, Plus, TrendingUp, CreditCard, Search } from 'lucide-react';
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
        apiClient.get<{ balance: number }>('/api/credits/balance').catch(() => ({ success: false, data: null })),
        apiClient.get<{ total: number }>('/api/pitches/saved/count').catch(() => ({ success: false, data: null })),
      ]);
      if (creditsRes.success && creditsRes.data) setCredits(creditsRes.data.balance || 0);
      if (savedRes.success && savedRes.data) setSavedCount(savedRes.data.total || 0);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  };

  const firstName = authUser?.name?.split(' ')[0] || authUser?.email?.split('@')[0] || 'Watcher';

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-cyan-600 to-sky-600 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Welcome back, {firstName}</h1>
        <p className="text-cyan-100">Browse pitches, save your favourites, and start drafting your own ideas.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <Heart className="w-5 h-5 text-pink-500" />
            <span className="text-2xl font-bold text-gray-900">{loading ? '—' : savedCount}</span>
          </div>
          <p className="text-sm text-gray-600">Saved Pitches</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <CreditCard className="w-5 h-5 text-cyan-600" />
            <span className="text-2xl font-bold text-gray-900">{loading ? '—' : credits}</span>
          </div>
          <p className="text-sm text-gray-600">Credits Available</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <Eye className="w-5 h-5 text-sky-500" />
            <span className="text-xs font-medium text-cyan-600 bg-cyan-50 px-2 py-1 rounded-full">Free</span>
          </div>
          <p className="text-sm text-gray-600">Current Plan: The Watcher</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/marketplace"
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition group"
        >
          <Search className="w-8 h-8 text-cyan-600 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-gray-900 mb-1">Browse Marketplace</h3>
          <p className="text-sm text-gray-500">Discover pitches from creators worldwide</p>
        </Link>
        <Link
          to={WATCHER_ROUTES.pitchNew}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition group"
        >
          <Plus className="w-8 h-8 text-cyan-600 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-gray-900 mb-1">Start a Draft</h3>
          <p className="text-sm text-gray-500">Create and save your pitch ideas</p>
        </Link>
        <Link
          to={WATCHER_ROUTES.billing}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition group"
        >
          <TrendingUp className="w-8 h-8 text-cyan-600 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-gray-900 mb-1">Buy Credits</h3>
          <p className="text-sm text-gray-500">Purchase credits to unlock features</p>
        </Link>
      </div>

      {/* NDA notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800">
          <strong>Watcher accounts</strong> can browse, like, and create draft pitches. To sign NDAs and access protected content, consider upgrading to a Creator, Investor, or Production account.
        </p>
      </div>
    </div>
  );
}
