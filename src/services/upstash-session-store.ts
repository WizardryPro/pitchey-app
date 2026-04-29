/**
 * Upstash Redis Session Store for Cross-Origin Authentication
 *
 * Handles session storage for cross-domain auth between:
 * - Frontend: https://pitchey-5o8.pages.dev
 * - API: https://pitchey-api-prod.ndlovucavelle.workers.dev
 *
 * Uses cookie-based sessions with Upstash Redis as the backing store.
 */

import { Redis } from '@upstash/redis/cloudflare';

// Session configuration
export const SESSION_CONFIG = {
  // Cookie settings for cross-origin auth
  COOKIE_NAME: 'pitchey-session',  // Unified cookie name across all handlers
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60, // 7 days in seconds
  COOKIE_SAME_SITE: 'None' as const,
  COOKIE_SECURE: true,
  COOKIE_HTTP_ONLY: true,
  COOKIE_PATH: '/',
  // Note: No domain attribute needed for cross-origin - cookies are set by API domain
  // and sent back by browser with credentials: 'include'

  // Session timeouts
  SESSION_TTL: 7 * 24 * 60 * 60, // 7 days in seconds (Redis TTL)
  IDLE_TIMEOUT: 30 * 60, // 30 minutes in seconds
  ABSOLUTE_TIMEOUT: 12 * 60 * 60, // 12 hours in seconds

  // Redis key prefixes
  KEY_PREFIX: 'session:',
  USER_SESSIONS_PREFIX: 'user:sessions:',

  // Limits
  MAX_SESSIONS_PER_USER: 5,
} as const;

export interface SessionData {
  id: string;
  userId: string;
  userEmail: string;
  userType: 'creator' | 'investor' | 'production';
  userName?: string;
  companyName?: string;
  profileImage?: string;
  subscriptionTier?: string;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
  ipAddress?: string;
  userAgent?: string;
  portal?: string; // Which portal the session was created from
}

export interface SessionValidationResult {
  valid: boolean;
  session?: SessionData;
  user?: {
    id: string;
    email: string;
    username?: string;
    userType: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    profileImage?: string;
    subscriptionTier?: string;
  };
  reason?: string;
}

export class UpstashSessionStore {
  private redis: Redis;

  constructor(config: { url: string; token: string }) {
    this.redis = new Redis({
      url: config.url,
      token: config.token,
    });
  }

  /**
   * Create a new session
   */
  async createSession(data: Omit<SessionData, 'id' | 'createdAt' | 'lastActivity' | 'expiresAt'>): Promise<SessionData> {
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const session: SessionData = {
      ...data,
      id: sessionId,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + (SESSION_CONFIG.SESSION_TTL * 1000),
    };

    // Store session in Redis
    await this.redis.set(
      `${SESSION_CONFIG.KEY_PREFIX}${sessionId}`,
      JSON.stringify(session),
      { ex: SESSION_CONFIG.SESSION_TTL }
    );

    // Track user's sessions for concurrent session management
    await this.trackUserSession(data.userId, sessionId);

    // Enforce max sessions per user
    await this.enforceMaxSessions(data.userId);

    console.log(`[Session] Created session ${sessionId} for user ${data.userId} (${data.userType})`);

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = `${SESSION_CONFIG.KEY_PREFIX}${sessionId}`;
    const data = await this.redis.get<string>(key);

    if (!data) {
      return null;
    }

    try {
      const session: SessionData = typeof data === 'string' ? JSON.parse(data) : data;

      // Check if session has expired
      if (session.expiresAt < Date.now()) {
        await this.deleteSession(sessionId);
        return null;
      }

      // Check idle timeout
      const idleTime = Date.now() - session.lastActivity;
      if (idleTime > SESSION_CONFIG.IDLE_TIMEOUT * 1000) {
        console.log(`[Session] Session ${sessionId} expired due to inactivity`);
        await this.deleteSession(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      console.error(`[Session] Error parsing session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Validate session and return user data
   */
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return { valid: false, reason: 'Session not found or expired' };
    }

    // Update last activity
    await this.updateLastActivity(sessionId);

    return {
      valid: true,
      session,
      user: {
        id: session.userId,
        email: session.userEmail,
        username: session.userName,
        userType: session.userType,
        companyName: session.companyName,
        profileImage: session.profileImage,
        subscriptionTier: session.subscriptionTier,
      },
    };
  }

  /**
   * Update session's last activity timestamp
   */
  async updateLastActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.lastActivity = Date.now();

    await this.redis.set(
      `${SESSION_CONFIG.KEY_PREFIX}${sessionId}`,
      JSON.stringify(session),
      { ex: SESSION_CONFIG.SESSION_TTL }
    );
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    // Get session to find userId
    const session = await this.getSession(sessionId);

    // Delete from Redis
    await this.redis.del(`${SESSION_CONFIG.KEY_PREFIX}${sessionId}`);

    // Remove from user's session list
    if (session) {
      await this.untrackUserSession(session.userId, sessionId);
    }

    console.log(`[Session] Deleted session ${sessionId}`);
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.getUserSessions(userId);

    for (const sessionId of sessionIds) {
      await this.redis.del(`${SESSION_CONFIG.KEY_PREFIX}${sessionId}`);
    }

    await this.redis.del(`${SESSION_CONFIG.USER_SESSIONS_PREFIX}${userId}`);

    console.log(`[Session] Deleted all ${sessionIds.length} sessions for user ${userId}`);
  }

  /**
   * Get all session IDs for a user
   */
  async getUserSessions(userId: string): Promise<string[]> {
    const key = `${SESSION_CONFIG.USER_SESSIONS_PREFIX}${userId}`;
    const sessions = await this.redis.smembers(key);
    return sessions as string[];
  }

  /**
   * Track a session for a user
   */
  private async trackUserSession(userId: string, sessionId: string): Promise<void> {
    const key = `${SESSION_CONFIG.USER_SESSIONS_PREFIX}${userId}`;
    await this.redis.sadd(key, sessionId);
    await this.redis.expire(key, SESSION_CONFIG.SESSION_TTL);
  }

  /**
   * Remove session from user's tracking
   */
  private async untrackUserSession(userId: string, sessionId: string): Promise<void> {
    const key = `${SESSION_CONFIG.USER_SESSIONS_PREFIX}${userId}`;
    await this.redis.srem(key, sessionId);
  }

  /**
   * Enforce maximum sessions per user
   */
  private async enforceMaxSessions(userId: string): Promise<void> {
    const sessionIds = await this.getUserSessions(userId);

    if (sessionIds.length <= SESSION_CONFIG.MAX_SESSIONS_PER_USER) {
      return;
    }

    // Get all sessions with their creation times
    const sessionsWithTime: Array<{ id: string; createdAt: number }> = [];

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessionsWithTime.push({ id: session.id, createdAt: session.createdAt });
      } else {
        // Clean up invalid session reference
        await this.untrackUserSession(userId, sessionId);
      }
    }

    // Sort by creation time (oldest first)
    sessionsWithTime.sort((a, b) => a.createdAt - b.createdAt);

    // Delete oldest sessions to get under the limit
    const sessionsToDelete = sessionsWithTime.slice(0, sessionsWithTime.length - SESSION_CONFIG.MAX_SESSIONS_PER_USER);

    for (const { id } of sessionsToDelete) {
      console.log(`[Session] Evicting old session ${id} for user ${userId} (max sessions exceeded)`);
      await this.deleteSession(id);
    }
  }

  /**
   * Parse session ID from cookie header
   */
  static parseSessionCookie(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').map(c => c.trim());

    // Check for the unified cookie name
    let sessionCookie = cookies.find(c => c.startsWith(`${SESSION_CONFIG.COOKIE_NAME}=`));

    // Fallback: also check legacy cookie names for backwards compatibility
    if (!sessionCookie) {
      sessionCookie = cookies.find(c => c.startsWith('better-auth-session='));
    }

    if (!sessionCookie) return null;

    const value = sessionCookie.split('=')[1];
    return value || null;
  }

  /**
   * Create Set-Cookie header value
   */
  static createSessionCookie(sessionId: string): string {
    const parts = [
      `${SESSION_CONFIG.COOKIE_NAME}=${sessionId}`,
      `Path=${SESSION_CONFIG.COOKIE_PATH}`,
      `Max-Age=${SESSION_CONFIG.COOKIE_MAX_AGE}`,
      `SameSite=${SESSION_CONFIG.COOKIE_SAME_SITE}`,
    ];

    if (SESSION_CONFIG.COOKIE_SECURE) {
      parts.push('Secure');
    }

    if (SESSION_CONFIG.COOKIE_HTTP_ONLY) {
      parts.push('HttpOnly');
    }

    return parts.join('; ');
  }

  /**
   * Create Set-Cookie header to clear session
   */
  static createClearSessionCookie(): string {
    return [
      `${SESSION_CONFIG.COOKIE_NAME}=`,
      `Path=${SESSION_CONFIG.COOKIE_PATH}`,
      'Max-Age=0',
      `SameSite=${SESSION_CONFIG.COOKIE_SAME_SITE}`,
      'Secure',
      'HttpOnly',
    ].join('; ');
  }
}

/**
 * Factory function to create session store from environment
 */
export function createUpstashSessionStore(env: {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}): UpstashSessionStore | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('[Session] Upstash Redis not configured - session store unavailable');
    return null;
  }

  return new UpstashSessionStore({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}
