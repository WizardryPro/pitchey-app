// Production Security Configuration for Pitchey Platform
// This file contains all security-related configurations for production deployment

export interface SecurityConfig {
  cors: CorsConfig;
  headers: SecurityHeaders;
  rateLimit: RateLimitConfig;
  authentication: AuthConfig;
  encryption: EncryptionConfig;
  validation: ValidationConfig;
}

export interface CorsConfig {
  origin: string | string[] | RegExp;
  credentials: boolean;
  optionsSuccessStatus: number;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge: number;
}

export interface SecurityHeaders {
  contentSecurityPolicy: CSPConfig;
  strictTransportSecurity: HSTSConfig;
  xFrameOptions: string;
  xContentTypeOptions: string;
  referrerPolicy: string;
  permissionsPolicy: PermissionsPolicyConfig;
}

export interface CSPConfig {
  enabled: boolean;
  reportOnly: boolean;
  directives: Record<string, string[]>;
  reportUri?: string;
}

export interface HSTSConfig {
  enabled: boolean;
  maxAge: number;
  includeSubDomains: boolean;
  preload: boolean;
}

export interface PermissionsPolicyConfig {
  camera: string;
  microphone: string;
  geolocation: string;
  payment: string;
  usb: string;
}

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator: string;
  endpoints: Record<string, EndpointRateLimit>;
}

export interface EndpointRateLimit {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

export interface AuthConfig {
  jwt: JWTConfig;
  session: SessionConfig;
  password: PasswordConfig;
  twoFactor: TwoFactorConfig;
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
  algorithm: string;
  issuer: string;
  audience: string;
  clockTolerance: number;
}

export interface SessionConfig {
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  domain?: string;
  path: string;
}

export interface PasswordConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  hashRounds: number;
}

export interface TwoFactorConfig {
  enabled: boolean;
  issuer: string;
  window: number;
  step: number;
}

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  saltLength: number;
}

export interface ValidationConfig {
  email: EmailValidationConfig;
  file: FileValidationConfig;
  api: APIValidationConfig;
}

export interface EmailValidationConfig {
  maxLength: number;
  allowedDomains?: string[];
  blockedDomains?: string[];
  requireVerification: boolean;
}

export interface FileValidationConfig {
  maxSize: number;
  allowedTypes: string[];
  scanForMalware: boolean;
  maxFiles: number;
}

export interface APIValidationConfig {
  maxRequestSize: number;
  maxArrayLength: number;
  maxStringLength: number;
  sanitizeInput: boolean;
}

// Production Security Configuration
export const productionSecurityConfig: SecurityConfig = {
  cors: {
    origin: [
      'https://pitchey-5o8.pages.dev',
      'https://*.pitchey.com',
      /^https:\/\/.*\.pitchey\.com$/
    ],
    credentials: true,
    optionsSuccessStatus: 204,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'X-API-Key',
      'X-User-Type',
      'X-Request-ID'
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    maxAge: 86400 // 24 hours
  },

  headers: {
    contentSecurityPolicy: {
      enabled: true,
      reportOnly: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://cdn.jsdelivr.net',
          'https://unpkg.com',
          'https://js.stripe.com',
          'https://checkout.stripe.com',
          'https://challenges.cloudflare.com',
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com'
        ],
        'style-src': [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdn.jsdelivr.net'
        ],
        'font-src': [
          "'self'",
          'https://fonts.gstatic.com',
          'data:'
        ],
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          'https:',
          'https://uploads.pitchey.com',
          'https://cdn.pitchey.com',
          'https://www.google-analytics.com'
        ],
        'connect-src': [
          "'self'",
          'https://pitchey-api-prod.ndlovucavelle.workers.dev',
          'wss://pitchey-api-prod.ndlovucavelle.workers.dev',
          'https://pitchey-backend-fresh.deno.dev',
          'wss://pitchey-backend-fresh.deno.dev',
          'https://pitchey-backend-fresh-gwp8c4yfcnna.deno.dev',
          'wss://pitchey-backend-fresh-gwp8c4yfcnna.deno.dev',
          'https://api.stripe.com',
          'https://checkout.stripe.com',
          'https://www.google-analytics.com',
          'https://region1.google-analytics.com'
        ],
        'frame-src': [
          "'self'",
          'https://js.stripe.com',
          'https://checkout.stripe.com',
          'https://challenges.cloudflare.com'
        ],
        'media-src': [
          "'self'",
          'https://uploads.pitchey.com',
          'blob:'
        ],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': []
      },
      reportUri: '/api/security/csp-report'
    },

    strictTransportSecurity: {
      enabled: true,
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },

    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',

    permissionsPolicy: {
      camera: 'self',
      microphone: 'none',
      geolocation: 'none',
      payment: 'self',
      usb: 'none'
    }
  },

  rateLimit: {
    enabled: true,
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: 'ip',
    endpoints: {
      '/api/auth/login': {
        windowMs: 900000, // 15 minutes
        maxRequests: 5,
        message: 'Too many login attempts, please try again later'
      },
      '/api/auth/register': {
        windowMs: 3600000, // 1 hour
        maxRequests: 3,
        message: 'Too many registration attempts, please try again later'
      },
      '/api/auth/reset-password': {
        windowMs: 3600000, // 1 hour
        maxRequests: 3,
        message: 'Too many password reset attempts, please try again later'
      },
      '/api/pitches': {
        windowMs: 60000, // 1 minute
        maxRequests: 30
      },
      '/api/upload': {
        windowMs: 60000, // 1 minute
        maxRequests: 10,
        message: 'Too many upload attempts, please try again later'
      },
      '/api/search': {
        windowMs: 60000, // 1 minute
        maxRequests: 20
      },
      '/api/analytics': {
        windowMs: 60000, // 1 minute
        maxRequests: 50
      }
    }
  },

  authentication: {
    jwt: {
      secret: process.env.JWT_SECRET || '',
      expiresIn: '24h',
      refreshExpiresIn: '7d',
      algorithm: 'HS256',
      issuer: 'pitchey.com',
      audience: 'pitchey-users',
      clockTolerance: 60 // 1 minute
    },

    session: {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 86400000, // 24 hours
      domain: '.pitchey.com',
      path: '/'
    },

    password: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      preventCommonPasswords: true,
      hashRounds: 12
    },

    twoFactor: {
      enabled: false, // TODO: Implement 2FA
      issuer: 'Pitchey',
      window: 1,
      step: 30
    }
  },

  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    saltLength: 32
  },

  validation: {
    email: {
      maxLength: 254,
      allowedDomains: undefined, // Allow all domains
      blockedDomains: [
        '10minutemail.com',
        'guerrillamail.com',
        'mailinator.com',
        'tempmail.org'
      ],
      requireVerification: true
    },

    file: {
      maxSize: 52428800, // 50MB
      allowedTypes: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo'
      ],
      scanForMalware: false, // TODO: Implement malware scanning
      maxFiles: 10
    },

    api: {
      maxRequestSize: 10485760, // 10MB
      maxArrayLength: 1000,
      maxStringLength: 10000,
      sanitizeInput: true
    }
  }
};

// Security middleware configuration
export const securityMiddleware = {
  helmet: {
    contentSecurityPolicy: {
      directives: productionSecurityConfig.headers.contentSecurityPolicy.directives,
      reportOnly: productionSecurityConfig.headers.contentSecurityPolicy.reportOnly
    },
    hsts: {
      maxAge: productionSecurityConfig.headers.strictTransportSecurity.maxAge,
      includeSubDomains: productionSecurityConfig.headers.strictTransportSecurity.includeSubDomains,
      preload: productionSecurityConfig.headers.strictTransportSecurity.preload
    },
    frameguard: {
      action: 'deny'
    },
    noSniff: true,
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    permissionsPolicy: {
      features: productionSecurityConfig.headers.permissionsPolicy
    }
  }
};

// Environment-specific overrides
export const getSecurityConfig = (environment: string = 'production'): SecurityConfig => {
  switch (environment) {
    case 'development':
      return {
        ...productionSecurityConfig,
        cors: {
          ...productionSecurityConfig.cors,
          origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8001']
        },
        headers: {
          ...productionSecurityConfig.headers,
          contentSecurityPolicy: {
            ...productionSecurityConfig.headers.contentSecurityPolicy,
            reportOnly: true
          }
        },
        rateLimit: {
          ...productionSecurityConfig.rateLimit,
          enabled: false
        }
      };
    
    // 'staging' case removed 2026-04-20 (issue #27): the account has no staging
    // Pages project. Both `staging-pitchey.pages.dev` and `pitchey-staging.pages.dev`
    // were references to subdomains that don't resolve, and leaving them in the
    // config both lied about the environment topology and kept potential CORS
    // entries alive for names a third party could plausibly register. If a real
    // staging environment returns later, add the case back pointing at whatever
    // subdomain that env actually serves.
    default:
      return productionSecurityConfig;
  }
};

// Security validation functions
export const validateSecurityConfig = (config: SecurityConfig): boolean => {
  // Validate JWT secret
  if (!config.authentication.jwt.secret || config.authentication.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  // Validate CORS origins
  if (!config.cors.origin) {
    throw new Error('CORS origin must be configured');
  }

  // Validate rate limiting
  if (config.rateLimit.enabled && !config.rateLimit.maxRequests) {
    throw new Error('Rate limit max requests must be configured');
  }

  return true;
};

// Security audit logging
export const logSecurityEvent = (event: string, details: Record<string, any>, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    severity,
    details,
    environment: process.env.NODE_ENV || 'development'
  };

  console.log(`[SECURITY:${severity.toUpperCase()}] ${JSON.stringify(logEntry)}`);

  // In production, send to security monitoring service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with security monitoring service (e.g., Sentry, DataDog)
  }
};