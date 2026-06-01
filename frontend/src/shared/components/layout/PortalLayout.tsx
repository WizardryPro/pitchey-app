import React, { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MinimalHeader } from './MinimalHeader';
import { PageErrorBoundary } from '@shared/components/feedback/ConsoleErrorBoundary';
import { getPortalTheme } from '@shared/hooks/usePortalTheme';

import { EnhancedCreatorNav } from './EnhancedCreatorNav';
import { EnhancedInvestorNav } from './EnhancedInvestorNav';
import { EnhancedProductionNav } from './EnhancedProductionNav';
import { EnhancedAdminNav } from './EnhancedAdminNav';
import { EnhancedWatcherNav } from './EnhancedWatcherNav';

interface PortalLayoutProps {
  userType: string | null;
}

export function PortalLayout({ userType }: PortalLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Closed by default on mobile
  const [isDesktopSidebarCollapsed, _setIsDesktopSidebarCollapsed] = useState(false);
  const location = useLocation();
  const theme = getPortalTheme(userType);

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
      case 'admin':
        return <EnhancedAdminNav />;
      case 'watcher':
        return <EnhancedWatcherNav />;
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

      {/* min-h (not fixed h) so the row grows with content and the WINDOW scrolls.
          A fixed h-[calc(100vh-4rem)] + overflow-y-auto on <main> made content scroll
          inside an inner pane — on shorter/mobile viewports 100vh overshoots the visible
          area, leaving the bottom of long forms (the Save button) unreachable, plus
          blank-strip repaint while scrolling. The sticky header (top-0) + sticky sidebar
          (top-16) keep the chrome pinned during natural window scroll. */}
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Sidebar - Desktop. sticky + self-start so it stays pinned beside the
            scrolling content; own height + overflow so a long nav scrolls internally. */}
        <aside className={`
          hidden lg:block transition-all duration-300 ease-in-out
          sticky top-16 self-start h-[calc(100vh-4rem)] overflow-y-auto
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

        {/* Main Content Area — flows naturally; the window scrolls (min-w-0 keeps
            flex children from forcing horizontal overflow). */}
        <main className="flex-1 min-w-0">
          {/* Persistent portal identity strip — 3px colored bar that stays visible
              across every route inside this portal. Primary "you are in Watcher"
              signal when page chrome is otherwise shared/neutral. */}
          <div className={`h-[3px] ${theme.stripTop}`} aria-hidden="true" />
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            {/* Page Content - key forces re-render on route change and resets error boundary */}
            <PageErrorBoundary key={location.pathname}>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${theme.spinnerBorder}`}></div></div>}>
                <Outlet />
              </Suspense>
            </PageErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}