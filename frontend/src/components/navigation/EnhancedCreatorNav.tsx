import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Home, BarChart3, Activity, TrendingUp, Film, Plus, FolderOpen,
  FileText, Users, UserPlus, Shield, GitBranch, User, Settings,
  Calendar, MessageSquare, Eye, Upload, Target, Star, Store, ExternalLink,
  Scale, FileSignature, Library, FilePlus, GitCompare
} from 'lucide-react';
import { CREATOR_ROUTES } from '../../config/navigation.routes';

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
      { label: 'Stats', path: CREATOR_ROUTES.stats, icon: TrendingUp },
    ],
  },
  {
    title: 'Projects',
    items: [
      { label: 'My Pitches', path: CREATOR_ROUTES.pitches, icon: Film },
      { label: 'Create New', path: CREATOR_ROUTES.pitchNew, icon: Plus },
      { label: 'Published', path: CREATOR_ROUTES.pitchesPublished, icon: Upload },
      { label: 'Drafts', path: CREATOR_ROUTES.pitchesDrafts, icon: FolderOpen },
      { label: 'Under Review', path: CREATOR_ROUTES.pitchesReview, icon: Eye },
      { label: 'Pitch Analytics', path: CREATOR_ROUTES.pitchesAnalytics, icon: BarChart3 },
    ],
  },
  {
    title: 'Team',
    items: [
      { label: 'Members', path: CREATOR_ROUTES.teamMembers, icon: Users },
      { label: 'Invite', path: CREATOR_ROUTES.teamInvite, icon: UserPlus },
      { label: 'Roles', path: CREATOR_ROUTES.teamRoles, icon: Shield },
      { label: 'Collaborations', path: CREATOR_ROUTES.collaborations, icon: GitBranch },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Messages', path: CREATOR_ROUTES.messages, icon: MessageSquare },
      { label: 'Calendar', path: CREATOR_ROUTES.calendar, icon: Calendar },
      { label: 'NDAs', path: CREATOR_ROUTES.ndas, icon: FileText },
    ],
  },
  {
    title: 'Legal',
    items: [
      { label: 'Documents', path: CREATOR_ROUTES.legalLibrary, icon: Library },
      { label: 'Create Document', path: CREATOR_ROUTES.legalWizard, icon: FilePlus },
      { label: 'Templates', path: CREATOR_ROUTES.legalTemplates, icon: FileSignature },
      { label: 'Compare', path: CREATOR_ROUTES.legalCompare, icon: GitCompare },
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
];

export function EnhancedCreatorNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold text-purple-600 mb-4">Creator Portal</h2>

        {/* Quick Links - Always visible at top */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Quick Links
          </h3>
          <div className="space-y-1">
            <Link
              to="/"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors duration-200"
            >
              <Home className="w-4 h-4" />
              <span className="flex-1 text-left">Home</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>
            <Link
              to="/marketplace"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors duration-200"
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
                const isActive = location.pathname === item.path;
                
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                      transition-colors duration-200
                      ${isActive 
                        ? 'bg-purple-50 text-purple-600 font-medium' 
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