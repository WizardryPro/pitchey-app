import { useEffect, useState } from 'react';
import { Eye, Heart, Users, TrendingUp } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface SocialProofBadgeProps {
  pitchId: number;
  viewCount: number;
  likeCount: number;
  isOwner?: boolean;
  isAuthenticated?: boolean;
}

interface ViewerBreakdownEntry {
  user_type: string;
  count: number;
}

interface RecentLiker {
  name?: string;
  userType: string;
}

interface RecentViewer {
  name: string;
  role: string;
  viewedAt: string;
}

interface EngagementData {
  viewerBreakdown?: ViewerBreakdownEntry[];
  recentLikers?: RecentLiker[];
  recentViewers?: RecentViewer[];
}

const USER_TYPE_LABELS: Record<string, string> = {
  investor: 'Investors',
  production: 'Production Cos',
  creator: 'Creators',
};

function formatUserTypeLabel(userType: string): string {
  return USER_TYPE_LABELS[userType] || userType;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function buildViewerBreakdownText(breakdown: ViewerBreakdownEntry[]): string {
  const parts = breakdown
    .filter((b) => b.count > 0)
    .map((b) => `${b.count} ${formatUserTypeLabel(b.user_type).toLowerCase()}`);
  return parts.length > 0 ? `Viewed by ${parts.join(', ')}` : '';
}

function buildLikerText(likers: RecentLiker[]): string {
  if (likers.length === 0) return '';

  const hasNames = likers.some((l) => l.name);

  if (hasNames) {
    const firstName = likers.find((l) => l.name)?.name;
    const othersCount = likers.length - 1;
    if (othersCount > 0) {
      return `Liked by ${firstName} and ${othersCount} other${othersCount > 1 ? 's' : ''}`;
    }
    return `Liked by ${firstName}`;
  }

  // No names available — group by userType
  const grouped: Record<string, number> = {};
  for (const l of likers) {
    grouped[l.userType] = (grouped[l.userType] || 0) + 1;
  }
  const parts = Object.entries(grouped).map(
    ([type, count]) => `${count} ${formatUserTypeLabel(type).toLowerCase()}`
  );
  return `Liked by ${parts.join(', ')}`;
}

function roleBadgeColor(role: string): string {
  switch (role) {
    case 'investor':
      return 'bg-emerald-100 text-emerald-700';
    case 'production':
      return 'bg-purple-100 text-purple-700';
    case 'creator':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function Skeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 animate-pulse">
      <div className="flex items-center gap-6 mb-3">
        <div className="h-5 w-20 bg-gray-200 rounded" />
        <div className="h-5 w-20 bg-gray-200 rounded" />
      </div>
      <div className="h-4 w-48 bg-gray-200 rounded mt-2" />
    </div>
  );
}

export default function SocialProofBadge({
  pitchId,
  viewCount,
  likeCount,
  isOwner = false,
  isAuthenticated = false,
}: SocialProofBadgeProps) {
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    setLoading(true);

    apiClient
      .get<EngagementData>(`/api/pitches/${pitchId}/engagement`)
      .then((response) => {
        if (!cancelled && response.success && response.data) {
          setEngagement(response.data);
        }
      })
      .catch((err) => {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to fetch engagement data:', e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pitchId, isAuthenticated]);

  if (loading) return <Skeleton />;

  const viewerText =
    engagement?.viewerBreakdown ? buildViewerBreakdownText(engagement.viewerBreakdown) : '';
  const likerText = engagement?.recentLikers ? buildLikerText(engagement.recentLikers) : '';
  const recentViewers =
    isOwner && engagement?.recentViewers ? engagement.recentViewers : [];

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      {/* Core counts */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5 text-gray-600">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-medium">{formatCount(viewCount)}</span>
          <span className="text-sm text-gray-400">views</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <Heart className="h-4 w-4" />
          <span className="text-sm font-medium">{formatCount(likeCount)}</span>
          <span className="text-sm text-gray-400">likes</span>
        </div>
      </div>

      {/* Viewer breakdown */}
      {viewerText && (
        <div className="flex items-center gap-1.5 mt-3 text-sm text-gray-500">
          <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{viewerText}</span>
        </div>
      )}

      {/* Liker summary */}
      {likerText && (
        <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
          <Users className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{likerText}</span>
        </div>
      )}

      {/* Recent viewers (owner only) */}
      {recentViewers.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Recent Viewers
          </h4>
          <ul className="space-y-2">
            {recentViewers.map((viewer, idx) => (
              <li key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700 font-medium">{viewer.name}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleBadgeColor(viewer.role)}`}
                  >
                    {formatUserTypeLabel(viewer.role)}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {formatRelativeTime(viewer.viewedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
