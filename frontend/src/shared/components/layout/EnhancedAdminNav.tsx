import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, BarChart3, Activity, Users, FileText, Shield,
  DollarSign, FileBarChart, ClipboardList, Lock, Settings,
  BadgeCheck, Ticket
} from 'lucide-react';
import { ADMIN_ROUTES } from '@/config/navigation.routes';

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: number | string;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export const adminNavigationSections: NavigationSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Overview', path: ADMIN_ROUTES.dashboard, icon: Home },
      { label: 'Analytics', path: ADMIN_ROUTES.analytics, icon: BarChart3 },
      { label: 'System Health', path: ADMIN_ROUTES.systemHealth, icon: Activity },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Users', path: ADMIN_ROUTES.users, icon: Users },
      { label: 'Content Moderation', path: ADMIN_ROUTES.content, icon: FileText },
      { label: 'Verifications', path: ADMIN_ROUTES.verifications, icon: BadgeCheck },
      { label: 'Moderation Log', path: ADMIN_ROUTES.moderationLog, icon: ClipboardList },
    ],
  },
  {
    title: 'Financial',
    items: [
      { label: 'Transactions', path: ADMIN_ROUTES.transactions, icon: DollarSign },
      { label: 'Promo Codes', path: ADMIN_ROUTES.promoCodes, icon: Ticket },
      { label: 'Reports', path: ADMIN_ROUTES.reports, icon: FileBarChart },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { label: 'Audit Log', path: ADMIN_ROUTES.auditLog, icon: Shield },
      { label: 'GDPR', path: ADMIN_ROUTES.gdpr, icon: Lock },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', path: ADMIN_ROUTES.settings, icon: Settings },
    ],
  },
];

export function EnhancedAdminNav({ collapsed = false }: { collapsed?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="w-full">
      <div className={collapsed ? 'p-2' : 'p-4'}>
        {!collapsed && <h2 className="text-xl font-bold text-purple-900 mb-4">Admin Portal</h2>}

        {adminNavigationSections.map((section) => (
          <div key={section.title} className={collapsed ? 'mb-2' : 'mb-6'}>
            {!collapsed && (
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    title={collapsed ? item.label : undefined}
                    className={`
                      w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm
                      transition-colors duration-200
                      ${isActive
                        ? 'bg-purple-100 text-purple-900 font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                    {!collapsed && item.badge && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
