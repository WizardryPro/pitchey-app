/**
 * Raw SQL Authentication Configuration for Pitchey Platform
 * Custom authentication without ORM dependencies
 */

import { RawSQLAuth } from './raw-sql-auth.ts';
import { RawSQLDatabase } from '../db/raw-sql-connection.ts';

// Pitchey user types
export type PortalType = 'creator' | 'investor' | 'production';

export interface AuthConfig {
  database: RawSQLDatabase;
  jwtSecret?: string;
  sessionCookieName?: string;
  sessionDuration?: number; // in milliseconds
  environment?: 'development' | 'production';
  trustedOrigins?: string[];
  rateLimit?: {
    enabled: boolean;
    window: number; // in seconds
    max: number; // max requests per window
  };
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  sessionCookieName: 'pitchey-session',
  sessionDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
  environment: 'development' as const,
  trustedOrigins: [
    'https://pitchey.pages.dev',
    'https://pitchey-frontend-ndlovu.pages.dev',
    'https://pitchey-api-prod.ndlovucavelle.workers.dev',
    'http://localhost:5173',
    'http://localhost:8001',
    'http://localhost:3000'
  ],
  rateLimit: {
    enabled: true,
    window: 60, // 1 minute
    max: 100 // 100 requests per minute
  }
};

/**
 * Creates authentication instance with raw SQL
 */
export function createRawSQLAuth(env: any): RawSQLAuth {
  // Validate required environment variables
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Create database connection
  const db = new RawSQLDatabase({
    connectionString: env.DATABASE_URL,
    readReplicaUrls: env.READ_REPLICA_URLS ? env.READ_REPLICA_URLS.split(',') : [],
    redis: env.UPSTASH_REDIS_REST_URL ? {
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN
    } : undefined
  });

  // Create auth instance
  return new RawSQLAuth(env.DATABASE_URL);
}

/**
 * Authentication middleware for request handling
 */
export async function authMiddleware(
  request: Request,
  env: any,
  ctx: any
): Promise<{ user: any; session: any } | null> {
  const auth = createRawSQLAuth(env);
  
  // Extract session token from cookie or header
  const token = getSessionToken(request);
  
  if (!token) {
    return null;
  }
  
  // Validate session
  const result = await auth.validateSession(token);
  
  if (!result) {
    return null;
  }
  
  return result;
}

/**
 * Extract session token from request
 */
function getSessionToken(request: Request): string | null {
  // Check cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    const sessionCookie = cookies['pitchey-session'] || cookies['pitchey-auth'];
    if (sessionCookie) {
      return sessionCookie;
    }
  }
  
  // Check Authorization header (for backward compatibility)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

/**
 * Parse cookie string into object
 */
function parseCookies(cookieString: string): Record<string, string> {
  return cookieString.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Create session cookie
 */
export function createSessionCookie(
  token: string,
  options?: {
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    domain?: string;
    path?: string;
  }
): string {
  const defaults = {
    maxAge: DEFAULT_CONFIG.sessionDuration / 1000, // Convert to seconds
    secure: true,
    httpOnly: true,
    sameSite: 'none' as const, // Required for cross-origin cookies
    path: '/'
  };
  
  const opts = { ...defaults, ...options };
  
  let cookie = `pitchey-session=${token}`;
  
  if (opts.maxAge) {
    cookie += `; Max-Age=${opts.maxAge}`;
  }
  
  if (opts.secure) {
    cookie += '; Secure';
  }
  
  if (opts.httpOnly) {
    cookie += '; HttpOnly';
  }
  
  if (opts.sameSite) {
    cookie += `; SameSite=${opts.sameSite}`;
  }
  
  if (opts.domain) {
    cookie += `; Domain=${opts.domain}`;
  }
  
  if (opts.path) {
    cookie += `; Path=${opts.path}`;
  }
  
  return cookie;
}

/**
 * CORS configuration
 */
export function getCORSHeaders(origin: string | null, env: any): Record<string, string> {
  const trustedOrigins = env.TRUSTED_ORIGINS 
    ? env.TRUSTED_ORIGINS.split(',') 
    : DEFAULT_CONFIG.trustedOrigins;
  
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
  
  if (origin && trustedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (env.ENVIRONMENT !== 'production') {
    // Allow any origin in development
    headers['Access-Control-Allow-Origin'] = origin || '*';
  } else {
    // Allow all origins temporarily for preview deployments
    headers['Access-Control-Allow-Origin'] = '*';
  }
  
  return headers;
}

/**
 * Rate limiting utility
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private window: number; // seconds
  private max: number;
  
  constructor(window: number = 60, max: number = 100) {
    this.window = window;
    this.max = max;
  }
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - (this.window * 1000);
    
    // Get existing requests for this key
    const requests = this.requests.get(key) || [];
    
    // Filter out expired requests
    const validRequests = requests.filter(time => time > windowStart);
    
    // Check if under limit
    if (validRequests.length >= this.max) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanup();
    }
    
    return true;
  }
  
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - (this.window * 1000);
    
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > windowStart);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

/**
 * Session cleanup job
 */
export async function cleanupExpiredSessions(auth: RawSQLAuth): Promise<number> {
  return await auth.cleanupSessions();
}

// Export types
export type { RawSQLAuth } from './raw-sql-auth.ts';
export { createAuthResponse, getSessionToken } from './raw-sql-auth.ts';