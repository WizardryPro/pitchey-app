/**
 * Notification-related database queries using raw SQL
 * Replaces Drizzle ORM with parameterized Neon queries
 */

import type { SqlQuery } from './base';
import { WhereBuilder, extractFirst, extractMany, DatabaseError, withTransaction } from './base';

// Type definitions
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  is_read: boolean;
  read_at?: Date;
  related_pitch_id?: string;
  related_user_id?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationPreference {
  user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  in_app_notifications: boolean;
  notification_types?: Record<string, boolean>;
  email_frequency: 'instant' | 'daily' | 'weekly' | 'never';
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationDelivery {
  id: string;
  notification_id: string;
  channel: 'email' | 'push' | 'sms' | 'in_app';
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface CreateNotificationInput {
  user_id: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  related_pitch_id?: string;
  related_user_id?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  expires_at?: Date;
}

// Core notification queries
export async function createNotification(
  sql: SqlQuery,
  input: CreateNotificationInput
): Promise<Notification> {
  const result = await sql`
    INSERT INTO notifications (
      user_id, type, title, message, metadata,
      priority, category, is_read,
      related_pitch_id, related_user_id,
      related_entity_type, related_entity_id,
      expires_at, created_at, updated_at
    ) VALUES (
      ${input.user_id}, ${input.type}, ${input.title}, ${input.message},
      ${input.metadata || null}::jsonb,
      ${input.priority || 'medium'}, ${input.category || null}, false,
      ${input.related_pitch_id || null}, ${input.related_user_id || null},
      ${input.related_entity_type || null}, ${input.related_entity_id || null},
      ${input.expires_at || null}, NOW(), NOW()
    )
    RETURNING *
  `;
  
  const notification = extractFirst<Notification>(result);
  if (!notification) {
    throw new DatabaseError('Failed to create notification');
  }
  return notification;
}

export async function createBatchNotifications(
  sql: SqlQuery,
  notifications: CreateNotificationInput[]
): Promise<Notification[]> {
  if (notifications.length === 0) return [];

  // Build values for batch insert
  const values = notifications.map((n, i) => {
    const base = i * 12; // 12 parameters per notification
    return `(
      $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::jsonb,
      $${base + 6}, $${base + 7}, false,
      $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11},
      $${base + 12}, NOW(), NOW()
    )`;
  }).join(', ');

  const params = notifications.flatMap(n => [
    n.user_id, n.type, n.title, n.message, n.metadata || null,
    n.priority || 'medium', n.category || null,
    n.related_pitch_id || null, n.related_user_id || null,
    n.related_entity_type || null, n.related_entity_id || null,
    n.expires_at || null
  ]);

  const query = `
    INSERT INTO notifications (
      user_id, type, title, message, metadata,
      priority, category, is_read,
      related_pitch_id, related_user_id,
      related_entity_type, related_entity_id,
      expires_at, created_at, updated_at
    ) VALUES ${values}
    RETURNING *
  `;

  const result = await sql.query(query, params);
  return extractMany<Notification>(result);
}

export async function getUserNotifications(
  sql: SqlQuery,
  userId: string,
  options?: {
    includeRead?: boolean;
    type?: string;
    category?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Notification[]> {
  const wb = new WhereBuilder();
  wb.add('n.user_id = $param', userId);
  
  if (!options?.includeRead) {
    wb.add('n.is_read = false');
  }
  
  wb.addOptional('n.type', '=', options?.type);
  wb.addOptional('n.category', '=', options?.category);
  wb.addOptional('n.priority', '=', options?.priority);
  wb.add('(n.expires_at IS NULL OR n.expires_at > NOW())');
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT 
      n.*,
      CASE WHEN n.related_pitch_id IS NOT NULL THEN p.title END as pitch_title,
      CASE WHEN n.related_user_id IS NOT NULL THEN u.username END as related_username
    FROM notifications n
    LEFT JOIN pitches p ON n.related_pitch_id = p.id
    LEFT JOIN users u ON n.related_user_id = u.id
    ${where}
    ORDER BY n.priority = 'urgent' DESC, n.created_at DESC
    ${options?.limit ? `LIMIT ${options.limit}` : 'LIMIT 50'}
    ${options?.offset ? `OFFSET ${options.offset}` : ''}
  `;
  
  const result = await sql.query(query, params);
  return extractMany<Notification>(result);
}

export async function markNotificationRead(
  sql: SqlQuery,
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await sql`
    UPDATE notifications 
    SET 
      is_read = true,
      read_at = NOW(),
      updated_at = NOW()
    WHERE id = ${notificationId} AND user_id = ${userId}
    RETURNING id
  `;
  
  // Also mark delivery as read
  if (result.length > 0) {
    await sql`
      UPDATE notification_deliveries
      SET read_at = NOW()
      WHERE notification_id = ${notificationId} AND read_at IS NULL
    `;
  }
  
  return result.length > 0;
}

export async function markAllNotificationsRead(
  sql: SqlQuery,
  userId: string
): Promise<number> {
  const result = await sql`
    UPDATE notifications 
    SET 
      is_read = true,
      read_at = NOW(),
      updated_at = NOW()
    WHERE user_id = ${userId} AND is_read = false
    RETURNING id
  `;
  
  const notificationIds = result.map(r => r.id);
  if (notificationIds.length > 0) {
    await sql`
      UPDATE notification_deliveries
      SET read_at = NOW()
      WHERE notification_id = ANY(${notificationIds}) AND read_at IS NULL
    `;
  }
  
  return result.length;
}

// Notification preferences
export async function getUserPreferences(
  sql: SqlQuery,
  userId: string
): Promise<NotificationPreference | null> {
  const result = await sql`
    SELECT * FROM notification_preferences
    WHERE user_id = ${userId}
  `;
  return extractFirst<NotificationPreference>(result);
}

export async function upsertUserPreferences(
  sql: SqlQuery,
  userId: string,
  preferences: Partial<NotificationPreference>
): Promise<NotificationPreference> {
  const result = await sql`
    INSERT INTO notification_preferences (
      user_id, email_notifications, push_notifications,
      sms_notifications, in_app_notifications,
      notification_types, email_frequency,
      quiet_hours_start, quiet_hours_end,
      created_at, updated_at
    ) VALUES (
      ${userId},
      ${preferences.email_notifications ?? true},
      ${preferences.push_notifications ?? true},
      ${preferences.sms_notifications ?? false},
      ${preferences.in_app_notifications ?? true},
      ${preferences.notification_types || {}}::jsonb,
      ${preferences.email_frequency || 'instant'},
      ${preferences.quiet_hours_start || null},
      ${preferences.quiet_hours_end || null},
      NOW(), NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      email_notifications = EXCLUDED.email_notifications,
      push_notifications = EXCLUDED.push_notifications,
      sms_notifications = EXCLUDED.sms_notifications,
      in_app_notifications = EXCLUDED.in_app_notifications,
      notification_types = EXCLUDED.notification_types,
      email_frequency = EXCLUDED.email_frequency,
      quiet_hours_start = EXCLUDED.quiet_hours_start,
      quiet_hours_end = EXCLUDED.quiet_hours_end,
      updated_at = NOW()
    RETURNING *
  `;
  
  const pref = extractFirst<NotificationPreference>(result);
  if (!pref) {
    throw new DatabaseError('Failed to upsert preferences');
  }
  return pref;
}

// Notification delivery tracking
export async function createDelivery(
  sql: SqlQuery,
  notificationId: string,
  channel: 'email' | 'push' | 'sms' | 'in_app',
  metadata?: Record<string, any>
): Promise<NotificationDelivery> {
  const result = await sql`
    INSERT INTO notification_deliveries (
      notification_id, channel, status, metadata, created_at
    ) VALUES (
      ${notificationId}, ${channel}, 'pending',
      ${metadata || null}::jsonb, NOW()
    )
    RETURNING *
  `;
  
  const delivery = extractFirst<NotificationDelivery>(result);
  if (!delivery) {
    throw new DatabaseError('Failed to create delivery');
  }
  return delivery;
}

export async function updateDeliveryStatus(
  sql: SqlQuery,
  deliveryId: string,
  status: 'sent' | 'delivered' | 'failed',
  errorMessage?: string
): Promise<boolean> {
  const result = await sql`
    UPDATE notification_deliveries
    SET 
      status = ${status},
      ${status === 'sent' ? sql`sent_at = NOW(),` : sql``}
      ${status === 'delivered' ? sql`delivered_at = NOW(),` : sql``}
      ${errorMessage ? sql`error_message = ${errorMessage},` : sql``}
      updated_at = NOW()
    WHERE id = ${deliveryId}
    RETURNING id
  `;
  return result.length > 0;
}

// Analytics and metrics
export async function getNotificationStats(
  sql: SqlQuery,
  userId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  deliveryRate: number;
  readRate: number;
  byType: Record<string, number>;
  byChannel: Record<string, number>;
}> {
  const wb = new WhereBuilder();
  wb.addOptional('n.user_id', '=', userId);
  wb.addOptional('n.created_at', '>=', startDate);
  wb.addOptional('n.created_at', '<=', endDate);
  
  const { where, params } = wb.build();
  
  // Overall stats
  const overallQuery = `
    SELECT 
      COUNT(DISTINCT nd.id) as total_sent,
      COUNT(DISTINCT CASE WHEN nd.status IN ('sent', 'delivered') THEN nd.id END) as total_delivered,
      COUNT(DISTINCT CASE WHEN nd.read_at IS NOT NULL THEN nd.id END) as total_read
    FROM notifications n
    LEFT JOIN notification_deliveries nd ON nd.notification_id = n.id
    ${where}
  `;
  
  const overall = await sql.query(overallQuery, params);
  const stats = extractFirst<any>(overall) || {};
  
  // By type
  const typeQuery = `
    SELECT n.type, COUNT(*) as count
    FROM notifications n
    ${where}
    GROUP BY n.type
  `;
  
  const typeResults = await sql.query(typeQuery, params);
  const byType: Record<string, number> = {};
  typeResults.forEach((r: any) => {
    byType[r.type] = Number(r.count);
  });
  
  // By channel
  const channelQuery = `
    SELECT nd.channel, COUNT(*) as count
    FROM notifications n
    JOIN notification_deliveries nd ON nd.notification_id = n.id
    ${where.replace('WHERE', 'WHERE nd.notification_id = n.id AND')}
    GROUP BY nd.channel
  `;
  
  const channelResults = await sql.query(channelQuery, params);
  const byChannel: Record<string, number> = {};
  channelResults.forEach((r: any) => {
    byChannel[r.channel] = Number(r.count);
  });
  
  const totalSent = Number(stats.total_sent || 0);
  const totalDelivered = Number(stats.total_delivered || 0);
  const totalRead = Number(stats.total_read || 0);
  
  return {
    totalSent,
    totalDelivered,
    totalRead,
    deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
    readRate: totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0,
    byType,
    byChannel
  };
}

// Queue management for async processing
export async function getQueuedNotifications(
  sql: SqlQuery,
  limit: number = 100
): Promise<Array<Notification & { delivery_id: string; channel: string }>> {
  const result = await sql`
    SELECT 
      n.*,
      nd.id as delivery_id,
      nd.channel
    FROM notifications n
    JOIN notification_deliveries nd ON nd.notification_id = n.id
    WHERE nd.status = 'pending'
      AND (n.expires_at IS NULL OR n.expires_at > NOW())
    ORDER BY n.priority = 'urgent' DESC, n.created_at ASC
    LIMIT ${limit}
  `;
  return extractMany<any>(result);
}

// Clean up expired notifications
export async function deleteExpiredNotifications(
  sql: SqlQuery,
  beforeDate?: Date
): Promise<number> {
  const cutoffDate = beforeDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  
  const result = await sql`
    DELETE FROM notifications
    WHERE expires_at < ${cutoffDate}
       OR (is_read = true AND read_at < ${cutoffDate})
    RETURNING id
  `;
  
  return result.length;
}