/**
 * Logged Database Connection for Cloudflare Workers
 *
 * Wraps RawSQLDatabase with comprehensive logging for:
 * - Query execution with timing
 * - Slow query detection
 * - Error tracking
 * - Connection health monitoring
 * - Trace ID propagation (correlates queries to requests in Axiom)
 * - SQLCommenter annotations (correlates Neon slow-query logs to HTTP requests)
 */

import { RawSQLDatabase, createDatabase, DatabaseConfig } from './raw-sql-connection';
import { ProductionLogger } from '../lib/production-logger';
import * as Sentry from '@sentry/cloudflare';

// ============================================================================
// Types
// ============================================================================

export interface LoggedDatabaseConfig extends DatabaseConfig {
  slowQueryThresholdMs?: number;
  logAllQueries?: boolean;
  environment?: string;
}

export interface QueryLogEntry {
  query: string;
  params?: unknown[];
  duration: number;
  rowCount?: number;
  error?: string;
  cached?: boolean;
  slow?: boolean;
}

/**
 * Per-request trace context threaded into DB logging and SQLCommenter annotations.
 * Populated by the caller at request start and forwarded via withTraceContext().
 */
export interface TraceContext {
  /** W3C traceparent value (00-<traceId>-<spanId>-<flags>) or just a bare trace ID. */
  traceparent: string;
  /** Matched route pattern, e.g. /api/pitches/:id */
  route: string;
  /** HTTP method, e.g. GET */
  method: string;
}

// ============================================================================
// SQLCommenter helpers
// ============================================================================

/**
 * Sanitise a single SQLCommenter tag value.
 *
 * The SQLCommenter spec requires each value to be:
 *   1. Single-quoted inside the comment
 *   2. URL-percent-encoded (RFC 3986 unreserved chars pass through; everything
 *      else, including `'`, `\`, `*`, `/`, and `%` itself, is encoded).
 *
 * We use encodeURIComponent (available in all Workers runtimes) and additionally
 * encode the single-quote character (`%27`) explicitly because encodeURIComponent
 * already does so — this call is therefore both correct and injection-safe:
 * the value can never break out of its surrounding single quotes inside the comment.
 */
function encodeSQLCommenterValue(raw: string): string {
  // encodeURIComponent encodes everything except A-Z a-z 0-9 - _ . ! ~ * ' ( )
  // We want ' and * encoded too.
  return encodeURIComponent(raw)
    .replace(/'/g, '%27')
    .replace(/\*/g, '%2A');
}

/**
 * Build a SQLCommenter-style comment string.
 *
 * Format (per https://google.github.io/sqlcommenter/spec/):
 *   /*traceparent='<value>',route='<value>',method='<value>'*\/
 *
 * The trailing space before the comment ensures it does not run into a
 * semicolon if the caller's query already ends with one.
 *
 * Returns an empty string when none of the values are present, so no
 * comment is appended to queries that lack trace context.
 */
function buildSQLComment(ctx: TraceContext | undefined): string {
  if (!ctx) return '';

  const parts: string[] = [];

  if (ctx.traceparent) {
    parts.push(`traceparent='${encodeSQLCommenterValue(ctx.traceparent)}'`);
  }
  if (ctx.route) {
    parts.push(`route='${encodeSQLCommenterValue(ctx.route)}'`);
  }
  if (ctx.method) {
    parts.push(`method='${encodeSQLCommenterValue(ctx.method)}'`);
  }

  if (parts.length === 0) return '';

  return ` /*${parts.join(',')}*/`;
}

/**
 * Append a SQLCommenter comment to a query string.
 *
 * The comment is appended after a trailing semicolon is stripped (if present)
 * so that Postgres still receives valid SQL.  A stripped semicolon is restored
 * after the comment.
 */
function annotateQuery(queryString: string, ctx: TraceContext | undefined): string {
  const comment = buildSQLComment(ctx);
  if (!comment) return queryString;

  const trimmed = queryString.trimEnd();
  if (trimmed.endsWith(';')) {
    return trimmed.slice(0, -1) + comment + ';';
  }
  return trimmed + comment;
}

// ============================================================================
// Logged Database Wrapper
// ============================================================================

export class LoggedDatabase {
  private db: RawSQLDatabase;
  private logger: ProductionLogger;
  private slowQueryThreshold: number;
  private logAllQueries: boolean;
  private traceCtx: TraceContext | undefined;
  private queryMetrics: {
    totalQueries: number;
    slowQueries: number;
    failedQueries: number;
    totalDuration: number;
  };

  constructor(config: LoggedDatabaseConfig, logger?: ProductionLogger) {
    this.db = createDatabase(config);
    this.logger = logger || new ProductionLogger({
      service: 'pitchey-database',
      environment: config.environment || 'production',
    });
    this.slowQueryThreshold = config.slowQueryThresholdMs || 1000;
    this.logAllQueries = config.logAllQueries ?? false;
    this.queryMetrics = {
      totalQueries: 0,
      slowQueries: 0,
      failedQueries: 0,
      totalDuration: 0,
    };
  }

  /**
   * Execute a query with logging
   */
  async query<T = any>(
    queryText: string | TemplateStringsArray,
    params?: any[],
    options?: {
      useReadReplica?: boolean;
      cache?: { key: string; ttl: number };
      timeout?: number;
    }
  ): Promise<T[]> {
    const startTime = Date.now();
    const rawQueryString = typeof queryText === 'string' ? queryText : queryText.join('?');
    const sanitizedQuery = this.sanitizeQuery(rawQueryString);

    // Annotate the query sent to the database with SQLCommenter metadata.
    // The sanitizedQuery (used only for logging) is never annotated — it is
    // already truncated to 500 chars and is just for human-readable logs.
    // TemplateStringsArray queries cannot be safely re-stringified back into a
    // tagged-template, so we only annotate plain string queries.
    const annotatedQuery: string | TemplateStringsArray =
      typeof queryText === 'string'
        ? annotateQuery(rawQueryString, this.traceCtx)
        : queryText;

    try {
      // Pass the annotated text to the underlying driver so that
      // pg_stat_statements and Neon's slow-query log both capture the comment.
      const result = await this.db.query<T>(annotatedQuery as any, params, options);
      const duration = Date.now() - startTime;

      this.recordQueryMetrics(duration, false);
      this.logQuery(sanitizedQuery, params, duration, result.length, options?.cache !== undefined);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryMetrics(duration, true);
      this.logQueryError(sanitizedQuery, params, duration, error);
      throw error;
    }
  }

  /**
   * Execute a query and return a single row
   */
  async queryOne<T = any>(
    queryText: string | TemplateStringsArray,
    params?: any[],
    options?: { useReadReplica?: boolean; cache?: { key: string; ttl: number } }
  ): Promise<T | null> {
    const rows = await this.query<T>(queryText, params, options);
    return rows[0] || null;
  }

  /**
   * Execute an insert with logging
   */
  async insert<T = any>(
    table: string,
    data: Record<string, any> | Record<string, any>[],
    returning = '*'
  ): Promise<T[]> {
    const startTime = Date.now();
    const recordCount = Array.isArray(data) ? data.length : 1;

    try {
      const result = await this.db.insert<T>(table, data, returning);
      const duration = Date.now() - startTime;

      this.recordQueryMetrics(duration, false);
      this.logger.debug('Database insert', {
        table,
        recordCount,
        duration,
        returning: returning !== '*' ? returning : undefined,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryMetrics(duration, true);
      this.logger.error('Database insert failed', error, {
        table,
        recordCount,
        duration,
      });
      throw error;
    }
  }

  /**
   * Execute an update with logging
   */
  async update<T = any>(
    table: string,
    data: Record<string, any>,
    where: string,
    whereParams: any[] = [],
    returning = '*'
  ): Promise<T[]> {
    const startTime = Date.now();
    const fields = Object.keys(data);

    try {
      const result = await this.db.update<T>(table, data, where, whereParams, returning);
      const duration = Date.now() - startTime;

      this.recordQueryMetrics(duration, false);
      this.logger.debug('Database update', {
        table,
        fields,
        rowsAffected: result.length,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryMetrics(duration, true);
      this.logger.error('Database update failed', error, {
        table,
        fields,
        duration,
      });
      throw error;
    }
  }

  /**
   * Execute a delete with logging
   */
  async delete<T = any>(
    table: string,
    where: string,
    whereParams: any[] = [],
    returning = '*'
  ): Promise<T[]> {
    const startTime = Date.now();

    try {
      const result = await this.db.delete<T>(table, where, whereParams, returning);
      const duration = Date.now() - startTime;

      this.recordQueryMetrics(duration, false);
      this.logger.debug('Database delete', {
        table,
        rowsDeleted: result.length,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryMetrics(duration, true);
      this.logger.error('Database delete failed', error, {
        table,
        duration,
      });
      throw error;
    }
  }

  /**
   * Execute a transaction with logging
   */
  async transaction<T = any>(
    callback: (sql: any) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    this.logger.debug('Transaction started', { transactionId });

    try {
      const result = await this.db.transaction(callback);
      const duration = Date.now() - startTime;

      this.logger.debug('Transaction committed', {
        transactionId,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Transaction rolled back', error, {
        transactionId,
        duration,
      });

      throw error;
    }
  }

  /**
   * Check database health with logging
   */
  async healthCheck(): Promise<boolean> {
    const startTime = Date.now();

    try {
      const healthy = await this.db.healthCheck();
      const duration = Date.now() - startTime;

      if (healthy) {
        this.logger.debug('Database health check passed', { duration });
      } else {
        this.logger.warn('Database health check failed', { duration });
      }

      return healthy;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Database health check error', error, { duration });
      return false;
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const dbStats = this.db.getStats();
    return {
      ...dbStats,
      logging: {
        ...this.queryMetrics,
        avgQueryDuration: this.queryMetrics.totalQueries > 0
          ? this.queryMetrics.totalDuration / this.queryMetrics.totalQueries
          : 0,
        slowQueryRate: this.queryMetrics.totalQueries > 0
          ? this.queryMetrics.slowQueries / this.queryMetrics.totalQueries
          : 0,
        errorRate: this.queryMetrics.totalQueries > 0
          ? this.queryMetrics.failedQueries / this.queryMetrics.totalQueries
          : 0,
      },
    };
  }

  /**
   * Get the underlying database instance
   */
  getUnderlyingDb(): RawSQLDatabase {
    return this.db;
  }

  /**
   * Create a child logger for a specific operation
   */
  withLogger(logger: ProductionLogger): LoggedDatabase {
    const newInstance = Object.create(this);
    newInstance.logger = logger;
    return newInstance;
  }

  /**
   * Return a scoped copy of this instance with request trace context attached.
   *
   * Every query executed on the returned instance will:
   *   1. Include traceId in all log fields (Axiom correlation).
   *   2. Have a SQLCommenter comment appended to the SQL text sent to Neon
   *      (pg_stat_statements / Neon slow-query log correlation).
   *
   * Usage in a request handler:
   *   const db = loggedDb.withTraceContext({
   *     traceparent: loggingContext.traceId,   // or full W3C traceparent string
   *     route: '/api/pitches/:id',
   *     method: request.method,
   *   });
   *
   * The original instance is not mutated.
   */
  withTraceContext(ctx: TraceContext): LoggedDatabase {
    const scoped = Object.create(this) as LoggedDatabase;
    scoped.traceCtx = ctx;
    return scoped;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private logQuery(
    query: string,
    params: unknown[] | undefined,
    duration: number,
    rowCount: number,
    cached: boolean
  ): void {
    const isSlow = duration > this.slowQueryThreshold;

    // Trace fields included in every log entry when trace context is present.
    // These map directly to the traceId / spanId / method / path fields in the
    // LogData type (lib/observability.ts) so Axiom can join query logs with
    // request logs on the traceId field.
    const traceFields: Record<string, string> = {};
    if (this.traceCtx) {
      traceFields.traceId = this.traceCtx.traceparent;
      traceFields.route = this.traceCtx.route;
      traceFields.method = this.traceCtx.method;
    }

    // Always log slow queries
    if (isSlow) {
      this.logger.warn('Slow database query', {
        query: query.substring(0, 500),
        duration,
        rowCount,
        threshold: this.slowQueryThreshold,
        exceededBy: duration - this.slowQueryThreshold,
        ...traceFields,
      });

      // Add Sentry breadcrumb for slow queries
      Sentry.addBreadcrumb({
        category: 'query',
        message: `SLOW: ${query.substring(0, 100)}`,
        level: 'warning',
        data: { duration, rowCount, threshold: this.slowQueryThreshold, ...traceFields },
      });
    } else if (this.logAllQueries) {
      this.logger.debug('Database query', {
        query: query.substring(0, 200),
        duration,
        rowCount,
        cached,
        ...traceFields,
      });
    }

    // Add breadcrumb for query tracking (non-slow)
    if (!isSlow) {
      Sentry.addBreadcrumb({
        category: 'query',
        message: query.substring(0, 100),
        level: 'info',
        data: { duration, rowCount, ...traceFields },
      });
    }
  }

  private logQueryError(
    query: string,
    params: unknown[] | undefined,
    duration: number,
    error: unknown
  ): void {
    const traceFields: Record<string, string> = {};
    if (this.traceCtx) {
      traceFields.traceId = this.traceCtx.traceparent;
      traceFields.route = this.traceCtx.route;
      traceFields.method = this.traceCtx.method;
    }

    this.logger.error('Database query failed', error, {
      query: query.substring(0, 500),
      duration,
      errorType: error instanceof Error ? error.name : 'Unknown',
      ...traceFields,
    });

    // Send to Sentry
    if (error instanceof Error) {
      Sentry.withScope((scope) => {
        scope.setTag('component', 'database');
        scope.setExtra('query', query.substring(0, 500));
        scope.setExtra('duration', duration);
        if (this.traceCtx) {
          scope.setTag('traceId', this.traceCtx.traceparent);
          scope.setTag('route', this.traceCtx.route);
        }
        Sentry.captureException(error);
      });
    }
  }

  private recordQueryMetrics(duration: number, failed: boolean): void {
    this.queryMetrics.totalQueries++;
    this.queryMetrics.totalDuration += duration;

    if (failed) {
      this.queryMetrics.failedQueries++;
    }

    if (duration > this.slowQueryThreshold) {
      this.queryMetrics.slowQueries++;
    }
  }

  private sanitizeQuery(query: string): string {
    // Remove excessive whitespace
    return query.replace(/\s+/g, ' ').trim();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a logged database instance
 */
export function createLoggedDatabase(
  config: LoggedDatabaseConfig | any,
  logger?: ProductionLogger
): LoggedDatabase {
  // Handle env object format
  const dbConfig: LoggedDatabaseConfig = config.DATABASE_URL ? {
    connectionString: config.DATABASE_URL,
    readReplicaUrls: config.READ_REPLICA_URLS ? config.READ_REPLICA_URLS.split(',') : [],
    redis: config.UPSTASH_REDIS_REST_URL ? {
      url: config.UPSTASH_REDIS_REST_URL,
      token: config.UPSTASH_REDIS_REST_TOKEN,
    } : undefined,
    slowQueryThresholdMs: parseInt(config.SLOW_QUERY_THRESHOLD_MS || '1000'),
    logAllQueries: config.LOG_ALL_QUERIES === 'true',
    environment: config.ENVIRONMENT,
  } : config;

  return new LoggedDatabase(dbConfig, logger);
}

export default LoggedDatabase;
