import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Home, BarChart3, Activity, LineChart, Briefcase, Clock, CheckCircle,
  FolderOpen, Globe, Bookmark, Eye, DollarSign, FileText, PieChart,
  TrendingUp, AlertTriangle, Users, Building2, UserCheck, Wallet,
  CreditCard, Settings, Shield, Receipt, Calculator, FileCheck, Store, ExternalLink
} from 'lucide-react';
import { INVESTOR_ROUTES } from '../../config/navigation.routes';

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

export const investorNavigationSections: NavigationSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Overview', path: INVESTOR_ROUTES.dashboard, icon: Home },
      { label: 'Portfolio', path: INVESTOR_ROUTES.portfolio, icon: Briefcase},
      { label: 'Analytics', path: INVESTOR_ROUTES.analytics, icon: BarChart3},
      { label: 'Activity', path: INVESTOR_ROUTES.activity, icon: Activity},
      { label: 'Performance', path: INVESTOR_ROUTES.performance, icon: LineChart},
    ],
  },
  {
    title: 'Investments',
    items: [
      { label: 'Active Deals', path: INVESTOR_ROUTES.deals, icon: Briefcase},
      { label: 'Pending Deals', path: INVESTOR_ROUTES.pendingDeals, icon: Clock},
      { label: 'All Investments', path: INVESTOR_ROUTES.allInvestments, icon: FolderOpen},
      { label: 'Completed Projects', path: INVESTOR_ROUTES.completedProjects, icon: CheckCircle},
      { label: 'ROI Analysis', path: INVESTOR_ROUTES.roiAnalysis, icon: PieChart},
    ],
  },
  {
    title: 'Discover',
    items: [
      { label: 'Browse All', path: INVESTOR_ROUTES.browse, icon: Globe },
      { label: 'Discover', path: INVESTOR_ROUTES.discover, icon: TrendingUp },
      { label: 'Saved', path: INVESTOR_ROUTES.saved, icon: Bookmark},
      { label: 'Watchlist', path: INVESTOR_ROUTES.watchlist, icon: Eye},
    ],
  },
  {
    title: 'Financial',
    items: [
      { label: 'Overview', path: INVESTOR_ROUTES.financialOverview, icon: DollarSign},
      { label: 'Transactions', path: INVESTOR_ROUTES.transactionHistory, icon: Receipt},
      { label: 'Budget', path: INVESTOR_ROUTES.budgetAllocation, icon: Calculator},
      { label: 'Reports', path: INVESTOR_ROUTES.reports, icon: FileText},
      { label: 'Tax Documents', path: INVESTOR_ROUTES.taxDocuments, icon: FileCheck},
    ],
  },
  {
    title: 'Market',
    items: [
      { label: 'Market Trends', path: INVESTOR_ROUTES.marketTrends, icon: TrendingUp},
      { label: 'Risk Assessment', path: INVESTOR_ROUTES.riskAssessment, icon: AlertTriangle},
    ],
  },
  {
    title: 'Network',
    items: [
      { label: 'My Network', path: INVESTOR_ROUTES.network, icon: Users},
      { label: 'Co-Investors', path: INVESTOR_ROUTES.coInvestors, icon: UserCheck},
      { label: 'Creators', path: INVESTOR_ROUTES.creators, icon: Users},
      { label: 'Production Companies', path: INVESTOR_ROUTES.productionCompanies, icon: Building2},
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Wallet', path: INVESTOR_ROUTES.wallet, icon: Wallet},
      { label: 'Payment Methods', path: INVESTOR_ROUTES.paymentMethods, icon: CreditCard},
      { label: 'NDA Requests', path: INVESTOR_ROUTES.ndaRequests, icon: Shield },
      { label: 'Settings', path: INVESTOR_ROUTES.settings, icon: Settings },
    ],
  },
];

export function EnhancedInvestorNav() {
  const navigate = useNavigate();
  const location = useLocation();

  // Define color schemes for different sections
  const getSectionColorScheme = (sectionTitle: string, isActive: boolean) => {
    switch(sectionTitle) {
      case 'Dashboard':
        // Portfolio, Analytics, Activity, Performance - Emerald shades
        return {
          active: 'bg-emerald-50 text-emerald-700 font-medium',
          hover: 'hover:bg-emerald-50 hover:text-emerald-700',
          icon: isActive ? 'text-emerald-600' : 'text-gray-500'        };
      case 'Investments':
        // Deals, Pending Deals, All Investments - Teal shades
        return {
          active: 'bg-teal-50 text-teal-700 font-medium',
          hover: 'hover:bg-teal-50 hover:text-teal-700',
          icon: isActive ? 'text-teal-600' : 'text-gray-500'        };
      case 'Discover':
        // Browse, Discover, Saved, Watchlist - Sky blue shades
        return {
          active: 'bg-sky-50 text-sky-700 font-medium',
          hover: 'hover:bg-sky-50 hover:text-sky-700',
          icon: isActive ? 'text-sky-600' : 'text-gray-500'        };
      case 'Financial':
        // Financial routes - Green shades
        return {
          active: 'bg-green-50 text-green-700 font-medium',
          hover: 'hover:bg-green-50 hover:text-green-700',
          icon: isActive ? 'text-green-600' : 'text-gray-500'        };
      case 'Market':
        // Market routes - Indigo shades
        return {
          active: 'bg-indigo-50 text-indigo-700 font-medium',
          hover: 'hover:bg-indigo-50 hover:text-indigo-700',
          icon: isActive ? 'text-indigo-600' : 'text-gray-500'        };
      case 'Network':
        // Network routes - Purple shades
        return {
          active: 'bg-purple-50 text-purple-700 font-medium',
          hover: 'hover:bg-purple-50 hover:text-purple-700',
          icon: isActive ? 'text-purple-600' : 'text-gray-500'        };
      default:
        // Account and others - Default green
        return {
          active: 'bg-green-50 text-green-600 font-medium',
          hover: 'hover:bg-gray-50 hover:text-gray-900',
          icon: isActive ? 'text-green-600' : 'text-gray-500'        };
    }
  };

  return (
    <nav className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold text-green-600 mb-4">Investor Portal</h2>

        {/* Quick Links - Always visible at top */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Quick Links
          </h3>
          <div className="space-y-1">
            <Link
              to="/"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors duration-200"
            >
              <Home className="w-4 h-4" />
              <span className="flex-1 text-left">Home</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>
            <Link
              to="/marketplace"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors duration-200"
            >
              <Store className="w-4 h-4" />
              <span className="flex-1 text-left">Marketplace</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>
          </div>
        </div>

        {investorNavigationSections.map((section) => (
          <div key={section.title} className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                const colorScheme = getSectionColorScheme(section.title, isActive);
                
                return (
                  <button
                    key={item.path}
                    onClick={() => { void navigate(item.path); }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                      transition-all duration-200
                      ${isActive 
                        ? colorScheme.active
                        : `text-gray-700 ${colorScheme.hover}`
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 transition-colors ${colorScheme.icon}`} />
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