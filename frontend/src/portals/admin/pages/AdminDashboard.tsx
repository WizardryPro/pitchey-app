import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Film, DollarSign, FileText, RefreshCw, ChevronRight,
  CreditCard, Settings, Ticket, BarChart3, Activity, BadgeCheck,
  UserPlus, type LucideIcon,
} from 'lucide-react';
import { adminService } from '../services/admin.service';
import { withPortalErrorBoundary } from '@/components/ErrorBoundary/PortalErrorBoundary';
import { useSentryPortal } from '@/shared/hooks/useSentryPortal';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { StatCard } from '../components/StatCard';

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

// Management shortcuts — every card is a real link (Analytics, System Health and
// Verifications were previously dead, non-clickable tiles).
type Accent = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'indigo' | 'red';
const MANAGEMENT_LINKS: { to: string; title: string; desc: string; icon: LucideIcon; accent: Accent }[] = [
  { to: '/admin/users', title: 'User Management', desc: 'Manage users, credits, and permissions', icon: Users, accent: 'blue' },
  { to: '/admin/content', title: 'Content Moderation', desc: 'Review and moderate pitch content', icon: Film, accent: 'purple' },
  { to: '/admin/verifications', title: 'Verifications', desc: 'Review company & producer verification', icon: BadgeCheck, accent: 'indigo' },
  { to: '/admin/transactions', title: 'Transactions', desc: 'View payments and process refunds', icon: CreditCard, accent: 'green' },
  { to: '/admin/promo-codes', title: 'Promo Codes', desc: 'Launch codes and who redeemed them', icon: Ticket, accent: 'pink' },
  { to: '/admin/analytics', title: 'Analytics', desc: 'Platform usage and performance', icon: BarChart3, accent: 'red' },
  { to: '/admin/system-health', title: 'System Health', desc: 'Monitor system status', icon: Activity, accent: 'orange' },
  { to: '/admin/settings', title: 'System Settings', desc: 'Configure platform settings', icon: Settings, accent: 'indigo' },
];

const ACCENT_CHIP: Record<Accent, string> = {
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  green: 'bg-green-50 text-green-600',
  orange: 'bg-orange-50 text-orange-600',
  pink: 'bg-pink-50 text-pink-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  red: 'bg-red-50 text-red-600',
};

const ACTIVITY_ICON: Record<string, LucideIcon> = {
  user_signup: UserPlus,
  pitch_created: Film,
  nda_signed: FileText,
  payment_received: DollarSign,
};

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { reportError, trackEvent, trackApiError } = useSentryPortal({
    portalType: 'admin',
    componentName: 'AdminDashboard',
    trackPerformance: true,
  });

  useEffect(() => {
    void loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      trackEvent('admin.dashboard.load', { timestamp: new Date().toISOString() });

      const [statsData, activityData] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getRecentActivity(),
      ]);

      if (statsData) {
        setStats(statsData);
        trackEvent('admin.stats.loaded', { totalUsers: statsData.totalUsers, totalPitches: statsData.totalPitches });
      } else {
        trackApiError('/api/admin/stats', { success: false });
      }

      if (activityData) {
        setRecentActivity(activityData);
      } else {
        trackApiError('/api/admin/activity', { success: false });
      }
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
      reportError(err as Error, { context: 'loadDashboardData', severity: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void loadDashboardData();
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-gray-200">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-gray-200 h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h2>
        <p className="text-red-600">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Admin Dashboard"
        subtitle="Platform overview and management tools"
        actions={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          label="Total Users" icon={Users} accent="blue"
          value={(stats?.totalUsers ?? 0).toLocaleString()}
          sub={`+${(stats?.recentSignups ?? 0).toLocaleString()} this week`} subTone="positive"
        />
        <StatCard
          label="Total Pitches" icon={Film} accent="purple"
          value={(stats?.totalPitches ?? 0).toLocaleString()}
          sub={`${stats?.approvedPitches ?? 0} approved · ${stats?.rejectedPitches ?? 0} rejected`} subTone="muted"
        />
        <StatCard
          label="Total Revenue" icon={DollarSign} accent="green"
          value={formatCurrency(stats?.totalRevenue || 0)}
          sub="This month" subTone="positive"
        />
        <StatCard
          label="Pending NDAs" icon={FileText} accent="orange"
          value={(stats?.pendingNDAs ?? 0).toLocaleString()}
          sub={`${(stats?.activeUsers ?? 0).toLocaleString()} active users`} subTone="info"
        />
      </div>

      {/* Management shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {MANAGEMENT_LINKS.map(({ to, title, desc, icon: Icon, accent }) => (
          <Link
            key={to}
            to={to}
            className="group bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all flex items-center gap-4"
          >
            <div className={`p-3 rounded-lg flex-shrink-0 ${ACCENT_CHIP[accent]}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500 truncate">{desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-400 flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="p-4">
          {recentActivity.length === 0 ? (
            <div className="text-center py-10">
              <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentActivity.slice(0, 10).map((activity) => {
                const Icon = ACTIVITY_ICON[activity.type] ?? Activity;
                return (
                  <div key={activity.id} className="flex items-center gap-3 px-2 py-3 hover:bg-gray-50 rounded-lg">
                    <div className="p-2 rounded-lg bg-gray-100 text-gray-500 flex-shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                        {activity.user && ` · ${activity.user}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default withPortalErrorBoundary(AdminDashboard, 'admin');
