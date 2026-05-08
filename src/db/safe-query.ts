/**
 * safeQuery — semantic-split wrapper for raw SQL calls.
 *
 * The problem it solves: the codebase is full of `.catch(() => [])` and
 * `.catch(() => [{ total: 0 }])` patterns on `sql\`...\`` tagged templates.
 * Those collapse two distinct outcomes — "query succeeded, returned empty"
 * and "query threw, we have no idea what happened" — into the same shape.
 *
 * The consumption-gate bug (2026-04-17) was the canonical case: a sum returning
 * 0 because rows existed but view_duration was NULL was indistinguishable
 * from a sum returning 0 because the query exploded on a missing column.
 *
 * Contract:
 *   const result = await safeQuery(() => sql`SELECT ...`, {
 *     fallback: [],
 *     context: 'creator-dashboard.investment-trends',
 *     sentry: env.SENTRY_CAPTURE,   // optional
 *   });
 *
 *   if (!result.ok) {
 *     // query errored — decide explicitly: fail the request, gate close, etc.
 *     // do NOT treat as "no data"
 *   }
 *   const rows = result.rows;  // always safe to read — fallback if errored
 *
 * Rule of thumb:
 *   - Dashboards / non-critical reads: `if (!result.ok) return fallback view`
 *   - Gates / access checks / consumption caps: `if (!result.ok) refuse`
 *   - Counters / metrics: `if (!result.ok) skip, don't zero`
 */

import * as Sentry from '@sentry/cloudflare';

export type QueryResult<T> =
  | { ok: true;  rows: T[]; errored: false }
  | { ok: false; rows: T[]; errored: true; error: Error };

export interface SafeQueryOptions<T> {
  /** Returned as `rows` when the query throws. Callers should still check `ok`. */
  fallback: T[];
  /** Tag for Sentry — e.g. "creator-dashboard.revenue-breakdown". */
  context: string;
  /** Extra fields attached to the Sentry event. */
  tags?: Record<string, string | number>;
  /** If false, don't send to Sentry (e.g. querying information_schema for a table probe). */
  report?: boolean;
}

export async function safeQuery<T>(
  fn: () => Promise<T[]> | T[] | any,
  opts: SafeQueryOptions<T>,
): Promise<QueryResult<T>> {
  try {
    const rows = (await fn()) as T[];
    return { ok: true, rows: Array.isArray(rows) ? rows : [], errored: false };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (opts.report !== false) {
      try {
        Sentry.withScope((scope) => {
          scope.setTag('safe_query.context', opts.context);
          if (opts.tags) {
            for (const [k, v] of Object.entries(opts.tags)) scope.setTag(k, String(v));
          }
          Sentry.captureException(error);
        });
      } catch {
        // Sentry hub not initialized (test env, standalone scripts) — swallow.
      }
    }
    return { ok: false, rows: opts.fallback, errored: true, error };
  }
}

/**
 * Convenience for single-row aggregates: `const { row, ok } = await safeQueryOne(...)`.
 */
export async function safeQueryOne<T>(
  fn: () => Promise<T[]> | T[] | any,
  opts: SafeQueryOptions<T> & { fallback: [T] },
): Promise<{ ok: boolean; row: T; errored: boolean; error?: Error }> {
  const result = await safeQuery<T>(fn, opts);
  return {
    ok: result.ok,
    row: result.rows[0] ?? opts.fallback[0],
    errored: result.errored,
    error: result.ok ? undefined : result.error,
  };
}

/**
 * observedSwallow — for best-effort writes where the caller does not act on
 * the result, but a silent failure represents real cost (revenue leakage,
 * audit-trail loss, etc.). Catches the error, reports to Sentry with a
 * context tag so volume is visible, then returns void.
 *
 * Use for: post-success cleanup writes (credit deduction after successful AI
 * call, transaction-log inserts, idempotent state syncs). The original
 * `.catch(() => {})` pattern was correct in shape — caller cannot recover —
 * but invisible. This restores observability without changing call-site
 * semantics.
 *
 * Do NOT use for: reads (use `safeQuery`), writes the caller acts on (let
 * them throw), or true fire-and-forget telemetry where failure isn't a cost
 * (use plain `.catch(() => {})` with `// fire-and-forget` tag).
 *
 *   await observedSwallow(
 *     () => sql`UPDATE user_credits SET balance = balance - ${cost} ...`,
 *     'ai-pitch-extract.credit-deduction',
 *   );
 */
export async function observedSwallow(
  fn: () => Promise<unknown>,
  context: string,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    try {
      Sentry.withScope((scope) => {
        scope.setTag('catch_swallow.context', context);
        Sentry.captureException(error);
      });
    } catch {
      // Sentry hub not initialized (test env, standalone scripts) — swallow.
    }
  }
}

/**
 * observedSwallowReturning — sibling of `observedSwallow` for best-effort
 * operations where the caller *does* read the result but accepts a fallback
 * on failure (typically `null` from an INSERT/UPDATE-RETURNING or an external
 * API read). Catches, reports to Sentry with a context tag, and returns the
 * fallback. Restores observability without changing the caller's null-check.
 *
 * Two generics so the fallback's shape doesn't need to match `T` exactly —
 * the common case is `T = SomeRow[]`, fallback `null`, return `T | null`.
 *
 *   const result = await observedSwallowReturning(
 *     () => this.db.query(`INSERT INTO ... RETURNING *`, [...]),
 *     'handle-info-request.insert',
 *     null,
 *   );
 *   if (result && result[0]) { ... }
 */
export async function observedSwallowReturning<T, F>(
  fn: () => Promise<T>,
  context: string,
  fallback: F,
): Promise<T | F> {
  try {
    return await fn();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    try {
      Sentry.withScope((scope) => {
        scope.setTag('catch_swallow.context', context);
        Sentry.captureException(error);
      });
    } catch {
      // Sentry hub not initialized (test env, standalone scripts) — swallow.
    }
    return fallback;
  }
}
