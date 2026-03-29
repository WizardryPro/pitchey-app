/**
 * Per-request trace context for database query annotation.
 *
 * Uses AsyncLocalStorage (available via nodejs_compat + nodejs_als flags)
 * to carry trace metadata from the request handler into WorkerDatabase.executeQuery()
 * without threading it through every call site.
 *
 * Two features activate when context is present:
 *   1. SQLCommenter: a SQL comment is appended to every query with traceparent, route, method
 *   2. Console logging: slow/failed queries include trace fields for Axiom correlation
 */

import { AsyncLocalStorage } from 'node:async_hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TraceContext {
  /** W3C traceparent value or bare trace ID */
  traceparent: string;
  /** Matched route pattern, e.g. /api/pitches/:id */
  route: string;
  /** HTTP method, e.g. GET */
  method: string;
}

// ---------------------------------------------------------------------------
// AsyncLocalStorage instance (one per isolate, safe for concurrent requests)
// ---------------------------------------------------------------------------

export const traceStorage = new AsyncLocalStorage<TraceContext>();

/** Read the current request's trace context (undefined outside a .run() scope). */
export function getCurrentTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

// ---------------------------------------------------------------------------
// SQLCommenter helpers
// ---------------------------------------------------------------------------

function encodeSQLCommenterValue(raw: string): string {
  return encodeURIComponent(raw)
    .replace(/'/g, '%27')
    .replace(/\*/g, '%2A');
}

function buildSQLComment(ctx: TraceContext): string {
  const parts: string[] = [];
  if (ctx.traceparent) parts.push(`traceparent='${encodeSQLCommenterValue(ctx.traceparent)}'`);
  if (ctx.route) parts.push(`route='${encodeSQLCommenterValue(ctx.route)}'`);
  if (ctx.method) parts.push(`method='${encodeSQLCommenterValue(ctx.method)}'`);
  if (parts.length === 0) return '';
  return ` /*${parts.join(',')}*/`;
}

/**
 * Append a SQLCommenter comment to a query string using the current trace context.
 * Returns the query unchanged if no trace context is active.
 */
export function annotateQueryWithTrace(query: string): string {
  const ctx = getCurrentTraceContext();
  if (!ctx) return query;

  const comment = buildSQLComment(ctx);
  if (!comment) return query;

  const trimmed = query.trimEnd();
  if (trimmed.endsWith(';')) {
    return trimmed.slice(0, -1) + comment + ';';
  }
  return trimmed + comment;
}
