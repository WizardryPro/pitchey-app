/**
 * Multi-Factor Authentication Service
 * TOTP-based 2FA implementation for Better Auth
 * 
 * Security Features:
 * - TOTP (RFC 6238) compliant
 * - Backup codes for recovery
 * - Rate limiting on verification attempts
 * - Secure secret storage
 */

// Base32 encoding/decoding implementation for Cloudflare Workers
// RFC 4648 compliant implementation
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32 = {
  encode(buffer: Uint8Array): string {
    let result = '';
    let bits = 0;
    let value = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      
      while (bits >= 5) {
        result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    
    if (bits > 0) {
      result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    
    // Add padding
    while (result.length % 8 !== 0) {
      result += '=';
    }
    
    return result;
  },
  
  decode(encoded: string): Uint8Array {
    const cleanStr = encoded.replace(/=/g, '');
    const bytes: number[] = [];
    let bits = 0;
    let value = 0;
    
    for (let i = 0; i < cleanStr.length; i++) {
      const idx = BASE32_ALPHABET.indexOf(cleanStr[i]);
      if (idx === -1) {
        throw new Error(`Invalid base32 character: ${cleanStr[i]}`);
      }
      
      value = (value << 5) | idx;
      bits += 5;
      
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    
    return new Uint8Array(bytes);
  }
};

// TOTP Configuration
const TOTP_CONFIG = {
  issuer: 'Pitchey',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  window: 2, // Allow 2 time steps before/after
  qrCodeSize: 200
};

// Rate limiting for verification attempts
const verificationAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a secure random secret for TOTP
 */
export function generateSecret(): string {
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  return base32.encode(array);
}

/**
 * Generate TOTP URI for QR code
 */
export function generateTOTPUri(
  secret: string,
  email: string,
  issuer: string = TOTP_CONFIG.issuer
): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?` +
    `secret=${secret}&` +
    `issuer=${encodedIssuer}&` +
    `algorithm=${TOTP_CONFIG.algorithm}&` +
    `digits=${TOTP_CONFIG.digits}&` +
    `period=${TOTP_CONFIG.period}`;
}

/**
 * Generate QR code as data URL
 */
export async function generateQRCode(uri: string): Promise<string> {
  // Using a simple QR code generation approach
  // In production, you might want to use a library
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${TOTP_CONFIG.qrCodeSize}x${TOTP_CONFIG.qrCodeSize}&data=${encodeURIComponent(uri)}`;
  
  try {
    const response = await fetch(qrApiUrl);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('QR code generation failed');
  }
}

/**
 * Generate TOTP token for a given time
 */
async function generateTOTP(secret: string, time: number = Date.now()): Promise<string> {
  const timeStep = Math.floor(time / 1000 / TOTP_CONFIG.period);
  const secretBytes = base32.decode(secret);
  
  // Convert time to 8-byte buffer
  const timeBuffer = new ArrayBuffer(8);
  const view = new DataView(timeBuffer);
  view.setUint32(4, timeStep);
  
  // HMAC-SHA1
  const key = new Uint8Array(secretBytes);
  const message = new Uint8Array(timeBuffer);
  
  return await hotp(key, message);
}

/**
 * HOTP implementation (used by TOTP)
 */
async function hotp(key: Uint8Array, counter: Uint8Array): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counter as unknown as ArrayBuffer);
  const hash = new Uint8Array(signature);
  
  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0xf;
  const binary = 
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  
  const otp = binary % Math.pow(10, TOTP_CONFIG.digits);
  return otp.toString().padStart(TOTP_CONFIG.digits, '0');
}

/**
 * Verify TOTP token
 */
export async function verifyTOTP(
  token: string,
  secret: string,
  userId: string
): Promise<{ valid: boolean; reason?: string }> {
  // Check rate limiting
  const attempts = verificationAttempts.get(userId);
  
  if (attempts) {
    if (attempts.resetAt > Date.now()) {
      if (attempts.count >= MAX_ATTEMPTS) {
        return { 
          valid: false, 
          reason: `Too many attempts. Try again in ${Math.ceil((attempts.resetAt - Date.now()) / 60000)} minutes.`
        };
      }
      attempts.count++;
    } else {
      // Reset attempts
      attempts.count = 1;
      attempts.resetAt = Date.now() + LOCKOUT_DURATION;
    }
  } else {
    verificationAttempts.set(userId, {
      count: 1,
      resetAt: Date.now() + LOCKOUT_DURATION
    });
  }
  
  // Validate token format
  if (!/^\d{6}$/.test(token)) {
    return { valid: false, reason: 'Invalid token format' };
  }
  
  // Check current and adjacent time windows
  const now = Date.now();
  
  for (let i = -TOTP_CONFIG.window; i <= TOTP_CONFIG.window; i++) {
    const time = now + (i * TOTP_CONFIG.period * 1000);
    const expectedToken = await generateTOTP(secret, time);
    
    if (token === expectedToken) {
      // Clear rate limiting on success
      verificationAttempts.delete(userId);
      return { valid: true };
    }
  }
  
  return { valid: false, reason: 'Invalid token' };
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const code = Array.from(array)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
  }
  
  return codes;
}

/**
 * Hash backup code for storage
 */
export async function hashBackupCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/**
 * Verify backup code
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<boolean> {
  const hashedInput = await hashBackupCode(code.toUpperCase().replace(/\s/g, ''));
  return hashedCodes.includes(hashedInput);
}

/**
 * MFA Setup Response
 */
export interface MFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  uri: string;
}

/**
 * Complete MFA setup for a user
 */
export async function setupMFA(
  userId: string,
  email: string
): Promise<MFASetupResponse> {
  const secret = generateSecret();
  const uri = generateTOTPUri(secret, email);
  const qrCode = await generateQRCode(uri);
  const backupCodes = generateBackupCodes();
  
  return {
    secret,
    qrCode,
    backupCodes,
    uri
  };
}

/**
 * MFA Status for a user
 */
export interface MFAStatus {
  enabled: boolean;
  method?: 'totp' | 'sms' | 'email';
  backupCodesRemaining?: number;
  lastUsed?: Date;
  enrolledAt?: Date;
}

/**
 * Check if MFA is required for an action
 */
export function requiresMFA(
  action: string,
  userType: string,
  amount?: number
): boolean {
  // High-value operations require MFA
  const highValueActions = [
    'investment.create',
    'investment.approve',
    'payment.process',
    'user.delete',
    'admin.access',
    'nda.sign',
    'pitch.delete'
  ];
  
  if (highValueActions.includes(action)) {
    return true;
  }
  
  // Investor actions over certain amount
  if (userType === 'investor' && amount && amount > 10000) {
    return true;
  }
  
  // Production company sensitive actions
  if (userType === 'production' && action.startsWith('contract.')) {
    return true;
  }
  
  return false;
}

/**
 * MFA Challenge Response
 */
export interface MFAChallenge {
  challengeId: string;
  method: 'totp' | 'backup' | 'sms';
  expiresAt: Date;
  attempts: number;
}

/**
 * Create MFA challenge for verification
 */
export function createMFAChallenge(
  userId: string,
  method: 'totp' | 'backup' | 'sms' = 'totp'
): MFAChallenge {
  return {
    challengeId: crypto.randomUUID(),
    method,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    attempts: 0
  };
}

/**
 * Recovery options when MFA device is lost
 */
export interface RecoveryOptions {
  backupCodes: boolean;
  email: boolean;
  sms: boolean;
  supportTicket: boolean;
}

/**
 * Get available recovery options for a user
 */
export function getRecoveryOptions(user: any): RecoveryOptions {
  return {
    backupCodes: user.backupCodesRemaining > 0,
    email: !!user.email && user.emailVerified,
    sms: !!user.phone && user.phoneVerified,
    supportTicket: true
  };
}

/**
 * Audit log for MFA events
 */
export interface MFAEvent {
  userId: string;
  event: 'enabled' | 'disabled' | 'verified' | 'failed' | 'backup_used' | 'recovered';
  method?: string;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
  details?: Record<string, any>;
}

/**
 * Log MFA event for audit trail
 */
export async function logMFAEvent(
  event: MFAEvent,
  db: any
): Promise<void> {
  try {
    await db.query(`
      INSERT INTO mfa_audit_log 
      (user_id, event, method, ip, user_agent, timestamp, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      event.userId,
      event.event,
      event.method,
      event.ip,
      event.userAgent,
      event.timestamp,
      JSON.stringify(event.details)
    ]);
  } catch (error) {
    console.error('Failed to log MFA event:', error);
  }
}