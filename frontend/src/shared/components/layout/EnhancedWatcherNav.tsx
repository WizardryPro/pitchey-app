import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Compass, Library,
  User, Settings
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
    title: 'Watch',
    items: [
      { label: 'Overview', path: WATCHER_ROUTES.dashboard, icon: Home },
      { label: 'Discover', path: WATCHER_ROUTES.browse, icon: Compass },
      { label: 'My Library', path: WATCHER_ROUTES.library, icon: Library },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Profile', path: WATCHER_ROUTES.profile, icon: User },
      { label: 'Settings', path: WATCHER_ROUTES.settings, icon: Settings },
    ],
  },
];

export function EnhancedWatcherNav({ collapsed = false }: { collapsed?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="w-full">
      <div className={collapsed ? 'p-2' : 'p-4'}>
        {!collapsed && <h2 className="text-xl font-bold text-cyan-600 mb-4">Watcher Portal</h2>}

        {watcherNavigationSections.map((section) => (
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
                        ? 'bg-cyan-50 text-cyan-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
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
