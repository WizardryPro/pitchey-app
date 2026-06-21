/**
 * Critical Security Fixes for Pitchey Platform
 * Addresses vulnerabilities identified in security audit
 */

import { z } from 'zod';

/**
 * 1. PASSWORD HASHING FIX
 * Using Web Crypto API with PBKDF2 for Cloudflare Workers compatibility
 */
export class PasswordService {
  private static readonly ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 32;

  static async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    // Generate a random salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Encode the password
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import the password as a key
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // Derive the hash
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      passwordKey,
      this.KEY_LENGTH * 8
    );

    // Combine salt and hash, then encode as base64
    const hashArray = new Uint8Array(hashBuffer);
    const combined = new Uint8Array(salt.length + hashArray.length);
    combined.set(salt);
    combined.set(hashArray, salt.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  }

  static async verifyPassword(hashedPassword: string, inputPassword: string): Promise<boolean> {
    try {
      // Decode the stored hash
      const combined = Uint8Array.from(atob(hashedPassword), c => c.charCodeAt(0));

      // Extract salt and hash
      const salt = combined.slice(0, 16);
      const storedHash = combined.slice(16);

      // Hash the input password with the same salt
      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(inputPassword);

      const passwordKey = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveBits']
      );

      const hashBuffer = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: this.ITERATIONS,
          hash: 'SHA-256'
        },
        passwordKey,
        this.KEY_LENGTH * 8
      );

      const hashArray = new Uint8Array(hashBuffer);

      // Compare hashes
      return hashArray.every((byte, index) => byte === storedHash[index]);
    } catch {
      return false;
    }
  }
}

/**
 * 2. ENVIRONMENT VALIDATION
 * Ensure all required secrets are present
 */
export class EnvironmentValidator {
  static validate(env: any): void {
    const required = [
      'DATABASE_URL',
      'JWT_SECRET',
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_URL'
    ];

    const missing = required.filter(key => !env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Prevent development secrets in production
    if (env.DENO_ENV === 'production' || env.NODE_ENV === 'production') {
      if (env.JWT_SECRET?.includes('test') || env.JWT_SECRET?.includes('dev')) {
        throw new Error('Development secrets detected in production environment');
      }
    }
  }
}

/**
 * 3. SECURITY HEADERS
 * Add comprehensive security headers to all responses
 */
export function addSecurityHeaders(response: Response, environment?: string): Response {
  // CRITICAL: WebSocket responses (status 101) must not be modified
  // Creating a new Response strips the webSocket property which is required
  // for Cloudflare Workers to handle WebSocket upgrades
  if (response.status === 101 || (response as any).webSocket) {
    console.log('[SecurityHeaders] Returning WebSocket response unchanged');
    return response;
  }

  const headers = new Headers(response.headers);

  // Content Security Policy
  //
  // P6 — CSP ownership is split by surface, on purpose:
  //   • This (Worker) policy covers Worker responses. Those are JSON (where CSP
  //     is inert — nothing executes) EXCEPT the Swagger docs HTML route
  //     (routes/documentation.ts), which loads its UI from cdn.jsdelivr.net /
  //     unpkg.com — hence the only script-src hosts here.
  //   • The wide policy with Stripe / Turnstile / Sentry lives in
  //     frontend/public/_headers, because those flows run in the SPA, never in a
  //     Worker-served HTML page. Don't widen this one to "match" the SPA — the
  //     Worker has no payment/challenge surface; broadening it only weakens it.
  // If you ever add a Worker route that returns HTML needing one of those hosts,
  // add it HERE (and document why), don't copy the whole SPA policy.
  headers.set('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://pitchey-api-prod.ndlovucavelle.workers.dev wss://pitchey-api-prod.ndlovucavelle.workers.dev; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );

  // Additional security headers
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // HSTS - Enforce in production or if URL is HTTPS
  // response.url is often empty in Workers, so we rely on the environment flag
  const isProduction = environment === 'production' || environment === 'staging';
  const isHttps = response.url?.startsWith('https://');

  if (isProduction || isHttps) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * 4. INPUT VALIDATION SCHEMAS
 * Comprehensive input validation using Zod
 */
export const ValidationSchemas = {
  // User registration
  userRegistration: z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(8).max(100),
    name: z.string().min(2).max(100).trim(),
    role: z.enum(['creator', 'investor', 'production']).optional()
  }),

  // Login
  userLogin: z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(1)
  }),

  // Pitch creation
  pitchCreation: z.object({
    title: z.string().min(1).max(200).trim(),
    genre: z.string().min(1).max(50),
    logline: z.string().min(10).max(500).trim(),
    synopsis: z.string().min(50).max(5000).trim(),
    budget: z.number().positive().max(1000000000).optional(),
    targetAudience: z.string().max(200).optional(),
    comparableWorks: z.string().max(1000).optional(),
    status: z.enum(['draft', 'published', 'archived']).default('draft')
  }),

  // NDA request
  ndaRequest: z.object({
    pitchId: z.number().positive(),
    message: z.string().max(1000).optional()
  }),

  // Investment
  investment: z.object({
    pitchId: z.number().positive(),
    amount: z.number().positive().max(100000000),
    currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
    terms: z.string().max(5000).optional()
  }),

  // File upload
  fileUpload: z.object({
    fileName: z.string().regex(/^[a-zA-Z0-9._-]+$/).max(255),
    fileType: z.enum(['pdf', 'docx', 'pptx', 'xlsx', 'jpg', 'png', 'mp4']),
    fileSize: z.number().positive().max(100 * 1024 * 1024) // 100MB max
  })
};

/**
 * 5. RATE LIMITING
 * Implement rate limiting for sensitive endpoints
 */
export class RateLimiter {
  private attempts: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(
    private maxAttempts: number,
    private windowMs: number
  ) { }

  async checkLimit(identifier: string): Promise<boolean> {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record || now > record.resetAt) {
      this.attempts.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs
      });
      return true;
    }

    if (record.count >= this.maxAttempts) {
      return false;
    }

    record.count++;
    return true;
  }

  getRemainingAttempts(identifier: string): number {
    const record = this.attempts.get(identifier);
    if (!record || Date.now() > record.resetAt) {
      return this.maxAttempts;
    }
    return Math.max(0, this.maxAttempts - record.count);
  }
}

// Rate limiter instances for different endpoints
export const rateLimiters = {
  login: new RateLimiter(5, 60 * 1000), // 5 attempts per minute
  register: new RateLimiter(3, 60 * 60 * 1000), // 3 per hour
  api: new RateLimiter(100, 60 * 1000), // 100 per minute
  upload: new RateLimiter(10, 5 * 60 * 1000) // 10 per 5 minutes
};

/**
 * 6. SANITIZATION UTILITIES
 */
export class Sanitizer {
  // Remove HTML tags and dangerous characters
  static text(input: string): string {
    let result = input;
    // Iteratively remove HTML tags to handle nested/malformed markup
    let previous = '';
    while (previous !== result) {
      previous = result;
      result = result.replace(/<[^>]*>/g, '');
    }
    return result
      .replace(/[<>\"'&]/g, '') // Remove dangerous characters
      .trim();
  }

  // Sanitize file names
  static fileName(input: string): string {
    return input
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '_') // Prevent directory traversal
      .substring(0, 255);
  }

  // Sanitize URLs
  static url(input: string): string {
    try {
      const url = new URL(input);
      // Only allow HTTP(S) protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid protocol');
      }
      return url.toString();
    } catch {
      throw new Error('Invalid URL');
    }
  }
}

/**
 * 7. SECURE SESSION CONFIGURATION
 */
export const secureSessionConfig = {
  cookieOptions: {
    httpOnly: true,
    secure: true, // Always use HTTPS
    sameSite: 'none' as const, // Required for cross-origin cookies (frontend on pages.dev, API on workers.dev)
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
    domain: undefined // Let browser handle domain
  },

  sessionDuration: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  refreshThreshold: 24 * 60 * 60 * 1000, // Refresh if < 1 day left

  generateSessionId(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }
};

/**
 * 8. AUDIT LOG ENHANCEMENT
 */
export interface SecurityAuditLog {
  timestamp: string;
  userId?: number;
  action: string;
  resource?: string;
  result: 'success' | 'failure' | 'blocked';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export async function logSecurityEvent(
  event: SecurityAuditLog,
  sql: any
): Promise<void> {
  try {
    await sql`
      INSERT INTO security_audit_log (
        timestamp, user_id, action, resource, result,
        ip_address, user_agent, metadata, severity
      ) VALUES (
        ${event.timestamp}, ${event.userId}, ${event.action},
        ${event.resource}, ${event.result}, ${event.ipAddress},
        ${event.userAgent}, ${JSON.stringify(event.metadata)}, ${event.severity}
      )
    `;
  } catch (error) {
    console.error('Failed to log security event:', error);
    // Don't throw - logging failure shouldn't break the app
  }
}