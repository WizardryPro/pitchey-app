import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Film, DollarSign, Building, ShieldCheck } from 'lucide-react';

type PortalType = 'creator' | 'investor' | 'production' | 'admin';

export default function PortalSelect() {
  const navigate = useNavigate();

  const portals: PortalType[] = ['creator', 'production', 'investor'];

  const handlePortalSelect = (portalType: PortalType) => {
    const routes: Record<PortalType, string> = {
      creator: '/login/creator',
      investor: '/login/investor',
      production: '/login/production',
      admin: '/login/admin',
    };
    navigate(routes[portalType]);
  };

  const getPortalIcon = (type: PortalType) => {
    switch (type) {
      case 'creator': return Film;
      case 'investor': return DollarSign;
      case 'production': return Building;
      case 'admin': return ShieldCheck;
    }
  };

  const getPortalTitle = (type: PortalType) => {
    switch (type) {
      case 'creator': return 'Creator Portal';
      case 'investor': return 'Investor Portal';
      case 'production': return 'Production Portal';
      case 'admin': return 'Admin Portal';
    }
  };

  const getPortalDescription = (type: PortalType) => {
    switch (type) {
      case 'creator': return 'Submit and manage your movie pitches';
      case 'investor': return 'Discover and invest in promising projects';
      case 'production': return 'Find and develop exciting content';
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
              const colors = {
                creator: 'from-purple-400 to-purple-600 shadow-purple-500/30 hover:shadow-purple-500/50',
                investor: 'from-green-400 to-green-600 shadow-green-500/30 hover:shadow-green-500/50',
                production: 'from-orange-400 to-orange-600 shadow-orange-500/30 hover:shadow-orange-500/50',
                admin: 'from-red-400 to-red-600 shadow-red-500/30 hover:shadow-red-500/50'
              };
              const iconColors = {
                creator: 'text-purple-600',
                investor: 'text-green-600',
                production: 'text-orange-600',
                admin: 'text-red-600'
              };
              const bgColors = {
                creator: 'bg-purple-50',
                investor: 'bg-green-50',
                production: 'bg-orange-50',
                admin: 'bg-red-50'
              };
              
              return (
                <div
                  key={portal}
                  onClick={() => handlePortalSelect(portal)}
                  className={`bg-white rounded-xl p-8 cursor-pointer transform hover:scale-105 transition-all duration-300 border border-gray-200 shadow-lg shadow-${colors[portal].split(' ')[1].split('-')[0]}-200/50 hover:shadow-2xl hover:shadow-${colors[portal].split(' ')[1].split('-')[0]}-300/50`}
                  style={{
                    boxShadow: `0 10px 30px -10px ${
                      portal === 'creator' ? 'rgb(168 85 247 / 0.3)' :
                      portal === 'investor' ? 'rgb(34 197 94 / 0.3)' :
                      portal === 'admin' ? 'rgb(239 68 68 / 0.3)' :
                      'rgb(251 146 60 / 0.3)'
                    }`
                  }}
                >
                  <div className="text-center">
                    <div className={`inline-flex p-4 rounded-full ${bgColors[portal]} mb-6`}>
                      <Icon className={`h-12 w-12 ${iconColors[portal]}`} />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                      {getPortalTitle(portal)}
                    </h2>
                    <p className="text-gray-600">
                      {getPortalDescription(portal)}
                    </p>
                    <div className={`mt-6 w-full h-1 rounded-full bg-gradient-to-r ${colors[portal]}`}></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-purple-600 hover:text-purple-700 font-semibold">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}