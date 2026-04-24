import { Shield } from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import ComprehensiveNDAManagement from '@features/ndas/components/NDA/ComprehensiveNDAManagement';
import { usePortalTheme } from '@shared/hooks/usePortalTheme';

export default function ProductionNDAManagement() {
  const { user, isAuthenticated } = useBetterAuthStore();
  const theme = usePortalTheme();

  return (
    <div className="space-y-6">
      {/* Page heading — global chrome comes from PortalLayout's MinimalHeader */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${theme.bgMuted}`}>
          <Shield className={`w-6 h-6 ${theme.textAccent}`} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NDA Management</h1>
          <p className="text-sm text-gray-600">Track NDA requests and signed agreements</p>
        </div>
      </div>

      {isAuthenticated && user?.id ? (
        <ComprehensiveNDAManagement
          userType="production"
          userId={user.id}
        />
      ) : (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Please log in to manage NDAs.</p>
          </div>
        </div>
      )}
    </div>
  );
}
