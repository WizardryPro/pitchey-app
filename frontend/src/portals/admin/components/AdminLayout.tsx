import { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Users, FileText, DollarSign, Settings, Shield,
  Menu, X, LogOut, ChevronRight
} from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { PageErrorBoundary } from '@shared/components/feedback/ConsoleErrorBoundary';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: Home },
  { label: 'Users', path: '/admin/users', icon: Users },
  { label: 'Content', path: '/admin/content', icon: FileText },
  { label: 'Transactions', path: '/admin/transactions', icon: DollarSign },
  { label: 'Audit Log', path: '/admin/audit-log', icon: Shield },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const Sidebar = () => (
    <nav className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold text-purple-900 mb-1">Admin Portal</h2>
        <p className="text-xs text-gray-500 mb-4">{user?.email}</p>

        <div className="space-y-1">
          {adminNavItems.map((item) => {
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
                    ? 'bg-purple-50 text-purple-900 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3" />}
              </button>
            );
          })}
        </div>

        <div className="mt-8 pt-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4 sticky top-0 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <span className="text-xl font-bold text-purple-900 ml-2 lg:ml-0">Pitchey</span>
        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs font-medium rounded">Admin</span>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <Sidebar />
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="lg:hidden fixed left-0 top-16 bottom-0 z-40">
              <Sidebar />
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            <PageErrorBoundary key={location.pathname}>
              <Suspense fallback={
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              }>
                <Outlet />
              </Suspense>
            </PageErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
