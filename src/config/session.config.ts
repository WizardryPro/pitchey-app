/**
 * Centralized Session Configuration
 *
 * IMPORTANT: All session-related code should import from here
 * to ensure consistent cookie names and settings across the app.
 */

export const SESSION_CONFIG = {
  // Primary cookie name - use this for all new sessions
  COOKIE_NAME: 'pitchey-session',

  // Legacy cookie name for backwards compatibility
  // Check this as fallback when reading cookies
  LEGACY_COOKIE_NAME: 'better-auth-session',

  // Cookie settings for cross-origin auth
  // Frontend: https://pitchey-5o8.pages.dev
  // Backend: https://pitchey-api-prod.ndlovucavelle.workers.dev
  // SameSite=None is REQUIRED for cross-origin fetch with credentials: 'include'
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60, // 7 days in seconds
  COOKIE_SAME_SITE: 'None' as const, // None required for cross-origin cookies (Secure is also set)
  COOKIE_SECURE: true, // Always use Secure in production
  COOKIE_HTTP_ONLY: true, // Prevents XSS attacks
  COOKIE_PATH: '/',

  // Session timeouts
  SESSION_TTL_SECONDS: 7 * 24 * 60 * 60, // 7 days
  IDLE_TIMEOUT_SECONDS: 30 * 60, // 30 minutes
  ABSOLUTE_TIMEOUT_SECONDS: 12 * 60 * 60, // 12 hours

  // Limits
  MAX_SESSIONS_PER_USER: 5,
} as const;

/**
 * Parse session ID from cookie header
 * Checks both primary and legacy cookie names
 */
export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());

  // Check primary cookie name first
  let sessionCookie = cookies.find(c => c.startsWith(`${SESSION_CONFIG.COOKIE_NAME}=`));

  // Fallback to legacy cookie name for backwards compatibility
  if (!sessionCookie) {
    sessionCookie = cookies.find(c => c.startsWith(`${SESSION_CONFIG.LEGACY_COOKIE_NAME}=`));
  }

  if (!sessionCookie) return null;

  const value = sessionCookie.split('=')[1];
  return value || null;
}

/**
 * Create Set-Cookie header value for session
 */
export function createSessionCookie(sessionId: string): string {
  const parts = [
    `${SESSION_CONFIG.COOKIE_NAME}=${sessionId}`,
    `Path=${SESSION_CONFIG.COOKIE_PATH}`,
    `Max-Age=${SESSION_CONFIG.COOKIE_MAX_AGE}`,
    `SameSite=${SESSION_CONFIG.COOKIE_SAME_SITE}`,
  ];

  if (SESSION_CONFIG.COOKIE_SECURE) {
    parts.push('Secure');
  }

  if (SESSION_CONFIG.COOKIE_HTTP_ONLY) {
    parts.push('HttpOnly');
  }

  return parts.join('; ');
}

/**
 * Create Set-Cookie header to clear session
 * Clears both primary and legacy cookie names
 */
export function createClearSessionCookie(): string[] {
  const clearCookie = (name: string) => [
    `${name}=`,
    `Path=${SESSION_CONFIG.COOKIE_PATH}`,
    'Max-Age=0',
    `SameSite=${SESSION_CONFIG.COOKIE_SAME_SITE}`,
    'Secure',
    'HttpOnly',
  ].join('; ');

  // Return cookies to clear both names
  return [
    clearCookie(SESSION_CONFIG.COOKIE_NAME),
    clearCookie(SESSION_CONFIG.LEGACY_COOKIE_NAME),
  ];
}
