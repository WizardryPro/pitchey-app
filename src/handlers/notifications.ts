/**
 * Comprehensive Notification API Handlers
 * Provides full REST API for notification management, preferences, analytics
 */

import { z } from 'zod';
import type { Context } from 'hono';
import type { DatabaseService } from '../types/worker-types.ts';
import type { NotificationService, NotificationData, NotificationPreferences } from '../services/notification.service.ts';
import type { EmailTemplateService } from '../services/email-template.service.ts';
import type { PushNotificationService } from '../services/push-notification.service.ts';

// Validation schemas
const SendNotificationSchema = z.object({
  userId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  type: z.enum(['email', 'push', 'in_app', 'sms']),
  category: z.enum(['investment', 'project', 'system', 'analytics', 'market']),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  htmlContent: z.string().optional(),
  contextType: z.string().optional(),
  contextId: z.string().uuid().optional(),
  actionUrl: z.string().url().optional(),
  actionText: z.string().max(100).optional(),
  expiresAt: z.string().datetime().optional(),
  variables: z.record(z.string(), z.any()).default({}),
  channels: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    in_app: z.boolean().optional(),
    sms: z.boolean().optional(),
  }).optional(),
});

const BulkNotificationSchema = z.object({
  notifications: z.array(SendNotificationSchema),
  batchSize: z.number().min(1).max(100).default(50),
});

const UpdatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  investmentAlerts: z.object({
    email: z.boolean(),
    push: z.boolean(),
    in_app: z.boolean(),
    sms: z.boolean(),
  }).optional(),
  projectUpdates: z.object({
    email: z.boolean(),
    push: z.boolean(),
    in_app: z.boolean(),
    sms: z.boolean(),
  }).optional(),
  systemAlerts: z.object({
    email: z.boolean(),
    push: z.boolean(),
    in_app: z.boolean(),
    sms: z.boolean(),
  }).optional(),
  analyticsAlerts: z.object({
    email: z.boolean(),
    push: z.boolean(),
    in_app: z.boolean(),
    sms: z.boolean(),
  }).optional(),
  marketIntelligence: z.object({
    email: z.boolean(),
    push: z.boolean(),
    in_app: z.boolean(),
    sms: z.boolean(),
  }).optional(),
  digestFrequency: z.enum(['instant', 'daily', 'weekly', 'monthly']).optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  timezone: z.string().optional(),
});

const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export class NotificationHandlers {
  constructor(
    private db: DatabaseService,
    private notificationService: NotificationService,
    private emailTemplateService: EmailTemplateService,
    private pushService: PushNotificationService,
    private redis?: any
  ) {}

  // ============================================================================
  // NOTIFICATION SENDING ENDPOINTS
  // ============================================================================

  /**
   * POST /api/notifications/send - Send immediate notification
   */
  async sendNotification(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const body = await c.req.json();
      const validatedData = SendNotificationSchema.parse(body);

      // Convert to NotificationData format
      const notificationData: NotificationData = {
        ...validatedData,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined,
      };

      const result = await this.notificationService.sendNotification(notificationData);

      return c.json({
        success: true,
        notificationId: result,
        message: 'Notification sent successfully',
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      return c.json({
        error: 'Failed to send notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * POST /api/notifications/send-bulk - Send multiple notifications
   */
  async sendBulkNotifications(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const body = await c.req.json();
      const { notifications, batchSize } = BulkNotificationSchema.parse(body);

      // Convert notifications to proper format
      const notificationData: NotificationData[] = notifications.map(n => ({
        ...n,
        expiresAt: n.expiresAt ? new Date(n.expiresAt) : undefined,
      }));

      const results = await this.notificationService.sendBulkNotifications(notificationData);

      return c.json({
        success: true,
        summary: {
          total: notifications.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        },
        results: results.map(r => ({
          success: r.success,
          notificationId: r.success ? r : undefined,
          error: !r.success ? r.error : undefined,
        })),
      });
    } catch (error) {
      console.error('Error sending bulk notifications:', error);
      return c.json({
        error: 'Failed to send bulk notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  // ============================================================================
  // NOTIFICATION MANAGEMENT ENDPOINTS
  // ============================================================================

  /**
   * GET /api/notifications - Get user notifications with pagination
   */
  async getNotifications(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '20');
      const category = c.req.query('category');
      const unreadOnly = c.req.query('unreadOnly') === 'true';
      const contextType = c.req.query('contextType');

      const result = await this.notificationService.getUserNotifications(user.id, {
        page,
        limit,
        category,
        unreadOnly,
        contextType,
      });

      return c.json({
        success: true,
        data: result.notifications,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit),
        },
        unreadCount: result.unreadCount,
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      return c.json({
        error: 'Failed to get notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * PUT /api/notifications/:id/read - Mark notification as read
   */
  async markAsRead(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const notificationId = c.req.param('id');
      const notificationIds = [notificationId];

      await this.notificationService.markAsRead(notificationIds, user.id);

      return c.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return c.json({
        error: 'Failed to mark notification as read',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * PUT /api/notifications/read-multiple - Mark multiple notifications as read
   */
  async markMultipleAsRead(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { notificationIds } = await c.req.json();
      
      if (!Array.isArray(notificationIds)) {
        return c.json({ error: 'notificationIds must be an array' }, 400);
      }

      await this.notificationService.markAsRead(notificationIds, user.id);

      return c.json({
        success: true,
        message: `${notificationIds.length} notifications marked as read`,
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      return c.json({
        error: 'Failed to mark notifications as read',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  // ============================================================================
  // NOTIFICATION PREFERENCES ENDPOINTS
  // ============================================================================

  /**
   * GET /api/notifications/preferences - Get user notification preferences
   */
  async getPreferences(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const preferences = await this.notificationService.getUserPreferences(user.id);

      return c.json({
        success: true,
        preferences,
      });
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return c.json({
        error: 'Failed to get notification preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * POST /api/notifications/preferences - Update notification preferences
   */
  async updatePreferences(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const body = await c.req.json();
      const updates = UpdatePreferencesSchema.parse(body);

      const updatedPreferences = await this.notificationService.updateUserPreferences(
        user.id,
        updates as Partial<NotificationPreferences>
      );

      return c.json({
        success: true,
        preferences: updatedPreferences,
        message: 'Notification preferences updated successfully',
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return c.json({
        error: 'Failed to update notification preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  // ============================================================================
  // PUSH NOTIFICATION ENDPOINTS
  // ============================================================================

  /**
   * POST /api/notifications/push/subscribe - Subscribe to push notifications
   */
  async subscribeToPush(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const body = await c.req.json();
      const subscription = PushSubscriptionSchema.parse(body);
      const userAgent = c.req.header('User-Agent');

      const subscriptionId = await this.pushService.subscribe(
        user.id,
        subscription,
        userAgent
      );

      return c.json({
        success: true,
        subscriptionId,
        message: 'Successfully subscribed to push notifications',
      });
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return c.json({
        error: 'Failed to subscribe to push notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * DELETE /api/notifications/push/unsubscribe - Unsubscribe from push notifications
   */
  async unsubscribeFromPush(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { endpoint } = await c.req.json();

      await this.pushService.unsubscribe(user.id, endpoint);

      return c.json({
        success: true,
        message: 'Successfully unsubscribed from push notifications',
      });
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return c.json({
        error: 'Failed to unsubscribe from push notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * GET /api/notifications/push/vapid-key - Get VAPID public key
   */
  async getVAPIDKey(c: Context) {
    try {
      const publicKey = this.pushService.getVAPIDPublicKey();

      return c.json({
        success: true,
        publicKey,
      });
    } catch (error) {
      console.error('Error getting VAPID key:', error);
      return c.json({
        error: 'Failed to get VAPID key',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * POST /api/notifications/push/track-click - Track push notification click
   */
  async trackPushClick(c: Context) {
    try {
      const { subscriptionId, notificationId, action } = await c.req.json();

      await this.pushService.trackClick(subscriptionId, notificationId);

      return c.json({
        success: true,
        message: 'Push notification click tracked',
      });
    } catch (error) {
      console.error('Error tracking push notification click:', error);
      return c.json({
        error: 'Failed to track push notification click',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  // ============================================================================
  // EMAIL TEMPLATE ENDPOINTS
  // ============================================================================

  /**
   * GET /api/notifications/templates - Get all email templates
   */
  async getTemplates(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const category = c.req.query('category');
      const templates = await this.emailTemplateService.getTemplates(category);

      return c.json({
        success: true,
        templates,
      });
    } catch (error) {
      console.error('Error getting templates:', error);
      return c.json({
        error: 'Failed to get templates',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * POST /api/notifications/templates/preview - Preview email template
   */
  async previewTemplate(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { templateName, sampleData } = await c.req.json();

      const preview = await this.emailTemplateService.previewTemplate(
        templateName,
        sampleData
      );

      return c.json({
        success: true,
        preview,
      });
    } catch (error) {
      console.error('Error previewing template:', error);
      return c.json({
        error: 'Failed to preview template',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  // ============================================================================
  // DIGEST AND BATCH ENDPOINTS
  // ============================================================================

  /**
   * POST /api/notifications/digest - Generate and send digest notifications
   */
  async sendDigest(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { digestType } = await c.req.json();

      if (!['daily', 'weekly', 'monthly'].includes(digestType)) {
        return c.json({ error: 'Invalid digest type' }, 400);
      }

      await this.notificationService.sendDigestNotifications(digestType);

      return c.json({
        success: true,
        message: `${digestType} digest notifications sent successfully`,
      });
    } catch (error) {
      console.error('Error sending digest notifications:', error);
      return c.json({
        error: 'Failed to send digest notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  // ============================================================================
  // UNSUBSCRIBE ENDPOINTS
  // ============================================================================

  /**
   * DELETE /api/notifications/unsubscribe - Unsubscribe from email notifications
   */
  async unsubscribeFromEmail(c: Context) {
    try {
      const token = c.req.query('token');
      const category = c.req.query('category');

      if (!token) {
        return c.json({ error: 'Unsubscribe token required' }, 400);
      }

      const result = await this.notificationService.processUnsubscribe(token);

      if (!result.success) {
        return c.json({ error: 'Invalid or expired unsubscribe token' }, 400);
      }

      return c.json({
        success: true,
        message: category
          ? `Successfully unsubscribed from ${category} notifications`
          : 'Successfully unsubscribed from all email notifications',
        category: result.category,
      });
    } catch (error) {
      console.error('Error processing unsubscribe:', error);
      return c.json({
        error: 'Failed to process unsubscribe request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * GET /api/notifications/unsubscribe/token - Create unsubscribe token
   */
  async createUnsubscribeToken(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const category = c.req.query('category');

      const token = await this.notificationService.createUnsubscribeToken(
        user.id,
        category || undefined
      );

      return c.json({
        success: true,
        token,
        unsubscribeUrl: `${process.env.FRONTEND_URL}/unsubscribe?token=${token}`,
      });
    } catch (error) {
      console.error('Error creating unsubscribe token:', error);
      return c.json({
        error: 'Failed to create unsubscribe token',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  // ============================================================================
  // ANALYTICS ENDPOINTS
  // ============================================================================

  /**
   * GET /api/notifications/analytics - Get notification analytics
   */
  async getAnalytics(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const startDate = c.req.query('startDate');
      const endDate = c.req.query('endDate');
      const includeUserData = user.role === 'admin';

      const [notificationMetrics, pushMetrics] = await Promise.all([
        this.notificationService.getNotificationMetrics(
          includeUserData ? undefined : user.id,
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        ),
        this.pushService.getAnalytics(
          includeUserData ? undefined : user.id,
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        ),
      ]);

      return c.json({
        success: true,
        analytics: {
          notifications: notificationMetrics,
          push: pushMetrics,
        },
      });
    } catch (error) {
      console.error('Error getting notification analytics:', error);
      return c.json({
        error: 'Failed to get notification analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  /**
   * GET /api/notifications/health - Health check endpoint
   */
  async healthCheck(c: Context) {
    try {
      // Check database connection
      await this.db.query('SELECT 1');

      // Check Redis connection if available
      let redisStatus = 'not available';
      if (this.redis) {
        try {
          await this.redis.get('health-check');
          redisStatus = 'connected';
        } catch {
          redisStatus = 'error';
        }
      }

      // Get queue sizes
      const queueSizes = await this.getQueueSizes();

      return c.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          redis: redisStatus,
          notification: 'active',
          email: 'active',
          push: 'active',
        },
        queues: queueSizes,
      });
    } catch (error) {
      console.error('Health check failed:', error);
      return c.json({
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  // Private helper methods

  private async getQueueSizes(): Promise<Record<string, number>> {
    if (!this.redis) {
      return {};
    }

    try {
      const channels = ['email', 'push', 'sms'];
      const priorities = ['urgent', 'high', 'normal', 'low'];
      const queueSizes: Record<string, number> = {};

      for (const channel of channels) {
        for (const priority of priorities) {
          const queueKey = `notification_queue:${priority}:${channel}`;
          queueSizes[`${channel}_${priority}`] = await this.redis.llen(queueKey);
        }
      }

      return queueSizes;
    } catch (error) {
      console.error('Error getting queue sizes:', error);
      return {};
    }
  }
}

export function createNotificationHandlers(
  db: DatabaseService,
  notificationService: NotificationService,
  emailTemplateService: EmailTemplateService,
  pushService: PushNotificationService,
  redis?: any
): NotificationHandlers {
  return new NotificationHandlers(
    db,
    notificationService,
    emailTemplateService,
    pushService,
    redis
  );
}