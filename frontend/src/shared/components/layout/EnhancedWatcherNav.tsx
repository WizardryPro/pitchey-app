import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Home, Library,
  CreditCard, User, Settings, Store, ExternalLink
} from 'lucide-react';
import { WATCHER_ROUTES } from '@/config/navigation.routes';

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export const watcherNavigationSections: NavigationSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Overview', path: WATCHER_ROUTES.dashboard, icon: Home },
      { label: 'My Library', path: WATCHER_ROUTES.library, icon: Library },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Credits & Billing', path: WATCHER_ROUTES.billing, icon: CreditCard },
      { label: 'Profile', path: WATCHER_ROUTES.profile, icon: User },
      { label: 'Settings', path: WATCHER_ROUTES.settings, icon: Settings },
    ],
  },
];

export function EnhancedWatcherNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold text-cyan-600 mb-4">Watcher Portal</h2>

        {/* Quick Links */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Quick Links
          </h3>
          <div className="space-y-1">
            <Link
              to="/"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-cyan-50 hover:text-cyan-600 transition-colors duration-200"
            >
              <Home className="w-4 h-4" />
              <span className="flex-1 text-left">Home</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>
            <Link
              to="/marketplace"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-cyan-50 hover:text-cyan-600 transition-colors duration-200"
            >
              <Store className="w-4 h-4" />
              <span className="flex-1 text-left">Marketplace</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>
          </div>
        </div>

        {watcherNavigationSections.map((section) => (
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
                        ? 'bg-cyan-50 text-cyan-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{item.label}</span>
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
