/**
 * Enhanced Chunked Upload Types
 * Comprehensive type definitions for chunked file upload system
 */

export interface ChunkMetadata {
  chunkIndex: number;
  chunkSize: number;
  totalChunks: number;
  startByte: number;
  endByte: number;
  checksum: string;
}

export interface ChunkedUploadSession {
  sessionId: string;
  uploadId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  status: 'initializing' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  metadata?: Record<string, any>;
}

export interface ChunkUploadResult {
  chunkIndex: number;
  etag: string;
  checksum: string;
  uploadedAt: string;
  success: boolean;
  error?: string;
  retryCount?: number;
}

export interface ChunkedUploadProgress {
  sessionId: string;
  uploadedBytes: number;
  totalBytes: number;
  uploadedChunks: number;
  totalChunks: number;
  percentage: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
  activeChunks: number;
  queuedChunks: number;
  failedChunks: number;
}

export interface ChunkUploadOptions {
  chunkSize: number; // Default 2MB for Cloudflare Workers
  maxConcurrentChunks: number; // Default 3
  maxRetries: number; // Default 3
  retryDelay: number; // Default 1000ms
  enableResume: boolean; // Default true
  enableChecksum: boolean; // Default true
  timeout: number; // Default 30000ms per chunk
  onProgress?: (progress: ChunkedUploadProgress) => void;
  onChunkComplete?: (chunk: ChunkUploadResult) => void;
  onChunkFailed?: (chunk: ChunkMetadata, error: string) => void;
  signal?: AbortSignal;
}

export interface UploadQueueItem {
  file: File;
  options: ChunkUploadOptions;
  priority: 'low' | 'normal' | 'high';
  category: 'document' | 'image' | 'video' | 'nda';
  metadata?: Record<string, any>;
  pitchId?: number;
  onComplete?: (result: CompletedUploadResult) => void;
  onError?: (error: UploadError) => void;
}

export interface CompletedUploadResult {
  sessionId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  duration: number; // Upload duration in ms
  averageSpeed: number; // Average upload speed in bytes/sec
  metadata?: Record<string, any>;
}

export interface UploadError {
  sessionId?: string;
  code: UploadErrorCode;
  message: string;
  details?: any;
  recoverable: boolean;
  retryAfter?: number;
}

export const UploadErrorCode = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  CHUNK_UPLOAD_FAILED: 'CHUNK_UPLOAD_FAILED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  CANCELLED: 'CANCELLED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR'
} as const;

export type UploadErrorCode = typeof UploadErrorCode[keyof typeof UploadErrorCode];

export interface ChunkedUploadConfig {
  maxFileSize: {
    document: number; // 100MB
    image: number; // 10MB
    video: number; // 500MB
    nda: number; // 50MB
  };
  chunkSize: {
    small: number; // 1MB for images
    medium: number; // 2MB default
    large: number; // 5MB for videos
  };
  maxConcurrentUploads: number;
  maxConcurrentChunks: number;
  retrySettings: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  sessionExpiry: number; // 24 hours in ms
  cleanupInterval: number; // 1 hour in ms
  supportedMimeTypes: {
    document: string[];
    image: string[];
    video: string[];
    nda: string[];
  };
}

export interface UploadQueueStats {
  totalItems: number;
  activeUploads: number;
  queuedUploads: number;
  completedUploads: number;
  failedUploads: number;
  totalUploadedBytes: number;
  averageUploadSpeed: number;
  estimatedQueueTime: number;
}

export interface ChunkProgressEvent {
  sessionId: string;
  chunkIndex: number;
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
}

export interface SessionResumeInfo {
  sessionId: string;
  uploadedChunks: number[];
  remainingChunks: number[];
  nextChunkIndex: number;
  canResume: boolean;
  reason?: string;
}

export interface R2MultipartUploadInfo {
  uploadId: string;
  key: string;
  parts: Array<{
    partNumber: number;
    etag: string;
  }>;
  metadata?: Record<string, any>;
}

// Event types for real-time updates
export interface ChunkedUploadEvents {
  'session:created': ChunkedUploadSession;
  'session:progress': ChunkedUploadProgress;
  'session:paused': { sessionId: string; reason?: string };
  'session:resumed': { sessionId: string };
  'session:completed': CompletedUploadResult;
  'session:failed': { sessionId: string; error: UploadError };
  'session:cancelled': { sessionId: string; reason?: string };
  'chunk:upload:start': { sessionId: string; chunk: ChunkMetadata };
  'chunk:upload:progress': ChunkProgressEvent;
  'chunk:upload:complete': { sessionId: string; chunk: ChunkUploadResult };
  'chunk:upload:failed': { sessionId: string; chunk: ChunkMetadata; error: string };
  'chunk:upload:retry': { sessionId: string; chunk: ChunkMetadata; attempt: number };
  'queue:added': { sessionId: string; position: number };
  'queue:started': { sessionId: string };
  'queue:stats': UploadQueueStats;
}

// Utility types for component props
export interface ChunkedFileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  category: 'document' | 'image' | 'video' | 'nda';
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onUploadStart?: (session: ChunkedUploadSession) => void;
  onUploadProgress?: (progress: ChunkedUploadProgress) => void;
  onUploadComplete?: (result: CompletedUploadResult) => void;
  onUploadError?: (error: UploadError) => void;
  onFilesSelected?: (files: File[]) => void;
  pitchId?: number;
  metadata?: Record<string, any>;
  uploadOptions?: Partial<ChunkUploadOptions>;
}

export interface ProgressBarProps {
  progress: ChunkedUploadProgress;
  showDetails?: boolean;
  showSpeed?: boolean;
  showETA?: boolean;
  compact?: boolean;
  className?: string;
}

export interface UploadQueueProps {
  maxVisible?: number;
  showCompleted?: boolean;
  allowCancel?: boolean;
  allowPause?: boolean;
  allowRetry?: boolean;
  onClearCompleted?: () => void;
  className?: string;
}

// Storage and persistence types
export interface UploadSessionStorage {
  sessions: Record<string, ChunkedUploadSession>;
  queue: string[]; // session IDs in upload order
  completed: string[];
  failed: string[];
  lastCleanup: string;
}

export interface PersistedChunkInfo {
  sessionId: string;
  chunkIndex: number;
  etag: string;
  checksum: string;
  uploadedAt: string;
}

// API Request/Response types
export interface InitChunkedUploadRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: 'document' | 'image' | 'video' | 'nda';
  chunkSize: number;
  metadata?: Record<string, any>;
  pitchId?: number;
  requireNDA?: boolean;
}

export interface InitChunkedUploadResponse {
  success: boolean;
  data?: {
    sessionId: string;
    uploadId: string;
    fileKey: string;
    totalChunks: number;
    expiresAt: string;
    resumeInfo?: SessionResumeInfo;
  };
  error?: string;
}

export interface UploadChunkRequest {
  sessionId: string;
  chunkIndex: number;
  checksum: string;
}

export interface UploadChunkResponse {
  success: boolean;
  data?: {
    chunkIndex: number;
    etag: string;
    checksum: string;
  };
  error?: string;
}

export interface CompleteChunkedUploadRequest {
  sessionId: string;
  chunks: Array<{
    chunkIndex: number;
    etag: string;
  }>;
}

export interface CompleteChunkedUploadResponse {
  success: boolean;
  data?: CompletedUploadResult;
  error?: string;
}

export interface AbortChunkedUploadRequest {
  sessionId: string;
  reason?: string;
}

export interface GetUploadSessionRequest {
  sessionId: string;
}

export interface GetUploadSessionResponse {
  success: boolean;
  data?: {
    session: ChunkedUploadSession;
    resumeInfo: SessionResumeInfo;
  };
  error?: string;
}