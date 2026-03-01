/**
 * Automated Health Monitoring Service
 * Continuously monitors system health and triggers alerts
 */

import { Toucan } from 'toucan-js';

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: any;
  timestamp: Date;
}

interface HealthThresholds {
  responseTime: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  cacheHitRate: number;
}

export class HealthMonitor {
  private readonly thresholds: HealthThresholds = {
    responseTime: 2000, // 2 seconds
    errorRate: 0.01,    // 1%
    cpuUsage: 45,       // 45ms (CloudFlare limit is 50ms)
    memoryUsage: 128,   // 128MB
    cacheHitRate: 0.6   // 60%
  };

  private metrics: Map<string, number[]> = new Map();
  private alerts: Map<string, Date> = new Map();
  private readonly alertCooldown = 300000; // 5 minutes

  constructor(
    private env: any,
    private sentry?: Toucan
  ) {}

  /**
   * Run comprehensive health check
   */
  async checkHealth(): Promise<HealthCheckResult[]> {
    const checks = await Promise.all([
      this.checkAPI(),
      this.checkDatabase(),
      this.checkCache(),
      this.checkStorage(),
      this.checkWebSocket(),
      this.checkAuth()
    ]);

    // Analyze results and trigger alerts if needed
    await this.analyzeAndAlert(checks);

    return checks;
  }

  /**
   * Check API health
   */
  private async checkAPI(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.env.BETTER_AUTH_URL}/health`);
      const responseTime = Date.now() - start;
      
      return {
        service: 'API',
        status: responseTime < this.thresholds.responseTime ? 'healthy' : 'degraded',
        responseTime,
        details: await response.json(),
        timestamp: new Date()
      };
    } catch (error) {
      return {
        service: 'API',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: { error: error.message },
        timestamp: new Date()
      };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Use Hyperdrive connection
      const db = this.env.HYPERDRIVE;
      const result = await db.prepare('SELECT 1 as health').first();
      const responseTime = Date.now() - start;

      // Check connection pool status
      const poolStats = await this.getConnectionPoolStats();
      
      return {
        service: 'Database',
        status: poolStats.activeConnections < poolStats.maxConnections * 0.8 ? 'healthy' : 'degraded',
        responseTime,
        details: {
          connected: true,
          pool: poolStats
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        service: 'Database',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: { error: error.message },
        timestamp: new Date()
      };
    }
  }

  /**
   * Check cache health
   */
  private async checkCache(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Test KV
      const testKey = '__health_check__';
      await this.env.CACHE.put(testKey, Date.now().toString(), { expirationTtl: 60 });
      const kvResult = await this.env.CACHE.get(testKey);

      // Test Redis if available
      let redisHealthy = true;
      if (this.env.UPSTASH_REDIS_REST_URL) {
        try {
          const response = await fetch(`${this.env.UPSTASH_REDIS_REST_URL}/ping`, {
            headers: {
              Authorization: `Bearer ${this.env.UPSTASH_REDIS_REST_TOKEN}`
            }
          });
          redisHealthy = response.ok;
        } catch {
          redisHealthy = false;
        }
      }

      const responseTime = Date.now() - start;
      
      return {
        service: 'Cache',
        status: kvResult && redisHealthy ? 'healthy' : 'degraded',
        responseTime,
        details: {
          kv: !!kvResult,
          redis: redisHealthy
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        service: 'Cache',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: { error: error.message },
        timestamp: new Date()
      };
    }
  }

  /**
   * Check R2 storage health
   */
  private async checkStorage(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // List objects to test R2 connectivity
      const list = await this.env.R2_BUCKET.list({ limit: 1 });
      const responseTime = Date.now() - start;
      
      return {
        service: 'Storage',
        status: 'healthy',
        responseTime,
        details: {
          accessible: true,
          objectCount: list.objects.length
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        service: 'Storage',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: { error: error.message },
        timestamp: new Date()
      };
    }
  }

  /**
   * Check WebSocket health
   */
  private async checkWebSocket(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Get Durable Object namespace
      const namespace = this.env.DURABLE_OBJECTS;
      const id = namespace.idFromName('health-check');
      const obj = namespace.get(id);
      
      // Send health check request
      const response = await obj.fetch('https://internal/health');
      const responseTime = Date.now() - start;
      
      return {
        service: 'WebSocket',
        status: response.ok ? 'healthy' : 'degraded',
        responseTime,
        details: await response.json(),
        timestamp: new Date()
      };
    } catch (error) {
      return {
        service: 'WebSocket',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: { error: error.message },
        timestamp: new Date()
      };
    }
  }

  /**
   * Check authentication service health
   */
  private async checkAuth(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.env.BETTER_AUTH_URL}/api/auth/session`, {
        method: 'GET',
        headers: {
          'Cookie': 'better-auth.session=test'
        }
      });
      const responseTime = Date.now() - start;
      
      return {
        service: 'Auth',
        status: response.status === 401 ? 'healthy' : 'degraded',
        responseTime,
        details: {
          accessible: true,
          responseCode: response.status
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        service: 'Auth',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: { error: error.message },
        timestamp: new Date()
      };
    }
  }

  /**
   * Get database connection pool statistics
   */
  private async getConnectionPoolStats() {
    // This would connect to Hyperdrive metrics
    // Placeholder for actual implementation
    return {
      activeConnections: null,
      idleConnections: null,
      maxConnections: null,
      waitingRequests: null
    };
  }

  /**
   * Analyze health check results and trigger alerts
   */
  private async analyzeAndAlert(checks: HealthCheckResult[]) {
    const unhealthyServices = checks.filter(c => c.status === 'unhealthy');
    const degradedServices = checks.filter(c => c.status === 'degraded');

    // Critical alert for unhealthy services
    if (unhealthyServices.length > 0) {
      await this.sendAlert('critical', 
        `Services unhealthy: ${unhealthyServices.map(s => s.service).join(', ')}`,
        unhealthyServices
      );
    }

    // Warning alert for degraded services
    if (degradedServices.length > 2) {
      await this.sendAlert('warning',
        `Multiple services degraded: ${degradedServices.map(s => s.service).join(', ')}`,
        degradedServices
      );
    }

    // Store metrics for trend analysis
    checks.forEach(check => {
      const key = `${check.service}_responseTime`;
      if (!this.metrics.has(key)) {
        this.metrics.set(key, []);
      }
      const values = this.metrics.get(key)!;
      values.push(check.responseTime);
      // Keep last 100 values
      if (values.length > 100) values.shift();
    });

    // Check for performance trends
    await this.checkPerformanceTrends();
  }

  /**
   * Check for performance degradation trends
   */
  private async checkPerformanceTrends() {
    for (const [key, values] of this.metrics) {
      if (values.length < 10) continue;

      const recent = values.slice(-10);
      const previous = values.slice(-20, -10);
      
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;

      // Alert if performance degraded by more than 50%
      if (recentAvg > previousAvg * 1.5) {
        await this.sendAlert('warning',
          `Performance degradation detected for ${key}`,
          { recent: recentAvg, previous: previousAvg }
        );
      }
    }
  }

  /**
   * Send alert to notification channels
   */
  private async sendAlert(severity: 'critical' | 'warning' | 'info', message: string, details: any) {
    const alertKey = `${severity}:${message}`;
    const lastAlert = this.alerts.get(alertKey);

    // Check cooldown period
    if (lastAlert && Date.now() - lastAlert.getTime() < this.alertCooldown) {
      return; // Skip alert if within cooldown
    }

    this.alerts.set(alertKey, new Date());

    // Send to Sentry
    if (this.sentry && severity === 'critical') {
      this.sentry.captureException(new Error(message), {
        level: 'error',
        extra: details
      });
    }

    // Send to Slack
    if (this.env.SLACK_WEBHOOK) {
      await this.sendSlackAlert(severity, message, details);
    }

    // Send to CloudFlare Analytics
    if (this.env.ANALYTICS) {
      this.env.ANALYTICS.writeDataPoint({
        blobs: [`health_alert_${severity}`],
        doubles: [1],
        indexes: [`${severity}:${message}`]
      });
    }

    // Log to console
    console.error(`[${severity.toUpperCase()}] ${message}`, details);
  }

  /**
   * Send alert to Slack
   */
  private async sendSlackAlert(severity: string, message: string, details: any) {
    const color = severity === 'critical' ? 'danger' : severity === 'warning' ? 'warning' : 'good';
    
    await fetch(this.env.SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title: `🚨 ${severity.toUpperCase()}: ${message}`,
          fields: Object.entries(details).map(([key, value]) => ({
            title: key,
            value: JSON.stringify(value),
            short: true
          })),
          footer: 'Pitchey Health Monitor',
          ts: Math.floor(Date.now() / 1000)
        }]
      })
    });
  }

  /**
   * Get current system metrics
   */
  async getMetrics() {
    const checks = await this.checkHealth();
    
    return {
      timestamp: new Date(),
      services: checks.map(c => ({
        name: c.service,
        status: c.status,
        responseTime: c.responseTime
      })),
      metrics: {
        avgResponseTime: this.calculateAverage('API_responseTime'),
        errorRate: await this.calculateErrorRate(),
        cacheHitRate: await this.calculateCacheHitRate(),
        activeUsers: await this.getActiveUsers()
      },
      trends: this.calculateTrends()
    };
  }

  /**
   * Calculate average for a metric
   */
  private calculateAverage(key: string): number {
    const values = this.metrics.get(key) || [];
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate error rate
   */
  private async calculateErrorRate(): Promise<number | null> {
    // Would fetch from CloudFlare Analytics or metrics endpoint
    return null;
  }

  /**
   * Calculate cache hit rate
   */
  private async calculateCacheHitRate(): Promise<number | null> {
    // Would fetch from cache statistics
    return null;
  }

  /**
   * Get active user count
   */
  private async getActiveUsers(): Promise<number | null> {
    // Would fetch from WebSocket connections or session store
    return null;
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends() {
    const trends: Record<string, 'improving' | 'stable' | 'degrading'> = {};
    
    for (const [key, values] of this.metrics) {
      if (values.length < 20) {
        trends[key] = 'stable';
        continue;
      }

      const recent = values.slice(-10);
      const previous = values.slice(-20, -10);
      
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;

      if (recentAvg < previousAvg * 0.9) {
        trends[key] = 'improving';
      } else if (recentAvg > previousAvg * 1.1) {
        trends[key] = 'degrading';
      } else {
        trends[key] = 'stable';
      }
    }
    
    return trends;
  }
}

/**
 * Scheduled health check handler
 */
export async function handleScheduledHealthCheck(env: any, sentry?: Toucan) {
  const monitor = new HealthMonitor(env, sentry);
  const results = await monitor.checkHealth();
  
  // Store results in KV for dashboard
  await env.KV.put('health:latest', JSON.stringify(results), {
    expirationTtl: 3600 // 1 hour
  });

  // Return summary
  const unhealthy = results.filter(r => r.status === 'unhealthy').length;
  const degraded = results.filter(r => r.status === 'degraded').length;
  
  return {
    timestamp: new Date(),
    healthy: unhealthy === 0 && degraded === 0,
    summary: {
      healthy: results.length - unhealthy - degraded,
      degraded,
      unhealthy
    },
    services: results
  };
}