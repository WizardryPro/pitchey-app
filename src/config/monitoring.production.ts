// Production Monitoring and Logging Configuration for Pitchey Platform
// This file contains all monitoring, logging, and observability configurations

export interface MonitoringConfig {
  logging: LoggingConfig;
  metrics: MetricsConfig;
  alerts: AlertsConfig;
  healthChecks: HealthCheckConfig;
  performance: PerformanceConfig;
  errorTracking: ErrorTrackingConfig;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  outputs: LogOutput[];
  sampling: SamplingConfig;
  retention: RetentionConfig;
  structured: StructuredLogging;
}

export interface LogOutput {
  type: 'console' | 'file' | 'external';
  enabled: boolean;
  config: Record<string, any>;
}

export interface SamplingConfig {
  enabled: boolean;
  rate: number;
  preserveErrors: boolean;
}

export interface RetentionConfig {
  days: number;
  maxSize: string;
  compression: boolean;
}

export interface StructuredLogging {
  includeTimestamp: boolean;
  includeLevel: boolean;
  includeRequestId: boolean;
  includeUserId: boolean;
  includeUserAgent: boolean;
  includeIP: boolean;
}

export interface MetricsConfig {
  enabled: boolean;
  endpoint: string;
  interval: number;
  customMetrics: CustomMetric[];
  systemMetrics: SystemMetrics;
  businessMetrics: BusinessMetrics;
}

export interface CustomMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description: string;
  labels: string[];
}

export interface SystemMetrics {
  cpu: boolean;
  memory: boolean;
  disk: boolean;
  network: boolean;
  requests: boolean;
  responses: boolean;
  errors: boolean;
}

export interface BusinessMetrics {
  userRegistrations: boolean;
  pitchCreations: boolean;
  investments: boolean;
  ndaRequests: boolean;
  fileUploads: boolean;
  searchQueries: boolean;
}

export interface AlertsConfig {
  enabled: boolean;
  channels: AlertChannel[];
  rules: AlertRule[];
  escalation: EscalationConfig;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  enabled: boolean;
  config: Record<string, any>;
}

export interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: string[];
  enabled: boolean;
}

export interface EscalationConfig {
  enabled: boolean;
  levels: EscalationLevel[];
}

export interface EscalationLevel {
  duration: number;
  channels: string[];
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  checks: HealthCheck[];
  endpoints: HealthCheckEndpoint[];
}

export interface HealthCheck {
  name: string;
  type: 'database' | 'redis' | 'external_api' | 'disk_space' | 'memory';
  config: Record<string, any>;
  critical: boolean;
}

export interface HealthCheckEndpoint {
  path: string;
  method: string;
  expectedStatus: number;
  timeout: number;
}

export interface PerformanceConfig {
  apm: APMConfig;
  profiling: ProfilingConfig;
  tracing: TracingConfig;
}

export interface APMConfig {
  enabled: boolean;
  service: string;
  version: string;
  environment: string;
  sampleRate: number;
}

export interface ProfilingConfig {
  enabled: boolean;
  interval: number;
  duration: number;
  includeHeap: boolean;
  includeCPU: boolean;
}

export interface TracingConfig {
  enabled: boolean;
  sampleRate: number;
  propagateTraceHeader: boolean;
  excludePaths: string[];
}

export interface ErrorTrackingConfig {
  enabled: boolean;
  service: 'sentry' | 'rollbar' | 'bugsnag' | 'custom';
  config: Record<string, any>;
  sampling: ErrorSamplingConfig;
  filtering: ErrorFilteringConfig;
}

export interface ErrorSamplingConfig {
  rate: number;
  preserveCritical: boolean;
  maxPerMinute: number;
}

export interface ErrorFilteringConfig {
  ignorePatterns: string[];
  allowedDomains: string[];
  ignorePaths: string[];
}

// Production Monitoring Configuration
export const productionMonitoringConfig: MonitoringConfig = {
  logging: {
    level: 'info',
    format: 'json',
    outputs: [
      {
        type: 'console',
        enabled: true,
        config: {
          colorize: false,
          timestamp: true
        }
      },
      {
        type: 'external',
        enabled: true,
        config: {
          service: 'cloudflare-logs',
          endpoint: process.env.LOG_ENDPOINT,
          headers: {
            'Authorization': `Bearer ${process.env.LOG_TOKEN}`
          }
        }
      }
    ],
    sampling: {
      enabled: true,
      rate: 0.1, // Sample 10% of debug/info logs
      preserveErrors: true
    },
    retention: {
      days: 30,
      maxSize: '10GB',
      compression: true
    },
    structured: {
      includeTimestamp: true,
      includeLevel: true,
      includeRequestId: true,
      includeUserId: true,
      includeUserAgent: false,
      includeIP: true
    }
  },

  metrics: {
    enabled: true,
    endpoint: '/metrics',
    interval: 60000, // 1 minute
    customMetrics: [
      {
        name: 'pitchey_user_registrations_total',
        type: 'counter',
        description: 'Total number of user registrations',
        labels: ['user_type', 'source']
      },
      {
        name: 'pitchey_pitch_creations_total',
        type: 'counter',
        description: 'Total number of pitches created',
        labels: ['category', 'user_type']
      },
      {
        name: 'pitchey_investment_requests_total',
        type: 'counter',
        description: 'Total number of investment requests',
        labels: ['pitch_category', 'amount_range']
      },
      {
        name: 'pitchey_nda_requests_total',
        type: 'counter',
        description: 'Total number of NDA requests',
        labels: ['status', 'requester_type']
      },
      {
        name: 'pitchey_file_uploads_total',
        type: 'counter',
        description: 'Total number of file uploads',
        labels: ['file_type', 'size_range']
      },
      {
        name: 'pitchey_search_queries_total',
        type: 'counter',
        description: 'Total number of search queries',
        labels: ['query_type', 'results_count']
      },
      {
        name: 'pitchey_websocket_connections',
        type: 'gauge',
        description: 'Current number of WebSocket connections',
        labels: ['user_type']
      },
      {
        name: 'pitchey_request_duration_seconds',
        type: 'histogram',
        description: 'Request duration in seconds',
        labels: ['method', 'route', 'status_code']
      },
      {
        name: 'pitchey_cache_hit_ratio',
        type: 'gauge',
        description: 'Cache hit ratio',
        labels: ['cache_type']
      }
    ],
    systemMetrics: {
      cpu: true,
      memory: true,
      disk: false, // Not applicable for serverless
      network: true,
      requests: true,
      responses: true,
      errors: true
    },
    businessMetrics: {
      userRegistrations: true,
      pitchCreations: true,
      investments: true,
      ndaRequests: true,
      fileUploads: true,
      searchQueries: true
    }
  },

  alerts: {
    enabled: true,
    channels: [
      {
        type: 'email',
        enabled: true,
        config: {
          smtp: {
            host: process.env.SMTP_HOST,
            port: 587,
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          },
          from: 'alerts@pitchey.com',
          to: ['ops@pitchey.com', 'dev@pitchey.com']
        }
      },
      {
        type: 'webhook',
        enabled: true,
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ALERT_WEBHOOK_TOKEN}`
          }
        }
      }
    ],
    rules: [
      {
        name: 'High Error Rate',
        condition: 'error_rate > 0.05',
        threshold: 0.05,
        duration: 300, // 5 minutes
        severity: 'high',
        channels: ['email', 'webhook'],
        enabled: true
      },
      {
        name: 'High Response Time',
        condition: 'avg_response_time > 2000',
        threshold: 2000,
        duration: 300,
        severity: 'medium',
        channels: ['webhook'],
        enabled: true
      },
      {
        name: 'Database Connection Failure',
        condition: 'database_connection_failure',
        threshold: 1,
        duration: 60,
        severity: 'critical',
        channels: ['email', 'webhook'],
        enabled: true
      },
      {
        name: 'Redis Connection Failure',
        condition: 'redis_connection_failure',
        threshold: 1,
        duration: 60,
        severity: 'high',
        channels: ['email', 'webhook'],
        enabled: true
      },
      {
        name: 'Memory Usage High',
        condition: 'memory_usage > 0.85',
        threshold: 0.85,
        duration: 600,
        severity: 'medium',
        channels: ['webhook'],
        enabled: true
      },
      {
        name: 'Too Many Failed Logins',
        condition: 'failed_login_rate > 0.1',
        threshold: 0.1,
        duration: 300,
        severity: 'medium',
        channels: ['email'],
        enabled: true
      }
    ],
    escalation: {
      enabled: true,
      levels: [
        {
          duration: 900, // 15 minutes
          channels: ['webhook']
        },
        {
          duration: 1800, // 30 minutes
          channels: ['email']
        }
      ]
    }
  },

  healthChecks: {
    enabled: true,
    interval: 30000, // 30 seconds
    timeout: 5000,
    checks: [
      {
        name: 'database',
        type: 'database',
        config: {
          query: 'SELECT 1',
          timeout: 5000
        },
        critical: true
      },
      {
        name: 'redis',
        type: 'redis',
        config: {
          command: 'ping',
          timeout: 3000
        },
        critical: false
      },
      {
        name: 'stripe',
        type: 'external_api',
        config: {
          url: 'https://api.stripe.com/v1/balance',
          headers: {
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
          },
          timeout: 5000
        },
        critical: false
      }
    ],
    endpoints: [
      {
        path: '/api/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 3000
      },
      {
        path: '/api/health/detailed',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000
      }
    ]
  },

  performance: {
    apm: {
      enabled: true,
      service: 'pitchey-api',
      version: process.env.APP_VERSION || '1.0.0',
      environment: 'production',
      sampleRate: 0.1
    },
    profiling: {
      enabled: false, // Enable only when needed
      interval: 60000,
      duration: 30000,
      includeHeap: true,
      includeCPU: true
    },
    tracing: {
      enabled: true,
      sampleRate: 0.1,
      propagateTraceHeader: true,
      excludePaths: [
        '/health',
        '/metrics',
        '/favicon.ico'
      ]
    }
  },

  errorTracking: {
    enabled: true,
    service: 'sentry',
    config: {
      dsn: process.env.SENTRY_DSN,
      environment: 'production',
      release: process.env.APP_VERSION || '1.0.0',
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.1,
      beforeSend: (event: any) => {
        // Filter out non-critical errors
        if (event.level === 'info' || event.level === 'debug') {
          return null;
        }
        return event;
      }
    },
    sampling: {
      rate: 1.0, // Capture all errors in production
      preserveCritical: true,
      maxPerMinute: 100
    },
    filtering: {
      ignorePatterns: [
        'Network request failed',
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured'
      ],
      allowedDomains: [
        'pitchey.pages.dev',
        'pitchey.com',
        'ndlovucavelle.workers.dev'
      ],
      ignorePaths: [
        '/health',
        '/metrics',
        '/favicon.ico'
      ]
    }
  }
};

// Environment-specific monitoring configurations
export const getMonitoringConfig = (environment: string = 'production'): MonitoringConfig => {
  switch (environment) {
    case 'development':
      return {
        ...productionMonitoringConfig,
        logging: {
          ...productionMonitoringConfig.logging,
          level: 'debug',
          outputs: [
            {
              type: 'console',
              enabled: true,
              config: {
                colorize: true,
                timestamp: true
              }
            }
          ],
          sampling: {
            enabled: false,
            rate: 1.0,
            preserveErrors: true
          }
        },
        alerts: {
          ...productionMonitoringConfig.alerts,
          enabled: false
        },
        errorTracking: {
          ...productionMonitoringConfig.errorTracking,
          enabled: false
        }
      };
    
    case 'staging':
      return {
        ...productionMonitoringConfig,
        logging: {
          ...productionMonitoringConfig.logging,
          level: 'debug',
          sampling: {
            enabled: false,
            rate: 1.0,
            preserveErrors: true
          }
        },
        alerts: {
          ...productionMonitoringConfig.alerts,
          rules: productionMonitoringConfig.alerts.rules.map(rule => ({
            ...rule,
            channels: ['webhook'] // Only webhook alerts in staging
          }))
        }
      };
    
    default:
      return productionMonitoringConfig;
  }
};

// Monitoring utilities
export class MonitoringService {
  private config: MonitoringConfig;
  private startTime: number;

  constructor(environment: string = 'production') {
    this.config = getMonitoringConfig(environment);
    this.startTime = Date.now();
  }

  // Log structured messages
  log(level: string, message: string, meta: Record<string, any> = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
      ...(this.config.logging.structured.includeTimestamp && { timestamp: new Date().toISOString() }),
      ...(this.config.logging.structured.includeLevel && { level }),
      environment: process.env.NODE_ENV || 'development'
    };

    console.log(JSON.stringify(logEntry));
  }

  // Record custom metrics
  recordMetric(name: string, value: number, labels: Record<string, string> = {}) {
    const metric = {
      name,
      value,
      labels,
      timestamp: Date.now()
    };

    // In production, send to metrics collector
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement metrics collection
    }
  }

  // Track performance
  trackPerformance(operation: string, duration: number, metadata: Record<string, any> = {}) {
    this.recordMetric('operation_duration_ms', duration, { operation });
    
    if (duration > 1000) { // Log slow operations
      this.log('warn', `Slow operation detected: ${operation}`, {
        duration,
        ...metadata
      });
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; checks: Record<string, any> }> {
    const checks: Record<string, any> = {};
    let overall = 'healthy';

    for (const check of this.config.healthChecks.checks) {
      try {
        const result = await this.runHealthCheck(check);
        checks[check.name] = { status: 'healthy', ...result };
      } catch (error) {
        checks[check.name] = { status: 'unhealthy', error: error.message };
        if (check.critical) {
          overall = 'unhealthy';
        }
      }
    }

    return {
      status: overall,
      checks,
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString()
    };
  }

  private async runHealthCheck(check: HealthCheck): Promise<any> {
    switch (check.type) {
      case 'database':
        // TODO: Implement database health check
        return { latency: 10 };
      case 'redis':
        // TODO: Implement Redis health check
        return { latency: 5 };
      case 'external_api':
        // TODO: Implement external API health check
        return { latency: 50 };
      default:
        throw new Error(`Unknown health check type: ${check.type}`);
    }
  }
}

// Export singleton instance
export const monitoring = new MonitoringService(process.env.NODE_ENV);