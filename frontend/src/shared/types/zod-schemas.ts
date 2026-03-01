/**
 * Zod Schemas for Runtime Validation
 * 
 * These schemas provide runtime type validation for API responses and user inputs.
 * They complement the TypeScript types in api.ts by enabling validation at runtime.
 */

import { z } from 'zod';

// Base schemas for common types
export const UserTypeSchema = z.enum(['creator', 'investor', 'production', 'admin', 'viewer']);
export const GenreSchema = z.enum(['drama', 'comedy', 'thriller', 'horror', 'scifi', 'fantasy', 'documentary', 'animation', 'action', 'romance', 'other']);
export const FormatSchema = z.enum(['feature', 'tv', 'short', 'webseries', 'other']);
export const PitchStatusSchema = z.enum(['draft', 'published', 'under_review', 'archived']);
export const NDAStatusSchema = z.enum(['pending', 'approved', 'rejected', 'signed', 'expired', 'revoked']);
export const InvestmentStatusSchema = z.enum(['pending', 'active', 'completed', 'cancelled']);
export const InfoRequestStatusSchema = z.enum(['pending', 'responded', 'closed']);
export const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const RiskLevelSchema = z.enum(['low', 'medium', 'high']);

// Character schema
export const CharacterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Character name is required'),
  description: z.string(),
  age: z.string().optional(),
  gender: z.string().optional(),
  actor: z.string().optional(),
  displayOrder: z.number().optional(),
});

// Media schemas
export const AdditionalMediaSchema = z.object({
  type: z.enum(['lookbook', 'script', 'trailer', 'pitch_deck', 'budget_breakdown', 'production_timeline', 'other']),
  url: z.string().url('Invalid URL'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  uploadedAt: z.string(),
});

export const EpisodeBreakdownSchema = z.object({
  episodeNumber: z.number().min(1, 'Episode number must be at least 1'),
  title: z.string().min(1, 'Episode title is required'),
  synopsis: z.string().min(1, 'Episode synopsis is required'),
});

export const VisibilitySettingsSchema = z.object({
  showShortSynopsis: z.boolean(),
  showCharacters: z.boolean(),
  showBudget: z.boolean(),
  showMedia: z.boolean(),
});

// User schema
export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  userType: UserTypeSchema,
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
  profileImageUrl: z.string().url().optional(),
  companyName: z.string().optional(),
  companyNumber: z.string().optional(),
  companyWebsite: z.string().url().optional(),
  companyAddress: z.string().optional(),
  emailVerified: z.boolean(),
  companyVerified: z.boolean(),
  isActive: z.boolean(),
  subscriptionTier: z.string(),
  lastLoginAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Pitch schema
export const PitchSchema = z.object({
  id: z.number(),
  userId: z.number(),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  logline: z.string().min(10, 'Logline must be at least 10 characters').max(500, 'Logline too long'),
  genre: GenreSchema,
  format: FormatSchema,
  formatCategory: z.string().optional(),
  formatSubtype: z.string().optional(),
  customFormat: z.string().optional(),
  shortSynopsis: z.string().max(1000, 'Short synopsis too long').optional(),
  longSynopsis: z.string().optional(),
  opener: z.string().optional(),
  premise: z.string().optional(),
  targetAudience: z.string().optional(),
  characters: z.array(CharacterSchema).optional(),
  themes: z.string().optional(),
  worldDescription: z.string().optional(),
  episodeBreakdown: z.array(EpisodeBreakdownSchema).optional(),
  budgetBracket: z.string().optional(),
  estimatedBudget: z.string().optional(),
  titleImage: z.string().url().optional(),
  lookbookUrl: z.string().url().optional(),
  pitchDeckUrl: z.string().url().optional(),
  scriptUrl: z.string().url().optional(),
  trailerUrl: z.string().url().optional(),
  productionTimeline: z.string().optional(),
  additionalMedia: z.array(AdditionalMediaSchema).optional(),
  visibilitySettings: VisibilitySettingsSchema.optional(),
  status: PitchStatusSchema,
  publishedAt: z.string().optional(),
  viewCount: z.number().nonnegative(),
  likeCount: z.number().nonnegative(),
  ndaCount: z.number().nonnegative(),
  aiUsed: z.boolean().optional(),
  requireNDA: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  creator: z.object({
    id: z.number(),
    username: z.string(),
    name: z.string().optional(),
    profileImage: z.string().url().optional(),
  }).optional(),
  hasNDA: z.boolean().optional(),
  isLiked: z.boolean().optional(),
  canEdit: z.boolean().optional(),
});

// NDA schema
export const NDASchema = z.object({
  id: z.number(),
  pitchId: z.number(),
  userId: z.number(),
  signerId: z.number(),
  ndaType: z.string(),
  status: NDAStatusSchema,
  documentUrl: z.string().url().optional(),
  signedDocumentUrl: z.string().url().optional(),
  customNdaText: z.string().optional(),
  requestMessage: z.string().optional(),
  rejectionReason: z.string().optional(),
  signedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  revokedAt: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  requester: UserSchema.optional(),
  signer: UserSchema.optional(),
  pitch: PitchSchema.optional(),
});

// Investment schema
export const InvestmentSchema = z.object({
  id: z.number(),
  pitchId: z.number(),
  investorId: z.number(),
  amount: z.number().positive('Investment amount must be positive'),
  percentage: z.number().min(0).max(100),
  status: InvestmentStatusSchema,
  terms: z.string().optional(),
  contractUrl: z.string().url().optional(),
  investedAt: z.string(),
  updatedAt: z.string(),
  pitch: PitchSchema.optional(),
  investor: UserSchema.optional(),
  returns: z.number().optional(),
  currentValue: z.number().optional(),
});

// Dashboard stats schemas
export const InvestorDashboardStatsSchema = z.object({
  totalInvestments: z.number().nonnegative(),
  activeInvestments: z.number().nonnegative(),
  totalInvested: z.number().nonnegative(),
  portfolioValue: z.number().nonnegative(),
  avgROI: z.number(),
  pitchesViewed: z.number().nonnegative(),
  pitchesLiked: z.number().nonnegative(),
  ndaSigned: z.number().nonnegative(),
});

export const CreatorDashboardStatsSchema = z.object({
  totalPitches: z.number().nonnegative(),
  publishedPitches: z.number().nonnegative(),
  totalViews: z.number().nonnegative(),
  totalLikes: z.number().nonnegative(),
  pendingNDAs: z.number().nonnegative(),
  totalNDAs: z.number().nonnegative(),
  avgEngagement: z.number().nonnegative(),
  recentActivity: z.number().nonnegative(),
});

export const ProductionDashboardStatsSchema = z.object({
  activeProjects: z.number().nonnegative(),
  totalInvestments: z.number().nonnegative(),
  currentBudget: z.number().nonnegative(),
  projectedRevenue: z.number().nonnegative(),
  completedProjects: z.number().nonnegative(),
  upcomingDeadlines: z.number().nonnegative(),
  teamMembers: z.number().nonnegative(),
  recentActivity: z.number().nonnegative(),
});

// API Response schemas
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: z.union([
    z.object({
      message: z.string(),
      code: z.string().optional(),
      status: z.number().optional(),
      details: z.any().optional(),
    }),
    z.string(),
  ]).optional(),
  message: z.string().optional(),
  cached: z.boolean().optional(),
});

export const PitchesResponseSchema = z.object({
  pitches: z.array(PitchSchema),
  total: z.number().optional(),
  totalCount: z.number().optional(),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    totalPages: z.number(),
    currentPage: z.number(),
  }).optional(),
  filters: z.object({
    sortBy: z.string(),
    order: z.string(),
    genre: z.string().nullable(),
    format: z.string().nullable(),
  }).optional(),
});

// Form input validation schemas
export const CreatePitchInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  logline: z.string().min(10, 'Logline must be at least 10 characters').max(500, 'Logline too long'),
  genre: GenreSchema,
  format: FormatSchema,
  formatCategory: z.string().optional(),
  formatSubtype: z.string().optional(),
  customFormat: z.string().optional(),
  shortSynopsis: z.string().max(1000, 'Short synopsis too long').optional(),
  longSynopsis: z.string().optional(),
  characters: z.array(CharacterSchema).optional(),
  themes: z.string().optional(),
  worldDescription: z.string().optional(),
  budgetBracket: z.string().optional(),
  estimatedBudget: z.number().positive().optional(),
  productionTimeline: z.string().optional(),
  titleImage: z.string().url().optional(),
  lookbookUrl: z.string().url().optional(),
  pitchDeckUrl: z.string().url().optional(),
  scriptUrl: z.string().url().optional(),
  trailerUrl: z.string().url().optional(),
  additionalMedia: z.array(AdditionalMediaSchema).optional(),
  aiUsed: z.boolean().optional(),
  requireNDA: z.boolean().optional(),
});

export const UpdatePitchInputSchema = CreatePitchInputSchema.partial().extend({
  status: PitchStatusSchema.optional(),
  visibilitySettings: VisibilitySettingsSchema.optional(),
});

export const LoginCredentialsSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const RegisterDataSchema = LoginCredentialsSchema.extend({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username too long'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  userType: z.enum(['creator', 'investor', 'production']),
  companyName: z.string().optional(),
});

export const SearchFiltersSchema = z.object({
  genre: z.string().optional(),
  format: z.string().optional(),
  search: z.string().optional(),
  minBudget: z.number().nonnegative().optional(),
  maxBudget: z.number().nonnegative().optional(),
  status: z.string().optional(),
  sortBy: z.enum(['alphabetical', 'date', 'budget', 'views', 'likes']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().nonnegative().optional(),
}).refine((data) => {
  if (data.minBudget !== undefined && data.maxBudget !== undefined) {
    return data.minBudget <= data.maxBudget;
  }
  return true;
}, {
  message: "Min budget must be less than or equal to max budget",
  path: ["minBudget"],
});

// Info Request schemas
export const CreateInfoRequestInputSchema = z.object({
  ndaId: z.number(),
  pitchId: z.number(),
  requestType: z.enum(['financial', 'production', 'legal', 'marketing', 'casting', 'distribution', 'technical', 'general']),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  message: z.string().min(1, 'Message is required').max(5000, 'Message too long'),
  priority: PrioritySchema.optional(),
});

export const RespondToInfoRequestInputSchema = z.object({
  infoRequestId: z.number(),
  response: z.string().min(1, 'Response is required').max(5000, 'Response too long'),
});

// NDA Request schemas
export const CreateNDARequestSchema = z.object({
  pitchId: z.number(),
  ndaType: z.string().min(1, 'NDA type is required'),
  requestMessage: z.string().max(1000, 'Request message too long').optional(),
  companyInfo: z.any().optional(),
});

// Better Auth session schemas
export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  image: z.string().url().optional(),
  emailVerified: z.boolean(),
  role: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  expiresAt: z.date(),
  token: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  user: SessionUserSchema.optional(),
});

// Export type inference helpers
export type ZodUser = z.infer<typeof UserSchema>;
export type ZodPitch = z.infer<typeof PitchSchema>;
export type ZodNDA = z.infer<typeof NDASchema>;
export type ZodInvestment = z.infer<typeof InvestmentSchema>;
export type ZodCreatePitchInput = z.infer<typeof CreatePitchInputSchema>;
export type ZodUpdatePitchInput = z.infer<typeof UpdatePitchInputSchema>;
export type ZodLoginCredentials = z.infer<typeof LoginCredentialsSchema>;
export type ZodRegisterData = z.infer<typeof RegisterDataSchema>;
export type ZodSearchFilters = z.infer<typeof SearchFiltersSchema>;
export type ZodSession = z.infer<typeof SessionSchema>;
export type ZodSessionUser = z.infer<typeof SessionUserSchema>;

// Validation helper functions
export const validateApiResponse = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  return schema.parse(data);
};

export const safeValidateApiResponse = <T>(schema: z.ZodSchema<T>, data: unknown): 
  { success: true; data: T } | { success: false; error: z.ZodError } => {
  const result = schema.safeParse(data);
  return result.success 
    ? { success: true, data: result.data }
    : { success: false, error: result.error };
};

// Commonly used composite schemas
export const ValidatedPitchesResponse = ApiResponseSchema(PitchesResponseSchema);
export const ValidatedSinglePitchResponse = ApiResponseSchema(PitchSchema);
export const ValidatedUserResponse = ApiResponseSchema(UserSchema);
export const ValidatedInvestmentResponse = ApiResponseSchema(InvestmentSchema);
export const ValidatedNDAResponse = ApiResponseSchema(NDASchema);