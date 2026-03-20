/**
 * Better Auth Configuration for Cloudflare Workers
 * Optimized for free tier constraints and multi-portal authentication
 */

import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins/organization';
import { admin } from 'better-auth/plugins/admin';
import { multiSession } from 'better-auth/plugins/multi-session';

// Cloudflare Environment Interface
interface CloudflareEnv {
  // Database
  DATABASE_URL: string;

  // Better Auth
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;

  // Storage & Cache
  SESSIONS_KV?: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace;
  KV?: KVNamespace;

  // Environment
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
  TRUSTED_ORIGINS?: string;
}

// Portal types for Pitchey
export type PortalType = 'creator' | 'investor' | 'production';

// User type mapping for Better Auth
export const PORTAL_USER_TYPES: Record<PortalType, string> = {
  creator: 'creator',
  investor: 'investor', 
  production: 'production'
};

/**
 * Create Better Auth instance optimized for Cloudflare Workers
 */
export function createBetterAuth(env: CloudflareEnv) {
  const trustedOrigins = env.TRUSTED_ORIGINS 
    ? env.TRUSTED_ORIGINS.split(',')
    : [
        'https://pitchey-5o8.pages.dev',
        'https://pitchey-api-prod.ndlovucavelle.workers.dev',
        'http://localhost:5173',
        'http://localhost:8001'
      ];

  return betterAuth({
    // Database configuration
    database: {
      provider: 'postgresql',
      url: env.DATABASE_URL,
    },

    // Session configuration optimized for Cloudflare
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // Update session every day
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes cache
      }
    },

    // Cookie configuration for cross-origin support
    // SameSite=None is required for cross-origin cookies (frontend on pages.dev, API on workers.dev)
    cookies: {
      sessionToken: {
        name: 'pitchey-session',
        httpOnly: true,
        secure: true, // Required when SameSite=None
        sameSite: 'none', // Required for cross-origin cookies
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      }
    },

    // Security configuration for production
    secret: env.BETTER_AUTH_SECRET,
    
    // Base URL configuration
    baseURL: env.BETTER_AUTH_URL || env.FRONTEND_URL || 'http://localhost:8001',
    
    // Trusted origins for CORS
    trustedOrigins,

    // Rate limiting configuration for free tier
    rateLimit: {
      window: 60, // 1 minute window
      max: 100,   // 100 requests per minute per IP
      storage: env.RATE_LIMIT_KV ? 'memory' : 'memory', // Use memory for free tier
    },

    // Email configuration (disabled for now to save resources)
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Disabled for free tier
      sendResetPassword: async () => {
        // Custom implementation or disable for free tier
        throw new Error('Password reset not implemented');
      }
    },

    // Social auth (can be added later)
    socialProviders: {
      // Add providers as needed
    },

    // Plugins configuration
    plugins: [
      // Organization plugin for production companies
      organization({
        async sendInvitation() {
          // Custom implementation for production invites
          return { data: null, error: null };
        }
      }),

      // Admin plugin for platform administration
      admin(),

      // Multi-session support for different portals
      multiSession({
        maximumSessions: 3, // Limit sessions for free tier
      })
    ],

    // Advanced configuration
    advanced: {
      // Optimize for serverless
      crossSubDomainCookies: {
        enabled: true,
        domain: env.ENVIRONMENT === 'production' ? '.pages.dev' : undefined
      },
      
      // Custom session storage for KV
      sessionStorage: env.SESSIONS_KV ? {
        async get(sessionId: string) {
          try {
            const session = await env.SESSIONS_KV!.get(`session:${sessionId}`);
            return session ? JSON.parse(session) : null;
          } catch {
            return null;
          }
        },
        
        async set(sessionId: string, session: any) {
          try {
            await env.SESSIONS_KV!.put(
              `session:${sessionId}`, 
              JSON.stringify(session),
              { expirationTtl: 60 * 60 * 24 * 30 } // 30 days
            );
          } catch (error) {
            console.error('Failed to store session:', error);
          }
        },
        
        async delete(sessionId: string) {
          try {
            await env.SESSIONS_KV!.delete(`session:${sessionId}`);
          } catch (error) {
            console.error('Failed to delete session:', error);
          }
        }
      } : undefined,
    },

    // User configuration with portal types
    user: {
      // Custom fields for Pitchey users
      additionalFields: {
        userType: {
          type: 'string',
          required: true,
          defaultValue: 'creator'
        },
        firstName: {
          type: 'string',
          required: false
        },
        lastName: {
          type: 'string',
          required: false
        },
        companyName: {
          type: 'string',
          required: false
        },
        subscriptionTier: {
          type: 'string',
          required: true,
          defaultValue: 'free'
        },
        bio: {
          type: 'string',
          required: false
        },
        profileImage: {
          type: 'string',
          required: false
        }
      }
    }
  });
}

/**
 * Portal-specific authentication configuration
 */
export interface PortalAuthConfig {
  portal: PortalType;
  redirectUrl?: string;
  additionalFields?: Record<string, any>;
}

/**
 * Create portal-specific sign-in data
 */
export function createPortalSignInData(
  email: string, 
  password: string, 
  config: PortalAuthConfig
) {
  return {
    email,
    password,
    userType: config.portal,
    callbackURL: config.redirectUrl || `/${config.portal}/dashboard`,
    ...config.additionalFields
  };
}

/**
 * Create portal-specific sign-up data
 */
export function createPortalSignUpData(
  email: string,
  username: string,
  password: string,
  config: PortalAuthConfig
) {
  return {
    email,
    name: username,
    password,
    userType: config.portal,
    subscriptionTier: 'free',
    callbackURL: config.redirectUrl || `/${config.portal}/dashboard`,
    ...config.additionalFields
  };
}

/**
 * Validate portal access for user
 */
export function validatePortalAccess(user: any, requiredPortal: PortalType): boolean {
  if (!user || !user.userType) {
    return false;
  }
  
  // Allow access to the user's own portal type
  return user.userType === requiredPortal;
}

/**
 * Create session with portal context
 */
export function createPortalSession(user: any, portal: PortalType) {
  return {
    ...user,
    currentPortal: portal,
    portalAccess: validatePortalAccess(user, portal),
    sessionMetadata: {
      portal,
      loginTime: new Date().toISOString(),
      userAgent: '', // Will be filled by request handler
      ipAddress: ''  // Will be filled by request handler
    }
  };
}

// Export types
export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;