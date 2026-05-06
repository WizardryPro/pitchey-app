/**
 * Mobile Authentication and Device Management
 * Specialized handlers for mobile app authentication flows
 */

import { WorkerDatabase } from '../services/worker-database';
import { ApiResponseBuilder, ErrorCode } from '../utils/api-response';
import { getCorsHeaders } from '../utils/response';
import { createJWT, verifyJWT } from '../utils/worker-jwt';
import { PasswordService } from '../services/security-fix';

interface DeviceInfo {
  id: string;
  name: string;
  platform: 'ios' | 'android' | 'web';
  version?: string;
  model?: string;
  pushToken?: string;
}

interface MobileAuthContext {
  request: Request;
  env: any;
  db: WorkerDatabase;
}

interface MobileLoginRequest {
  email: string;
  password: string;
  deviceInfo: DeviceInfo;
  rememberDevice?: boolean;
}

interface MobileTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: number;
    email: string;
    display_name: string;
    user_type: string;
    profile_image_url?: string;
  };
  deviceId: string;
}

// Device fingerprinting for mobile security
function generateDeviceFingerprint(request: Request, deviceInfo: DeviceInfo): string {
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const timeZone = request.headers.get('x-timezone') || 'UTC';
  
  const fingerprintData = [
    deviceInfo.platform,
    deviceInfo.model || '',
    deviceInfo.version || '',
    userAgent.substring(0, 100), // Limit length
    acceptLanguage,
    timeZone
  ].join('|');
  
  // Simple hash function (in production, use crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < fingerprintData.length; i++) {
    const char = fingerprintData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

// Mobile login handler with device registration
export async function mobileLogin(context: MobileAuthContext): Promise<Response> {
  try {
    const body: MobileLoginRequest = await context.request.json();
    
    if (!body.email || !body.password || !body.deviceInfo) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.VALIDATION_ERROR, 'Email, password, and device info required')),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Validate device info
    if (!body.deviceInfo.id || !body.deviceInfo.platform || !body.deviceInfo.name) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.VALIDATION_ERROR, 'Device ID, platform, and name required')),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Find user by email
    const userResult = await context.db.executeQuery(
      'SELECT id, email, password_hash, display_name, user_type, profile_image_url, is_active, failed_login_attempts, locked_until FROM users WHERE email = $1',
      [body.email.toLowerCase()]
    );

    if (!userResult.rows.length) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.INVALID_CREDENTIALS, 'Invalid credentials')),
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const user = userResult.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.ACCOUNT_LOCKED, 'Account temporarily locked')),
        { status: 429, headers: getCorsHeaders() }
      );
    }

    // Verify password
    const passwordService = new PasswordService();
    const isValidPassword = await passwordService.verifyPassword(body.password, user.password_hash);

    if (!isValidPassword) {
      // Increment failed attempts
      await context.db.executeQuery(
        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1, locked_until = CASE WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL \'15 minutes\' ELSE NULL END WHERE id = $1',
        [user.id]
      );

      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.INVALID_CREDENTIALS, 'Invalid credentials')),
        { status: 401, headers: getCorsHeaders() }
      );
    }

    // Check if account is active
    if (!user.is_active) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.ACCOUNT_INACTIVE, 'Account is inactive')),
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Generate device fingerprint
    const deviceFingerprint = generateDeviceFingerprint(context.request, body.deviceInfo);

    // Register or update device
    const deviceId = await registerMobileDevice(
      context.db,
      user.id,
      body.deviceInfo,
      deviceFingerprint,
      context.request
    );

    // Generate tokens
    const accessToken = await createJWT(
      {
        userId: user.id,
        userType: user.user_type,
        deviceId,
        fingerprint: deviceFingerprint
      },
      context.env.JWT_SECRET,
      '24h' // 24 hours for mobile
    );

    const refreshToken = await createJWT(
      {
        userId: user.id,
        deviceId,
        type: 'refresh'
      },
      context.env.JWT_SECRET,
      '30d' // 30 days for refresh
    );

    // Store refresh token
    await context.db.executeQuery(
      'INSERT INTO refresh_tokens (token_hash, user_id, device_id, expires_at) VALUES ($1, $2, $3, $4)',
      [
        await hashToken(refreshToken),
        user.id,
        deviceId,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      ]
    );

    // Reset failed login attempts
    await context.db.executeQuery(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Log security event
    await logMobileSecurityEvent(context.db, user.id, 'mobile_login_success', {
      deviceId,
      platform: body.deviceInfo.platform,
      deviceName: body.deviceInfo.name,
      ip: context.request.headers.get('cf-connecting-ip') || 'unknown'
    });

    const response: MobileTokenResponse = {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        user_type: user.user_type,
        profile_image_url: user.profile_image_url
      },
      deviceId
    };

    return new Response(
      JSON.stringify(ApiResponseBuilder.success(response)),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders()
        }
      }
    );

  } catch (error) {
    console.error('Mobile login error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Login failed')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// Refresh token handler for mobile
export async function mobileRefreshToken(context: MobileAuthContext): Promise<Response> {
  try {
    const body = await context.request.json();
    
    if (!body.refreshToken) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.VALIDATION_ERROR, 'Refresh token required')),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Verify refresh token
    const payload = await verifyJWT(body.refreshToken, context.env.JWT_SECRET);
    
    if (payload.type !== 'refresh') {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.INVALID_TOKEN, 'Invalid refresh token')),
        { status: 401, headers: getCorsHeaders() }
      );
    }

    // Check if refresh token exists and is valid
    const tokenResult = await context.db.executeQuery(
      'SELECT rt.*, u.user_type, u.display_name, u.email FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token_hash = $1 AND rt.expires_at > NOW() AND rt.revoked_at IS NULL',
      [await hashToken(body.refreshToken)]
    );

    if (!tokenResult.rows.length) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.INVALID_TOKEN, 'Invalid or expired refresh token')),
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const tokenData = tokenResult.rows[0];

    // Get device info for fingerprint validation
    const deviceResult = await context.db.executeQuery(
      'SELECT * FROM mobile_devices WHERE id = $1 AND user_id = $2 AND is_active = true',
      [tokenData.device_id, tokenData.user_id]
    );

    if (!deviceResult.rows.length) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.DEVICE_NOT_FOUND, 'Device not found or inactive')),
        { status: 404, headers: getCorsHeaders() }
      );
    }

    // Generate new access token
    const accessToken = await createJWT(
      {
        userId: tokenData.user_id,
        userType: tokenData.user_type,
        deviceId: tokenData.device_id
      },
      context.env.JWT_SECRET,
      '24h'
    );

    // Update device last activity
    await context.db.executeQuery(
      'UPDATE mobile_devices SET last_activity = NOW() WHERE id = $1',
      [tokenData.device_id]
    );

    const response = {
      accessToken,
      expiresIn: 24 * 60 * 60,
      user: {
        id: tokenData.user_id,
        email: tokenData.email,
        display_name: tokenData.display_name,
        user_type: tokenData.user_type
      }
    };

    return new Response(
      JSON.stringify(ApiResponseBuilder.success(response)),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders()
        }
      }
    );

  } catch (error) {
    console.error('Mobile refresh token error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Token refresh failed')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// Logout from mobile device
export async function mobileLogout(context: MobileAuthContext, userId: number, deviceId: string): Promise<Response> {
  try {
    // Revoke all refresh tokens for this device
    await context.db.executeQuery(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId]
    );

    // Mark device as inactive if requested
    // fire-and-forget
    const body = await context.request.json().catch(() => ({}));
    if (body.deactivateDevice) {
      await context.db.executeQuery(
        'UPDATE mobile_devices SET is_active = false, deactivated_at = NOW() WHERE id = $1 AND user_id = $2',
        [deviceId, userId]
      );
    }

    // Log security event
    await logMobileSecurityEvent(context.db, userId, 'mobile_logout', {
      deviceId,
      deactivatedDevice: body.deactivateDevice || false
    });

    return new Response(
      JSON.stringify(ApiResponseBuilder.success({ message: 'Logout successful' })),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders()
        }
      }
    );

  } catch (error) {
    console.error('Mobile logout error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Logout failed')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// Get user's registered devices
export async function getMobileDevices(context: MobileAuthContext, userId: number): Promise<Response> {
  try {
    const devicesResult = await context.db.executeQuery(
      `SELECT 
        id, device_name, platform, device_model, app_version,
        registered_at, last_activity, is_active, push_token IS NOT NULL as has_push_notifications
      FROM mobile_devices 
      WHERE user_id = $1 
      ORDER BY last_activity DESC`,
      [userId]
    );

    return new Response(
      JSON.stringify(ApiResponseBuilder.success({ devices: devicesResult.rows })),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders()
        }
      }
    );

  } catch (error) {
    console.error('Get mobile devices error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch devices')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// Revoke device access
export async function revokeMobileDevice(context: MobileAuthContext, userId: number, deviceId: string): Promise<Response> {
  try {
    // Deactivate device
    await context.db.executeQuery(
      'UPDATE mobile_devices SET is_active = false, deactivated_at = NOW() WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    // Revoke all refresh tokens for this device
    await context.db.executeQuery(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId]
    );

    // Log security event
    await logMobileSecurityEvent(context.db, userId, 'device_revoked', { deviceId });

    return new Response(
      JSON.stringify(ApiResponseBuilder.success({ message: 'Device access revoked' })),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders()
        }
      }
    );

  } catch (error) {
    console.error('Revoke mobile device error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to revoke device')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// Update push notification token
export async function updatePushToken(context: MobileAuthContext, userId: number, deviceId: string): Promise<Response> {
  try {
    const body = await context.request.json();
    
    if (!body.pushToken) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.VALIDATION_ERROR, 'Push token required')),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    await context.db.executeQuery(
      'UPDATE mobile_devices SET push_token = $1, push_token_updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [body.pushToken, deviceId, userId]
    );

    return new Response(
      JSON.stringify(ApiResponseBuilder.success({ message: 'Push token updated' })),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders()
        }
      }
    );

  } catch (error) {
    console.error('Update push token error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to update push token')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// Helper functions

async function registerMobileDevice(
  db: WorkerDatabase,
  userId: number,
  deviceInfo: DeviceInfo,
  fingerprint: string,
  request: Request
): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  
  // Check if device already exists
  const existingDevice = await db.executeQuery(
    'SELECT id FROM mobile_devices WHERE user_id = $1 AND device_fingerprint = $2',
    [userId, fingerprint]
  );

  if (existingDevice.rows.length > 0) {
    // Update existing device
    await db.executeQuery(
      'UPDATE mobile_devices SET device_name = $1, app_version = $2, last_activity = NOW(), is_active = true WHERE id = $3',
      [deviceInfo.name, deviceInfo.version, existingDevice.rows[0].id]
    );
    return existingDevice.rows[0].id;
  }

  // Insert new device
  const result = await db.executeQuery(
    `INSERT INTO mobile_devices (
      user_id, device_id, device_name, platform, device_model, 
      app_version, device_fingerprint, registration_ip, 
      push_token, registered_at, last_activity, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), true) 
    RETURNING id`,
    [
      userId,
      deviceInfo.id,
      deviceInfo.name,
      deviceInfo.platform,
      deviceInfo.model || null,
      deviceInfo.version || null,
      fingerprint,
      ip,
      deviceInfo.pushToken || null
    ]
  );

  return result.rows[0].id;
}

async function hashToken(token: string): Promise<string> {
  // Simple hash for token storage (in production, use crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

async function logMobileSecurityEvent(
  db: WorkerDatabase,
  userId: number,
  eventType: string,
  metadata: any
): Promise<void> {
  try {
    await db.executeQuery(
      'INSERT INTO security_events (user_id, event_type, metadata, created_at) VALUES ($1, $2, $3, NOW())',
      [userId, eventType, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('Failed to log mobile security event:', error);
  }
}