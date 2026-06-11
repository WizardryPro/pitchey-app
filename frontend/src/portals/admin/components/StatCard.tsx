import React from 'react';
import type { LucideIcon } from 'lucide-react';

type Accent = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'pink' | 'indigo';

// Full literal class strings so Tailwind's content scanner keeps them in the build.
const ACCENT: Record<Accent, string> = {
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  green: 'bg-green-50 text-green-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  pink: 'bg-pink-50 text-pink-600',
  indigo: 'bg-indigo-50 text-indigo-600',
};

const SUB_TONE = {
  positive: 'text-green-600',
  muted: 'text-gray-500',
  info: 'text-blue-600',
  warning: 'text-orange-600',
} as const;

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  accent?: Accent;
  sub?: React.ReactNode;
  subTone?: keyof typeof SUB_TONE;
}

/** Consistent KPI card for the admin portal — icon chip + label + value + optional sub line. */
export function StatCard({ label, value, icon: Icon, accent = 'purple', sub, subTone = 'muted' }: StatCardProps) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
        </div>
        <div className={`p-2.5 rounded-lg flex-shrink-0 ${ACCENT[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {sub != null && <p className={`mt-3 text-sm ${SUB_TONE[subTone]}`}>{sub}</p>}
    </div>
  );
}
