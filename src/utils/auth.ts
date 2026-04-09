/**
 * Authentication utilities for Worker handlers
 *
 * Session validation uses direct KV/database lookup for consistency
 * with the login handler which stores sessions in KV and database.
 */

import type { Env } from '../db/connection';
import { neon } from '@neondatabase/serverless';

// Extended env type to support all KV bindings
export interface AuthEnv extends Env {
  SESSION_STORE?: KVNamespace;
  SESSIONS_KV?: KVNamespace;
  KV?: KVNamespace;
  CACHE?: KVNamespace;
}

export interface AuthUser {
  id: number;
  email: string;
  username?: string;
  userType?: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

/**
 * Check if a request path is a public endpoint that doesn't require authentication
 */
export function isPublicEndpoint(path: string, method: string): boolean {
  const publicPaths = [
    '/api/health',
    '/api/auth/',
    '/api/search/',
    '/api/browse',
    '/api/pitches/public/',
    '/api/trending'
  ];

  // Pitchey Score: anonymous rating + comments are public
  const pitcheyScorePattern = /^\/api\/pitches\/\d+\/(rate|comments|rating-status)$/;

  // Check exact matches and path prefixes
  return publicPaths.some(publicPath => {
    if (publicPath.endsWith('/')) {
      return path.startsWith(publicPath);
    }
    return path === publicPath;
  }) || (method === 'GET' && path === '/api/pitches')
    || pitcheyScorePattern.test(path);
}

/**
 * Verify authentication using direct session validation (KV + database)
 * This matches the session storage used by the login handler
 */
export async function verifyAuth(request: Request, env: AuthEnv): Promise<AuthResult> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Skip authentication for public endpoints
  if (isPublicEndpoint(path, method)) {
    return {
      success: true,
      user: undefined // No user for public access
    };
  }

  try {
    // First check for JWT token in Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // Import JWT verification
      const { verifyJWT } = await import('./worker-jwt');

      try {
        const payload = await verifyJWT(token, env.JWT_SECRET || 'test-secret-key-for-development');

        if (payload) {
          const p = payload as Record<string, any>;
          return {
            success: true,
            user: {
              id: parseInt(String(p.sub || p.userId || '0')),
              email: String(p.email || ''),
              username: String(p.name || p.username || ''),
              userType: String(p.userType || '')
            }
          };
        }
      } catch (jwtError) {
        console.error('[Auth] JWT verification failed:', jwtError);
      }
    }

    // Fallback to session cookie validation
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
      return { success: false, error: 'No authentication token or session' };
    }

    // Parse cookies
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => {
        const [key, ...val] = c.split('=');
        return [key, val.join('=')];
      })
    );

    // Check both cookie names - pitchey-session is the current name, better-auth-session is legacy
    const sessionToken = cookies['pitchey-session'] || cookies['better-auth-session'];
    if (!sessionToken) {
      return { success: false, error: 'No session token' };
    }

    // Try KV cache first (check all possible KV bindings)
    const kv = env.SESSION_STORE || env.SESSIONS_KV || env.KV || env.CACHE;
    if (kv) {
      try {
        const cached = await kv.get(`session:${sessionToken}`, 'json') as any;
        if (cached && new Date(cached.expiresAt) > new Date()) {
          console.log(`[Auth] Session from KV: userId=${cached.userId}, userType=${cached.userType}`);
          return {
            success: true,
            user: {
              id: parseInt(String(cached.userId)),
              email: String(cached.userEmail || ''),
              username: String(cached.userName || cached.userEmail?.split('@')[0] || ''),
              userType: String(cached.userType || 'creator')
            }
          };
        }
      } catch (kvError) {
        console.error('[Auth] KV session lookup error:', kvError);
      }
    }

    // Fallback to database lookup
    if (env.DATABASE_URL) {
      try {
        const sql = neon(env.DATABASE_URL);
        const result = await sql`
          SELECT s.id, s.user_id, s.expires_at,
                 u.id as uid, u.email, u.username, u.user_type,
                 u.first_name, u.last_name, u.name as display_name
          FROM sessions s
          JOIN users u ON s.user_id::text = u.id::text
          WHERE s.id = ${sessionToken}
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
                `session:${sessionToken}`,
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

          return {
            success: true,
            user: {
              id: parseInt(String(session.user_id)),
              email: String(session.email || ''),
              username: String(userName),
              userType: String(session.user_type || 'creator')
            }
          };
        }
      } catch (dbError) {
        console.error('[Auth] Database session lookup error:', dbError);
      }
    }

    return { success: false, error: 'Invalid session' };
  } catch (error) {
    console.error('[Auth] Auth verification error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Extract user from Better Auth session for backward compatibility
 */
export async function getUserFromSession(request: Request, env: Env): Promise<AuthUser | null> {
  const result = await verifyAuth(request, env);
  return result.success ? result.user || null : null;
}

/**
 * Get authenticated user from request (alias for getUserFromSession)
 */
export async function getAuthUser(request: Request, env: Env): Promise<AuthUser | null> {
  return getUserFromSession(request, env);
}