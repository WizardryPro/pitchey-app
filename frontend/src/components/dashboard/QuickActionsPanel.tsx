import type { LucideIcon } from 'lucide-react';

// Shared Quick Actions panel — the creator-dashboard style, reused across the
// creator, production and investor dashboards so they stay visually identical.
// Tailwind JIT needs full literal class strings, so accents map to complete
// class strings rather than interpolated fragments.

export type QuickActionAccent = 'purple' | 'gray' | 'amber' | 'blue' | 'green' | 'indigo' | 'rose';

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  accent?: QuickActionAccent;
}

interface QuickActionsPanelProps {
  actions: QuickAction[];
  className?: string;
}

const ACCENTS: Record<QuickActionAccent, { icon: string; hoverBorder: string; halo: string }> = {
  purple: { icon: 'from-purple-500 to-indigo-600 shadow-purple-500/30', hoverBorder: 'hover:border-purple-200', halo: 'group-hover:from-purple-100/60 group-hover:to-indigo-100/40' },
  indigo: { icon: 'from-indigo-500 to-purple-600 shadow-indigo-500/30', hoverBorder: 'hover:border-indigo-200', halo: 'group-hover:from-indigo-100/60 group-hover:to-purple-100/40' },
  gray:   { icon: 'from-gray-400 to-gray-500', hoverBorder: 'hover:border-purple-200', halo: 'group-hover:from-gray-100/60 group-hover:to-gray-100/40' },
  amber:  { icon: 'from-amber-500 to-orange-600 shadow-amber-500/30', hoverBorder: 'hover:border-amber-200', halo: 'group-hover:from-amber-100/60 group-hover:to-orange-100/40' },
  blue:   { icon: 'from-blue-500 to-indigo-600 shadow-blue-500/30', hoverBorder: 'hover:border-blue-200', halo: 'group-hover:from-blue-100/60 group-hover:to-indigo-100/40' },
  green:  { icon: 'from-green-500 to-emerald-600 shadow-green-500/30', hoverBorder: 'hover:border-green-200', halo: 'group-hover:from-green-100/60 group-hover:to-emerald-100/40' },
  rose:   { icon: 'from-rose-500 to-pink-600 shadow-rose-500/30', hoverBorder: 'hover:border-rose-200', halo: 'group-hover:from-rose-100/60 group-hover:to-pink-100/40' },
};

export default function QuickActionsPanel({ actions, className = '' }: QuickActionsPanelProps) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
      <p className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Quick Actions</p>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const accent = ACCENTS[action.accent ?? 'purple'];
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              className={`group relative overflow-hidden flex flex-col items-center gap-2 p-4 bg-white border border-gray-100 rounded-xl ${accent.hoverBorder} hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
            >
              <div aria-hidden className={`absolute -top-6 -right-6 w-16 h-16 bg-gradient-to-br from-transparent to-transparent ${accent.halo} rounded-full blur-xl transition-all duration-300`} />
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${accent.icon} text-white shadow-sm group-hover:scale-105 transition-all duration-200`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-gray-700">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
