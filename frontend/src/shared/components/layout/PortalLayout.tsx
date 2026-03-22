import React, { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MinimalHeader } from './MinimalHeader';
import { PageErrorBoundary } from '@shared/components/feedback/ConsoleErrorBoundary';

import { EnhancedCreatorNav } from './EnhancedCreatorNav';
import { EnhancedInvestorNav } from './EnhancedInvestorNav';
import { EnhancedProductionNav } from './EnhancedProductionNav';

interface PortalLayoutProps {
  userType: string | null;
}

export function PortalLayout({ userType }: PortalLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Closed by default on mobile
  const [isDesktopSidebarCollapsed, _setIsDesktopSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const renderSidebar = () => {
    switch (userType) {
      case 'creator':
        return <EnhancedCreatorNav />;
      case 'investor':
        return <EnhancedInvestorNav />;
      case 'production':
        return <EnhancedProductionNav />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal Header */}
      <MinimalHeader 
        onMenuToggle={toggleSidebar} 
        isSidebarOpen={isSidebarOpen}
        userType={userType}
      />

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar - Desktop */}
        <aside className={`
          hidden lg:block transition-all duration-300 ease-in-out
          ${isDesktopSidebarCollapsed ? 'w-16' : 'w-64'}
        `}>
          {renderSidebar()}
        </aside>

        {/* Sidebar - Mobile Overlay */}
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
              onClick={toggleSidebar}
            />
            
            {/* Sidebar */}
            <aside className={`
              lg:hidden fixed left-0 top-16 bottom-0 z-40
              transform transition-transform duration-300 ease-in-out
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
              {renderSidebar()}
            </aside>
          </>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            {/* Page Content - key forces re-render on route change and resets error boundary */}
            <PageErrorBoundary key={location.pathname}>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
                <Outlet />
              </Suspense>
            </PageErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}