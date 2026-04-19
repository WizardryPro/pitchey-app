/**
 * Better Auth Worker Integration
 * Handles all authentication routes and session management
 */

import { betterAuth } from "better-auth";
import { neon } from "@neondatabase/serverless";

// Environment type definition
interface AuthEnv {
  DATABASE_URL: string;
  JWT_SECRET: string;
  FRONTEND_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SENDGRID_API_KEY?: string;
  NODE_ENV?: string;
}

// Create Better Auth instance optimized for Cloudflare Workers
export function createAuth(env: AuthEnv) {
  const auth = betterAuth({
    appName: "Pitchey",
    baseURL: env.FRONTEND_URL || "https://pitchey.pages.dev",
    secret: env.JWT_SECRET,
    
    // Database configuration - use direct PostgreSQL connection
    database: {
      provider: "postgresql",
      url: env.DATABASE_URL,
      generateTables: true
    },

    // Email & Password authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Enable in production after email setup
      autoSignIn: true,
      password: {
        minLength: 6,
        maxLength: 128
      }
    },

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update if older than 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60 // Cache for 5 minutes
      }
    },

    // User fields matching your schema
    user: {
      additionalFields: {
        userType: {
          type: "string",
          required: true,
          input: true
        },
        firstName: {
          type: "string",
          required: false,
          input: true
        },
        lastName: {
          type: "string",
          required: false,
          input: true
        },
        companyName: {
          type: "string",
          required: false,
          input: true
        },
        profileImage: {
          type: "string",
          required: false,
          input: true
        },
        bio: {
          type: "string",
          required: false,
          input: true
        },
        verified: {
          type: "boolean",
          required: false,
          input: false
        },
        subscriptionTier: {
          type: "string",
          required: false,
          input: false,
          defaultValue: "basic"
        }
      }
    },

    // Advanced features plugins
    plugins: [],

    // Trusted origins
    trustedOrigins: [
      "https://pitchey.pages.dev",
      "https://pitchey-api-prod.ndlovucavelle.workers.dev",
      "https://pitchey-api-prod.ndlovucavelle.workers.dev",
      env.NODE_ENV === "development" ? "http://localhost:5173" : null,
      env.NODE_ENV === "development" ? "http://localhost:8001" : null,
    ].filter(Boolean) as string[],

    // CORS configuration
    cors: {
      origin: "*", // Will be restricted by trustedOrigins
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }
  });

  return auth;
}

// Portal-specific authentication handlers
export function createPortalHandlers(auth: ReturnType<typeof createAuth>) {
  return {
    // Creator portal login
    creatorLogin: async (email: string, password: string) => {
      try {
        const session = await auth.api.signInEmail({
          body: { email, password }
        });
        
        // Verify user type
        if (session.user.userType !== 'creator') {
          throw new Error('Invalid portal access - Creator portal only');
        }
        
        return {
          success: true,
          data: {
            user: session.user,
            session: session.session,
            token: session.session.token
          }
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || 'Authentication failed'
        };
      }
    },

    // Investor portal login
    investorLogin: async (email: string, password: string) => {
      try {
        const session = await auth.api.signInEmail({
          body: { email, password }
        });
        
        // Verify user type
        if (session.user.userType !== 'investor') {
          throw new Error('Invalid portal access - Investor portal only');
        }
        
        return {
          success: true,
          data: {
            user: session.user,
            session: session.session,
            token: session.session.token
          }
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || 'Authentication failed'
        };
      }
    },

    // Production portal login
    productionLogin: async (email: string, password: string) => {
      try {
        const session = await auth.api.signInEmail({
          body: { email, password }
        });
        
        // Verify user type
        if (session.user.userType !== 'production') {
          throw new Error('Invalid portal access - Production portal only');
        }
        
        return {
          success: true,
          data: {
            user: session.user,
            session: session.session,
            token: session.session.token
          }
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || 'Authentication failed'
        };
      }
    },

    // Portal-specific registration
    creatorRegister: async (data: any) => {
      try {
        const result = await auth.api.signUpEmail({
          body: {
            ...data,
            userType: 'creator'
          }
        });
        
        return {
          success: true,
          data: result
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || 'Registration failed'
        };
      }
    },

    investorRegister: async (data: any) => {
      try {
        const result = await auth.api.signUpEmail({
          body: {
            ...data,
            userType: 'investor'
          }
        });
        
        return {
          success: true,
          data: result
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || 'Registration failed'
        };
      }
    },

    productionRegister: async (data: any) => {
      try {
        const result = await auth.api.signUpEmail({
          body: {
            ...data,
            userType: 'production'
          }
        });
        
        return {
          success: true,
          data: result
        };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || 'Registration failed'
        };
      }
    }
  };
}

// Session verification middleware
export async function verifySession(
  request: Request, 
  auth: ReturnType<typeof createAuth>,
  requiredUserType?: string
) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        success: false,
        error: new Response(JSON.stringify({ 
          error: 'No authentication token provided' 
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      };
    }

    const token = authHeader.substring(7);
    
    // Verify session with Better Auth
    const session = await auth.api.getSession({
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    if (!session) {
      return {
        success: false,
        error: new Response(JSON.stringify({ 
          error: 'Invalid or expired session' 
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      };
    }

    // Check user type if required
    if (requiredUserType && session.user.userType !== requiredUserType) {
      return {
        success: false,
        error: new Response(JSON.stringify({ 
          error: `Access denied. ${requiredUserType} portal only.` 
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      };
    }

    return {
      success: true,
      user: session.user,
      session: session.session
    };
  } catch (error) {
    console.error('Session verification error:', error);
    return {
      success: false,
      error: new Response(JSON.stringify({ 
        error: 'Authentication error' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }
}

// Handle Better Auth routes
export async function handleAuthRoute(
  request: Request,
  pathname: string,
  env: AuthEnv
) {
  const auth = createAuth(env);
  const portalHandlers = createPortalHandlers(auth);
  
  // Portal-specific login endpoints (maintaining backward compatibility)
  if (pathname === '/api/auth/creator/login' && request.method === 'POST') {
    const body = await request.json();
    const result = await portalHandlers.creatorLogin(body.email, body.password);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (pathname === '/api/auth/investor/login' && request.method === 'POST') {
    const body = await request.json();
    const result = await portalHandlers.investorLogin(body.email, body.password);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (pathname === '/api/auth/production/login' && request.method === 'POST') {
    const body = await request.json();
    const result = await portalHandlers.productionLogin(body.email, body.password);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Portal-specific registration endpoints
  if (pathname === '/api/auth/creator/register' && request.method === 'POST') {
    const body = await request.json();
    const result = await portalHandlers.creatorRegister(body);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (pathname === '/api/auth/investor/register' && request.method === 'POST') {
    const body = await request.json();
    const result = await portalHandlers.investorRegister(body);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (pathname === '/api/auth/production/register' && request.method === 'POST') {
    const body = await request.json();
    const result = await portalHandlers.productionRegister(body);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Logout endpoint
  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    // Better Auth handles session invalidation
    return new Response(JSON.stringify({
      success: true,
      message: "Logout successful",
      data: {
        redirectUrl: "/login",
        timestamp: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Let Better Auth handle all other /api/auth routes
  if (pathname.startsWith('/api/auth')) {
    return auth.handler(request);
  }

  return null;
}