// API Types - Centralized type definitions matching backend responses

// Base API Response Structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    status?: number;
    details?: any;
  } | string;
  message?: string;
  cached?: boolean;
}

// User Types
export interface User {
  id: number;
  email: string;
  username: string;
  userType: 'creator' | 'investor' | 'production' | 'admin' | 'viewer';
  verified: boolean;
  firstName?: string;
  lastName?: string;
  phone?: string;
  location?: string;
  bio?: string;
  profileImageUrl?: string;
  companyName?: string;
  companyNumber?: string;
  companyWebsite?: string;
  companyAddress?: string;
  emailVerified: boolean;
  companyVerified: boolean;
  isActive: boolean;
  subscriptionTier: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Character Types
export interface Character {
  id?: string;
  name: string;
  description: string;
  age?: string;
  gender?: string;
  actor?: string;
  displayOrder?: number;
}

// Media Types
export interface AdditionalMedia {
  type: 'lookbook' | 'script' | 'trailer' | 'pitch_deck' | 'budget_breakdown' | 'production_timeline' | 'other';
  url: string;
  title: string;
  description?: string;
  uploadedAt: string;
}

export interface EpisodeBreakdown {
  episodeNumber: number;
  title: string;
  synopsis: string;
}

export interface VisibilitySettings {
  showShortSynopsis: boolean;
  showCharacters: boolean;
  showBudget: boolean;
  showMedia: boolean;
}

// Pitch Types
export interface Pitch {
  id: number;
  userId: number;
  creatorId?: number;
  title: string;
  logline: string;
  genre: 'drama' | 'comedy' | 'thriller' | 'horror' | 'scifi' | 'fantasy' | 'documentary' | 'animation' | 'action' | 'romance' | 'other';
  format: 'feature' | 'tv' | 'short' | 'webseries' | 'other';
  formatCategory?: string;
  formatSubtype?: string;
  customFormat?: string;
  shortSynopsis?: string;
  longSynopsis?: string;
  opener?: string;
  premise?: string;
  targetAudience?: string;
  characters?: Character[];
  themes?: string;
  worldDescription?: string;
  episodeBreakdown?: EpisodeBreakdown[];
  budgetBracket?: string;
  estimatedBudget?: string;
  titleImage?: string;
  lookbookUrl?: string;
  pitchDeckUrl?: string;
  scriptUrl?: string;
  trailerUrl?: string;
  productionTimeline?: string;
  additionalMedia?: AdditionalMedia[];
  visibilitySettings?: VisibilitySettings;
  status: 'draft' | 'published' | 'under_review' | 'archived';
  publishedAt?: string;
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  aiUsed?: boolean;
  requireNDA?: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Related data (populated based on endpoint)
  creator?: {
    id: number;
    username: string;
    name?: string;
    profileImage?: string;
  };
  hasNDA?: boolean;
  isLiked?: boolean;
  canEdit?: boolean;
  isOwner?: boolean;
  isNew?: boolean;
  // Additional display fields
  thumbnailUrl?: string;
  posterUrl?: string;
  videoUrl?: string;
  mediaFiles?: any[];
  rating?: number;
  productionStage?: string;
  seekingInvestment?: boolean;
  commentCount?: number;
  shareCount?: number;
  // Business plan (snake_case from API)
  budget?: any;
  budget_breakdown?: any;
  financial_projections?: any;
  revenue_model?: any;
  marketing_strategy?: any;
  distribution_plan?: any;
  attached_talent?: any;
  contact_details?: any;
  private_attachments?: any[];
  tags?: string[];
  metadata?: any;
}

// NDA Types
export interface NDA {
  id: number;
  pitchId: number;
  userId: number; // NDA creator (pitch owner)
  signerId: number; // NDA signer
  requesterId?: number;
  ndaType: string; // 'basic', 'custom', etc.
  status: 'pending' | 'approved' | 'rejected' | 'signed' | 'expired' | 'revoked';
  documentUrl?: string;
  signedDocumentUrl?: string;
  customNdaText?: string;
  customTerms?: string;
  requestMessage?: string;
  message?: string;
  rejectionReason?: string;
  signedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  requestedAt?: string;
  respondedAt?: string;
  accessGranted?: boolean;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
  // Denormalized display fields
  pitchTitle?: string;
  pitchOwner?: string;
  requesterName?: string;
  signerName?: string;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;

  // Related data
  requester?: User;
  user?: User;
  signer?: User;
  pitch?: Pitch;
}

// NDA Request Types (separate from NDA)
export interface NDARequest {
  id: number;
  pitchId: number;
  requesterId: number;
  ownerId: number;
  ndaType: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestMessage?: string;
  rejectionReason?: string;
  companyInfo?: any;
  requestedAt: string;
  respondedAt?: string;
  expiresAt?: string;
  
  // Related data
  requester?: User;
  owner?: User;
  pitch?: Pitch;
}

// Info Request Types - Backend combines incoming/outgoing in responses
export interface InfoRequest {
  id: number;
  ndaId: number;
  pitchId: number;
  requesterId: number;
  ownerId: number;
  requestType: 'financial' | 'production' | 'legal' | 'marketing' | 'casting' | 'distribution' | 'technical' | 'general';
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'responded' | 'closed';
  response?: string;
  responseAt?: string;
  requestedAt: string;
  updatedAt: string;
  
  // Related data
  requester?: User;
  owner?: User;
  pitch?: Pitch;
  nda?: NDA;
  attachments?: InfoRequestAttachment[];
}

export interface InfoRequestAttachment {
  id: number;
  infoRequestId: number;
  fileName: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy?: number;
  uploadedAt: string;
}

// Combined Info Request Response (backend returns both incoming and outgoing)
export interface InfoRequestsResponse {
  incoming: InfoRequest[];
  outgoing: InfoRequest[];
  total: number;
  incomingCount: number;
  outgoingCount: number;
}

// Dashboard Types - Corrected field names
export interface InvestorDashboardStats {
  totalInvestments: number;
  activeInvestments: number;
  totalInvested: number;
  portfolioValue: number;
  avgROI: number;
  pitchesViewed: number;
  pitchesLiked: number;
  ndaSigned: number;
}

export interface CreatorDashboardStats {
  totalPitches: number;
  publishedPitches: number;
  totalViews: number;
  totalLikes: number;
  pendingNDAs: number;
  totalNDAs: number;
  avgEngagement: number;
  recentActivity: number;
}

export interface ProductionDashboardStats {
  activeProjects: number;
  totalInvestments: number;
  currentBudget: number;
  projectedRevenue: number;
  completedProjects: number;
  upcomingDeadlines: number;
  teamMembers: number;
  recentActivity: number;
}

// Investment Types
export interface Investment {
  id: number;
  pitchId: number;
  investorId: number;
  amount: number;
  percentage?: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  terms?: string;
  contractUrl?: string;
  investedAt?: string;
  investmentDate?: string;
  updatedAt: string;
  pitch?: Pitch;
  investor?: User;
  returns?: number;
  currentValue?: number;
  // Display fields
  initialAmount?: number;
  totalReturn?: number;
  roi?: number;
  ownership?: number;
  performance?: any;
  lastValuation?: number;
  nextMilestone?: string;
  company?: string;
  creator?: string;
  genre?: string;
}

export interface InvestmentOpportunity {
  id: number;
  pitch?: Pitch;
  title?: string;
  logline?: string;
  description?: string;
  genre?: string;
  status?: string;
  thumbnailUrl?: string;
  expectedROI?: number;
  minInvestment?: number;
  maxInvestment?: number;
  targetAmount?: number;
  raisedAmount?: number;
  investors?: number;
  deadline?: string;
  terms?: string;
  projectedROI?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  matchScore?: number;
}

export interface InvestorPortfolio {
  totalValue: number;
  totalInvested: number;
  totalReturns: number;
  investments: Investment[];
  performance: {
    date: string;
    value: number;
  }[];
  diversification: {
    genre: string;
    amount: number;
    percentage: number;
  }[];
}

export interface WatchlistItem {
  id: number;
  pitchId: number;
  userId: number;
  addedAt: string;
  notes?: string;
  alertsEnabled: boolean;
  pitch?: Pitch;
}

// Document Types
export interface PitchDocument {
  id: number;
  pitchId: number;
  fileName: string;
  originalFileName: string;
  fileUrl: string;
  fileKey?: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  documentType: 'script' | 'treatment' | 'pitch_deck' | 'nda' | 'supporting';
  isPublic: boolean;
  requiresNda: boolean;
  uploadedBy: number;
  uploadedAt: string;
  lastModified: string;
  downloadCount: number;
  metadata?: any;
}

// API Endpoint Response Types
export interface PitchesResponse {
  pitches: Pitch[];
  total?: number;
  totalCount?: number;
  pagination?: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
  filters?: {
    sortBy: string;
    order: string;
    genre: string | null;
    format: string | null;
  };
}

export interface SinglePitchResponse {
  pitch: Pitch;
  message?: string;
}

export interface DashboardResponse {
  dashboard: {
    stats: InvestorDashboardStats | CreatorDashboardStats | ProductionDashboardStats;
    recentOpportunities?: InvestmentOpportunity[];
    portfolio?: InvestorPortfolio;
    watchlist?: WatchlistItem[];
    activities?: any[];
    recentPitches?: Pitch[];
    analytics?: any;
  };
}

// Search and Filter Types
export interface SearchFilters {
  genre?: string;
  format?: string;
  search?: string;
  minBudget?: number;
  maxBudget?: number;
  status?: string;
  sortBy?: 'alphabetical' | 'date' | 'budget' | 'views' | 'likes';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  offset?: number;
}

// Form Input Types
export interface CreatePitchInput {
  title: string;
  logline: string;
  genre: string;
  format: string;
  formatCategory?: string;
  formatSubtype?: string;
  customFormat?: string;
  shortSynopsis?: string;
  longSynopsis?: string;
  characters?: Character[];
  themes?: string;
  worldDescription?: string;
  budgetBracket?: string;
  estimatedBudget?: number;
  productionTimeline?: string;
  titleImage?: string;
  lookbookUrl?: string;
  pitchDeckUrl?: string;
  scriptUrl?: string;
  trailerUrl?: string;
  additionalMedia?: AdditionalMedia[];
  aiUsed?: boolean;
  requireNDA?: boolean;
}

export interface UpdatePitchInput extends Partial<CreatePitchInput> {
  status?: 'draft' | 'published' | 'under_review' | 'archived';
  visibilitySettings?: VisibilitySettings;
}

export interface CreateInfoRequestInput {
  ndaId: number;
  pitchId: number;
  requestType: 'financial' | 'production' | 'legal' | 'marketing' | 'casting' | 'distribution' | 'technical' | 'general';
  subject: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface RespondToInfoRequestInput {
  infoRequestId: number;
  response: string;
}

// Authentication Types
export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
  error?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  username: string;
  firstName?: string;
  lastName?: string;
  userType: 'creator' | 'investor' | 'production';
  companyName?: string;
}