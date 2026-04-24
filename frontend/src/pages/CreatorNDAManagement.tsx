import { Shield } from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import ComprehensiveNDAManagement from '@features/ndas/components/NDA/ComprehensiveNDAManagement';

export default function CreatorNDAManagement() {
  const { user, isAuthenticated } = useBetterAuthStore();

  return (
    <div className="space-y-6">
      {/* Page heading — global chrome comes from PortalLayout's MinimalHeader */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Shield className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NDA Management</h1>
          <p className="text-sm text-gray-600">Comprehensive NDA workflow and analytics</p>
        </div>
      </div>

      {isAuthenticated && user?.id ? (
        <ComprehensiveNDAManagement
          userType="creator"
          userId={user.id}
        />
      ) : (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Please log in to manage your NDAs</p>
          </div>
        </div>
      )}
    </div>
  );
}
