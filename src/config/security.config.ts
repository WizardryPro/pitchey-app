// Security configuration for Pitchey platform
// OWASP compliant security settings

export const securityConfig = {
  // JWT Configuration
  jwt: {
    algorithm: "HS256" as const,
    expiresIn: "2h", // Short-lived access tokens
    refreshExpiresIn: "7d", // Refresh token expiration
    issuer: "pitchey.com",
    audience: "pitchey-api",
  },

  // CORS Configuration - Restrict to specific origins
  cors: {
    allowedOrigins: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:8000",
      // Add production domains when ready
      // "https://app.pitchey.com",
      // "https://www.pitchey.com"
    ],
    allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
      "X-CSRF-Token",
      "X-Request-ID",
    ],
    exposedHeaders: ["X-Request-ID", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    credentials: true,
    maxAge: 3600, // 1 hour preflight cache
  },

  // Security Headers
  securityHeaders: {
    // Content Security Policy
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com wss://localhost:* ws://localhost:*",
      "frame-src https://js.stripe.com https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
    
    // Strict Transport Security (HSTS)
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    
    // Prevent clickjacking
    "X-Frame-Options": "DENY",
    
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    
    // XSS Protection (legacy browsers)
    "X-XSS-Protection": "1; mode=block",
    
    // Referrer Policy
    "Referrer-Policy": "strict-origin-when-cross-origin",
    
    // Permissions Policy
    "Permissions-Policy": [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=(self)",
      "usb=()",
    ].join(", "),
  },

  // Rate Limiting Configuration
  rateLimit: {
    // Authentication endpoints - strict limits
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 attempts per window
      message: "Too many authentication attempts, please try again later",
      skipSuccessfulRequests: false,
    },
    
    // Password reset - very strict
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
      message: "Too many password reset requests, please try again later",
    },
    
    // API endpoints - standard limits
    api: {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 100, // 100 requests per minute
      message: "Too many requests, please slow down",
    },
    
    // File upload - restricted
    upload: {
      windowMs: 10 * 60 * 1000, // 10 minutes
      maxRequests: 10,
      message: "Too many upload attempts, please try again later",
    },
  },

  // Password Policy
  passwordPolicy: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: "!@#$%^&*()_+-=[]{}|;:,.<>?",
    preventCommonPasswords: true,
    preventUserInfoInPassword: true,
    maxConsecutiveChars: 3,
    passwordHistory: 5, // Remember last 5 passwords
  },

  // Session Configuration
  session: {
    name: "pitchey-session",
    secret: Deno.env.get("SESSION_SECRET") || crypto.randomUUID(),
    duration: 2 * 60 * 60 * 1000, // 2 hours
    activeDuration: 30 * 60 * 1000, // Extend session by 30 minutes on activity
    cookie: {
      httpOnly: true,
      secure: Deno.env.get("DENO_ENV") === "production",
      sameSite: "strict" as const,
      maxAge: 2 * 60 * 60 * 1000,
    },
  },

  // Input Validation Rules
  validation: {
    email: {
      maxLength: 254,
      pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    },
    username: {
      minLength: 3,
      maxLength: 30,
      pattern: /^[a-zA-Z0-9_-]+$/,
    },
    text: {
      maxLength: 10000,
      // Patterns to block potential XSS
      dangerousPatterns: [
        /<script[\s\S]*?<\/script>/gi,
        /<iframe[\s\S]*?<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi, // Event handlers
        /<embed[\s\S]*?>/gi,
        /<object[\s\S]*?>/gi,
      ],
    },
    file: {
      maxSize: 50 * 1024 * 1024, // 50MB
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "video/mp4",
        "video/quicktime",
      ],
      allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".mp4", ".mov"],
    },
  },

  // Cryptography Settings
  crypto: {
    saltRounds: 12, // For bcrypt
    tokenLength: 32, // For random tokens
  },

  // Request Timeout
  requestTimeout: 30000, // 30 seconds

  // Max Request Body Size
  maxBodySize: "10mb",
};

// Helper function to get CORS headers based on origin
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": securityConfig.cors.allowedMethods.join(", "),
    "Access-Control-Allow-Headers": securityConfig.cors.allowedHeaders.join(", "),
    "Access-Control-Expose-Headers": securityConfig.cors.exposedHeaders.join(", "),
    "Access-Control-Max-Age": securityConfig.cors.maxAge.toString(),
  };

  // Check if origin is allowed
  if (origin && securityConfig.cors.allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else if (Deno.env.get("DENO_ENV") === "development") {
    // In development, be more permissive but log the warning
    headers["Access-Control-Allow-Origin"] = origin || "*";
    console.warn(`CORS: Allowing origin ${origin} in development mode`);
  }

  return headers;
}

// Get all security headers
export function getSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = { ...securityConfig.securityHeaders };
  
  // In development, relax CSP slightly
  if (Deno.env.get("DENO_ENV") === "development") {
    headers["Content-Security-Policy"] = headers["Content-Security-Policy"]
      .replace("'unsafe-inline'", "'unsafe-inline' 'unsafe-eval'");
    delete (headers as any)["Strict-Transport-Security"]; // Don't force HTTPS in dev
  }
  
  return headers;
}