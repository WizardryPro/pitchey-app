import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Activity, Film, FolderOpen, Upload,
  Bookmark, Users, GitBranch,
  MessageSquare, Calendar, Settings, UserPlus, Shield, FileText
} from 'lucide-react';
import { PRODUCTION_ROUTES } from '@/config/navigation.routes';

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

export const productionNavigationSections: NavigationSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Overview', path: PRODUCTION_ROUTES.dashboard, icon: Home },
      { label: 'Activity', path: PRODUCTION_ROUTES.activity, icon: Activity },
      { label: 'Verification', path: PRODUCTION_ROUTES.verification, icon: Shield },
    ],
  },
  {
    title: 'Projects',
    items: [
      { label: 'All Projects', path: PRODUCTION_ROUTES.projects, icon: Film },
      { label: 'Pipeline', path: PRODUCTION_ROUTES.pipeline, icon: GitBranch },
    ],
  },
  {
    title: 'Submissions',
    items: [
      { label: 'Submissions', path: PRODUCTION_ROUTES.submissions, icon: FolderOpen },
      { label: 'Invite Creators', path: PRODUCTION_ROUTES.invites, icon: UserPlus },
    ],
  },
  {
    title: 'Pitches',
    items: [
      { label: 'My Pitches', path: PRODUCTION_ROUTES.pitches, icon: FileText },
      { label: 'Create Pitch', path: PRODUCTION_ROUTES.pitchNew, icon: Upload },
      { label: 'Saved Pitches', path: PRODUCTION_ROUTES.saved, icon: Bookmark },
      { label: 'Following', path: PRODUCTION_ROUTES.following, icon: Users },
    ],
  },
  {
    title: 'Team',
    items: [
      { label: 'Members', path: PRODUCTION_ROUTES.teamManagement, icon: Users },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Collaborations', path: PRODUCTION_ROUTES.collaborations, icon: GitBranch },
      { label: 'My Collaborations', path: PRODUCTION_ROUTES.myCollaborations, icon: GitBranch },
    ],
  },
  {
    title: '',
    items: [
      { label: 'Messages', path: PRODUCTION_ROUTES.messages, icon: MessageSquare },
      { label: 'Calendar', path: PRODUCTION_ROUTES.calendar, icon: Calendar },
      { label: 'Settings', path: PRODUCTION_ROUTES.settings, icon: Settings },
    ],
  },
];

export function EnhancedProductionNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold text-brand-portal-production mb-4">Production Portal</h2>

        {productionNavigationSections.map((section, sectionIdx) => (
          <div key={section.title || `section-${sectionIdx}`} className="mb-5">
            {section.title && (
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path ||
                  (item.path !== PRODUCTION_ROUTES.dashboard && location.pathname.startsWith(item.path));

                return (
                  <button
                    key={item.path + item.label}
                    onClick={() => navigate(item.path)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                      transition-colors duration-200
                      ${isActive
                        ? 'bg-brand-portal-production/10 text-brand-portal-production font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
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
