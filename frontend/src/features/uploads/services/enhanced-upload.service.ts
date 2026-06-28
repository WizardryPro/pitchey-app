import { uploadService, UploadResult, UploadOptions } from './upload.service';

const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:8001' : '');

export interface EnhancedUploadOptions extends UploadOptions {
  // R2-specific optimizations
  enableMultipart?: boolean;
  enableDeduplication?: boolean;
  enableCompression?: boolean;
  generateThumbnails?: boolean;
  customMetadata?: Record<string, string>;
  
  // Upload strategy
  strategy?: 'direct' | 'presigned' | 'multipart';
  chunkSize?: number; // For multipart uploads
  
  // Quality optimizations
  imageQuality?: number; // 0-100 for JPEG compression
  enableWebP?: boolean; // Convert images to WebP
  enableProgressive?: boolean; // Progressive JPEG
  
  // Analytics and tracking
  trackAnalytics?: boolean;
  userId?: number;
  sessionId?: string;
  
  // Advanced features
  enableVirusScan?: boolean;
  enableWatermark?: boolean;
  watermarkText?: string;
  
  // Folder organization
  autoOrganize?: boolean;
  dateBasedFolder?: boolean;
  userBasedFolder?: boolean;
}

export interface EnhancedUploadResult extends UploadResult {
  // Additional R2 metadata
  r2Key: string;
  cdnUrl: string;
  thumbnailUrl?: string;
  webpUrl?: string;
  compressionRatio?: number;
  
  // File analysis
  isOptimized: boolean;
  originalSize: number;
  optimizedSize: number;
  
  // Security
  virusScanResult?: 'clean' | 'infected' | 'pending';
  contentHash: string;
  
  // Performance metrics
  uploadDuration: number;
  transferSpeed: number;
  
  // Storage details
  storageLocation: string;
  replicationStatus: 'pending' | 'replicated' | 'failed';
}

export interface BatchUploadProgress {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  currentFile: string;
  overallProgress: number;
  estimatedTimeRemaining: number;
  transferSpeed: number;
}

export interface UploadAnalytics {
  uploadId: string;
  userId?: number;
  sessionId?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadDuration: number;
  transferSpeed: number;
  compressionRatio?: number;
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
  userAgent: string;
  ipAddress?: string;
}

class EnhancedUploadService {
  private baseUrl: string;
  private uploadAnalytics: UploadAnalytics[] = [];
  private activeUploads: Map<string, AbortController> = new Map();
  
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Enhanced single file upload with R2 optimizations
   */
  async uploadFileEnhanced(
    file: File,
    folder: string = 'uploads',
    options: EnhancedUploadOptions = {}
  ): Promise<EnhancedUploadResult> {
    const startTime = Date.now();
    const uploadId = crypto.randomUUID();
    
    // Default options with R2 optimizations
    const enhancedOptions: EnhancedUploadOptions = {
      enableMultipart: file.size > 100 * 1024 * 1024, // 100MB threshold
      enableDeduplication: true,
      enableCompression: file.type.startsWith('image/'),
      generateThumbnails: file.type.startsWith('image/') || file.type.startsWith('video/'),
      strategy: 'presigned',
      chunkSize: 10 * 1024 * 1024, // 10MB chunks
      imageQuality: 85,
      enableWebP: true,
      trackAnalytics: true,
      autoOrganize: true,
      dateBasedFolder: true,
      ...options
    };

    try {
      // Pre-process file if needed
      const processedFile = await this.preprocessFile(file, enhancedOptions);
      
      // Check for deduplication
      if (enhancedOptions.enableDeduplication) {
        const existingFile = await this.checkDuplication(processedFile);
        if (existingFile) {
          return this.createDeduplicatedResult(existingFile, startTime);
        }
      }

      // Determine upload strategy
      let result: UploadResult;
      
      if (enhancedOptions.enableMultipart && processedFile.size > (enhancedOptions.chunkSize || 10 * 1024 * 1024)) {
        result = await this.uploadMultipart(processedFile, folder, enhancedOptions);
      } else if (enhancedOptions.strategy === 'presigned') {
        result = await this.uploadPresigned(processedFile, folder, enhancedOptions);
      } else {
        result = await this.uploadDirect(processedFile, folder, enhancedOptions);
      }

      // Post-process and generate additional assets
      const enhancedResult = await this.postProcessUpload(result, processedFile, enhancedOptions);
      
      // Track analytics
      if (enhancedOptions.trackAnalytics) {
        await this.trackUploadAnalytics(uploadId, processedFile, enhancedResult, startTime, enhancedOptions);
      }

      return enhancedResult;

    } catch (error: any) {
      // Track failed upload
      if (enhancedOptions.trackAnalytics) {
        await this.trackUploadError(uploadId, file, error, startTime, enhancedOptions);
      }
      
      throw error;
    }
  }

  /**
   * Enhanced batch upload with optimized concurrency and progress tracking
   */
  async uploadBatchEnhanced(
    files: File[],
    folder: string = 'uploads',
    options: EnhancedUploadOptions & {
      maxConcurrency?: number;
      onBatchProgress?: (progress: BatchUploadProgress) => void;
      onFileComplete?: (file: File, result: EnhancedUploadResult) => void;
      onFileError?: (file: File, error: Error) => void;
      failureStrategy?: 'stop' | 'continue' | 'retry';
    } = {}
  ): Promise<{
    successful: EnhancedUploadResult[];
    failed: Array<{ file: File; error: Error }>;
    analytics: BatchUploadProgress;
  }> {
    const startTime = Date.now();
    const maxConcurrency = options.maxConcurrency || 3;
    const failureStrategy = options.failureStrategy || 'continue';
    
    const successful: EnhancedUploadResult[] = [];
    const failed: Array<{ file: File; error: Error }> = [];
    const queue = [...files];
    const activeUploads = new Set<Promise<void>>();

    let completedCount = 0;
    let transferredBytes = 0;
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

    const updateProgress = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress: BatchUploadProgress = {
        totalFiles: files.length,
        completedFiles: completedCount,
        failedFiles: failed.length,
        currentFile: queue.length > 0 ? queue[0].name : '',
        overallProgress: Math.round((completedCount / files.length) * 100),
        estimatedTimeRemaining: elapsed > 0 ? ((files.length - completedCount) * elapsed) / completedCount : 0,
        transferSpeed: transferredBytes / elapsed
      };
      
      options.onBatchProgress?.(progress);
    };

    while (queue.length > 0 || activeUploads.size > 0) {
      // Start new uploads up to concurrency limit
      while (queue.length > 0 && activeUploads.size < maxConcurrency) {
        const file = queue.shift()!;
        
        const uploadPromise = this.uploadFileEnhanced(file, folder, {
          ...options,
          onProgress: (progress) => {
            // Individual file progress contributes to batch progress
            transferredBytes = successful.reduce((sum, r) => sum + r.originalSize, 0) + 
                              (progress.loaded || 0);
            updateProgress();
          }
        }).then(result => {
          successful.push(result);
          completedCount++;
          transferredBytes += file.size;
          options.onFileComplete?.(file, result);
          updateProgress();
        }).catch(error => {
          failed.push({ file, error });
          completedCount++;
          options.onFileError?.(file, error);
          updateProgress();
          
          if (failureStrategy === 'stop') {
            // Cancel remaining uploads
            this.cancelAllActiveUploads();
            throw error;
          }
        }).finally(() => {
          activeUploads.delete(uploadPromise);
        });

        activeUploads.add(uploadPromise);
      }

      // Wait for at least one upload to complete
      if (activeUploads.size > 0) {
        await Promise.race(activeUploads);
      }
    }

    return {
      successful,
      failed,
      analytics: {
        totalFiles: files.length,
        completedFiles: successful.length,
        failedFiles: failed.length,
        currentFile: '',
        overallProgress: 100,
        estimatedTimeRemaining: 0,
        transferSpeed: totalBytes / ((Date.now() - startTime) / 1000)
      }
    };
  }

  /**
   * Pre-process file (compression, format conversion, etc.)
   */
  private async preprocessFile(file: File, options: EnhancedUploadOptions): Promise<File> {
    if (!options.enableCompression || !file.type.startsWith('image/')) {
      return file;
    }

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      return new Promise((resolve, reject) => {
        img.onload = () => {
          // Calculate optimal dimensions
          const maxDimension = 2048; // Max width/height
          const ratio = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
          
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;

          // Draw and compress
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File(
                  [blob], 
                  file.name, 
                  { 
                    type: options.enableWebP ? 'image/webp' : file.type,
                    lastModified: file.lastModified 
                  }
                );
                resolve(compressedFile);
              } else {
                resolve(file); // Fallback to original
              }
            },
            options.enableWebP ? 'image/webp' : file.type,
            (options.imageQuality || 85) / 100
          );
        };

        img.onerror = () => resolve(file); // Fallback to original
        img.src = URL.createObjectURL(file);
      });

    } catch (error) {
      console.warn('File preprocessing failed, using original:', error);
      return file;
    }
  }

  /**
   * Check for file deduplication
   */
  private async checkDuplication(file: File): Promise<UploadResult | null> {
    try {
      const hash = await this.calculateFileHash(file);
      const response = await fetch(`${this.baseUrl}/api/upload/check-duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, name: file.name, size: file.size }),
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (response.ok) {
        const result = await response.json();
        return result.exists ? result.file : null;
      }
    } catch (error) {
      console.warn('Deduplication check failed:', error);
    }

    return null;
  }

  /**
   * Calculate file hash for deduplication
   */
  private async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Upload using presigned URLs (recommended for R2)
   */
  private async uploadPresigned(
    file: File,
    folder: string,
    options: EnhancedUploadOptions
  ): Promise<UploadResult> {
    // Get presigned URL from backend
    const presignedResponse = await fetch(`${this.baseUrl}/api/upload/presigned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        folder: this.generateFolder(folder, options),
        metadata: options.customMetadata || {}
      }),
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!presignedResponse.ok) {
      throw new Error('Failed to get presigned URL');
    }

    const { uploadUrl, key, fields } = await presignedResponse.json();

    // Upload directly to R2
    const formData = new FormData();
    
    // Add any required fields
    if (fields) {
      Object.entries(fields).forEach(([k, v]) => {
        formData.append(k, v as string);
      });
    }
    
    formData.append('file', file);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file, // For R2, send file directly
      signal: options.signal,
      headers: {
        'Content-Type': file.type
      },
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    return {
      url: `https://cdn.pitchey.com/${key}`, // Use a generic CDN domain
      filename: file.name,
      size: file.size,
      type: file.type,
      id: key,
      uploadedAt: new Date().toISOString()
    };
  }

  /**
   * Upload using multipart for large files
   */
  private async uploadMultipart(
    file: File,
    folder: string,
    options: EnhancedUploadOptions
  ): Promise<UploadResult> {
    const chunkSize = options.chunkSize || 10 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    // Initialize multipart upload
    const initResponse = await fetch(`${this.baseUrl}/api/upload/multipart/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        folder: this.generateFolder(folder, options)
      }),
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!initResponse.ok) {
      throw new Error('Failed to initialize multipart upload');
    }

    const { uploadId, key } = await initResponse.json();
    const uploadedParts: Array<{ ETag: string; PartNumber: number }> = [];

    try {
      // Upload chunks in parallel
      const uploadPromises = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const partNumber = i + 1;

        uploadPromises.push(this.uploadChunk(chunk, uploadId, partNumber, key));
      }

      const parts = await Promise.all(uploadPromises);
      uploadedParts.push(...parts);

      // Complete multipart upload
      const completeResponse = await fetch(`${this.baseUrl}/api/upload/multipart/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadId,
          key,
          parts: uploadedParts
        }),
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (!completeResponse.ok) {
        throw new Error('Failed to complete multipart upload');
      }

      return {
        url: `https://cdn.pitchey.com/${key}`,
        filename: file.name,
        size: file.size,
        type: file.type,
        id: key,
        uploadedAt: new Date().toISOString()
      };

    } catch (error) {
      // Abort multipart upload on error
      await fetch(`${this.baseUrl}/api/upload/multipart/abort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uploadId, key }),
        credentials: 'include' // Send cookies for Better Auth session
      });
      
      throw error;
    }
  }

  /**
   * Upload individual chunk for multipart upload
   */
  private async uploadChunk(
    chunk: Blob,
    uploadId: string,
    partNumber: number,
    key: string
  ): Promise<{ ETag: string; PartNumber: number }> {
    const response = await fetch(`${this.baseUrl}/api/upload/multipart/chunk`, {
      method: 'POST',
      body: chunk,
      headers: {
        'x-upload-id': uploadId,
        'x-part-number': partNumber.toString(),
        'x-key': key
      },
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      throw new Error(`Failed to upload chunk ${partNumber}`);
    }

    const { etag } = await response.json();
    return { ETag: etag, PartNumber: partNumber };
  }

  /**
   * Direct upload through backend (fallback)
   */
  private async uploadDirect(
    file: File,
    folder: string,
    options: EnhancedUploadOptions
  ): Promise<UploadResult> {
    return uploadService.uploadDocument(file, 'document', {
      folder: this.generateFolder(folder, options),
      ...options
    });
  }

  /**
   * Generate organized folder structure
   */
  private generateFolder(baseFolder: string, options: EnhancedUploadOptions): string {
    let folder = baseFolder;

    if (options.autoOrganize) {
      if (options.userBasedFolder && options.userId) {
        folder = `users/${options.userId}/${folder}`;
      }
      
      if (options.dateBasedFolder) {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        folder = `${folder}/${year}/${month}`;
      }
    }

    return folder;
  }

  /**
   * Post-process upload results
   */
  private async postProcessUpload(
    result: UploadResult,
    file: File,
    options: EnhancedUploadOptions
  ): Promise<EnhancedUploadResult> {
    const enhancedResult: EnhancedUploadResult = {
      ...result,
      r2Key: result.id || '',
      cdnUrl: result.url,
      isOptimized: false,
      originalSize: file.size,
      optimizedSize: file.size,
      contentHash: await this.calculateFileHash(file),
      uploadDuration: 0, // Set by caller
      transferSpeed: 0, // Set by caller
      storageLocation: 'r2',
      replicationStatus: 'pending'
    };

    // Generate thumbnails if requested
    if (options.generateThumbnails && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      try {
        const thumbnailResult = await this.generateThumbnail(result.url, file.type);
        enhancedResult.thumbnailUrl = thumbnailResult.url;
      } catch (error) {
        console.warn('Thumbnail generation failed:', error);
      }
    }

    return enhancedResult;
  }

  /**
   * Generate thumbnail for image/video
   */
  private async generateThumbnail(url: string, mimeType: string): Promise<{ url: string }> {
    const response = await fetch(`${this.baseUrl}/api/upload/generate-thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, mimeType }),
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      throw new Error('Thumbnail generation failed');
    }

    return response.json();
  }

  /**
   * Create result for deduplicated file
   */
  private createDeduplicatedResult(
    existingFile: UploadResult,
    startTime: number
  ): EnhancedUploadResult {
    return {
      ...existingFile,
      r2Key: existingFile.id || '',
      cdnUrl: existingFile.url,
      isOptimized: false,
      originalSize: existingFile.size,
      optimizedSize: existingFile.size,
      contentHash: '',
      uploadDuration: Date.now() - startTime,
      transferSpeed: 0,
      storageLocation: 'r2-deduplicated',
      replicationStatus: 'replicated'
    };
  }

  /**
   * Track upload analytics
   */
  private async trackUploadAnalytics(
    uploadId: string,
    file: File,
    result: EnhancedUploadResult,
    startTime: number,
    options: EnhancedUploadOptions
  ): Promise<void> {
    const analytics: UploadAnalytics = {
      uploadId,
      userId: options.userId,
      sessionId: options.sessionId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadDuration: Date.now() - startTime,
      transferSpeed: file.size / ((Date.now() - startTime) / 1000),
      compressionRatio: result.originalSize / result.optimizedSize,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    this.uploadAnalytics.push(analytics);

    // Send to backend
    try {
      await fetch(`${this.baseUrl}/api/analytics/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(analytics),
        credentials: 'include' // Send cookies for Better Auth session
      });
    } catch (error) {
      console.warn('Failed to send upload analytics:', error);
    }
  }

  /**
   * Track upload error
   */
  private async trackUploadError(
    uploadId: string,
    file: File,
    error: Error,
    startTime: number,
    options: EnhancedUploadOptions
  ): Promise<void> {
    const analytics: UploadAnalytics = {
      uploadId,
      userId: options.userId,
      sessionId: options.sessionId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadDuration: Date.now() - startTime,
      transferSpeed: 0,
      errorCode: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    this.uploadAnalytics.push(analytics);
  }

  /**
   * Cancel all active uploads
   */
  private cancelAllActiveUploads(): void {
    this.activeUploads.forEach(controller => controller.abort());
    this.activeUploads.clear();
  }

  /**
   * Get upload analytics
   */
  getUploadAnalytics(): UploadAnalytics[] {
    return [...this.uploadAnalytics];
  }

  /**
   * Clear analytics data
   */
  clearAnalytics(): void {
    this.uploadAnalytics = [];
  }
}

// Export singleton instance
export const enhancedUploadService = new EnhancedUploadService();

// Export types and service class
export { EnhancedUploadService };

// Re-export existing types for compatibility
export type {
  UploadProgress,
  UploadResult,
  UploadOptions
} from './upload.service';