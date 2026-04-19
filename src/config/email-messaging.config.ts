/**
 * Centralized Configuration for Email and Messaging Services
 * 
 * This file provides centralized configuration management for all email and messaging
 * services including validation, defaults, and environment-specific settings.
 */

/**
 * Environment variable validation and type checking
 */
export interface EmailMessagingEnvironment {
  // Core Application
  ENVIRONMENT: 'development' | 'staging' | 'production';
  FRONTEND_URL: string;
  DEBUG_MODE?: string;

  // Database
  DATABASE_URL: string;
  
  // Redis
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  
  // Authentication
  BETTER_AUTH_SECRET: string;
  JWT_SECRET?: string; // Legacy compatibility
  
  // Email Service - SendGrid (Primary)
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM_EMAIL?: string;
  SENDGRID_FROM_NAME?: string;
  
  // Email Service - AWS SES (Fallback)
  AWS_SES_ACCESS_KEY?: string;
  AWS_SES_SECRET_KEY?: string;
  AWS_SES_REGION?: string;
  AWS_SES_FROM_EMAIL?: string;
  AWS_SES_FROM_NAME?: string;
  
  // Email Configuration
  EMAIL_PRIMARY_PROVIDER?: string;
  EMAIL_RATE_LIMIT_MINUTE?: string;
  EMAIL_RATE_LIMIT_HOUR?: string;
  EMAIL_RATE_LIMIT_DAY?: string;
  EMAIL_MAX_RETRIES?: string;
  EMAIL_RETRY_DELAY?: string;
  EMAIL_RETRY_MAX_DELAY?: string;
  EMAIL_QUEUE_CONCURRENT?: string;
  EMAIL_QUEUE_INTERVAL?: string;
  EMAIL_BATCH_SIZE?: string;
  ENABLE_EMAIL_TEMPLATE_CACHE?: string;
  
  // WebSocket Configuration
  WS_HEARTBEAT_INTERVAL?: string;
  WS_CONNECTION_TIMEOUT?: string;
  WS_MAX_CONNECTIONS?: string;
  
  // File Upload Configuration
  MAX_FILE_SIZE?: string;
  ALLOWED_FILE_TYPES?: string;
  
  // Encryption
  ENABLE_E2E_ENCRYPTION?: string;
  
  // Notification Service
  NOTIFICATION_PROCESSING_INTERVAL?: string;
  NOTIFICATION_BATCH_SIZE?: string;
  NOTIFICATION_MAX_RETRIES?: string;
  NOTIFICATION_QUEUE_TTL?: string;
  MESSAGE_BATCH_SIZE?: string;
  MESSAGE_BATCH_TIMEOUT?: string;
  ENABLE_MESSAGE_CACHE?: string;
  
  // Push Notifications (Future)
  FCM_SERVER_KEY?: string;
  APNS_CERTIFICATE_PATH?: string;
  APNS_KEY_ID?: string;
  APNS_TEAM_ID?: string;
  
  // SMS Configuration (Future)
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  
  // Monitoring
  SENTRY_DSN?: string;
  
  // Feature Flags
  ENABLE_EMAIL_SERVICE?: string;
  ENABLE_MESSAGING_SERVICE?: string;
  ENABLE_NOTIFICATION_SERVICE?: string;
  ENABLE_PUSH_NOTIFICATIONS?: string;
  ENABLE_SMS_NOTIFICATIONS?: string;
}

/**
 * Email Service Configuration
 */
export interface EmailServiceConfig {
  enabled: boolean;
  providers: {
    sendgrid?: {
      apiKey: string;
      fromEmail: string;
      fromName: string;
    };
    awsSes?: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
      fromEmail: string;
      fromName: string;
    };
  };
  defaultProvider: 'sendgrid' | 'awsSes';
  rateLimits: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  retryConfig: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
  };
  queueConfig: {
    maxConcurrent: number;
    processingInterval: number;
  };
  batchConfig: {
    batchSize: number;
    batchTimeout: number;
  };
  cacheConfig: {
    enableTemplateCache: boolean;
    templateCacheTTL: number;
  };
}

/**
 * Messaging Service Configuration
 */
export interface MessagingServiceConfig {
  enabled: boolean;
  websocket: {
    heartbeatInterval: number;
    connectionTimeout: number;
    maxConnections: number;
  };
  fileUpload: {
    maxFileSize: number;
    allowedTypes: string[];
    virusScanEnabled: boolean;
  };
  encryption: {
    enableE2E: boolean;
    keyRotationInterval: number;
  };
  caching: {
    enableMessageCache: boolean;
    messageCacheTTL: number;
    enableTypingIndicators: boolean;
    typingIndicatorTTL: number;
  };
  batching: {
    batchSize: number;
    batchTimeout: number;
  };
}

/**
 * Notification Service Configuration
 */
export interface NotificationServiceConfig {
  enabled: boolean;
  processing: {
    interval: number;
    batchSize: number;
    maxRetries: number;
    queueTTL: number;
  };
  channels: {
    email: boolean;
    push: boolean;
    sms: boolean;
    inApp: boolean;
  };
  defaults: {
    digestFrequency: 'instant' | 'hourly' | 'daily' | 'weekly';
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
  };
  push: {
    fcmServerKey?: string;
    apnsCertPath?: string;
    apnsKeyId?: string;
    apnsTeamId?: string;
  };
  sms: {
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
  };
}

/**
 * Master Configuration Interface
 */
export interface EmailMessagingConfig {
  environment: 'development' | 'staging' | 'production';
  debug: boolean;
  database: {
    url: string;
    connectionPool: {
      min: number;
      max: number;
      idleTimeoutMillis: number;
    };
  };
  redis: {
    url: string;
    token: string;
    keyPrefix: string;
    defaultTTL: number;
  };
  email: EmailServiceConfig;
  messaging: MessagingServiceConfig;
  notifications: NotificationServiceConfig;
  security: {
    authSecret: string;
    jwtSecret?: string;
    corsOrigins: string[];
    rateLimiting: {
      windowMs: number;
      maxRequests: number;
    };
  };
  monitoring: {
    sentryDsn?: string;
    enableMetrics: boolean;
    enableTracing: boolean;
  };
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  EMAIL: {
    RATE_LIMIT_MINUTE: 50,
    RATE_LIMIT_HOUR: 1000,
    RATE_LIMIT_DAY: 10000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    RETRY_MAX_DELAY: 30000,
    QUEUE_CONCURRENT: 5,
    QUEUE_INTERVAL: 10000,
    BATCH_SIZE: 20,
    TEMPLATE_CACHE_TTL: 3600, // 1 hour
  },
  WEBSOCKET: {
    HEARTBEAT_INTERVAL: 30000,
    CONNECTION_TIMEOUT: 60000,
    MAX_CONNECTIONS: 1000,
  },
  FILE_UPLOAD: {
    MAX_FILE_SIZE: 10485760, // 10MB
    ALLOWED_FILE_TYPES: 'pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,gif,mp4,mov,avi',
  },
  NOTIFICATION: {
    PROCESSING_INTERVAL: 5000,
    BATCH_SIZE: 10,
    MAX_RETRIES: 3,
    QUEUE_TTL: 86400, // 24 hours
  },
  MESSAGE: {
    BATCH_SIZE: 10,
    BATCH_TIMEOUT: 100,
    CACHE_TTL: 300, // 5 minutes
  },
  DATABASE: {
    CONNECTION_POOL_MIN: 2,
    CONNECTION_POOL_MAX: 10,
    IDLE_TIMEOUT: 30000,
  },
  REDIS: {
    KEY_PREFIX: 'pitchey:',
    DEFAULT_TTL: 3600,
  },
  SECURITY: {
    RATE_LIMIT_WINDOW: 60000, // 1 minute
    RATE_LIMIT_MAX: 100,
  },
} as const;

/**
 * Environment variable validation
 */
function validateEnvironment(env: any): EmailMessagingEnvironment {
  const errors: string[] = [];
  
  // Required variables
  const required = [
    'DATABASE_URL',
    'UPSTASH_REDIS_REST_URL', 
    'UPSTASH_REDIS_REST_TOKEN',
    'BETTER_AUTH_SECRET'
  ];
  
  for (const key of required) {
    if (!env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }
  
  // Email provider validation
  const hasSendGrid = env.SENDGRID_API_KEY;
  const hasAwsSes = env.AWS_SES_ACCESS_KEY && env.AWS_SES_SECRET_KEY;
  
  if (!hasSendGrid && !hasAwsSes) {
    errors.push('At least one email provider must be configured (SendGrid or AWS SES)');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
  
  return env as EmailMessagingEnvironment;
}

/**
 * Parse boolean from string with default
 */
function parseBool(value: string | undefined, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Parse integer from string with default
 */
function parseInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse array from comma-separated string
 */
function parseArray(value: string | undefined, defaultValue: string[] = []): string[] {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * Create Email Service Configuration
 */
function createEmailConfig(env: EmailMessagingEnvironment): EmailServiceConfig {
  const providers: EmailServiceConfig['providers'] = {};
  
  if (env.SENDGRID_API_KEY) {
    providers.sendgrid = {
      apiKey: env.SENDGRID_API_KEY,
      fromEmail: env.SENDGRID_FROM_EMAIL || 'noreply@pitchey.com',
      fromName: env.SENDGRID_FROM_NAME || 'Pitchey',
    };
  }
  
  if (env.AWS_SES_ACCESS_KEY && env.AWS_SES_SECRET_KEY) {
    providers.awsSes = {
      accessKeyId: env.AWS_SES_ACCESS_KEY,
      secretAccessKey: env.AWS_SES_SECRET_KEY,
      region: env.AWS_SES_REGION || 'us-east-1',
      fromEmail: env.AWS_SES_FROM_EMAIL || 'noreply@pitchey.com',
      fromName: env.AWS_SES_FROM_NAME || 'Pitchey',
    };
  }
  
  const defaultProvider = (env.EMAIL_PRIMARY_PROVIDER as 'sendgrid' | 'awsSes') || 
    (providers.sendgrid ? 'sendgrid' : 'awsSes');
  
  return {
    enabled: parseBool(env.ENABLE_EMAIL_SERVICE, true),
    providers,
    defaultProvider,
    rateLimits: {
      perMinute: parseInt(env.EMAIL_RATE_LIMIT_MINUTE, DEFAULT_CONFIG.EMAIL.RATE_LIMIT_MINUTE),
      perHour: parseInt(env.EMAIL_RATE_LIMIT_HOUR, DEFAULT_CONFIG.EMAIL.RATE_LIMIT_HOUR),
      perDay: parseInt(env.EMAIL_RATE_LIMIT_DAY, DEFAULT_CONFIG.EMAIL.RATE_LIMIT_DAY),
    },
    retryConfig: {
      maxRetries: parseInt(env.EMAIL_MAX_RETRIES, DEFAULT_CONFIG.EMAIL.MAX_RETRIES),
      initialDelay: parseInt(env.EMAIL_RETRY_DELAY, DEFAULT_CONFIG.EMAIL.RETRY_DELAY),
      maxDelay: parseInt(env.EMAIL_RETRY_MAX_DELAY, DEFAULT_CONFIG.EMAIL.RETRY_MAX_DELAY),
    },
    queueConfig: {
      maxConcurrent: parseInt(env.EMAIL_QUEUE_CONCURRENT, DEFAULT_CONFIG.EMAIL.QUEUE_CONCURRENT),
      processingInterval: parseInt(env.EMAIL_QUEUE_INTERVAL, DEFAULT_CONFIG.EMAIL.QUEUE_INTERVAL),
    },
    batchConfig: {
      batchSize: parseInt(env.EMAIL_BATCH_SIZE, DEFAULT_CONFIG.EMAIL.BATCH_SIZE),
      batchTimeout: 1000, // 1 second
    },
    cacheConfig: {
      enableTemplateCache: parseBool(env.ENABLE_EMAIL_TEMPLATE_CACHE, true),
      templateCacheTTL: DEFAULT_CONFIG.EMAIL.TEMPLATE_CACHE_TTL,
    },
  };
}

/**
 * Create Messaging Service Configuration
 */
function createMessagingConfig(env: EmailMessagingEnvironment): MessagingServiceConfig {
  return {
    enabled: parseBool(env.ENABLE_MESSAGING_SERVICE, true),
    websocket: {
      heartbeatInterval: parseInt(env.WS_HEARTBEAT_INTERVAL, DEFAULT_CONFIG.WEBSOCKET.HEARTBEAT_INTERVAL),
      connectionTimeout: parseInt(env.WS_CONNECTION_TIMEOUT, DEFAULT_CONFIG.WEBSOCKET.CONNECTION_TIMEOUT),
      maxConnections: parseInt(env.WS_MAX_CONNECTIONS, DEFAULT_CONFIG.WEBSOCKET.MAX_CONNECTIONS),
    },
    fileUpload: {
      maxFileSize: parseInt(env.MAX_FILE_SIZE, DEFAULT_CONFIG.FILE_UPLOAD.MAX_FILE_SIZE),
      allowedTypes: parseArray(env.ALLOWED_FILE_TYPES, DEFAULT_CONFIG.FILE_UPLOAD.ALLOWED_FILE_TYPES.split(',')),
      virusScanEnabled: env.ENVIRONMENT === 'production',
    },
    encryption: {
      enableE2E: parseBool(env.ENABLE_E2E_ENCRYPTION, true),
      keyRotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
    caching: {
      enableMessageCache: parseBool(env.ENABLE_MESSAGE_CACHE, true),
      messageCacheTTL: DEFAULT_CONFIG.MESSAGE.CACHE_TTL,
      enableTypingIndicators: true,
      typingIndicatorTTL: 10, // 10 seconds
    },
    batching: {
      batchSize: parseInt(env.MESSAGE_BATCH_SIZE, DEFAULT_CONFIG.MESSAGE.BATCH_SIZE),
      batchTimeout: parseInt(env.MESSAGE_BATCH_TIMEOUT, DEFAULT_CONFIG.MESSAGE.BATCH_TIMEOUT),
    },
  };
}

/**
 * Create Notification Service Configuration
 */
function createNotificationConfig(env: EmailMessagingEnvironment): NotificationServiceConfig {
  return {
    enabled: parseBool(env.ENABLE_NOTIFICATION_SERVICE, true),
    processing: {
      interval: parseInt(env.NOTIFICATION_PROCESSING_INTERVAL, DEFAULT_CONFIG.NOTIFICATION.PROCESSING_INTERVAL),
      batchSize: parseInt(env.NOTIFICATION_BATCH_SIZE, DEFAULT_CONFIG.NOTIFICATION.BATCH_SIZE),
      maxRetries: parseInt(env.NOTIFICATION_MAX_RETRIES, DEFAULT_CONFIG.NOTIFICATION.MAX_RETRIES),
      queueTTL: parseInt(env.NOTIFICATION_QUEUE_TTL, DEFAULT_CONFIG.NOTIFICATION.QUEUE_TTL),
    },
    channels: {
      email: true,
      push: parseBool(env.ENABLE_PUSH_NOTIFICATIONS, false),
      sms: parseBool(env.ENABLE_SMS_NOTIFICATIONS, false),
      inApp: true,
    },
    defaults: {
      digestFrequency: 'instant',
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    },
    push: {
      fcmServerKey: env.FCM_SERVER_KEY,
      apnsCertPath: env.APNS_CERTIFICATE_PATH,
      apnsKeyId: env.APNS_KEY_ID,
      apnsTeamId: env.APNS_TEAM_ID,
    },
    sms: {
      twilioAccountSid: env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: env.TWILIO_AUTH_TOKEN,
      twilioFromNumber: env.TWILIO_FROM_NUMBER,
    },
  };
}

/**
 * Main configuration factory function
 */
export function createEmailMessagingConfig(env: any): EmailMessagingConfig {
  // Validate environment
  const validatedEnv = validateEnvironment(env);
  
  return {
    environment: validatedEnv.ENVIRONMENT || 'development',
    debug: parseBool(validatedEnv.DEBUG_MODE, validatedEnv.ENVIRONMENT !== 'production'),
    database: {
      url: validatedEnv.DATABASE_URL,
      connectionPool: {
        min: DEFAULT_CONFIG.DATABASE.CONNECTION_POOL_MIN,
        max: DEFAULT_CONFIG.DATABASE.CONNECTION_POOL_MAX,
        idleTimeoutMillis: DEFAULT_CONFIG.DATABASE.IDLE_TIMEOUT,
      },
    },
    redis: {
      url: validatedEnv.UPSTASH_REDIS_REST_URL,
      token: validatedEnv.UPSTASH_REDIS_REST_TOKEN,
      keyPrefix: DEFAULT_CONFIG.REDIS.KEY_PREFIX,
      defaultTTL: DEFAULT_CONFIG.REDIS.DEFAULT_TTL,
    },
    email: createEmailConfig(validatedEnv),
    messaging: createMessagingConfig(validatedEnv),
    notifications: createNotificationConfig(validatedEnv),
    security: {
      authSecret: validatedEnv.BETTER_AUTH_SECRET,
      jwtSecret: validatedEnv.JWT_SECRET,
      corsOrigins: [
        validatedEnv.FRONTEND_URL || 'https://pitchey.pages.dev',
        'https://localhost:3000',
        'http://localhost:5173',
      ],
      rateLimiting: {
        windowMs: DEFAULT_CONFIG.SECURITY.RATE_LIMIT_WINDOW,
        maxRequests: DEFAULT_CONFIG.SECURITY.RATE_LIMIT_MAX,
      },
    },
    monitoring: {
      sentryDsn: validatedEnv.SENTRY_DSN,
      enableMetrics: validatedEnv.ENVIRONMENT === 'production',
      enableTracing: validatedEnv.ENVIRONMENT !== 'production',
    },
  };
}

/**
 * Feature flag helper functions
 */
export class FeatureFlags {
  constructor(private config: EmailMessagingConfig) {}
  
  isEmailEnabled(): boolean {
    return this.config.email.enabled;
  }
  
  isMessagingEnabled(): boolean {
    return this.config.messaging.enabled;
  }
  
  isNotificationEnabled(): boolean {
    return this.config.notifications.enabled;
  }
  
  isPushNotificationEnabled(): boolean {
    return this.config.notifications.channels.push;
  }
  
  isSMSEnabled(): boolean {
    return this.config.notifications.channels.sms;
  }
  
  isE2EEncryptionEnabled(): boolean {
    return this.config.messaging.encryption.enableE2E;
  }
  
  isDebugMode(): boolean {
    return this.config.debug;
  }
  
  isProduction(): boolean {
    return this.config.environment === 'production';
  }
}

/**
 * Configuration validation helpers
 */
export class ConfigValidator {
  /**
   * Validate email provider configuration
   */
  static validateEmailProviders(config: EmailServiceConfig): void {
    const providers = Object.keys(config.providers);
    if (providers.length === 0) {
      throw new Error('At least one email provider must be configured');
    }
    
    if (!config.providers[config.defaultProvider]) {
      throw new Error(`Default email provider '${config.defaultProvider}' is not configured`);
    }
  }
  
  /**
   * Validate database configuration
   */
  static validateDatabase(config: EmailMessagingConfig): void {
    if (!config.database.url) {
      throw new Error('Database URL is required');
    }
    
    if (!config.database.url.startsWith('postgresql://')) {
      throw new Error('Database URL must be a PostgreSQL connection string');
    }
  }
  
  /**
   * Validate Redis configuration
   */
  static validateRedis(config: EmailMessagingConfig): void {
    if (!config.redis.url || !config.redis.token) {
      throw new Error('Redis URL and token are required');
    }
    
    if (!config.redis.url.startsWith('https://')) {
      throw new Error('Redis URL must be a valid HTTPS URL');
    }
  }
  
  /**
   * Validate all configuration
   */
  static validateAll(config: EmailMessagingConfig): void {
    this.validateDatabase(config);
    this.validateRedis(config);
    
    if (config.email.enabled) {
      this.validateEmailProviders(config.email);
    }
  }
}

/**
 * Export singleton configuration instance
 */
let configInstance: EmailMessagingConfig | null = null;

export function getEmailMessagingConfig(env?: any): EmailMessagingConfig {
  if (!configInstance) {
    if (!env) {
      throw new Error('Environment must be provided for initial configuration');
    }
    configInstance = createEmailMessagingConfig(env);
    ConfigValidator.validateAll(configInstance);
  }
  return configInstance;
}

/**
 * Reset configuration instance (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

/**
 * Export type definitions for external use
 */
export type {
  EmailMessagingEnvironment,
  EmailServiceConfig,
  MessagingServiceConfig,
  NotificationServiceConfig,
  EmailMessagingConfig,
};

/**
 * Export default configuration constants
 */
export { DEFAULT_CONFIG };