/**
 * Database Connection Helper for Cloudflare Workers Free Tier
 * Uses Neon PostgreSQL with HTTP connection
 */

import { neon } from '@neondatabase/serverless';

export interface Env {
  DATABASE_URL: string;
  JWT_SECRET?: string;
  SESSIONS_KV?: KVNamespace;
  KV?: KVNamespace;
  [key: string]: any;
}

// Transient infra errors worth retrying — Neon cold-start / Cloudflare origin
// drops. "Network connection lost." (seen 6×/24h in prod) matches /connection/i;
// HTTP 5xx / error code 1016 are the cold-start origin-DNS family. Real SQL
// errors (checked first) come back as 4xx with these messages and are NOT retried.
const RETRYABLE_DB = [
  /HTTP status 5\d\d/i, /error code: 1016/, /fetch failed/i,
  /network/i, /connection/i, /timeout/i, /socket/i,
  /ECONNRESET/, /ECONNREFUSED/, /ENOTFOUND/,
];
const NON_RETRYABLE_DB = [
  /syntax error/i, /does not exist/i, /duplicate key/i, /violates/i,
  /invalid input/i, /permission denied/i, /not-null/i,
];
function isRetryableDbError(e: unknown): boolean {
  const m = (e instanceof Error ? e.message : String(e)) || '';
  if (NON_RETRYABLE_DB.some((r) => r.test(m))) return false;
  return RETRYABLE_DB.some((r) => r.test(m));
}
async function withDbRetry<T>(op: () => Promise<T>, max = 3, delayMs = 1000): Promise<T> {
  let last: unknown;
  for (let i = 0; i < max; i++) {
    try {
      return await op();
    } catch (e) {
      last = e;
      if (!isRetryableDbError(e) || i === max - 1) throw e;
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
  throw last;
}

// Wrap the raw neon client so tagged-template queries (sql`...`) and .query()
// retry transient infra failures — the getDb() equivalent of the getSql() Proxy
// in worker-database.ts (Cloud-1). .unsafe/.transaction pass through untouched.
function wrapWithRetry(raw: any) {
  return new Proxy(raw, {
    apply(target, thisArg, args) {
      return withDbRetry(() => Reflect.apply(target, thisArg, args));
    },
    get(target, prop, receiver) {
      if (prop === 'query') {
        return (text: string, params?: unknown[]) => withDbRetry(() => target.query(text, params));
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Get database connection with proper error handling. The returned client retries
 * transient Neon/Cloudflare connection drops (see wrapWithRetry / Cloud-1).
 */
export function getDb(env: Env) {
  if (!env.DATABASE_URL) {
    // Debug-level: this fires on non-DB code paths and is expected behavior
    console.debug('DATABASE_URL not configured — skipping DB connection');
    return null;
  }

  try {
    // Use HTTP connection for Cloudflare Workers free tier
    return wrapWithRetry(neon(env.DATABASE_URL));
  } catch (error) {
    console.error('Database connection error:', error);
    return null;
  }
}

/**
 * Safe database query wrapper
 */
export async function safeQuery<T = any>(
  sql: ReturnType<typeof neon> | null,
  query: any,
  defaultValue: T
): Promise<T> {
  if (!sql) {
    return defaultValue;
  }
  
  try {
    const result = await query(sql);
    return result || defaultValue;
  } catch (error) {
    console.error('Query error:', error);
    return defaultValue;
  }
}