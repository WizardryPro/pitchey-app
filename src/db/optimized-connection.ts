/**
 * Optimized Database Connection for Cloudflare Free Tier
 * Designed for 10ms CPU limit with aggressive caching
 */

import { neon } from '@neondatabase/serverless';

// Cache connections at module level to avoid re-initialization
const connectionCache = new Map<string, ReturnType<typeof neon>>();

export interface OptimizedDbConfig {
  DATABASE_URL: string;
  maxQueryTime?: number; // Default 5000ms
  enableCache?: boolean;
}

/**
 * Get or create a cached database connection
 */
export function getOptimizedConnection(config: OptimizedDbConfig) {
  const { DATABASE_URL, maxQueryTime = 5000 } = config;

  if (!connectionCache.has(DATABASE_URL)) {
    const sql = neon(DATABASE_URL, {
      fetchOptions: {
        signal: AbortSignal.timeout(maxQueryTime)
      }
    } as Parameters<typeof neon>[1]);
    connectionCache.set(DATABASE_URL, sql);
  }

  return connectionCache.get(DATABASE_URL)!;
}

// Helper to safely get array from Neon query result
function toArray<T>(result: any): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  return [];
}

/**
 * Optimized queries for common operations
 * All queries are designed to use indexes and minimize CPU time
 */
export class OptimizedQueries {
  private sql: ReturnType<typeof neon>;
  private kv?: KVNamespace;

  constructor(config: OptimizedDbConfig, kv?: KVNamespace) {
    this.sql = getOptimizedConnection(config);
    this.kv = kv;
  }

  /**
   * Get user by ID with caching
   */
  async getUserById(userId: string): Promise<any> {
    const cacheKey = `user:${userId}`;
    
    // Try cache first
    if (this.kv) {
      const cached = await this.kv.get(cacheKey, 'json');
      if (cached) return cached;
    }

    // Simple indexed query
    const result = await this.sql`
      SELECT id, email, name, role, created_at
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    const rows = toArray<Record<string, unknown>>(result);
    const user = rows[0];
    
    // Cache for 5 minutes
    if (this.kv && user) {
      await this.kv.put(cacheKey, JSON.stringify(user), {
        expirationTtl: 300
      });
    }

    return user;
  }

  /**
   * Get pitches with pagination (optimized for browse)
   */
  async getPitches(limit = 10, offset = 0, genre?: string): Promise<any[]> {
    const cacheKey = `pitches:${limit}:${offset}:${genre || 'all'}`;

    // Try cache first
    if (this.kv) {
      const cached = await this.kv.get(cacheKey, 'json');
      if (cached) return cached as any[];
    }

    // Optimized query with proper indexes
    let query;
    if (genre && genre !== 'all') {
      query = this.sql`
        SELECT id, title, logline, genre, status, created_at, view_count
        FROM pitches 
        WHERE status = 'published' 
        AND genre = ${genre}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = this.sql`
        SELECT id, title, logline, genre, status, created_at, view_count
        FROM pitches 
        WHERE status = 'published'
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const result = await query;
    const pitches = toArray<Record<string, unknown>>(result);

    // Cache for 1 minute
    if (this.kv && pitches.length > 0) {
      await this.kv.put(cacheKey, JSON.stringify(pitches), {
        expirationTtl: 60
      });
    }

    return pitches;
  }

  /**
   * Creator dashboard stats (heavily cached)
   */
  async getCreatorStats(userId: string): Promise<any> {
    const cacheKey = `stats:creator:${userId}`;
    
    // Try cache first (30 second cache for stats)
    if (this.kv) {
      const cached = await this.kv.get(cacheKey, 'json');
      if (cached) return cached;
    }

    // Run queries in parallel for efficiency
    const [pitchCountResult, totalViewsResult, ndaCountResult] = await Promise.all([
      this.sql`
        SELECT COUNT(*) as count
        FROM pitches
        WHERE creator_id = ${userId}
      `,
      this.sql`
        SELECT COALESCE(SUM(view_count), 0) as total
        FROM pitches
        WHERE creator_id = ${userId}
      `,
      this.sql`
        SELECT COUNT(*) as count
        FROM ndas
        WHERE pitch_id IN (
          SELECT id FROM pitches WHERE creator_id = ${userId}
        ) AND status = 'pending'
      `
    ]);

    const pitchCount = toArray<Record<string, unknown>>(pitchCountResult);
    const totalViews = toArray<Record<string, unknown>>(totalViewsResult);
    const ndaCount = toArray<Record<string, unknown>>(ndaCountResult);

    const stats = {
      totalPitches: pitchCount[0]?.count || 0,
      totalViews: totalViews[0]?.total || 0,
      pendingNDAs: ndaCount[0]?.count || 0
    };

    // Cache for 30 seconds
    if (this.kv) {
      await this.kv.put(cacheKey, JSON.stringify(stats), {
        expirationTtl: 30
      });
    }

    return stats;
  }

  /**
   * Investor dashboard stats
   */
  async getInvestorStats(userId: string): Promise<any> {
    const cacheKey = `stats:investor:${userId}`;
    
    if (this.kv) {
      const cached = await this.kv.get(cacheKey, 'json');
      if (cached) return cached;
    }

    const [savedCountResult, investmentCountResult, followingCountResult] = await Promise.all([
      this.sql`
        SELECT COUNT(*) as count
        FROM saved_pitches
        WHERE user_id = ${userId}
      `,
      this.sql`
        SELECT COUNT(*) as count
        FROM investments
        WHERE investor_id = ${userId}
      `,
      this.sql`
        SELECT COUNT(*) as count
        FROM follows
        WHERE follower_id = ${userId}
      `
    ]);

    const savedCount = toArray<Record<string, unknown>>(savedCountResult);
    const investmentCount = toArray<Record<string, unknown>>(investmentCountResult);
    const followingCount = toArray<Record<string, unknown>>(followingCountResult);

    const stats = {
      savedPitches: savedCount[0]?.count || 0,
      totalInvestments: investmentCount[0]?.count || 0,
      followingCount: followingCount[0]?.count || 0
    };

    if (this.kv) {
      await this.kv.put(cacheKey, JSON.stringify(stats), {
        expirationTtl: 30
      });
    }

    return stats;
  }

  /**
   * Production company dashboard stats
   */
  async getProductionStats(userId: string): Promise<any> {
    const cacheKey = `stats:production:${userId}`;
    
    if (this.kv) {
      const cached = await this.kv.get(cacheKey, 'json');
      if (cached) return cached;
    }

    const [projectCountResult, ndaCountResult, partnershipCountResult] = await Promise.all([
      this.sql`
        SELECT COUNT(*) as count
        FROM production_projects
        WHERE company_id = ${userId}
        AND status = 'active'
      `,
      this.sql`
        SELECT COUNT(*) as count
        FROM ndas
        WHERE user_id = ${userId}
        AND status = 'active'
      `,
      this.sql`
        SELECT COUNT(*) as count
        FROM partnerships
        WHERE production_id = ${userId}
        AND status = 'active'
      `
    ]);

    const projectCount = toArray<Record<string, unknown>>(projectCountResult);
    const ndaCount = toArray<Record<string, unknown>>(ndaCountResult);
    const partnershipCount = toArray<Record<string, unknown>>(partnershipCountResult);

    const stats = {
      activeProjects: projectCount[0]?.count || 0,
      activeNDAs: ndaCount[0]?.count || 0,
      partnerships: partnershipCount[0]?.count || 0
    };

    if (this.kv) {
      await this.kv.put(cacheKey, JSON.stringify(stats), {
        expirationTtl: 30
      });
    }

    return stats;
  }

  /**
   * Quick authentication check (minimal CPU usage)
   */
  async validateSession(sessionId: string): Promise<any> {
    const cacheKey = `session:${sessionId}`;
    
    // Session cache is critical for performance
    if (this.kv) {
      const cached = await this.kv.get(cacheKey, 'json');
      if (cached) return cached;
    }

    const result = await this.sql`
      SELECT s.id, s.user_id, s.expires_at, u.role, u.email, u.name
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ${sessionId}
      AND s.expires_at > NOW()
      LIMIT 1
    `;

    const rows = toArray<Record<string, unknown>>(result);
    const session = rows[0];
    
    // Cache valid sessions for 60 seconds
    if (this.kv && session) {
      await this.kv.put(cacheKey, JSON.stringify(session), {
        expirationTtl: 60
      });
    }

    return session;
  }
}