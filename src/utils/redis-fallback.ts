// Redis Fallback Utility - Graceful degradation when Redis is not available
// Provides safe wrappers for Redis operations with in-memory fallbacks

export class RedisWithFallback {
  private memoryCache: Map<string, { value: any; expiresAt?: number }> = new Map();
  private redis: any;
  private redisAvailable: boolean = false;
  private warningsShown: Set<string> = new Set();

  constructor(redisClient: any) {
    this.redis = redisClient;
    this.checkRedisAvailability();
  }

  private checkRedisAvailability(): void {
    this.redisAvailable = !!(
      this.redis && 
      typeof this.redis.get === 'function' &&
      typeof this.redis.set === 'function'
    );
  }

  private showWarningOnce(operation: string): void {
    if (!this.warningsShown.has(operation)) {
      console.log(`⚠️ Redis not available for ${operation}, using in-memory fallback`);
      this.warningsShown.add(operation);
    }
  }

  // Safe get operation with fallback
  async get(key: string): Promise<string | null> {
    try {
      if (this.redisAvailable && this.redis.get) {
        const value = await this.redis.get(key);
        // Only return on a real hit. On a redis MISS (null) fall through to the
        // in-memory cache — a value written there by a set/setex whose redis
        // write threw (write-only outage / read-replica failover) would
        // otherwise be silently inaccessible (read-after-write data loss).
        if (value !== null && value !== undefined) {
          return value;
        }
      }
    } catch (error) {
      this.showWarningOnce('get');
    }

    // Fallback to memory cache
    const cached = this.memoryCache.get(key);
    if (cached) {
      if (!cached.expiresAt || cached.expiresAt > Date.now()) {
        return cached.value;
      }
      this.memoryCache.delete(key);
    }
    return null;
  }

  // Safe set operation with fallback
  async set(key: string, value: string, mode?: string, duration?: number): Promise<void> {
    try {
      if (this.redisAvailable && this.redis.set) {
        if (mode === 'EX' && duration) {
          await this.redis.set(key, value, 'EX', duration);
        } else {
          await this.redis.set(key, value);
        }
        return;
      }
    } catch (error) {
      this.showWarningOnce('set');
    }

    // Fallback to memory cache
    const expiresAt = mode === 'EX' && duration 
      ? Date.now() + (duration * 1000) 
      : undefined;
    
    this.memoryCache.set(key, { value, expiresAt });
  }

  // Safe setex operation with fallback
  async setex(key: string, seconds: number, value: string): Promise<void> {
    try {
      if (this.redisAvailable && this.redis.setex) {
        await this.redis.setex(key, seconds, value);
        return;
      }
    } catch (error) {
      this.showWarningOnce('setex');
    }

    // Fallback to memory cache with expiration
    const expiresAt = Date.now() + (seconds * 1000);
    this.memoryCache.set(key, { value, expiresAt });
  }

  // Safe del operation with fallback
  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    
    try {
      if (this.redisAvailable && this.redis.del) {
        deleted = await this.redis.del(...keys);
      }
    } catch (error) {
      this.showWarningOnce('del');
    }

    // Also delete from memory cache
    for (const key of keys) {
      if (this.memoryCache.delete(key)) {
        deleted++;
      }
    }
    
    return deleted;
  }

  // Safe keys operation with fallback (WARNING: inefficient for large datasets)
  async keys(pattern: string): Promise<string[]> {
    try {
      if (this.redisAvailable && typeof this.redis.keys === 'function') {
        return await this.redis.keys(pattern);
      }
    } catch (error) {
      this.showWarningOnce('keys');
    }

    // Fallback to memory cache pattern matching
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return Array.from(this.memoryCache.keys()).filter(key => regex.test(key));
  }

  // Safe ttl operation with fallback
  async ttl(key: string): Promise<number> {
    try {
      if (this.redisAvailable && this.redis.ttl) {
        return await this.redis.ttl(key);
      }
    } catch (error) {
      this.showWarningOnce('ttl');
    }

    // Fallback to memory cache TTL
    const cached = this.memoryCache.get(key);
    if (cached?.expiresAt) {
      const ttl = Math.floor((cached.expiresAt - Date.now()) / 1000);
      return ttl > 0 ? ttl : -2; // -2 means key doesn't exist
    }
    
    return cached ? -1 : -2; // -1 means no TTL, -2 means key doesn't exist
  }

  // Clear memory cache (useful for testing)
  clearMemoryCache(): void {
    this.memoryCache.clear();
  }

  // Get cache statistics
  getStats(): { 
    redisAvailable: boolean; 
    memoryCacheSize: number; 
    warningsShown: string[] 
  } {
    return {
      redisAvailable: this.redisAvailable,
      memoryCacheSize: this.memoryCache.size,
      warningsShown: Array.from(this.warningsShown),
    };
  }
}

// Helper function to wrap any Redis client
export function wrapRedisClient(redisClient: any): RedisWithFallback {
  return new RedisWithFallback(redisClient);
}

// Singleton instance for shared use
let sharedInstance: RedisWithFallback | null = null;

export function getSharedRedisWithFallback(redisClient?: any): RedisWithFallback {
  if (!sharedInstance && redisClient) {
    sharedInstance = new RedisWithFallback(redisClient);
  }
  
  if (!sharedInstance) {
    // Create a dummy instance with no Redis client
    sharedInstance = new RedisWithFallback(null);
  }
  
  return sharedInstance;
}