import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu, X, LogOut, Plus, Eye, Coins, CreditCard,
  Users, Home, Film, Search, Shield, BarChart3,
  Settings, ChevronDown
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { NDANotificationBadge } from './NDANotifications';
import { getSubscriptionTier } from '../config/subscription-plans';
import { EnhancedNavigationShadcn } from './EnhancedNavigationShadcn';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@shared/components/ui/tooltip";

interface DashboardUser {
  username?: string;
  email?: string;
  name?: string;
}

interface DashboardCredits {
  balance?: { credits?: number };
}

interface DashboardSubscription {
  tier?: string;
  status?: string;
}

interface DashboardHeaderProps {
  user: DashboardUser | null;
  userType: 'creator' | 'investor' | 'production';
  title: string;
  credits?: DashboardCredits;
  subscription?: DashboardSubscription;
  onLogout: () => void;
  children?: React.ReactNode;
  useEnhancedNav?: boolean;
}

export default function DashboardHeader({ 
  user, 
  userType, 
  title,
  credits,
  subscription,
  onLogout,
  children,
  useEnhancedNav = true
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Debug logging

  // Use enhanced navigation for better dropdown experience
  // FORCE enhanced navigation to always render for testing
  if (useEnhancedNav) {
    return (
      <>
        <EnhancedNavigationShadcn
          user={user}
          userType={userType}
          onLogout={onLogout}
        />
        {/* Additional content like tabs */}
        {children && (
          <div className="bg-white border-b">
            {children}
          </div>
        )}
      </>
    );
  }

  // Define navigation items based on user type
  const getNavigationItems = () => {
    const commonItems = [
      { label: 'Dashboard', href: `/${userType}/dashboard`, icon: Home },
      { label: 'Browse', href: '/marketplace', icon: Film },
      { label: 'Search', href: '/search', icon: Search },
    ];

    switch (userType) {
      case 'creator':
        return [
          ...commonItems,
          { label: 'My Pitches', href: '/creator/pitches', icon: Film },
          { label: 'Analytics', href: '/creator/analytics', icon: BarChart3 },
          { label: 'Following', href: '/creator/following', icon: Users },
          { label: 'Billing', href: '/creator/billing', icon: CreditCard },
          { label: 'Settings', href: '/settings', icon: Settings },
        ];
      case 'investor':
        return [
          ...commonItems,
          { label: 'Portfolio', href: '/investor/portfolio', icon: Shield },
          { label: 'Saved Pitches', href: '/investor/saved', icon: Film },
          { label: 'NDAs', href: '/investor/ndas', icon: Shield },
          { label: 'Analytics', href: '/investor/analytics', icon: BarChart3 },
          { label: 'Settings', href: '/settings', icon: Settings },
        ];
      case 'production':
        return [
          ...commonItems,
          { label: 'Projects', href: '/production/projects', icon: Film },
          { label: 'Submissions', href: '/production/submissions', icon: Eye },
          { label: 'Team', href: '/production/team', icon: Users },
          { label: 'Analytics', href: '/production/analytics', icon: BarChart3 },
          { label: 'Settings', href: '/settings', icon: Settings },
        ];
      default:
        return commonItems;
    }
  };

  const navigationItems = getNavigationItems();

  // Quick actions based on user type - consistent gradient styling per portal
  const getQuickActions = () => {
    switch (userType) {
      case 'creator':
        return (
          <button
            onClick={() => { void navigate('/creator/pitch/new'); }}
            className="hidden sm:flex items-center gap-2 px-3 lg:px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden lg:inline">New Pitch</span>
          </button>
        );
      case 'investor':
        return (
          <button
            onClick={() => { void navigate('/marketplace'); }}
            className="hidden sm:flex items-center gap-2 px-3 lg:px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all text-sm font-medium"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden lg:inline">Browse Deals</span>
          </button>
        );
      case 'production':
        return (
          <button
            onClick={() => { void navigate('/marketplace'); }}
            className="hidden sm:flex items-center gap-2 px-3 lg:px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all text-sm font-medium"
          >
            <Search className="w-4 h-4" />
            <span className="hidden lg:inline">Find Projects</span>
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 lg:py-4">
        <div className="flex justify-between items-center">
          {/* Left side - Logo and title */}
          <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-500 lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : (
                <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
              )}
            </button>

            {/* Logo */}
            <Link 
              to="/" 
              className="flex items-center hover:opacity-80 transition-opacity"
              title="Go to Homepage"
            >
              <span className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600">Pitchey</span>
            </Link>
            
            {/* Divider - Hidden on small screens */}
            <div className="hidden sm:block h-8 w-px bg-gray-300"></div>
            
            {/* Dashboard Info */}
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 truncate">{title}</h1>
              <p className="hidden sm:block text-xs text-gray-500 truncate">
                Welcome back, {user?.username || userType}
              </p>
            </div>
          </div>

          {/* Desktop Navigation - Hidden on mobile, shown on lg screens */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
            {navigationItems.slice(0, 5).map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden xl:inline">{item.label}</span>
              </Link>
            ))}
            
            {/* More dropdown for additional items */}
            {navigationItems.length > 5 && (
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span className="hidden xl:inline">More</span>
                </button>
                
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 border">
                    {navigationItems.slice(5).map((item) => (
                      <Link
                        key={item.label}
                        to={item.href}
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
          
          {/* Right side - Actions */}
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
            {/* Credits Display - Only for creators */}
            {userType === 'creator' && credits && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { void navigate('/creator/billing?tab=credits'); }}
                      className="hidden sm:flex items-center gap-2 px-2 lg:px-3 py-1.5 lg:py-2 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group"
                    >
                      <Coins className="w-4 h-4 text-purple-600" />
                      <div className="text-xs lg:text-sm">
                        <div className="font-semibold text-purple-900">
                          {credits?.balance?.credits || 0}
                        </div>
                        <div className="hidden xl:block text-xs text-purple-600">
                          Credits
                        </div>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-xs bg-gray-900 text-white p-3 rounded-lg shadow-lg"
                  >
                    <p className="font-semibold mb-1">Pitchey Credits</p>
                    <p className="text-xs text-gray-300">
                      Use credits to boost visibility, access premium analytics,
                      and unlock advanced features. Click to manage your credits.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Subscription Status - Only for creators */}
            {userType === 'creator' && subscription && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { void navigate('/creator/billing?tab=subscription'); }}
                      className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                    >
                      <span className="font-medium text-gray-700 truncate max-w-[100px]">
                        {getSubscriptionTier(subscription?.tier || '')?.name || 'Free'}
                      </span>
                      {subscription?.status === 'active' && (
                        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-xs bg-gray-900 text-white p-3 rounded-lg shadow-lg"
                  >
                    <p className="font-semibold mb-1">Your Subscription</p>
                    <p className="text-xs text-gray-300">
                      Current plan: {getSubscriptionTier(subscription?.tier || '')?.name || 'Free'}.
                      Click to upgrade or manage your subscription.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Quick Actions */}
            {getQuickActions()}
            
            {/* Notifications */}
            <NotificationBell size="sm" className="hidden sm:block" />
            
            {/* NDA Badge - Only for creators */}
            {userType === 'creator' && <NDANotificationBadge className="hidden sm:block" />}
            
            {/* User Profile */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
            
            {/* Logout */}
            <button
              onClick={onLogout}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t bg-white">
          <nav className="px-4 py-2 space-y-1">
            {navigationItems.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-base text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
            
            {/* Mobile Quick Actions - portal-specific colors */}
            <div className="border-t mt-2 pt-2">
              {userType === 'creator' && (
                <button
                  onClick={() => {
                    void navigate('/creator/pitch/new');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-base text-purple-600 hover:bg-purple-50 rounded-lg transition-colors font-medium"
                >
                  <Plus className="w-5 h-5" />
                  New Pitch
                </button>
              )}

              {userType === 'investor' && (
                <button
                  onClick={() => {
                    void navigate('/marketplace');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-base text-green-600 hover:bg-green-50 rounded-lg transition-colors font-medium"
                >
                  <Eye className="w-5 h-5" />
                  Browse Deals
                </button>
              )}

              {userType === 'production' && (
                <button
                  onClick={() => {
                    void navigate('/marketplace');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-base text-orange-600 hover:bg-orange-50 rounded-lg transition-colors font-medium"
                >
                  <Search className="w-5 h-5" />
                  Find Projects
                </button>
              )}
            </div>
            
            {/* Mobile User Info */}
            <div className="border-t mt-2 pt-2">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.username || 'User'}</p>
                  <p className="text-xs text-gray-500 capitalize">{userType}</p>
                </div>
              </div>
              
              {/* Mobile Credits/Subscription */}
              {userType === 'creator' && (
                <div className="px-3 py-2 space-y-2">
                  {credits && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Credits:</span>
                      <span className="font-semibold text-purple-600">
                        {credits?.balance?.credits || 0}
                      </span>
                    </div>
                  )}
                  {subscription && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Plan:</span>
                      <span className="font-semibold text-gray-900">
                        {getSubscriptionTier(subscription?.tier || '')?.name || 'Free'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
      
      {/* Additional content like tabs */}
      {children}
    </header>
  );
}