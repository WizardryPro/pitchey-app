// Navigation Routes Configuration
// This file centralizes all route definitions for the application

export const CREATOR_ROUTES = {
  // Main Dashboard
  dashboard: '/creator/dashboard',
  analytics: '/creator/analytics',
  activity: '/creator/activity',
  stats: '/creator/stats',
  
  // Pitch Management
  pitches: '/creator/pitches',
  pitchNew: '/creator/pitch/new',
  pitchesPublished: '/creator/pitches/published',
  pitchesDrafts: '/creator/pitches/drafts',
  pitchesReview: '/creator/pitches/review',
  pitchesAnalytics: '/creator/pitches/analytics',
  
  // Team Management
  teamMembers: '/creator/team/members',
  teamInvite: '/creator/team/invite',
  teamRoles: '/creator/team/roles',
  collaborations: '/creator/collaborations',
  myCollaborations: '/creator/my-collaborations',
  slates: '/creator/slates',
  
  // Onboarding
  onboarding: '/creator/onboarding',

  // Funding & Investors
  investors: '/creator/investors',
  fundingSettings: '/creator/funding-settings',

  // Other
  portfolio: '/creator/portfolio',
  ndas: '/creator/ndas',
  messages: '/creator/messages',
  calendar: '/creator/calendar',
  following: '/creator/following',
  profile: '/creator/profile',
  settings: '/creator/settings',

  // Legal Documents
  legalDashboard: '/legal/dashboard',
  legalWizard: '/legal/wizard',
  legalLibrary: '/legal/library',
  legalTemplates: '/legal/templates',
  legalCompare: '/legal/compare',
};

export const INVESTOR_ROUTES = {
  // Onboarding
  onboarding: '/investor/onboarding',

  // Main Dashboard
  dashboard: '/investor/dashboard',
  portfolio: '/investor/portfolio',
  analytics: '/investor/analytics',
  activity: '/investor/activity',
  performance: '/investor/performance',
  
  // Deal Management
  deals: '/investor/deals',
  pendingDeals: '/investor/pending-deals',
  allInvestments: '/investor/all-investments',
  completedProjects: '/investor/completed-projects',
  
  // Discovery
  browse: '/investor/browse',
  discover: '/investor/discover',
  saved: '/investor/saved',
  watchlist: '/investor/watchlist',
  
  // Financial
  financialOverview: '/investor/financial-overview',
  transactionHistory: '/investor/transaction-history',
  budgetAllocation: '/investor/budget-allocation',
  roiAnalysis: '/investor/roi-analysis',
  reports: '/investor/reports',
  taxDocuments: '/investor/tax-documents',
  
  // Market Analysis
  marketTrends: '/investor/market-trends',
  riskAssessment: '/investor/risk-assessment',
  
  // Network
  network: '/investor/network',
  coInvestors: '/investor/co-investors',
  creators: '/investor/creators',
  productionCompanies: '/investor/production-companies',
  
  // Account
  wallet: '/investor/wallet',
  paymentMethods: '/investor/payment-methods',
  settings: '/investor/settings',
  following: '/investor/following',
  ndaRequests: '/investor/nda-requests',
  myCollaborations: '/investor/my-collaborations',
};

export const PRODUCTION_ROUTES = {
  // Onboarding
  onboarding: '/production/onboarding',
  verification: '/production/verification',

  // Main Dashboard
  dashboard: '/production/dashboard',
  analytics: '/production/analytics',
  activity: '/production/activity',
  stats: '/production/stats',
  
  // Pitch Creation
  pitchNew: '/production/pitch/new',
  pitches: '/production/pitches',

  // Project Management
  projects: '/production/projects',
  projectsActive: '/production/projects/active',
  projectsDevelopment: '/production/projects/development',
  projectsPost: '/production/projects/post',
  projectsCompleted: '/production/projects/completed',
  pipeline: '/production/pipeline',
  
  // Submissions
  submissions: '/production/submissions',
  submissionsNew: '/production/submissions/new',
  submissionsReview: '/production/submissions/review',
  submissionsShortlisted: '/production/submissions/shortlisted',
  submissionsAccepted: '/production/submissions/accepted',
  submissionsRejected: '/production/submissions/rejected',
  submissionsArchive: '/production/submissions/archive',
  
  // Operations
  revenue: '/production/revenue',
  saved: '/production/saved',
  collaborations: '/production/collaborations',
  myCollaborations: '/production/my-collaborations',
  
  // Referral Invites
  invites: '/production/invites',

  // Team
  teamManagement: '/production/team',
  teamMembers: '/production/team/members',
  teamInvite: '/production/team/invite',
  teamRoles: '/production/team/roles',
  
  // Communication
  messages: '/production/messages',
  calendar: '/production/calendar',

  // Other
  profile: '/production/profile',
  following: '/production/following',
  settings: '/production/settings',
  settingsProfile: '/production/settings/profile',
  settingsBilling: '/production/settings/billing',
  settingsNotifications: '/production/settings/notifications',
  settingsSecurity: '/production/settings/security',

  // Legal Documents
  legalDashboard: '/legal/dashboard',
  legalWizard: '/legal/wizard',
  legalLibrary: '/legal/library',
  legalTemplates: '/legal/templates',
  legalCompare: '/legal/compare',
};

export const PUBLIC_ROUTES = {
  home: '/',
  marketplace: '/marketplace',
  browse: '/browse',
  howItWorks: '/how-it-works',
  about: '/about',
  contact: '/contact',
  terms: '/terms',
  privacy: '/privacy',
  portals: '/portals',
  
  // Login routes
  loginCreator: '/login/creator',
  loginInvestor: '/login/investor',
  loginProduction: '/login/production',
  
  // Public pitch view
  pitch: '/pitch/:id',
  userPortfolio: '/portfolio/:username',
};

export const WATCHER_ROUTES = {
  dashboard: '/watcher/dashboard',
  library: '/watcher/library',
  browse: '/watcher/browse',
  saved: '/watcher/saved',
  pitchNew: '/watcher/pitch/new',
  drafts: '/watcher/drafts',
  following: '/watcher/following',
  billing: '/watcher/billing',
  profile: '/watcher/profile',
  settings: '/watcher/settings',
};

export const ADMIN_ROUTES = {
  dashboard: '/admin/dashboard',
  analytics: '/admin/analytics',
  systemHealth: '/admin/system-health',
  users: '/admin/users',
  content: '/admin/content',
  moderationLog: '/admin/moderation-log',
  transactions: '/admin/transactions',
  reports: '/admin/reports',
  auditLog: '/admin/audit-log',
  gdpr: '/admin/gdpr',
  settings: '/admin/settings',
  verifications: '/admin/verifications',
};