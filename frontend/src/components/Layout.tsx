import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { 
  Home, Film, LogOut, Search, Menu, X, Plus 
} from 'lucide-react';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { useRealTimeNotifications } from '@features/notifications/hooks/useRealTimeNotifications';
import { getDashboardRoute } from '../utils/navigation';


interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Initialize real-time notifications
  useRealTimeNotifications();

  const handleLogout = () => {
    void logout();
    void navigate('/login');
  };


  return (
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow-lg" data-testid="main-navigation">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                {/* Logo */}
                <Link to="/" className="flex-shrink-0 flex items-center" data-testid="logo-link">
                  <img src="/pitchey-logotype.png" alt="Pitchey" className="h-8 w-auto" />
                </Link>

                {/* Simple Navigation */}
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link to={getDashboardRoute(user?.userType)} className="flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-primary-600" data-testid="nav-dashboard">
                    <Home className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                  <Link to="/browse" className="flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-primary-600" data-testid="nav-browse">
                    <Film className="mr-2 h-4 w-4" />
                    Browse Pitches
                  </Link>
                  <Link to="/search" className="flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-primary-600" data-testid="nav-search">
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </Link>
                  {user?.userType === 'creator' && (
                  <Link
                    to="/pitch/new"
                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-primary-600"
                    data-testid="nav-new-pitch"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Pitch
                  </Link>
                )}
                </div>
              </div>

            {/* Right side */}
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              {/* Search */}
              <div className="relative mr-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  data-testid="search-input"
                />
              </div>

              {/* Notifications */}
              <NotificationBell className="mr-3" size="md" />

              {/* Profile dropdown */}
              <div className="ml-3 relative">
                <div className="flex items-center">
                  <button className="flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white">
                      {user?.username?.charAt(0).toUpperCase()}
                    </div>
                  </button>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-700">{user?.username}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.userType}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="ml-4 p-2 text-gray-400 hover:text-gray-500"
                    data-testid="logout-button"
                    title="Logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center sm:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                data-testid="mobile-menu-button"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="sm:hidden" data-testid="mobile-menu">
              <div className="pt-2 pb-3 space-y-1 border-t border-gray-200">
                <Link 
                  to={getDashboardRoute(user?.userType)} 
                  className="flex items-center gap-3 pl-3 pr-4 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="mobile-nav-dashboard"
                >
                  <Home className="w-5 h-5" />
                  Dashboard
                </Link>
                <Link 
                  to="/browse" 
                  className="flex items-center gap-3 pl-3 pr-4 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="mobile-nav-browse"
                >
                  <Film className="w-5 h-5" />
                  Browse Pitches
                </Link>
                <Link 
                  to="/search" 
                  className="flex items-center gap-3 pl-3 pr-4 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="mobile-nav-search"
                >
                  <Search className="w-5 h-5" />
                  Search
                </Link>
                {user?.userType === 'creator' && (
                  <Link 
                    to="/pitch/new" 
                    className="flex items-center gap-3 pl-3 pr-4 py-3 text-base font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-nav-new-pitch"
                  >
                    <Plus className="w-5 h-5" />
                    New Pitch
                  </Link>
                )}
                <div className="border-t border-gray-200 mt-3 pt-3">
                  <div className="flex items-center gap-3 pl-3 pr-4 py-2">
                    <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm">
                      {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                      <p className="text-xs text-gray-500 capitalize">{user?.userType}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full text-left pl-3 pr-4 py-3 text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                    data-testid="mobile-nav-logout"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}
        </nav>

      {/* Main content */}
      <main className="pt-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}