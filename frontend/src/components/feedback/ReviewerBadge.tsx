import { Briefcase, TrendingUp, User, Users, Eye, UserCircle, HelpCircle } from 'lucide-react';
import type { ComponentType } from 'react';

type IconComponent = ComponentType<{ className?: string }>;

interface ReviewerBadgeConfig {
  label: string;
  color: string;
  icon: IconComponent;
}

// Canonical role set — matches reviewer_type values written by mapUserType() in
// src/handlers/pitch-feedback.ts. Weights shown in comments are from heat_role_weights.
// Colors use the canonical portal brand tokens (tailwind brand.portal-*) so a
// role reads as that role everywhere — NOT green (green is reserved for high
// Pitchey Scores, which is why a green "Investor" badge was misleading).
// Industry roles share no icon: Production = Briefcase, Investor = TrendingUp,
// so the two highest-weight reviewers are distinguishable at a glance.
const ROLE_CONFIG: Record<string, ReviewerBadgeConfig> = {
  // Industry (high weight)
  production: { label: 'Production', color: 'bg-brand-portal-production/10 text-brand-portal-production', icon: Briefcase },  // ×4
  investor:   { label: 'Investor',   color: 'bg-brand-portal-investor/10 text-brand-portal-investor',     icon: TrendingUp }, // ×3
  creator:    { label: 'Creator',    color: 'bg-brand-portal-creator/10 text-brand-portal-creator',       icon: User },       // ×1
  peer:       { label: 'Peer',       color: 'bg-teal-100 text-teal-700',     icon: Users },      // ×1

  // Audience (low weight)
  viewer:     { label: 'Viewer',     color: 'bg-gray-100 text-gray-600',     icon: Eye },        // ×0.5
  watcher:    { label: 'Watcher',    color: 'bg-gray-100 text-gray-600',     icon: Eye },        // ×0.5
  anonymous:  { label: 'Anonymous',  color: 'bg-gray-50 text-gray-500',      icon: UserCircle }, // ×0.25

  // Unknown fallback
  _fallback:  { label: 'User',       color: 'bg-gray-100 text-gray-600',     icon: HelpCircle },
};

interface Props {
  type: string;
}

export function ReviewerBadge({ type }: Props) {
  const c = ROLE_CONFIG[type] ?? ROLE_CONFIG._fallback;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

export default ReviewerBadge;
