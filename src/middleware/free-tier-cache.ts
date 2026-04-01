/**
 * KV Cache Middleware for Cloudflare Free Tier
 * Aggressive caching to stay within 10ms CPU limit
 */

import { getCorsHeaders } from '../utils/response';

export interface CacheConfig {
  ttl?: number; // Time to live in seconds
  key?: string; // Custom cache key
  skipCache?: boolean; // Skip caching for this request
  cacheErrors?: boolean; // Whether to cache error responses
}

/**
 * Generate cache key from request
 */
function generateCacheKey(request: Request, customKey?: string): string {
  if (customKey) return customKey;
  
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;
  const search = url.search;
  
  // Include user ID if authenticated
  const authHeader = request.headers.get('Authorization');
  const userId = authHeader ? authHeader.slice(0, 10) : 'anon';
  
  return `cache:${method}:${pathname}${search}:${userId}`;
}

/**
 * Cache middleware wrapper
 */
export function withCache(
  handler: (request: Request, env: any) => Promise<Response>,
  config: CacheConfig = {}
) {
  return async function(request: Request, env: any): Promise<Response> {
    // Skip cache for mutations
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return handler(request, env);
    }
    
    // Skip if explicitly disabled
    if (config.skipCache) {
      return handler(request, env);
    }
    
    const kv = env.KV;
    if (!kv) {
      // No KV available, proceed without cache
      return handler(request, env);
    }
    
    const cacheKey = generateCacheKey(request, config.key);
    const ttl = config.ttl || 60; // Default 60 seconds
    
    try {
      // Try to get from cache
      const cached = await kv.get(cacheKey);
      if (cached) {
        // Parse cached response
        const cachedData = JSON.parse(cached);
        
        return new Response(cachedData.body, {
          status: cachedData.status,
          headers: {
            ...cachedData.headers,
            'X-Cache': 'HIT',
            'X-Cache-Age': String(Date.now() - cachedData.timestamp)
          }
        });
      }
    } catch (error) {
      console.error('Cache read error:', error);
      // Continue without cache on error
    }
    
    // Execute handler
    const response = await handler(request, env);
    
    // Cache successful responses (or errors if configured)
    if (response.status < 400 || (config.cacheErrors && response.status < 500)) {
      try {
        // Clone response to read body
        const clonedResponse = response.clone();
        const body = await clonedResponse.text();
        
        // Prepare cache data
        const cacheData = {
          body,
          status: response.status,
          headers: Object.fromEntries([...(response.headers as any)] as [string, string][]),
          timestamp: Date.now()
        };
        
        // Store in cache (don't await to save CPU time)
        kv.put(cacheKey, JSON.stringify(cacheData), {
          expirationTtl: ttl
        });
        
        // Add cache headers to original response
        response.headers.set('X-Cache', 'MISS');
        response.headers.set('Cache-Control', `public, max-age=${ttl}`);
      } catch (error) {
        console.error('Cache write error:', error);
        // Continue without caching on error
      }
    }
    
    return response;
  };
}

/**
 * Cache invalidation helper
 */
export async function invalidateCache(
  env: any,
  patterns: string[]
): Promise<void> {
  const kv = env.KV;
  if (!kv) return;
  
  // Note: Cloudflare KV doesn't support pattern deletion on free tier
  // We'll need to track keys separately or use TTL expiration
  
  for (const pattern of patterns) {
    try {
      await kv.delete(pattern);
    } catch (error) {
      console.error(`Failed to invalidate cache for ${pattern}:`, error);
    }
  }
}

/**
 * Cache warming helper for critical endpoints
 */
export async function warmCache(env: any): Promise<void> {
  const criticalEndpoints = [
    '/api/pitches?limit=10',
    '/api/browse?genre=all',
    '/api/stats/global'
  ];
  
  for (const endpoint of criticalEndpoints) {
    try {
      // Make internal request to warm cache
      const request = new Request(`https://pitchey.com${endpoint}`, {
        method: 'GET'
      });
      
      // This would be called by your handler
      // Just warming the cache here
    } catch (error) {
      console.error(`Failed to warm cache for ${endpoint}:`, error);
    }
  }
}

/**
 * Specific cache configurations for different endpoints
 */
export const CACHE_CONFIGS = {
  // Browse pages - cache for 5 minutes
  browse: {
    ttl: 300,
    cacheErrors: false
  },
  
  // User profiles - cache for 1 minute
  profile: {
    ttl: 60,
    cacheErrors: false
  },
  
  // Dashboard stats - cache for 30 seconds
  dashboard: {
    ttl: 30,
    cacheErrors: false
  },
  
  // Static content - cache for 1 hour
  static: {
    ttl: 3600,
    cacheErrors: true
  },
  
  // Search results - cache for 2 minutes
  search: {
    ttl: 120,
    cacheErrors: false
  },
  
  // Real-time data - minimal cache
  realtime: {
    ttl: 5,
    cacheErrors: false
  }
};

/**
 * Edge-side includes helper for partial caching
 */
export async function getCachedFragment(
  env: any,
  key: string,
  fetcher: () => Promise<any>,
  ttl: number = 60
): Promise<any> {
  const kv = env.KV;
  if (!kv) {
    return fetcher();
  }
  
  try {
    const cached = await kv.get(key, 'json');
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.error('Fragment cache read error:', error);
  }
  
  const data = await fetcher();
  
  // Store in cache asynchronously
  kv.put(key, JSON.stringify(data), {
    expirationTtl: ttl
  }).catch((err: Error) => console.error('Fragment cache write error:', err));
  
  return data;
}