import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Menu, X, LogOut, Plus, Eye, Coins, CreditCard, Bell,
  Users, Home, Film, Search, Shield, BarChart3, FileText,
  Settings, UserCircle, ChevronDown, Briefcase, TrendingUp,
  Calendar, MessageSquare, Star, Globe, PlayCircle, Upload,
  FolderOpen, UserPlus, Layers, Target, Activity, Award,
  DollarSign, PieChart, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { NDANotificationBadge } from '@features/ndas/components/NDANotifications';

interface EnhancedNavigationProps {
  user: any;
  userType: 'creator' | 'investor' | 'production';
  onLogout: () => void;
}

function EnhancedNavigation({ 
  user, 
  userType, 
  onLogout
}: EnhancedNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown) {
        const activeRef = dropdownRefs.current[activeDropdown];
        if (activeRef && !activeRef.contains(event.target as Node)) {
          setActiveDropdown(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

  // Close dropdowns when location changes
  useEffect(() => {
    setActiveDropdown(null);
  }, [location.pathname]);

  // Navigation structure with dropdowns
  const navigationStructure = {
    dashboard: {
      label: 'Dashboard',
      icon: Home,
      dropdown: [
        { label: 'Overview', href: `/${userType}/dashboard`, icon: Home },
        { label: 'Analytics', href: `/${userType}/analytics`, icon: BarChart3 },
        { label: 'Activity Feed', href: `/${userType}/activity`, icon: Activity },
        { label: 'Quick Stats', href: `/${userType}/stats`, icon: TrendingUp },
      ]
    },
    browse: {
      label: 'Browse',
      icon: Film,
      dropdown: [
        { label: 'All Pitches', href: '/marketplace', icon: Film },
        { label: 'Trending', href: '/marketplace?tab=trending', icon: TrendingUp },
        { label: 'Latest', href: '/marketplace?tab=latest', icon: Clock },
        { label: 'Featured', href: '/marketplace?tab=featured', icon: Star },
        { label: 'By Genre', href: '/browse/genres', icon: Layers },
        { label: 'Top Rated', href: '/browse/top-rated', icon: Award },
      ]
    },
    projects: userType === 'production' ? {
      label: 'Projects',
      icon: Briefcase,
      dropdown: [
        { label: 'Active Projects', href: '/production/projects', icon: PlayCircle },
        { label: 'In Development', href: '/production/projects/development', icon: FileText },
        { label: 'In Production', href: '/production/projects/production', icon: Film },
        { label: 'Post-Production', href: '/production/projects/post', icon: CheckCircle },
        { label: 'Completed', href: '/production/projects/completed', icon: Award },
        { label: 'Pipeline', href: '/production/pipeline', icon: Target },
      ]
    } : userType === 'creator' ? {
      label: 'My Pitches',
      icon: Film,
      dropdown: [
        { label: 'All Pitches', href: '/creator/pitches', icon: Film },
        { label: 'Published', href: '/creator/pitches/published', icon: Globe },
        { label: 'Drafts', href: '/creator/pitches/drafts', icon: FileText },
        { label: 'Under Review', href: '/creator/pitches/review', icon: Clock },
        { label: 'Analytics', href: '/creator/pitches/analytics', icon: BarChart3 },
        { label: 'Create New', href: '/creator/pitch/new', icon: Plus },
      ]
    } : {
      label: 'Portfolio',
      icon: Briefcase,
      dropdown: [
        { label: 'My Investments', href: '/investor/portfolio', icon: DollarSign },
        { label: 'Saved Pitches', href: '/investor/saved', icon: Star },
        { label: 'Watchlist', href: '/investor/watchlist', icon: Eye },
        { label: 'Deal Flow', href: '/investor/deals', icon: TrendingUp },
        { label: 'Performance', href: '/investor/performance', icon: PieChart },
      ]
    },
    submissions: userType === 'production' ? {
      label: 'Submissions',
      icon: Upload,
      dropdown: [
        { label: 'New Submissions', href: '/production/submissions/new', icon: AlertCircle },
        { label: 'Under Review', href: '/production/submissions/review', icon: Eye },
        { label: 'Shortlisted', href: '/production/submissions/shortlisted', icon: Star },
        { label: 'Accepted', href: '/production/submissions/accepted', icon: CheckCircle },
        { label: 'Rejected', href: '/production/submissions/rejected', icon: X },
        { label: 'Archive', href: '/production/submissions/archive', icon: FolderOpen },
      ]
    } : null,
    team: userType === 'production' || userType === 'creator' ? {
      label: 'Team',
      icon: Users,
      dropdown: [
        { label: 'Team Members', href: `/${userType}/team`, icon: Users },
        { label: 'Roles & Permissions', href: `/${userType}/team/roles`, icon: Shield },
        { label: 'Collaborations', href: `/${userType}/collaborations`, icon: Users },
        { label: 'Messages', href: '/messages', icon: MessageSquare },
      ]
    } : null,
    search: {
      label: 'Search',
      icon: Search,
      dropdown: [
        { label: 'Marketplace', href: '/marketplace', icon: Film },
        { label: 'By Genre', href: '/browse/genres', icon: Layers },
        { label: 'Top Rated', href: '/browse/top-rated', icon: Award },
      ]
    },
    settings: {
      label: 'Settings',
      icon: Settings,
      dropdown: [
        { label: 'Profile Settings', href: '/settings/profile', icon: UserCircle },
        { label: 'Account Settings', href: '/settings/account', icon: Settings },
        { label: 'Privacy & Security', href: '/settings/privacy', icon: Shield },
        { label: 'Notifications', href: '/settings/notifications', icon: Bell },
        { label: 'Billing & Payments', href: '/settings/billing', icon: CreditCard },
        { label: 'API & Integrations', href: '/settings/api', icon: Globe },
      ]
    }
  };

  // Filter out null/undefined items
  const navItems = Object.entries(navigationStructure)
    .filter(([_, item]) => item != null && item.icon)
    .map(([key, item]) => ({ key, ...item }));

  const toggleDropdown = (key: string) => {
    setActiveDropdown(prevActive => prevActive === key ? null : key);
  };

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Logo and Desktop Nav */}
          <div className="flex items-center flex-1">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>

            {/* Logo */}
            <Link 
              to="/" 
              className="flex items-center ml-2 lg:ml-0"
              title="Go to Homepage"
            >
              <span className="text-2xl font-bold text-purple-600">Pitchey</span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center ml-10 space-x-1">
              {navItems.map((item: any) => (
                <div
                  key={item.key}
                  ref={(ref) => { dropdownRefs.current[item.key] = ref; }}
                  className="relative"
                >
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleDropdown(item.key);
                    }}
                    className={`
                      flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md
                      transition-colors duration-200
                      ${activeDropdown === item.key
                        ? 'text-purple-600 bg-purple-50'
                        : 'text-gray-700 hover:text-purple-600 hover:bg-gray-50'
                      }
                    `}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                    <ChevronDown className={`
                      w-3 h-3 transition-transform duration-200
                      ${activeDropdown === item.key ? 'rotate-180' : ''}
                    `} />
                  </button>

                  {/* Dropdown Menu */}
                  {activeDropdown === item.key && item.dropdown && (
                    <div 
                      className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                      onMouseLeave={(e) => {
                        // Only close if mouse is not moving to another dropdown element
                        const relatedTarget = e.relatedTarget as Element;
                        if (!relatedTarget || (!relatedTarget.closest('[data-dropdown-container]') && !relatedTarget.closest('button'))) {
                          setActiveDropdown(null);
                        }
                      }}
                      data-dropdown-container
                    >
                      {item.dropdown.map((subItem: any) => (
                        <Link
                          key={subItem.label}
                          to={subItem.href}
                          onClick={() => {
                            setActiveDropdown(null);
                          }}
                          className={`
                            flex items-center gap-3 px-4 py-2 text-sm
                            transition-colors duration-150
                            ${isActive(subItem.href)
                              ? 'text-purple-600 bg-purple-50'
                              : 'text-gray-700 hover:text-purple-600 hover:bg-gray-50'
                            }
                          `}
                        >
                          <subItem.icon className="w-4 h-4" />
                          <span>{subItem.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
          
          {/* Right side - Actions */}
          <div className="flex items-center gap-4">
            {/* Quick Actions */}
            {userType === 'creator' && (
              <button
                onClick={() => navigate('/creator/pitch/new')}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Pitch
              </button>
            )}
            
            {/* Notifications */}
            <NotificationBell size="md" />
            
            {/* NDA Badge */}
            {userType === 'creator' && <NDANotificationBadge />}
            
            {/* User Menu */}
            <div className="relative">
              <button 
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition"
              >
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-medium">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                  <p className="text-xs text-gray-500 capitalize">{userType}</p>
                </div>
              </button>
            </div>
            
            {/* Logout */}
            <button
              onClick={onLogout}
              className="p-2 text-gray-500 hover:text-gray-700 transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t bg-white">
          <nav className="px-4 py-2 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {navItems.map((item: any) => (
              <div key={item.key}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleDropdown(item.key);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-base font-medium text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </span>
                  <ChevronDown className={`
                    w-4 h-4 transition-transform duration-200
                    ${activeDropdown === item.key ? 'rotate-180' : ''}
                  `} />
                </button>

                {/* Mobile Dropdown */}
                {activeDropdown === item.key && item.dropdown && (
                  <div className="ml-8 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                    {item.dropdown.map((subItem: any) => (
                      <Link
                        key={subItem.label}
                        to={subItem.href}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setActiveDropdown(null);
                        }}
                        className={`
                          flex items-center gap-3 px-3 py-2 text-sm
                          rounded-lg transition-colors
                          ${isActive(subItem.href)
                            ? 'text-purple-600 bg-purple-50'
                            : 'text-gray-600 hover:text-purple-600 hover:bg-gray-50'
                          }
                        `}
                      >
                        <subItem.icon className="w-4 h-4" />
                        <span>{subItem.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {/* Mobile User Info */}
            <div className="border-t mt-4 pt-4">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.username || 'User'}</p>
                  <p className="text-xs text-gray-500 capitalize">{userType}</p>
                </div>
              </div>
              
              <button
                onClick={() => {
                  onLogout();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-3 w-full px-3 py-2 mt-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

// Export both named and default for compatibility
export { EnhancedNavigation };
export default EnhancedNavigation;