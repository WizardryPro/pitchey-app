/**
 * Password Management Handlers for Better Auth
 * Implements password change with current password verification
 */

import { ApiResponseBuilder, ErrorCode } from '../utils/api-response';
import { createDatabase } from '../db/raw-sql-connection';
import { getAuthenticatedUser } from '../utils/auth-extract';
import * as bcrypt from 'bcryptjs';

/**
 * Change Password Handler
 * Requires current password verification before allowing password change
 */
interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
}

export async function changePasswordHandler(
  request: Request,
  env: any,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.json() as ChangePasswordBody;
    const { currentPassword, newPassword, revokeOtherSessions } = body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return ApiResponseBuilder.error(
        ErrorCode.VALIDATION_ERROR,
        'Current and new passwords are required'
      );
    }
    
    // Validate password strength
    if (newPassword.length < 8) {
      return ApiResponseBuilder.error(
        ErrorCode.VALIDATION_ERROR,
        'New password must be at least 8 characters long'
      );
    }
    
    if (newPassword.length > 128) {
      return ApiResponseBuilder.error(
        ErrorCode.VALIDATION_ERROR,
        'New password must not exceed 128 characters'
      );
    }
    
    // Get current user from session
    const authResult = await getAuthenticatedUser(request, env);

    if (!authResult.authenticated || !authResult.user) {
      return ApiResponseBuilder.error(
        ErrorCode.UNAUTHORIZED,
        'Not authenticated'
      );
    }
    const session = { user: authResult.user };
    
    // Get user's current password hash from database
    const db = createDatabase(env.DATABASE_URL);
    const userResult = await db.query(
      'SELECT id, password FROM users WHERE id = $1',
      [session.user.id]
    );
    
    if (userResult.length === 0) {
      return ApiResponseBuilder.error(
        ErrorCode.NOT_FOUND,
        'User not found'
      );
    }

    const user = userResult[0];
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      // Log failed attempt for security monitoring
      console.warn('Failed password change attempt', {
        userId: session.user.id,
        timestamp: new Date().toISOString(),
        ip: request.headers.get('CF-Connecting-IP')
      });
      
      return ApiResponseBuilder.error(
        ErrorCode.UNAUTHORIZED,
        'Current password is incorrect'
      );
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password in database
    await db.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, session.user.id]
    );
    
    // Revoke other sessions if requested
    if (revokeOtherSessions) {
      // Get current session token
      const cookies = request.headers.get('cookie') || '';
      const sessionToken = cookies
        .split(';')
        .find(c => c.trim().startsWith('session='))
        ?.split('=')[1];
      
      // Delete all sessions except the current one
      await db.query(
        'DELETE FROM sessions WHERE user_id = $1 AND token != $2',
        [session.user.id, sessionToken]
      );
    }
    
    // Log successful password change
    console.log('Password changed successfully', {
      userId: session.user.id,
      timestamp: new Date().toISOString(),
      sessionsRevoked: revokeOtherSessions
    });
    
    return ApiResponseBuilder.success({
      message: 'Password changed successfully',
      sessionsRevoked: revokeOtherSessions || false
    });
    
  } catch (error) {
    console.error('Password change error:', error);
    return ApiResponseBuilder.error(
      ErrorCode.INTERNAL_ERROR,
      'Failed to change password'
    );
  }
}

/**
 * Request Password Reset Handler
 * Sends a password reset email to the user
 */
interface PasswordResetRequestBody {
  email: string;
}

export async function requestPasswordResetHandler(
  request: Request,
  env: any,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.json() as PasswordResetRequestBody;
    const { email } = body;
    
    if (!email) {
      return ApiResponseBuilder.error(
        ErrorCode.VALIDATION_ERROR,
        'Email is required'
      );
    }
    
    const db = createDatabase(env.DATABASE_URL);
    
    // Check if user exists
    const userResult = await db.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    // Always return success to prevent email enumeration
    if (userResult.length === 0) {
      return ApiResponseBuilder.success({
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    }

    const user = userResult[0];
    
    // Generate reset token
    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour
    
    // Store reset token
    await db.query(
      `INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (user_id) 
       DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
      [user.id, resetToken, expiresAt]
    );
    
    // Send reset email (integrate with email service)
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    // Send reset email via Resend
    if (env.RESEND_API_KEY) {
      const { WorkerEmailService } = await import('../services/worker-email');
      const emailService = new WorkerEmailService({
        apiKey: env.RESEND_API_KEY,
        fromEmail: 'noreply@pitchey.com',
        fromName: 'Pitchey'
      });
      await emailService.send({
        to: email,
        subject: 'Reset your Pitchey password',
        html: `<h2>Password Reset</h2>
               <p>Click below to reset your password (expires in 1 hour):</p>
               <a href="${resetUrl}">Reset Password</a>
               <p>If you didn't request this, ignore this email.</p>`
      });
    } else {
      console.warn('RESEND_API_KEY not set — password reset email not sent');
    }
    
    return ApiResponseBuilder.success({
      message: 'If an account exists with this email, a password reset link has been sent'
    });
    
  } catch (error) {
    console.error('Password reset request error:', error);
    return ApiResponseBuilder.error(
      ErrorCode.INTERNAL_ERROR,
      'Failed to process password reset request'
    );
  }
}

/**
 * Reset Password Handler
 * Resets password using a valid reset token
 */
interface ResetPasswordBody {
  token: string;
  newPassword: string;
}

export async function resetPasswordHandler(
  request: Request,
  env: any,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.json() as ResetPasswordBody;
    const { token, newPassword } = body;
    
    if (!token || !newPassword) {
      return ApiResponseBuilder.error(
        ErrorCode.VALIDATION_ERROR,
        'Token and new password are required'
      );
    }
    
    // Validate password strength
    if (newPassword.length < 8 || newPassword.length > 128) {
      return ApiResponseBuilder.error(
        ErrorCode.VALIDATION_ERROR,
        'Password must be between 8 and 128 characters'
      );
    }
    
    const db = createDatabase(env.DATABASE_URL);
    
    // Verify reset token
    const tokenResult = await db.query(
      `SELECT user_id, expires_at 
       FROM password_reset_tokens 
       WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    
    if (tokenResult.length === 0) {
      return ApiResponseBuilder.error(
        ErrorCode.UNAUTHORIZED,
        'Invalid or expired reset token'
      );
    }

    const { user_id } = tokenResult[0];
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await db.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, user_id]
    );
    
    // Delete used token
    await db.query(
      'DELETE FROM password_reset_tokens WHERE token = $1',
      [token]
    );
    
    // Revoke all existing sessions for security
    await db.query(
      'DELETE FROM sessions WHERE user_id = $1',
      [user_id]
    );
    
    console.log('Password reset successfully', {
      userId: user_id,
      timestamp: new Date().toISOString()
    });
    
    return ApiResponseBuilder.success({
      message: 'Password has been reset successfully. Please login with your new password.'
    });
    
  } catch (error) {
    console.error('Password reset error:', error);
    return ApiResponseBuilder.error(
      ErrorCode.INTERNAL_ERROR,
      'Failed to reset password'
    );
  }
}