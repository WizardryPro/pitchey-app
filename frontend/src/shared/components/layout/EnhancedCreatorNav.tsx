import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Home, BarChart3, Activity, Film, Plus,
  FileText, Users, GitBranch, User, Settings,
  Calendar, MessageSquare, Target, Star, Store, ExternalLink,
  Library
} from 'lucide-react';
import { CREATOR_ROUTES } from '@/config/navigation.routes';

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

export const creatorNavigationSections: NavigationSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Overview', path: CREATOR_ROUTES.dashboard, icon: Home },
      { label: 'Analytics', path: CREATOR_ROUTES.analytics, icon: BarChart3 },
      { label: 'Activity', path: CREATOR_ROUTES.activity, icon: Activity },
    ],
  },
  {
    title: 'Pitches',
    items: [
      { label: 'My Pitches', path: CREATOR_ROUTES.pitches, icon: Film },
      { label: 'Create New', path: CREATOR_ROUTES.pitchNew, icon: Plus },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Messages', path: CREATOR_ROUTES.messages, icon: MessageSquare },
      { label: 'NDAs', path: CREATOR_ROUTES.ndas, icon: FileText },
      { label: 'Calendar', path: CREATOR_ROUTES.calendar, icon: Calendar },
    ],
  },
  {
    title: 'Profile',
    items: [
      { label: 'Portfolio', path: CREATOR_ROUTES.portfolio, icon: Star },
      { label: 'Following', path: CREATOR_ROUTES.following, icon: Target },
      { label: 'Profile', path: CREATOR_ROUTES.profile, icon: User },
      { label: 'Settings', path: CREATOR_ROUTES.settings, icon: Settings },
    ],
  },
  {
    title: 'Team & Legal',
    items: [
      { label: 'Team', path: CREATOR_ROUTES.teamMembers, icon: Users },
      { label: 'Collaborations', path: CREATOR_ROUTES.collaborations, icon: GitBranch },
      { label: 'Legal Documents', path: CREATOR_ROUTES.legalLibrary, icon: Library },
    ],
  },
];

export function EnhancedCreatorNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold text-brand-portal-creator mb-4">Creator Portal</h2>

        {/* Quick Links - Always visible at top */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Quick Links
          </h3>
          <div className="space-y-1">
            <Link
              to="/"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-brand-portal-creator/10 hover:text-brand-portal-creator transition-colors duration-200"
            >
              <Home className="w-4 h-4" />
              <span className="flex-1 text-left">Home</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>
            <Link
              to="/marketplace"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-brand-portal-creator/10 hover:text-brand-portal-creator transition-colors duration-200"
            >
              <Store className="w-4 h-4" />
              <span className="flex-1 text-left">Marketplace</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>
          </div>
        </div>

        {creatorNavigationSections.map((section) => (
          <div key={section.title} className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path
                  || (item.path === CREATOR_ROUTES.pitches && location.pathname.startsWith('/creator/pitches'))
                  || (item.path === CREATOR_ROUTES.analytics && (location.pathname === CREATOR_ROUTES.stats || location.pathname === CREATOR_ROUTES.pitchesAnalytics))
                  || (item.path === CREATOR_ROUTES.teamMembers && location.pathname.startsWith('/creator/team'))
                  || (item.path === CREATOR_ROUTES.collaborations && location.pathname.includes('collaborations'))
                  || (item.path === CREATOR_ROUTES.legalLibrary && location.pathname.startsWith('/legal'));
                
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                      transition-colors duration-200
                      ${isActive 
                        ? 'bg-brand-portal-creator/10 text-brand-portal-creator font-medium' 
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