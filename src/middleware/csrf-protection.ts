/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern for Better Auth
 * 
 * Security Features:
 * - Double-submit cookie validation
 * - SameSite cookie protection
 * - Origin/Referer validation
 * - Token rotation on sensitive operations
 */

import { getCorsHeaders } from "../config/security.config.ts";

// Configuration
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_FORM_FIELD = 'csrf_token';
const TOKEN_LENGTH = 32;
const TOKEN_MAX_AGE = 7200; // 2 hours

// Allowed origins for CSRF validation
const ALLOWED_ORIGINS = [
  'https://pitchey.pages.dev',
  'https://pitchey.pages.dev',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
];

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Set CSRF token in response cookie
 */
export function setCSRFCookie(response: Response, token: string): Response {
  const headers = new Headers(response.headers);
  
  // Set cookie with security flags
  const cookieOptions = [
    `${CSRF_COOKIE_NAME}=${token}`,
    `Max-Age=${TOKEN_MAX_AGE}`,
    'Path=/',
    'HttpOnly=false', // Must be readable by JavaScript
    'Secure=true',    // HTTPS only
    'SameSite=Strict' // Strict CSRF protection
  ];
  
  headers.append('Set-Cookie', cookieOptions.join('; '));
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Extract CSRF token from request
 */
function extractCSRFToken(request: Request): {
  cookieToken?: string;
  headerToken?: string;
  formToken?: string;
} {
  const result: {
    cookieToken?: string;
    headerToken?: string;
    formToken?: string;
  } = {};
  
  // Extract from cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const csrfCookie = cookies.find(c => c.startsWith(`${CSRF_COOKIE_NAME}=`));
    if (csrfCookie) {
      result.cookieToken = csrfCookie.split('=')[1];
    }
  }
  
  // Extract from header
  result.headerToken = request.headers.get(CSRF_HEADER_NAME) || undefined;
  
  // Extract from form data (if applicable)
  // This would need to be done after parsing body, so we'll handle it separately
  
  return result;
}

/**
 * Validate origin/referer headers
 */
function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  
  // For non-browser requests (like Postman), we might not have these headers
  // In production, you might want to be stricter
  if (!origin && !referer) {
    // Log for monitoring
    console.warn('Request without Origin or Referer headers');
    return false;
  }
  
  // Check if origin is allowed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }
  
  // Check referer as fallback
  if (referer) {
    const refererUrl = new URL(referer);
    const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
    return ALLOWED_ORIGINS.includes(refererOrigin);
  }
  
  return false;
}

/**
 * CSRF Protection Middleware
 */
export async function csrfProtectionMiddleware(
  request: Request,
  env: any,
  ctx: any,
  next: () => Promise<Response>
): Promise<Response> {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    // Generate token for GET requests (for forms)
    const response = await next();
    
    // Check if token already exists
    const { cookieToken } = extractCSRFToken(request);
    if (!cookieToken) {
      // Generate and set new token
      const newToken = generateCSRFToken();
      return setCSRFCookie(response, newToken);
    }
    
    return response;
  }
  
  // For mutation methods (POST, PUT, DELETE, PATCH)
  
  // 1. Validate origin/referer
  if (!validateOrigin(request)) {
    return new Response(
      JSON.stringify({
        error: 'CSRF validation failed',
        message: 'Invalid origin'
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin'))
        }
      }
    );
  }
  
  // 2. Extract and validate tokens
  const { cookieToken, headerToken } = extractCSRFToken(request);
  
  // Check if both tokens exist
  if (!cookieToken || !headerToken) {
    return new Response(
      JSON.stringify({
        error: 'CSRF validation failed',
        message: 'Missing CSRF token',
        details: {
          hasCookie: !!cookieToken,
          hasHeader: !!headerToken
        }
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin'))
        }
      }
    );
  }
  
  // 3. Validate double-submit pattern (tokens must match)
  if (cookieToken !== headerToken) {
    console.warn('CSRF token mismatch', {
      cookie: cookieToken?.substring(0, 10) + '...',
      header: headerToken?.substring(0, 10) + '...'
    });
    
    return new Response(
      JSON.stringify({
        error: 'CSRF validation failed',
        message: 'Token mismatch'
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin'))
        }
      }
    );
  }
  
  // 4. Token is valid, proceed with request
  const response = await next();
  
  // 5. Rotate token for sensitive operations (optional)
  const url = new URL(request.url);
  const sensitiveEndpoints = [
    '/api/auth/logout',
    '/api/payments',
    '/api/investments',
    '/api/users/delete',
    '/api/admin'
  ];
  
  if (sensitiveEndpoints.some(endpoint => url.pathname.startsWith(endpoint))) {
    // Generate new token for next request
    const newToken = generateCSRFToken();
    return setCSRFCookie(response, newToken);
  }
  
  return response;
}

/**
 * Helper to check if CSRF protection should be bypassed
 * (for specific endpoints like webhooks)
 */
export function shouldBypassCSRF(request: Request): boolean {
  const url = new URL(request.url);
  
  // Bypass for webhook endpoints
  const bypassEndpoints = [
    '/api/webhooks/stripe',
    '/api/webhooks/sendgrid',
    '/api/health',
    '/api/metrics'
  ];
  
  return bypassEndpoints.some(endpoint => url.pathname.startsWith(endpoint));
}

/**
 * Simplified CSRF check for Better Auth integration
 */
export async function validateCSRFToken(request: Request): Promise<boolean> {
  // Skip validation for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true;
  }
  
  // Check if should bypass
  if (shouldBypassCSRF(request)) {
    return true;
  }
  
  // Validate origin
  if (!validateOrigin(request)) {
    return false;
  }
  
  // Validate tokens
  const { cookieToken, headerToken } = extractCSRFToken(request);
  
  if (!cookieToken || !headerToken) {
    return false;
  }
  
  return cookieToken === headerToken;
}

/**
 * Get CSRF token from request (for templates/responses)
 */
export function getCSRFToken(request: Request): string | null {
  const { cookieToken } = extractCSRFToken(request);
  return cookieToken || null;
}

/**
 * Create CSRF meta tag for HTML responses
 */
export function createCSRFMetaTag(token: string): string {
  return `<meta name="csrf-token" content="${token}">`;
}

/**
 * Create CSRF hidden input for forms
 */
export function createCSRFInput(token: string): string {
  return `<input type="hidden" name="${CSRF_FORM_FIELD}" value="${token}">`;
}