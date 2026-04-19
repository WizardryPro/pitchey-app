// A/B Testing API Routes
import { Router } from 'express';
import { z } from 'zod';
import ABTestingService from '../services/ab-testing.service.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateRequest } from '../middleware/validation.js';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Rate limiting for A/B testing endpoints
const experimentCreateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 experiment creations per windowMs
  message: 'Too many experiments created, please try again later'
});

const trackingLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 1000 tracking events per minute
  message: 'Too many tracking events, please slow down'
});

// Validation schemas
const createExperimentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  variants: z.array(z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    trafficAllocation: z.number().min(0).max(1),
    config: z.record(z.string(), z.any())
  })).min(2),
  trafficAllocation: z.number().min(0).max(1),
  targetingRules: z.record(z.string(), z.any()).default({}),
  userSegments: z.array(z.string()).default([]),
  primaryMetric: z.string().min(1).max(100),
  secondaryMetrics: z.array(z.string()).default([]),
  minimumSampleSize: z.number().int().min(10).default(100),
  statisticalPower: z.number().min(0).max(1).default(0.8),
  significanceLevel: z.number().min(0).max(1).default(0.05),
  tags: z.array(z.string()).default([])
});

const updateExperimentSchema = createExperimentSchema.partial();

const assignmentRequestSchema = z.object({
  experimentIds: z.array(z.number()).optional(),
  userContext: z.object({
    userId: z.number().optional(),
    sessionId: z.string().optional(),
    userType: z.string().optional(),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    referrer: z.string().optional(),
    customProperties: z.record(z.string(), z.any()).optional()
  })
});

const trackEventSchema = z.object({
  experimentId: z.number(),
  variantId: z.string(),
  eventType: z.string().min(1).max(100),
  userContext: z.object({
    userId: z.number().optional(),
    sessionId: z.string().optional(),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional()
  }),
  eventData: z.object({
    eventName: z.string().optional(),
    eventValue: z.number().optional(),
    properties: z.record(z.string(), z.any()).optional(),
    url: z.string().optional(),
    elementId: z.string().optional(),
    elementText: z.string().optional()
  }).optional()
});

const featureFlagRequestSchema = z.object({
  flagKey: z.string().min(1).max(255),
  userContext: z.object({
    userId: z.number().optional(),
    sessionId: z.string().optional(),
    userType: z.string().optional(),
    customProperties: z.record(z.string(), z.any()).optional()
  }),
  defaultValue: z.any()
});

// Middleware to extract user context from request
const extractUserContext = (req: any, res: any, next: any) => {
  req.userContext = {
    userId: req.user?.id,
    sessionId: req.sessionId || req.headers['x-session-id'],
    userType: req.user?.userType,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip || req.connection.remoteAddress,
    referrer: req.headers['referer'] || req.headers['referrer']
  };
  next();
};

// Routes

/**
 * Create a new experiment
 * POST /api/experiments
 * Requires admin role
 */
router.post('/', 
  experimentCreateLimit,
  authenticateToken,
  requireRole(['admin']),
  validateRequest(createExperimentSchema),
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const experiment = await ABTestingService.createExperiment(req.body, userId);
      
      res.status(201).json({
        success: true,
        data: experiment,
        message: 'Experiment created successfully'
      });
    } catch (error: any) {
      console.error('Error creating experiment:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create experiment'
      });
    }
  }
);

/**
 * List experiments
 * GET /api/experiments
 * Requires admin role
 */
router.get('/',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const {
        status,
        tags,
        createdBy,
        limit = 20,
        offset = 0,
        orderBy = 'created',
        orderDirection = 'desc'
      } = req.query;

      const options = {
        status: status ? (Array.isArray(status) ? status : [status]) as string[] : undefined,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) as string[] : undefined,
        createdBy: createdBy ? parseInt(createdBy as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        orderBy: orderBy as 'created' | 'updated' | 'name',
        orderDirection: orderDirection as 'asc' | 'desc'
      };

      const result = await ABTestingService.listExperiments(options);
      
      res.json({
        success: true,
        data: result.experiments,
        pagination: {
          total: result.total,
          limit: options.limit,
          offset: options.offset,
          hasMore: result.total > options.offset + options.limit
        }
      });
    } catch (error: any) {
      console.error('Error listing experiments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list experiments'
      });
    }
  }
);

/**
 * Get experiment details
 * GET /api/experiments/:id
 * Requires admin role
 */
router.get('/:id',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const experimentId = parseInt(req.params.id);
      if (isNaN(experimentId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid experiment ID'
        });
      }

      // Get experiment details (this would need to be implemented in the service)
      const experiment = await ABTestingService['getExperiment'](experimentId);
      
      if (!experiment) {
        return res.status(404).json({
          success: false,
          error: 'Experiment not found'
        });
      }

      res.json({
        success: true,
        data: experiment
      });
    } catch (error: any) {
      console.error('Error getting experiment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get experiment'
      });
    }
  }
);

/**
 * Start an experiment
 * POST /api/experiments/:id/start
 * Requires admin role
 */
router.post('/:id/start',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const experimentId = parseInt(req.params.id);
      const userId = req.user!.id;

      await ABTestingService.startExperiment(experimentId, userId);
      
      res.json({
        success: true,
        message: 'Experiment started successfully'
      });
    } catch (error: any) {
      console.error('Error starting experiment:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to start experiment'
      });
    }
  }
);

/**
 * Pause an experiment
 * POST /api/experiments/:id/pause
 * Requires admin role
 */
router.post('/:id/pause',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const experimentId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { reason } = req.body;

      await ABTestingService.pauseExperiment(experimentId, userId, reason);
      
      res.json({
        success: true,
        message: 'Experiment paused successfully'
      });
    } catch (error: any) {
      console.error('Error pausing experiment:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to pause experiment'
      });
    }
  }
);

/**
 * Complete an experiment
 * POST /api/experiments/:id/complete
 * Requires admin role
 */
router.post('/:id/complete',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const experimentId = parseInt(req.params.id);
      const userId = req.user!.id;

      await ABTestingService.completeExperiment(experimentId, userId);
      
      res.json({
        success: true,
        message: 'Experiment completed successfully'
      });
    } catch (error: any) {
      console.error('Error completing experiment:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to complete experiment'
      });
    }
  }
);

/**
 * Get experiment results
 * GET /api/experiments/:id/results
 * Requires admin role
 */
router.get('/:id/results',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const experimentId = parseInt(req.params.id);

      const results = await ABTestingService.getExperimentResults(experimentId);
      
      if (!results) {
        return res.status(404).json({
          success: false,
          error: 'Experiment results not found'
        });
      }

      res.json({
        success: true,
        data: results
      });
    } catch (error: any) {
      console.error('Error getting experiment results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get experiment results'
      });
    }
  }
);

/**
 * Calculate experiment results
 * POST /api/experiments/:id/calculate-results
 * Requires admin role
 */
router.post('/:id/calculate-results',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const experimentId = parseInt(req.params.id);

      const results = await ABTestingService.calculateExperimentResults(experimentId);
      
      res.json({
        success: true,
        data: results,
        message: 'Experiment results calculated successfully'
      });
    } catch (error: any) {
      console.error('Error calculating experiment results:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to calculate experiment results'
      });
    }
  }
);

/**
 * Get user experiment assignments
 * POST /api/experiments/assignments
 * Public endpoint (with rate limiting)
 */
router.post('/assignments',
  trackingLimit,
  extractUserContext,
  validateRequest(assignmentRequestSchema),
  async (req, res) => {
    try {
      const { userContext, experimentIds } = req.body;

      // Merge request user context with extracted context
      const mergedContext = {
        ...req.userContext,
        ...userContext
      };

      let assignments = [];

      if (experimentIds && experimentIds.length > 0) {
        // Get assignments for specific experiments
        assignments = await Promise.all(
          experimentIds.map(async (experimentId: number) => {
            return await ABTestingService.assignUserToExperiment(experimentId, mergedContext);
          })
        );
        assignments = assignments.filter(assignment => assignment !== null);
      } else {
        // Get all user assignments
        assignments = await ABTestingService.getUserExperimentAssignments(
          mergedContext.userId,
          mergedContext.sessionId
        );
      }

      res.json({
        success: true,
        data: assignments
      });
    } catch (error: any) {
      console.error('Error getting experiment assignments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get experiment assignments'
      });
    }
  }
);

/**
 * Track experiment event
 * POST /api/experiments/track
 * Public endpoint (with rate limiting)
 */
router.post('/track',
  trackingLimit,
  extractUserContext,
  validateRequest(trackEventSchema),
  async (req, res) => {
    try {
      const { experimentId, variantId, eventType, userContext, eventData } = req.body;

      // Merge request user context with extracted context
      const mergedContext = {
        ...req.userContext,
        ...userContext
      };

      await ABTestingService.trackExperimentEvent(
        experimentId,
        variantId,
        eventType,
        mergedContext,
        eventData
      );

      res.json({
        success: true,
        message: 'Event tracked successfully'
      });
    } catch (error: any) {
      console.error('Error tracking experiment event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track event'
      });
    }
  }
);

/**
 * Get feature flag value
 * POST /api/experiments/feature-flag
 * Public endpoint (with rate limiting)
 */
router.post('/feature-flag',
  trackingLimit,
  extractUserContext,
  validateRequest(featureFlagRequestSchema),
  async (req, res) => {
    try {
      const { flagKey, userContext, defaultValue } = req.body;

      // Merge request user context with extracted context
      const mergedContext = {
        ...req.userContext,
        ...userContext
      };

      const value = await ABTestingService.getFeatureFlagValue(
        flagKey,
        mergedContext,
        defaultValue
      );

      res.json({
        success: true,
        data: {
          flagKey,
          value,
          defaultValue
        }
      });
    } catch (error: any) {
      console.error('Error getting feature flag:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get feature flag value'
      });
    }
  }
);

/**
 * Batch track multiple events
 * POST /api/experiments/track/batch
 * Public endpoint (with rate limiting)
 */
router.post('/track/batch',
  trackingLimit,
  extractUserContext,
  async (req, res) => {
    try {
      const { events } = req.body;

      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Events array is required'
        });
      }

      if (events.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 100 events per batch'
        });
      }

      // Process events in parallel
      const results = await Promise.allSettled(
        events.map(async (event: any) => {
          const mergedContext = {
            ...req.userContext,
            ...event.userContext
          };

          return await ABTestingService.trackExperimentEvent(
            event.experimentId,
            event.variantId,
            event.eventType,
            mergedContext,
            event.eventData
          );
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - successful;

      res.json({
        success: true,
        message: `Batch tracking completed`,
        stats: {
          total: events.length,
          successful,
          failed
        }
      });
    } catch (error: any) {
      console.error('Error batch tracking events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to batch track events'
      });
    }
  }
);

export default router;