/**
 * Status Dashboard Handler
 * Comprehensive monitoring endpoint with Axiom integration
 */

import { WorkerDatabase } from '../services/worker-database';
import { getCorsHeaders } from '../utils/response';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
  lastChecked: string;
  details?: string;
}

interface StatusDashboard {
  overall: 'operational' | 'degraded' | 'major_outage';
  timestamp: string;
  environment: string;
  version: string;
  services: ServiceStatus[];
  metrics: {
    requestsLast24h: number;
    errorsLast24h: number;
    errorRate: string;
    avgResponseTime: number;
    p95ResponseTime: number;
    activeUsers: number;
  };
  incidents: Array<{
    id: string;
    title: string;
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
    createdAt: string;
    updatedAt: string;
  }>;
  uptime: {
    last24h: string;
    last7d: string;
    last30d: string;
  };
}

/**
 * Main status dashboard endpoint
 * GET /api/status
 */
export async function statusDashboardHandler(
  request: Request,
  env: any,
  ctx: ExecutionContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  const startTime = Date.now();

  const dashboard: StatusDashboard = {
    overall: 'operational',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'production',
    version: env.VERSION || '2.0-integrated',
    services: [],
    metrics: {
      requestsLast24h: 0,
      errorsLast24h: 0,
      errorRate: '0%',
      avgResponseTime: 0,
      p95ResponseTime: 0,
      activeUsers: 0
    },
    incidents: [],
    uptime: {
      last24h: '100%',
      last7d: '99.9%',
      last30d: '99.9%'
    }
  };

  // Check all services in parallel
  const serviceChecks = await Promise.allSettled([
    checkDatabase(env),
    checkCache(env),
    checkStorage(env),
    checkAuth(env),
    checkWebSocket(env)
  ]);

  // Process service check results
  const serviceNames = ['Database (Neon)', 'Cache (KV)', 'Storage (R2)', 'Auth (Better Auth)', 'WebSocket'];
  serviceChecks.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      dashboard.services.push({
        name: serviceNames[index],
        ...result.value,
        lastChecked: new Date().toISOString()
      });
    } else {
      dashboard.services.push({
        name: serviceNames[index],
        status: 'down',
        lastChecked: new Date().toISOString(),
        details: result.reason?.message || 'Check failed'
      });
    }
  });

  // Calculate overall status
  const downServices = dashboard.services.filter(s => s.status === 'down').length;
  const degradedServices = dashboard.services.filter(s => s.status === 'degraded').length;

  if (downServices >= 2) {
    dashboard.overall = 'major_outage';
  } else if (downServices >= 1 || degradedServices >= 2) {
    dashboard.overall = 'degraded';
  }

  // Get metrics from database
  try {
    const db = new WorkerDatabase({
      connectionString: env.DATABASE_URL,
      maxRetries: 2,
      retryDelay: 500
    });

    // Get request/error counts
    const metricsQuery = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as requests_24h,
        COUNT(*) FILTER (WHERE status_code >= 500 AND created_at > NOW() - INTERVAL '24 hours') as errors_24h,
        AVG(response_time) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as avg_response_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time)
          FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as p95_response_time
      FROM request_logs
    `).catch(() => [{ requests_24h: 0, errors_24h: 0, avg_response_time: 0, p95_response_time: 0 }]);

    // Get active users
    const activeUsersQuery = await db.query(`
      SELECT COUNT(DISTINCT user_id) as active_users
      FROM sessions
      WHERE expires_at > NOW()
    `).catch(() => [{ active_users: 0 }]);

    if (metricsQuery && metricsQuery[0]) {
      const m = metricsQuery[0] as any;
      dashboard.metrics.requestsLast24h = parseInt(m.requests_24h) || 0;
      dashboard.metrics.errorsLast24h = parseInt(m.errors_24h) || 0;
      dashboard.metrics.avgResponseTime = Math.round(parseFloat(m.avg_response_time) || 0);
      dashboard.metrics.p95ResponseTime = Math.round(parseFloat(m.p95_response_time) || 0);

      const errorRate = dashboard.metrics.requestsLast24h > 0
        ? (dashboard.metrics.errorsLast24h / dashboard.metrics.requestsLast24h * 100).toFixed(2)
        : '0';
      dashboard.metrics.errorRate = `${errorRate}%`;
    }

    if (activeUsersQuery && activeUsersQuery[0]) {
      dashboard.metrics.activeUsers = parseInt((activeUsersQuery[0] as any).active_users) || 0;
    }

  } catch (error) {
    console.warn('Failed to fetch metrics:', error);
  }

  // Send to Axiom if configured
  if (env.AXIOM_TOKEN && env.AXIOM_DATASET) {
    ctx.waitUntil(sendToAxiom(env, {
      type: 'status_check',
      overall: dashboard.overall,
      services: dashboard.services.map(s => ({ name: s.name, status: s.status })),
      metrics: dashboard.metrics,
      responseTime: Date.now() - startTime
    }));
  }

  return new Response(JSON.stringify(dashboard, null, 2), {
    status: dashboard.overall === 'major_outage' ? 503 : 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, max-age=0',
      ...corsHeaders
    }
  });
}

/**
 * Simple health check for uptime monitors
 * GET /api/health/ping
 */
export async function healthPingHandler(
  request: Request,
  env: any
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: env.VERSION || '2.0-integrated'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

/**
 * Detailed service health for specific component
 * GET /api/health/:service
 */
export async function serviceHealthHandler(
  request: Request,
  env: any,
  service: string
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  let result: { status: 'operational' | 'degraded' | 'down'; latency?: number; details?: string };

  switch (service) {
    case 'database':
      result = await checkDatabase(env);
      break;
    case 'cache':
      result = await checkCache(env);
      break;
    case 'storage':
      result = await checkStorage(env);
      break;
    case 'auth':
      result = await checkAuth(env);
      break;
    case 'websocket':
      result = await checkWebSocket(env);
      break;
    default:
      return new Response(JSON.stringify({ error: 'Unknown service' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
  }

  return new Response(JSON.stringify({
    service,
    ...result,
    checkedAt: new Date().toISOString()
  }), {
    status: result.status === 'down' ? 503 : 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// Service check functions
async function checkDatabase(env: any): Promise<{ status: 'operational' | 'degraded' | 'down'; latency?: number; details?: string }> {
  const start = Date.now();
  try {
    const db = new WorkerDatabase({
      connectionString: env.DATABASE_URL,
      maxRetries: 1,
      retryDelay: 500
    });

    const result = await Promise.race([
      db.query('SELECT 1 as health'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);

    const latency = Date.now() - start;

    if (latency > 2000) {
      return { status: 'degraded', latency, details: 'High latency detected' };
    }

    return { status: 'operational', latency };
  } catch (error: any) {
    return { status: 'down', latency: Date.now() - start, details: error.message };
  }
}

async function checkCache(env: any): Promise<{ status: 'operational' | 'degraded' | 'down'; latency?: number; details?: string }> {
  const start = Date.now();
  try {
    if (!env.CACHE) {
      return { status: 'down', details: 'KV not configured' };
    }

    const testKey = `health-${Date.now()}`;
    await env.CACHE.put(testKey, 'test', { expirationTtl: 60 });
    const value = await env.CACHE.get(testKey);
    await env.CACHE.delete(testKey);

    const latency = Date.now() - start;

    if (!value) {
      return { status: 'degraded', latency, details: 'Read after write failed' };
    }

    return { status: 'operational', latency };
  } catch (error: any) {
    return { status: 'down', latency: Date.now() - start, details: error.message };
  }
}

async function checkStorage(env: any): Promise<{ status: 'operational' | 'degraded' | 'down'; latency?: number; details?: string }> {
  const start = Date.now();
  try {
    if (!env.PITCH_STORAGE) {
      return { status: 'down', details: 'R2 not configured' };
    }

    const testKey = `health-check/${Date.now()}.txt`;
    await env.PITCH_STORAGE.put(testKey, 'health check');
    const obj = await env.PITCH_STORAGE.get(testKey);
    await env.PITCH_STORAGE.delete(testKey);

    const latency = Date.now() - start;

    if (!obj) {
      return { status: 'degraded', latency, details: 'Read after write failed' };
    }

    return { status: 'operational', latency };
  } catch (error: any) {
    return { status: 'down', latency: Date.now() - start, details: error.message };
  }
}

async function checkAuth(env: any): Promise<{ status: 'operational' | 'degraded' | 'down'; latency?: number; details?: string }> {
  const start = Date.now();
  try {
    const db = new WorkerDatabase({
      connectionString: env.DATABASE_URL,
      maxRetries: 1,
      retryDelay: 500
    });

    const result = await db.query(`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('users', 'sessions', 'accounts')
    `);

    const latency = Date.now() - start;

    if (!result || !result[0] || parseInt((result[0] as any).count) < 3) {
      return { status: 'degraded', latency, details: 'Auth tables incomplete' };
    }

    return { status: 'operational', latency };
  } catch (error: any) {
    return { status: 'down', latency: Date.now() - start, details: error.message };
  }
}

async function checkWebSocket(env: any): Promise<{ status: 'operational' | 'degraded' | 'down'; latency?: number; details?: string }> {
  // WebSocket health is passive - check if Durable Objects are available
  try {
    if (env.NOTIFICATION_HUB) {
      return { status: 'operational', details: 'Durable Objects available' };
    }
    return { status: 'degraded', details: 'Running without Durable Objects' };
  } catch (error: any) {
    return { status: 'down', details: error.message };
  }
}

/**
 * Send logs/events to Axiom
 */
export async function sendToAxiom(env: any, data: Record<string, any>): Promise<void> {
  if (!env.AXIOM_TOKEN || !env.AXIOM_DATASET) {
    return;
  }

  try {
    const event = {
      _time: new Date().toISOString(),
      service: 'pitchey-api',
      environment: env.ENVIRONMENT || 'production',
      ...data
    };

    await fetch(`https://api.axiom.co/v1/datasets/${env.AXIOM_DATASET}/ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.AXIOM_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([event])
    });
  } catch (error) {
    console.error('Failed to send to Axiom:', error);
  }
}

/**
 * Log an error to Axiom with alerting metadata
 */
export async function logErrorToAxiom(
  env: any,
  error: Error,
  request: Request,
  context: Record<string, any> = {}
): Promise<void> {
  const url = new URL(request.url);

  await sendToAxiom(env, {
    type: 'error',
    level: 'error',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    request: {
      method: request.method,
      path: url.pathname,
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP')
    },
    ...context,
    // Alert metadata - Axiom can trigger alerts based on these
    _alert: context.critical ? 'critical' : 'warning'
  });
}

/**
 * Log API request metrics to Axiom
 */
export async function logRequestToAxiom(
  env: any,
  request: Request,
  response: Response,
  duration: number,
  userId?: string
): Promise<void> {
  const url = new URL(request.url);

  await sendToAxiom(env, {
    type: 'request',
    level: response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info',
    request: {
      method: request.method,
      path: url.pathname,
      query: url.search,
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP'),
      country: request.headers.get('CF-IPCountry')
    },
    response: {
      status: response.status,
      duration
    },
    userId
  });
}
