/**
 * Shared API Contracts between Frontend and Backend
 * Using Zod for runtime validation and TypeScript type inference
 */

import { z } from 'zod';

// ============= USER & AUTH SCHEMAS =============

export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
  userType: z.enum(['creator', 'investor', 'production']).optional()
});

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain uppercase, lowercase, and number'
  ),
  name: z.string().min(2).max(100),
  userType: z.enum(['creator', 'investor', 'production']),
  companyName: z.string().optional(),
  bio: z.string().max(500).optional()
});

export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  userType: z.enum(['creator', 'investor', 'production']),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  verified: z.boolean().default(false)
});

// ============= PITCH SCHEMAS =============

export const PitchSchema = z.object({
  id: z.number(),
  title: z.string().min(1).max(200),
  logline: z.string().max(500),
  synopsis: z.string().optional(),
  genre: z.enum([
    'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 
    'Thriller', 'Romance', 'Documentary', 'Animation'
  ]),
  format: z.enum(['Film', 'Series', 'Mini-Series', 'Documentary']).default('Film'),
  budget: z.number().positive().optional(),
  status: z.enum(['draft', 'active', 'funded', 'in_production', 'completed']).default('draft'),
  creatorId: z.number(),
  tags: z.array(z.string()).default([]),
  attachments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().url(),
    type: z.enum(['script', 'treatment', 'pitch_deck', 'video', 'other']),
    size: z.number()
  })).default([]),
  viewCount: z.number().default(0),
  likeCount: z.number().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const CreatePitchSchema = PitchSchema.omit({
  id: true,
  creatorId: true,
  viewCount: true,
  likeCount: true,
  createdAt: true,
  updatedAt: true
});

export const UpdatePitchSchema = CreatePitchSchema.partial();

// ============= NDA SCHEMAS =============

export const NDARequestSchema = z.object({
  pitchId: z.number(),
  requesterId: z.number().optional(), // Set by backend
  ndaType: z.enum(['basic', 'enhanced', 'custom']).default('basic'),
  requestMessage: z.string().max(1000).optional(),
  companyInfo: z.object({
    name: z.string(),
    address: z.string(),
    registrationNumber: z.string().optional()
  }).optional(),
  customTerms: z.string().optional()
});

export const NDASchema = z.object({
  id: z.number(),
  pitchId: z.number(),
  requesterId: z.number(),
  creatorId: z.number(),
  status: z.enum(['pending', 'approved', 'rejected', 'expired', 'revoked']),
  ndaType: z.enum(['basic', 'enhanced', 'custom']),
  signedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  documentUrl: z.string().url().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// ============= INVESTMENT SCHEMAS =============

export const InvestmentSchema = z.object({
  id: z.number(),
  pitchId: z.number(),
  investorId: z.number(),
  amount: z.number().positive(),
  currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
  type: z.enum(['equity', 'debt', 'revenue_share', 'other']),
  status: z.enum(['pending', 'committed', 'completed', 'cancelled']),
  terms: z.string().optional(),
  milestones: z.array(z.object({
    title: z.string(),
    amount: z.number(),
    dueDate: z.string().datetime(),
    completed: z.boolean()
  })).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// ============= API RESPONSE SCHEMAS =============

export const ApiSuccessSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  success: z.literal(true),
  data: dataSchema,
  meta: z.record(z.string(), z.any()).optional()
});

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  })
});

export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.union([
  ApiSuccessSchema(dataSchema),
  ApiErrorSchema
]);

// ============= PAGINATION SCHEMAS =============

export const PaginationRequestSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) => z.object({
  items: z.array(itemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
});

// ============= SEARCH & FILTER SCHEMAS =============

export const SearchFiltersSchema = z.object({
  query: z.string().optional(),
  genre: z.array(z.string()).optional(),
  format: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  tags: z.array(z.string()).optional()
}).merge(PaginationRequestSchema);

// ============= NOTIFICATION SCHEMAS =============

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.number(),
  type: z.enum([
    'nda_request', 'nda_approved', 'nda_rejected',
    'investment_received', 'pitch_viewed', 'pitch_liked',
    'new_message', 'milestone_due', 'system'
  ]),
  title: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.any()).optional(),
  read: z.boolean().default(false),
  createdAt: z.string().datetime()
});

// ============= ANALYTICS SCHEMAS =============

export const PitchAnalyticsSchema = z.object({
  pitchId: z.number(),
  views: z.number(),
  uniqueViews: z.number(),
  likes: z.number(),
  shares: z.number(),
  averageViewTime: z.number(), // in seconds
  conversionRate: z.number(), // percentage
  demographics: z.object({
    byUserType: z.record(z.string(), z.number()),
    byLocation: z.record(z.string(), z.number()),
    byDevice: z.record(z.string(), z.number())
  }),
  engagement: z.object({
    clickThroughRate: z.number(),
    downloadRate: z.number(),
    contactRate: z.number()
  }),
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  })
});

// ============= DASHBOARD SCHEMAS =============

export const CreatorDashboardSchema = z.object({
  totalPitches: z.number(),
  activePitches: z.number(),
  totalViews: z.number(),
  totalInvestments: z.number(),
  totalRevenue: z.number(),
  pendingNDAs: z.number(),
  recentActivity: z.array(z.object({
    type: z.string(),
    description: z.string(),
    timestamp: z.string().datetime()
  })),
  topPerformingPitches: z.array(PitchSchema.pick({
    id: true,
    title: true,
    viewCount: true,
    likeCount: true
  }))
});

export const InvestorDashboardSchema = z.object({
  totalInvestments: z.number(),
  activeInvestments: z.number(),
  portfolioValue: z.number(),
  roi: z.number(),
  watchlistCount: z.number(),
  signedNDAs: z.number(),
  opportunities: z.array(PitchSchema),
  recentTransactions: z.array(InvestmentSchema)
});

// ============= TYPE EXPORTS =============

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type User = z.infer<typeof UserSchema>;
export type Pitch = z.infer<typeof PitchSchema>;
export type CreatePitch = z.infer<typeof CreatePitchSchema>;
export type UpdatePitch = z.infer<typeof UpdatePitchSchema>;
export type NDARequest = z.infer<typeof NDARequestSchema>;
export type NDA = z.infer<typeof NDASchema>;
export type Investment = z.infer<typeof InvestmentSchema>;
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type PitchAnalytics = z.infer<typeof PitchAnalyticsSchema>;
export type CreatorDashboard = z.infer<typeof CreatorDashboardSchema>;
export type InvestorDashboard = z.infer<typeof InvestorDashboardSchema>;

// ============= VALIDATION HELPERS =============

export const validateRequest = <T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } => {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
};

export const validatePartial = <T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: Partial<T> } | { success: false; errors: z.ZodError } => {
  try {
    const partialSchema = (schema as any).partial();
    const validated = partialSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
};