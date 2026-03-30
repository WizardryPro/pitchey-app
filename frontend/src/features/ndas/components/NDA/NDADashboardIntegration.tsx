import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Clock, CheckCircle, AlertTriangle, 
  FileText, TrendingUp, Bell, Eye, 
  ArrowRight, Calendar, Users
} from 'lucide-react';
import { ndaService, type NDA } from '../../services/nda.service';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import NDAStatusBadge from '../NDAStatusBadge';

interface NDADashboardStats {
  totalNDAs: number;
  pendingRequests: number;
  activeSigned: number;
  expiringSoon: number;
  recentActivity: number;
}

interface RecentNDAActivity {
  id: number;
  type: 'request' | 'signed' | 'approved' | 'rejected' | 'expired';
  pitchTitle: string;
  partnerName: string;
  timestamp: string;
  status: string;
}

interface NDADashboardIntegrationProps {
  userType: 'creator' | 'investor' | 'production';
  compact?: boolean;
  showHeader?: boolean;
}

export default function NDADashboardIntegration({ 
  userType, 
  compact = false,
  showHeader = true 
}: NDADashboardIntegrationProps) {
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  const [stats, setStats] = useState<NDADashboardStats>({
    totalNDAs: 0,
    pendingRequests: 0,
    activeSigned: 0,
    expiringSoon: 0,
    recentActivity: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentNDAActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNDADashboardData();
  }, [userType]);

  const fetchNDADashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch NDA statistics
      const statsResponse = await ndaService.getNDAStats();
      
      // Fetch recent NDAs for activity
      const ndaFilters = {
        limit: compact ? 3 : 5,
        offset: 0
      };
      const { ndas } = await ndaService.getNDAs(ndaFilters);

      // Calculate expiring soon (within 30 days)
      const expiringSoon = ndas.filter(nda => {
        if (!nda.expiresAt || nda.status !== 'signed') return false;
        const expiryDate = new Date(nda.expiresAt);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        return expiryDate <= thirtyDaysFromNow;
      }).length;

      setStats({
        totalNDAs: statsResponse.total,
        pendingRequests: statsResponse.pending,
        activeSigned: statsResponse.approved, // signed NDAs
        expiringSoon,
        recentActivity: ndas.length,
      });

      // Transform NDAs into recent activity
      const activity: RecentNDAActivity[] = ndas.slice(0, compact ? 3 : 5).map(nda => ({
        id: nda.id,
        type: getActivityType(nda.status),
        pitchTitle: nda.pitchTitle || (nda as any).pitch_title || 'Untitled Pitch',
        partnerName: getPartnerName(nda, userType),
        timestamp: nda.updatedAt || nda.createdAt,
        status: nda.status
      }));

      setRecentActivity(activity);
    } catch (err) {
      // Silently handle auth errors — the parent dashboard already guards auth,
      // so a 401 here just means cross-origin cookies weren't sent.
      // Show empty state instead of an error to match the rest of the dashboard.
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Authentication required') || msg.includes('Unauthorized')) {
        console.warn('[NDA Widget] Auth not available, showing empty state');
      } else {
        console.error('Failed to fetch NDA dashboard data:', err);
        setError(msg || 'Failed to load NDA data');
      }
    } finally {
      setLoading(false);
    }
  };

  const getActivityType = (status: string): RecentNDAActivity['type'] => {
    switch (status) {
      case 'pending': return 'request';
      case 'signed': return 'signed';
      case 'approved': return 'approved';
      case 'rejected': return 'rejected';
      case 'expired': return 'expired';
      default: return 'request';
    }
  };

  const getPartnerName = (nda: NDA, userType: string): string => {
    // For creators, show the requester/signer name
    // For investors/production, show the creator name
    const raw = nda as any;
    if (userType === 'creator') {
      return nda.requesterName || nda.signerName || raw.requester_username || 'Unknown User';
    } else {
      return nda.creatorName || raw.creator_username || 'Unknown Creator';
    }
  };

  const getActivityIcon = (type: RecentNDAActivity['type']) => {
    switch (type) {
      case 'request': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'signed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'approved': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'rejected': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'expired': return <AlertTriangle className="w-4 h-4 text-gray-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityText = (activity: RecentNDAActivity, userType: string) => {
    const isCreator = userType === 'creator';
    
    switch (activity.type) {
      case 'request':
        return isCreator 
          ? `${activity.partnerName} requested NDA for "${activity.pitchTitle}"`
          : `You requested NDA for "${activity.pitchTitle}"`;
      case 'signed':
        return isCreator
          ? `${activity.partnerName} signed NDA for "${activity.pitchTitle}"`
          : `You signed NDA for "${activity.pitchTitle}"`;
      case 'approved':
        return isCreator
          ? `You approved NDA request for "${activity.pitchTitle}"`
          : `Your NDA request for "${activity.pitchTitle}" was approved`;
      case 'rejected':
        return isCreator
          ? `You rejected NDA request for "${activity.pitchTitle}"`
          : `Your NDA request for "${activity.pitchTitle}" was rejected`;
      case 'expired':
        return `NDA for "${activity.pitchTitle}" has expired`;
      default:
        return `Activity on "${activity.pitchTitle}"`;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNDAManagementPath = () => {
    switch (userType) {
      case 'creator': return '/creator/ndas';
      case 'investor': return '/investor/nda-requests';
      case 'production': return '/production/ndas';
      default: return '/nda';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm ${compact ? 'p-4' : 'p-6'}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-xl shadow-sm ${compact ? 'p-4' : 'p-6'}`}>
        <div className="text-center py-4">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchNDADashboardData}
            className="mt-2 text-xs text-purple-600 hover:text-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4">
        {showHeader && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              NDAs
            </h3>
            <button
              onClick={() => navigate(getNDAManagementPath())}
              className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Compact Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-2 bg-amber-50 rounded-lg">
            <div className="text-lg font-bold text-amber-600">{stats.pendingRequests}</div>
            <div className="text-xs text-amber-700">Pending</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">{stats.activeSigned}</div>
            <div className="text-xs text-green-700">Active</div>
          </div>
        </div>

        {/* Compact Activity */}
        {recentActivity.length > 0 ? (
          <div className="space-y-2">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-2 text-xs">
                {getActivityIcon(activity.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 truncate">
                    {getActivityText(activity, userType)}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {formatTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-3">
            <Shield className="w-6 h-6 text-gray-400 mx-auto mb-1" />
            <p className="text-xs text-gray-500">No recent NDA activity</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            NDA Management
          </h2>
          <button
            onClick={() => navigate(getNDAManagementPath())}
            className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
          >
            <Eye className="w-4 h-4" />
            View All NDAs
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.pendingRequests}</p>
              <p className="text-sm text-amber-700">Pending Requests</p>
            </div>
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          {stats.pendingRequests > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
              <Bell className="w-3 h-3" />
              Requires attention
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.activeSigned}</p>
              <p className="text-sm text-green-700">Active NDAs</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.totalNDAs}</p>
              <p className="text-sm text-blue-700">Total NDAs</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-purple-600">{stats.expiringSoon}</p>
              <p className="text-sm text-purple-700">Expiring Soon</p>
            </div>
            <Calendar className="w-8 h-8 text-purple-500" />
          </div>
          {stats.expiringSoon > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-purple-600">
              <AlertTriangle className="w-3 h-3" />
              Within 30 days
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            Recent Activity
          </h3>
          {recentActivity.length > 0 && (
            <span className="text-sm text-gray-500">
              Last {recentActivity.length} activities
            </span>
          )}
        </div>

        {recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div 
                key={activity.id} 
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    {getActivityText(activity, userType)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                    <NDAStatusBadge 
                      status={activity.status as any} 
                      showLabel={false}
                      className="scale-75"
                    />
                  </div>
                </div>
                <button
                  onClick={() => navigate(getNDAManagementPath())}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-purple-600 transition"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h4 className="font-medium text-gray-900 mb-1">No recent NDA activity</h4>
            <p className="text-sm text-gray-500 mb-4">
              {userType === 'creator' 
                ? 'NDA requests from investors and production companies will appear here'
                : 'Your NDA requests and signed agreements will appear here'
              }
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Browse Pitches
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {stats.pendingRequests > 0 && userType === 'creator' && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-amber-600" />
            <div className="flex-1">
              <h4 className="font-medium text-amber-900">
                You have {stats.pendingRequests} pending NDA request{stats.pendingRequests !== 1 ? 's' : ''}
              </h4>
              <p className="text-sm text-amber-700">
                Review and respond to maintain good investor relations
              </p>
            </div>
            <button
              onClick={() => navigate(getNDAManagementPath())}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm"
            >
              Review Now
            </button>
          </div>
        </div>
      )}

      {stats.expiringSoon > 0 && (
        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-purple-600" />
            <div className="flex-1">
              <h4 className="font-medium text-purple-900">
                {stats.expiringSoon} NDA{stats.expiringSoon !== 1 ? 's' : ''} expiring soon
              </h4>
              <p className="text-sm text-purple-700">
                Consider renewing or extending these agreements
              </p>
            </div>
            <button
              onClick={() => navigate(getNDAManagementPath())}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
            >
              Manage
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick NDA Status Component for other dashboard sections
export function QuickNDAStatus({ userType }: { userType: 'creator' | 'investor' | 'production' }) {
  return (
    <NDADashboardIntegration 
      userType={userType} 
      compact={true} 
      showHeader={true}
    />
  );
}

// NDA Stats Only Component
export function NDAStatsWidget({ userType }: { userType: 'creator' | 'investor' | 'production' }) {
  const [stats, setStats] = useState<NDADashboardStats>({
    totalNDAs: 0,
    pendingRequests: 0,
    activeSigned: 0,
    expiringSoon: 0,
    recentActivity: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const statsResponse = await ndaService.getNDAStats();
        setStats({
          totalNDAs: statsResponse.total,
          pendingRequests: statsResponse.pending,
          activeSigned: statsResponse.approved,
          expiringSoon: 0, // Would need additional calculation
          recentActivity: 0,
        });
      } catch (error) {
        console.error('Failed to fetch NDA stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
        <div className="text-xl font-bold text-amber-600">{stats.pendingRequests}</div>
        <div className="text-xs text-amber-700">Pending</div>
      </div>
      <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
        <div className="text-xl font-bold text-green-600">{stats.activeSigned}</div>
        <div className="text-xs text-green-700">Active</div>
      </div>
      <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-xl font-bold text-blue-600">{stats.totalNDAs}</div>
        <div className="text-xs text-blue-700">Total</div>
      </div>
    </div>
  );
}