/**
 * Full Observability Stack for Cloudflare Workers
 *
 * Integrates:
 * - Axiom for log aggregation and analysis
 * - Cloudflare Analytics Engine for metrics
 * - Sentry for error tracking (existing)
 * - Custom dashboards and alerting
 */

import * as Sentry from '@sentry/cloudflare';

// ============================================================================
// Types
// ============================================================================

export interface ObservabilityConfig {
  axiomToken?: string;
  axiomDataset?: string;
  sentryDsn?: string;
  environment: string;
  service: string;
  version?: string;
}

export interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: number;
}

export interface LogData {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  path?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: unknown;
}

export interface AnalyticsEngineDataset {
  writeDataPoint: (data: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }) => void;
}

// ============================================================================
// Axiom Integration
// ============================================================================

export class AxiomClient {
  private token: string;
  private dataset: string;
  private buffer: LogData[] = [];
  private flushInterval: number = 5000; // 5 seconds
  private maxBufferSize: number = 100;

  constructor(token: string, dataset: string = 'pitchey-logs') {
    this.token = token;
    this.dataset = dataset;
  }

  /**
   * Ingest a single log entry
   */
  async ingest(data: LogData): Promise<void> {
    this.buffer.push({
      ...data,
      _time: data.timestamp || new Date().toISOString(),
    });

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush();
    }
  }

  /**
   * Ingest multiple log entries
   */
  async ingestBatch(data: LogData[]): Promise<void> {
    const entries = data.map(d => ({
      ...d,
      _time: d.timestamp || new Date().toISOString(),
    }));
    this.buffer.push(...entries);

    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush();
    }
  }

  /**
   * Flush buffered logs to Axiom
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const logsToSend = [...this.buffer];
    this.buffer = [];

    try {
      const response = await fetch(
        `https://api.axiom.co/v1/datasets/${this.dataset}/ingest`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(logsToSend),
        }
      );

      if (!response.ok) {
        console.error('Axiom ingest failed:', response.status, await response.text());
        // Re-add failed logs to buffer (with limit)
        if (this.buffer.length < this.maxBufferSize * 2) {
          this.buffer.push(...logsToSend);
        }
      }
    } catch (error) {
      console.error('Axiom ingest error:', error);
      // Re-add failed logs to buffer (with limit)
      if (this.buffer.length < this.maxBufferSize * 2) {
        this.buffer.push(...logsToSend);
      }
    }
  }

  /**
   * Query logs from Axiom
   */
  async query(apl: string, startTime?: string, endTime?: string): Promise<any> {
    const body: any = { apl };
    if (startTime) body.startTime = startTime;
    if (endTime) body.endTime = endTime;

    // `format=tabular` is required to get the { tables: [{ fields, columns }] }
    // response shape callers parse; without it the API 422s / returns legacy shape.
    const response = await fetch('https://api.axiom.co/v1/datasets/_apl?format=tabular', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Best-effort: include the response body in the error for debuggability.
      let detail = '';
      try { detail = await response.text(); } catch { /* body not readable */ }
      throw new Error(`Axiom query failed: ${response.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
    }

    return response.json();
  }
}

// ============================================================================
// Cloudflare Analytics Engine Metrics
// ============================================================================

export class MetricsCollector {
  private datasets: Map<string, AnalyticsEngineDataset> = new Map();
  private defaultDataset?: AnalyticsEngineDataset;

  constructor(env: Record<string, any>) {
    // Auto-discover Analytics Engine bindings
    const knownDatasets = [
      'METRICS',
      'ERROR_TRACKING',
      'PERFORMANCE_METRICS',
      'USER_ANALYTICS',
      'TRACE_METRICS',
    ];

    for (const name of knownDatasets) {
      if (env[name]?.writeDataPoint) {
        this.datasets.set(name, env[name]);
        if (!this.defaultDataset) {
          this.defaultDataset = env[name];
        }
      }
    }
  }

  /**
   * Record a counter metric
   */
  counter(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.writeMetric('counter', name, value, tags);
  }

  /**
   * Record a gauge metric
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.writeMetric('gauge', name, value, tags);
  }

  /**
   * Record a histogram metric (for durations, sizes, etc.)
   */
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.writeMetric('histogram', name, value, tags);
  }

  /**
   * Record request metrics
   */
  recordRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    tags?: Record<string, string>
  ): void {
    const dataset = this.datasets.get('METRICS') || this.defaultDataset;
    if (!dataset) return;

    dataset.writeDataPoint({
      blobs: [
        method,
        path,
        String(statusCode),
        tags?.userId || '',
        tags?.region || '',
      ],
      doubles: [duration, statusCode >= 400 ? 1 : 0, statusCode >= 500 ? 1 : 0],
      indexes: [`${method}:${path}`.substring(0, 96)],
    });
  }

  /**
   * Record error metrics
   */
  recordError(
    errorType: string,
    errorMessage: string,
    component: string,
    tags?: Record<string, string>
  ): void {
    const dataset = this.datasets.get('ERROR_TRACKING') || this.defaultDataset;
    if (!dataset) return;

    dataset.writeDataPoint({
      blobs: [
        errorType,
        errorMessage.substring(0, 200),
        component,
        tags?.requestId || '',
        tags?.userId || '',
      ],
      doubles: [1, Date.now()],
      indexes: [`${component}:${errorType}`],
    });
  }

  /**
   * Record database query metrics
   */
  recordQuery(
    queryType: string,
    table: string,
    duration: number,
    rowCount: number,
    success: boolean
  ): void {
    const dataset = this.datasets.get('PERFORMANCE_METRICS') || this.defaultDataset;
    if (!dataset) return;

    dataset.writeDataPoint({
      blobs: [queryType, table, success ? 'success' : 'failure'],
      doubles: [duration, rowCount, success ? 0 : 1],
      indexes: [`db:${queryType}:${table}`.substring(0, 96)],
    });
  }

  /**
   * Record cache metrics
   */
  recordCache(operation: string, hit: boolean, duration: number): void {
    const dataset = this.datasets.get('PERFORMANCE_METRICS') || this.defaultDataset;
    if (!dataset) return;

    dataset.writeDataPoint({
      blobs: [operation, hit ? 'hit' : 'miss'],
      doubles: [duration, hit ? 1 : 0, hit ? 0 : 1],
      indexes: [`cache:${operation}`],
    });
  }

  private writeMetric(
    type: string,
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    const dataset = this.defaultDataset;
    if (!dataset) return;

    const tagValues = tags ? Object.values(tags) : [];
    dataset.writeDataPoint({
      blobs: [type, name, ...tagValues.slice(0, 3)],
      doubles: [value, Date.now()],
      indexes: [name],
    });
  }
}

// ============================================================================
// Unified Observability Client
// ============================================================================

export class Observability {
  private config: ObservabilityConfig;
  private axiom?: AxiomClient;
  private metrics?: MetricsCollector;
  private requestContext: Record<string, any> = {};

  constructor(config: ObservabilityConfig, env?: Record<string, any>) {
    this.config = config;

    // Initialize Axiom if token provided
    if (config.axiomToken) {
      this.axiom = new AxiomClient(
        config.axiomToken,
        config.axiomDataset || 'pitchey-logs'
      );
    }

    // Initialize metrics collector
    if (env) {
      this.metrics = new MetricsCollector(env);
    }
  }

  /**
   * Set request context for all subsequent logs
   */
  setContext(context: Record<string, any>): void {
    this.requestContext = { ...this.requestContext, ...context };
  }

  /**
   * Log with automatic routing to appropriate backends
   */
  async log(level: LogData['level'], message: string, data?: Record<string, any>): Promise<void> {
    const logEntry: LogData = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.config.service,
      environment: this.config.environment,
      version: this.config.version,
      ...this.requestContext,
      ...data,
    };

    // Console output (structured JSON)
    const consoleMethod = level === 'debug' ? 'log' : level === 'fatal' ? 'error' : level;
    console[consoleMethod](JSON.stringify(logEntry));

    // Send to Axiom
    if (this.axiom) {
      await this.axiom.ingest(logEntry);
    }

    // Send errors to Sentry
    if ((level === 'error' || level === 'fatal') && data?.error) {
      Sentry.withScope((scope) => {
        scope.setTags({
          service: this.config.service,
          environment: this.config.environment,
          requestId: this.requestContext.requestId || 'unknown',
        });
        scope.setExtras(data);
        if (data.error instanceof Error) {
          Sentry.captureException(data.error);
        } else {
          Sentry.captureMessage(message, level === 'fatal' ? 'fatal' : 'error');
        }
      });
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: Record<string, any>): void {
    this.log('debug', message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: Record<string, any>): void {
    this.log('info', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: Record<string, any>): void {
    this.log('warn', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, data?: Record<string, any>): void {
    const errorData = error instanceof Error
      ? { error: { name: error.name, message: error.message, stack: error.stack } }
      : error
        ? { error: { message: String(error) } }
        : {};

    this.log('error', message, { ...data, ...errorData });
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error | unknown, data?: Record<string, any>): void {
    const errorData = error instanceof Error
      ? { error: { name: error.name, message: error.message, stack: error.stack } }
      : error
        ? { error: { message: String(error) } }
        : {};

    this.log('fatal', message, { ...data, ...errorData });
  }

  /**
   * Record a metric
   */
  metric(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics?.gauge(name, value, tags);
  }

  /**
   * Record request completion
   */
  recordRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number
  ): void {
    this.metrics?.recordRequest(method, path, statusCode, duration, {
      userId: this.requestContext.userId,
    });

    this.info('Request completed', {
      method,
      path,
      statusCode,
      duration,
    });
  }

  /**
   * Record database query
   */
  recordQuery(
    queryType: string,
    table: string,
    duration: number,
    rowCount: number,
    success: boolean = true
  ): void {
    this.metrics?.recordQuery(queryType, table, duration, rowCount, success);

    if (duration > 1000) {
      this.warn('Slow database query', {
        queryType,
        table,
        duration,
        rowCount,
      });
    }
  }

  /**
   * Flush all pending logs
   */
  async flush(): Promise<void> {
    if (this.axiom) {
      await this.axiom.flush();
    }
  }

  /**
   * Get metrics collector for direct access
   */
  getMetrics(): MetricsCollector | undefined {
    return this.metrics;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create observability instance from environment
 */
export function createObservability(env: Record<string, any>): Observability {
  return new Observability(
    {
      axiomToken: env.AXIOM_TOKEN,
      axiomDataset: env.AXIOM_DATASET || 'pitchey-logs',
      sentryDsn: env.SENTRY_DSN,
      environment: env.ENVIRONMENT || 'production',
      service: 'pitchey-api',
      version: env.CF_VERSION_METADATA?.id,
    },
    env
  );
}

/**
 * Create observability middleware for request handling
 */
export function observabilityMiddleware(env: Record<string, any>) {
  return {
    async handle(
      request: Request,
      handler: (obs: Observability) => Promise<Response>
    ): Promise<Response> {
      const obs = createObservability(env);
      const startTime = Date.now();
      const url = new URL(request.url);

      // Generate request context
      const requestId = request.headers.get('x-request-id') ||
        `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;

      obs.setContext({
        requestId,
        method: request.method,
        path: url.pathname,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('cf-connecting-ip'),
      });

      obs.info('Request started');

      try {
        const response = await handler(obs);
        const duration = Date.now() - startTime;

        obs.recordRequest(request.method, url.pathname, response.status, duration);

        // Add trace headers
        const headers = new Headers(response.headers);
        headers.set('x-request-id', requestId);

        // Flush logs before returning
        await obs.flush();

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        obs.error('Request failed', error, { duration });
        await obs.flush();
        throw error;
      }
    },
  };
}

export default Observability;
