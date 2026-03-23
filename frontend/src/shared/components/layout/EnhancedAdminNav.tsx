import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Home, BarChart3, Activity, Users, FileText, Shield,
  DollarSign, FileBarChart, ClipboardList, Lock, Settings,
  Store, ExternalLink
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
      { label: 'Moderation Log', path: ADMIN_ROUTES.moderationLog, icon: ClipboardList },
    ],
  },
  {
    title: 'Financial',
    items: [
      { label: 'Transactions', path: ADMIN_ROUTES.transactions, icon: DollarSign },
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

export function EnhancedAdminNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold text-purple-900 mb-4">Admin Portal</h2>

        {/* Quick Links - Always visible at top */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Quick Links
          </h3>
          <div className="space-y-1">
            <Link
              to="/"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-900 transition-colors duration-200"
            >
              <Home className="w-4 h-4" />
              <span className="flex-1 text-left">Home</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>
            <Link
              to="/marketplace"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-900 transition-colors duration-200"
            >
              <Store className="w-4 h-4" />
              <span className="flex-1 text-left">Marketplace</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>
          </div>
        </div>

        {adminNavigationSections.map((section) => (
          <div key={section.title} className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                      transition-colors duration-200
                      ${isActive
                        ? 'bg-purple-100 text-purple-900 font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
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
