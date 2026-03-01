// Single source of truth for all TypeScript types
// This file consolidates all interface definitions to prevent duplication

// ========== USER TYPES ==========

export type UserType = 'creator' | 'investor' | 'production' | 'admin';

export interface User {
  id: number;
  email: string;
  username: string;
  userType: UserType;
  name?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  companyName?: string;
  companyDetails?: any;
  profilePicture?: string;
  profileImageUrl?: string;
  bio?: string;
  location?: string;
  phone?: string;
  website?: string;
  socialMedia?: {
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };
  verified: boolean;
  emailVerified?: boolean;
  companyVerified?: boolean;
  isActive?: boolean;
  subscriptionTier?: string;
  followersCount?: number;
  followingCount?: number;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  password?: string; // Only included in auth responses
}

// ========== PITCH TYPES ==========

export type PitchStatus = 'draft' | 'published' | 'archived' | 'flagged' | 'rejected';
export type PitchFormat = 'feature' | 'short' | 'tv' | 'web' | 'documentary' | 'animation' | 'other';
export type PitchGenre = 'action' | 'adventure' | 'comedy' | 'drama' | 'horror' | 'romance' | 
                         'scifi' | 'thriller' | 'fantasy' | 'mystery' | 'documentary' | 'animation';

export interface Pitch {
  id: number;
  userId: number;
  creatorId?: number;
  title: string;
  logline: string;
  genre: PitchGenre;
  format: PitchFormat;
  formatCategory?: string;
  formatSubtype?: string;
  customFormat?: string;
  shortSynopsis?: string;
  longSynopsis?: string;
  opener?: string;
  premise?: string;
  targetAudience?: string;
  characters?: string | Character[]; // Can be JSON string or parsed array
  themes?: string | string[]; // Converting to free-text/array
  worldDescription?: string; // New field for world-building
  episodeBreakdown?: string;
  budgetBracket?: string;
  estimatedBudget?: number;
  videoUrl?: string;
  posterUrl?: string;
  pitchDeckUrl?: string;
  additionalMaterials?: any;
  visibility?: string;
  status: PitchStatus;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  ndaCount: number;
  titleImage?: string;
  lookbookUrl?: string;
  scriptUrl?: string;
  trailerUrl?: string;
  additionalMedia?: any;
  productionTimeline?: string;
  requireNda: boolean;
  seekingInvestment: boolean; // New field
  publishedAt?: string;
  visibilitySettings?: {
    showBudget: boolean;
    showLocation: boolean;
    showCharacters: boolean;
    showShortSynopsis: boolean;
  };
  aiUsed: boolean;
  aiTools?: string[];
  aiDisclosure?: string;
  shareCount: number;
  feedback?: any[];
  tags?: string[];
  archived: boolean;
  archivedAt?: string;
  thumbnailUrl?: string;
  mediaFiles?: any[];
  rating?: number;
  productionStage?: string;
  isNew?: boolean;
  isOwner?: boolean;
  // Business plan fields
  budget?: any;
  budget_breakdown?: any;
  financial_projections?: any;
  revenue_model?: any;
  marketing_strategy?: any;
  distribution_plan?: any;
  attached_talent?: any;
  contact_details?: any;
  private_attachments?: any[];
  metadata?: any;
  hasNDA?: boolean;
  isLiked?: boolean;
  canEdit?: boolean;
  createdAt: string;
  updatedAt: string;

  // Relations
  creator?: User | { id: number; username: string; name?: string; profileImage?: string };
  ndas?: NDA[];
  comments?: Comment[];
  likes?: Like[];
}

// ========== CHARACTER TYPES ==========

export interface Character {
  id?: string | number;
  name: string;
  role: string;
  description: string;
  order?: number; // For reordering
}

// ========== NDA TYPES ==========

export type NDAStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'signed';
export type NDAType = 'basic' | 'enhanced' | 'custom';

export interface NDA {
  id: number;
  pitchId: number;
  userId: number;
  signerId: number;
  requesterId?: number;
  status: NDAStatus;
  ndaType?: NDAType;
  signedAt?: string;
  expiresAt?: string;
  documentUrl?: string;
  signedDocumentUrl?: string;
  requestMessage?: string;
  message?: string;
  rejectionReason?: string;
  customTerms?: string;
  customNdaText?: string;
  companyInfo?: {
    companyName: string;
    position: string;
    intendedUse: string;
  };
  accessGranted?: boolean;
  requestedAt?: string;
  respondedAt?: string;
  revokedAt?: string;
  requesterName?: string;
  notes?: string;
  // Denormalized display fields from API joins
  pitchTitle?: string;
  pitchOwner?: string;
  signerName?: string;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;

  // Relations
  pitch?: Pitch;
  user?: User;
  signer?: User;
  requester?: User;
}

// ========== MESSAGE TYPES ==========

export interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  subject?: string;
  content: string;
  pitchId?: number;
  isRead: boolean;
  createdAt: string;
  
  // Relations
  sender?: User;
  receiver?: User;
  pitch?: Pitch;
}

// ========== PORTFOLIO TYPES ==========

export interface Portfolio {
  id: number;
  investorId: number;
  pitchId: number;
  amount: number | string; // Can be decimal string from DB
  currentValue?: number | string;
  status: 'active' | 'exited' | 'pending';
  investmentDate: string;
  exitDate?: string;
  notes?: string;
  roi?: number;
  
  // Relations
  investor?: User;
  pitch?: Pitch;
}

// ========== FOLLOW TYPES ==========

export interface Follow {
  id: number;
  followerId: number;
  pitchId?: number;
  creatorId?: number;
  followedAt: string;
  
  // Relations
  follower?: User;
  pitch?: Pitch;
  creator?: User;
}

// ========== WATCHLIST TYPES ==========

export interface WatchlistItem {
  id: number;
  userId: number;
  pitchId: number;
  notes?: string;
  priority?: 'high' | 'medium' | 'low';
  addedAt: string;
  
  // Relations
  user?: User;
  pitch?: Pitch;
}

// ========== COMMENT TYPES ==========

export interface Comment {
  id: number;
  userId: number;
  pitchId: number;
  content: string;
  parentId?: number; // For nested comments
  createdAt: string;
  updatedAt: string;
  
  // Relations
  user?: User;
  pitch?: Pitch;
  parent?: Comment;
  replies?: Comment[];
}

// ========== LIKE TYPES ==========

export interface Like {
  id: number;
  userId: number;
  pitchId: number;
  createdAt: string;
  
  // Relations
  user?: User;
  pitch?: Pitch;
}

// ========== NOTIFICATION TYPES ==========

export type NotificationType = 
  | 'pitch_view' 
  | 'pitch_like' 
  | 'pitch_comment' 
  | 'nda_request' 
  | 'nda_approved' 
  | 'nda_rejected'
  | 'follow'
  | 'message'
  | 'investment'
  | 'system';

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: number;
  relatedType?: string;
  isRead: boolean;
  createdAt: string;
  
  // Relations
  user?: User;
}

// ========== API RESPONSE TYPES ==========

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  metadata?: {
    timestamp: string;
    [key: string]: any;
  };
  cached?: boolean;
  [key: string]: any;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  offset: number;
}

// ========== DASHBOARD TYPES ==========

export interface DashboardStats {
  totalPitches?: number;
  publishedPitches?: number;
  draftPitches?: number;
  totalViews?: number;
  totalLikes?: number;
  totalNDAs?: number;
  totalFollowers?: number;
  avgViewsPerPitch?: number;
  avgEngagementRate?: number;
  monthlyGrowth?: number;
  
  // Investor specific
  totalInvestments?: number;
  activeDeals?: number;
  totalInvested?: number;
  averageReturn?: number;
  pendingOpportunities?: number;
  
  // Production specific
  totalProductions?: number;
  activeProductions?: number;
  completedProductions?: number;
  totalBudget?: number;
}

// ========== FILTER TYPES ==========

export interface FilterState {
  genres: string[];
  formats: string[];
  developmentStages: string[];
  searchQuery: string;
  creatorTypes: string[];
  hasNDA?: boolean;
  seekingInvestment?: boolean;
  budgetMin?: number;
  budgetMax?: number;
}

// ========== PAYMENT TYPES ==========

export interface CreditBalance {
  credits: number;
  bonusCredits: number;
  totalCredits: number;
}

export interface Subscription {
  id: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  plan: string;
  expiresAt: string;
  features: string[];
}

// ========== FIELD TRANSFORMATION UTILITIES ==========

/**
 * Transform snake_case fields from backend to camelCase for frontend
 */
export function transformUserFromBackend(backendUser: any): User {
  return {
    id: backendUser.id,
    email: backendUser.email,
    username: backendUser.username,
    userType: backendUser.user_type || backendUser.userType,
    companyName: backendUser.company_name || backendUser.companyName,
    profilePicture: backendUser.profile_picture || backendUser.profilePicture,
    bio: backendUser.bio,
    location: backendUser.location,
    website: backendUser.website,
    socialMedia: backendUser.social_media || backendUser.socialMedia,
    verified: backendUser.verified,
    createdAt: backendUser.created_at || backendUser.createdAt,
    updatedAt: backendUser.updated_at || backendUser.updatedAt
  };
}

/**
 * Transform camelCase fields from frontend to snake_case for backend
 */
export function transformUserForBackend(frontendUser: Partial<User>): any {
  return {
    id: frontendUser.id,
    email: frontendUser.email,
    username: frontendUser.username,
    user_type: frontendUser.userType,
    company_name: frontendUser.companyName,
    profile_picture: frontendUser.profilePicture,
    bio: frontendUser.bio,
    location: frontendUser.location,
    website: frontendUser.website,
    social_media: frontendUser.socialMedia,
    verified: frontendUser.verified,
    created_at: frontendUser.createdAt,
    updated_at: frontendUser.updatedAt
  };
}

// ========== ANALYTICS TYPES ==========

export interface PitchAnalytics {
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalMessages: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  engagement: {
    rate: number;
    trend: number;
    [key: string]: any;
  };
  demographics: any;
  viewerTypes: any;
  topReferrers: any[];
}

// ========== INVESTMENT TYPES ==========

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
  projectedROI?: number;
  minInvestment?: number;
  maxInvestment?: number;
  targetAmount?: number;
  raisedAmount?: number;
  investors?: number;
  deadline?: string;
  terms?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  matchScore?: number;
}

// ========== TEAM TYPES ==========

export interface Team {
  id: number;
  name: string;
  members: TeamMember[];
  [key: string]: any;
}

export interface TeamMember {
  id: number;
  userId: number;
  role: string;
  user?: User;
  [key: string]: any;
}