/**
 * Read-only stale-cache fallback for discovery surfaces (R8).
 *
 * When a Neon read fails (compute-quota 402, 5xx, cold-start timeout) the
 * marketplace/browse/trending endpoints would otherwise return an error and the
 * marketplace renders silently empty. This helper lets those GET handlers serve
 * the last-good payload — CLEARLY MARKED STALE — instead, protecting discovery
 * liquidity during a DB blip. It is READ-ONLY: only successful 2xx GET payloads
 * are cached, with a short bounded TTL so recovery is never poisoned.
 *
 * Uses the REAL Upstash client (`@upstash/redis/cloudflare`) — NOT the no-op stub
 * in src/lib/redis.ts. Degrades gracefully: if Upstash env vars are absent, every
 * function is a safe no-op and the wrapped handlers behave exactly as before.
 */

import { Redis } from '@upstash/redis/cloudflare';

const KEY_PREFIX = 'rofallback:v1'; // bump v1 to invalidate after a payload-shape change
const DEFAULT_TTL_SECONDS = 300; // 5 min — rides a cold-start/quota blip, short enough not to pin stale

export function getFallbackRedis(env: any): Redis | null {
  const url = env?.UPSTASH_REDIS_REST_URL;
  const token = env?.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('read-fallback-cache: Redis init failed:', e.message);
    return null;
  }
}

// Stable key: endpoint + sorted querystring so identical queries share a slot and
// param order doesn't fragment the cache.
export function cacheKeyFor(endpoint: string, url: URL): string {
  const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const qs = params.map(([k, v]) => `${k}=${v}`).join('&');
  return `${KEY_PREFIX}:${endpoint}:${qs}`;
}

// Best-effort write of the last-good payload. Errors are LOGGED, never swallowed
// silently — a Redis outage must not break the happy path, but it also must not
// pretend success.
export async function writeLastGood(
  env: any,
  key: string,
  payloadString: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const redis = getFallbackRedis(env);
  if (!redis) return;
  try {
    await redis.set(key, payloadString, { ex: ttlSeconds });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('read-fallback-cache: writeLastGood failed:', e.message);
  }
}

export async function readLastGood(env: any, key: string): Promise<string | null> {
  const redis = getFallbackRedis(env);
  if (!redis) return null;
  try {
    const val = await redis.get<string>(key);
    if (val == null) return null;
    // Upstash auto-deserializes JSON; normalize back to a string for re-emit.
    return typeof val === 'string' ? val : JSON.stringify(val);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('read-fallback-cache: readLastGood failed:', e.message);
    return null;
  }
}
