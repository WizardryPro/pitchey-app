/**
 * Standardized Response Utilities
 * Ensures consistent API response format across all endpoints
 */

export interface StandardResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: {
    timestamp: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    details?: any;
  };
}

export interface ErrorDetails {
  code?: string;
  field?: string;
  details?: any;
}

// CORS configuration — centralized.
//
// Canonical production hostname is `pitchey-5o8.pages.dev`. Cloudflare auto-
// suffixes the global subdomain because `pitchey.pages.dev` is claimed by the
// separate `pitchey-coming-soon` marketing project on a different account.
// Per CLAUDE.md "URL Consolidation — corrected model" (2026-04-21): the old
// `pitchey` Pages project on Cavelltheleaddev's account was deleted and
// `pitchey.pages.dev` now NXDOMAINs — do not reintroduce it as an origin.
const ALLOWED_ORIGINS = [
  'https://pitchey-5o8.pages.dev',     // Primary production (Ndlovucavelle's `pitchey` Pages project)
  'https://pitchey.com',               // Marketing stub (pitchey-coming-soon, separate account)
  'http://localhost:5173',             // Local development (Vite)
  'http://127.0.0.1:5173',             // Local development (Vite via IP)
  'http://localhost:3000',             // Local development (alternative)
  'http://127.0.0.1:3000',             // Local development (alternative via IP)
];

// Function to check if origin is allowed (includes Cloudflare Pages preview subdomains).
//
// Scoped to what the single live `pitchey` Pages project can actually serve.
// Preview deployments under that project get hostnames like
// `<hash>.pitchey-5o8.pages.dev` (hash-prefixed) and `<branch>.pitchey-5o8.pages.dev`
// (per-branch aliases) — the project stem is `pitchey-5o8`, not `pitchey`,
// because of the CF auto-suffix explained above.
//
// Removed (2026-04-20, issue #27): the previous `pitchey-[a-zA-Z0-9-]+\.pages\.dev` regex
// accepted any subdomain matching that shape regardless of whether a project with that name
// existed on the account. If CF Pages project names are globally claimable rather than
// account-scoped, an attacker could register `pitchey-main`, `pitchey-staging`, etc. and
// make authenticated cross-origin calls. The 2026-04-20 account enumeration confirmed
// none of those projects exist under our account, so allowing them was pure attack surface.
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  // Remove trailing period if present (some browsers add it)
  const cleanOrigin = origin.endsWith('.') ? origin.slice(0, -1) : origin;

  // Check exact matches first
  if (ALLOWED_ORIGINS.includes(cleanOrigin)) {
    return true;
  }

  // Per-branch Cloudflare Pages previews under the live `pitchey` project
  // (public stem `pitchey-5o8.pages.dev`): hash-prefixed (e.g.
  // 52e5fc15.pitchey-5o8.pages.dev) and branch/PR-prefixed (e.g.
  // pr-42.pitchey-5o8.pages.dev).
  if (cleanOrigin.match(/^https:\/\/[a-f0-9]+\.pitchey-5o8\.pages\.dev$/) ||       // Hash-based preview
      cleanOrigin.match(/^https:\/\/[a-zA-Z0-9-]+\.pitchey-5o8\.pages\.dev$/)) {   // Named per-branch preview
    return true;
  }

  return false;
}

/**
 * Set the current request origin for CORS handling
 * @deprecated No-op. Pass origin directly to getCorsHeaders() instead.
 */
export function setRequestOrigin(_origin: string | null) {
  // No-op: removed global state to fix race condition between concurrent requests
}

/**
 * Get CORS headers for a specific origin
 */
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  // Use provided origin or default to primary allowed origin
  let requestOrigin = origin || null;
  
  // Remove trailing period if present (some browsers add it)
  if (requestOrigin && requestOrigin.endsWith('.')) {
    requestOrigin = requestOrigin.slice(0, -1);
  }
  
  const isAllowedOrigin = isOriginAllowed(requestOrigin);
  
  // If origin is allowed, echo it back; otherwise fall back to the canonical
  // production hostname so cross-origin requests from unrecognized origins
  // still receive a valid ACAO (browser will enforce the mismatch).
  const allowOrigin = isAllowedOrigin && requestOrigin
    ? requestOrigin
    : ALLOWED_ORIGINS[0]; // canonical: pitchey-5o8.pages.dev
  
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id, X-Client-Id, sentry-trace, baggage, traceparent",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Get security headers for all responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:;"
  };
}

/**
 * Get cache headers based on content type
 */
export function getCacheHeaders(contentType: string = "application/json"): Record<string, string> {
  // Static assets should be cached for a long time
  if (contentType.includes("image") || contentType.includes("font")) {
    return {
      "Cache-Control": "public, max-age=31536000, immutable"
    };
  }
  
  // API responses get shorter cache
  if (contentType.includes("json")) {
    return {
      "Cache-Control": "public, max-age=300, must-revalidate"
    };
  }
  
  // Default no cache
  return {
    "Cache-Control": "no-cache, no-store, must-revalidate"
  };
}

// Legacy CORS headers for backward compatibility
export const corsHeaders = getCorsHeaders();

/**
 * Success response wrapper
 */
export function successResponse<T>(
  data: T,
  message?: string,
  metadata?: Partial<NonNullable<StandardResponse["metadata"]>>,
  origin?: string
): Response {
  const response: StandardResponse<T> = {
    success: true,
    data,
    message,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 
      ...getCorsHeaders(origin), 
      ...getSecurityHeaders(),
      ...getCacheHeaders("application/json"),
      "content-type": "application/json" 
    },
  });
}

/**
 * Created response wrapper - for resource creation operations (HTTP 201)
 */
export function createdResponse<T>(
  data: T,
  message?: string,
  metadata?: Partial<NonNullable<StandardResponse["metadata"]>>,
  origin?: string
): Response {
  const response: StandardResponse<T> = {
    success: true,
    data,
    message,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 201,
    headers: { 
      ...getCorsHeaders(origin), 
      ...getSecurityHeaders(),
      ...getCacheHeaders("application/json"),
      "content-type": "application/json" 
    },
  });
}

/**
 * Error response wrapper
 */
export function errorResponse(
  error: string,
  status = 400,
  details?: ErrorDetails,
  origin?: string
): Response {
  const response: StandardResponse = {
    success: false,
    error,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };

  if (details) {
    response.metadata!.details = details;
  }

  return new Response(JSON.stringify(response), {
    status,
    headers: { 
      ...getCorsHeaders(origin), 
      ...getSecurityHeaders(),
      ...getCacheHeaders("application/json"),
      "content-type": "application/json" 
    },
  });
}

/**
 * Bad request error response - for malformed requests and client syntax errors
 */
export function badRequestResponse(message = "Bad Request", origin?: string): Response {
  return errorResponse(message, 400, {
    code: "BAD_REQUEST",
  }, origin);
}

/**
 * Validation error response - for valid JSON but invalid data
 */
export function validationErrorResponse(
  fieldOrMessage: string,
  message?: string,
  origin?: string
): Response {
  // If only one parameter is provided, treat it as a general validation message
  if (message === undefined) {
    return errorResponse(fieldOrMessage, 422, {
      code: "VALIDATION_ERROR",
    }, origin);
  }
  
  // If two parameters provided, treat first as field and second as message
  return errorResponse("Validation failed", 422, {
    code: "VALIDATION_ERROR",
    field: fieldOrMessage,
    details: message,
  }, origin);
}

/**
 * Authentication error response
 */
export function authErrorResponse(message = "Authentication required", origin?: string): Response {
  return errorResponse(message, 401, {
    code: "AUTH_REQUIRED",
  }, origin);
}

/**
 * Authorization error response
 */
export function forbiddenResponse(message = "Access denied", origin?: string): Response {
  return errorResponse(message, 403, {
    code: "ACCESS_DENIED",
  }, origin);
}

/**
 * Not found error response
 */
export function notFoundResponse(resource = "Resource", origin?: string): Response {
  return errorResponse(`${resource} not found`, 404, {
    code: "NOT_FOUND",
  }, origin);
}

/**
 * Rate limit error response
 */
export function rateLimitResponse(
  retryAfter: number = 60,
  limit: number = 100,
  origin?: string
): Response {
  const response = errorResponse("Rate limit exceeded", 429, {
    code: "RATE_LIMIT_EXCEEDED",
    details: {
      retryAfter,
      limit,
    },
  }, origin);

  // Add rate limit headers
  response.headers.set("X-RateLimit-Limit", limit.toString());
  response.headers.set("X-RateLimit-Remaining", "0");
  response.headers.set("X-RateLimit-Reset", new Date(Date.now() + retryAfter * 1000).toISOString());
  response.headers.set("Retry-After", retryAfter.toString());

  return response;
}

/**
 * Server error response
 */
export function serverErrorResponse(
  message = "Internal server error",
  requestId?: string,
  origin?: string
): Response {
  console.error("Server Error:", message, requestId ? `[${requestId}]` : '');
  
  return errorResponse(message, 500, {
    code: "INTERNAL_ERROR",
    details: requestId ? { requestId } : undefined,
  }, origin);
}

/**
 * Paginated response wrapper
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  message?: string,
  origin?: string
): Response {
  const { page, limit, total } = pagination;
  const hasNext = page * limit < total;
  const hasPrev = page > 1;

  return successResponse(data, message, {
    pagination: {
      page,
      limit,
      total,
      hasNext,
      hasPrev,
    },
  }, origin);
}

/**
 * Handle CORS preflight requests
 */
export function corsPreflightResponse(origin?: string): Response {
  return new Response(null, { 
    status: 204,
    headers: {
      ...getCorsHeaders(origin),
      ...getSecurityHeaders()
    }
  });
}

/**
 * Create authentication error response (convenience wrapper)
 * Use this for quick auth error responses without parameters
 */
export function createAuthErrorResponse(message = "Authentication required", origin?: string): Response {
  return authErrorResponse(message, origin);
}

/**
 * Create error response from Error object (convenience wrapper)
 * Handles Error objects and extracts message for response
 */
export function createErrorResponse(error: Error | unknown, request?: Request, status = 500): Response {
  const origin = request?.headers.get('Origin');
  const message = error instanceof Error ? error.message : "Internal server error";
  return serverErrorResponse(message, undefined, origin ?? undefined);
}

/**
 * Standardized JSON response helper (legacy compatibility)
 */
export function jsonResponse(data: any, status = 200, origin?: string): Response {
  // If data is already in standard format, use it directly
  if (data && typeof data === 'object' && 'success' in data) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 
        ...getCorsHeaders(origin), 
        ...getSecurityHeaders(),
        ...getCacheHeaders("application/json"),
        "content-type": "application/json" 
      },
    });
  }

  // Wrap legacy responses in standard format
  return successResponse(data, undefined, undefined, origin);
}