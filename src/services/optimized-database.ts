/**
 * Optimized Database Service with Query Batching and Intelligent Caching
 * Reduces database load and improves response times
 */

import { neon, Pool } from '@neondatabase/serverless';

// Query result cache with TTL
interface CachedResult {
  data: any;
  timestamp: number;
  ttl: number;
}

// Batch query request
interface BatchRequest {
  query: string;
  params: any[];
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class OptimizedDatabaseService {
  private sql: ReturnType<typeof neon>;
  private queryCache: Map<string, CachedResult> = new Map();
  private batchQueue: BatchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private metrics = {
    queries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    batchedQueries: 0,
    avgQueryTime: 0,
    slowQueries: [] as { query: string; duration: number }[]
  };
  
  constructor(databaseUrl: string) {
    // Initialize with optimized settings
    this.sql = neon(databaseUrl, {
      fetchConnectionCache: true,
      fetchOptions: {
        priority: 'high',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }
    });
    
    // Clean up cache periodically
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }
  
  /**
   * Execute query with caching and metrics
   */
  async query<T = any>(
    query: string,
    params: any[] = [],
    options: { ttl?: number; skipCache?: boolean } = {}
  ): Promise<T[]> {
    const { ttl = 60, skipCache = false } = options;
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(query, params);
    
    // Check cache first
    if (!skipCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }
      this.metrics.cacheMisses++;
    }
    
    // Execute query with timing
    const startTime = Date.now();
    this.metrics.queries++;
    
    try {
      const result = await this.sql(query, params);
      const duration = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(query, duration);
      
      // Cache result if successful
      if (!skipCache && result) {
        this.setCache(cacheKey, result, ttl);
      }
      
      return result as T[];
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }
  
  /**
   * Batch multiple queries for efficiency
   */
  async batchQuery(query: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ query, params, resolve, reject });
      
      // Process batch after a short delay to collect more queries
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.processBatch(), 10);
      }
    });
  }
  
  /**
   * Process batched queries
   */
  private async processBatch(): Promise<void> {
    const batch = [...this.batchQueue];
    this.batchQueue = [];
    this.batchTimer = null;
    
    if (batch.length === 0) return;
    
    this.metrics.batchedQueries += batch.length;
    
    // Group similar queries
    const grouped = this.groupQueries(batch);
    
    // Execute grouped queries in parallel
    await Promise.all(
      Array.from(grouped.entries()).map(async ([key, requests]) => {
        try {
          // For identical queries, execute once and share result
          if (requests.every(r => JSON.stringify(r.params) === JSON.stringify(requests[0].params))) {
            const result = await this.query(requests[0].query, requests[0].params);
            requests.forEach(r => r.resolve(result));
          } else {
            // Execute different param queries in parallel
            await Promise.all(
              requests.map(async (r) => {
                try {
                  const result = await this.query(r.query, r.params);
                  r.resolve(result);
                } catch (error) {
                  r.reject(error);
                }
              })
            );
          }
        } catch (error) {
          requests.forEach(r => r.reject(error));
        }
      })
    );
  }
  
  /**
   * Group similar queries for batching
   */
  private groupQueries(batch: BatchRequest[]): Map<string, BatchRequest[]> {
    const grouped = new Map<string, BatchRequest[]>();
    
    batch.forEach(request => {
      const key = request.query;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(request);
    });
    
    return grouped;
  }
  
  /**
   * Optimized queries for common operations
   */
  
  async getCreatorDashboard(userId: string): Promise<any> {
    // Single optimized query instead of multiple
    const query = `
      WITH creator_stats AS (
        SELECT 
          COUNT(DISTINCT p.id) as total_pitches,
          COALESCE(SUM(p.view_count), 0) as total_views,
          COUNT(DISTINCT CASE WHEN p.status = 'draft' THEN p.id END) as draft_count,
          COUNT(DISTINCT CASE WHEN p.status = 'published' THEN p.id END) as published_count
        FROM pitches p
        WHERE p.creator_id = $1
      ),
      nda_stats AS (
        SELECT 
          COUNT(*) as pending_ndas
        FROM ndas n
        INNER JOIN pitches p ON n.pitch_id = p.id
        WHERE p.creator_id = $1 AND n.status = 'pending'
      ),
      recent_activity AS (
        SELECT 
          json_agg(json_build_object(
            'type', 'view',
            'pitch_id', p.id,
            'pitch_title', p.title,
            'timestamp', pv.viewed_at,
            'viewer_name', u.name
          ) ORDER BY pv.viewed_at DESC) as recent_views
        FROM pitch_views pv
        INNER JOIN pitches p ON pv.pitch_id = p.id
        INNER JOIN users u ON pv.viewer_id = u.id
        WHERE p.creator_id = $1
        AND pv.viewed_at > NOW() - INTERVAL '7 days'
        LIMIT 10
      )
      SELECT 
        cs.*,
        ns.pending_ndas,
        COALESCE(ra.recent_views, '[]'::json) as recent_activity
      FROM creator_stats cs
      CROSS JOIN nda_stats ns
      CROSS JOIN recent_activity ra
    `;
    
    const result = await this.query(query, [userId], { ttl: 30 });
    return result[0] || this.getEmptyCreatorStats();
  }
  
  async getInvestorDashboard(userId: string): Promise<any> {
    const query = `
      WITH investor_stats AS (
        SELECT 
          COUNT(DISTINCT sp.pitch_id) as saved_pitches,
          COUNT(DISTINCT i.id) as total_investments,
          COALESCE(SUM(i.amount), 0) as total_invested,
          COUNT(DISTINCT f.following_id) as following_count
        FROM users u
        LEFT JOIN saved_pitches sp ON sp.user_id = u.id
        LEFT JOIN investments i ON i.investor_id = u.id
        LEFT JOIN follows f ON f.follower_id = u.id
        WHERE u.id = $1
      ),
      portfolio_performance AS (
        SELECT 
          json_agg(json_build_object(
            'pitch_id', p.id,
            'pitch_title', p.title,
            'investment_amount', i.amount,
            'investment_date', i.created_at,
            'current_status', p.status,
            'roi_estimate', 
              CASE 
                WHEN p.funding_raised > 0 
                THEN ((p.funding_raised - p.funding_goal) / p.funding_goal * 100)
                ELSE 0 
              END
          ) ORDER BY i.created_at DESC) as portfolio
        FROM investments i
        INNER JOIN pitches p ON i.pitch_id = p.id
        WHERE i.investor_id = $1
        LIMIT 20
      )
      SELECT 
        ins.*,
        COALESCE(pp.portfolio, '[]'::json) as portfolio
      FROM investor_stats ins
      CROSS JOIN portfolio_performance pp
    `;
    
    const result = await this.query(query, [userId], { ttl: 60 });
    return result[0] || this.getEmptyInvestorStats();
  }
  
  async getBrowsePitches(params: {
    limit?: number;
    offset?: number;
    genre?: string;
    sort?: string;
    search?: string;
  }): Promise<any[]> {
    const { 
      limit = 10, 
      offset = 0, 
      genre = null, 
      sort = 'newest',
      search = null 
    } = params;
    
    // Build dynamic query with proper indexes
    let query = `
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.status,
        p.created_at,
        p.view_count,
        p.funding_goal,
        p.funding_raised,
        u.name as creator_name,
        u.avatar_url as creator_avatar,
        COUNT(DISTINCT sp.user_id) as save_count,
        COUNT(DISTINCT n.id) as nda_count,
        AVG(r.rating) as avg_rating
      FROM pitches p
      INNER JOIN users u ON p.creator_id = u.id
      LEFT JOIN saved_pitches sp ON sp.pitch_id = p.id
      LEFT JOIN ndas n ON n.pitch_id = p.id
      LEFT JOIN ratings r ON r.pitch_id = p.id
      WHERE p.status = 'published'
    `;
    
    const queryParams: any[] = [];
    let paramCount = 1;
    
    if (genre && genre !== 'all') {
      query += ` AND p.genre = $${paramCount}`;
      queryParams.push(genre);
      paramCount++;
    }
    
    if (search) {
      query += ` AND (p.title ILIKE $${paramCount} OR p.logline ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
      paramCount++;
    }
    
    query += ` GROUP BY p.id, u.name, u.avatar_url`;
    
    // Add sorting
    switch (sort) {
      case 'trending':
        query += ` ORDER BY p.view_count DESC, save_count DESC`;
        break;
      case 'popular':
        query += ` ORDER BY save_count DESC, avg_rating DESC NULLS LAST`;
        break;
      case 'funding':
        query += ` ORDER BY p.funding_raised DESC`;
        break;
      default:
        query += ` ORDER BY p.created_at DESC`;
    }
    
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit, offset);
    
    return this.query(query, queryParams, { ttl: 120 });
  }
  
  /**
   * Optimized search with full-text search
   */
  async searchPitches(searchTerm: string, limit = 20): Promise<any[]> {
    const query = `
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.created_at,
        u.name as creator_name,
        ts_rank(
          to_tsvector('english', p.title || ' ' || p.logline || ' ' || COALESCE(p.synopsis, '')),
          plainto_tsquery('english', $1)
        ) as relevance
      FROM pitches p
      INNER JOIN users u ON p.creator_id = u.id
      WHERE p.status = 'published'
      AND to_tsvector('english', p.title || ' ' || p.logline || ' ' || COALESCE(p.synopsis, ''))
        @@ plainto_tsquery('english', $1)
      ORDER BY relevance DESC
      LIMIT $2
    `;
    
    return this.query(query, [searchTerm, limit], { ttl: 180 });
  }
  
  /**
   * Cache management
   */
  
  private generateCacheKey(query: string, params: any[]): string {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const paramsKey = JSON.stringify(params);
    return `${normalizedQuery}::${paramsKey}`;
  }
  
  private getFromCache(key: string): any | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > cached.ttl * 1000) {
      this.queryCache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  private setCache(key: string, data: any, ttl: number): void {
    // Limit cache size to prevent memory issues
    if (this.queryCache.size > 1000) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > value.ttl * 1000) {
        this.queryCache.delete(key);
      }
    }
  }
  
  /**
   * Metrics and monitoring
   */
  
  private updateMetrics(query: string, duration: number): void {
    // Update average query time
    this.metrics.avgQueryTime = 
      (this.metrics.avgQueryTime * (this.metrics.queries - 1) + duration) / 
      this.metrics.queries;
    
    // Track slow queries
    if (duration > 100) {
      this.metrics.slowQueries.push({
        query: query.substring(0, 100),
        duration
      });
      
      // Keep only last 10 slow queries
      if (this.metrics.slowQueries.length > 10) {
        this.metrics.slowQueries.shift();
      }
      
      console.warn(`Slow query (${duration}ms):`, query.substring(0, 200));
    }
  }
  
  getMetrics() {
    const cacheHitRate = this.metrics.cacheHits / 
      (this.metrics.cacheHits + this.metrics.cacheMisses) * 100 || 0;
    
    return {
      ...this.metrics,
      cacheHitRate,
      cacheSize: this.queryCache.size
    };
  }
  
  /**
   * Helper methods for empty states
   */
  
  private getEmptyCreatorStats() {
    return {
      total_pitches: 0,
      total_views: 0,
      draft_count: 0,
      published_count: 0,
      pending_ndas: 0,
      recent_activity: []
    };
  }
  
  private getEmptyInvestorStats() {
    return {
      saved_pitches: 0,
      total_investments: 0,
      total_invested: 0,
      following_count: 0,
      portfolio: []
    };
  }
  
  /**
   * Connection pool management for high-traffic scenarios
   */
  async withTransaction<T>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    const client = await this.sql('BEGIN');
    
    try {
      const result = await callback(client);
      await this.sql('COMMIT');
      return result;
    } catch (error) {
      await this.sql('ROLLBACK');
      throw error;
    }
  }
  
  /**
   * Prepared statements for frequently used queries
   */
  private preparedStatements = new Map<string, string>();
  
  prepareFequentQueries(): void {
    this.preparedStatements.set('getUserById', `
      SELECT id, email, name, user_type, created_at
      FROM users WHERE id = $1 LIMIT 1
    `);
    
    this.preparedStatements.set('getSessionByToken', `
      SELECT s.*, u.id as user_id, u.email, u.name, u.user_type
      FROM sessions s
      INNER JOIN users u ON s.user_id = u.id
      WHERE s.token = $1 AND s.expires_at > NOW()
      LIMIT 1
    `);
    
    this.preparedStatements.set('updateLastSeen', `
      UPDATE users SET last_seen = NOW() WHERE id = $1
    `);
  }
  
  async executePrepared(name: string, params: any[]): Promise<any> {
    const query = this.preparedStatements.get(name);
    if (!query) {
      throw new Error(`Prepared statement ${name} not found`);
    }
    return this.query(query, params);
  }
}