/**
 * Database queries for user settings management
 */

import type { Sql } from 'postgres';

export interface UserSettings {
  id: number;
  userId: number;
  // Notification settings
  emailNotifications: boolean;
  pushNotifications: boolean;
  pitchViews: boolean;
  newMessages: boolean;
  projectUpdates: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
  // Privacy settings
  profileVisibility: 'public' | 'private' | 'network';
  showEmail: boolean;
  showPhone: boolean;
  allowDirectMessages: boolean;
  allowPitchRequests: boolean;
  // Security settings
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  sessionTimeout: number;
  loginNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  id: number;
  userId: number;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  location?: string;
  createdAt: Date;
  lastActivity: Date;
  expiredAt?: Date;
}

export interface AccountAction {
  id: number;
  userId: number;
  actionType: string;
  metadata?: any;
  ipAddress?: string;
  createdAt: Date;
}

/**
 * Get user settings
 */
export async function getUserSettings(sql: Sql, userId: string): Promise<UserSettings | null> {
  try {
    const result = await sql`
      SELECT 
        id,
        user_id as "userId",
        email_notifications as "emailNotifications",
        push_notifications as "pushNotifications",
        pitch_views as "pitchViews",
        new_messages as "newMessages",
        project_updates as "projectUpdates",
        weekly_digest as "weeklyDigest",
        marketing_emails as "marketingEmails",
        profile_visibility as "profileVisibility",
        show_email as "showEmail",
        show_phone as "showPhone",
        allow_direct_messages as "allowDirectMessages",
        allow_pitch_requests as "allowPitchRequests",
        two_factor_enabled as "twoFactorEnabled",
        two_factor_secret as "twoFactorSecret",
        session_timeout as "sessionTimeout",
        login_notifications as "loginNotifications",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM user_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    
    return (result[0] as UserSettings) || null;
  } catch (error) {
    console.error('Error fetching user settings:', error);
    throw error;
  }
}

/**
 * Create or update user settings
 */
export async function upsertUserSettings(sql: Sql, userId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
  try {
    const result = await sql`
      INSERT INTO user_settings (
        user_id,
        email_notifications,
        push_notifications,
        pitch_views,
        new_messages,
        project_updates,
        weekly_digest,
        marketing_emails,
        profile_visibility,
        show_email,
        show_phone,
        allow_direct_messages,
        allow_pitch_requests,
        two_factor_enabled,
        two_factor_secret,
        session_timeout,
        login_notifications
      ) VALUES (
        ${userId},
        ${settings.emailNotifications ?? true},
        ${settings.pushNotifications ?? true},
        ${settings.pitchViews ?? true},
        ${settings.newMessages ?? true},
        ${settings.projectUpdates ?? true},
        ${settings.weeklyDigest ?? false},
        ${settings.marketingEmails ?? false},
        ${settings.profileVisibility ?? 'public'},
        ${settings.showEmail ?? false},
        ${settings.showPhone ?? false},
        ${settings.allowDirectMessages ?? true},
        ${settings.allowPitchRequests ?? true},
        ${settings.twoFactorEnabled ?? false},
        ${settings.twoFactorSecret ?? null},
        ${settings.sessionTimeout ?? 30},
        ${settings.loginNotifications ?? true}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        email_notifications = EXCLUDED.email_notifications,
        push_notifications = EXCLUDED.push_notifications,
        pitch_views = EXCLUDED.pitch_views,
        new_messages = EXCLUDED.new_messages,
        project_updates = EXCLUDED.project_updates,
        weekly_digest = EXCLUDED.weekly_digest,
        marketing_emails = EXCLUDED.marketing_emails,
        profile_visibility = EXCLUDED.profile_visibility,
        show_email = EXCLUDED.show_email,
        show_phone = EXCLUDED.show_phone,
        allow_direct_messages = EXCLUDED.allow_direct_messages,
        allow_pitch_requests = EXCLUDED.allow_pitch_requests,
        two_factor_enabled = EXCLUDED.two_factor_enabled,
        two_factor_secret = EXCLUDED.two_factor_secret,
        session_timeout = EXCLUDED.session_timeout,
        login_notifications = EXCLUDED.login_notifications,
        updated_at = NOW()
      RETURNING 
        id,
        user_id as "userId",
        email_notifications as "emailNotifications",
        push_notifications as "pushNotifications",
        pitch_views as "pitchViews",
        new_messages as "newMessages",
        project_updates as "projectUpdates",
        weekly_digest as "weeklyDigest",
        marketing_emails as "marketingEmails",
        profile_visibility as "profileVisibility",
        show_email as "showEmail",
        show_phone as "showPhone",
        allow_direct_messages as "allowDirectMessages",
        allow_pitch_requests as "allowPitchRequests",
        two_factor_enabled as "twoFactorEnabled",
        two_factor_secret as "twoFactorSecret",
        session_timeout as "sessionTimeout",
        login_notifications as "loginNotifications",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
    
    return result[0] as UserSettings;
  } catch (error) {
    console.error('Error upserting user settings:', error);
    throw error;
  }
}

/**
 * Log auth session
 */
export async function logUserSession(sql: Sql, session: {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  location?: string;
}): Promise<AuthSession> {
  try {
    const result = await sql`
      INSERT INTO auth_sessions (
        user_id,
        ip_address,
        user_agent,
        device_type,
        location
      ) VALUES (
        ${session.userId},
        ${session.ipAddress || null},
        ${session.userAgent || null},
        ${session.deviceType || null},
        ${session.location || null}
      )
      RETURNING 
        id,
        user_id as "userId",
        ip_address as "ipAddress",
        user_agent as "userAgent",
        device_type as "deviceType",
        location,
        created_at as "createdAt",
        last_activity as "lastActivity",
        expired_at as "expiredAt"
    `;
    
    return result[0] as AuthSession;
  } catch (error) {
    console.error('Error logging auth session:', error);
    throw error;
  }
}

/**
 * Get auth sessions
 */
export async function getUserSessions(sql: Sql, userId: string, limit: number = 10): Promise<AuthSession[]> {
  try {
    const result = await sql`
      SELECT 
        id,
        user_id as "userId",
        ip_address as "ipAddress",
        user_agent as "userAgent",
        device_type as "deviceType",
        location,
        created_at as "createdAt",
        last_activity as "lastActivity",
        expired_at as "expiredAt"
      FROM auth_sessions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    
    return result as unknown as AuthSession[];
  } catch (error) {
    console.error('Error fetching auth sessions:', error);
    throw error;
  }
}

/**
 * Log account action
 */
export async function logAccountAction(sql: Sql, action: {
  userId: string;
  actionType: string;
  metadata?: any;
  ipAddress?: string;
}): Promise<AccountAction> {
  try {
    const result = await sql`
      INSERT INTO account_actions (
        user_id,
        action_type,
        metadata,
        ip_address
      ) VALUES (
        ${action.userId},
        ${action.actionType},
        ${action.metadata ? JSON.stringify(action.metadata) : '{}'},
        ${action.ipAddress || null}
      )
      RETURNING 
        id,
        user_id as "userId",
        action_type as "actionType",
        metadata,
        ip_address as "ipAddress",
        created_at as "createdAt"
    `;
    
    return result[0] as AccountAction;
  } catch (error) {
    console.error('Error logging account action:', error);
    throw error;
  }
}

/**
 * Get account actions
 */
export async function getAccountActions(sql: Sql, userId: string, limit: number = 20): Promise<AccountAction[]> {
  try {
    const result = await sql`
      SELECT 
        id,
        user_id as "userId",
        action_type as "actionType",
        metadata,
        ip_address as "ipAddress",
        created_at as "createdAt"
      FROM account_actions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    
    return result as unknown as AccountAction[];
  } catch (error) {
    console.error('Error fetching account actions:', error);
    throw error;
  }
}

/**
 * Enable two-factor authentication
 */
export async function enableTwoFactor(sql: Sql, userId: string, secret: string): Promise<boolean> {
  try {
    const result = await sql`
      UPDATE user_settings
      SET 
        two_factor_enabled = true,
        two_factor_secret = ${secret},
        updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING id
    `;
    
    return result.length > 0;
  } catch (error) {
    console.error('Error enabling two-factor:', error);
    throw error;
  }
}

/**
 * Disable two-factor authentication
 */
export async function disableTwoFactor(sql: Sql, userId: string): Promise<boolean> {
  try {
    const result = await sql`
      UPDATE user_settings
      SET 
        two_factor_enabled = false,
        two_factor_secret = NULL,
        updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING id
    `;
    
    return result.length > 0;
  } catch (error) {
    console.error('Error disabling two-factor:', error);
    throw error;
  }
}

/**
 * Delete a user account via anonymization (soft-delete).
 *
 * NOT a hard DELETE:
 *  - GDPR right-to-erasure is satisfied by scrubbing PII.
 *  - Financial/legal records (transactions, deals, signed NDAs, generated
 *    documents) must be retained — and the FK graph blocks a hard delete
 *    anyway: pitches/ndas/user_roles/etc. reference users with NO ACTION /
 *    RESTRICT, so `DELETE FROM users` throws a FK violation for any real user.
 *  - email/username are UNIQUE, so we scrub them to per-id sentinels (this also
 *    frees the original email for re-registration).
 * Returns false if the user was already deleted (idempotent).
 */
export async function deleteUserAccount(sql: Sql, userId: string): Promise<boolean> {
  try {
    const result = await sql`
      UPDATE users SET
        deleted_at        = NOW(),
        is_active         = false,
        email             = 'deleted_' || id || '@deleted.invalid',
        username          = 'deleted_' || id,
        password          = 'DELETED_ACCOUNT',
        password_hash     = NULL,
        first_name        = NULL,
        last_name         = NULL,
        -- `name` is a generated column (COALESCE(username, email)); it
        -- auto-recomputes to the scrubbed username, so we must NOT set it here.
        bio               = NULL,
        phone             = NULL,
        location          = NULL,
        company_name      = NULL,
        company_website   = NULL,
        company_address   = NULL,
        profile_image     = NULL,
        profile_image_url = NULL,
        avatar_url        = NULL,
        image             = NULL,
        two_factor_secret = NULL,
        backup_codes      = NULL,
        stripe_customer_id = NULL,
        preferences       = NULL,
        metadata          = NULL,
        updated_at        = NOW()
      WHERE id = ${userId} AND deleted_at IS NULL
      RETURNING id
    `;

    if (result.length === 0) return false;

    // Invalidate every session so the cookie is dead and they're logged out.
    await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
    return true;
  } catch (error) {
    console.error('Error anonymizing user account:', error);
    throw error;
  }
}