/**
 * Optimized Edge Cache V2 - Fixes for 0% hit rate issue
 * Addresses key generation, storage consistency, and cache warming
 */

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
  totalRequests: number;
}

export class EdgeCacheV2 {
  private kv: KVNamespace;
  private prefix: string;
  private debug: boolean;
  private stats = {
    hits: 0,
    misses: 0,
    errors: 0
  };

  constructor(kv: KVNamespace | undefined, prefix: string = 'pitchey-cache', debug: boolean = true) {
    if (!kv) {
      throw new Error('EdgeCacheV2: KV namespace is required');
    }
    
    this.kv = kv;
    this.prefix = prefix;
    this.debug = debug;
    
    if (this.debug) {
      console.log(`EdgeCacheV2 initialized with prefix: ${prefix}`);
    }
  }

  /**
   * Generate consistent cache key with proper normalization
   */
  private generateKey(endpoint: string, params?: Record<string, any>): string {
    // Normalize endpoint path
    let normalizedEndpoint = endpoint;
    
    // Remove /api prefix if present
    if (normalizedEndpoint.startsWith('/api/')) {
      normalizedEndpoint = normalizedEndpoint.substring(5);
    } else if (normalizedEndpoint.startsWith('api/')) {
      normalizedEndpoint = normalizedEndpoint.substring(4);
    }
    
    // Remove leading slash
    if (normalizedEndpoint.startsWith('/')) {
      normalizedEndpoint = normalizedEndpoint.substring(1);
    }

    // Build base key
    let key = `${this.prefix}:${normalizedEndpoint}`;
    
    // Add sorted params if present
    if (params && Object.keys(params).length > 0) {
      const sortedParams = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null && value !== '')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join('&');
      
      if (sortedParams) {
        key += `:${sortedParams}`;
      }
    }
    
    if (this.debug) {
      console.log(`Cache key generated: ${key} (from: ${endpoint}, params: ${JSON.stringify(params)})`);
    }
    
    return key;
  }

  /**
   * Get cached value with proper type handling
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T | null> {
    const startTime = Date.now();
    const key = this.generateKey(endpoint, params);
    
    try {
      // Get raw value from KV
      const rawValue = await this.kv.get(key);
      const duration = Date.now() - startTime;
      
      if (rawValue === null) {
        this.stats.misses++;
        if (this.debug) {
          console.log(`Cache MISS: ${key} (${duration}ms) - Hit rate: ${this.getHitRatePercent()}%`);
        }
        return null;
      }

      // Parse the cached entry
      const cached: CacheEntry = JSON.parse(rawValue);
      
      // Check if cache has expired (additional safety check)
      const now = Date.now();
      const age = Math.floor((now - cached.timestamp) / 1000);
      
      if (age > cached.ttl) {
        this.stats.misses++;
        if (this.debug) {
          console.log(`Cache EXPIRED: ${key} (age: ${age}s, ttl: ${cached.ttl}s) - Hit rate: ${this.getHitRatePercent()}%`);
        }
        // Clean up expired entry
        // fire-and-forget
        this.kv.delete(key).catch(() => {});
        return null;
      }
      
      this.stats.hits++;
      if (this.debug) {
        console.log(`Cache HIT: ${key} (${duration}ms, age: ${age}s) - Hit rate: ${this.getHitRatePercent()}%`);
      }
      
      return cached.data as T;
      
    } catch (error) {
      this.stats.errors++;
      if (this.debug) {
        console.error(`Cache GET error for ${key}:`, error);
      }
      return null;
    }
  }

  /**
   * Set cache value with proper structure
   */
  async set<T>(endpoint: string, data: T, ttlSeconds: number = 300, params?: Record<string, any>): Promise<boolean> {
    const startTime = Date.now();
    const key = this.generateKey(endpoint, params);
    
    try {
      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
        ttl: ttlSeconds,
        key: endpoint
      };
      
      // Store as JSON string with KV TTL
      await this.kv.put(key, JSON.stringify(entry), {
        expirationTtl: ttlSeconds
      });
      
      const duration = Date.now() - startTime;
      if (this.debug) {
        console.log(`Cache SET: ${key} (TTL: ${ttlSeconds}s, Duration: ${duration}ms, Size: ${JSON.stringify(entry).length} bytes)`);
      }
      
      return true;
      
    } catch (error) {
      this.stats.errors++;
      if (this.debug) {
        console.error(`Cache SET error for ${key}:`, error);
      }
      return false;
    }
  }

  /**
   * Delete cache entry
   */
  async delete(endpoint: string, params?: Record<string, any>): Promise<boolean> {
    const key = this.generateKey(endpoint, params);
    
    try {
      await this.kv.delete(key);
      if (this.debug) {
        console.log(`Cache DELETE: ${key}`);
      }
      return true;
      
    } catch (error) {
      if (this.debug) {
        console.error(`Cache DELETE error for ${key}:`, error);
      }
      return false;
    }
  }

  /**
   * Cache function result with retry logic
   */
  async cached<T>(
    endpoint: string,
    fn: () => Promise<T>,
    ttlSeconds: number = 300,
    params?: Record<string, any>
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(endpoint, params);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    try {
      const result = await fn();
      
      // Only cache successful results
      if (result !== null && result !== undefined) {
        await this.set(endpoint, result, ttlSeconds, params);
      }
      
      return result;
      
    } catch (error) {
      if (this.debug) {
        console.error(`Error executing cached function for ${endpoint}:`, error);
      }
      throw error;
    }
  }

  /**
   * Invalidate cache patterns (limited implementation for KV)
   */
  async invalidatePattern(pattern: string): Promise<number> {
    if (this.debug) {
      console.log(`Cache invalidation requested for pattern: ${pattern}`);
    }
    
    // Since KV doesn't support wildcards, we maintain common cache keys
    const commonKeys = [
      'pitches/browse/enhanced',
      'pitches/browse/general', 
      'pitches/trending',
      'pitches/new',
      'dashboard/stats',
      'dashboard/metrics',
      'content/homepage',
      'user/notifications'
    ];

    let invalidated = 0;
    
    for (const key of commonKeys) {
      if (key.includes(pattern)) {
        const success = await this.delete(key);
        if (success) invalidated++;
      }
    }
    
    if (this.debug) {
      console.log(`Invalidated ${invalidated} cache entries for pattern: ${pattern}`);
    }
    
    return invalidated;
  }

  /**
   * Warm cache with multiple entries
   */
  async warmCache(items: Array<{
    endpoint: string;
    data: any;
    ttl?: number;
    params?: Record<string, any>;
  }>): Promise<{ success: number; failed: number }> {
    if (this.debug) {
      console.log(`Warming cache with ${items.length} items...`);
    }
    
    const results = await Promise.allSettled(
      items.map(async item => {
        const success = await this.set(
          item.endpoint, 
          item.data, 
          item.ttl || 300, 
          item.params
        );
        if (!success) {
          throw new Error(`Failed to cache ${item.endpoint}`);
        }
        return success;
      })
    );
    
    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    if (this.debug) {
      console.log(`Cache warming complete: ${success} success, ${failed} failed`);
    }
    
    return { success, failed };
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      errors: this.stats.errors,
      hitRate: Math.round(hitRate * 100) / 100,
      totalRequests
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, errors: 0 };
    if (this.debug) {
      console.log('Cache statistics reset');
    }
  }

  /**
   * Get hit rate as percentage string
   */
  private getHitRatePercent(): string {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return '0.0';
    return ((this.stats.hits / total) * 100).toFixed(1);
  }
}

/**
 * Singleton cache instance for global use
 */
let globalCacheInstance: EdgeCacheV2 | null = null;

export function initializeGlobalCache(kv: KVNamespace): EdgeCacheV2 {
  if (!globalCacheInstance) {
    globalCacheInstance = new EdgeCacheV2(kv, 'pitchey-cache', true);
  }
  return globalCacheInstance;
}

export function getGlobalCache(): EdgeCacheV2 | null {
  return globalCacheInstance;
}