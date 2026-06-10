/**
 * NDA Audit Trail and Security Logging Service
 * Provides comprehensive logging for all NDA-related actions and security events
 */

import { createDatabase } from '../db/raw-sql-connection';

// Audit Event Types
export const AuditEventTypes = {
  // NDA Events
  NDA_REQUEST_CREATED: 'nda_request_created',
  NDA_REQUEST_APPROVED: 'nda_request_approved',
  NDA_REQUEST_REJECTED: 'nda_request_rejected',
  NDA_SIGNED: 'nda_signed',
  NDA_REVOKED: 'nda_revoked',
  NDA_EXPIRED: 'nda_expired',
  NDA_TEMPLATE_CREATED: 'nda_template_created',
  NDA_TEMPLATE_UPDATED: 'nda_template_updated',
  NDA_TEMPLATE_DELETED: 'nda_template_deleted',
  NDA_BULK_ACTION: 'nda_bulk_action',
  NDA_EXPORT: 'nda_export',
  NDA_DOCUMENT_ACCESSED: 'nda_document_accessed',
  NDA_DOCUMENT_DOWNLOADED: 'nda_document_downloaded',
  
  // Security Events
  UNAUTHORIZED_ACCESS_ATTEMPT: 'unauthorized_access_attempt',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  IP_CHANGE_DETECTED: 'ip_change_detected',
  MULTIPLE_LOGIN_ATTEMPTS: 'multiple_login_attempts',
  ADMIN_ACTION: 'admin_action',
  DATA_EXPORT: 'data_export',
  PERMISSION_CHANGE: 'permission_change',
  
  // General Actions
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  PASSWORD_CHANGE: 'password_change',
  EMAIL_CHANGE: 'email_change',
  PROFILE_UPDATE: 'profile_update',
} as const;

export type AuditEventType = typeof AuditEventTypes[keyof typeof AuditEventTypes];

// Risk Levels
export const RiskLevels = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export type RiskLevel = typeof RiskLevels[keyof typeof RiskLevels];

// Audit Log Entry
export interface AuditLogEntry {
  id?: number;
  userId?: number;
  eventType: AuditEventType;
  eventCategory: 'nda' | 'security' | 'auth' | 'admin' | 'data';
  riskLevel: RiskLevel;
  
  // Event Details
  description: string;
  entityType?: string; // 'nda', 'user', 'pitch', 'template'
  entityId?: number;
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  location?: {
    country?: string;
    city?: string;
    region?: string;
  };
  
  // Changes (for tracking what changed)
  changes?: {
    field: string;
    oldValue?: any;
    newValue?: any;
  }[];
  
  // Additional metadata
  metadata?: Record<string, any>;
  
  // Timestamps
  timestamp: string;
  processedAt?: string;
}

// Filter options for audit log queries
export interface AuditLogFilters {
  userId?: number;
  eventTypes?: AuditEventType[];
  eventCategories?: string[];
  riskLevels?: RiskLevel[];
  entityType?: string;
  entityId?: number;
  ipAddress?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export class AuditTrailService {
  private db: any;
  private kvNamespace?: KVNamespace;

  constructor(db: any, kvNamespace?: KVNamespace) {
    this.db = db;
    this.kvNamespace = kvNamespace;
  }

  /**
   * Log an audit event
   */
  async logEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      
      // Insert into audit_logs table
      // `action` is NOT NULL in audit_logs but wasn't in this insert, so every
      // logEvent() threw "null value in column action" and the audit event was
      // dropped. Map it from eventType (the action being audited).
      const query = `
        INSERT INTO audit_logs (
          user_id, event_type, event_category, risk_level,
          description, entity_type, entity_id,
          ip_address, user_agent, session_id, location,
          changes, metadata, timestamp, action
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `;

      await this.db.query(query, [
        entry.userId || null,
        entry.eventType,
        entry.eventCategory,
        entry.riskLevel,
        entry.description,
        entry.entityType || null,
        entry.entityId || null,
        entry.ipAddress || null,
        entry.userAgent || null,
        entry.sessionId || null,
        entry.location ? JSON.stringify(entry.location) : null,
        entry.changes ? JSON.stringify(entry.changes) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        timestamp,
        entry.eventType || 'unknown'
      ]);

      // Also log to security_events table if it's a security event
      if (entry.eventCategory === 'security' || entry.riskLevel === 'high' || entry.riskLevel === 'critical') {
        await this.logSecurityEvent(entry, timestamp);
      }

      // Cache recent high-risk events for quick access
      if (entry.riskLevel === 'high' || entry.riskLevel === 'critical') {
        await this.cacheHighRiskEvent(entry, timestamp);
      }

    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw to avoid breaking the main operation
    }
  }

  /**
   * Log a security event to the security_events table
   */
  private async logSecurityEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>, timestamp: string): Promise<void> {
    const query = `
      INSERT INTO security_events (
        user_id, event_type, event_status,
        ip_address, user_agent, location, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const eventStatus = entry.riskLevel === 'critical' ? 'failure' : 
                       entry.riskLevel === 'high' ? 'warning' : 'success';

    await this.db.query(query, [
      entry.userId || null,
      entry.eventType,
      eventStatus,
      entry.ipAddress || null,
      entry.userAgent || null,
      entry.location ? JSON.stringify(entry.location) : null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      timestamp
    ]);
  }

  /**
   * Cache high-risk events for quick access
   */
  private async cacheHighRiskEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>, timestamp: string): Promise<void> {
    if (!this.kvNamespace) return;

    try {
      const cacheKey = `audit:high_risk:${Date.now()}`;
      const cacheEntry = { ...entry, timestamp };
      
      await this.kvNamespace.put(
        cacheKey, 
        JSON.stringify(cacheEntry),
        { expirationTtl: 7 * 24 * 60 * 60 } // 7 days
      );
    } catch (error) {
      console.error('Failed to cache high-risk event:', error);
    }
  }

  /**
   * Retrieve audit logs with filtering
   */
  async getAuditLogs(filters: AuditLogFilters = {}): Promise<{
    logs: AuditLogEntry[];
    totalCount: number;
  }> {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }

    if (filters.eventTypes?.length) {
      conditions.push(`event_type = ANY($${paramIndex++})`);
      params.push(filters.eventTypes);
    }

    if (filters.eventCategories?.length) {
      conditions.push(`event_category = ANY($${paramIndex++})`);
      params.push(filters.eventCategories);
    }

    if (filters.riskLevels?.length) {
      conditions.push(`risk_level = ANY($${paramIndex++})`);
      params.push(filters.riskLevels);
    }

    if (filters.entityType) {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(filters.entityType);
    }

    if (filters.entityId) {
      conditions.push(`entity_id = $${paramIndex++}`);
      params.push(filters.entityId);
    }

    if (filters.ipAddress) {
      conditions.push(`ip_address = $${paramIndex++}`);
      params.push(filters.ipAddress);
    }

    if (filters.dateFrom) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(filters.dateTo);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs
      ${whereClause}
    `;
    
    const countResult = await this.db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total);

    // Get logs with pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const dataQuery = `
      SELECT 
        id, user_id, event_type, event_category, risk_level,
        description, entity_type, entity_id,
        ip_address, user_agent, session_id, location,
        changes, metadata, timestamp, processed_at
      FROM audit_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);
    
    const result = await this.db.query(dataQuery, params);
    
    const logs = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      eventType: row.event_type,
      eventCategory: row.event_category,
      riskLevel: row.risk_level,
      description: row.description,
      entityType: row.entity_type,
      entityId: row.entity_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      sessionId: row.session_id,
      location: row.location ? JSON.parse(row.location) : null,
      changes: row.changes ? JSON.parse(row.changes) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      timestamp: row.timestamp,
      processedAt: row.processed_at,
    }));

    return { logs, totalCount };
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(timeframe: string = '30d'): Promise<{
    totalEvents: number;
    eventsByCategory: Record<string, number>;
    eventsByRisk: Record<string, number>;
    topUsers: Array<{ userId: number; eventCount: number }>;
    recentHighRiskEvents: AuditLogEntry[];
  }> {
    const daysBack = parseInt(timeframe.replace('d', ''));
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysBack);

    // Total events
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs
      WHERE timestamp >= $1
    `;
    const totalResult = await this.db.query(totalQuery, [dateFrom.toISOString()]);
    const totalEvents = parseInt(totalResult.rows[0].total);

    // Events by category
    const categoryQuery = `
      SELECT event_category, COUNT(*) as count
      FROM audit_logs
      WHERE timestamp >= $1
      GROUP BY event_category
    `;
    const categoryResult = await this.db.query(categoryQuery, [dateFrom.toISOString()]);
    const eventsByCategory = categoryResult.rows.reduce((acc: any, row: any) => {
      acc[row.event_category] = parseInt(row.count);
      return acc;
    }, {});

    // Events by risk level
    const riskQuery = `
      SELECT risk_level, COUNT(*) as count
      FROM audit_logs
      WHERE timestamp >= $1
      GROUP BY risk_level
    `;
    const riskResult = await this.db.query(riskQuery, [dateFrom.toISOString()]);
    const eventsByRisk = riskResult.rows.reduce((acc: any, row: any) => {
      acc[row.risk_level] = parseInt(row.count);
      return acc;
    }, {});

    // Top users by event count
    const usersQuery = `
      SELECT user_id, COUNT(*) as event_count
      FROM audit_logs
      WHERE timestamp >= $1 AND user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY event_count DESC
      LIMIT 10
    `;
    const usersResult = await this.db.query(usersQuery, [dateFrom.toISOString()]);
    const topUsers = usersResult.rows.map((row: any) => ({
      userId: row.user_id,
      eventCount: parseInt(row.event_count),
    }));

    // Recent high-risk events
    const highRiskQuery = `
      SELECT 
        id, user_id, event_type, event_category, risk_level,
        description, entity_type, entity_id,
        ip_address, user_agent, session_id, location,
        changes, metadata, timestamp
      FROM audit_logs
      WHERE timestamp >= $1 AND risk_level IN ('high', 'critical')
      ORDER BY timestamp DESC
      LIMIT 20
    `;
    const highRiskResult = await this.db.query(highRiskQuery, [dateFrom.toISOString()]);
    const recentHighRiskEvents = highRiskResult.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      eventType: row.event_type,
      eventCategory: row.event_category,
      riskLevel: row.risk_level,
      description: row.description,
      entityType: row.entity_type,
      entityId: row.entity_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      sessionId: row.session_id,
      location: row.location ? JSON.parse(row.location) : null,
      changes: row.changes ? JSON.parse(row.changes) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      timestamp: row.timestamp,
    }));

    return {
      totalEvents,
      eventsByCategory,
      eventsByRisk,
      topUsers,
      recentHighRiskEvents,
    };
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityAuditTrail(entityType: string, entityId: number, limit = 100): Promise<AuditLogEntry[]> {
    const query = `
      SELECT 
        id, user_id, event_type, event_category, risk_level,
        description, entity_type, entity_id,
        ip_address, user_agent, session_id, location,
        changes, metadata, timestamp
      FROM audit_logs
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY timestamp DESC
      LIMIT $3
    `;

    const result = await this.db.query(query, [entityType, entityId, limit]);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      eventType: row.event_type,
      eventCategory: row.event_category,
      riskLevel: row.risk_level,
      description: row.description,
      entityType: row.entity_type,
      entityId: row.entity_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      sessionId: row.session_id,
      location: row.location ? JSON.parse(row.location) : null,
      changes: row.changes ? JSON.parse(row.changes) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      timestamp: row.timestamp,
    }));
  }

  /**
   * Export audit logs as CSV
   */
  async exportAuditLogs(filters: AuditLogFilters = {}): Promise<string> {
    const { logs } = await this.getAuditLogs({ ...filters, limit: 10000 });
    
    const headers = [
      'ID', 'User ID', 'Event Type', 'Category', 'Risk Level',
      'Description', 'Entity Type', 'Entity ID',
      'IP Address', 'User Agent', 'Session ID',
      'Location', 'Changes', 'Metadata', 'Timestamp'
    ];

    const rows = logs.map(log => [
      log.id,
      log.userId || '',
      log.eventType,
      log.eventCategory,
      log.riskLevel,
      `"${log.description.replace(/"/g, '""')}"`, // Escape quotes
      log.entityType || '',
      log.entityId || '',
      log.ipAddress || '',
      log.userAgent ? `"${log.userAgent.replace(/"/g, '""')}"` : '',
      log.sessionId || '',
      log.location ? `"${JSON.stringify(log.location).replace(/"/g, '""')}"` : '',
      log.changes ? `"${JSON.stringify(log.changes).replace(/"/g, '""')}"` : '',
      log.metadata ? `"${JSON.stringify(log.metadata).replace(/"/g, '""')}"` : '',
      log.timestamp
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Clean up old audit logs (data retention)
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const query = `
      DELETE FROM audit_logs
      WHERE timestamp < $1
    `;

    const result = await this.db.query(query, [cutoffDate.toISOString()]);
    return result.rowCount || 0;
  }
}

// Helper functions for common audit logging scenarios

/**
 * Log NDA-related audit events
 */
export async function logNDAEvent(
  auditService: AuditTrailService,
  eventType: AuditEventType,
  description: string,
  context: {
    userId?: number;
    ndaId?: number;
    pitchId?: number;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    changes?: Array<{ field: string; oldValue?: any; newValue?: any }>;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  await auditService.logEvent({
    userId: context.userId,
    eventType,
    eventCategory: 'nda',
    riskLevel: 'medium',
    description,
    entityType: 'nda',
    entityId: context.ndaId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    sessionId: context.sessionId,
    changes: context.changes,
    metadata: {
      pitchId: context.pitchId,
      ...context.metadata
    }
  });
}

/**
 * Log security events
 */
export async function logSecurityEvent(
  auditService: AuditTrailService,
  eventType: AuditEventType,
  description: string,
  riskLevel: RiskLevel,
  context: {
    userId?: number;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    location?: { country?: string; city?: string; region?: string };
    metadata?: Record<string, any>;
  }
): Promise<void> {
  await auditService.logEvent({
    userId: context.userId,
    eventType,
    eventCategory: 'security',
    riskLevel,
    description,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    sessionId: context.sessionId,
    location: context.location,
    metadata: context.metadata
  });
}

/**
 * Create audit service instance
 */
export function createAuditTrailService(env: any): AuditTrailService {
  const db = createDatabase(env);
  return new AuditTrailService(db, env.AUDIT_CACHE);
}