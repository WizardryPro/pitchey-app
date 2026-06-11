import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Right-aligned slot for actions (refresh, export, filters, etc.). */
  actions?: React.ReactNode;
}

/** Shared admin page header so every admin screen leads with the same title/action layout. */
export function AdminPageHeader({ title, subtitle, icon: Icon, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="p-2 rounded-lg bg-purple-50 text-purple-700 flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
