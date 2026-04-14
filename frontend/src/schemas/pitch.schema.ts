/**
 * Valibot validation schemas for pitch-related forms
 * Provides type-safe validation with automatic TypeScript inference
 */

import * as v from 'valibot';

// ============================================
// Base Schemas
// ============================================

export const PitchTitleSchema = v.pipe(
  v.string(),
  v.nonEmpty('Title is required'),
  v.minLength(3, 'Title must be at least 3 characters'),
  v.maxLength(100, 'Title must be less than 100 characters')
);

export const GenreSchema = v.pipe(
  v.string(),
  v.nonEmpty('Genre is required')
);

export const LoglineSchema = v.pipe(
  v.string(),
  v.nonEmpty('Logline is required'),
  v.minLength(10, 'Logline must be at least 10 characters'),
  v.maxLength(500, 'Logline must be less than 500 characters')
);

export const ShortSynopsisSchema = v.pipe(
  v.string(),
  v.nonEmpty('Synopsis is required'),
  v.minLength(50, 'Synopsis must be at least 50 characters'),
  v.maxLength(1000, 'Synopsis must be less than 1000 characters')
);

export const ThemesSchema = v.pipe(
  v.string(),
  v.maxLength(1000, 'Themes must be less than 1000 characters')
);

export const WorldDescriptionSchema = v.pipe(
  v.string(),
  v.maxLength(1000, 'World description must be less than 1000 characters')
);

export const BudgetRangeSchema = v.optional(
  v.picklist(
    ['0-100k', '100k-500k', '500k-1m', '1m-5m', '5m-20m', '20m-50m', '50m+'],
    'Please select a valid budget range'
  )
);

// ============================================
// Character Schema
// ============================================

export const CharacterSchema = v.object({
  id: v.optional(v.string()),
  name: v.pipe(
    v.string(),
    v.nonEmpty('Character name is required'),
    v.maxLength(50, 'Character name must be less than 50 characters')
  ),
  role: v.optional(v.pipe(
    v.string(),
    v.maxLength(100, 'Character role must be less than 100 characters')
  )),
  description: v.pipe(
    v.string(),
    v.maxLength(200, 'Character description must be less than 200 characters')
  ),
  order: v.optional(v.number())
});

// ============================================
// File Schemas
// ============================================

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB

export const ImageFileSchema = v.custom<File>(
  (value) => {
    if (!(value instanceof File)) return false;
    if (value.size > MAX_IMAGE_SIZE) return false;
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(value.type);
  },
  'Invalid image file. Must be JPG, PNG, GIF, or WebP under 10MB'
);

export const VideoFileSchema = v.custom<File>(
  (value) => {
    if (!(value instanceof File)) return false;
    if (value.size > MAX_VIDEO_SIZE) return false;
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    return validTypes.includes(value.type);
  },
  'Invalid video file. Must be MP4, MOV, or AVI under 100MB'
);

export const PDFFileSchema = v.custom<File>(
  (value) => {
    if (!(value instanceof File)) return false;
    if (value.size > MAX_PDF_SIZE) return false;
    return value.type === 'application/pdf';
  },
  'Invalid PDF file. Must be under 20MB'
);

export const DocumentFileSchema = v.object({
  id: v.optional(v.string()),
  name: v.string(),
  type: v.picklist(['script', 'treatment', 'pitch_deck', 'other']),
  file: v.optional(v.union([PDFFileSchema, v.string()])), // File or URL
  uploadedAt: v.optional(v.string())
});

// ============================================
// NDA Configuration Schema
// ============================================

export const NDAConfigSchema = v.object({
  requireNDA: v.boolean(),
  ndaType: v.picklist(['none', 'platform', 'custom']),
  customNDA: v.optional(
    v.union([
      PDFFileSchema,
      v.null()
    ])
  )
});

// ============================================
// Format Schemas
// ============================================

export const FormatCategorySchema = v.picklist([
  'Television - Scripted',
  'Television - Unscripted',
  'Film',
  'Animation (Series)',
  'Audio',
  'Digital / Emerging',
  'Stage-to-Screen',
  'AI',
  'Other'
]);

export const FormatSubtypeSchema = v.string();

// ============================================
// Main Pitch Form Schema
// ============================================

// Enhanced Field Schemas
export const ToneAndStyleSchema = v.optional(v.pipe(
  v.string(),
  v.maxLength(2400, 'Tone & Style must be less than 400 words')
));

export const CompsSchema = v.optional(v.pipe(
  v.string(),
  v.maxLength(2400, 'Comps must be less than 400 words')
));

export const StoryBreakdownSchema = v.optional(v.pipe(
  v.string(),
  v.maxLength(12000, 'Story breakdown must be less than 2000 words')
));

export const WhyNowSchema = v.optional(v.pipe(
  v.string(),
  v.maxLength(1800, 'Why Now must be less than 300 words')
));

export const ProductionLocationSchema = v.optional(v.pipe(
  v.string(),
  v.maxLength(600, 'Production location must be less than 100 words')
));

export const DevelopmentStageSchema = v.optional(v.picklist([
  'pitch',
  'treatment',
  'script',
  'semi_packaged',
  'fully_packaged',
  'semi_funded',
  'fully_funded',
  'other'
]));

export const CreativeAttachmentSchema = v.object({
  id: v.string(),
  name: v.string(),
  role: v.string(),
  bio: v.pipe(v.string(), v.maxLength(2400, 'Bio must be less than 400 words')),
  imdbLink: v.optional(v.string()),
  websiteLink: v.optional(v.string())
});

export const PitchFormSchema = v.object({
  // Basic Information
  title: PitchTitleSchema,
  genre: GenreSchema,
  format: v.optional(v.string()),
  formatCategory: FormatCategorySchema,
  formatSubtype: v.optional(FormatSubtypeSchema),
  customFormat: v.optional(v.string()),
  logline: LoglineSchema,
  shortSynopsis: ShortSynopsisSchema,
  
  // Themes & World
  themes: v.optional(ThemesSchema),
  worldDescription: v.optional(WorldDescriptionSchema),
  
  // Enhanced Story & Style Fields
  toneAndStyle: ToneAndStyleSchema,
  comps: CompsSchema,
  storyBreakdown: StoryBreakdownSchema,
  
  // Market & Production Fields
  whyNow: WhyNowSchema,
  productionLocation: ProductionLocationSchema,
  developmentStage: DevelopmentStageSchema,
  developmentStageOther: v.optional(v.string()),
  
  // Creative Team
  creativeAttachments: v.optional(v.array(CreativeAttachmentSchema)),
  
  // Characters
  characters: v.optional(v.array(CharacterSchema)),
  
  // Media
  image: v.optional(v.union([ImageFileSchema, v.null()])),
  video: v.optional(v.union([VideoFileSchema, v.null()])),
  documents: v.optional(v.array(DocumentFileSchema)),
  
  // Video with Password
  videoUrl: v.optional(v.string()),
  videoPassword: v.optional(v.string()),
  videoPlatform: v.optional(v.string()),
  
  // NDA
  ndaConfig: NDAConfigSchema,
  
  // Investment
  seekingInvestment: v.boolean(),
  budgetRange: BudgetRangeSchema,

  // AI declaration
  aiUsed: v.optional(v.boolean())
});

// ============================================
// Type Exports
// ============================================

export type PitchFormData = v.InferOutput<typeof PitchFormSchema>;
export type Character = v.InferOutput<typeof CharacterSchema>;
export type DocumentFile = v.InferOutput<typeof DocumentFileSchema>;
export type NDAConfig = v.InferOutput<typeof NDAConfigSchema>;

// ============================================
// Validation Helpers
// ============================================

/**
 * Validates pitch form data and returns structured errors
 */
export const validatePitchForm = (data: unknown): {
  success: boolean;
  data?: PitchFormData;
  errors?: Record<string, string[]>;
} => {
  try {
    const validatedData = v.parse(PitchFormSchema, data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (v.isValiError(error)) {
      const errors: Record<string, string[]> = {};
      
      for (const issue of error.issues) {
        const path = issue.path?.[0]?.key as string || 'general';
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      }
      
      return { success: false, errors };
    }
    
    return { 
      success: false, 
      errors: { general: ['An unexpected error occurred'] } 
    };
  }
};

/**
 * Validates a single field
 */
export const validateField = (
  fieldName: keyof PitchFormData,
  value: unknown
): string[] => {
  const fieldSchemas: Record<string, v.BaseSchema<any, any, any>> = {
    title: PitchTitleSchema,
    genre: GenreSchema,
    logline: LoglineSchema,
    shortSynopsis: ShortSynopsisSchema,
    themes: ThemesSchema,
    worldDescription: WorldDescriptionSchema,
    budgetRange: BudgetRangeSchema,
    formatCategory: FormatCategorySchema,
    formatSubtype: FormatSubtypeSchema,
  };
  
  const schema = fieldSchemas[fieldName];
  if (!schema) return [];
  
  try {
    v.parse(schema, value);
    return [];
  } catch (error) {
    if (v.isValiError(error)) {
      return error.issues.map(issue => issue.message);
    }
    return ['Validation failed'];
  }
};

/**
 * Gets character count info for a field
 */
export const getCharacterCountInfo = (
  fieldName: keyof PitchFormData,
  currentLength: number
): { current: number; max: number; isValid: boolean } => {
  const limits: Record<string, number> = {
    title: 100,
    logline: 500,
    shortSynopsis: 1000,
    themes: 1000,
    worldDescription: 1000,
  };
  
  const max = limits[fieldName] || 0;
  return {
    current: currentLength,
    max,
    isValid: currentLength <= max
  };
};