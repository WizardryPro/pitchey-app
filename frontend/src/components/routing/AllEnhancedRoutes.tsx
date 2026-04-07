import React, { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';

// Import route configurations
import { CREATOR_ROUTES, INVESTOR_ROUTES, PRODUCTION_ROUTES } from '../../config/navigation.routes';

// Helper function to extract relative path from absolute path
const getRelativePath = (absolutePath: string, prefix: string): string => {
  if (absolutePath.startsWith(prefix + '/')) {
    return absolutePath.substring(prefix.length + 1);
  }
  return absolutePath;
};

// Lazy load all Creator pages
const CreatorActivity = lazy(() => import('@portals/creator/pages/CreatorActivity'));
const CreatorStats = lazy(() => import('@portals/creator/pages/CreatorStats'));
const CreatorPitchesPublished = lazy(() => import('@portals/creator/pages/CreatorPitchesPublished'));
const CreatorPitchesDrafts = lazy(() => import('@portals/creator/pages/CreatorPitchesDrafts'));
const CreatorPitchesReview = lazy(() => import('@portals/creator/pages/CreatorPitchesReview'));
const CreatorPitchesAnalytics = lazy(() => import('@portals/creator/pages/CreatorPitchesAnalytics'));
const CreatorTeamMembers = lazy(() => import('@portals/creator/pages/CreatorTeamMembers'));
const CreatorTeamInvite = lazy(() => import('@portals/creator/pages/CreatorTeamInvite'));
const CreatorTeamRoles = lazy(() => import('@portals/creator/pages/CreatorTeamRoles'));
const CreatorCollaborations = lazy(() => import('@portals/creator/pages/CreatorCollaborations'));
const CreatorInvestors = lazy(() => import('@portals/creator/pages/CreatorInvestors'));
const CreatorFundingSettings = lazy(() => import('@portals/creator/pages/CreatorFundingSettings'));

// Lazy load all Investor pages
const InvestorPortfolio = lazy(() => import('@portals/investor/pages/InvestorPortfolio'));
const InvestorDeals = lazy(() => import('@portals/investor/pages/InvestorDeals'));
const InvestorActivity = lazy(() => import('@portals/investor/pages/InvestorActivity'));
const InvestorAnalytics = lazy(() => import('@portals/investor/pages/InvestorAnalytics'));
const InvestorPerformance = lazy(() => import('@portals/investor/pages/InvestorPerformance'));
const InvestorSaved = lazy(() => import('@portals/investor/pages/InvestorSaved'));
const InvestorWatchlist = lazy(() => import('@portals/investor/pages/InvestorWatchlist'));
const InvestorNetwork = lazy(() => import('@portals/investor/pages/InvestorNetwork'));
const InvestorReports = lazy(() => import('@portals/investor/pages/InvestorReports'));
const _InvestorStats = lazy(() => import('@portals/investor/pages/InvestorStats'));
const InvestorCoInvestors = lazy(() => import('@portals/investor/pages/InvestorCoInvestors'));
const InvestorCreators = lazy(() => import('@portals/investor/pages/InvestorCreators'));
const InvestorProductionCompanies = lazy(() => import('@portals/investor/pages/InvestorProductionCompanies'));
const PendingDeals = lazy(() => import('@portals/investor/pages/PendingDeals'));
const AllInvestments = lazy(() => import('@portals/investor/pages/AllInvestments'));
const CompletedProjects = lazy(() => import('@portals/investor/pages/CompletedProjects'));
const FinancialOverview = lazy(() => import('@portals/investor/pages/FinancialOverview'));
const TransactionHistory = lazy(() => import('@portals/investor/pages/TransactionHistory'));
const BudgetAllocation = lazy(() => import('@portals/investor/pages/BudgetAllocation'));
const ROIAnalysis = lazy(() => import('@portals/investor/pages/ROIAnalysis'));
const TaxDocuments = lazy(() => import('@portals/investor/pages/TaxDocuments'));
const MarketTrends = lazy(() => import('@portals/investor/pages/MarketTrends'));
const RiskAssessment = lazy(() => import('@portals/investor/pages/RiskAssessment'));
const InvestorWallet = lazy(() => import('@portals/investor/pages/InvestorWallet'));
const PaymentMethods = lazy(() => import('@portals/investor/pages/PaymentMethods'));
const InvestorSettings = lazy(() => import('@portals/investor/pages/InvestorSettings'));
const NDARequests = lazy(() => import('@portals/investor/pages/NDARequests'));
const InvestorDiscover = lazy(() => import('@portals/investor/pages/InvestorDiscover'));

// Lazy load all Production pages
const ProductionActivity = lazy(() => import('@portals/production/pages/ProductionActivity'));
const ProductionAnalytics = lazy(() => import('@portals/production/pages/ProductionAnalytics'));
const ProductionStats = lazy(() => import('@portals/production/pages/ProductionStats'));
const ProductionProjects = lazy(() => import('@portals/production/pages/ProductionProjects'));
const ProductionProjectsActive = lazy(() => import('@portals/production/pages/ProductionProjectsActive'));
const ProductionProjectsDevelopment = lazy(() => import('@portals/production/pages/ProductionProjectsDevelopment'));
const ProductionProjectsPost = lazy(() => import('@portals/production/pages/ProductionProjectsPost'));
const ProductionProjectsCompleted = lazy(() => import('@portals/production/pages/ProductionProjectsCompleted'));
const ProductionPipeline = lazy(() => import('@portals/production/pages/ProductionPipeline'));
const ProductionSubmissions = lazy(() => import('@portals/production/pages/ProductionSubmissions'));
const ProductionSubmissionsNew = lazy(() => import('@portals/production/pages/ProductionSubmissionsNew'));
const ProductionSubmissionsReview = lazy(() => import('@portals/production/pages/ProductionSubmissionsReview'));
const ProductionSubmissionsShortlisted = lazy(() => import('@portals/production/pages/ProductionSubmissionsShortlisted'));
const ProductionSubmissionsAccepted = lazy(() => import('@portals/production/pages/ProductionSubmissionsAccepted'));
const ProductionSubmissionsRejected = lazy(() => import('@portals/production/pages/ProductionSubmissionsRejected'));
const ProductionSubmissionsArchive = lazy(() => import('@portals/production/pages/ProductionSubmissionsArchive'));
const ProductionRevenue = lazy(() => import('@portals/production/pages/ProductionRevenue'));
const ProductionSaved = lazy(() => import('@portals/production/pages/ProductionSaved'));
const ProductionCollaborations = lazy(() => import('@portals/production/pages/ProductionCollaborations'));
const ProductionInvites = lazy(() => import('@portals/production/pages/ProductionInvites'));
// TeamInvite route now redirects to /production/team (TeamManagement)
const TeamRoles = lazy(() => import('@portals/production/pages/TeamRoles'));
const ProductionPitchCreate = lazy(() => import('../../pages/ProductionPitchCreate'));
const TeamManagement = lazy(() => import('../../pages/TeamManagement'));
// TeamMembers route now redirects to /production/team (TeamManagement)
const ProductionVerification = lazy(() => import('@portals/production/pages/ProductionVerification'));
const ProductionSettingsProfile = lazy(() => import('@portals/production/pages/ProductionSettingsProfile'));
const ProductionSettingsBilling = lazy(() => import('@portals/production/pages/ProductionSettingsBilling'));
const ProductionSettingsNotifications = lazy(() => import('@portals/production/pages/ProductionSettingsNotifications'));
const ProductionSettingsSecurity = lazy(() => import('@portals/production/pages/ProductionSettingsSecurity'));

// Collaborator pages (shared across portals)
const MyCollaborations = lazy(() => import('../../pages/MyCollaborations'));
const CollaborationProjectView = lazy(() => import('../../pages/CollaborationProjectView'));

// Shared pages used across portals
const Following = lazy(() => import('../../pages/Following'));
const Settings = lazy(() => import('../../pages/Settings'));

interface RoutesProps {
  isAuthenticated: boolean;
  userType: string | null;
}

export function AllCreatorRoutes({ isAuthenticated, userType }: RoutesProps) {
  const isCreator = isAuthenticated && userType === 'creator';
  
  return (
    <>
      {/* Activity & Stats */}
      <Route path="activity" element={
        isCreator ? <CreatorActivity /> : <Navigate to="/login/creator" />
      } />
      <Route path="stats" element={
        isCreator ? <CreatorStats /> : <Navigate to="/login/creator" />
      } />
      
      {/* Pitch Management */}
      <Route path={getRelativePath(CREATOR_ROUTES.pitchesPublished, '/creator')} element={
        isCreator ? <CreatorPitchesPublished /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.pitchesDrafts, '/creator')} element={
        isCreator ? <CreatorPitchesDrafts /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.pitchesReview, '/creator')} element={
        isCreator ? <CreatorPitchesReview /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.pitchesAnalytics, '/creator')} element={
        isCreator ? <CreatorPitchesAnalytics /> : <Navigate to="/login/creator" />
      } />
      
      {/* Team Management */}
      <Route path={getRelativePath(CREATOR_ROUTES.teamMembers, '/creator')} element={
        isCreator ? <CreatorTeamMembers /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.teamInvite, '/creator')} element={
        isCreator ? <CreatorTeamInvite /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.teamRoles, '/creator')} element={
        isCreator ? <CreatorTeamRoles /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.collaborations, '/creator')} element={
        isCreator ? <CreatorCollaborations /> : <Navigate to="/login/creator" />
      } />
      <Route path="my-collaborations" element={
        isCreator ? <MyCollaborations /> : <Navigate to="/login/creator" />
      } />
      <Route path="my-collaborations/:projectId" element={
        isCreator ? <CollaborationProjectView /> : <Navigate to="/login/creator" />
      } />

      {/* Funding & Investors */}
      <Route path={getRelativePath(CREATOR_ROUTES.investors, '/creator')} element={
        isCreator ? <CreatorInvestors /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.fundingSettings, '/creator')} element={
        isCreator ? <CreatorFundingSettings /> : <Navigate to="/login/creator" />
      } />
    </>
  );
}

export function AllInvestorRoutes({ isAuthenticated, userType }: RoutesProps) {
  const isInvestor = isAuthenticated && userType === 'investor';
  
  return (
    <>
      {/* Dashboard & Analytics */}
      <Route path={getRelativePath(INVESTOR_ROUTES.portfolio, '/investor')} element={
        isInvestor ? <InvestorPortfolio /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.analytics, '/investor')} element={
        isInvestor ? <InvestorAnalytics /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.discover, '/investor')} element={
        isInvestor ? <InvestorDiscover /> : <Navigate to="/login/investor" />
      } />
      <Route path="discover/genres" element={
        isInvestor ? <InvestorDiscover /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.activity, '/investor')} element={
        isInvestor ? <InvestorActivity /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.performance, '/investor')} element={
        isInvestor ? <InvestorPerformance /> : <Navigate to="/login/investor" />
      } />
      
      {/* Deal Management */}
      <Route path={getRelativePath(INVESTOR_ROUTES.deals, '/investor')} element={
        isInvestor ? <InvestorDeals /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.pendingDeals, '/investor')} element={
        isInvestor ? <PendingDeals /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.allInvestments, '/investor')} element={
        isInvestor ? <AllInvestments /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.completedProjects, '/investor')} element={
        isInvestor ? <CompletedProjects /> : <Navigate to="/login/investor" />
      } />
      
      {/* Discovery */}
      <Route path={getRelativePath(INVESTOR_ROUTES.saved, '/investor')} element={
        isInvestor ? <InvestorSaved /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.watchlist, '/investor')} element={
        isInvestor ? <InvestorWatchlist /> : <Navigate to="/login/investor" />
      } />
      
      {/* Financial */}
      <Route path={getRelativePath(INVESTOR_ROUTES.financialOverview, '/investor')} element={
        isInvestor ? <FinancialOverview /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.transactionHistory, '/investor')} element={
        isInvestor ? <TransactionHistory /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.budgetAllocation, '/investor')} element={
        isInvestor ? <BudgetAllocation /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.roiAnalysis, '/investor')} element={
        isInvestor ? <ROIAnalysis /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.reports, '/investor')} element={
        isInvestor ? <InvestorReports /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.taxDocuments, '/investor')} element={
        isInvestor ? <TaxDocuments /> : <Navigate to="/login/investor" />
      } />
      
      {/* Market Analysis */}
      <Route path={getRelativePath(INVESTOR_ROUTES.marketTrends, '/investor')} element={
        isInvestor ? <MarketTrends /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.riskAssessment, '/investor')} element={
        isInvestor ? <RiskAssessment /> : <Navigate to="/login/investor" />
      } />
      
      {/* Network */}
      <Route path={getRelativePath(INVESTOR_ROUTES.network, '/investor')} element={
        isInvestor ? <InvestorNetwork /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.coInvestors, '/investor')} element={
        isInvestor ? <InvestorCoInvestors /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.creators, '/investor')} element={
        isInvestor ? <InvestorCreators /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.productionCompanies, '/investor')} element={
        isInvestor ? <InvestorProductionCompanies /> : <Navigate to="/login/investor" />
      } />
      
      {/* Account */}
      <Route path={getRelativePath(INVESTOR_ROUTES.wallet, '/investor')} element={
        isInvestor ? <InvestorWallet /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.paymentMethods, '/investor')} element={
        isInvestor ? <PaymentMethods /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.settings, '/investor')} element={
        isInvestor ? <InvestorSettings /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.ndaRequests, '/investor')} element={
        isInvestor ? <NDARequests /> : <Navigate to="/login/investor" />
      } />
      <Route path="my-collaborations" element={
        isInvestor ? <MyCollaborations /> : <Navigate to="/login/investor" />
      } />
      <Route path="my-collaborations/:projectId" element={
        isInvestor ? <CollaborationProjectView /> : <Navigate to="/login/investor" />
      } />
    </>
  );
}

export function AllProductionRoutes({ isAuthenticated, userType }: RoutesProps) {
  const isProduction = isAuthenticated && userType === 'production';
  
  return (
    <>
      {/* Verification */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.verification, '/production')} element={
        isProduction ? <ProductionVerification /> : <Navigate to="/login/production" />
      } />

      {/* Dashboard */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.analytics, '/production')} element={
        isProduction ? <ProductionAnalytics /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.activity, '/production')} element={
        isProduction ? <ProductionActivity /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.stats, '/production')} element={
        isProduction ? <ProductionStats /> : <Navigate to="/login/production" />
      } />
      
      {/* Projects */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.projects, '/production')} element={
        isProduction ? <ProductionProjects /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.projectsActive, '/production')} element={
        isProduction ? <ProductionProjectsActive /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.projectsDevelopment, '/production')} element={
        isProduction ? <ProductionProjectsDevelopment /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.projectsPost, '/production')} element={
        isProduction ? <ProductionProjectsPost /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.projectsCompleted, '/production')} element={
        isProduction ? <ProductionProjectsCompleted /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.pipeline, '/production')} element={
        isProduction ? <ProductionPipeline /> : <Navigate to="/login/production" />
      } />
      
      {/* Submissions */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissions, '/production')} element={
        isProduction ? <ProductionSubmissions /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissionsNew, '/production')} element={
        isProduction ? <ProductionSubmissionsNew /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissionsReview, '/production')} element={
        isProduction ? <ProductionSubmissionsReview /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissionsShortlisted, '/production')} element={
        isProduction ? <ProductionSubmissionsShortlisted /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissionsAccepted, '/production')} element={
        isProduction ? <ProductionSubmissionsAccepted /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissionsRejected, '/production')} element={
        isProduction ? <ProductionSubmissionsRejected /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissionsArchive, '/production')} element={
        isProduction ? <ProductionSubmissionsArchive /> : <Navigate to="/login/production" />
      } />
      
      {/* Invite Creators */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.invites, '/production')} element={
        isProduction ? <ProductionInvites /> : <Navigate to="/login/production" />
      } />

      {/* Operations */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.revenue, '/production')} element={
        isProduction ? <ProductionRevenue /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.saved, '/production')} element={
        isProduction ? <ProductionSaved /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.collaborations, '/production')} element={
        isProduction ? <ProductionCollaborations /> : <Navigate to="/login/production" />
      } />
      <Route path="my-collaborations" element={
        isProduction ? <MyCollaborations /> : <Navigate to="/login/production" />
      } />
      <Route path="my-collaborations/:projectId" element={
        isProduction ? <CollaborationProjectView /> : <Navigate to="/login/production" />
      } />

      {/* Pitch Creation */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.pitchNew, '/production')} element={
        isProduction ? <ProductionPitchCreate /> : <Navigate to="/login/production" />
      } />

      {/* Team */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.teamManagement, '/production')} element={
        isProduction ? <TeamManagement /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.teamMembers, '/production')} element={
        <Navigate to="/production/team" replace />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.teamInvite, '/production')} element={
        <Navigate to="/production/team" replace />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.teamRoles, '/production')} element={
        isProduction ? <TeamRoles /> : <Navigate to="/login/production" />
      } />

      {/* Account */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.following, '/production')} element={
        isProduction ? <Following /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.settings, '/production')} element={
        isProduction ? <Settings /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.settingsProfile, '/production')} element={
        isProduction ? <ProductionSettingsProfile /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.settingsBilling, '/production')} element={
        isProduction ? <ProductionSettingsBilling /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.settingsNotifications, '/production')} element={
        isProduction ? <ProductionSettingsNotifications /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.settingsSecurity, '/production')} element={
        isProduction ? <ProductionSettingsSecurity /> : <Navigate to="/login/production" />
      } />
    </>
  );
}