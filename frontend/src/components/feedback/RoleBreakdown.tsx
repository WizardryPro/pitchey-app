import type { RoleBreakdown as RoleBreakdownData, RoleBreakdownEntry } from '../../services/feedback.service';
import { ReviewerBadge } from './ReviewerBadge';
import PitcheyRating from '../PitcheyRating';

// Industry (high-weight) roles shown on the left; Audience (low-weight) on the right.
// Order within each column is by weight descending — most authoritative at top.
// Weights are from heat_role_weights: production=4, investor=3, creator=1, peer=1, viewer/watcher=0.5, anonymous=0.25.
const INDUSTRY_ROLES = ['production', 'investor', 'creator', 'peer'] as const;
const AUDIENCE_ROLES = ['viewer', 'watcher', 'anonymous'] as const;

type RoleKey = keyof RoleBreakdownData;

function countsInColumn(breakdown: RoleBreakdownData, roles: readonly RoleKey[]): number {
  return roles.reduce((sum, r) => sum + (breakdown[r]?.count ?? 0), 0);
}

function Row({ role, entry }: { role: RoleKey; entry: RoleBreakdownEntry | undefined }) {
  if (!entry || entry.count === 0) {
    // Em-dash placeholder keeps column heights stable regardless of which roles have data.
    return (
      <div className="flex items-center justify-between py-1.5 text-sm text-gray-300">
        <ReviewerBadge type={role} />
        <span>—</span>
      </div>
    );
  }
  const countLabel = `${entry.count} ${entry.count === 1 ? 'rating' : 'ratings'}`;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <ReviewerBadge type={role} />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">{countLabel}</span>
        <PitcheyRating mode="compact" value={entry.weightedAvg} />
      </div>
    </div>
  );
}

function Column({
  title,
  subtitle,
  roles,
  breakdown,
}: {
  title: string;
  subtitle: string;
  roles: readonly RoleKey[];
  breakdown: RoleBreakdownData;
}) {
  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</h4>
        <p className="text-[11px] text-gray-400">{subtitle}</p>
      </div>
      <div className="divide-y divide-gray-100">
        {roles.map((role) => (
          <Row key={role} role={role} entry={breakdown[role]} />
        ))}
      </div>
    </div>
  );
}

interface Props {
  breakdown: RoleBreakdownData | undefined;
}

export function RoleBreakdown({ breakdown }: Props) {
  if (!breakdown) return null;
  const totalCount = countsInColumn(breakdown, [...INDUSTRY_ROLES, ...AUDIENCE_ROLES]);
  if (totalCount === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Role breakdown</h3>
        <p className="text-xs text-gray-500">Weighted averages by reviewer role</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <Column
          title="Industry"
          subtitle="Production ×4, Investor ×3, Creator/Peer ×1"
          roles={INDUSTRY_ROLES}
          breakdown={breakdown}
        />
        <Column
          title="Audience"
          subtitle="Viewer/Watcher ×0.5, Anonymous ×0.25"
          roles={AUDIENCE_ROLES}
          breakdown={breakdown}
        />
      </div>
    </div>
  );
}

export default RoleBreakdown;
