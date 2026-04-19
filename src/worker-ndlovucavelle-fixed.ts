/**
 * Pitchey API Worker for ndlovucavelle account
 * Full implementation with real database connections
 * Version 2.0 - With Creator and Production portals
 */

import { neon } from '@neondatabase/serverless';
import type { NeonQueryFunction } from '@neondatabase/serverless';

// Import all query modules
import * as pitchQueries from './db/queries/pitches';
import * as userQueries from './db/queries/users';
import * as ndaQueries from './db/queries/nda';
import * as investmentQueries from './db/queries/investments';
import * as analyticsQueries from './db/queries/analytics';
import * as documentQueries from './db/queries/documents';
import * as notificationQueries from './db/queries/notifications';
import * as messagingQueries from './db/queries/messaging';
import * as followsQueries from './db/queries/follows';

// Import handlers
import { getDb } from './db/connection';
import type { Env as ConnectionEnv } from './db/connection';

export interface Env extends ConnectionEnv {
  // Database
  DATABASE_URL: string;
  
  // Cache
  KV?: KVNamespace;
  CACHE?: KVNamespace;
  
  // Storage
  R2_BUCKET?: R2Bucket;
  
  // Configuration
  FRONTEND_URL?: string;
  ENVIRONMENT?: 'development' | 'staging' | 'production';
  
  // Auth
  JWT_SECRET?: string;
  BETTER_AUTH_SECRET?: string;
}

// CORS configuration
function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = [
    'https://pitchey.pages.dev',
    'https://pitchey.pages.dev',
    'https://pitchey-frontend-ndlovu.pages.dev',
    'http://localhost:5173',
    'http://localhost:3000'
  ];

  let allowOrigin = 'https://pitchey.pages.dev'; // Default
  
  if (origin) {
    // Allow any subdomain of pages.dev for Cloudflare deployments
    if (origin.includes('.pages.dev') || allowedOrigins.includes(origin)) {
      allowOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };
}

// JSON response helper
function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

// Error response helper
function errorResponse(message: string, status = 500, headers: Record<string, string> = {}): Response {
  return jsonResponse({
    success: false,
    error: {
      code: status === 401 ? 'UNAUTHORIZED' : 'SERVER_ERROR',
      message
    }
  }, status, headers);
}

// Main request handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Get database connection
      const sql = env.DATABASE_URL ? neon(env.DATABASE_URL) : null;
      
      if (!sql && !path.includes('/health')) {
        return errorResponse('Database connection not configured', 503, corsHeaders);
      }

      // Health check
      if (path === '/api/health' && method === 'GET') {
        const dbStatus = await checkDatabaseHealth(sql);
        return jsonResponse({
          success: true,
          data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: dbStatus,
            environment: env.ENVIRONMENT || 'production'
          }
        }, 200, corsHeaders);
      }

      // Browse endpoints with fixed tab separation
      if (path === '/api/browse' && method === 'GET') {
        const type = url.searchParams.get('type') || 'trending';
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        if (!sql) throw new Error('Database not configured');

        let items;
        if (type === 'trending') {
          items = await pitchQueries.getTrendingPitches(sql, limit, offset);
        } else if (type === 'new') {
          items = await pitchQueries.getNewPitches(sql, limit, offset);
        } else {
          items = await pitchQueries.searchPitches(sql, { limit, offset });
        }

        return jsonResponse({
          success: true,
          data: items
        }, 200, corsHeaders);
      }

      // Creator Dashboard endpoints
      if (path === '/api/creator/dashboard' && method === 'GET') {
        const userId = url.searchParams.get('userId') || '1';
        if (!sql) throw new Error('Database not configured');

        const [user, pitches, analytics, contracts] = await Promise.all([
          userQueries.getUserById(sql, userId),
          pitchQueries.getUserPitches(sql, userId, 5),
          analyticsQueries.getUserAnalytics(sql, userId, '30d'),
          sql`
            SELECT COUNT(*) as total, 
                   SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
            FROM contracts 
            WHERE creator_id = ${userId}
          `
        ]);

        const revenue = await sql`
          SELECT 
            COALESCE(SUM(amount), 0) as total,
            COALESCE(SUM(CASE WHEN received_date > NOW() - INTERVAL '30 days' THEN amount ELSE 0 END), 0) as last_30_days
          FROM creator_revenue
          WHERE creator_id = ${userId}
        `;

        return jsonResponse({
          success: true,
          data: {
            user,
            pitches,
            analytics,
            contracts: contracts[0],
            revenue: revenue[0],
            timestamp: new Date().toISOString()
          }
        }, 200, corsHeaders);
      }

      // Creator Revenue endpoint
      if (path === '/api/creator/revenue' && method === 'GET') {
        const userId = url.searchParams.get('userId') || '1';
        const period = url.searchParams.get('period') || '30d';
        if (!sql) throw new Error('Database not configured');

        const revenue = await sql`
          SELECT 
            source_type,
            SUM(amount) as total,
            COUNT(*) as count,
            MAX(received_date) as last_payment
          FROM creator_revenue
          WHERE creator_id = ${userId}
            AND received_date > NOW() - INTERVAL ${period}
          GROUP BY source_type
          ORDER BY total DESC
        `;

        return jsonResponse({
          success: true,
          data: {
            revenue,
            period
          }
        }, 200, corsHeaders);
      }

      // Follows endpoints
      if (path === '/api/follows/followers' && method === 'GET') {
        const userId = url.searchParams.get('userId') || url.searchParams.get('creatorId') || '1';
        if (!sql) throw new Error('Database not configured');

        const followers = await followsQueries.getFollowers(sql, userId);
        return jsonResponse({
          success: true,
          data: followers
        }, 200, corsHeaders);
      }

      if (path === '/api/follows/following' && method === 'GET') {
        const userId = url.searchParams.get('userId') || '1';
        if (!sql) throw new Error('Database not configured');

        const following = await followsQueries.getFollowing(sql, userId);
        return jsonResponse({
          success: true,
          data: following
        }, 200, corsHeaders);
      }

      // NDA Stats endpoint
      if (path === '/api/nda/stats' && method === 'GET') {
        const userId = url.searchParams.get('userId') || '1';
        if (!sql) throw new Error('Database not configured');

        const stats = await ndaQueries.getNDAStats(sql, userId);
        return jsonResponse({
          success: true,
          data: stats
        }, 200, corsHeaders);
      }

      // Production Dashboard endpoints
      if (path === '/api/production/dashboard' && method === 'GET') {
        const companyId = url.searchParams.get('companyId') || '1';
        if (!sql) throw new Error('Database not configured');

        const [projects, talent, budget] = await Promise.all([
          sql`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'production' THEN 1 ELSE 0 END) as in_production
            FROM production_projects
            WHERE company_id = ${companyId}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM production_talent
            WHERE company_id = ${companyId}
          `,
          sql`
            SELECT COALESCE(SUM(budget), 0) as allocated
            FROM production_projects
            WHERE company_id = ${companyId}
              AND status != 'cancelled'
          `
        ]);

        return jsonResponse({
          success: true,
          data: {
            projects: projects[0],
            talent: talent[0],
            budget: budget[0]
          }
        }, 200, corsHeaders);
      }

      // Default 404 for unmatched routes
      return errorResponse('Endpoint not found', 404, corsHeaders);

    } catch (error) {
      console.error('Worker error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      return errorResponse(message, 500, corsHeaders);
    }
  }
};

// Database health check
async function checkDatabaseHealth(sql: NeonQueryFunction<false, false> | null): Promise<any> {
  if (!sql) {
    return { status: 'not configured' };
  }
  
  try {
    const result = await sql`SELECT NOW() as time`;
    return {
      status: 'connected',
      time: result[0].time
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}