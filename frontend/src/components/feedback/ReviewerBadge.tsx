import { Briefcase, User, Eye, UserCircle, HelpCircle } from 'lucide-react';
import type { ComponentType } from 'react';

type IconComponent = ComponentType<{ className?: string }>;

interface ReviewerBadgeConfig {
  label: string;
  color: string;
  icon: IconComponent;
}

// Canonical role set — matches reviewer_type values written by mapUserType() in
// src/handlers/pitch-feedback.ts. Weights shown in comments are from heat_role_weights.
const ROLE_CONFIG: Record<string, ReviewerBadgeConfig> = {
  // Industry (high weight)
  production: { label: 'Production', color: 'bg-blue-100 text-blue-700',     icon: Briefcase },  // ×4
  investor:   { label: 'Investor',   color: 'bg-green-100 text-green-700',   icon: Briefcase },  // ×3
  creator:    { label: 'Creator',    color: 'bg-purple-100 text-purple-700', icon: User },       // ×1
  peer:       { label: 'Peer',       color: 'bg-indigo-100 text-indigo-700', icon: User },       // ×1

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
