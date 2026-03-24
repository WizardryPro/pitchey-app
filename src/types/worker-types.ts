/**
 * Type definitions for Unified Cloudflare Worker
 */

export interface SentryLogger {
  captureError(error: Error, context?: Record<string, any>): Promise<void>;
  captureMessage(message: string, level?: 'info' | 'warning' | 'error', context?: Record<string, any>): Promise<void>;
}

export interface Env {
  // Storage  
  CACHE?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  
  // Database - Hyperdrive provides optimized connection string
  HYPERDRIVE?: Hyperdrive;
  
  // Real-time
  WEBSOCKET_ROOM?: DurableObjectNamespace;
  
  // Configuration
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ORIGIN_URL?: string;
  
  // Error Tracking
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;

  // Video Processing & Webhooks
  VIDEO_PROCESSING_QUEUE?: Queue;
  N8N_WEBHOOK_URL?: string;
  BACKEND_URL?: string;

  // R2 Storage Buckets
  MEDIA_STORAGE?: R2Bucket;
  PITCH_STORAGE?: R2Bucket;
  NDA_STORAGE?: R2Bucket;
  PROCESSED_STORAGE?: R2Bucket;
  TEMP_STORAGE?: R2Bucket;
}

export interface DatabaseService {
  query(query: string, params?: any[]): Promise<any[]>;
  getUserByEmail(email: string): Promise<any | null>;
  getAllUsers(limit?: number): Promise<any[]>;
  testConnection(): Promise<boolean>;
  // Raw SQL client for tagged template queries
  sql?: (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;
  getSql?(): (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;
}

export interface User {
  id: number;
  email: string;
  userType: 'creator' | 'investor' | 'production';
  firstName: string;
  lastName: string;
  displayName: string;
  companyName?: string;
  bio?: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Pitch {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  budgetRange?: string;
  description?: string;
  viewCount: number;
  likeCount: number;
  status: 'draft' | 'published' | 'archived';
  creatorId: number;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthPayload {
  userId: number;
  email: string;
  userType: string;
  adminAccess?: boolean;
  iat: number;
  exp: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  source?: 'database' | 'demo' | 'cache';
  count?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RequestContext {
  path: string;
  method: string;
  url: string;
  userAgent?: string;
  referer?: string;
  userId?: number;
  userType?: string;
}