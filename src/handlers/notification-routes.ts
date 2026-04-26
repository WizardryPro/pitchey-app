/**
 * Notification API Routes Handler
 * Comprehensive REST API endpoints for the notification system
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Context = any;
import { z } from 'zod';
import type { DatabaseService } from '../types/worker-types';
import { ApiResponseBuilder, ErrorCode, errorHandler } from '../utils/api-response';
import { NotificationIntegrationService } from '../services/notification-integration.service';

// Validation schemas
const SendNotificationSchema = z.object({
  userId: z.string().optional(), // Optional, will use current user if not provided
  templateName: z.string().optional(),
  type: z.enum(['email', 'push', 'in_app', 'sms']).default('in_app'),
  category: z.enum(['investment', 'project', 'system', 'analytics', 'market']),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  htmlContent: z.string().optional(),
  contextType: z.string().optional(),
  contextId: z.string().optional(),
  actionUrl: z.string().optional(),
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

export class NotificationRoutesHandler {
  constructor(
    private db: DatabaseService,
    private notificationIntegration: NotificationIntegrationService
  ) {}

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

      // Use current user if userId not provided
      const userId = validatedData.userId || user.id;

      // Check if user has permission to send notifications to other users
      if (userId !== user.id && user.role !== 'admin') {
        return c.json({ error: 'Cannot send notifications to other users' }, 403);
      }

      const services = this.notificationIntegration.getServices();
      const notificationData = {
        ...validatedData,
        userId,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined,
      };

      const result = await services.notification.sendNotification(notificationData as any);

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

      const services = this.notificationIntegration.getServices();
      const result = await (services.notification as any).getUserNotifications(user.id, {
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
        unreadCount: (result as any).unreadCount,
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
      const services = this.notificationIntegration.getServices();

      await (services.notification as any).markAsRead([notificationId], user.id);

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

      const services = this.notificationIntegration.getServices();
      await (services.notification as any).markAsRead(notificationIds, user.id);

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

  /**
   * GET /api/notifications/preferences - Get user notification preferences
   */
  async getPreferences(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const services = this.notificationIntegration.getServices();
      const preferences = await services.notification.getUserPreferences(user.id);

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

      const services = this.notificationIntegration.getServices();
      const updatedPreferences = await (services.notification as any).updateUserPreferences(user.id, updates);

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
      const { endpoint, keys } = body;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return c.json({ error: 'Invalid push subscription data' }, 400);
      }

      const userAgent = c.req.header('User-Agent') || '';
      const services = this.notificationIntegration.getServices();
      
      const subscriptionId = await services.push.subscribe(
        user.id,
        { endpoint, keys },
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
      const services = this.notificationIntegration.getServices();

      await services.push.unsubscribe(user.id, endpoint);

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
      const services = this.notificationIntegration.getServices();
      const publicKey = services.push.getVAPIDPublicKey();

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
      const { subscriptionId, notificationId } = await c.req.json();
      const services = this.notificationIntegration.getServices();

      await services.push.trackClick(subscriptionId, notificationId);

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


  /**
   * POST /api/notifications/digest - Generate and send digest notifications (admin only)
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

      const services = this.notificationIntegration.getServices();
      await (services.notification as any).sendDigestNotifications(digestType);

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

      const services = this.notificationIntegration.getServices();
      
      const [notificationMetrics, pushMetrics] = await Promise.all([
        services.notification.getNotificationMetrics(
          includeUserData ? undefined : user.id,
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        ),
        services.push.getAnalytics(
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
   * DELETE /api/notifications/unsubscribe - Process email unsubscribe
   */
  async processUnsubscribe(c: Context) {
    try {
      const token = c.req.query('token');
      const category = c.req.query('category');

      if (!token) {
        return c.json({ error: 'Unsubscribe token required' }, 400);
      }

      const services = this.notificationIntegration.getServices();
      const result = await (services.notification as any).processUnsubscribe(token);

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
   * POST /api/notifications/test - Send test notification (admin only)
   */
  async sendTestNotification(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const { type = 'in_app', title = 'Test Notification', message = 'This is a test notification.' } = await c.req.json();

      // Send test notification using integration service
      await this.notificationIntegration.notifyWelcome({
        userId: user.id,
        userName: user.first_name || 'Test User',
        userType: user.user_type as any || 'creator',
      });

      return c.json({
        success: true,
        message: 'Test notification sent successfully',
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      return c.json({
        error: 'Failed to send test notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  // Additional methods to match worker-integrated.ts references
  
  async deleteNotification(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const notificationId = c.req.param('id');
      const services = this.notificationIntegration.getServices();
      
      // Delete notification logic
      await (services.notification as any).deleteNotification(notificationId, user.id);

      return c.json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      return c.json({
        error: 'Failed to delete notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async sendBulkNotifications(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const body = await c.req.json();
      const services = this.notificationIntegration.getServices();
      
      // Send bulk notifications
      const results = await (services.notification as any).sendBulkNotifications(body);

      return c.json({
        success: true,
        results,
        message: 'Bulk notifications sent successfully',
      });
    } catch (error) {
      console.error('Error sending bulk notifications:', error);
      return c.json({
        error: 'Failed to send bulk notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async subscribePush(c: Context) {
    return this.subscribeToPush(c);
  }

  async unsubscribePush(c: Context) {
    return this.unsubscribeFromPush(c);
  }

  async getVapidKey(c: Context) {
    return this.getVAPIDKey(c);
  }

  async trackPushEvent(c: Context) {
    return this.trackPushClick(c);
  }

  async testPushNotification(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const services = this.notificationIntegration.getServices();
      await (services.push as any).testPush(user.id);

      return c.json({
        success: true,
        message: 'Test push notification sent',
      });
    } catch (error) {
      console.error('Error sending test push:', error);
      return c.json({
        error: 'Failed to send test push notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async createUnsubscribeToken(c: Context) {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const services = this.notificationIntegration.getServices();
      const token = await (services.notification as any).createUnsubscribeToken(user.id);

      return c.json({
        success: true,
        token,
        message: 'Unsubscribe token created successfully',
      });
    } catch (error) {
      console.error('Error creating unsubscribe token:', error);
      return c.json({
        error: 'Failed to create unsubscribe token',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async getBatches(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const services = this.notificationIntegration.getServices();
      const batches = await (services.notification as any).getBatches();

      return c.json({
        success: true,
        batches,
      });
    } catch (error) {
      console.error('Error getting batches:', error);
      return c.json({
        error: 'Failed to get batches',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async processBatches(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const services = this.notificationIntegration.getServices();
      const results = await (services.notification as any).processBatches();

      return c.json({
        success: true,
        results,
        message: 'Batches processed successfully',
      });
    } catch (error) {
      console.error('Error processing batches:', error);
      return c.json({
        error: 'Failed to process batches',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async getDeliveryAnalytics(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const services = this.notificationIntegration.getServices();
      const analytics = await (services as any).analytics.getDeliveryAnalytics();

      return c.json({
        success: true,
        analytics,
      });
    } catch (error) {
      console.error('Error getting delivery analytics:', error);
      return c.json({
        error: 'Failed to get delivery analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async getEngagementAnalytics(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const services = this.notificationIntegration.getServices();
      const analytics = await (services as any).analytics.getEngagementAnalytics();

      return c.json({
        success: true,
        analytics,
      });
    } catch (error) {
      console.error('Error getting engagement analytics:', error);
      return c.json({
        error: 'Failed to get engagement analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async getPerformanceAnalytics(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const services = this.notificationIntegration.getServices();
      const analytics = await (services as any).analytics.getPerformanceAnalytics();

      return c.json({
        success: true,
        analytics,
      });
    } catch (error) {
      console.error('Error getting performance analytics:', error);
      return c.json({
        error: 'Failed to get performance analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async trackAnalyticsEvent(c: Context) {
    try {
      const body = await c.req.json();
      const services = this.notificationIntegration.getServices();
      await (services as any).analytics.trackEvent(body);

      return c.json({
        success: true,
        message: 'Analytics event tracked successfully',
      });
    } catch (error) {
      console.error('Error tracking analytics event:', error);
      return c.json({
        error: 'Failed to track analytics event',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async getABTests(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const services = this.notificationIntegration.getServices();
      const tests = await (services as any).abTesting.getTests();

      return c.json({
        success: true,
        tests,
      });
    } catch (error) {
      console.error('Error getting A/B tests:', error);
      return c.json({
        error: 'Failed to get A/B tests',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async createABTest(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const body = await c.req.json();
      const services = this.notificationIntegration.getServices();
      const test = await (services as any).abTesting.createTest(body);

      return c.json({
        success: true,
        test,
        message: 'A/B test created successfully',
      });
    } catch (error) {
      console.error('Error creating A/B test:', error);
      return c.json({
        error: 'Failed to create A/B test',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async updateABTest(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const testId = c.req.param('id');
      const body = await c.req.json();
      const services = this.notificationIntegration.getServices();
      const test = await (services as any).abTesting.updateTest(testId, body);

      return c.json({
        success: true,
        test,
        message: 'A/B test updated successfully',
      });
    } catch (error) {
      console.error('Error updating A/B test:', error);
      return c.json({
        error: 'Failed to update A/B test',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }

  async getABTestResults(c: Context) {
    try {
      const user = c.get('user');
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const testId = c.req.param('id');
      const services = this.notificationIntegration.getServices();
      const results = await (services as any).abTesting.getTestResults(testId);

      return c.json({
        success: true,
        results,
      });
    } catch (error) {
      console.error('Error getting A/B test results:', error);
      return c.json({
        error: 'Failed to get A/B test results',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }
}

export function createNotificationRoutesHandler(
  db: DatabaseService,
  notificationIntegration: NotificationIntegrationService
): NotificationRoutesHandler {
  return new NotificationRoutesHandler(db, notificationIntegration);
}