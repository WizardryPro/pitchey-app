/**
 * Public data filtering utility for removing sensitive information
 * Ensures guest users only see appropriate public data
 */

import { getCorsHeaders } from './response';

export interface PublicPitch {
  id: string;
  title: string;
  tagline: string;
  genre: string;
  subgenre?: string;
  format: string;
  format_category?: string;
  format_subtype?: string;
  setting?: string;
  time_period?: string;
  logline: string;
  synopsis?: string;
  short_synopsis?: string;
  long_synopsis?: string;
  target_audience?: string;
  comparable_works?: string[];
  view_count: number;
  like_count: number;
  nda_count?: number;
  comment_count?: number;
  share_count?: number;
  rating?: number;
  require_nda?: boolean;
  seeking_investment?: boolean;
  // Image URLs
  title_image?: string;
  thumbnail_url?: string;
  poster_url?: string;
  video_url?: string;
  // Budget info
  estimated_budget?: string;
  budget_bracket?: string;
  budget_range?: string;
  // Content metadata
  themes?: string;
  world_description?: string;
  tags?: string[];
  characters?: string;
  tone_and_style?: string;
  comps?: string;
  // Production info
  production_stage?: string;
  development_stage?: string;
  production_location?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  // Creator info (public only)
  creator_username?: string;
  creator_avatar?: string;
  creator_company?: string;
  creator_type?: string;
  // Derived fields for public display
  engagement_score?: number;
  similarity_score?: number;
  trending_rank?: number;
}

export interface PublicUser {
  id: string;
  username?: string;
  profile_image?: string;
  company_name?: string;
  bio?: string;
  location?: string;
  website?: string;
  created_at: string;
}

/**
 * Fields that should NEVER be exposed in public endpoints
 */
const SENSITIVE_FIELDS = [
  // Personal information
  'email',
  'phone',
  'address',
  'social_security',
  'tax_id',
  
  // Financial information
  'funding_goal',
  'budget_breakdown',
  'revenue_projections',
  'investment_terms',
  'equity_percentage',
  'minimum_investment',
  'current_funding',
  'investor_details',
  
  // Private content
  'private_description',
  'private_notes',
  'internal_notes',
  'creator_notes',
  'pitch_deck_url', // Private document
  'video_pitch_url', // Private video
  'additional_media', // May contain sensitive documents
  
  // Creator contact and business info
  'creator_email',
  'creator_phone',
  'creator_address',
  'creator_id', // Keep as numeric reference only
  
  // Internal system fields
  'password',
  'password_hash',
  'session_token',
  'api_key',
  'webhook_secret',
  'stripe_customer_id',
  'payment_method_id',
  
  // Detailed analytics that could be competitive info
  'detailed_view_data',
  'investor_list',
  'declined_investors',
  'negotiation_history',
  'rejection_reasons',
  
  // Status fields that reveal business process
  'review_status',
  'reviewer_notes',
  'approval_date',
  'rejection_date',
  'last_investor_contact'
];

/**
 * Filter a pitch object to remove sensitive information
 */
export function filterPitchForPublic(pitch: any): PublicPitch | null {
  if (!pitch) return null;
  
  // Only show published, public pitches
  if (pitch.status !== 'published' || 
      (pitch.visibility !== 'public' && pitch.visibility !== 'investors_only')) {
    return null;
  }

  // Create filtered pitch object with only allowed fields
  const filtered: PublicPitch = {
    id: pitch.id,
    title: pitch.title || 'Untitled Project',
    tagline: pitch.tagline || '',
    genre: pitch.genre || 'Unspecified',
    subgenre: pitch.subgenre,
    format: pitch.format || 'Unspecified',
    format_category: pitch.format_category,
    format_subtype: pitch.format_subtype,
    setting: pitch.setting,
    time_period: pitch.time_period,
    logline: pitch.logline || '',
    synopsis: truncateSynopsis(pitch.synopsis),
    short_synopsis: pitch.short_synopsis,
    long_synopsis: truncateSynopsis(pitch.long_synopsis),
    target_audience: pitch.target_audience,
    comparable_works: Array.isArray(pitch.comparable_works) ?
                     pitch.comparable_works.slice(0, 3) : [],
    view_count: Math.max(0, pitch.view_count || 0),
    like_count: Math.max(0, pitch.like_count || 0),
    nda_count: pitch.nda_count || 0,
    comment_count: pitch.comment_count || 0,
    share_count: pitch.share_count || 0,
    // Source the REAL computed rating (rating_average, maintained by the feedback
    // system) — not the legacy `rating` column, which is always 0. Every public
    // card reads this; sourcing the dead column made every star render "—" even
    // though pitches have ratings.
    rating: Number(pitch.rating_average ?? pitch.rating ?? 0) || undefined,
    require_nda: pitch.require_nda,
    seeking_investment: pitch.seeking_investment,

    // Image URLs
    title_image: pitch.title_image,
    thumbnail_url: pitch.thumbnail_url,
    poster_url: pitch.poster_url,
    video_url: pitch.video_url,

    // Budget info
    estimated_budget: pitch.estimated_budget,
    budget_bracket: pitch.budget_bracket,
    budget_range: pitch.budget_range,

    // Content metadata
    themes: pitch.themes,
    world_description: pitch.world_description,
    tags: Array.isArray(pitch.tags) ? pitch.tags : undefined,
    characters: pitch.characters,
    tone_and_style: pitch.tone_and_style,
    comps: pitch.comps,

    // Production info
    production_stage: pitch.production_stage,
    development_stage: pitch.development_stage,
    production_location: pitch.production_location,

    created_at: pitch.created_at ? String(pitch.created_at) : new Date().toISOString(),
    updated_at: pitch.updated_at ? String(pitch.updated_at) : new Date().toISOString(),
    published_at: pitch.published_at ? String(pitch.published_at) : undefined,

    // Safe creator information (if available)
    creator_username: pitch.creator_username,
    creator_avatar: pitch.creator_avatar,
    creator_company: pitch.creator_company,
    creator_type: pitch.creator_type,

    // Derived fields that might be added by queries
    engagement_score: pitch.engagement_score,
    similarity_score: pitch.similarity_score,
    trending_rank: pitch.trending_rank
  };

  return filtered;
}

/**
 * Filter an array of pitches for public consumption
 */
export function filterPitchesForPublic(pitches: any[]): PublicPitch[] {
  if (!Array.isArray(pitches)) return [];
  
  return pitches
    .map(filterPitchForPublic)
    .filter((pitch): pitch is PublicPitch => pitch !== null);
}

/**
 * Filter user information for public display
 */
export function filterUserForPublic(user: any): PublicUser | null {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    profile_image: user.profile_image,
    company_name: user.company_name,
    bio: user.bio ? truncateText(user.bio, 200) : undefined,
    location: user.location,
    website: isValidUrl(user.website) ? user.website : undefined,
    created_at: user.created_at ? String(user.created_at) : new Date().toISOString()
  };
}

/**
 * Truncate synopsis to prevent information leakage
 */
function truncateSynopsis(synopsis?: string): string | undefined {
  if (!synopsis) return undefined;
  
  // Public browse/search CARDS intentionally show a longer teaser (500) than the
  // pitch-DETAIL view for watchers/anon (300, in getPitch). Two different surfaces,
  // not drift — product decision 2026-06-17. Don't "unify" without an owner call.
  const maxLength = 500;
  if (synopsis.length <= maxLength) return synopsis;
  
  // Truncate at word boundary
  const truncated = synopsis.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Validate URL format
 */
function isValidUrl(url?: string): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove sensitive fields from any object
 */
export function removeSensitiveFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(removeSensitiveFields);
  }
  
  const cleaned = { ...obj };
  
  SENSITIVE_FIELDS.forEach(field => {
    delete cleaned[field];
  });
  
  // Recursively clean nested objects
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] && typeof cleaned[key] === 'object') {
      cleaned[key] = removeSensitiveFields(cleaned[key]);
    }
  });
  
  return cleaned;
}

/**
 * Create a public-safe error response
 */
export function createPublicErrorResponse(message: string, status: number = 500, origin?: string | null): Response {
  // Never expose internal error details to public
  const publicMessage = status === 404 ? message || 'Content not found' :
                       status === 429 ? message || 'Too many requests' :
                       status === 400 ? message || 'Invalid request' :
                       status === 503 ? message || 'Service temporarily unavailable' :
                       message || 'Service error';

  return new Response(
    JSON.stringify({
      success: false,
      error: publicMessage,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: {
        ...getCorsHeaders(origin),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    }
  );
}

/**
 * Add cache headers for public endpoints
 */
export function addPublicCacheHeaders(headers: HeadersInit = {}): HeadersInit {
  return {
    ...headers,
    'Cache-Control': 'public, max-age=300, s-maxage=600', // 5min browser, 10min CDN
    'Vary': 'Accept-Encoding',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
}

/**
 * Create standardized public response
 */
export function createPublicResponse(
  data: any,
  options: {
    status?: number;
    cache?: boolean;
    etag?: string;
    origin?: string | null;
  } = {}
): Response {
  const { status = 200, cache = true, etag, origin } = options;

  const headers: Record<string, string> = {
    ...getCorsHeaders(origin),
    'Content-Type': 'application/json'
  };

  if (cache) {
    Object.assign(headers, addPublicCacheHeaders());
  }

  if (etag) {
    headers['ETag'] = etag;
  }

  return new Response(JSON.stringify({
    success: true,
    data: removeSensitiveFields(data),
    timestamp: new Date().toISOString()
  }), {
    status,
    headers
  });
}

/**
 * Generate ETag for response caching
 */
export function generateETag(data: any): string {
  // Simple hash of stringified data for ETag
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `"${Math.abs(hash).toString(36)}"`;
}