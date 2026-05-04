/**
 * Auth adapter — wraps custom session validation for routes that don't use
 * the worker's inline auth helpers (currently only `routes/user-profile.ts`).
 *
 * History: this file used to delegate to Better Auth as a fallback. Issue #19
 * (closed 2026-05-04) ripped that path — BA was imported but the live login,
 * register, and session-write paths never invoked it. Validate-only behavior
 * here matches what was already happening in production: legacy `sessions`
 * row + KV cache lookup, JWT bearer-token fallback.
 */

import { getCorsHeaders } from '../utils/response';
import { parseSessionCookie } from '../config/session.config';
import { neon } from '@neondatabase/serverless';

export type PortalType = 'creator' | 'investor' | 'production';

export interface AuthAdapterConfig {
  env: any;
  enableJWTFallback?: boolean;
}

interface JWTPayload {
  userId: string;
  email: string;
  userType: PortalType;
  name: string;
  exp: number;
  iat: number;
}

export class AuthAdapter {
  private env: any;
  private enableJWTFallback: boolean;
  private jwtSecret: string;

  constructor(config: AuthAdapterConfig) {
    this.env = config.env;
    this.enableJWTFallback = config.enableJWTFallback ?? true;
    this.jwtSecret =
      config.env?.JWT_SECRET ||
      config.env?.BETTER_AUTH_SECRET ||
      'fallback-secret';
  }

  /**
   * Validate session cookie or JWT token.
   * Cookie → KV cache → DB → JWT bearer fallback.
   */
  async validateAuth(request: Request): Promise<{ valid: boolean; user?: any }> {
    const cookieHeader = request.headers.get('Cookie');
    const sessionId = parseSessionCookie(cookieHeader);

    if (sessionId && this.env.DATABASE_URL) {
      try {
        const kv = this.env.SESSION_STORE || this.env.SESSIONS_KV || this.env.KV || this.env.CACHE;
        if (kv) {
          const cached = await kv.get(`session:${sessionId}`, 'json') as any;
          if (cached && new Date(cached.expiresAt) > new Date()) {
            return {
              valid: true,
              user: {
                id: cached.userId,
                email: cached.userEmail,
                name: cached.userName || cached.userEmail,
                userType: cached.userType,
              },
            };
          }
        }

        const sql = neon(this.env.DATABASE_URL);
        const result = await sql`
          SELECT s.id, s.user_id, s.expires_at,
                 u.id as uid, u.email, u.username, u.user_type,
                 u.first_name, u.last_name, u.company_name, u.bio,
                 COALESCE(u.name, u.username, u.email) as name
          FROM sessions s
          JOIN users u ON s.user_id::text = u.id::text
          WHERE s.id = ${sessionId}
          AND s.expires_at > NOW()
          LIMIT 1`;

        if (result && result.length > 0) {
          const row = result[0];

          if (kv) {
            await kv.put(
              `session:${sessionId}`,
              JSON.stringify({
                userId: row.user_id,
                userEmail: row.email,
                userName: row.name,
                userType: row.user_type,
                expiresAt: row.expires_at,
              }),
              { expirationTtl: 3600 }
            );
          }

          return {
            valid: true,
            user: {
              id: row.user_id,
              email: row.email,
              name: row.name,
              username: row.username,
              userType: row.user_type,
              firstName: row.first_name,
              lastName: row.last_name,
              companyName: row.company_name,
              bio: row.bio,
            },
          };
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('[AuthAdapter] Session validation error:', e.message);
      }
    }

    if (this.enableJWTFallback) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = await this.validateJWTToken(token);
        if (payload) {
          const user = await this.getUserFromDatabase(payload.userId);
          if (user) return { valid: true, user };
        }
      }
    }

    return { valid: false };
  }

  private async validateJWTToken(token: string): Promise<JWTPayload | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const [headerB64, payloadB64, signatureB64] = parts;
      const payload = JSON.parse(atob(payloadB64)) as JWTPayload;

      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      const encoder = new TextEncoder();
      const signingInput = encoder.encode(headerB64 + '.' + payloadB64);

      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.jwtSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const signatureBytes = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
      const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, signingInput);

      if (!valid) {
        console.error('JWT signature verification failed');
        return null;
      }

      return payload;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('JWT validation error:', e.message);
      return null;
    }
  }

  private async getUserFromDatabase(userId: string, requiredType?: PortalType): Promise<any> {
    const demoUsers: Record<string, any> = {
      'alex.creator@demo.com': {
        id: '1', email: 'alex.creator@demo.com', username: 'alexcreator',
        name: 'Alex Creator', userType: 'creator',
        firstName: 'Alex', lastName: 'Creator',
        bio: 'Award-winning screenwriter with 10 years of experience',
        subscriptionTier: 'free',
      },
      'sarah.investor@demo.com': {
        id: '2', email: 'sarah.investor@demo.com', username: 'sarahinvestor',
        name: 'Sarah Investor', userType: 'investor',
        firstName: 'Sarah', lastName: 'Investor',
        companyName: 'Venture Films Capital',
        bio: 'Managing Partner at Venture Films Capital',
        subscriptionTier: 'professional',
      },
      'stellar.production@demo.com': {
        id: '3', email: 'stellar.production@demo.com', username: 'stellarprod',
        name: 'Stellar Productions', userType: 'production',
        companyName: 'Stellar Productions',
        bio: 'Leading independent production company',
        subscriptionTier: 'enterprise',
      },
    };

    const demoUser = Object.values(demoUsers).find(u => u.id === userId || u.email === userId);
    if (demoUser) {
      if (requiredType && demoUser.userType !== requiredType) return null;
      return demoUser;
    }

    if (this.env.DATABASE_URL) {
      try {
        const sql = neon(this.env.DATABASE_URL);
        const result = await sql`
          SELECT id, email, username, user_type,
                 first_name, last_name, company_name, bio,
                 COALESCE(name, username, email) as name
          FROM users
          WHERE id::text = ${userId} OR email = ${userId}
          LIMIT 1`;

        if (result && result.length > 0) {
          const row = result[0];
          if (requiredType && row.user_type !== requiredType) return null;
          return {
            id: row.id,
            email: row.email,
            username: row.username,
            name: row.name,
            userType: row.user_type,
            firstName: row.first_name,
            lastName: row.last_name,
            companyName: row.company_name,
            bio: row.bio,
          };
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('[AuthAdapter] DB user lookup error:', e.message);
      }
    }

    return null;
  }

  async requireAuth(request: Request): Promise<{ authorized: boolean; user?: any; response?: Response }> {
    const { valid, user } = await this.validateAuth(request);

    if (!valid) {
      const origin = request.headers.get('Origin');
      return {
        authorized: false,
        response: new Response(JSON.stringify({
          success: false,
          error: { message: 'Authentication required' },
        }), {
          status: 401,
          headers: {
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json',
          },
        }),
      };
    }

    return { authorized: true, user };
  }

  async requirePortalAuth(
    request: Request,
    requiredPortal: PortalType
  ): Promise<{ authorized: boolean; user?: any; response?: Response }> {
    const authResult = await this.requireAuth(request);
    if (!authResult.authorized) return authResult;

    if (authResult.user?.userType !== requiredPortal) {
      const origin = request.headers.get('Origin');
      return {
        authorized: false,
        response: new Response(JSON.stringify({
          success: false,
          error: { message: `Access denied. ${requiredPortal} portal access required.` },
        }), {
          status: 403,
          headers: {
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json',
          },
        }),
      };
    }

    return { authorized: true, user: authResult.user };
  }
}

export function createAuthAdapter(env: any): AuthAdapter {
  return new AuthAdapter({ env, enableJWTFallback: true });
}
