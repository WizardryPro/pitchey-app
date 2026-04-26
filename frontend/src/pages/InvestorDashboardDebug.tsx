import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { LogOut } from 'lucide-react';

// Import components one by one for testing
// import { NotificationBell } from '../components/NotificationBell';
// import { NotificationWidget } from '../components/Dashboard/NotificationWidget';
// import { QuickNDAStatus } from '../components/NDA/NDADashboardIntegration';
// import InvestmentPortfolioCard from '../components/Investment/InvestmentPortfolioCard';
// import InvestmentHistory from '../components/Investment/InvestmentHistory';
// import InvestmentOpportunities from '../components/Investment/InvestmentOpportunities';
// import { EnhancedInvestorAnalytics } from '../components/Analytics/EnhancedInvestorAnalytics';

export default function InvestorDashboardDebug() {
  const navigate = useNavigate();
  const { logout } = useBetterAuthStore();
  const [user, setUser] = useState<{ id: number; email: string; username: string; userType: string; companyName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testPhase, setTestPhase] = useState(1);

  // Test phases:
  // Phase 1: Basic layout only
  // Phase 2: Add NotificationBell 
  // Phase 3: Add NotificationWidget
  // Phase 4: Add QuickNDAStatus
  // Phase 5: Add InvestmentPortfolioCard
  // Phase 6: Add InvestmentHistory  
  // Phase 7: Add InvestmentOpportunities
  // Phase 8: Add EnhancedInvestorAnalytics

  useEffect(() => {
    
    // Simulate basic data loading
    setTimeout(() => {
      setUser({
        id: 2,
        email: 'sarah.investor@demo.com',
        username: 'sarahinvestor',
        userType: 'investor',
        companyName: 'Johnson Ventures'
      });
      setLoading(false);
    }, 1000);
  }, [testPhase]);

  const handleLogout = () => {
    void logout();
  };

  const nextPhase = () => {
    setTestPhase(prev => prev + 1);
  };

  const resetPhase = () => {
    setTestPhase(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Dashboard Debug (Phase {testPhase})...</p>
        </div>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">⚠️ Component Error Detected</h2>
          <p className="text-gray-600 mb-4">Error in Phase {testPhase}: {error}</p>
          <button 
            onClick={() => setError(null)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Debug Controls */}
      <div className="bg-yellow-100 border-b-2 border-yellow-300 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-yellow-800">
              🧪 DASHBOARD DEBUG MODE - Phase {testPhase}
            </h1>
            <p className="text-yellow-700">
              {testPhase === 1 && "Testing: Basic layout only"}
              {testPhase === 2 && "Testing: + NotificationBell"}
              {testPhase === 3 && "Testing: + NotificationWidget"}
              {testPhase === 4 && "Testing: + QuickNDAStatus"}
              {testPhase === 5 && "Testing: + InvestmentPortfolioCard"}
              {testPhase === 6 && "Testing: + InvestmentHistory"}
              {testPhase === 7 && "Testing: + InvestmentOpportunities"}
              {testPhase === 8 && "Testing: + EnhancedInvestorAnalytics"}
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={nextPhase}
              disabled={testPhase >= 8}
              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400"
            >
              Next Phase
            </button>
            <button 
              onClick={resetPhase}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <button
                onClick={() => { void navigate('/'); }}
                className="text-2xl font-bold text-blue-600"
              >
                Pitchey
              </button>
              <span className="text-lg text-gray-700">Investor Dashboard (Debug)</span>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Phase 2: Test NotificationBell */}
              {testPhase >= 2 && (
                <div className="border border-red-200 p-2 rounded">
                  <span className="text-red-600 text-sm">Phase 2: NotificationBell</span>
                  {/* Uncomment when testing: <NotificationBell size="md" /> */}
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    🔔
                  </div>
                </div>
              )}
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-red-600 transition"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.companyName ?? 'Investor'}!</h1>
          <p className="text-gray-600">Here's your investment portfolio overview</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2">
            
            {/* Phase 3: Test NotificationWidget */}
            {testPhase >= 3 && (
              <div className="border border-red-200 p-4 rounded-lg mb-6 bg-red-50">
                <h3 className="text-red-600 font-medium mb-2">Phase 3: NotificationWidget</h3>
                {/* Uncomment when testing: <NotificationWidget maxNotifications={4} compact={true} /> */}
                <div className="bg-white p-4 rounded border">
                  <p className="text-gray-500">NotificationWidget placeholder</p>
                </div>
              </div>
            )}

            {/* Phase 5: Test InvestmentPortfolioCard */}
            {testPhase >= 5 && (
              <div className="border border-red-200 p-4 rounded-lg mb-6 bg-red-50">
                <h3 className="text-red-600 font-medium mb-2">Phase 5: InvestmentPortfolioCard</h3>
                {/* Uncomment when testing: <InvestmentPortfolioCard metrics={null} className="mb-8" /> */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium">Portfolio Overview</h3>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-indigo-600">$0</p>
                      <p className="text-sm text-gray-500">Total Invested</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">0</p>
                      <p className="text-sm text-gray-500">Active Deals</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 6: Test InvestmentHistory */}
            {testPhase >= 6 && (
              <div className="border border-red-200 p-4 rounded-lg mb-6 bg-red-50">
                <h3 className="text-red-600 font-medium mb-2">Phase 6: InvestmentHistory</h3>
                {/* Uncomment when testing: <InvestmentHistory investments={[]} loading={false} showPagination={false} pageSize={5} className="mb-6" /> */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium">Recent Investments</h3>
                  <p className="text-gray-500 mt-2">No investment history to display</p>
                </div>
              </div>
            )}

          </div>

          {/* Right Column */}
          <div>
            
            {/* Phase 4: Test QuickNDAStatus */}
            {testPhase >= 4 && (
              <div className="border border-red-200 p-4 rounded-lg mb-6 bg-red-50">
                <h3 className="text-red-600 font-medium mb-2">Phase 4: QuickNDAStatus</h3>
                {/* Uncomment when testing: <QuickNDAStatus /> */}
                <div className="bg-white p-4 rounded border">
                  <p className="text-gray-500">QuickNDAStatus placeholder</p>
                </div>
              </div>
            )}

            {/* Phase 8: Test EnhancedInvestorAnalytics */}
            {testPhase >= 8 && (
              <div className="border border-red-200 p-4 rounded-lg mb-6 bg-red-50">
                <h3 className="text-red-600 font-medium mb-2">Phase 8: EnhancedInvestorAnalytics</h3>
                {/* Uncomment when testing: <EnhancedInvestorAnalytics portfolioPerformance={null} /> */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium">Analytics</h3>
                  <p className="text-gray-500 mt-2">Analytics placeholder</p>
                </div>
              </div>
            )}

            {/* Phase 7: Test InvestmentOpportunities */}
            {testPhase >= 7 && (
              <div className="border border-red-200 p-4 rounded-lg mb-6 bg-red-50">
                <h3 className="text-red-600 font-medium mb-2">Phase 7: InvestmentOpportunities</h3>
                {/* Uncomment when testing: <InvestmentOpportunities opportunities={[]} loading={false} showMatchScore={true} className="mb-6" /> */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium">Investment Opportunities</h3>
                  <p className="text-gray-500 mt-2">No opportunities available</p>
                </div>
              </div>
            )}
            
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-medium text-gray-900">Debug Information:</h3>
          <pre className="text-sm text-gray-600 mt-2">
{JSON.stringify({ 
  testPhase, 
  user: user ? { id: user.id, email: user.email, userType: user.userType } : null,
  loading,
  error
}, null, 2)}
          </pre>
        </div>
      </main>
    </div>
  );
}