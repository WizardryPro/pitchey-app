/**
 * Settings Management API handlers
 */

import type { Env } from '../db/connection';
import { createDatabase } from '../db/raw-sql-connection';
import { verifyAuth } from '../utils/auth';
import {
  getUserSettings,
  upsertUserSettings,
  getUserSessions,
  getAccountActions,
  logAccountAction,
  enableTwoFactor,
  disableTwoFactor,
  deleteUserAccount,
  logUserSession
} from '../db/queries/settings';

/**
 * GET /api/user/settings - Get user settings
 */
export async function getUserSettingsHandler(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = createDatabase(env.DATABASE_URL);
    const settings = await getUserSettings(db as any, authResult.user.id.toString());

    // If no settings exist yet, create default settings
    if (!settings) {
      const defaultSettings = await upsertUserSettings(db as any, authResult.user.id.toString(), {});
      
      // Format response
      const response = {
        notifications: {
          emailNotifications: defaultSettings.emailNotifications,
          pushNotifications: defaultSettings.pushNotifications,
          pitchViews: defaultSettings.pitchViews,
          newMessages: defaultSettings.newMessages,
          projectUpdates: defaultSettings.projectUpdates,
          weeklyDigest: defaultSettings.weeklyDigest,
          marketingEmails: defaultSettings.marketingEmails
        },
        privacy: {
          profileVisibility: defaultSettings.profileVisibility,
          showEmail: defaultSettings.showEmail,
          showPhone: defaultSettings.showPhone,
          allowDirectMessages: defaultSettings.allowDirectMessages,
          allowPitchRequests: defaultSettings.allowPitchRequests
        },
        security: {
          twoFactorEnabled: defaultSettings.twoFactorEnabled,
          sessionTimeout: defaultSettings.sessionTimeout,
          loginNotifications: defaultSettings.loginNotifications
        }
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Format existing settings
    const response = {
      notifications: {
        emailNotifications: settings.emailNotifications,
        pushNotifications: settings.pushNotifications,
        pitchViews: settings.pitchViews,
        newMessages: settings.newMessages,
        projectUpdates: settings.projectUpdates,
        weeklyDigest: settings.weeklyDigest,
        marketingEmails: settings.marketingEmails
      },
      privacy: {
        profileVisibility: settings.profileVisibility,
        showEmail: settings.showEmail,
        showPhone: settings.showPhone,
        allowDirectMessages: settings.allowDirectMessages,
        allowPitchRequests: settings.allowPitchRequests
      },
      security: {
        twoFactorEnabled: settings.twoFactorEnabled,
        sessionTimeout: settings.sessionTimeout,
        loginNotifications: settings.loginNotifications
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PUT /api/user/settings - Update user settings
 */
export async function updateUserSettingsHandler(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json() as Record<string, unknown>;
    const notifications = body.notifications as Record<string, unknown> | undefined;
    const privacy = body.privacy as Record<string, unknown> | undefined;
    const security = body.security as Record<string, unknown> | undefined;

    // Prepare settings object
    const settingsUpdate: any = {};

    if (notifications) {
      Object.assign(settingsUpdate, {
        emailNotifications: notifications.emailNotifications,
        pushNotifications: notifications.pushNotifications,
        pitchViews: notifications.pitchViews,
        newMessages: notifications.newMessages,
        projectUpdates: notifications.projectUpdates,
        weeklyDigest: notifications.weeklyDigest,
        marketingEmails: notifications.marketingEmails
      });
    }

    if (privacy) {
      Object.assign(settingsUpdate, {
        profileVisibility: privacy.profileVisibility,
        showEmail: privacy.showEmail,
        showPhone: privacy.showPhone,
        allowDirectMessages: privacy.allowDirectMessages,
        allowPitchRequests: privacy.allowPitchRequests
      });
    }

    if (security) {
      Object.assign(settingsUpdate, {
        twoFactorEnabled: security.twoFactorEnabled,
        sessionTimeout: security.sessionTimeout,
        loginNotifications: security.loginNotifications
      });
    }

    const db = createDatabase(env.DATABASE_URL);
    const updatedSettings = await upsertUserSettings(db as any, authResult.user.id.toString(), settingsUpdate);

    // Log the action
    await logAccountAction(db as any, {
      userId: authResult.user.id.toString(),
      actionType: 'settings_updated',
      metadata: { updated_fields: Object.keys(settingsUpdate) },
      ipAddress: request.headers.get('CF-Connecting-IP') || undefined
    });

    // Format response
    const response = {
      notifications: {
        emailNotifications: updatedSettings.emailNotifications,
        pushNotifications: updatedSettings.pushNotifications,
        pitchViews: updatedSettings.pitchViews,
        newMessages: updatedSettings.newMessages,
        projectUpdates: updatedSettings.projectUpdates,
        weeklyDigest: updatedSettings.weeklyDigest,
        marketingEmails: updatedSettings.marketingEmails
      },
      privacy: {
        profileVisibility: updatedSettings.profileVisibility,
        showEmail: updatedSettings.showEmail,
        showPhone: updatedSettings.showPhone,
        allowDirectMessages: updatedSettings.allowDirectMessages,
        allowPitchRequests: updatedSettings.allowPitchRequests
      },
      security: {
        twoFactorEnabled: updatedSettings.twoFactorEnabled,
        sessionTimeout: updatedSettings.sessionTimeout,
        loginNotifications: updatedSettings.loginNotifications
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    return new Response(JSON.stringify({ error: 'Failed to update settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/user/sessions - Get user sessions
 */
export async function getUserSessionsHandler(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = createDatabase(env.DATABASE_URL);
    const sessions = await getUserSessions(db as any, authResult.user.id.toString());

    return new Response(JSON.stringify({ sessions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch sessions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/user/activity - Get account activity log
 */
export async function getAccountActivityHandler(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = createDatabase(env.DATABASE_URL);
    const activities = await getAccountActions(db as any, authResult.user.id.toString());

    return new Response(JSON.stringify({ activities }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching account activity:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch activity' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/user/two-factor/enable - Enable two-factor authentication
 */
export async function enableTwoFactorHandler(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json() as Record<string, unknown>;
    const { secret } = body;

    if (!secret) {
      return new Response(JSON.stringify({ error: 'Secret is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = createDatabase(env.DATABASE_URL);
    const success = await enableTwoFactor(db as any, authResult.user.id.toString(), secret as string);

    if (success) {
      // Log the action
      await logAccountAction(db as any, {
        userId: authResult.user.id.toString(),
        actionType: 'two_factor_enabled',
        metadata: {},
        ipAddress: request.headers.get('CF-Connecting-IP') || undefined
      });

      return new Response(JSON.stringify({ message: 'Two-factor authentication enabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Failed to enable two-factor authentication' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error enabling two-factor:', error);
    return new Response(JSON.stringify({ error: 'Failed to enable two-factor authentication' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/user/two-factor/disable - Disable two-factor authentication
 */
export async function disableTwoFactorHandler(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = createDatabase(env.DATABASE_URL);
    const success = await disableTwoFactor(db as any, authResult.user.id.toString());

    if (success) {
      // Log the action
      await logAccountAction(db as any, {
        userId: authResult.user.id.toString(),
        actionType: 'two_factor_disabled',
        metadata: {},
        ipAddress: request.headers.get('CF-Connecting-IP') || undefined
      });

      return new Response(JSON.stringify({ message: 'Two-factor authentication disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Failed to disable two-factor authentication' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error disabling two-factor:', error);
    return new Response(JSON.stringify({ error: 'Failed to disable two-factor authentication' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /api/user/account - Delete user account
 */
export async function deleteAccountHandler(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json() as Record<string, unknown>;
    const { confirmation } = body;

    // Require explicit confirmation
    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return new Response(JSON.stringify({ error: 'Invalid confirmation' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = createDatabase(env.DATABASE_URL);

    // Log the action before deletion
    await logAccountAction(db as any, {
      userId: authResult.user.id.toString(),
      actionType: 'account_deletion_requested',
      metadata: {},
      ipAddress: request.headers.get('CF-Connecting-IP') || undefined
    });

    const success = await deleteUserAccount(db as any, authResult.user.id.toString());
    
    if (success) {
      return new Response(JSON.stringify({ message: 'Account deleted successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/user/session/log - Log user session (called on login)
 */
export async function logSessionHandler(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = createDatabase(env.DATABASE_URL);

    // Extract session info
    const session = await logUserSession(db as any, {
      userId: authResult.user.id.toString(),
      ipAddress: request.headers.get('CF-Connecting-IP') || undefined,
      userAgent: request.headers.get('User-Agent') || undefined,
      deviceType: detectDeviceType(request.headers.get('User-Agent') || ''),
      location: request.headers.get('CF-IPCountry') || undefined
    });

    return new Response(JSON.stringify({ session }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error logging session:', error);
    return new Response(JSON.stringify({ error: 'Failed to log session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Helper function to detect device type from user agent
function detectDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod/.test(ua)) return 'mobile';
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mac|windows|linux/.test(ua)) return 'desktop';
  return 'unknown';
}