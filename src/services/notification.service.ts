/**
 * Comprehensive Multi-Channel Notification Service
 * Enterprise-grade notification system with intelligent routing, analytics, and delivery tracking
 * Supports email, push, SMS, in-app notifications with preference management
 * Refactored to use raw SQL via WorkerDatabase
 */

import { WorkerDatabase, type DatabaseRow } from './worker-database';
import { createEmailService, type EmailService } from './email.service';
import type { MessagingService } from './messaging.service';

// Redis integration for queuing and caching
interface RedisService {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  rpush: (key: string, value: string) => Promise<void>;
  lpop: (key: string) => Promise<string | null>;
  llen: (key: string) => Promise<number>;
  hget: (hash: string, field: string) => Promise<string | null>;
  hset: (hash: string, field: string, value: string) => Promise<void>;
  sadd: (set: string, member: string) => Promise<void>;
  smembers: (set: string) => Promise<string[]>;
}

// Notification types and interfaces
export interface NotificationInput {
  userId: number;
  type: 'nda_request' | 'nda_approval' | 'nda_rejection' | 'nda_expiration' | 'nda_reminder' | 'message' | 'investment' | 'pitch_update' | 'system' | 'marketing';
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';

  // Optional metadata
  relatedPitchId?: number;
  relatedUserId?: number;
  relatedNdaRequestId?: number;
  relatedInvestmentId?: number;
  relatedMessageId?: number;
  actionUrl?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;

  // Channel preferences - if not specified, uses user preferences
  channels?: {
    email?: boolean;
    inApp?: boolean;
    push?: boolean;
    sms?: boolean;
  };

  // Email specific options
  emailOptions?: {
    templateType?: string;
    variables?: Record<string, unknown>;
    attachments?: Array<{
      filename: string;
      content: string | Buffer;
      type?: string;
    }>;
  };
}

// Exported for other services
export interface NotificationData extends NotificationInput {
  id?: number;
  createdAt?: Date;
  // Category for grouping/batching purposes
  category?: 'investment' | 'project' | 'system' | 'analytics' | 'market';
}

export interface NotificationPreferences {
  userId: number;
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  weeklyDigest: boolean;

  // Category-specific preferences (match the actual table columns)
  investmentAlerts: boolean;
  commentNotifications: boolean;
  likeNotifications: boolean;
  followNotifications: boolean;
  messageNotifications: boolean;
  systemNotifications: boolean;

  // Quiet-hours (optional): the columns are NOT in the live notification_preferences
  // table yet, so getUserPreferences() never sets these — they are always undefined,
  // and isInQuietHours() therefore returns false (the feature is inert until the
  // columns + loader mapping are added). Typed optional so the type matches reality.
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDelivery {
  id: number;
  notificationId: number;
  channel: 'email' | 'push' | 'sms' | 'in_app';
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced';
  providerId?: string; // External provider message ID
  attempts: number;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  clickedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationQueueItem {
  id: string;
  notificationId: number;
  channel: 'email' | 'push' | 'sms';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt: Date;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  data: NotificationInput;
  createdAt: Date;
}

export interface NotificationMetrics {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalClicked: number;
  totalFailed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  byChannel: Record<string, {
    sent: number;
    delivered: number;
    failed: number;
  }>;
  byType: Record<string, {
    sent: number;
    opened: number;
    clicked: number;
  }>;
}

// Database row types with index signatures for raw SQL compatibility
interface NotificationRow {
  [key: string]: unknown;
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  related_pitch_id: number | null;
  related_user_id: number | null;
  related_nda_request_id: number | null;
  related_investment_id: number | null;
  related_message_id: number | null;
  action_url: string | null;
  expires_at: Date | null;
  metadata: string | null;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface PreferencesRow {
  [key: string]: unknown;
  id: number;
  user_id: number;
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  marketing_emails: boolean;
  weekly_digest: boolean;
  investment_alerts: boolean;
  comment_notifications: boolean;
  like_notifications: boolean;
  follow_notifications: boolean;
  message_notifications: boolean;
  system_notifications: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DeliveryRow {
  [key: string]: unknown;
  id: number;
  notification_id: number;
  channel: string;
  status: string;
  provider_id: string | null;
  attempts: number;
  error_message: string | null;
  sent_at: Date | null;
  delivered_at: Date | null;
  read_at: Date | null;
  clicked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface UserRow {
  [key: string]: unknown;
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface CountRow {
  [key: string]: unknown;
  count: string | number;
}

interface MetricsRow {
  [key: string]: unknown;
  total_sent: string | number;
  total_delivered: string | number;
  total_read: string | number;
  total_clicked: string | number;
  total_failed: string | number;
}

export class NotificationService {
  private db: WorkerDatabase;
  private redis: RedisService;
  private email: EmailService;
  private messaging: MessagingService;
  private processingInterval: number = 5000; // 5 seconds
  private batchSize: number = 10;
  private isProcessing: boolean = false;

  constructor(
    databaseOrConnectionString: string | WorkerDatabase | any,
    redis: RedisService,
    email?: EmailService,
    messaging?: MessagingService
  ) {
    if (typeof databaseOrConnectionString === 'string') {
      this.db = new WorkerDatabase({ connectionString: databaseOrConnectionString });
    } else if (databaseOrConnectionString instanceof WorkerDatabase) {
      this.db = databaseOrConnectionString;
    } else if (databaseOrConnectionString && typeof databaseOrConnectionString.query === 'function') {
      // Accept any database-like object (DatabaseService interface)
      this.db = databaseOrConnectionString as WorkerDatabase;
    } else {
      this.db = new WorkerDatabase({ connectionString: 'postgresql://dummy:dummy@localhost:5432/dummy' });
    }
    this.redis = redis;
    this.email = email as EmailService;
    this.messaging = messaging as MessagingService;
    this.startQueueProcessor();
  }

  // ============================================================================
  // NOTIFICATION SENDING
  // ============================================================================

  /**
   * Send notification through appropriate channels based on user preferences
   */
  async sendNotification(input: NotificationInput): Promise<{
    notificationId: number;
    channels: Array<{ channel: string; status: string; messageId?: string }>;
  }> {
    try {
      // Create notification record
      const notifications = await this.db.query<NotificationRow>(
        `INSERT INTO notifications (
          user_id, type, title, message, priority,
          related_pitch_id, related_user_id, related_nda_request_id,
          related_investment_id, related_message_id,
          action_url, expires_at, metadata, is_read, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          input.userId,
          input.type,
          input.title,
          input.message,
          input.priority,
          input.relatedPitchId ?? null,
          input.relatedUserId ?? null,
          input.relatedNdaRequestId ?? null,
          input.relatedInvestmentId ?? null,
          input.relatedMessageId ?? null,
          input.actionUrl ?? null,
          input.expiresAt ?? null,
          input.metadata ? JSON.stringify(input.metadata) : null,
          false,
          new Date(),
          new Date()
        ]
      );

      const notification = notifications[0];

      // Get user preferences
      const preferences = await this.getUserPreferences(input.userId);

      // Determine which channels to use
      const channelsToUse = await this.determineChannels(input, preferences);

      const results: Array<{ channel: string; status: string; messageId?: string }> = [];

      // Send in-app notification immediately
      if (channelsToUse.includes('in_app')) {
        await this.sendInAppNotification(notification, input);
        results.push({ channel: 'in_app', status: 'sent' });
      }

      // Queue other channels for background processing
      for (const channel of channelsToUse) {
        if (channel !== 'in_app') {
          await this.queueNotification(notification.id, channel as 'email' | 'push' | 'sms', input);
          results.push({ channel, status: 'queued' });
        }
      }

      // Cache notification for real-time delivery
      await this.cacheNotification(notification, input.userId);

      return {
        notificationId: notification.id,
        channels: results
      };
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send batch notifications efficiently
   */
  async sendBatchNotifications(notifications: NotificationInput[]): Promise<{
    successful: number;
    failed: number;
    results: Array<{ input: NotificationInput; success: boolean; error?: string }>;
  }> {
    const results: Array<{ input: NotificationInput; success: boolean; error?: string }> = [];
    let successful = 0;
    let failed = 0;

    // Process in batches to avoid overwhelming the system
    const batchSize = 20;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (notificationInput) => {
          try {
            await this.sendNotification(notificationInput);
            results.push({ input: notificationInput, success: true });
            successful++;
          } catch (error) {
            results.push({
              input: notificationInput,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            failed++;
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return { successful, failed, results };
  }

  /**
   * Send notification reminders
   */
  async sendReminder(originalNotificationId: number, reminderText: string): Promise<void> {
    try {
      // Get original notification
      const notifications = await this.db.query<NotificationRow>(
        'SELECT * FROM notifications WHERE id = $1',
        [originalNotificationId]
      );

      const original = notifications[0];
      if (!original) {
        throw new Error('Original notification not found');
      }

      // Send reminder notification
      await this.sendNotification({
        userId: original.user_id,
        type: original.type as NotificationInput['type'],
        title: `Reminder: ${original.title}`,
        message: reminderText,
        priority: 'normal',
        relatedPitchId: original.related_pitch_id ?? undefined,
        relatedUserId: original.related_user_id ?? undefined,
        relatedNdaRequestId: original.related_nda_request_id ?? undefined,
        actionUrl: original.action_url ?? undefined,
        metadata: {
          ...(original.metadata ? JSON.parse(original.metadata) : {}),
          isReminder: true,
          originalNotificationId: originalNotificationId
        }
      });
    } catch (error) {
      console.error('Error sending reminder:', error);
      throw error;
    }
  }

  // ============================================================================
  // NOTIFICATION PREFERENCES
  // ============================================================================

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: number): Promise<NotificationPreferences> {
    try {
      const preferences = await this.db.query<PreferencesRow>(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [userId]
      );

      if (!preferences[0]) {
        // Create default preferences
        const defaultPrefs = await this.db.query<PreferencesRow>(
          // Columns match the ACTUAL prod notification_preferences schema
          // (boolean flags; the service previously wrote digest_frequency /
          // quiet_hours / nda_notifications / etc. which don't exist → 500).
          `INSERT INTO notification_preferences (
            user_id, email_notifications, push_notifications, sms_notifications,
            marketing_emails, weekly_digest, investment_alerts, comment_notifications,
            like_notifications, follow_notifications, message_notifications,
            system_notifications, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *`,
          [
            userId,
            true,  // email_notifications
            true,  // push_notifications
            false, // sms_notifications
            false, // marketing_emails
            true,  // weekly_digest
            true,  // investment_alerts
            true,  // comment_notifications
            true,  // like_notifications
            true,  // follow_notifications
            true,  // message_notifications
            true,  // system_notifications
            new Date(),
            new Date()
          ]
        );

        return this.convertPreferencesRow(defaultPrefs[0]);
      }

      return this.convertPreferencesRow(preferences[0]);
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      throw error;
    }
  }

  /**
   * Convert DB row to NotificationPreferences
   */
  private convertPreferencesRow(row: PreferencesRow): NotificationPreferences {
    return {
      userId: row.user_id,
      emailNotifications: row.email_notifications,
      pushNotifications: row.push_notifications,
      smsNotifications: row.sms_notifications,
      marketingEmails: row.marketing_emails,
      weeklyDigest: row.weekly_digest,
      investmentAlerts: row.investment_alerts,
      commentNotifications: row.comment_notifications,
      likeNotifications: row.like_notifications,
      followNotifications: row.follow_notifications,
      messageNotifications: row.message_notifications,
      systemNotifications: row.system_notifications,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: number, updates: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      // Build SET clause dynamically
      const setClauses: string[] = [];
      const values: (string | number | boolean | Date | null)[] = [];
      let paramIndex = 1;

      if (updates.emailNotifications !== undefined) {
        setClauses.push(`email_notifications = $${paramIndex++}`);
        values.push(updates.emailNotifications);
      }
      if (updates.pushNotifications !== undefined) {
        setClauses.push(`push_notifications = $${paramIndex++}`);
        values.push(updates.pushNotifications);
      }
      if (updates.smsNotifications !== undefined) {
        setClauses.push(`sms_notifications = $${paramIndex++}`);
        values.push(updates.smsNotifications);
      }
      if (updates.marketingEmails !== undefined) {
        setClauses.push(`marketing_emails = $${paramIndex++}`);
        values.push(updates.marketingEmails);
      }
      if (updates.weeklyDigest !== undefined) {
        setClauses.push(`weekly_digest = $${paramIndex++}`);
        values.push(updates.weeklyDigest);
      }
      if (updates.investmentAlerts !== undefined) {
        setClauses.push(`investment_alerts = $${paramIndex++}`);
        values.push(updates.investmentAlerts);
      }
      if (updates.commentNotifications !== undefined) {
        setClauses.push(`comment_notifications = $${paramIndex++}`);
        values.push(updates.commentNotifications);
      }
      if (updates.likeNotifications !== undefined) {
        setClauses.push(`like_notifications = $${paramIndex++}`);
        values.push(updates.likeNotifications);
      }
      if (updates.followNotifications !== undefined) {
        setClauses.push(`follow_notifications = $${paramIndex++}`);
        values.push(updates.followNotifications);
      }
      if (updates.messageNotifications !== undefined) {
        setClauses.push(`message_notifications = $${paramIndex++}`);
        values.push(updates.messageNotifications);
      }
      if (updates.systemNotifications !== undefined) {
        setClauses.push(`system_notifications = $${paramIndex++}`);
        values.push(updates.systemNotifications);
      }

      setClauses.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());

      // Add userId for WHERE clause
      values.push(userId);

      const updated = await this.db.query<PreferencesRow>(
        `UPDATE notification_preferences SET ${setClauses.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
        values
      );

      if (!updated[0]) {
        throw new Error('Failed to update preferences');
      }

      // Clear cached preferences (Redis optional)
      if (this.redis) await this.redis.del(`user_preferences:${userId}`);

      return this.convertPreferencesRow(updated[0]);
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  // ============================================================================
  // NOTIFICATION QUEUING AND PROCESSING
  // ============================================================================

  /**
   * Queue notification for background processing
   */
  private async queueNotification(
    notificationId: number,
    channel: 'email' | 'push' | 'sms',
    data: NotificationInput,
    scheduledAt?: Date
  ): Promise<void> {
    try {
      const queueItem: NotificationQueueItem = {
        id: `${notificationId}_${channel}_${Date.now()}`,
        notificationId,
        channel,
        priority: data.priority,
        scheduledAt: scheduledAt || new Date(),
        attempts: 0,
        maxAttempts: 3,
        data,
        createdAt: new Date()
      };

      // Add to Redis queue based on priority. Redis is optional — if it isn't wired,
      // skip async-channel queueing (in-app notifications are persisted separately).
      if (!this.redis) return;
      const queueKey = `notification_queue:${data.priority}:${channel}`;
      await this.redis.rpush(queueKey, JSON.stringify(queueItem));

      // Track queue size metrics
      await this.redis.hset('notification_metrics', `queue_size_${channel}`,
        (await this.redis.llen(queueKey)).toString()
      );
    } catch (error) {
      console.error('Error queuing notification:', error);
      throw error;
    }
  }

  /**
   * Start the background queue processor
   */
  private startQueueProcessor(): void {
    if (!this.redis) return; // No Redis configured — don't start the background drain loop
    setInterval(() => {
      if (!this.isProcessing) {
        this.processQueues();
      }
    }, this.processingInterval);
  }

  /**
   * Process notification queues
   */
  private async processQueues(): Promise<void> {
    // Redis is optional (wired as undefined in the live worker). Without it there is
    // no async-channel queue to drain — bail before touching this.redis.lpop, which
    // otherwise threw "Cannot read properties of undefined (reading 'lpop')" every
    // 15 min on the cron. Surfaced via Cloudflare Observability 2026-05-30.
    if (!this.redis) return;
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      const channels = ['email', 'push', 'sms'];
      const priorities = ['urgent', 'high', 'normal', 'low'];

      for (const channel of channels) {
        for (const priority of priorities) {
          await this.processQueue(channel as 'email' | 'push' | 'sms', priority);
        }
      }
    } catch (error) {
      console.error('Error processing notification queues:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process specific queue
   */
  private async processQueue(channel: 'email' | 'push' | 'sms', priority: string): Promise<void> {
    const queueKey = `notification_queue:${priority}:${channel}`;

    for (let i = 0; i < this.batchSize; i++) {
      const itemJson = await this.redis.lpop(queueKey);
      if (!itemJson) break;

      try {
        const item: NotificationQueueItem = JSON.parse(itemJson);

        // Check if scheduled time has passed
        if (new Date(item.scheduledAt) > new Date()) {
          // Put back in queue for later processing
          await this.redis.rpush(queueKey, itemJson);
          continue;
        }

        await this.processQueueItem(item);
      } catch (error) {
        console.error(`Error processing queue item for ${channel}:`, error);
      }
    }
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(item: NotificationQueueItem): Promise<void> {
    try {
      let success = false;
      let errorMessage = '';
      let providerId = '';

      // Create delivery record
      const deliveries = await this.db.query<DeliveryRow>(
        `INSERT INTO notification_deliveries (
          notification_id, channel, status, attempts, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          item.notificationId,
          item.channel,
          'sending',
          item.attempts + 1,
          new Date(),
          new Date()
        ]
      );

      const delivery = deliveries[0];

      try {
        switch (item.channel) {
          case 'email':
            const result = await this.sendEmailNotification(item.data, delivery.id);
            success = result.success;
            providerId = result.messageId || '';
            errorMessage = result.error || '';
            break;
          case 'push':
            // Implement push notification sending
            success = await this.sendPushNotification(item.data, delivery.id);
            break;
          case 'sms':
            // Implement SMS notification sending
            success = await this.sendSMSNotification(item.data, delivery.id);
            break;
        }

        // Update delivery record
        await this.db.query(
          `UPDATE notification_deliveries SET
            status = $1, provider_id = $2, error_message = $3, sent_at = $4, updated_at = $5
          WHERE id = $6`,
          [
            success ? 'sent' : 'failed',
            providerId || null,
            success ? null : errorMessage,
            success ? new Date() : null,
            new Date(),
            delivery.id
          ]
        );

      } catch (sendError) {
        success = false;
        errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';

        // Update delivery record with error
        await this.db.query(
          `UPDATE notification_deliveries SET status = $1, error_message = $2, updated_at = $3 WHERE id = $4`,
          ['failed', errorMessage, new Date(), delivery.id]
        );
      }

      // Handle retry logic
      if (!success && item.attempts < item.maxAttempts) {
        const retryDelay = Math.min(1000 * Math.pow(2, item.attempts), 30000); // Exponential backoff
        const retryItem = {
          ...item,
          attempts: item.attempts + 1,
          lastAttemptAt: new Date(),
          scheduledAt: new Date(Date.now() + retryDelay)
        };

        const queueKey = `notification_queue:${item.priority}:${item.channel}`;
        await this.redis.rpush(queueKey, JSON.stringify(retryItem));
      }

    } catch (error) {
      console.error('Error processing queue item:', error);
    }
  }

  // ============================================================================
  // CHANNEL-SPECIFIC SENDING
  // ============================================================================

  /**
   * Send email notification
   */
  private async sendEmailNotification(data: NotificationInput, _deliveryId: number): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      // Get user email
      const users = await this.db.query<UserRow>(
        'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
        [data.userId]
      );

      const user = users[0];
      if (!user?.email) {
        return { success: false, error: 'User email not found' };
      }

      // Prepare email data - cast to any to handle template type compatibility
      const emailData: Parameters<EmailService['sendEmail']>[0] = {
        to: user.email,
        subject: data.title,
        html: data.message,
        variables: {
          recipientName: user.first_name || 'User',
          title: data.title,
          message: data.message,
          actionUrl: data.actionUrl || '',
          ...(data.emailOptions?.variables || {})
        }
      };

      const result = await this.email.sendEmail(emailData);

      return {
        success: result.success,
        messageId: result.messageId ?? undefined,
        error: result.error ?? undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send push notification (placeholder)
   */
  private async sendPushNotification(data: NotificationInput, _deliveryId: number): Promise<boolean> {
    try {
      // Implement push notification logic here
      // This would integrate with Firebase, APNs, or other push services
      console.log('Push notification would be sent:', data.title);
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  /**
   * Send SMS notification (placeholder)
   */
  private async sendSMSNotification(data: NotificationInput, _deliveryId: number): Promise<boolean> {
    try {
      // Implement SMS logic here
      // This would integrate with Twilio, AWS SNS, or other SMS services
      console.log('SMS notification would be sent:', data.title);
      return true;
    } catch (error) {
      console.error('Error sending SMS notification:', error);
      return false;
    }
  }

  /**
   * Send in-app notification via WebSocket
   */
  private async sendInAppNotification(notification: NotificationRow, data: NotificationInput): Promise<void> {
    try {
      // Send via messaging service WebSocket if broadcastToUser method exists
      if ('broadcastToUser' in this.messaging && typeof (this.messaging as any).broadcastToUser === 'function') {
        await (this.messaging as any).broadcastToUser(data.userId, {
          type: 'notification',
          data: {
            id: notification.id,
            type: data.type,
            title: data.title,
            message: data.message,
            priority: data.priority,
            actionUrl: data.actionUrl,
            timestamp: notification.created_at
          }
        });
      }
    } catch (error) {
      console.error('Error sending in-app notification:', error);
      // Don't throw - in-app notification failure shouldn't break the flow
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Determine which channels to use for notification
   */
  private async determineChannels(input: NotificationInput, preferences: NotificationPreferences): Promise<string[]> {
    const channels: string[] = [];

    // Always include in-app
    channels.push('in_app');

    // Check explicit channel preferences in input
    if (input.channels) {
      if (input.channels.email) channels.push('email');
      if (input.channels.push) channels.push('push');
      if (input.channels.sms) channels.push('sms');
      return channels;
    }

    // Check if user is in quiet hours
    const inQuietHours = await this.isInQuietHours(preferences);

    // Apply user preferences and quiet hours
    if (preferences.emailNotifications && !inQuietHours) {
      // Check category-specific preferences
      const categoryAllowed = this.isCategoryAllowed(input.type, preferences);
      if (categoryAllowed) {
        channels.push('email');
      }
    }

    if (preferences.pushNotifications) {
      // Push notifications can bypass quiet hours for urgent notifications
      if (!inQuietHours || input.priority === 'urgent') {
        channels.push('push');
      }
    }

    if (preferences.smsNotifications && input.priority === 'urgent') {
      // SMS only for urgent notifications
      channels.push('sms');
    }

    return channels;
  }

  /**
   * Check if current time is in user's quiet hours
   */
  private async isInQuietHours(preferences: NotificationPreferences): Promise<boolean> {
    if (!preferences.quietHoursEnabled || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    try {
      const now = new Date();
      const timezone = preferences.timezone || 'UTC';
      const currentTime = now.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      const start = preferences.quietHoursStart;
      const end = preferences.quietHoursEnd;

      // Handle overnight quiet hours (e.g., 22:00 to 08:00)
      if (start > end) {
        return currentTime >= start || currentTime <= end;
      } else {
        return currentTime >= start && currentTime <= end;
      }
    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return false;
    }
  }

  /**
   * Check if notification category is allowed by user preferences
   */
  private isCategoryAllowed(type: string, preferences: NotificationPreferences): boolean {
    switch (type) {
      case 'nda_request':
      case 'nda_approval':
      case 'nda_rejection':
      case 'nda_expiration':
      case 'nda_reminder':
        // No dedicated pref column — NDA notifications are transactional/important,
        // always allowed (previously read a non-existent `ndaNotifications` → undefined
        // → silently blocked). See issue #361.
        return true;
      case 'investment':
        return preferences.investmentAlerts; // was `investmentNotifications` (not a loaded field) → always blocked
      case 'message':
        return preferences.messageNotifications;
      case 'pitch_update':
        // No dedicated pref column — relevant to followers, allowed by default
        // (previously read a non-existent `pitchUpdateNotifications` → silently blocked).
        return true;
      case 'system':
        return preferences.systemNotifications;
      case 'marketing':
        return preferences.marketingEmails;
      default:
        return true;
    }
  }

  /**
   * Cache notification for real-time delivery
   */
  private async cacheNotification(notification: NotificationRow, userId: number): Promise<void> {
    if (!this.redis) return; // Redis optional — skip the recent-notifications cache
    try {
      const cacheKey = `user_notifications:${userId}`;
      const notificationData = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        actionUrl: notification.action_url,
        timestamp: notification.created_at,
        read: false
      };

      await this.redis.rpush(cacheKey, JSON.stringify(notificationData));

      // Keep only recent 100 notifications in cache
      const length = await this.redis.llen(cacheKey);
      if (length > 100) {
        await this.redis.lpop(cacheKey);
      }
    } catch (error) {
      console.error('Error caching notification:', error);
    }
  }

  // ============================================================================
  // NOTIFICATION ANALYTICS AND METRICS
  // ============================================================================

  /**
   * Get notification metrics
   */
  async getNotificationMetrics(
    userId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<NotificationMetrics> {
    try {
      // Build WHERE clause dynamically
      const conditions: string[] = [];
      const values: (number | Date)[] = [];
      let paramIndex = 1;

      if (userId) {
        conditions.push(`n.user_id = $${paramIndex++}`);
        values.push(userId);
      }
      if (startDate) {
        conditions.push(`n.created_at >= $${paramIndex++}`);
        values.push(startDate);
      }
      if (endDate) {
        conditions.push(`n.created_at <= $${paramIndex++}`);
        values.push(endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get overall metrics
      const metricsResult = await this.db.query<MetricsRow>(
        `SELECT
          COUNT(DISTINCT nd.id) as total_sent,
          COUNT(DISTINCT CASE WHEN nd.status IN ('sent', 'delivered') THEN nd.id END) as total_delivered,
          COUNT(DISTINCT CASE WHEN nd.read_at IS NOT NULL THEN nd.id END) as total_read,
          COUNT(DISTINCT CASE WHEN nd.clicked_at IS NOT NULL THEN nd.id END) as total_clicked,
          COUNT(DISTINCT CASE WHEN nd.status = 'failed' THEN nd.id END) as total_failed
        FROM notifications n
        LEFT JOIN notification_deliveries nd ON nd.notification_id = n.id
        ${whereClause}`,
        values
      );

      const overallStats = metricsResult[0] || {
        total_sent: 0,
        total_delivered: 0,
        total_read: 0,
        total_clicked: 0,
        total_failed: 0
      };

      // Calculate rates
      const totalSent = Number(overallStats.total_sent) || 1;
      const totalDelivered = Number(overallStats.total_delivered);
      const totalRead = Number(overallStats.total_read);
      const totalClicked = Number(overallStats.total_clicked);
      const totalFailed = Number(overallStats.total_failed);

      return {
        totalSent,
        totalDelivered,
        totalRead,
        totalClicked,
        totalFailed,
        deliveryRate: (totalDelivered / totalSent) * 100,
        openRate: totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0,
        clickRate: totalRead > 0 ? (totalClicked / totalRead) * 100 : 0,
        bounceRate: (totalFailed / totalSent) * 100,
        byChannel: {}, // Would implement detailed channel metrics
        byType: {}      // Would implement detailed type metrics
      };
    } catch (error) {
      console.error('Error getting notification metrics:', error);
      throw error;
    }
  }

  /**
   * Mark notification as delivered (called by webhooks)
   */
  async markAsDelivered(providerId: string, deliveredAt?: Date): Promise<void> {
    try {
      await this.db.query(
        `UPDATE notification_deliveries SET status = $1, delivered_at = $2, updated_at = $3 WHERE provider_id = $4`,
        ['delivered', deliveredAt || new Date(), new Date(), providerId]
      );
    } catch (error) {
      console.error('Error marking notification as delivered:', error);
    }
  }

  /**
   * Mark notification as read (called by user interaction)
   */
  async markAsRead(notificationId: number, userId: number): Promise<void> {
    try {
      // Update notification
      await this.db.query(
        `UPDATE notifications SET is_read = $1, read_at = $2, updated_at = $3 WHERE id = $4 AND user_id = $5`,
        [true, new Date(), new Date(), notificationId, userId]
      );

      // Update delivery records
      await this.db.query(
        `UPDATE notification_deliveries SET read_at = $1, updated_at = $2 WHERE notification_id = $3`,
        [new Date(), new Date(), notificationId]
      );

      // Remove from cache (Redis optional)
      if (this.redis) await this.redis.del(`user_notifications:${userId}`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      includeRead?: boolean;
      type?: string;
    } = {}
  ): Promise<{ notifications: NotificationRow[]; total: number }> {
    try {
      const limit = options.limit || 20;
      const offset = options.offset || 0;

      // Build WHERE clause
      const conditions: string[] = ['user_id = $1'];
      const values: (number | string | boolean)[] = [userId];
      let paramIndex = 2;

      if (!options.includeRead) {
        conditions.push(`is_read = $${paramIndex++}`);
        values.push(false);
      }

      if (options.type) {
        conditions.push(`type = $${paramIndex++}`);
        values.push(options.type);
      }

      const whereClause = conditions.join(' AND ');

      const notifications = await this.db.query<NotificationRow>(
        `SELECT * FROM notifications WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...values, limit, offset]
      );

      const countResult = await this.db.query<CountRow>(
        `SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}`,
        values
      );

      return {
        notifications,
        total: Number(countResult[0]?.count || 0)
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }
}

// Export service factory
export function createNotificationService(
  connectionString: string,
  redis: RedisService,
  email: EmailService,
  messaging: MessagingService
): NotificationService {
  return new NotificationService(connectionString, redis, email, messaging);
}
