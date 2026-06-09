/**
 * Upstash Redis Cache Service for Cloudflare Workers
 *
 * Worker-compatible cache using @upstash/redis (REST-based, no TCP sockets).
 * Gracefully falls back to no-op when credentials are not configured.
 *
 * Why a separate file from cache.service.ts:
 * The existing cache service uses top-level `await initCache()` which is
 * incompatible with Cloudflare Workers module architecture (env only
 * available inside fetch()).
 */

import { Redis } from '@upstash/redis/cloudflare';

export class UpstashCacheService {
  private redis: Redis | null;

  constructor(env: { UPSTASH_REDIS_REST_URL?: string; UPSTASH_REDIS_REST_TOKEN?: string }) {
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      this.redis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });
    } else {
      this.redis = null;
    }
  }

  /** Whether Redis is connected (credentials were provided) */
  get isConnected(): boolean {
    return this.redis !== null;
  }

  /**
   * Get a cached value by key.
   * Returns null on miss or if Redis is not configured.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const value = await this.redis.get<T>(key);
      return value ?? null;
    } catch (err) {
      console.warn(`Redis GET error for key "${key}":`, err);
      return null;
    }
  }

  /**
   * Set a cached value with optional TTL in seconds.
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.redis) return;
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis.set(key, value, { ex: ttlSeconds });
      } else {
        await this.redis.set(key, value);
      }
    } catch (err) {
      console.warn(`Redis SET error for key "${key}":`, err);
    }
  }

  /**
   * Delete one or more keys.
   */
  async del(...keys: string[]): Promise<void> {
    if (!this.redis || keys.length === 0) return;
    try {
      await this.redis.del(...keys);
    } catch (err) {
      console.warn(`Redis DEL error:`, err);
    }
  }

  /**
   * Delete every key matching a prefix (e.g. "browse:pitches:"). Uses SCAN so a
   * single publish/overwrite can invalidate all cached permutations without
   * enumerating them by hand. Returns the number of keys deleted; no-op (0) if
   * Redis isn't configured. Best-effort — failures are logged, not thrown.
   */
  async delByPrefix(prefix: string): Promise<number> {
    if (!this.redis) return 0;
    try {
      let cursor = '0';
      const toDelete: string[] = [];
      do {
        const [next, keys] = await this.redis.scan(cursor, { match: `${prefix}*`, count: 200 });
        cursor = String(next);
        if (keys.length) toDelete.push(...keys);
      } while (cursor !== '0');
      if (toDelete.length) await this.redis.del(...toDelete);
      return toDelete.length;
    } catch (err) {
      console.warn(`Redis SCAN/DEL error for prefix "${prefix}":`, err);
      return 0;
    }
  }

  /**
   * Increment a counter (useful for rate limiting).
   * Returns the new value, or -1 on failure.
   */
  async incr(key: string): Promise<number> {
    if (!this.redis) return -1;
    try {
      return await this.redis.incr(key);
    } catch (err) {
      console.warn(`Redis INCR error for key "${key}":`, err);
      return -1;
    }
  }

  /**
   * Set expiry on an existing key.
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.expire(key, ttlSeconds);
    } catch (err) {
      console.warn(`Redis EXPIRE error for key "${key}":`, err);
    }
  }

  /**
   * Get-or-set pattern: returns cached value if exists, otherwise calls
   * factory function, caches the result, and returns it.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
