/**
 * Authentication Adapter
 * Bridges the gap between JWT-expecting frontend and Better Auth session-based backend
 * Provides backward compatibility while migrating to Better Auth
 */

import { createAuth } from './better-auth-config';
import type { PortalType } from './better-auth-config';
import { getCorsHeaders } from '../utils/response';
import { parseSessionCookie } from '../config/session.config';
import { neon } from '@neondatabase/serverless';

export interface AuthAdapterConfig {
  env: any;
  enableJWTFallback?: boolean;
}

export interface JWTPayload {
  userId: string;
  email: string;
  userType: PortalType;
  name: string;
  exp: number;
  iat: number;
}

export class AuthAdapter {
  private auth: ReturnType<typeof createAuth>;
  private env: any;
  private enableJWTFallback: boolean;

  constructor(config: AuthAdapterConfig) {
    this.auth = createAuth(config.env);
    this.env = config.env;
    this.enableJWTFallback = config.enableJWTFallback ?? true;
  }

  /**
   * Handle login request - supports both JWT response and Better Auth session
   */
  async handleLogin(request: Request, userType: PortalType): Promise<Response> {
    try {
      const body = await request.json();
      const { email, password } = body;

      // Check for demo users first (bypass Better Auth for demo accounts)
      const isDemoUser = ['alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com'].includes(email);
      
      if (isDemoUser && (password === 'Demo123' || password === 'Demo123!') && this.env?.ENVIRONMENT !== 'production') {
        // Get user details for demo user
        const user = await this.getUserFromDatabase(email, userType);
        
        if (!user) {
          const origin = request.headers.get('Origin');
          return new Response(JSON.stringify({
            success: false,
            error: { message: 'Invalid credentials or unauthorized for this portal' }
          }), { 
            status: 401,
            headers: { 
              ...getCorsHeaders(origin),
              'Content-Type': 'application/json'
            }
          });
        }

        // Generate response with JWT token
        const token = await this.generateJWTToken(user);
        
        const origin = request.headers.get('Origin');
        return new Response(JSON.stringify({
          success: true,
          data: {
            user,
            token,
            session: {
              userId: user.id,
              userEmail: user.email,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }
          }
        }), {
          status: 200,
          headers: { 
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json'
          }
        });
      }

      // For non-demo users, try Better Auth login (currently disabled)
      const origin = request.headers.get('Origin');
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Authentication system is being upgraded. Please use demo accounts.' }
      }), { 
        status: 503,
        headers: { 
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });

      // Original Better Auth code (kept for future use):
      /*
      const authResponse = await this.auth.api.signInEmail({
        body: { email, password },
        asResponse: true
      });

      if (authResponse.status !== 200) {
        const error = await authResponse.json();
        return new Response(JSON.stringify({
          success: false,
          error: { message: error.message || 'Invalid credentials' }
        }), { 
          status: 401,
          headers: { 
            ...getCorsHeaders(request.headers.get('Origin')),
            'Content-Type': 'application/json'
          }
        });
      }

      const authData = await authResponse.json();
      
      // Get user details from database
      const user = await this.getUserFromDatabase(authData.user.id, userType);
      */
      
      if (!user || user.userType !== userType) {
        const origin = request.headers.get('Origin');
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Unauthorized for this portal' }
        }), { 
          status: 403,
          headers: { 
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json'
          }
        });
      }

      // Generate JWT token for backward compatibility if enabled
      let token = '';
      if (this.enableJWTFallback) {
        token = await this.generateJWTToken(user);
      }

      // Create response with both session cookie and JWT
      const response = new Response(JSON.stringify({
        success: true,
        data: {
          token, // For legacy frontend
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            userType: user.userType,
            companyName: user.companyName,
            bio: user.bio,
            website: user.website,
            linkedinUrl: user.linkedinUrl,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Forward Better Auth session cookies
          'Set-Cookie': authResponse.headers.get('Set-Cookie') || ''
        }
      });

      return response;

    } catch (error) {
      console.error('Login error:', error);
      const origin = request.headers.get('Origin');
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Authentication failed' }
      }), { 
        status: 500,
        headers: { 
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }
  }

  /**
   * Handle registration request
   */
  async handleRegister(request: Request, userType: PortalType): Promise<Response> {
    try {
      const body = await request.json();
      const { email, password, name, companyName, phone, bio, website, linkedinUrl } = body;

      // Register with Better Auth
      const authResponse = await this.auth.api.signUpEmail({
        body: { 
          email, 
          password,
          name,
          data: {
            userType,
            companyName,
            phone,
            bio,
            website,
            linkedinUrl
          }
        },
        asResponse: true
      });

      if (authResponse.status !== 200) {
        const error = await authResponse.json();
        const origin = request.headers.get('Origin');
        return new Response(JSON.stringify({
          success: false,
          error: { message: error.message || 'Registration failed' }
        }), { 
          status: 400,
          headers: { 
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json'
          }
        });
      }

      const authData = await authResponse.json();
      
      // Create user in our database with portal-specific data
      const user = await this.createUserInDatabase({
        id: authData.user.id,
        email,
        name,
        userType,
        companyName,
        phone,
        bio,
        website,
        linkedinUrl
      });

      // Generate JWT token for backward compatibility
      let token = '';
      if (this.enableJWTFallback) {
        token = await this.generateJWTToken(user);
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          token,
          user
        }
      }), {
        status: 200,
        headers: {
          ...getCorsHeaders(request.headers.get('Origin')),
          'Content-Type': 'application/json',
          'Set-Cookie': authResponse.headers.get('Set-Cookie') || ''
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      const origin = request.headers.get('Origin');
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Registration failed' }
      }), { 
        status: 500,
        headers: { 
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }
  }

  /**
   * Validate session cookie or JWT token.
   * Mirrors the worker's validateAuth pattern: cookie → KV cache → DB → JWT fallback.
   */
  async validateAuth(request: Request): Promise<{ valid: boolean; user?: any }> {
    // 1. Parse session cookie (handles both pitchey-session and legacy cookie names)
    const cookieHeader = request.headers.get('Cookie');
    const sessionId = parseSessionCookie(cookieHeader);

    if (sessionId && this.env.DATABASE_URL) {
      try {
        // Check KV cache first
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
                userType: cached.userType
              }
            };
          }
        }

        // Fallback to database lookup
        const sql = neon(this.env.DATABASE_URL);
        const result = await sql(
          `SELECT s.id, s.user_id, s.expires_at,
                  u.id as uid, u.email, u.username, u.user_type,
                  u.first_name, u.last_name, u.company_name, u.bio,
                  COALESCE(u.name, u.username, u.email) as name
           FROM sessions s
           JOIN users u ON s.user_id::text = u.id::text
           WHERE s.id = $1
           AND s.expires_at > NOW()
           LIMIT 1`,
          [sessionId]
        );

        if (result && result.length > 0) {
          const row = result[0];

          // Cache for future requests
          if (kv) {
            await kv.put(
              `session:${sessionId}`,
              JSON.stringify({
                userId: row.user_id,
                userEmail: row.email,
                userName: row.name,
                userType: row.user_type,
                expiresAt: row.expires_at
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
              bio: row.bio
            }
          };
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('[AuthAdapter] Session validation error:', e.message);
      }
    }

    // 2. Fallback: Better Auth API session
    try {
      const sessionResponse = await this.auth.api.getSession({
        headers: request.headers,
        asResponse: true
      });

      if (sessionResponse.status === 200) {
        const sessionData = await sessionResponse.json() as any;
        if (sessionData.session && sessionData.user) {
          const user = await this.getUserFromDatabase(sessionData.user.id);
          if (user) return { valid: true, user };
        }
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('[AuthAdapter] Better Auth session error:', e.message);
    }

    // 3. Fallback: JWT validation
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

  /**
   * Handle logout
   */
  async handleLogout(request: Request): Promise<Response> {
    try {
      const response = await this.auth.api.signOut({
        headers: request.headers,
        asResponse: true
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Logged out successfully'
      }), {
        status: 200,
        headers: {
          ...getCorsHeaders(request.headers.get('Origin')),
          'Content-Type': 'application/json',
          'Set-Cookie': response.headers.get('Set-Cookie') || ''
        }
      });

    } catch (error) {
      console.error('Logout error:', error);
      const origin = request.headers.get('Origin');
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Logout failed' }
      }), { 
        status: 500,
        headers: { 
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }
  }

  /**
   * Generate JWT token for backward compatibility
   */
  private async generateJWTToken(user: any): Promise<string> {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      userType: user.userType,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30), // 30 days
      iat: Math.floor(Date.now() / 1000)
    };

    // Use Web Crypto API for proper JWT signing
    const encoder = new TextEncoder();
    const data = encoder.encode(
      btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' +
      btoa(JSON.stringify(payload))
    );

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.auth.options.secret || 'fallback-secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, data);
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

    return `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify(payload))}.${signatureBase64}`;
  }

  /**
   * Validate JWT token
   */
  private async validateJWTToken(token: string): Promise<JWTPayload | null> {
    try {
      const [headerB64, payloadB64, signatureB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64)) as JWTPayload;

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      // TODO: Verify signature properly
      return payload;

    } catch (error) {
      console.error('JWT validation error:', error);
      return null;
    }
  }

  /**
   * Get user from database.
   * Checks demo users first (fast path for login), then queries the real users table.
   */
  private async getUserFromDatabase(userId: string, requiredType?: PortalType): Promise<any> {
    // Demo users — fast path for demo login flow
    const demoUsers: Record<string, any> = {
      'alex.creator@demo.com': {
        id: '1',
        email: 'alex.creator@demo.com',
        username: 'alexcreator',
        name: 'Alex Creator',
        userType: 'creator',
        firstName: 'Alex',
        lastName: 'Creator',
        bio: 'Award-winning screenwriter with 10 years of experience',
        subscriptionTier: 'free'
      },
      'sarah.investor@demo.com': {
        id: '2',
        email: 'sarah.investor@demo.com',
        username: 'sarahinvestor',
        name: 'Sarah Investor',
        userType: 'investor',
        firstName: 'Sarah',
        lastName: 'Investor',
        companyName: 'Venture Films Capital',
        bio: 'Managing Partner at Venture Films Capital',
        subscriptionTier: 'professional'
      },
      'stellar.production@demo.com': {
        id: '3',
        email: 'stellar.production@demo.com',
        username: 'stellarprod',
        name: 'Stellar Productions',
        userType: 'production',
        companyName: 'Stellar Productions',
        bio: 'Leading independent production company',
        subscriptionTier: 'enterprise'
      }
    };

    const demoUser = Object.values(demoUsers).find(u => u.id === userId || u.email === userId);
    if (demoUser) {
      if (requiredType && demoUser.userType !== requiredType) return null;
      return demoUser;
    }

    // Real DB lookup
    if (this.env.DATABASE_URL) {
      try {
        const sql = neon(this.env.DATABASE_URL);
        const result = await sql(
          `SELECT id, email, username, user_type,
                  first_name, last_name, company_name, bio,
                  COALESCE(name, username, email) as name
           FROM users
           WHERE id::text = $1 OR email = $1
           LIMIT 1`,
          [userId]
        );

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
            bio: row.bio
          };
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('[AuthAdapter] DB user lookup error:', e.message);
      }
    }

    return null;
  }

  /**
   * Create user in database
   */
  private async createUserInDatabase(userData: any): Promise<any> {
    // This will be implemented with actual database insert
    // For now, return the user data
    return {
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Middleware to validate authentication on protected routes
   */
  async requireAuth(request: Request): Promise<{ authorized: boolean; user?: any; response?: Response }> {
    const { valid, user } = await this.validateAuth(request);
    
    if (!valid) {
      const origin = request.headers.get('Origin');
      return {
        authorized: false,
        response: new Response(JSON.stringify({
          success: false,
          error: { message: 'Authentication required' }
        }), {
          status: 401,
          headers: { 
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json'
          }
        })
      };
    }

    return { authorized: true, user };
  }

  /**
   * Middleware to check portal-specific authorization
   */
  async requirePortalAuth(
    request: Request, 
    requiredPortal: PortalType
  ): Promise<{ authorized: boolean; user?: any; response?: Response }> {
    const authResult = await this.requireAuth(request);
    
    if (!authResult.authorized) {
      return authResult;
    }

    if (authResult.user?.userType !== requiredPortal) {
      const origin = request.headers.get('Origin');
      return {
        authorized: false,
        response: new Response(JSON.stringify({
          success: false,
          error: { message: `Access denied. ${requiredPortal} portal access required.` }
        }), {
          status: 403,
          headers: { 
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json'
          }
        })
      };
    }

    return { authorized: true, user: authResult.user };
  }
}

// Export singleton factory
export function createAuthAdapter(env: any): AuthAdapter {
  return new AuthAdapter({ env, enableJWTFallback: true });
}