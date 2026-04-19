/**
 * Better Auth Integration for Cloudflare Workers
 * Implements proper authentication with Hyperdrive PostgreSQL and D1 support
 */

import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import postgres from "postgres";
import { twoFactor, organization, admin, rateLimit, magicLink, passkey, openAPI } from "better-auth/plugins";

// Type definitions for Cloudflare environment
interface Env {
  // Hyperdrive binding for PostgreSQL
  HYPERDRIVE?: Fetcher;
  HYPERDRIVE_URL?: string;
  
  // D1 binding for SQLite
  DATABASE?: D1Database;
  
  // KV binding for caching
  KV?: KVNamespace;
  
  // R2 binding for file storage
  R2?: R2Bucket;
  
  // Environment variables
  JWT_SECRET: string;
  FRONTEND_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SENDGRID_API_KEY?: string;
  SENTRY_DSN?: string;
  NODE_ENV?: string;
  DENO_ENV?: string;
}

/**
 * Get database URL based on environment
 * Prioritizes Hyperdrive (PostgreSQL) over D1 (SQLite)
 */
function getDatabaseConfig(env: Env) {
  // Use Hyperdrive PostgreSQL if available
  if (env.HYPERDRIVE_URL) {
    return {
      provider: "postgresql",
      url: env.HYPERDRIVE_URL,
      generateTables: true
    };
  }
  
  // Fallback to D1 if available
  if (env.DATABASE) {
    return {
      provider: "sqlite",
      database: env.DATABASE,
      generateTables: true
    };
  }
  
  throw new Error("No database configuration found");
}

/**
 * Initialize Better Auth with Cloudflare optimizations
 */
export async function initBetterAuth(env: Env, request?: Request) {
  const dbConfig = getDatabaseConfig(env);
  
  // Get client IP for rate limiting
  const clientIP = request?.headers.get("cf-connecting-ip") || 
                   request?.headers.get("x-forwarded-for")?.split(",")[0] || 
                   "127.0.0.1";

  const auth = betterAuth(
    withCloudflare(
      {
        // Cloudflare-specific features
        autoDetectIpAddress: true,
        geolocationTracking: true,
        cf: request?.cf, // Cloudflare request metadata
        
        // Database configuration
        postgres: env.HYPERDRIVE_URL ? {
          connectionString: env.HYPERDRIVE_URL,
        } : undefined,
        
        d1: env.DATABASE ? {
          db: env.DATABASE,
        } : undefined,
        
        // KV for caching and rate limiting
        kv: env.KV,
        
        // R2 for file uploads
        r2: env.R2
      },
      {
        // Core configuration
        appName: "Pitchey",
        baseURL: env.FRONTEND_URL || "https://pitchey.pages.dev",
        secret: env.JWT_SECRET,
        
        // Database configuration
        database: dbConfig,
        
        // Email & password configuration
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: false, // Set to true in production
          sendResetPasswordToken: async ({ user, token }) => {
            if (env.SENDGRID_API_KEY) {
              // Send email via SendGrid
              const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${env.SENDGRID_API_KEY}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  personalizations: [{
                    to: [{ email: user.email }]
                  }],
                  from: { email: "noreply@pitchey.com", name: "Pitchey" },
                  subject: "Reset Your Password",
                  content: [{
                    type: "text/html",
                    value: `
                      <h2>Reset Your Password</h2>
                      <p>Click the link below to reset your password:</p>
                      <a href="${env.FRONTEND_URL}/auth/reset-password?token=${token}">
                        Reset Password
                      </a>
                      <p>This link will expire in 1 hour.</p>
                    `
                  }]
                })
              });
              
              if (!response.ok) {
                console.error("Failed to send password reset email");
              }
            } else {
              console.log(`Password reset token for ${user.email}: ${token}`);
            }
          }
        },
        
        // Session configuration
        session: {
          expiresIn: 60 * 60 * 24 * 7, // 7 days
          updateAge: 60 * 60 * 24, // Update if older than 1 day
          cookieCache: {
            enabled: true,
            maxAge: 5 * 60 // 5 minutes
          }
        },
        
        // User schema with custom fields
        user: {
          additionalFields: {
            userType: {
              type: "string",
              required: true,
              input: true
            },
            firstName: {
              type: "string",
              required: true,
              input: true
            },
            lastName: {
              type: "string",
              required: true,
              input: true
            },
            companyName: {
              type: "string",
              required: false,
              input: true
            },
            verified: {
              type: "boolean",
              defaultValue: false,
              input: false
            },
            subscriptionTier: {
              type: "string",
              defaultValue: "free",
              input: false
            }
          }
        },
        
        // Advanced configuration
        advanced: {
          generateCustomUserId: () => crypto.randomUUID(),
          cookiePrefix: "pitchey",
          defaultRole: "user",
          useSecureCookies: env.NODE_ENV === "production",
          crossSubDomainCookies: {
            enabled: true,
            domain: ".pitchey.pages.dev"
          },
          ipAddress: {
            ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"]
          }
        },
        
        // Trusted origins
        trustedOrigins: [
          "https://pitchey.pages.dev",
          "https://pitchey-api-prod.ndlovucavelle.workers.dev",
          "https://pitchey-api-prod.ndlovucavelle.workers.dev",
          env.NODE_ENV === "development" ? "http://localhost:5173" : "",
          env.NODE_ENV === "development" ? "http://localhost:8001" : ""
        ].filter(Boolean),
        
        // Plugins
        plugins: [
          // Two-factor authentication
          twoFactor({
            issuer: "Pitchey"
          }),
          
          // Organization support for production companies
          organization({
            allowUserToCreateOrganization: true,
            schema: {
              organization: {
                companyType: {
                  type: "string",
                  required: false
                },
                industry: {
                  type: "string",
                  required: false
                }
              }
            }
          }),
          
          // Admin features
          admin({
            impersonationSessionDuration: 60 * 60 // 1 hour
          }),
          
          // Rate limiting with KV storage
          rateLimit({
            enabled: true,
            storage: env.KV ? "kv" : "memory",
            window: 60, // KV TTL minimum is 60 seconds
            max: 10, // Max attempts per window
            customRules: {
              "/api/auth/*/login": {
                window: 60,
                max: 5
              },
              "/api/auth/*/register": {
                window: 300,
                max: 3
              }
            }
          }),
          
          // Magic link authentication
          magicLink({
            sendMagicLink: async ({ email, token, request }) => {
              if (env.SENDGRID_API_KEY) {
                // Send magic link via SendGrid
                await fetch("https://api.sendgrid.com/v3/mail/send", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${env.SENDGRID_API_KEY}`,
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    personalizations: [{
                      to: [{ email }]
                    }],
                    from: { email: "noreply@pitchey.com", name: "Pitchey" },
                    subject: "Your Pitchey Login Link",
                    content: [{
                      type: "text/html",
                      value: `
                        <h2>Login to Pitchey</h2>
                        <p>Click the link below to login:</p>
                        <a href="${env.FRONTEND_URL}/auth/magic-link?token=${token}">
                          Login to Pitchey
                        </a>
                        <p>This link will expire in 15 minutes.</p>
                      `
                    }]
                  })
                });
              } else {
                console.log(`Magic link for ${email}: ${token}`);
              }
            }
          }),
          
          // Passkey/WebAuthn support
          passkey({
            rpName: "Pitchey",
            rpID: "pitchey.pages.dev",
            origin: env.FRONTEND_URL || "https://pitchey.pages.dev"
          }),
          
          // OpenAPI documentation
          openAPI()
        ]
      }
    )
  );
  
  return auth;
}

/**
 * Portal-specific authentication handlers
 */
export function createPortalHandlers(auth: ReturnType<typeof betterAuth>) {
  return {
    // Creator login - validates user type
    async creatorLogin(email: string, password: string) {
      try {
        const session = await auth.signIn.email({
          email,
          password,
          callbackURL: "/creator/dashboard"
        });
        
        // Validate user type
        if (session.user.userType !== "creator") {
          throw new Error("Access denied: Creator portal only");
        }
        
        return {
          success: true,
          token: session.token,
          user: session.user
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || "Authentication failed"
        };
      }
    },
    
    // Investor login - validates user type
    async investorLogin(email: string, password: string) {
      try {
        const session = await auth.signIn.email({
          email,
          password,
          callbackURL: "/investor/dashboard"
        });
        
        // Validate user type
        if (session.user.userType !== "investor") {
          throw new Error("Access denied: Investor portal only");
        }
        
        return {
          success: true,
          token: session.token,
          user: session.user
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || "Authentication failed"
        };
      }
    },
    
    // Production login - validates user type
    async productionLogin(email: string, password: string) {
      try {
        const session = await auth.signIn.email({
          email,
          password,
          callbackURL: "/production/dashboard"
        });
        
        // Validate user type
        if (session.user.userType !== "production") {
          throw new Error("Access denied: Production portal only");
        }
        
        return {
          success: true,
          token: session.token,
          user: session.user
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || "Authentication failed"
        };
      }
    },
    
    // Validate session
    async validateSession(token: string) {
      try {
        const session = await auth.getSession({
          headers: {
            authorization: `Bearer ${token}`
          }
        });
        
        return {
          success: true,
          session
        };
      } catch (error) {
        return {
          success: false,
          error: "Invalid or expired session"
        };
      }
    },
    
    // Sign out
    async signOut(token: string) {
      try {
        await auth.signOut({
          headers: {
            authorization: `Bearer ${token}`
          }
        });
        
        return {
          success: true
        };
      } catch (error) {
        return {
          success: false,
          error: "Sign out failed"
        };
      }
    }
  };
}

/**
 * Middleware for protecting routes
 */
export function createAuthMiddleware(auth: ReturnType<typeof betterAuth>) {
  return {
    // Require authentication
    requireAuth: async (request: Request, userType?: string) => {
      const token = request.headers.get("authorization")?.replace("Bearer ", "");
      
      if (!token) {
        return new Response(JSON.stringify({
          success: false,
          message: "Authentication required"
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      const session = await auth.getSession({
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      
      if (!session) {
        return new Response(JSON.stringify({
          success: false,
          message: "Invalid or expired session"
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Check user type if specified
      if (userType && session.user.userType !== userType) {
        return new Response(JSON.stringify({
          success: false,
          message: "Access denied"
        }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      return session;
    },
    
    // Check specific permission
    checkPermission: async (
      session: any,
      resource: string,
      action: string,
      data?: any
    ) => {
      // Implement permission checking logic
      // This would integrate with Better Auth's access control
      return true; // Placeholder
    }
  };
}