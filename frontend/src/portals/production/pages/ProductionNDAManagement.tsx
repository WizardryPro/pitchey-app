import { Shield } from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import ComprehensiveNDAManagement from '@features/ndas/components/NDA/ComprehensiveNDAManagement';
import BackButton from '@/components/BackButton';

export default function ProductionNDAManagement() {
  const { user, isAuthenticated } = useBetterAuthStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Shield className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">NDA Management</h1>
                <p className="text-sm text-gray-600">Track NDA requests and signed agreements</p>
              </div>
            </div>
          </div>
        </div>
      </header>

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
