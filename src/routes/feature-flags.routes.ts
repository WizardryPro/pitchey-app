/**
 * Feature Flag API Routes
 * Provides endpoints for feature flag management and evaluation
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { Context } from 'hono';
import { getFeatureFlagService, FeatureFlag, UserContext } from '../services/feature-flags.ts';
import { verifyJWT } from '../utils/jwt.ts';

const app = new Hono();

// Validation schemas
const featureFlagSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
  enabled: z.boolean(),
  description: z.string().max(500),
  strategy: z.enum(['boolean', 'percentage', 'user_list', 'ab_test', 'gradual_rollout']),
  value: z.any().optional(),
  percentage: z.number().min(0).max(100).optional(),
  userIds: z.array(z.string()).optional(),
  segments: z.array(z.string()).optional(),
  conditions: z.array(z.object({
    attribute: z.string(),
    operator: z.enum(['equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in']),
    value: z.any()
  })).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

const evaluateRequestSchema = z.object({
  flagKey: z.string(),
  userContext: z.object({
    userId: z.string(),
    email: z.string().email().optional(),
    role: z.string().optional(),
    subscription: z.string().optional(),
    attributes: z.record(z.string(), z.any()).optional(),
    segment: z.string().optional()
  }).optional()
});

// Middleware to check admin access
async function requireAdmin(c: Context, next: () => Promise<void>) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    
    if (payload.role !== 'admin' && payload.role !== 'super_admin') {
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }

    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
}

/**
 * Initialize feature flags
 */
app.post('/initialize', requireAdmin, async (c) => {
  try {
    const flagService = getFeatureFlagService(c.env.REDIS);
    await flagService.initialize();
    
    return c.json({
      success: true,
      message: 'Feature flags initialized'
    });
  } catch (error) {
    console.error('Error initializing feature flags:', error);
    return c.json({ error: 'Failed to initialize feature flags' }, 500);
  }
});

/**
 * Evaluate a feature flag
 */
app.post('/evaluate', async (c) => {
  try {
    const body = await c.req.json();
    const validated = evaluateRequestSchema.parse(body);
    
    const flagService = getFeatureFlagService(c.env.REDIS);
    
    // Use authenticated user context if available
    let userContext = validated.userContext;
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const payload = await verifyJWT(token, c.env.JWT_SECRET);
        userContext = userContext || {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
          subscription: payload.subscription
        };
      } catch {
        // Token invalid, use provided context or anonymous
      }
    }

    const evaluation = await flagService.evaluate(validated.flagKey, userContext);
    
    // Track evaluation for analytics
    if (userContext) {
      await flagService.trackEvaluation(validated.flagKey, userContext, evaluation);
    }

    return c.json(evaluation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400);
    }
    console.error('Error evaluating feature flag:', error);
    return c.json({ error: 'Failed to evaluate feature flag' }, 500);
  }
});

/**
 * Batch evaluate multiple flags
 */
app.post('/evaluate-batch', async (c) => {
  try {
    const body = await c.req.json();
    const { flagKeys, userContext } = body;
    
    if (!Array.isArray(flagKeys)) {
      return c.json({ error: 'flagKeys must be an array' }, 400);
    }

    const flagService = getFeatureFlagService(c.env.REDIS);
    const evaluations: Record<string, any> = {};

    for (const key of flagKeys) {
      evaluations[key] = await flagService.evaluate(key, userContext);
    }

    return c.json(evaluations);
  } catch (error) {
    console.error('Error batch evaluating feature flags:', error);
    return c.json({ error: 'Failed to evaluate feature flags' }, 500);
  }
});

/**
 * Get all flags for current user
 */
app.get('/user-flags', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    let userContext: UserContext | undefined;

    if (token) {
      try {
        const payload = await verifyJWT(token, c.env.JWT_SECRET);
        userContext = {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
          subscription: payload.subscription
        };
      } catch {
        // Use anonymous context
      }
    }

    const flagService = getFeatureFlagService(c.env.REDIS);
    const flags = userContext 
      ? await flagService.getUserFlags(userContext)
      : {};

    return c.json(flags);
  } catch (error) {
    console.error('Error getting user flags:', error);
    return c.json({ error: 'Failed to get user flags' }, 500);
  }
});

/**
 * List all feature flags (admin only)
 */
app.get('/list', requireAdmin, async (c) => {
  try {
    const flagService = getFeatureFlagService(c.env.REDIS);
    const flags = await flagService.listFlags();
    
    return c.json(flags);
  } catch (error) {
    console.error('Error listing feature flags:', error);
    return c.json({ error: 'Failed to list feature flags' }, 500);
  }
});

/**
 * Get a specific feature flag (admin only)
 */
app.get('/:key', requireAdmin, async (c) => {
  try {
    const { key } = c.req.param();
    const flagService = getFeatureFlagService(c.env.REDIS);
    const flag = await flagService.getFlag(key);
    
    if (!flag) {
      return c.json({ error: 'Flag not found' }, 404);
    }

    return c.json(flag);
  } catch (error) {
    console.error('Error getting feature flag:', error);
    return c.json({ error: 'Failed to get feature flag' }, 500);
  }
});

/**
 * Create a new feature flag (admin only)
 */
app.post('/create', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const validated = featureFlagSchema.parse(body);
    
    const flagService = getFeatureFlagService(c.env.REDIS);
    
    // Check if flag already exists
    const existing = await flagService.getFlag(validated.key);
    if (existing) {
      return c.json({ error: 'Flag already exists' }, 409);
    }

    const user = c.get('user');
    const flag: FeatureFlag = {
      ...validated,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user.userId
    };

    await flagService.createFlag(flag);
    
    return c.json({
      success: true,
      flag
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400);
    }
    console.error('Error creating feature flag:', error);
    return c.json({ error: 'Failed to create feature flag' }, 500);
  }
});

/**
 * Update a feature flag (admin only)
 */
app.put('/:key', requireAdmin, async (c) => {
  try {
    const { key } = c.req.param();
    const body = await c.req.json();
    
    const flagService = getFeatureFlagService(c.env.REDIS);
    
    // Check if flag exists
    const existing = await flagService.getFlag(key);
    if (!existing) {
      return c.json({ error: 'Flag not found' }, 404);
    }

    await flagService.updateFlag(key, body);
    
    return c.json({
      success: true,
      message: 'Flag updated successfully'
    });
  } catch (error) {
    console.error('Error updating feature flag:', error);
    return c.json({ error: 'Failed to update feature flag' }, 500);
  }
});

/**
 * Delete a feature flag (admin only)
 */
app.delete('/:key', requireAdmin, async (c) => {
  try {
    const { key } = c.req.param();
    const flagService = getFeatureFlagService(c.env.REDIS);
    
    // Check if flag exists
    const existing = await flagService.getFlag(key);
    if (!existing) {
      return c.json({ error: 'Flag not found' }, 404);
    }

    await flagService.deleteFlag(key);
    
    return c.json({
      success: true,
      message: 'Flag deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting feature flag:', error);
    return c.json({ error: 'Failed to delete feature flag' }, 500);
  }
});

/**
 * Get flag analytics (admin only)
 */
app.get('/:key/analytics', requireAdmin, async (c) => {
  try {
    const { key } = c.req.param();
    const flagService = getFeatureFlagService(c.env.REDIS);
    const analytics = await flagService.getFlagAnalytics(key);
    
    if (!analytics) {
      return c.json({ error: 'No analytics data found' }, 404);
    }

    return c.json(analytics);
  } catch (error) {
    console.error('Error getting flag analytics:', error);
    return c.json({ error: 'Failed to get flag analytics' }, 500);
  }
});

/**
 * Export all flags (admin only)
 */
app.get('/admin/export', requireAdmin, async (c) => {
  try {
    const flagService = getFeatureFlagService(c.env.REDIS);
    const exportData = await flagService.exportFlags();
    
    c.header('Content-Type', 'application/json');
    c.header('Content-Disposition', 'attachment; filename="feature-flags.json"');
    
    return c.text(exportData);
  } catch (error) {
    console.error('Error exporting feature flags:', error);
    return c.json({ error: 'Failed to export feature flags' }, 500);
  }
});

/**
 * Import flags (admin only)
 */
app.post('/admin/import', requireAdmin, async (c) => {
  try {
    const body = await c.req.text();
    const flagService = getFeatureFlagService(c.env.REDIS);
    await flagService.importFlags(body);
    
    return c.json({
      success: true,
      message: 'Flags imported successfully'
    });
  } catch (error) {
    console.error('Error importing feature flags:', error);
    return c.json({ error: 'Failed to import feature flags' }, 500);
  }
});

/**
 * WebSocket endpoint for real-time flag updates
 */
app.get('/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.json({ error: 'WebSocket upgrade required' }, 426);
  }

  const [client, server] = Object.values(new WebSocketPair());

  // Handle WebSocket connection
  server.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data as string);
      
      if (data.type === 'subscribe') {
        // Subscribe to flag updates
        server.send(JSON.stringify({
          type: 'subscribed',
          message: 'Subscribed to feature flag updates'
        }));
      }
    } catch (error) {
      server.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  server.accept();

  return new Response(null, {
    status: 101,
    webSocket: client
  });
});

export default app;