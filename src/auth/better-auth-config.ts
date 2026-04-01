/**
 * Better Auth Configuration for Pitchey Platform
 * Integrates with Cloudflare Workers and Neon PostgreSQL
 */

import { betterAuth } from "better-auth"
import { neon } from "@neondatabase/serverless"

// Pitchey user types
export type PortalType = 'creator' | 'investor' | 'production'

export interface PitcheyUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string
  portalType: PortalType
  companyName?: string
  phone?: string
  bio?: string
  website?: string
  linkedinUrl?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Creates Better Auth instance configured for Pitchey platform
 */
export function createAuth(env: any) {
  // Validate required environment variables
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required")
  }
  
  if (!env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET environment variable is required")
  }

  // Initialize Neon PostgreSQL connection
  const sql = neon(env.DATABASE_URL, {
    // Enable connection pooling for better performance
    fullResults: true,
    arrayMode: false
  })

  // Determine base URL
  const baseURL = env.BETTER_AUTH_URL || env.CF_PAGES_URL || "http://localhost:8001"
  
  return betterAuth({
    // Secret for signing sessions
    secret: env.BETTER_AUTH_SECRET,
    
    // Base URL for redirects
    baseURL: baseURL,
    
    // Database configuration - use direct SQL connection
    database: {
      provider: "postgresql", 
      url: env.DATABASE_URL,
      // Better Auth will handle table creation and management
      generateTables: true
    },
    // Authentication methods
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: env.ENVIRONMENT === 'production',
      minPasswordLength: 8,
      maxPasswordLength: 128
    },

    // Session configuration optimized for edge
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // Update every 24 hours
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5 // 5 minutes cache
      }
    },

    // Cookie configuration for multi-domain support
    cookies: {
      name: env.SESSION_COOKIE_NAME || "pitchey-auth",
      secure: true, // Must be true when sameSite: 'none'
      sameSite: "none", // Allow cross-domain cookie sending
      httpOnly: true,
      // Support subdomains
      domain: env.ENVIRONMENT === 'production'
        ? ".pages.dev"
        : undefined,
      path: "/",
      maxAge: 60 * 60 * 24 * 30 // 30 days
    },

    // CORS and trusted origins
    trustedOrigins: [
      "https://pitchey-5o8.pages.dev",
      "https://*.pitchey-5o8.pages.dev", // All Pages preview deployments
      "https://pitchey-5o8-66n.pages.dev",
      "https://pitchey-api-prod.ndlovucavelle.workers.dev",
      "http://localhost:5173", // Vite dev server
      "http://localhost:8001", // Local proxy
      "http://localhost:3000", // Alternative dev server
      baseURL
    ],

    // Rate limiting configuration
    rateLimit: {
      enabled: true,
      window: 60, // 1 minute window
      max: 100, // 100 requests per minute per IP
      // Custom key generator using Cloudflare's CF-Connecting-IP
      keyGenerator: (request: Request) => {
        return request.headers.get("CF-Connecting-IP") || 
               request.headers.get("X-Forwarded-For") || 
               "unknown"
      },
      // Custom storage using Cloudflare KV
      storage: (env.RATE_LIMIT_KV ? {
        get: async (key: string) => {
          try {
            const value = await env.RATE_LIMIT_KV.get(key)
            return value ? JSON.parse(value) : null
          } catch {
            return null
          }
        },
        set: async (key: string, value: any, ttl: number) => {
          try {
            await env.RATE_LIMIT_KV.put(key, JSON.stringify(value), {
              expirationTtl: ttl
            })
          } catch (error) {
            console.error("Rate limit storage error:", error)
          }
        }
      } : undefined) as any
    },

    // OAuth providers
    socialProviders: {
      google: env.GOOGLE_CLIENT_ID ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: ["openid", "email", "profile"]
      } as any : undefined,

      github: env.GITHUB_CLIENT_ID ? {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        scope: ["user:email", "read:user"]
      } as any : undefined
    },

    // Plugins will be added after fixing imports
    plugins: [],

    // Advanced configuration
    advanced: {
      // Cross-subdomain cookie support
      crossSubDomainCookies: {
        enabled: env.ENVIRONMENT === 'production',
        domain: ".pages.dev"
      }
    } as any,

    // Email configuration (for verification, magic links, etc.)
    emailVerification: {
      enabled: env.ENVIRONMENT === 'production',
      expiresIn: 60 * 60 * 24, // 24 hours
      // Custom email sending
      sendVerificationEmail: async ({ user, url, token }: { user: any; url: string; token: string }) => {
        // TODO: Integrate with email service
        console.log(`Verification email for ${user.email}: ${url}`)
      }
    },

    // Error handling
    logger: {
      level: env.ENVIRONMENT === 'production' ? "warn" : "debug",
      disabled: false
    }
  })
}

/**
 * Utility functions for Pitchey-specific auth operations
 */
export class PitcheyAuthUtils {
  
  /**
   * Validates if user has access to specific portal using raw SQL
   */
  static async validatePortalAccess(
    userId: string, 
    requestedPortal: PortalType,
    sql: any
  ): Promise<boolean> {
    try {
      // Query user's portal permissions using raw SQL
      const result = await sql`
        SELECT portal_type 
        FROM users 
        WHERE id = ${userId}
        LIMIT 1
      `
      
      if (!result || result.length === 0) return false
      
      // Allow access if user has the requested portal type
      return result[0].portal_type === requestedPortal
      
    } catch (error) {
      console.error("Portal access validation error:", error)
      return false
    }
  }

  /**
   * Creates demo accounts for testing
   */
  static async createDemoAccounts(auth: any) {
    const demoAccounts = [
      {
        email: "alex.creator@demo.com",
        password: "Demo123",
        name: "Alex Creator",
        portalType: "creator" as PortalType,
        bio: "Indie filmmaker with passion for storytelling"
      },
      {
        email: "sarah.investor@demo.com", 
        password: "Demo123",
        name: "Sarah Investor",
        portalType: "investor" as PortalType,
        companyName: "Angel Ventures LLC",
        bio: "Angel investor focused on entertainment industry"
      },
      {
        email: "stellar.production@demo.com",
        password: "Demo123", 
        name: "Stellar Productions",
        portalType: "production" as PortalType,
        companyName: "Stellar Productions Inc.",
        bio: "Independent production company"
      }
    ]

    for (const account of demoAccounts) {
      try {
        await auth.api.signUp({
          email: account.email,
          password: account.password,
          name: account.name
        })
        
        console.log(`✅ Created demo account: ${account.email}`)
        
      } catch (error) {
        const e = error instanceof Error ? error : new Error(String(error));
        if (e.message?.includes("already exists")) {
          console.log(`⚠️  Demo account already exists: ${account.email}`)
        } else {
          console.error(`❌ Failed to create demo account ${account.email}:`, e)
        }
      }
    }
  }

  /**
   * Generates portal-specific JWT token
   */
  static async generatePortalToken(
    user: PitcheyUser, 
    portal: PortalType,
    secret: string
  ): Promise<string> {
    const payload = {
      userId: user.id,
      email: user.email,
      portal: portal,
      name: user.name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) // 30 days
    }

    // This is a simplified JWT implementation
    // In production, use a proper JWT library
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    const claims = btoa(JSON.stringify(payload))
    
    // Create signature (simplified - use proper HMAC in production)
    const signature = btoa(`${header}.${claims}.${secret}`)
    
    return `${header}.${claims}.${signature}`
  }
}

// Type exports for frontend integration
export { createAuth as default }