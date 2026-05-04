/**
 * Comprehensive Cloudflare Worker Container Integration Module
 * Orchestrates all container services for the Pitchey platform
 */

import { DatabaseConnectionManager, CachedQueryExecutor } from '../config/hyperdrive-config';
import { ContainerOrchestrator, ContainerJob, ContainerMetrics } from '../services/container-orchestrator';
import { ApiResponseBuilder, ErrorCode, errorHandler } from '../utils/api-response';
import { getCorsHeaders } from '../utils/response';
import { createSessionStore } from '../auth/session-store';
import { parseSessionCookie } from '../config/session.config';
import { PortalAccessController } from '../middleware/portal-access-control';
import { KVCacheService } from '../services/kv-cache.service';
import type { Env } from '../worker-integrated';

export interface ContainerWorkerConfig {
  enableRateLimit: boolean;
  defaultTimeout: number;
  maxRetries: number;
  cacheEnabled: boolean;
  monitoringEnabled: boolean;
}

export interface ContainerRequest {
  endpoint: string;
  method: string;
  body: any;
  headers: Headers;
  user: any;
  portalType: string;
}

export interface ContainerResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    jobId?: string;
    estimatedTime?: number;
    cost?: number;
  };
}

/**
 * Main Container Worker Integration Class
 */
export class ContainerWorkerIntegration {
  private dbManager: DatabaseConnectionManager;
  private orchestrator: ContainerOrchestrator;
  private cache: KVCacheService;
  private accessController: PortalAccessController;
  private apiGateway: APIGatewayLayer;
  private auth: AuthenticationIntegration;
  private queueProcessor: QueueProcessor;
  private realTimeManager: RealTimeManager;
  private monitoring: MonitoringAnalytics;
  private config: ContainerWorkerConfig;

  constructor(private env: Env, config: Partial<ContainerWorkerConfig> = {}) {
    this.config = {
      enableRateLimit: true,
      defaultTimeout: 300000, // 5 minutes
      maxRetries: 3,
      cacheEnabled: true,
      monitoringEnabled: true,
      ...config
    };

    this.dbManager = new DatabaseConnectionManager(env);
    this.orchestrator = new ContainerOrchestrator(env);
    this.cache = new KVCacheService(env.CACHE);
    this.accessController = new PortalAccessController(env as any);
    this.apiGateway = new APIGatewayLayer(env, this.config);
    this.auth = new AuthenticationIntegration(env);
    this.queueProcessor = new QueueProcessor(env, this.orchestrator);
    this.realTimeManager = new RealTimeManager(env);
    this.monitoring = new MonitoringAnalytics(env, this.dbManager);
  }

  /**
   * Main request handler for container endpoints
   */
  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const startTime = Date.now();

    try {
      // CORS handling
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: getCorsHeaders() });
      }

      // Authentication
      const authResult = await this.auth.validateRequest(request);
      if (!authResult.success) {
        return this.errorResponse('Authentication failed', 401, authResult.error);
      }

      // Rate limiting
      if (this.config.enableRateLimit) {
        const rateLimitResult = await this.apiGateway.checkRateLimit(request, authResult.user);
        if (!rateLimitResult.allowed) {
          return this.errorResponse('Rate limit exceeded', 429);
        }
      }

      // Route to appropriate handler
      const response = await this.routeRequest(request, authResult.user);

      // Add monitoring metrics
      if (this.config.monitoringEnabled) {
        await this.monitoring.logRequest({
          path: url.pathname,
          method: request.method,
          userId: authResult.user.id,
          duration: Date.now() - startTime,
          statusCode: response.status
        });
      }

      return response;

    } catch (error) {
      console.error('Container request error:', error);
      await this.monitoring.logError({
        error: error as Error,
        path: url.pathname,
        method: request.method,
        timestamp: new Date()
      });

      return this.errorResponse('Internal server error', 500, (error as Error).message);
    }
  }

  /**
   * Route requests to appropriate handlers
   */
  private async routeRequest(request: Request, user: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Container job management
    if (path.startsWith('/api/containers/jobs')) {
      return this.handleJobEndpoints(request, user);
    }

    // Container instances management
    if (path.startsWith('/api/containers/instances')) {
      return this.handleInstanceEndpoints(request as any, user);
    }

    // Container metrics and monitoring
    if (path.startsWith('/api/containers/metrics')) {
      return this.handleMetricsEndpoints(request, user);
    }

    // Container processing endpoints
    if (path.startsWith('/api/containers/process')) {
      return this.handleProcessingEndpoints(request, user);
    }

    // Container configuration
    if (path.startsWith('/api/containers/config')) {
      return this.handleConfigEndpoints(request as any, user);
    }

    // WebSocket upgrade for real-time updates
    if (path === '/api/containers/ws' && request.headers.get('upgrade') === 'websocket') {
      return this.realTimeManager.handleWebSocketUpgrade(request, user);
    }

    return this.errorResponse('Endpoint not found', 404);
  }

  /**
   * Handle job management endpoints
   */
  private async handleJobEndpoints(request: Request, user: any): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const pathParts = url.pathname.split('/');

    switch (method) {
      case 'GET':
        if (pathParts[4]) {
          // GET /api/containers/jobs/{id}
          return this.getJobStatus(pathParts[4], user);
        } else {
          // GET /api/containers/jobs
          return this.listJobs(url.searchParams, user);
        }

      case 'POST':
        // POST /api/containers/jobs
        const jobData = await request.json() as Record<string, unknown>;
        return this.createJob(jobData, user);

      case 'DELETE':
        if (pathParts[4]) {
          // DELETE /api/containers/jobs/{id}
          return this.cancelJob(pathParts[4] as any, user);
        }
        break;

      default:
        return this.errorResponse('Method not allowed', 405);
    }

    return this.errorResponse('Invalid endpoint', 400);
  }

  /**
   * Handle processing endpoints
   */
  private async handleProcessingEndpoints(request: Request, user: any): Promise<Response> {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const processingType = pathParts[4]; // video, document, ai, media, code

    if (request.method !== 'POST') {
      return this.errorResponse('Method not allowed', 405);
    }

    const data = await request.json() as Record<string, unknown>;

    // Validate portal access for processing type
    const hasAccess = await this.accessController.validatePortalAccess(
      request as any,
      user.portal_type as any,
      user
    );

    if (!hasAccess) {
      return this.errorResponse('Access denied for this processing type', 403);
    }

    try {
      const jobId = await this.queueProcessor.submitProcessingJob(
        processingType as ContainerJob['type'],
        data,
        user
      );

      return this.successResponse({
        jobId,
        status: 'queued',
        estimatedTime: this.getEstimatedProcessingTime(processingType, data),
        websocketUrl: `wss://${url.host}/api/containers/ws?jobId=${jobId}`
      });

    } catch (error) {
      return this.errorResponse('Failed to queue job', 500, (error as Error).message);
    }
  }

  /**
   * Handle metrics endpoints
   */
  private async handleMetricsEndpoints(request: Request, user: any): Promise<Response> {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const metricsType = pathParts[4]; // dashboard, costs, performance

    // Check admin access for detailed metrics
    if (metricsType !== 'dashboard' && !user.roles?.includes('admin')) {
      return this.errorResponse('Admin access required', 403);
    }

    switch (metricsType) {
      case 'dashboard':
        return this.getDashboardMetrics(user);

      case 'costs':
        return this.getCostMetrics(url.searchParams as any);

      case 'performance':
        return this.getPerformanceMetrics(url.searchParams as any);

      case 'health':
        return this.getHealthMetrics() as any;

      default:
        return this.errorResponse('Invalid metrics type', 400);
    }
  }

  /**
   * Create a new container job
   */
  private async createJob(data: any, user: any): Promise<Response> {
    try {
      const { type, payload, priority = 'medium' } = data;

      // Validate job type
      if (!this.isValidJobType(type)) {
        return this.errorResponse('Invalid job type', 400);
      }

      // Check rate limits for job creation
      const rateLimitKey = `job_creation:${user.id}`;
      const rateLimitResult = await this.apiGateway.checkRateLimit(
        rateLimitKey,
        10, // 10 jobs per minute
        60
      );

      if (!rateLimitResult.allowed) {
        return this.errorResponse('Job creation rate limit exceeded', 429);
      }

      // Submit job
      const jobId = await this.orchestrator.submitJob({
        type,
        payload,
        priority
      });

      // Cache job for quick access
      await this.cache.set(`job:${jobId}`, {
        id: jobId,
        type,
        status: 'pending',
        createdBy: user.id,
        createdAt: new Date()
      }, { ttl: 3600 });

      return this.successResponse({
        jobId,
        status: 'queued',
        estimatedTime: this.getEstimatedProcessingTime(type, payload)
      });

    } catch (error) {
      return this.errorResponse('Failed to create job', 500, (error as Error).message);
    }
  }

  /**
   * Get job status
   */
  private async getJobStatus(jobId: string, user: any): Promise<Response> {
    try {
      // Check cache first
      let job = await this.cache.get(`job:${jobId}`);
      
      if (!job) {
        // Get from database
        job = await this.orchestrator.getJobStatus(jobId);
        if (job) {
          await this.cache.set(`job:${jobId}`, job, { ttl: 300 }); // Cache for 5 minutes
        }
      }

      if (!job) {
        return this.errorResponse('Job not found', 404);
      }

      // Check access permissions
      if (job.created_by !== user.id && !user.roles?.includes('admin')) {
        return this.errorResponse('Access denied', 403);
      }

      return this.successResponse(job);

    } catch (error) {
      return this.errorResponse('Failed to get job status', 500, (error as Error).message);
    }
  }

  /**
   * List jobs with filtering
   */
  private async listJobs(searchParams: URLSearchParams, user: any): Promise<Response> {
    try {
      const filters = {
        status: searchParams.get('status'),
        type: searchParams.get('type'),
        limit: parseInt(searchParams.get('limit') || '20'),
        offset: parseInt(searchParams.get('offset') || '0'),
        userId: user.roles?.includes('admin') ? searchParams.get('userId') : user.id
      };

      const cacheKey = `jobs:${JSON.stringify(filters)}`;
      let jobs = await this.cache.get(cacheKey);

      if (!jobs) {
        const db = this.dbManager.getConnection('read');
        const whereConditions = [];
        const values = [];

        if (filters.status) {
          whereConditions.push(`status = $${values.length + 1}`);
          values.push(filters.status);
        }

        if (filters.type) {
          whereConditions.push(`type = $${values.length + 1}`);
          values.push(filters.type);
        }

        if (filters.userId) {
          whereConditions.push(`created_by = $${values.length + 1}`);
          values.push(filters.userId);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        jobs = await db.unsafe(`
          SELECT id, type, status, created_at, started_at, completed_at, 
                 processing_time_seconds, estimated_cost_usd, error_message
          FROM container_jobs
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}
        `, [...values, filters.limit, filters.offset]);

        await this.cache.set(cacheKey, jobs, { ttl: 60 }); // Cache for 1 minute
      }

      return this.successResponse({
        jobs,
        total: jobs.length,
        filters
      });

    } catch (error) {
      return this.errorResponse('Failed to list jobs', 500, (error as Error).message);
    }
  }

  /**
   * Get dashboard metrics
   */
  private async getDashboardMetrics(user: any): Promise<Response> {
    try {
      const cacheKey = `dashboard_metrics:${user.id}`;
      let metrics = await this.cache.get(cacheKey);

      if (!metrics) {
        const containerMetrics = await this.orchestrator.getContainerMetrics();
        const userJobCount = await this.getUserJobCount(user.id);
        const userCostToday = await this.getUserCostToday(user.id);

        metrics = {
          ...containerMetrics,
          userStats: {
            totalJobs: userJobCount.total,
            completedJobs: userJobCount.completed,
            failedJobs: userJobCount.failed,
            costToday: userCostToday
          },
          healthStatus: await this.orchestrator.healthCheck()
        };

        await this.cache.set(cacheKey, metrics, { ttl: 60 }); // Cache for 1 minute
      }

      return this.successResponse(metrics);

    } catch (error) {
      return this.errorResponse('Failed to get dashboard metrics', 500, (error as Error).message);
    }
  }

  /**
   * Stub methods for instance, config, cancel, and detailed metric endpoints
   */
  private async handleInstanceEndpoints(_request: any, _user: any): Promise<Response> {
    return this.successResponse({ instances: [] });
  }

  private async handleConfigEndpoints(_request: any, _user: any): Promise<Response> {
    return this.successResponse({ config: this.config });
  }

  private async cancelJob(jobId: string, _user: any): Promise<Response> {
    return this.successResponse({ cancelled: true, jobId });
  }

  private async getCostMetrics(_searchParams: any): Promise<Response> {
    return this.successResponse({ costs: [] });
  }

  private async getPerformanceMetrics(_searchParams: any): Promise<Response> {
    return this.successResponse({ performance: [] });
  }

  private async getHealthMetrics(): Promise<Response> {
    return this.successResponse({ health: await this.orchestrator.healthCheck() });
  }

  /**
   * Helper methods
   */
  private isValidJobType(type: string): boolean {
    const validTypes = ['video-processing', 'document-processing', 'ai-inference', 'media-transcoding', 'code-execution'];
    return validTypes.includes(type);
  }

  private getEstimatedProcessingTime(type: string, payload: any): number {
    // Estimate processing time based on job type and payload
    const estimates = {
      'video-processing': 120, // 2 minutes base
      'document-processing': 30, // 30 seconds base
      'ai-inference': 60, // 1 minute base
      'media-transcoding': 90, // 1.5 minutes base
      'code-execution': 10 // 10 seconds base
    };

    return estimates[type as keyof typeof estimates] || 60;
  }

  private async getUserJobCount(userId: string): Promise<any> {
    const db = this.dbManager.getConnection('read');
    const result = await db`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM container_jobs
      WHERE created_by = ${userId}
        AND created_at > NOW() - INTERVAL '24 hours'
    `;

    return result[0];
  }

  private async getUserCostToday(userId: string): Promise<number> {
    const db = this.dbManager.getConnection('read');
    const result = await db`
      SELECT SUM(estimated_cost_usd) as total_cost
      FROM container_jobs
      WHERE created_by = ${userId}
        AND DATE(created_at) = CURRENT_DATE
        AND status = 'completed'
    `;

    return parseFloat(result[0].total_cost) || 0;
  }

  private successResponse(data: any): Response {
    return new ApiResponseBuilder().success(data);
  }

  private errorResponse(message: string, status: number, details?: string): Response {
    return new ApiResponseBuilder().error(ErrorCode.VALIDATION_ERROR, message, details, status);
  }
}

/**
 * API Gateway Layer for unified endpoint management
 */
export class APIGatewayLayer {
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(private env: Env, private config: ContainerWorkerConfig) {}

  async checkRateLimit(
    identifier: string | Request,
    limit: number = 100,
    windowSeconds: number = 60
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = typeof identifier === 'string' ? identifier : this.getRateLimitKey(identifier);
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    let entry = this.rateLimits.get(key);
    
    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      this.rateLimits.set(key, entry);
    }

    if (entry.count >= limit) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    entry.count++;
    return { allowed: true, remaining: limit - entry.count, resetTime: entry.resetTime };
  }

  private getRateLimitKey(request: Request): string {
    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    return `${ip}:${url.pathname}:${userAgent}`;
  }

  async transformRequest(request: Request): Promise<Request> {
    // Request transformation logic
    return request;
  }

  async transformResponse(response: Response): Promise<Response> {
    // Response transformation logic
    return response;
  }
}

export class AuthenticationIntegration {
  constructor(private env: Env) {}

  async validateRequest(request: Request): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const store = createSessionStore(this.env as any);

      const sessionId = this.extractSessionFromCookie(request.headers.get('Cookie') || '');

      if (!sessionId) {
        return { success: false, error: 'No session found' };
      }

      const session = await store.findSession(sessionId);

      if (!session) {
        return { success: false, error: 'Invalid session' };
      }

      return { success: true, user: session };

    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private extractSessionFromCookie(cookieHeader: string): string | null {
    return parseSessionCookie(cookieHeader);
  }
}

/**
 * Queue Processor for optimized batch operations
 */
export class QueueProcessor {
  constructor(private env: Env, private orchestrator: ContainerOrchestrator) {}

  async submitProcessingJob(
    type: ContainerJob['type'],
    data: any,
    user: any
  ): Promise<string> {
    const jobId = await this.orchestrator.submitJob({
      type,
      payload: { ...data, userId: user.id },
      priority: this.calculatePriority(type, data, user)
    });

    // Store job in KV for quick access
    await this.env.JOB_STATUS_KV.put(
      `job:${jobId}`,
      JSON.stringify({
        id: jobId,
        type,
        status: 'pending',
        createdBy: user.id,
        createdAt: new Date(),
        data
      }),
      { expirationTtl: 86400 }
    );

    return jobId;
  }

  private calculatePriority(
    type: ContainerJob['type'],
    data: any,
    user: any
  ): ContainerJob['priority'] {
    // Calculate priority based on user subscription, job type, and data size
    if (user.subscription?.tier === 'premium') return 'high';
    if (type === 'ai-inference') return 'high';
    if (data.urgent === true) return 'high';
    return 'medium';
  }
}

/**
 * Real-time Manager for WebSocket integration
 */
export class RealTimeManager {
  constructor(private env: Env) {}

  async handleWebSocketUpgrade(request: Request, user: any): Promise<Response> {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return new Response('Job ID required', { status: 400 });
    }

    // Create WebSocket pair
    const [client, server] = Object.values(new WebSocketPair());

    // Accept the WebSocket connection
    server.accept();

    // Set up real-time job progress tracking
    this.setupJobProgressTracking(server, jobId, user);

    return new Response(null, { status: 101, webSocket: client });
  }

  private setupJobProgressTracking(websocket: WebSocket, jobId: string, user: any): void {
    const interval = setInterval(async () => {
      try {
        // Check job status from KV
        const jobStatus = await this.env.JOB_STATUS_KV.get(`job:${jobId}`, 'json');
        
        if (jobStatus) {
          websocket.send(JSON.stringify({
            type: 'job_update',
            jobId,
            status: jobStatus.status,
            progress: jobStatus.progress,
            timestamp: new Date()
          }));

          // Stop tracking if job is complete or failed
          if (['completed', 'failed'].includes(jobStatus.status)) {
            clearInterval(interval);
            websocket.close();
          }
        }
      } catch (error) {
        console.error('WebSocket job tracking error:', error);
        clearInterval(interval);
        websocket.close();
      }
    }, 2000); // Check every 2 seconds

    websocket.addEventListener('close', () => {
      clearInterval(interval);
    });
  }
}

/**
 * Monitoring and Analytics
 */
export class MonitoringAnalytics {
  constructor(private env: Env, private dbManager: DatabaseConnectionManager) {}

  async logRequest(data: {
    path: string;
    method: string;
    userId: string;
    duration: number;
    statusCode: number;
  }): Promise<void> {
    try {
      const db = this.dbManager.getConnection('write');
      await db`
        INSERT INTO container_metrics (
          timestamp, metric_type, metrics
        ) VALUES (
          NOW(), 'request_log', ${JSON.stringify(data)}
        )
      `;
    } catch (error) {
      console.error('Failed to log request metrics:', error);
    }
  }

  async logError(data: {
    error: Error;
    path: string;
    method: string;
    timestamp: Date;
  }): Promise<void> {
    try {
      const db = this.dbManager.getConnection('write');
      await db`
        INSERT INTO container_metrics (
          timestamp, metric_type, metrics
        ) VALUES (
          ${data.timestamp}, 'error_log', ${JSON.stringify({
            message: data.error.message,
            stack: data.error.stack,
            path: data.path,
            method: data.method
          })}
        )
      `;
    } catch (error) {
      console.error('Failed to log error metrics:', error);
    }
  }
}