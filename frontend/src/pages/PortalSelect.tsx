import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Film, DollarSign, Building, ShieldCheck, Eye } from 'lucide-react';
import { isSafeReturnPath } from '@/utils/postLoginRedirect';

type PortalType = 'creator' | 'investor' | 'production' | 'watcher' | 'admin';

// Single source of truth for portal colors — hex values mirror
// `brand.portal-*` tokens in tailwind.config.js. Class names reference the
// same tokens so the login card, the portal nav, and any other brand-portal
// surface all stay in sync.
const PORTAL_BRAND: Record<PortalType, { hex: string; iconText: string; iconBg: string }> = {
  creator:    { hex: '#7B3FBF', iconText: 'text-brand-portal-creator',    iconBg: 'bg-brand-portal-creator/10' },
  investor:   { hex: '#5B4FC7', iconText: 'text-brand-portal-investor',   iconBg: 'bg-brand-portal-investor/10' },
  production: { hex: '#4A5FD0', iconText: 'text-brand-portal-production', iconBg: 'bg-brand-portal-production/10' },
  watcher:    { hex: '#06B6D4', iconText: 'text-brand-portal-watcher',    iconBg: 'bg-brand-portal-watcher/10' },
  admin:      { hex: '#DC2626', iconText: 'text-brand-portal-admin',      iconBg: 'bg-brand-portal-admin/10' },
};

export default function PortalSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const incomingFrom = (location.state as { from?: unknown } | null)?.from;
  const forwardState = isSafeReturnPath(incomingFrom) ? { from: incomingFrom } : undefined;

  const portals: PortalType[] = ['creator', 'production', 'investor', 'watcher'];

  const handlePortalSelect = (portalType: PortalType) => {
    const routes: Record<PortalType, string> = {
      creator: '/login/creator',
      investor: '/login/investor',
      production: '/login/production',
      watcher: '/login/watcher',
      admin: '/login/admin',
    };
    navigate(routes[portalType], forwardState ? { state: forwardState } : undefined);
  };

  const getPortalIcon = (type: PortalType) => {
    switch (type) {
      case 'creator': return Film;
      case 'investor': return DollarSign;
      case 'production': return Building;
      case 'watcher': return Eye;
      case 'admin': return ShieldCheck;
    }
  };

  const getPortalTitle = (type: PortalType) => {
    switch (type) {
      case 'creator': return 'Creator Portal';
      case 'investor': return 'Investor Portal';
      case 'production': return 'Production Portal';
      case 'watcher': return 'Watcher Portal';
      case 'admin': return 'Admin Portal';
    }
  };

  const getPortalDescription = (type: PortalType) => {
    switch (type) {
      case 'creator': return 'Submit and manage your movie pitches';
      case 'investor': return 'Discover and invest in promising projects';
      case 'production': return 'Find and develop exciting content';
      case 'watcher': return 'Browse, save, and draft pitches for free';
      case 'admin': return 'Manage users, content, and platform settings';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Back Button */}
      <div className="pt-6 px-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>
      </div>

      {/* Portal Selection Grid */}
      <div className="flex items-center justify-center min-h-screen px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Choose Your Portal
            </h1>
            <p className="text-xl text-gray-600">
              Select the portal that best describes your role in the industry
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {portals.map((portal) => {
              const Icon = getPortalIcon(portal);
              const brand = PORTAL_BRAND[portal];

              return (
                <div
                  key={portal}
                  onClick={() => handlePortalSelect(portal)}
                  className="bg-white rounded-xl p-8 cursor-pointer transform hover:scale-105 transition-all duration-300 border border-gray-200 shadow-lg hover:shadow-2xl"
                  style={{ boxShadow: `0 10px 30px -10px ${brand.hex}4D` }}
                >
                  <div className="text-center">
                    <div className={`inline-flex p-4 rounded-full ${brand.iconBg} mb-6`}>
                      <Icon className={`h-12 w-12 ${brand.iconText}`} />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                      {getPortalTitle(portal)}
                    </h2>
                    <p className="text-gray-600">
                      {getPortalDescription(portal)}
                    </p>
                    <div
                      className="mt-6 w-full h-1 rounded-full"
                      style={{ background: `linear-gradient(to right, ${brand.hex}B3, ${brand.hex})` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/register"
                state={forwardState}
                className="text-purple-600 hover:text-purple-700 font-semibold"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}