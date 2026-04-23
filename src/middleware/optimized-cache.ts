/**
 * Optimized Cache Middleware with Tiered Caching Strategy
 * Implements multi-level caching for maximum performance
 */

import { getCorsHeaders } from '../utils/response';

export interface OptimizedCacheConfig {
  ttl?: number;
  staleWhileRevalidate?: number;
  key?: string | ((request: Request) => string);
  cacheErrors?: boolean;
  bypassCache?: (request: Request) => boolean;
  tags?: string[];
}

// Cache statistics for monitoring
class CacheStats {
  private static hits = 0;
  private static misses = 0;
  private static errors = 0;
  
  static recordHit() { this.hits++; }
  static recordMiss() { this.misses++; }
  static recordError() { this.errors++; }
  
  static getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0
    };
  }
}

/**
 * Enhanced cache key generation with better distribution
 */
function generateOptimizedCacheKey(request: Request, config: OptimizedCacheConfig): string {
  if (config.key) {
    return typeof config.key === 'function' ? config.key(request) : config.key;
  }
  
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;
  
  // Sort query params for consistent keys
  const sortedParams = Array.from(url.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  
  // Include auth info for user-specific caching
  const authHeader = request.headers.get('Authorization');
  const sessionCookie = request.headers.get('Cookie')?.match(/session=([^;]+)/)?.[1];
  const userKey = authHeader ? 
    authHeader.slice(0, 20) : 
    sessionCookie ? sessionCookie.slice(0, 20) : 'public';
  
  // Include important headers that affect response
  const acceptHeader = request.headers.get('Accept') || 'default';
  const acceptLanguage = request.headers.get('Accept-Language')?.slice(0, 2) || 'en';
  
  return `cache:v2:${method}:${pathname}:${sortedParams}:${userKey}:${acceptHeader}:${acceptLanguage}`;
}

/**
 * Stale-while-revalidate implementation
 */
async function serveStaleWhileRevalidate(
  kv: KVNamespace,
  cacheKey: string,
  handler: () => Promise<Response>,
  ttl: number,
  swr: number
): Promise<Response | null> {
  try {
    const cached = await kv.get(cacheKey, 'text');
    if (!cached) return null;
    
    const cachedData = JSON.parse(cached);
    const age = Date.now() - cachedData.timestamp;
    const maxAge = ttl * 1000;
    const staleAge = swr * 1000;
    
    if (age < maxAge) {
      // Fresh cache
      CacheStats.recordHit();
      return new Response(cachedData.body, {
        status: cachedData.status,
        headers: {
          ...cachedData.headers,
          'X-Cache': 'HIT',
          'X-Cache-Age': String(age),
          'X-Cache-Status': 'fresh'
        }
      });
    } else if (age < maxAge + staleAge) {
      // Serve stale and revalidate in background
      CacheStats.recordHit();
      
      // Trigger background revalidation
      handler().then(async (newResponse) => {
        const body = await newResponse.text();
        const cacheData = {
          body,
          status: newResponse.status,
          headers: Object.fromEntries(newResponse.headers.entries()),
          timestamp: Date.now()
        };
        await kv.put(cacheKey, JSON.stringify(cacheData), {
          expirationTtl: ttl + swr
        });
      }).catch(console.error);
      
      return new Response(cachedData.body, {
        status: cachedData.status,
        headers: {
          ...cachedData.headers,
          'X-Cache': 'HIT',
          'X-Cache-Age': String(age),
          'X-Cache-Status': 'stale'
        }
      });
    }
  } catch (error) {
    console.error('Cache read error:', error);
    CacheStats.recordError();
  }
  
  return null;
}

/**
 * Optimized cache middleware with multiple strategies
 */
export function withOptimizedCache(
  handler: (request: Request, env: any) => Promise<Response>,
  config: OptimizedCacheConfig = {}
) {
  return async function(request: Request, env: any): Promise<Response> {
    // Skip cache for mutations and if bypass condition is met
    if (
      (request.method !== 'GET' && request.method !== 'HEAD') ||
      (config.bypassCache && config.bypassCache(request))
    ) {
      return handler(request, env);
    }
    
    // Try multiple KV namespaces as fallback
    const kv = env.KV || env.CACHE || env.SESSIONS_KV;
    if (!kv) {
      console.error('No KV namespace available for caching');
      return handler(request, env);
    }
    
    const cacheKey = generateOptimizedCacheKey(request, config);
    const ttl = config.ttl || 300; // Default 5 minutes
    const swr = config.staleWhileRevalidate || 60; // Default 1 minute SWR
    
    // Try stale-while-revalidate first
    if (swr > 0) {
      const cachedResponse = await serveStaleWhileRevalidate(
        kv,
        cacheKey,
        () => handler(request, env),
        ttl,
        swr
      );
      if (cachedResponse) return cachedResponse;
    }
    
    // Standard cache check
    try {
      const cached = await kv.get(cacheKey, 'text');
      if (cached) {
        const cachedData = JSON.parse(cached);
        const age = Date.now() - cachedData.timestamp;
        
        if (age < ttl * 1000) {
          CacheStats.recordHit();
          return new Response(cachedData.body, {
            status: cachedData.status,
            headers: {
              ...cachedData.headers,
              'X-Cache': 'HIT',
              'X-Cache-Age': String(age),
              'X-Cache-TTL': String(ttl * 1000 - age)
            }
          });
        }
      }
    } catch (error) {
      console.error('Cache read error:', error);
      CacheStats.recordError();
    }
    
    // Cache miss - execute handler
    CacheStats.recordMiss();
    const startTime = Date.now();
    const response = await handler(request, env);
    const duration = Date.now() - startTime;
    
    // Cache successful responses (or errors if configured)
    if (response.status < 400 || (config.cacheErrors && response.status < 500)) {
      try {
        const body = await response.text();
        
        const cacheData = {
          body,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          timestamp: Date.now()
        };
        
        // Store with extended TTL for SWR
        await kv.put(cacheKey, JSON.stringify(cacheData), {
          expirationTtl: ttl + swr,
          metadata: {
            tags: config.tags || [],
            createdAt: Date.now()
          }
        });
        
        // Return new response with cache headers
        return new Response(body, {
          status: response.status,
          headers: {
            ...response.headers,
            'X-Cache': 'MISS',
            'X-Cache-TTL': String(ttl * 1000),
            'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${swr}`,
            'CDN-Cache-Control': `max-age=${ttl * 2}`,
            'Server-Timing': `cache;desc="MISS", db;dur=${duration}`
          }
        });
      } catch (error) {
        console.error('Cache write error:', error);
        CacheStats.recordError();
        return response;
      }
    }
    
    return response;
  };
}

/**
 * Cache invalidation with tag support
 */
export async function invalidateCacheTags(
  env: any,
  tags: string[]
): Promise<void> {
  const kv = env.KV || env.CACHE;
  if (!kv) return;
  
  // Note: Full tag-based invalidation requires Workers KV metadata API
  // For now, we'll track keys separately
  const tagKeysKey = 'cache:tags:keys';
  
  try {
    const taggedKeys = await kv.get(tagKeysKey, 'json') || {};
    
    for (const tag of tags) {
      const keysToInvalidate = taggedKeys[tag] || [];
      
      await Promise.all(
        keysToInvalidate.map((key: string) => kv.delete(key))
      );
      
      delete taggedKeys[tag];
    }
    
    await kv.put(tagKeysKey, JSON.stringify(taggedKeys));
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Preload cache for critical paths
 */
export async function preloadCache(env: any, paths: string[]): Promise<void> {
  const kv = env.KV || env.CACHE;
  if (!kv) return;
  
  const baseUrl = env.FRONTEND_URL || 'https://pitchey-5o8.pages.dev';
  
  await Promise.all(
    paths.map(async (path) => {
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          cf: {
            cacheTtl: 300,
            cacheEverything: true
          }
        });
        
        if (response.ok) {
          const body = await response.text();
          const cacheKey = `cache:v2:GET:${path}::public:default:en`;
          
          await kv.put(cacheKey, JSON.stringify({
            body,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            timestamp: Date.now()
          }), {
            expirationTtl: 600
          });
        }
      } catch (error) {
        console.error(`Failed to preload ${path}:`, error);
      }
    })
  );
}

/**
 * Export cache statistics for monitoring
 */
export function getCacheStatistics() {
  return CacheStats.getStats();
}

/**
 * Specific cache configurations for different endpoint types
 */
export const OPTIMIZED_CACHE_CONFIGS = {
  // Static content - long cache with SWR
  static: {
    ttl: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 24 hours
    tags: ['static']
  },
  
  // Browse pages - medium cache with short SWR
  browse: {
    ttl: 300, // 5 minutes
    staleWhileRevalidate: 60, // 1 minute
    tags: ['browse', 'pitches']
  },
  
  // User profiles - short cache with SWR
  profile: {
    ttl: 60, // 1 minute
    staleWhileRevalidate: 30, // 30 seconds
    key: (request: Request) => {
      const url = new URL(request.url);
      const userId = url.pathname.split('/').pop();
      return `cache:profile:${userId}`;
    },
    tags: ['profile']
  },
  
  // Dashboard - very short cache
  dashboard: {
    ttl: 30, // 30 seconds
    staleWhileRevalidate: 10, // 10 seconds
    cacheErrors: false,
    tags: ['dashboard']
  },
  
  // Search - cache with query params
  search: {
    ttl: 120, // 2 minutes
    staleWhileRevalidate: 60, // 1 minute
    tags: ['search']
  },
  
  // Real-time data - minimal cache
  realtime: {
    ttl: 5, // 5 seconds
    staleWhileRevalidate: 0, // No SWR for real-time
    cacheErrors: false,
    tags: ['realtime']
  },
  
  // API health checks - no user-specific caching
  health: {
    ttl: 10, // 10 seconds
    key: 'cache:health:check',
    bypassCache: (request: Request) => {
      // Bypass cache if force refresh header is present
      return request.headers.get('X-Force-Refresh') === 'true';
    },
    tags: ['health']
  }
};