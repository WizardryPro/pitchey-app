/**
 * Authentication Extraction Utility
 * Extracts user information from JWT tokens and session cookies
 *
 * Session validation priority:
 * 1. JWT token (Authorization header)
 * 2. Session cookie -> KV cache lookup
 * 3. Session cookie -> Database fallback
 */

/// <reference types="@cloudflare/workers-types" />

import { verifyJWT, extractJWT, type JWTPayload } from './worker-jwt';
import { neon } from '@neondatabase/serverless';

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string;
  userType: string;
}

export interface AuthResult {
  authenticated: boolean;
  user: AuthenticatedUser | null;
  error?: string;
}

// Extended env type to support database fallback
export interface AuthEnv {
  JWT_SECRET?: string;
  SESSION_STORE?: KVNamespace;
  SESSIONS_KV?: KVNamespace;
  KV?: KVNamespace;
  CACHE?: KVNamespace;
  DATABASE_URL?: string;
}

/**
 * Extract authenticated user from request
 * Checks JWT Bearer token, then session cookie (KV + database fallback)
 */
export async function getAuthenticatedUser(
  request: Request,
  env: AuthEnv
): Promise<AuthResult> {
  const jwtSecret = env.JWT_SECRET || 'test-secret-key-for-development';

  // Try JWT token first (Authorization header)
  const authHeader = request.headers.get('Authorization');
  const token = extractJWT(authHeader);

  if (token) {
    const payload = await verifyJWT(token, jwtSecret);
    if (payload) {
      const id = Number(payload.sub);
      if (!Number.isNaN(id)) {
        return {
          authenticated: true,
          user: {
            id,
            email: payload.email,
            name: payload.name,
            userType: payload.userType
          }
        };
      }
    }
  }

  // Try session cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    const sessionId = cookies['pitchey-session'] || cookies['better-auth-session'];

    if (sessionId) {
      // Try KV cache first (check all possible KV bindings)
      const kv = env.SESSION_STORE || env.SESSIONS_KV || env.KV || env.CACHE;
      if (kv) {
        try {
          const sessionData = await kv.get(`session:${sessionId}`);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            // Check if session is expired
            const kvUserId = Number(session.userId);
            if (new Date(session.expiresAt) > new Date() && !Number.isNaN(kvUserId)) {
              console.log(`[Auth] Session from KV: userId=${session.userId}, userType=${session.userType}`);
              return {
                authenticated: true,
                user: {
                  id: kvUserId,
                  email: session.userEmail || '',
                  name: session.userName || session.userEmail?.split('@')[0] || '',
                  userType: session.userType || 'creator'
                }
              };
            }
          }
        } catch (error) {
          console.error('[Auth] KV session lookup error:', error);
        }
      }

      // Fallback to database lookup if KV miss and DATABASE_URL available
      if (env.DATABASE_URL) {
        try {
          const sql = neon(env.DATABASE_URL);
          const result = await sql`
            SELECT s.id, s.user_id, s.expires_at,
                   u.id as uid, u.email, u.username, u.user_type,
                   u.first_name, u.last_name, u.name as display_name
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = ${sessionId}
              AND s.expires_at > NOW()
            LIMIT 1
          `;

          if (result && result.length > 0) {
            const session = result[0];
            const userName = session.display_name || session.username ||
                           (session.first_name ? `${session.first_name} ${session.last_name || ''}`.trim() : null) ||
                           session.email?.split('@')[0] || '';

            console.log(`[Auth] Session from DB: userId=${session.user_id}, userType=${session.user_type}`);

            // Cache the session in KV for future requests
            if (kv) {
              try {
                await kv.put(
                  `session:${sessionId}`,
                  JSON.stringify({
                    userId: session.user_id,
                    userEmail: session.email,
                    userName: userName,
                    userType: session.user_type,
                    expiresAt: session.expires_at
                  }),
                  { expirationTtl: 3600 } // Cache for 1 hour
                );
              } catch (cacheError) {
                console.warn('[Auth] Failed to cache session in KV:', cacheError);
              }
            }

            const dbUserId = Number(session.user_id);
            if (Number.isNaN(dbUserId)) {
              return {
                authenticated: false,
                user: null,
                error: 'Invalid user id in session'
              };
            }

            return {
              authenticated: true,
              user: {
                id: dbUserId,
                email: session.email || '',
                name: userName,
                userType: session.user_type || 'creator'
              }
            };
          }
        } catch (dbError) {
          console.error('[Auth] Database session lookup error:', dbError);
        }
      }
    }
  }

  return {
    authenticated: false,
    user: null,
    error: 'No valid authentication found'
  };
}

/**
 * Get user ID from request, with fallback to query param for backward compatibility
 */
export async function getUserId(
  request: Request,
  env: AuthEnv
): Promise<number | null> {
  // First try to get from auth
  const authResult = await getAuthenticatedUser(request, env);
  if (authResult.authenticated && authResult.user) {
    return authResult.user.id;
  }

  // Fallback: Check query param (for backward compatibility during transition)
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get('userId');
  if (userIdParam) {
    console.warn('Using userId from query param - this is deprecated');
    const id = Number(userIdParam);
    if (!Number.isNaN(id)) {
      return id;
    }
  }

  return null;
}

/**
 * Require authentication - returns user or throws/returns error response
 */
export async function requireAuth(
  request: Request,
  env: AuthEnv
): Promise<{ user: AuthenticatedUser } | { error: Response }> {
  const authResult = await getAuthenticatedUser(request, env);

  if (!authResult.authenticated || !authResult.user) {
    const origin = request.headers.get('Origin');
    return {
      error: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    };
  }

  return { user: authResult.user };
}

/**
 * Require specific role - returns user or error response
 */
export async function requireRole(
  request: Request,
  env: AuthEnv,
  allowedRoles: string | string[]
): Promise<{ user: AuthenticatedUser } | { error: Response }> {
  const authResult = await requireAuth(request, env);

  if ('error' in authResult) {
    return authResult;
  }

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const userRole = authResult.user.userType?.toLowerCase() || '';

  if (!roles.some(role => role.toLowerCase() === userRole)) {
    const origin = request.headers.get('Origin');
    return {
      error: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Access denied. Required role: ${roles.join(' or ')}`
          }
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    };
  }

  return { user: authResult.user };
}

/**
 * Parse cookies from header
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      cookies[key] = value;
    }
  });
  return cookies;
}
