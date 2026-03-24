import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../services/admin.service';
import { withPortalErrorBoundary } from '@/components/ErrorBoundary/PortalErrorBoundary';
import { useSentryPortal } from '@/shared/hooks/useSentryPortal';

interface DashboardStats {
  totalUsers: number;
  totalPitches: number;
  totalRevenue: number;
  pendingNDAs: number;
  activeUsers: number;
  recentSignups: number;
  approvedPitches: number;
  rejectedPitches: number;
}

interface RecentActivity {
  id: string;
  type: 'user_signup' | 'pitch_created' | 'nda_signed' | 'payment_received';
  description: string;
  timestamp: string;
  user?: string;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Sentry portal integration
  const { reportError, trackEvent, trackApiError } = useSentryPortal({
    portalType: 'admin',
    componentName: 'AdminDashboard',
    trackPerformance: true
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Track admin dashboard data fetch
      trackEvent('admin.dashboard.load', { timestamp: new Date().toISOString() });
      
      const [statsRaw, activityRaw] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getRecentActivity()
      ]);

      if (statsRaw) {
        // Normalize: API may return nested { dashboard: { stats: ... } } or flat DashboardStats
        const raw = statsRaw as any;
        const nested = raw.dashboard?.stats || raw.stats || raw;
        const statsData: DashboardStats = {
          totalUsers: nested.users?.total ?? nested.totalUsers ?? 0,
          totalPitches: nested.content?.total_pitches ?? nested.totalPitches ?? 0,
          totalRevenue: nested.financial?.total_investments ?? nested.totalRevenue ?? 0,
          pendingNDAs: nested.financial?.pending_ndas ?? nested.pendingNDAs ?? 0,
          activeUsers: nested.users?.active_24h ?? nested.activeUsers ?? 0,
          recentSignups: nested.users?.new_today ?? nested.recentSignups ?? 0,
          approvedPitches: nested.content?.published_today ?? nested.approvedPitches ?? 0,
          rejectedPitches: nested.content?.flagged ?? nested.rejectedPitches ?? 0,
        };
        setStats(statsData);
        trackEvent('admin.stats.loaded', {
          totalUsers: statsData.totalUsers,
          totalPitches: statsData.totalPitches
        });
      } else {
        trackApiError('/api/admin/stats', { success: false });
      }

      if (activityRaw) {
        // Normalize: API may return { dashboard: { recent_activity: [...] } } or flat array
        const raw = activityRaw as any;
        const activityList = raw.dashboard?.recent_activity || raw.recent_activity || (Array.isArray(raw) ? raw : []);
        const activityData: RecentActivity[] = activityList.map((item: any, idx: number) => ({
          id: item.id || String(idx),
          type: item.type || 'user_signup',
          description: item.message || item.description || '',
          timestamp: item.timestamp || new Date().toISOString(),
          user: item.user,
        }));
        setRecentActivity(activityData);
      } else {
        trackApiError('/api/admin/activity', { success: false });
      }
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
      reportError(err as Error, {
        context: 'loadDashboardData',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_signup': return '👤';
      case 'pitch_created': return '🎬';
      case 'nda_signed': return '📄';
      case 'payment_received': return '💰';
      default: return '📊';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadDashboardData}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Platform overview and management tools</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers.toLocaleString()}</p>
              </div>
              <div className="text-blue-500 text-3xl">👥</div>
            </div>
            <p className="text-sm text-green-600 mt-2">+{stats?.recentSignups} this week</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pitches</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalPitches.toLocaleString()}</p>
              </div>
              <div className="text-purple-500 text-3xl">🎬</div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {stats?.approvedPitches} approved, {stats?.rejectedPitches} rejected
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalRevenue || 0)}</p>
              </div>
              <div className="text-green-500 text-3xl">💰</div>
            </div>
            <p className="text-sm text-green-600 mt-2">This month</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending NDAs</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.pendingNDAs}</p>
              </div>
              <div className="text-orange-500 text-3xl">📄</div>
            </div>
            <p className="text-sm text-blue-600 mt-2">{stats?.activeUsers} active users</p>
          </div>
        </div>

        {/* Management Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Link
            to="/admin/users"
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-blue-500"
          >
            <div className="flex items-center">
              <div className="text-blue-500 text-2xl mr-4">👤</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
                <p className="text-gray-600">Manage users, credits, and permissions</p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/content"
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-purple-500"
          >
            <div className="flex items-center">
              <div className="text-purple-500 text-2xl mr-4">🎬</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Content Moderation</h3>
                <p className="text-gray-600">Review and moderate pitch content</p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/transactions"
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-green-500"
          >
            <div className="flex items-center">
              <div className="text-green-500 text-2xl mr-4">💳</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
                <p className="text-gray-600">View payments and process refunds</p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/settings"
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-orange-500"
          >
            <div className="flex items-center">
              <div className="text-orange-500 text-2xl mr-4">⚙️</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">System Settings</h3>
                <p className="text-gray-600">Configure platform settings</p>
              </div>
            </div>
          </Link>

          <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-red-500">
            <div className="flex items-center">
              <div className="text-red-500 text-2xl mr-4">📊</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
                <p className="text-gray-600">Platform usage and performance</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-gray-500">
            <div className="flex items-center">
              <div className="text-gray-500 text-2xl mr-4">🛠️</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
                <p className="text-gray-600">Monitor system status</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="p-6">
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {recentActivity.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded">
                    <div className="text-2xl">{getActivityIcon(activity.type)}</div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                        {activity.user && ` • ${activity.user}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default withPortalErrorBoundary(AdminDashboard, 'admin');