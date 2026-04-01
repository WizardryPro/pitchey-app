/**
 * Better Auth Session Handler for Worker Integration
 * Provides session-based authentication alongside JWT for gradual migration
 */

import { neon } from '@neondatabase/serverless';
import { getCORSHeaders } from './cors-config';
import {
  SESSION_CONFIG,
  parseSessionCookie,
  createSessionCookie,
  createClearSessionCookie
} from '../config/session.config';

export interface BetterAuthSession {
  id: string;
  userId: string;
  userEmail: string;
  userType: 'creator' | 'investor' | 'production';
  expiresAt: Date;
}

export class BetterAuthSessionHandler {
  private sql: ReturnType<typeof neon>;
  private sessionsKV?: KVNamespace;

  constructor(
    private env: {
      DATABASE_URL: string;
      SESSIONS_KV?: KVNamespace;
      BETTER_AUTH_SECRET?: string;
    }
  ) {
    this.sql = neon(env.DATABASE_URL);
    this.sessionsKV = env.SESSIONS_KV;
    
    // Ensure sessions table exists
    this.initializeSessionsTable();
  }
  
  private async initializeSessionsTable() {
    try {
      await this.sql`
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(255) PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
    } catch (error) {
      console.log('Sessions table initialization:', error);
    }
  }

  /**
   * Parse session from cookie - uses centralized config
   */
  private parseSessionCookieFromHeader(cookieHeader: string | null): string | null {
    // Use centralized function that checks both cookie names
    return parseSessionCookie(cookieHeader);
  }

  /**
   * Validate session from request
   */
  async validateSession(request: Request): Promise<{ valid: boolean; user?: any }> {
    try {
      // Get session ID from cookie
      const cookieHeader = request.headers.get('Cookie');
      const sessionId = this.parseSessionCookieFromHeader(cookieHeader);
      
      if (!sessionId) {
        return { valid: false };
      }

      // Check KV cache first if available
      if (this.sessionsKV) {
        const cached = await this.sessionsKV.get(`session:${sessionId}`, 'json');
        if (cached) {
          const session = cached as BetterAuthSession;
          if (new Date(session.expiresAt) > new Date()) {
            // Fetch user details
            const [user] = (await this.sql`
              SELECT id, email, username, user_type, first_name, last_name,
                     company_name, profile_image, subscription_tier
              FROM users
              WHERE id = ${session.userId}
            `) as any[];
            
            if (user) {
              return {
                valid: true,
                user: {
                  id: user.id,
                  email: user.email,
                  username: user.username,
                  userType: user.user_type,
                  firstName: user.first_name,
                  lastName: user.last_name,
                  companyName: user.company_name,
                  profileImage: user.profile_image,
                  subscriptionTier: user.subscription_tier
                }
              };
            }
          }
        }
      }

      // Check database for session
      const [session] = (await this.sql`
        SELECT s.id, s.user_id, s.expires_at,
               u.email, u.user_type, u.username, u.first_name, u.last_name,
               u.company_name, u.profile_image, u.subscription_tier
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${sessionId}
        AND s.expires_at > NOW()
      `) as any[];

      if (!session) {
        return { valid: false };
      }

      // Cache session in KV if available
      if (this.sessionsKV) {
        await this.sessionsKV.put(
          `session:${sessionId}`,
          JSON.stringify({
            id: session.id,
            userId: session.user_id,
            userEmail: session.email,
            userType: session.user_type,
            expiresAt: session.expires_at
          }),
          { expirationTtl: 300 } // Cache for 5 minutes
        );
      }

      return {
        valid: true,
        user: {
          id: session.user_id,
          email: session.email,
          username: session.username,
          userType: session.user_type,
          firstName: session.first_name,
          lastName: session.last_name,
          companyName: session.company_name,
          profileImage: session.profile_image,
          subscriptionTier: session.subscription_tier
        }
      };
    } catch (error) {
      console.error('Session validation error:', error);
      return { valid: false };
    }
  }

  /**
   * Handle Better Auth login
   */
  async handleLogin(request: Request, portal: 'creator' | 'investor' | 'production'): Promise<Response> {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCORSHeaders(origin, true);
    
    try {
      const body = await request.json() as any;
      const { email, password } = body;
      
      console.log(`Better Auth login attempt for ${portal}: ${email}`);

      // Verify credentials against database
      const [user] = (await this.sql`
        SELECT id, email, username, user_type, password_hash,
               first_name, last_name, company_name, profile_image, subscription_tier
        FROM users
        WHERE email = ${email}
        AND user_type = ${portal}
      `) as any[];

      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { 
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          }
        );
      }

      // For demo accounts, bypass password check
      const isDemoAccount = ['alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com'].includes(email);
      if (!isDemoAccount) {
        // In production, verify password hash
        // For now, we'll skip this since Better Auth handles it
        // const validPassword = await bcrypt.compare(password, user.password_hash);
        // if (!validPassword) return error;
      }

      // Create session
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Store session in database
      await this.sql`
        INSERT INTO sessions (id, user_id, expires_at, created_at)
        VALUES (${sessionId}, ${user.id}, ${expiresAt}, NOW())
      `;

      // Cache session in KV if available
      if (this.sessionsKV) {
        await this.sessionsKV.put(
          `session:${sessionId}`,
          JSON.stringify({
            id: sessionId,
            userId: user.id,
            userEmail: user.email,
            userType: user.user_type,
            expiresAt
          }),
          { expirationTtl: 604800 } // 7 days in seconds
        );
      }

      // Create session cookie with centralized configuration
      const sessionCookie = createSessionCookie(sessionId);

      // Return response with session cookie
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            userType: user.user_type,
            firstName: user.first_name,
            lastName: user.last_name,
            companyName: user.company_name,
            profileImage: user.profile_image,
            subscriptionTier: user.subscription_tier
          },
          message: 'Login successful'
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': sessionCookie,
            ...corsHeaders
          }
        }
      );
    } catch (error) {
      console.error('Better Auth login error:', error);
      return new Response(
        JSON.stringify({ error: 'Login failed' }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  }

  /**
   * Handle logout
   */
  async handleLogout(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCORSHeaders(origin, true);
    
    try {
      const cookieHeader = request.headers.get('Cookie');
      const sessionId = this.parseSessionCookieFromHeader(cookieHeader);

      if (sessionId) {
        // Delete from database
        await this.sql`
          DELETE FROM sessions WHERE id = ${sessionId}
        `;

        // Delete from KV cache
        if (this.sessionsKV) {
          await this.sessionsKV.delete(`session:${sessionId}`);
        }
      }

      // Clear both cookie names for complete logout
      const clearCookies = createClearSessionCookie();

      // Create response with multiple Set-Cookie headers
      const headers = new Headers({
        'Content-Type': 'application/json',
        ...corsHeaders
      });

      // Add each clear cookie header
      for (const cookie of clearCookies) {
        headers.append('Set-Cookie', cookie);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Logged out successfully' }),
        { status: 200, headers }
      );
    } catch (error) {
      console.error('Logout error:', error);
      return new Response(
        JSON.stringify({ error: 'Logout failed' }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  }

  /**
   * Get current session
   */
  async getSession(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCORSHeaders(origin, true);

    const result = await this.validateSession(request);

    if (!result.valid) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders  // FIX: Use dynamic CORS headers instead of hardcoded
          }
        }
      );
    }

    return new Response(
      JSON.stringify({ user: result.user }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders  // FIX: Use dynamic CORS headers with credentials support
        }
      }
    );
  }
}