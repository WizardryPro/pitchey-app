import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Activity, Upload,
  Bookmark, Users, Handshake,
  MessageSquare, Settings, UserPlus, Shield, FileText
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
    title: 'Pitches',
    items: [
      { label: 'My Pitches', path: PRODUCTION_ROUTES.pitches, icon: FileText },
      { label: 'Create Pitch', path: PRODUCTION_ROUTES.pitchNew, icon: Upload },
      { label: 'Saved Pitches', path: PRODUCTION_ROUTES.saved, icon: Bookmark },
    ],
  },
  // Nav consolidation 2026-06-03 — merged the single-item Creators/Team sections and the
  // Operations section into one "People" group. PARKED from the nav (routes + pages still
  // reachable by direct URL, not deleted):
  //   • "Members"          (internal crew — PRODUCTION_ROUTES.teamManagement)
  //   • "My Collaborations" (your seat on other companies' projects — .myCollaborations)
  // Both hang off the projects/pipeline surface that's on hold. Revive by re-adding their
  // items here. ("Projects"/"Pipeline" and the "Submissions" review pipeline were parked
  // earlier the same way.) "Collaborations" (external business partners) stays.
  {
    title: 'People',
    items: [
      { label: 'Invite Creators', path: PRODUCTION_ROUTES.invites, icon: UserPlus },
      { label: 'Following', path: PRODUCTION_ROUTES.following, icon: Users },
      { label: 'Collaborations', path: PRODUCTION_ROUTES.collaborations, icon: Handshake },
    ],
  },
  {
    title: '',
    items: [
      { label: 'Messages', path: PRODUCTION_ROUTES.messages, icon: MessageSquare },
      { label: 'Settings', path: PRODUCTION_ROUTES.settings, icon: Settings },
    ],
  },
];

export function EnhancedProductionNav({ collapsed = false }: { collapsed?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="w-full">
      <div className={collapsed ? 'p-2' : 'p-4'}>
        {!collapsed && <h2 className="text-xl font-bold text-brand-portal-production mb-4">Production Portal</h2>}

        {productionNavigationSections.map((section, sectionIdx) => (
          <div key={section.title || `section-${sectionIdx}`} className={collapsed ? 'mb-2' : 'mb-5'}>
            {!collapsed && section.title && (
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
                    title={collapsed ? item.label : undefined}
                    className={`
                      w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm
                      transition-colors duration-200
                      ${isActive
                        ? 'bg-brand-portal-production/10 text-brand-portal-production font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                    {!collapsed && item.badge && (
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
