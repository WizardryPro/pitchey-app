import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Home, BarChart3, Activity, TrendingUp, Film, Layers, PlayCircle,
  Edit, CheckCircle, FolderOpen, Plus, Eye, ThumbsUp, ThumbsDown,
  Archive, GitBranch, DollarSign, Bookmark, UserPlus, Shield,
  Users, Settings, Clock, AlertCircle, FileCheck, Store, ExternalLink,
  Library, FilePlus, FileSignature, GitCompare
} from 'lucide-react';
import { PRODUCTION_ROUTES } from '../../config/navigation.routes';

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
      { label: 'Analytics', path: PRODUCTION_ROUTES.analytics, icon: BarChart3},
      { label: 'Activity', path: PRODUCTION_ROUTES.activity, icon: Activity},
      { label: 'Statistics', path: PRODUCTION_ROUTES.stats, icon: TrendingUp},
    ],
  },
  {
    title: 'Projects',
    items: [
      { label: 'All Projects', path: PRODUCTION_ROUTES.projects, icon: Film},
      { label: 'Active', path: PRODUCTION_ROUTES.projectsActive, icon: PlayCircle},
      { label: 'In Development', path: PRODUCTION_ROUTES.projectsDevelopment, icon: Edit},
      { label: 'Post-Production', path: PRODUCTION_ROUTES.projectsPost, icon: Layers},
      { label: 'Completed', path: PRODUCTION_ROUTES.projectsCompleted, icon: CheckCircle},
      { label: 'Pipeline', path: PRODUCTION_ROUTES.pipeline, icon: GitBranch},
    ],
  },
  {
    title: 'Submissions',
    items: [
      { label: 'All Submissions', path: PRODUCTION_ROUTES.submissions, icon: FolderOpen},
      { label: 'New', path: PRODUCTION_ROUTES.submissionsNew, icon: Plus, badge: '12'},
      { label: 'Under Review', path: PRODUCTION_ROUTES.submissionsReview, icon: Eye, badge: '8'},
      { label: 'Shortlisted', path: PRODUCTION_ROUTES.submissionsShortlisted, icon: FileCheck, badge: '5'},
      { label: 'Accepted', path: PRODUCTION_ROUTES.submissionsAccepted, icon: ThumbsUp},
      { label: 'Rejected', path: PRODUCTION_ROUTES.submissionsRejected, icon: ThumbsDown},
      { label: 'Archive', path: PRODUCTION_ROUTES.submissionsArchive, icon: Archive},
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Revenue', path: PRODUCTION_ROUTES.revenue, icon: DollarSign},
      { label: 'Saved Pitches', path: PRODUCTION_ROUTES.saved, icon: Bookmark},
      { label: 'Collaborations', path: PRODUCTION_ROUTES.collaborations, icon: GitBranch},
    ],
  },
  {
    title: 'Team',
    items: [
      { label: 'Invite Members', path: PRODUCTION_ROUTES.teamInvite, icon: UserPlus},
      { label: 'Manage Roles', path: PRODUCTION_ROUTES.teamRoles, icon: Shield},
    ],
  },
  {
    title: 'Legal',
    items: [
      { label: 'Documents', path: PRODUCTION_ROUTES.legalLibrary, icon: Library },
      { label: 'Create Document', path: PRODUCTION_ROUTES.legalWizard, icon: FilePlus},
      { label: 'Templates', path: PRODUCTION_ROUTES.legalTemplates, icon: FileSignature },
      { label: 'Compare', path: PRODUCTION_ROUTES.legalCompare, icon: GitCompare },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Following', path: PRODUCTION_ROUTES.following, icon: Users },
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
        <h2 className="text-xl font-bold text-blue-600 mb-4">Production Portal</h2>

        {/* Quick Links - Always visible at top */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Quick Links
          </h3>
          <div className="space-y-1">
            <Link
              to="/"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-200"
            >
              <Home className="w-4 h-4" />
              <span className="flex-1 text-left">Home</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>
            <Link
              to="/marketplace"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-200"
            >
              <Store className="w-4 h-4" />
              <span className="flex-1 text-left">Marketplace</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>
          </div>
        </div>

        {productionNavigationSections.map((section) => (
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
                        ? 'bg-blue-50 text-blue-600 font-medium' 
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