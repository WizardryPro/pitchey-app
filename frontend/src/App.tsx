import React, { useEffect, useState, Suspense, lazy, startTransition } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// React Query temporarily disabled to resolve JavaScript initialization errors
// Using Better Auth store instead of legacy authStore
import { useBetterAuthStore } from './store/betterAuthStore';
import { GlobalErrorBoundary } from '@shared/components/feedback/ConsoleErrorBoundary';
import ToastProvider from '@shared/components/feedback/ToastProvider';
import { NotificationToastProvider } from '@shared/components/feedback/NotificationToastContainer';
import LoadingSpinner from '@shared/components/feedback/LoadingSpinner';
// Import safe context provider (without legacy AuthProvider)
import { AppContextProviderSafe } from '@shared/contexts/AppContextProviderSafe';
import { configService } from './services/config.service';
import { API_URL } from './config';
// Import enhanced route components
import { AllCreatorRoutes, AllInvestorRoutes, AllProductionRoutes } from './components/routing/AllEnhancedRoutes';
// Import new Portal Layout
import { PortalLayout } from '@shared/components/layout/PortalLayout';
import { ProfileGuard } from '@/features/auth/components/ProfileGuard';
import { PermissionRoute } from '@features/auth/components/PermissionGuard';
import { Permission } from '@features/auth/hooks/usePermissions';

// Log environment on app load (dev only)
if (import.meta.env.DEV) {
  console.info('Pitchey App Environment:', {
    MODE: import.meta.env.MODE,
    API_URL: API_URL,
  });
}

// Retry wrapper for lazy imports — handles stale chunks after deploys
// If a chunk fails to load (404 after deploy), retry once then reload the page
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    factory().catch((err) => {
      // Chunk likely stale after deploy — reload the page once.
      // Use localStorage so the guard survives tab close/reopen.
      const reloadKey = 'chunk-reload-' + window.location.pathname;
      const lastReload = localStorage.getItem(reloadKey);
      const now = Date.now();
      // Allow a fresh reload if the last one was more than 30s ago
      if (!lastReload || now - parseInt(lastReload) > 30000) {
        localStorage.setItem(reloadKey, String(now));
        window.location.reload();
        return new Promise<never>(() => {});
      }
      // Already reloaded recently — clear flag and let error boundary handle it
      localStorage.removeItem(reloadKey);
      throw err;
    })
  );
}

// Immediately needed components (not lazy loaded)
import Layout from './components/Layout';

// Lazy load Homepage with prefetch
const Homepage = lazyRetry(() =>
  import('./pages/Homepage' /* webpackPrefetch: true */)
)

// Lazy loaded pages with prefetch for critical paths
const Login = lazyRetry(() => import('./pages/Login' /* webpackPrefetch: true */));
const Register = lazyRetry(() => import('./pages/Register' /* webpackPrefetch: true */));
const Dashboard = lazyRetry(() => import('./pages/Dashboard'));

// Onboarding Components (lazy-loaded to defer onboarding CSS)
const OnboardingSettings = lazyRetry(() => import('./components/Onboarding/OnboardingSettings'));

// Multi-Portal Pages
const PortalSelect = lazyRetry(() => import('./pages/PortalSelect'));
const CreatorLogin = lazyRetry(() => import('./pages/CreatorLogin'));
const InvestorLogin = lazyRetry(() => import('./pages/InvestorLogin'));
const ProductionLogin = lazyRetry(() => import('./pages/ProductionLogin'));
const CreatorDashboard = lazyRetry(() => import('./pages/CreatorDashboard'));
const InvestorDashboard = lazyRetry(() => import('./pages/InvestorDashboard'));
const InvestorDashboardDebug = lazyRetry(() => import('./pages/InvestorDashboardDebug'));
const ProductionDashboard = lazyRetry(() => import('./pages/ProductionDashboard'));
const ProductionNDAManagement = lazyRetry(() => import('@portals/production/pages/ProductionNDAManagement'));
const CreatorProfile = lazyRetry(() => import('./pages/CreatorProfile'));
const OnboardingPage = lazyRetry(() => import('@portals/creator/pages/CreatorOnboardingPage'));

// Public Pages
const Marketplace = lazyRetry(() => import('./pages/MarketplaceEnhanced'));
const PublicPitchView = lazyRetry(() => import('./pages/PublicPitchView'));

// Creator Pages
const CreatePitch = lazyRetry(() => import('./pages/CreatePitch'));
const ManagePitches = lazyRetry(() => import('./pages/ManagePitches'));
const Messages = lazyRetry(() => import('./pages/Messages'));
const Calendar = lazyRetry(() => import('./pages/Calendar'));
const PitchDetail = lazyRetry(() => import('./pages/PitchDetail'));
const PitchEdit = lazyRetry(() => import('./pages/PitchEdit'));
const PitchAnalytics = lazyRetry(() => import('./pages/PitchAnalytics'));
const CreatorNDAManagement = lazyRetry(() => import('./pages/CreatorNDAManagement'));
const CreatorPitchView = lazyRetry(() => import('@portals/creator/pages/CreatorPitchView'));
const CreatorActivity = lazyRetry(() => import('@portals/creator/pages/CreatorActivity'));
const CreatorStats = lazyRetry(() => import('@portals/creator/pages/CreatorStats'));
const CreatorPitchesPublished = lazyRetry(() => import('@portals/creator/pages/CreatorPitchesPublished'));
const CreatorPitchesDrafts = lazyRetry(() => import('@portals/creator/pages/CreatorPitchesDrafts'));
const CreatorPitchesReview = lazyRetry(() => import('@portals/creator/pages/CreatorPitchesReview'));
const CreatorPitchesAnalytics = lazyRetry(() => import('@portals/creator/pages/CreatorPitchesAnalytics'));
const CreatorTeamMembers = lazyRetry(() => import('@portals/creator/pages/CreatorTeamMembers'));
const CreatorTeamInvite = lazyRetry(() => import('@portals/creator/pages/CreatorTeamInvite'));
const CreatorTeamRoles = lazyRetry(() => import('@portals/creator/pages/CreatorTeamRoles'));
const CreatorCollaborations = lazyRetry(() => import('@portals/creator/pages/CreatorCollaborations'));
const CreatorAnalyticsPage = lazyRetry(() => import('./pages/CreatorAnalyticsPage'));
const ProductionAnalyticsPage = lazyRetry(() => import('./pages/ProductionAnalyticsPage'));

// Production Pages
const ProductionPitchCreate = lazyRetry(() => import('./pages/ProductionPitchCreate'));
const ProductionPitchDetail = lazyRetry(() => import('./pages/ProductionPitchDetail'));
const ProductionPitchView = lazyRetry(() => import('@portals/production/pages/ProductionPitchView'));

// Common Pages
const Profile = lazyRetry(() => import('./pages/Profile'));
const Settings = lazyRetry(() => import('./pages/Settings'));
const NotificationCenter = lazyRetry(() => import('./pages/NotificationCenter'));

// Investor Pages
const InvestorBrowse = lazyRetry(() => import('./pages/InvestorBrowse'));
const InvestorPitchView = lazyRetry(() => import('@portals/investor/pages/InvestorPitchView'));

// Billing Page
const Billing = lazyRetry(() => import('./pages/Billing'));

// Following/Portfolio Pages
const Following = lazyRetry(() => import('./pages/Following'));
const CreatorPortfolio = lazyRetry(() => import('./pages/CreatorPortfolio'));
const UserPortfolio = lazyRetry(() => import('./pages/UserPortfolio'));

// Info Pages
const HowItWorks = lazyRetry(() => import('./pages/HowItWorks'));
const About = lazyRetry(() => import('./pages/About'));
const Contact = lazyRetry(() => import('./pages/Contact'));
const Terms = lazyRetry(() => import('./pages/Terms'));
const Privacy = lazyRetry(() => import('./pages/Privacy'));

// Admin Pages
const AdminLayout = lazyRetry(() => import('@portals/admin/components/AdminLayout'));
const AdminDashboard = lazyRetry(() => import('@portals/admin/pages/AdminDashboard'));
const UserManagement = lazyRetry(() => import('@portals/admin/pages/UserManagement'));
const ContentModeration = lazyRetry(() => import('@portals/admin/pages/ContentModeration'));
const AuditLog = lazyRetry(() => import('@portals/admin/pages/AuditLog'));

// MFA Challenge Page
const MFAChallengePage = lazyRetry(() => import('./pages/MFAChallengePage'));

// Passwordless Email OTP Login
const EmailOTPLogin = lazyRetry(() => import('./pages/EmailOTPLogin'));

// Coming Soon Page for unimplemented routes
const ComingSoon = lazyRetry(() => import('./pages/ComingSoon'));
const NDARequests = lazyRetry(() => import('@portals/investor/pages/NDARequests'));

// New Investor Pages
const PerformanceTracking = lazyRetry(() => import('@portals/investor/pages/PerformanceTracking'));
const PendingDeals = lazyRetry(() => import('@portals/investor/pages/PendingDeals'));
const AllInvestments = lazyRetry(() => import('@portals/investor/pages/AllInvestments'));
const CompletedProjects = lazyRetry(() => import('@portals/investor/pages/CompletedProjects'));
const ROIAnalysis = lazyRetry(() => import('@portals/investor/pages/ROIAnalysis'));
const MarketTrends = lazyRetry(() => import('@portals/investor/pages/MarketTrends'));
const RiskAssessment = lazyRetry(() => import('@portals/investor/pages/RiskAssessment'));
const FinancialOverview = lazyRetry(() => import('@portals/investor/pages/FinancialOverview'));
const TransactionHistory = lazyRetry(() => import('@portals/investor/pages/TransactionHistory'));
const BudgetAllocation = lazyRetry(() => import('@portals/investor/pages/BudgetAllocation'));
const TaxDocuments = lazyRetry(() => import('@portals/investor/pages/TaxDocuments'));
const InvestorSettings = lazyRetry(() => import('@portals/investor/pages/InvestorSettings'));
const InvestorWallet = lazyRetry(() => import('@portals/investor/pages/InvestorWallet'));
const PaymentMethods = lazyRetry(() => import('@portals/investor/pages/PaymentMethods'));

// New Pages
const ProductionProjects = lazyRetry(() => import('@portals/production/pages/ProductionProjects'));
const ProductionProjectsDevelopment = lazyRetry(() => import('@portals/production/pages/ProductionProjectsDevelopment'));
const ProductionProjectsActive = lazyRetry(() => import('@portals/production/pages/ProductionProjectsActive'));
const ProductionProjectsPost = lazyRetry(() => import('@portals/production/pages/ProductionProjectsPost'));
const ProductionProjectsCompleted = lazyRetry(() => import('@portals/production/pages/ProductionProjectsCompleted'));
const ProductionPipeline = lazyRetry(() => import('@portals/production/pages/ProductionPipeline'));
const ProductionSubmissions = lazyRetry(() => import('@portals/production/pages/ProductionSubmissions'));
const ProductionSubmissionsNew = lazyRetry(() => import('@portals/production/pages/ProductionSubmissionsNew'));
const ProductionSubmissionsReview = lazyRetry(() => import('@portals/production/pages/ProductionSubmissionsReview'));
const ProductionSubmissionsShortlisted = lazyRetry(() => import('@portals/production/pages/ProductionSubmissionsShortlisted'));
const ProductionSubmissionsAccepted = lazyRetry(() => import('@portals/production/pages/ProductionSubmissionsAccepted'));
const ProductionSubmissionsRejected = lazyRetry(() => import('@portals/production/pages/ProductionSubmissionsRejected'));
const ProductionSubmissionsArchive = lazyRetry(() => import('@portals/production/pages/ProductionSubmissionsArchive'));
const ProductionAnalytics = lazyRetry(() => import('@portals/production/pages/ProductionAnalytics'));
const ProductionActivity = lazyRetry(() => import('@portals/production/pages/ProductionActivity'));
const ProductionStats = lazyRetry(() => import('@portals/production/pages/ProductionStats'));
const TeamManagement = lazyRetry(() => import('./pages/TeamManagement'));
// TeamMembers and TeamInvite routes now redirect to /team (TeamManagement)
const TeamRoles = lazyRetry(() => import('@portals/production/pages/TeamRoles'));
const ProductionCollaborations = lazyRetry(() => import('@portals/production/pages/ProductionCollaborations'));
const ProductionRevenue = lazyRetry(() => import('@portals/production/pages/ProductionRevenue'));
const ProductionSaved = lazyRetry(() => import('@portals/production/pages/ProductionSaved'));
const AdvancedSearch = lazyRetry(() => import('./pages/AdvancedSearch'));
const SearchPage = lazyRetry(() => import('./pages/SearchPage'));
const SettingsProfile = lazyRetry(() => import('./pages/settings/SettingsProfile'));
const NotificationSettings = lazyRetry(() => import('./pages/settings/NotificationSettings'));
const PrivacySettings = lazyRetry(() => import('./pages/settings/PrivacySettings'));
const InvestorPortfolio = lazyRetry(() => import('@portals/investor/pages/InvestorPortfolio'));
const InvestorActivity = lazyRetry(() => import('@portals/investor/pages/InvestorActivity'));
const InvestorAnalytics = lazyRetry(() => import('@portals/investor/pages/InvestorAnalytics'));
const InvestorStats = lazyRetry(() => import('@portals/investor/pages/InvestorStats'));
const InvestorSaved = lazyRetry(() => import('@portals/investor/pages/InvestorSaved'));
const InvestorWatchlist = lazyRetry(() => import('@portals/investor/pages/InvestorWatchlist'));
const InvestorDeals = lazyRetry(() => import('@portals/investor/pages/InvestorDeals'));
const InvestorPerformance = lazyRetry(() => import('@portals/investor/pages/InvestorPerformance'));
const InvestorDiscover = lazyRetry(() => import('@portals/investor/pages/InvestorDiscover'));
const InvestorReports = lazyRetry(() => import('@portals/investor/pages/InvestorReports'));
const InvestorNetwork = lazyRetry(() => import('@portals/investor/pages/InvestorNetwork'));
const InvestorCoInvestors = lazyRetry(() => import('@portals/investor/pages/InvestorCoInvestors'));
const InvestorProductionCompanies = lazyRetry(() => import('@portals/investor/pages/InvestorProductionCompanies'));
const InvestorCreators = lazyRetry(() => import('@portals/investor/pages/InvestorCreators'));
const Transactions = lazyRetry(() => import('@portals/admin/pages/Transactions'));
const SystemSettings = lazyRetry(() => import('@portals/admin/pages/SystemSettings'));
const AcceptInvitePage = lazyRetry(() => import('./pages/AcceptInvitePage'));

// Test Pages
const TestNavigation = lazyRetry(() => import('./pages/TestNavigation'));

// Legal Pages
const LegalDocumentWizard = lazyRetry(() => import('./components/Legal/LegalDocumentWizard'));
const LegalLibrary = lazyRetry(() => import('./components/Legal/LegalLibrary'));
const DocumentComparisonTool = lazyRetry(() => import('./components/Legal/DocumentComparisonTool'));
const TemplateEditor = lazyRetry(() => import('./components/Legal/TemplateEditor'));
const LegalDocumentDashboard = lazyRetry(() => import('./components/Legal/LegalDocumentDashboard'));

// Browse Pages
const BrowseTabsFixed = lazyRetry(() => import('@features/browse/components/BrowseTabsFixed'));
const BrowseGenres = lazyRetry(() => import('./pages/BrowseGenres'));
const BrowseTopRated = lazyRetry(() => import('./pages/BrowseTopRated'));

// Error Pages
const NotFound = lazyRetry(() => import('./pages/NotFound'));

// Query client temporarily disabled to resolve JavaScript initialization errors

// Component to handle pitch routing - conditionally shows authenticated vs public view
function PitchRouter() {
  const { isAuthenticated } = useBetterAuthStore();
  
  // Show authenticated PitchDetail for logged in users, PublicPitchView for guests
  // This ensures authenticated users get access to protected content when they have signed NDAs
  if (isAuthenticated) {
    return <PitchDetail />;
  } else {
    return <PublicPitchView />;
  }
}

function LegalLayoutWrapper() {
  const { user } = useBetterAuthStore();
  const userType = (user?.userType as 'creator' | 'investor' | 'production') || 'creator';
  return <PortalLayout userType={userType} />;
}

function App() {
  const { isAuthenticated, user, loading, checkSession } = useBetterAuthStore();
  const [profileFetched, setProfileFetched] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Load configuration on app startup
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Use startTransition for non-urgent update
        startTransition(() => {
          configService.getConfiguration().then(() => {
            setConfigLoaded(true);
          });
        });
      } catch (error) {
        console.warn('Failed to load configuration, using fallback:', error);
        setConfigLoaded(true);
      }
    };
    loadConfig();
  }, []);

  // Initialize app with proper session verification
  useEffect(() => {
    let mounted = true;
    
    const initApp = async () => {
      if (!sessionChecked && mounted) {
        try {
          // Check session to ensure authentication state is correct
          // The session manager handles rate limiting, so this is safe to call
          await checkSession();
          
          setSessionChecked(true);
          setProfileFetched(true);
          
          // Small delay to ensure state updates propagate
          setTimeout(() => {
            if (mounted) {
              setInitializing(false);
            }
          }, 100);
        } catch (error) {
          console.error('[App] Session check failed:', error);
          // Even if session check fails, mark as checked to prevent infinite loading
          // The user will just appear as not authenticated
          setSessionChecked(true);
          setProfileFetched(true);
          setTimeout(() => {
            if (mounted) {
              setInitializing(false);
            }
          }, 100);
        }
      }
    };
    
    // Initialize with proper session check
    initApp().catch(error => {
      console.error('[App] Initialization error:', error);
      // Even if init fails, mark as initialized to prevent infinite loading
      if (mounted) {
        setSessionChecked(true);
        setInitializing(false);
      }
    });
    
    return () => {
      mounted = false;
    };
  }, []); // Empty deps - only run once on mount

  // Removed redundant profile fetching - handled by session restoration above

  // Get userType from Better Auth user object, not localStorage
  const userType = user?.userType || null;

  // Show loading state while initializing to prevent flicker and navigation loops
  if (initializing || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <LoadingSpinner size="lg" text="Loading..." />
          <p className="mt-4 text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }


  return (
    <GlobalErrorBoundary>
      {/* Using safe context provider without problematic providers */}
      <AppContextProviderSafe>
        <NotificationToastProvider>
          <ToastProvider>
            <Router>
              <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                  <div className="text-center">
                    <LoadingSpinner size="lg" text="Loading..." />
                    <p className="mt-4 text-gray-600">Optimizing your experience...</p>
                  </div>
                </div>
              }>
                <Routes>
          {/* Homepage - Only render on exact path match */}
          <Route path="/" element={<Homepage />} />
          
          {/* Marketplace */}
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/marketplace-old" element={<Marketplace />} />
          
          {/* Browse Route */}
          <Route path="/browse" element={<BrowseTabsFixed />} />
          
          {/* Info Pages */}
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          
          {/* Test Pages — dev only */}
          {import.meta.env.DEV && <Route path="/test/navigation" element={<TestNavigation />} />}
          
          {/* Portal Selection */}
          <Route path="/portals" element={<PortalSelect />} />
          
          {/* Multi-Portal Login Routes */}
          <Route path="/login/creator" element={
            !isAuthenticated ? <CreatorLogin /> :
            userType === 'creator' ? <Navigate to="/creator/dashboard" replace /> :
            <Navigate to={`/${userType}/dashboard`} replace />
          } />
          <Route path="/login/investor" element={
            !isAuthenticated ? <InvestorLogin /> :
            userType === 'investor' ? <Navigate to="/investor/dashboard" replace /> :
            <Navigate to={`/${userType}/dashboard`} replace />
          } />
          <Route path="/login/production" element={
            !isAuthenticated ? <ProductionLogin /> :
            userType === 'production' ? <Navigate to="/production/dashboard" replace /> :
            <Navigate to={`/${userType}/dashboard`} replace />
          } />
          
          {/* Portal-specific login redirects */}
          <Route path="/investor/login" element={<Navigate to="/login/investor" replace />} />
          <Route path="/creator/login" element={<Navigate to="/login/creator" replace />} />
          <Route path="/production/login" element={<Navigate to="/login/production" replace />} />
          
          {/* Legacy /auth/* routes - redirect to /login/* */}
          <Route path="/auth/creator" element={<Navigate to="/login/creator" replace />} />
          <Route path="/auth/investor" element={<Navigate to="/login/investor" replace />} />
          <Route path="/auth/production" element={<Navigate to="/login/production" replace />} />
          <Route path="/login/admin" element={
            !isAuthenticated ? <Login /> : 
            userType === 'admin' ? <Navigate to="/admin/dashboard" /> :
            <Navigate to="/" />
          } />
          
          {/* Legacy routes (backwards compatibility) - redirect to appropriate dashboard */}
          <Route path="/login" element={
            !isAuthenticated ? <Login /> : 
            <Navigate to={userType ? `/${userType}/dashboard` : '/'} />
          } />
          <Route path="/register" element={
            !isAuthenticated ? <Register /> : 
            <Navigate to={userType ? `/${userType}/dashboard` : '/'} />
          } />
          
          {/* MFA Challenge (during login) */}
          <Route path="/mfa/challenge" element={<MFAChallengePage />} />

          {/* Passwordless Email OTP Login */}
          <Route path="/login/email" element={
            !isAuthenticated ? <EmailOTPLogin /> :
            <Navigate to={userType ? `/${userType}/dashboard` : '/'} replace />
          } />

          {/* Collaborator Invite Acceptance */}
          <Route path="/collaborate/accept" element={<AcceptInvitePage />} />

          {/* Creator Portal Routes - with profile guard + PortalLayout */}
          <Route path="/creator/*" element={
            isAuthenticated && userType === 'creator' ? <ProfileGuard userType="creator" /> :
            <Navigate to="/login/creator" />
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="dashboard" element={<CreatorDashboard />} />
            <Route path="pitch/new" element={<CreatePitch />} />
            <Route path="pitches" element={<ManagePitches />} />
            <Route path="analytics" element={<CreatorAnalyticsPage />} />
            <Route path="messages/*" element={<Messages />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="pitch/:id" element={<CreatorPitchView />} />
            <Route path="pitches/:id" element={<PitchDetail />} />
            <Route path="pitch/:id/edit" element={<PitchEdit />} />
            <Route path="pitches/:id/edit" element={<PitchEdit />} />
            <Route path="pitches/:id/analytics" element={<PitchAnalytics />} />
            <Route path="pitches/:id/:slug/analytics" element={<PitchAnalytics />} />
            <Route path="ndas" element={<CreatorNDAManagement />} />
            <Route path="following" element={<Following />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="portfolio" element={<CreatorPortfolio />} />

            {/* Enhanced Creator Routes */}
            {AllCreatorRoutes({ isAuthenticated: true, userType: 'creator' })}
          </Route>
          {/* Investor Portal Routes - with profile guard + PortalLayout */}
          <Route path="/investor/*" element={
            isAuthenticated && userType === 'investor' ? <ProfileGuard userType="investor" /> :
            <Navigate to="/login/investor" />
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="dashboard" element={<InvestorDashboard />} />
            {import.meta.env.DEV && <Route path="dashboard/debug" element={<InvestorDashboardDebug />} />}
            <Route path="following" element={<Following />} />
            <Route path="browse" element={<InvestorBrowse />} />
            <Route path="pitch/:id" element={<InvestorPitchView />} />
            <Route path="profile" element={<Profile />} />
            <Route path="messages/*" element={<Messages />} />
            <Route path="calendar" element={<Calendar />} />

            {/* Enhanced Investor Routes */}
            {AllInvestorRoutes({ isAuthenticated: true, userType: 'investor' })}
          </Route>
          {/* Production Pitch Create — outside PortalLayout (full-width wizard) */}
          <Route path="/production/pitch/new" element={
            isAuthenticated && userType === 'production' ? <CreatePitch /> :
            <Navigate to="/login/production" />
          } />
          {/* Production Pitch View — outside PortalLayout (full-width, no sidebar) */}
          <Route path="/production/pitch/:id" element={
            isAuthenticated && userType === 'production' ? <ProductionPitchView /> :
            <Navigate to="/login/production" />
          } />

          {/* Production Portal Routes - with profile guard + PortalLayout */}
          <Route path="/production/*" element={
            isAuthenticated && userType === 'production' ? <ProfileGuard userType="production" /> :
            <Navigate to="/login/production" />
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="dashboard" element={<ProductionDashboard />} />
            <Route path="following" element={<Following />} />
            <Route path="profile" element={<Profile />} />
            <Route path="messages/*" element={<Messages />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="ndas" element={<ProductionNDAManagement />} />

            {/* Enhanced Production Routes */}
            {AllProductionRoutes({ isAuthenticated: true, userType: 'production' })}
          </Route>
          
          {/* Admin Portal Routes — nested under AdminLayout with Suspense + ErrorBoundary */}
          <Route path="/admin/*" element={
            <PermissionRoute requires={Permission.ADMIN_ACCESS} redirectTo="/portals">
              <AdminLayout />
            </PermissionRoute>
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="content" element={<ContentModeration />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="settings" element={
              <PermissionRoute requiresAll={[Permission.ADMIN_ACCESS, Permission.ADMIN_SETTINGS]} redirectTo="/admin/dashboard">
                <SystemSettings />
              </PermissionRoute>
            } />
          </Route>

          {/* Creator Profile Route - accessible to all authenticated users */}
          <Route path="/creator/:creatorId" element={
            isAuthenticated ? <CreatorProfile /> : <Navigate to="/login/production" />
          } />
          <Route path="/pitch/:id/analytics" element={
            isAuthenticated && userType === 'production' ? <PitchAnalytics /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/production" />
          } />
          
          {/* Public pitch detail route */}
          <Route path="/pitch/:id" element={<PitchRouter />} />
          
          {/* Legacy Portfolio Routes (for backward compatibility) */}
          <Route path="/creator/portfolio" element={<CreatorPortfolio />} />
          <Route path="/creator/portfolio-auth" element={
            isAuthenticated && userType === 'creator' ? <CreatorPortfolio /> :
            <Navigate to="/login/creator" />
          } />
          
          {/* New Unified Portfolio Routes */}
          <Route path="/portfolio" element={<UserPortfolio />} />
          <Route path="/portfolio/:userId" element={<UserPortfolio />} />
          <Route path="/user/:userId" element={<UserPortfolio />} />
          
          {/* Common Protected Routes - Available to all user types */}
          <Route path="/profile" element={isAuthenticated ? <Profile /> : <Navigate to="/portals" />} />
          <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/portals" />} />
          <Route path="/settings/onboarding" element={isAuthenticated ? <OnboardingSettings /> : <Navigate to="/portals" />} />
          <Route path="/notifications" element={isAuthenticated ? <NotificationCenter /> : <Navigate to="/portals" />} />
          
          {/* Billing Routes - Available to all authenticated users */}
          <Route path="/billing" element={isAuthenticated ? <Billing /> : <Navigate to="/portals" />} />
          <Route path="/creator/billing" element={
            isAuthenticated && userType === 'creator' ? <Billing /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/investor/billing" element={
            isAuthenticated && userType === 'investor' ? <Billing /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/investor" />
          } />
          <Route path="/production/billing" element={
            isAuthenticated && userType === 'production' ? <Billing /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/production" />
          } />
          
          {/* Legacy Protected routes */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={
              isAuthenticated && userType ? <Navigate to={`/${userType}/dashboard`} replace /> :
              isAuthenticated ? <Dashboard /> :
              <Navigate to="/portals" />
            } />
            <Route path="/pitch/new" element={
              <PermissionRoute requires={Permission.PITCH_CREATE} redirectTo="/portals">
                <CreatePitch />
              </PermissionRoute>
            } />
          </Route>
          
          {/* All enhanced navigation routes are now handled within the PortalLayout wrapper above */}
          
          
          {/* Browse Routes - Public access */}
          <Route path="/browse/genres" element={<BrowseGenres />} />
          <Route path="/browse/top-rated" element={<BrowseTopRated />} />
          <Route path="/search" element={isAuthenticated ? <SearchPage /> : <Navigate to="/portals" />} />
          <Route path="/search/advanced" element={<Navigate to="/marketplace" replace />} />
          <Route path="/search/genre" element={isAuthenticated ? <SearchPage /> : <Navigate to="/portals" />} />
          <Route path="/search/budget" element={isAuthenticated ? <SearchPage /> : <Navigate to="/portals" />} />
          <Route path="/search/creators" element={isAuthenticated ? <SearchPage /> : <Navigate to="/portals" />} />
          <Route path="/search/companies" element={isAuthenticated ? <SearchPage /> : <Navigate to="/portals" />} />
          <Route path="/settings/profile" element={isAuthenticated ? <SettingsProfile /> : <Navigate to="/portals" />} />
          <Route path="/settings/account" element={isAuthenticated ? <SettingsProfile /> : <Navigate to="/portals" />} />
          <Route path="/settings/privacy" element={isAuthenticated ? <PrivacySettings /> : <Navigate to="/portals" />} />
          <Route path="/settings/notifications" element={isAuthenticated ? <NotificationSettings /> : <Navigate to="/portals" />} />
          <Route path="/settings/billing" element={isAuthenticated ? <Billing /> : <Navigate to="/portals" />} />
          <Route path="/settings/api" element={isAuthenticated ? <SettingsProfile /> : <Navigate to="/portals" />} />
          <Route path="/messages" element={isAuthenticated ? <Messages /> : <Navigate to="/portals" />} />
          
          {/* Generic Team Routes - Available to all authenticated users */}
          <Route path="/team" element={isAuthenticated ? <TeamManagement /> : <Navigate to="/portals" />} />
          <Route path="/team/members" element={<Navigate to="/team" replace />} />
          <Route path="/team/invite" element={<Navigate to="/team" replace />} />
          
          {/* Legal Document Automation Routes - Available to all authenticated users, wrapped in PortalLayout */}
          <Route path="/legal" element={isAuthenticated ? <LegalLayoutWrapper /> : <Navigate to="/portals" />}>
            <Route index element={<LegalDocumentDashboard />} />
            <Route path="dashboard" element={<LegalDocumentDashboard />} />
            <Route path="wizard" element={<LegalDocumentWizard />} />
            <Route path="library" element={<LegalLibrary />} />
            <Route path="compare" element={<DocumentComparisonTool />} />
            <Route path="templates" element={<TemplateEditor />} />
            <Route path="templates/new" element={<TemplateEditor />} />
            <Route path="templates/:id" element={<TemplateEditor />} />
          </Route>
          
                {/* 404 - Must be last */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              
            </Suspense>
          </Router>
        </ToastProvider>
      </NotificationToastProvider>
      </AppContextProviderSafe>
    </GlobalErrorBoundary>
  );
}

export default App;