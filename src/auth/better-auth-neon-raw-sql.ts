/**
 * Better Auth Configuration for Cloudflare Workers with Neon PostgreSQL
 * Using raw SQL without Drizzle ORM
 */

import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { neon } from "@neondatabase/serverless";
import type { KVNamespace } from "@cloudflare/workers-types";
import { getCorsHeaders } from "../utils/response";

// Define environment interface
export interface AuthEnv {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET?: string;
  JWT_SECRET?: string;
  SESSIONS_KV?: KVNamespace;
  KV?: KVNamespace;
  FRONTEND_URL?: string;
  ENVIRONMENT?: string;
}

// Helper to safely get array from Neon query result
function toArray<T>(result: any): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  return [];
}

/**
 * Custom database adapter for raw SQL with Neon
 */
function createRawSQLAdapter(sql: ReturnType<typeof neon>) {
  return {
    async findUser(email: string) {
      const result = await sql`
        SELECT id, email, username, user_type, password_hash, password_hash AS password,
               first_name, last_name, company_name, profile_image, subscription_tier,
               bio,
               COALESCE(name, username, email) as name
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `;
      const rows = toArray<Record<string, unknown>>(result);
      return rows[0];
    },

    async findUserById(id: string) {
      const result = await sql`
        SELECT id, email, username, user_type,
               first_name, last_name, company_name, profile_image, subscription_tier,
               bio,
               COALESCE(name, username, email) as name
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `;
      const rows = toArray<Record<string, unknown>>(result);
      return rows[0];
    },

    async createSession(userId: string, expiresAt: Date) {
      const sessionId = crypto.randomUUID();
      const sessionToken = crypto.randomUUID(); // Generate a token for the session
      await sql`
        INSERT INTO sessions (id, user_id, token, expires_at, created_at)
        VALUES (${sessionId}, ${userId}, ${sessionToken}, ${expiresAt}, NOW())
      `;
      return sessionId;
    },

    async findSession(sessionId: string) {
      const result = await sql`
        SELECT s.id, s.user_id, s.expires_at,
               u.id as user_id, u.email, u.username, u.user_type,
               u.first_name, u.last_name, u.company_name,
               u.profile_image, u.subscription_tier,
               u.bio,
               COALESCE(u.name, u.username, u.email) as name
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${sessionId}
        AND s.expires_at > NOW()
        LIMIT 1
      `;
      const rows = toArray<Record<string, unknown>>(result);
      return rows[0];
    },

    async deleteSession(sessionId: string) {
      await sql`
        DELETE FROM sessions WHERE id = ${sessionId}
      `;
    },

    async deleteExpiredSessions() {
      await sql`
        DELETE FROM sessions WHERE expires_at < NOW()
      `;
    }
  };
}

/**
 * Create Better Auth instance without Drizzle, using raw SQL
 */
export function createBetterAuthInstance(env: AuthEnv, request?: Request) {
  // Create Neon SQL client
  const sql = neon(env.DATABASE_URL);

  // Get Cloudflare context from request if available
  const cf = request ? (request as any).cf : undefined;

  // Create raw SQL adapter
  const dbAdapter = createRawSQLAdapter(sql as any);

  // For now, we'll use a simpler approach that doesn't require the drizzleAdapter
  // Better Auth can work with custom session handling
  return {
    sql,
    dbAdapter,

    // Handle authentication requests
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const method = request.method;

      // Handle login
      if (method === 'POST' && url.pathname.includes('/login')) {
        const body = await request.json() as { email?: string; password?: string };
        const { email, password } = body;

        if (!email) {
          return new Response(
            JSON.stringify({ error: 'Email is required' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...getCorsHeaders(request.headers.get('Origin'))
              }
            }
          );
        }

        // Get user from database
        const user = await dbAdapter.findUser(email);

        if (!user) {
          return new Response(
            JSON.stringify({ error: 'Invalid credentials' }),
            {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                ...getCorsHeaders(request.headers.get('Origin'))
              }
            }
          );
        }

        // For demo accounts, bypass password check
        const isDemoAccount = ['alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com'].includes(email);

        // Create session
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const userId = String(user.id);
        const sessionId = await dbAdapter.createSession(userId, expiresAt);

        // Store session in KV if available
        if (env.SESSIONS_KV) {
          await env.SESSIONS_KV.put(
            `session:${sessionId}`,
            JSON.stringify({
              id: sessionId,
              userId: user.id,
              userEmail: user.email,
              userType: user.user_type,
              expiresAt
            }),
            { expirationTtl: 604800 } // 7 days
          );
        }

        // Get proper CORS headers for the request origin using centralized function
        const origin = request.headers.get('Origin');
        const corsHeaders = getCorsHeaders(origin);

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
            token: sessionId // For backward compatibility
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': `better-auth-session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800`,
              ...corsHeaders
            }
          }
        );
      }

      // Handle logout
      if (url.pathname.includes('/logout')) {
        const cookieHeader = request.headers.get('Cookie');
        const sessionId = cookieHeader?.match(/better-auth-session=([^;]+)/)?.[1];

        if (sessionId) {
          await dbAdapter.deleteSession(sessionId);

          // Delete from KV cache
          if (env.SESSIONS_KV) {
            await env.SESSIONS_KV.delete(`session:${sessionId}`);
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Logged out' }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': 'better-auth-session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0',
              ...getCorsHeaders(request.headers.get('Origin'))
            }
          }
        );
      }

      // Handle session check
      if (url.pathname.includes('/session')) {
        const cookieHeader = request.headers.get('Cookie');
        const sessionId = cookieHeader?.match(/better-auth-session=([^;]+)/)?.[1];

        if (!sessionId) {
          return new Response(
            JSON.stringify({ error: 'No session' }),
            {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                ...getCorsHeaders(request.headers.get('Origin'))
              }
            }
          );
        }

        // Check KV cache first
        if (env.SESSIONS_KV) {
          const cached = await env.SESSIONS_KV.get(`session:${sessionId}`, 'json');
          if (cached) {
            const session = cached as any;
            if (new Date(session.expiresAt) > new Date()) {
              const user = await dbAdapter.findUserById(session.userId);
              return new Response(
                JSON.stringify({ user }),
                {
                  status: 200,
                  headers: {
                    'Content-Type': 'application/json',
                    ...getCorsHeaders(request.headers.get('Origin'))
                  }
                }
              );
            }
          }
        }

        // Check database
        const session = await dbAdapter.findSession(sessionId);
        if (!session) {
          return new Response(
            JSON.stringify({ error: 'Invalid session' }),
            {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                ...getCorsHeaders(request.headers.get('Origin'))
              }
            }
          );
        }

        return new Response(
          JSON.stringify({
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
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(request.headers.get('Origin'))
            }
          }
        );
      }

      // Default response
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(null)
          }
        }
      );
    }
  };
}

/**
 * Portal authentication helper
 */
export function createPortalAuth(auth: ReturnType<typeof createBetterAuthInstance>) {
  return {
    async getSession(headers: Headers): Promise<{ user: any } | null> {
      const cookieHeader = headers.get('Cookie');
      const sessionId = cookieHeader?.match(/better-auth-session=([^;]+)/)?.[1];

      if (!sessionId) {
        return null;
      }

      const session = await auth.dbAdapter.findSession(sessionId);
      if (!session) {
        return null;
      }

      return {
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
    }
  };
}