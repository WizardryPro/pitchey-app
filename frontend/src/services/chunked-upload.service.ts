/**
 * Enhanced Chunked Upload Service
 * Handles large file uploads with chunking, resume capability, and queue management
 */

import {
  ChunkMetadata,
  ChunkedUploadSession,
  ChunkUploadResult,
  ChunkedUploadProgress,
  ChunkUploadOptions,
  UploadQueueItem,
  CompletedUploadResult,
  UploadError,
  UploadErrorCode,
  ChunkedUploadConfig,
  UploadQueueStats,
  ChunkProgressEvent,
  SessionResumeInfo,
  InitChunkedUploadRequest,
  InitChunkedUploadResponse,
  UploadChunkResponse,
  CompleteChunkedUploadResponse,
  GetUploadSessionResponse,
  ChunkedUploadEvents
} from '@shared/types/chunked-upload';

class ChunkedUploadService {
  private baseUrl: string;
  private config: ChunkedUploadConfig;
  private activeSessions: Map<string, ChunkedUploadSession> = new Map();
  private uploadQueue: UploadQueueItem[] = [];
  private activeUploads: Map<string, Promise<CompletedUploadResult>> = new Map();
  private eventListeners: Map<keyof ChunkedUploadEvents, Function[]> = new Map();
  private progressTimers: Map<string, number> = new Map();

  constructor(baseUrl?: string, config?: Partial<ChunkedUploadConfig>) {
    const isDev = import.meta.env.MODE === 'development';
    this.baseUrl = baseUrl || import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:8001' : '');
    
    this.config = {
      maxFileSize: {
        document: 100 * 1024 * 1024, // 100MB
        image: 10 * 1024 * 1024,     // 10MB
        video: 500 * 1024 * 1024,    // 500MB
        nda: 50 * 1024 * 1024        // 50MB
      },
      chunkSize: {
        small: 1 * 1024 * 1024,      // 1MB for images
        medium: 2 * 1024 * 1024,     // 2MB default
        large: 5 * 1024 * 1024       // 5MB for videos
      },
      maxConcurrentUploads: 3,
      maxConcurrentChunks: 3,
      retrySettings: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
      },
      sessionExpiry: 24 * 60 * 60 * 1000, // 24 hours
      cleanupInterval: 60 * 60 * 1000,    // 1 hour
      supportedMimeTypes: {
        document: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'application/rtf'
        ],
        image: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/avif'
        ],
        video: [
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          'video/webm'
        ],
        nda: [
          'application/pdf'
        ]
      },
      ...config
    };

    // Start cleanup interval
    this.startCleanupInterval();
    
    // Initialize from localStorage if available
    this.loadPersistedSessions();
  }

  /**
   * Upload a file with chunking support
   */
  async uploadFile(
    file: File,
    category: 'document' | 'image' | 'video' | 'nda',
    options: Partial<ChunkUploadOptions> & { 
      pitchId?: number; 
      metadata?: Record<string, any>;
    } = {}
  ): Promise<CompletedUploadResult> {
    // Validate file
    const validation = this.validateFile(file, category);
    if (!validation.valid) {
      const error: UploadError = {
        code: UploadErrorCode.VALIDATION_ERROR,
        message: validation.error!,
        recoverable: false
      };
      throw error;
    }

    // Determine optimal chunk size
    const chunkSize = this.getOptimalChunkSize(file, category);
    
    // Merge options with defaults
    const uploadOptions: ChunkUploadOptions = {
      chunkSize,
      maxConcurrentChunks: this.config.maxConcurrentChunks,
      maxRetries: this.config.retrySettings.maxRetries,
      retryDelay: this.config.retrySettings.baseDelay,
      enableResume: true,
      enableChecksum: true,
      timeout: 30000,
      ...options
    };

    // Initialize upload session
    const session = await this.initializeUploadSession(file, category, uploadOptions, options);
    
    // Start upload process
    return this.performChunkedUpload(session, file, uploadOptions);
  }

  /**
   * Add file to upload queue
   */
  queueUpload(
    file: File,
    category: 'document' | 'image' | 'video' | 'nda',
    priority: 'low' | 'normal' | 'high' = 'normal',
    options: Partial<ChunkUploadOptions> & { 
      pitchId?: number; 
      metadata?: Record<string, any>;
      onComplete?: (result: CompletedUploadResult) => void;
      onError?: (error: UploadError) => void;
    } = {}
  ): string {
    const queueItem: UploadQueueItem = {
      file,
      options: {
        chunkSize: this.getOptimalChunkSize(file, category),
        maxConcurrentChunks: this.config.maxConcurrentChunks,
        maxRetries: this.config.retrySettings.maxRetries,
        retryDelay: this.config.retrySettings.baseDelay,
        enableResume: true,
        enableChecksum: true,
        timeout: 30000,
        ...options
      },
      priority,
      category,
      metadata: options.metadata,
      pitchId: options.pitchId,
      onComplete: options.onComplete,
      onError: options.onError
    };

    // Insert based on priority
    if (priority === 'high') {
      this.uploadQueue.unshift(queueItem);
    } else if (priority === 'low') {
      this.uploadQueue.push(queueItem);
    } else {
      // Insert normal priority items after high priority but before low
      const highPriorityCount = this.uploadQueue.findIndex(item => item.priority !== 'high');
      const insertIndex = highPriorityCount === -1 ? this.uploadQueue.length : highPriorityCount;
      this.uploadQueue.splice(insertIndex, 0, queueItem);
    }

    const sessionId = crypto.randomUUID();
    this.emit('queue:added', { sessionId, position: this.uploadQueue.length - 1 });

    // Process queue if we have capacity
    this.processQueue();

    return sessionId;
  }

  /**
   * Resume an interrupted upload
   */
  async resumeUpload(sessionId: string): Promise<CompletedUploadResult> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      const uploadError: UploadError = {
        sessionId,
        code: UploadErrorCode.SESSION_EXPIRED,
        message: 'Upload session not found or expired',
        recoverable: false
      };
      throw uploadError;
    }

    // Get resume information from server
    const resumeInfo = await this.getResumeInfo(sessionId);

    if (!resumeInfo.canResume) {
      const uploadError: UploadError = {
        sessionId,
        code: UploadErrorCode.SESSION_EXPIRED,
        message: resumeInfo.reason || 'Cannot resume upload session',
        recoverable: false
      };
      throw uploadError;
    }

    // Update session with resume info
    session.uploadedChunks = resumeInfo.uploadedChunks;
    session.status = 'uploading';

    this.emit('session:resumed', { sessionId });

    // Continue upload from where it left off
    return this.performChunkedUpload(session, session as any, {
      chunkSize: session.chunkSize,
      maxConcurrentChunks: this.config.maxConcurrentChunks,
      maxRetries: this.config.retrySettings.maxRetries,
      retryDelay: this.config.retrySettings.baseDelay,
      enableResume: true,
      enableChecksum: true,
      timeout: 30000
    });
  }

  /**
   * Pause an active upload
   */
  async pauseUpload(sessionId: string, reason?: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      throw new Error('Upload session not found');
    }

    session.status = 'paused';
    
    this.emit('session:paused', { sessionId, reason });
    this.persistSession(session);
  }

  /**
   * Cancel an active upload
   */
  async cancelUpload(sessionId: string, reason?: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    
    if (session) {
      session.status = 'cancelled';
      
      // Abort upload on server
      try {
        await this.abortUploadSession(sessionId, reason);
      } catch (error) {
        console.warn('Failed to abort upload on server:', error);
      }
      
      this.activeSessions.delete(sessionId);
      this.activeUploads.delete(sessionId);
      
      this.emit('session:cancelled', { sessionId, reason });
      this.removePersistedSession(sessionId);
    }

    // Remove from queue if present
    const queueIndex = this.uploadQueue.findIndex(item => 
      item.file.name === session?.fileName
    );
    if (queueIndex !== -1) {
      this.uploadQueue.splice(queueIndex, 1);
    }
  }

  /**
   * Get upload queue statistics
   */
  getQueueStats(): UploadQueueStats {
    const activeUploadsCount = this.activeUploads.size;
    const completedUploads = Array.from(this.activeSessions.values())
      .filter(session => session.status === 'completed').length;
    const failedUploads = Array.from(this.activeSessions.values())
      .filter(session => session.status === 'failed').length;

    const totalUploadedBytes = Array.from(this.activeSessions.values())
      .filter(session => session.status === 'completed')
      .reduce((total, session) => total + session.fileSize, 0);

    return {
      totalItems: this.uploadQueue.length + activeUploadsCount,
      activeUploads: activeUploadsCount,
      queuedUploads: this.uploadQueue.length,
      completedUploads,
      failedUploads,
      totalUploadedBytes,
      averageUploadSpeed: 0, // Would calculate from actual upload data
      estimatedQueueTime: this.uploadQueue.length * 30 // Rough estimate
    };
  }

  /**
   * Clear completed uploads from memory
   */
  clearCompleted(): void {
    const completedSessions = Array.from(this.activeSessions.entries())
      .filter(([_, session]) => session.status === 'completed')
      .map(([sessionId, _]) => sessionId);

    completedSessions.forEach(sessionId => {
      this.activeSessions.delete(sessionId);
      this.removePersistedSession(sessionId);
    });
  }

  /**
   * Add event listener
   */
  on<K extends keyof ChunkedUploadEvents>(
    event: K,
    listener: (data: ChunkedUploadEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof ChunkedUploadEvents>(
    event: K,
    listener: (data: ChunkedUploadEvents[K]) => void
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Private methods

  private async initializeUploadSession(
    file: File,
    category: 'document' | 'image' | 'video' | 'nda',
    options: ChunkUploadOptions,
    metadata: { pitchId?: number; metadata?: Record<string, any> }
  ): Promise<ChunkedUploadSession> {
    const request: InitChunkedUploadRequest = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      category,
      chunkSize: options.chunkSize,
      metadata: metadata.metadata,
      pitchId: metadata.pitchId,
      requireNDA: category === 'nda'
    };

    const response = await fetch(`${this.baseUrl}/api/upload/chunked/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const uploadError: UploadError = {
        code: UploadErrorCode.SERVER_ERROR,
        message: errorData.error || `Server error: ${response.status}`,
        recoverable: response.status >= 500
      };
      throw uploadError;
    }

    const result: InitChunkedUploadResponse = await response.json();

    if (!result.success || !result.data) {
      const uploadError: UploadError = {
        code: UploadErrorCode.SERVER_ERROR,
        message: result.error || 'Failed to initialize upload session',
        recoverable: false
      };
      throw uploadError;
    }

    const session: ChunkedUploadSession = {
      sessionId: result.data.sessionId,
      uploadId: result.data.uploadId,
      fileKey: result.data.fileKey,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      chunkSize: options.chunkSize,
      totalChunks: result.data.totalChunks,
      uploadedChunks: result.data.resumeInfo?.uploadedChunks || [],
      status: 'initializing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: result.data.expiresAt,
      metadata: metadata.metadata
    };

    this.activeSessions.set(session.sessionId, session);
    this.persistSession(session);

    this.emit('session:created', session);

    return session;
  }

  private async performChunkedUpload(
    session: ChunkedUploadSession,
    file: File,
    options: ChunkUploadOptions
  ): Promise<CompletedUploadResult> {
    return new Promise(async (resolve, reject) => {
      try {
        session.status = 'uploading';
        this.emit('session:progress', this.calculateProgress(session));

        const chunks = await this.createChunks(file, session.chunkSize);
        const remainingChunks = chunks.filter(chunk => 
          !session.uploadedChunks.includes(chunk.chunkIndex)
        );

        if (remainingChunks.length === 0) {
          // All chunks already uploaded, complete the upload
          const result = await this.completeUpload(session, chunks);
          resolve(result);
          return;
        }

        // Upload chunks with concurrency control
        const uploadPromises = new Map<number, Promise<ChunkUploadResult>>();
        const completedChunks: ChunkUploadResult[] = [];
        let activeUploads = 0;
        let chunkIndex = 0;

        const processNextChunk = async (): Promise<void> => {
          while (chunkIndex < remainingChunks.length && activeUploads < options.maxConcurrentChunks) {
            const chunk = remainingChunks[chunkIndex++];
            activeUploads++;

            const uploadPromise = this.uploadSingleChunk(chunk, file, session, options)
              .then(result => {
                completedChunks.push(result);
                session.uploadedChunks.push(result.chunkIndex);
                this.emit('chunk:upload:complete', { sessionId: session.sessionId, chunk: result });
                this.emit('session:progress', this.calculateProgress(session));
                return result;
              })
              .catch(error => {
                this.emit('chunk:upload:failed', { 
                  sessionId: session.sessionId, 
                  chunk, 
                  error: error.message 
                });
                throw error;
              })
              .finally(() => {
                activeUploads--;
                uploadPromises.delete(chunk.chunkIndex);
              });

            uploadPromises.set(chunk.chunkIndex, uploadPromise);
          }
        };

        // Start initial batch
        await processNextChunk();

        // Process remaining chunks as others complete
        while (uploadPromises.size > 0 || chunkIndex < remainingChunks.length) {
          if (uploadPromises.size > 0) {
            await Promise.race(uploadPromises.values());
          }
          await processNextChunk();
        }

        // Complete the upload
        const allChunks = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
        const result = await this.completeUpload(session, allChunks);
        
        session.status = 'completed';
        this.emit('session:completed', result);
        
        resolve(result);

      } catch (error: unknown) {
        session.status = 'failed';
        const uploadError: UploadError = (error as any)?.code && (error as any)?.message
          ? error as UploadError
          : {
              sessionId: session.sessionId,
              code: UploadErrorCode.NETWORK_ERROR,
              message: (error as any)?.message || 'Upload failed',
              recoverable: true
            };

        this.emit('session:failed', { sessionId: session.sessionId, error: uploadError });
        reject(uploadError);
      }
    });
  }

  private async uploadSingleChunk(
    chunk: ChunkMetadata,
    file: File,
    session: ChunkedUploadSession,
    options: ChunkUploadOptions
  ): Promise<ChunkUploadResult> {
    const chunkData = file.slice(chunk.startByte, chunk.endByte);
    let retryCount = 0;

    while (retryCount <= options.maxRetries) {
      try {
        this.emit('chunk:upload:start', { sessionId: session.sessionId, chunk });

        // Calculate checksum
        const buffer = await chunkData.arrayBuffer();
        const checksum = await this.calculateChecksum(buffer);

        // Upload chunk
        const url = new URL(`${this.baseUrl}/api/upload/chunked/chunk`);
        url.searchParams.set('sessionId', session.sessionId);
        url.searchParams.set('chunkIndex', chunk.chunkIndex.toString());
        url.searchParams.set('checksum', checksum);

        const response = await fetch(url.toString(), {
          method: 'PUT',
          body: buffer,
          credentials: 'include',
          signal: options.signal
        });

        if (!response.ok) {
          throw new Error(`Chunk upload failed: ${response.status}`);
        }

        const result: UploadChunkResponse = await response.json();

        if (!result.success || !result.data) {
          throw new Error(result.error || 'Chunk upload failed');
        }

        return {
          chunkIndex: chunk.chunkIndex,
          etag: result.data.etag,
          checksum: result.data.checksum,
          uploadedAt: (result.data as any).uploadedAt || new Date().toISOString(),
          success: true,
          retryCount
        };

      } catch (error) {
        retryCount++;
        
        if (retryCount <= options.maxRetries) {
          const delay = Math.min(
            options.retryDelay * Math.pow(2, retryCount - 1),
            this.config.retrySettings.maxDelay
          );
          
          this.emit('chunk:upload:retry', { 
            sessionId: session.sessionId, 
            chunk, 
            attempt: retryCount 
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    throw new Error(`Chunk upload failed after ${options.maxRetries} retries`);
  }

  private async completeUpload(
    session: ChunkedUploadSession,
    chunks: ChunkMetadata[]
  ): Promise<CompletedUploadResult> {
    const response = await fetch(`${this.baseUrl}/api/upload/chunked/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: session.sessionId,
        chunks: chunks.map(chunk => ({
          chunkIndex: chunk.chunkIndex,
          etag: `"${chunk.checksum.substring(0, 16)}"`
        }))
      }),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Complete upload failed: ${response.status}`);
    }

    const result: CompleteChunkedUploadResponse = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to complete upload');
    }

    return result.data;
  }

  private async createChunks(file: File, chunkSize: number): Promise<ChunkMetadata[]> {
    const chunks: ChunkMetadata[] = [];
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const startByte = i * chunkSize;
      const endByte = Math.min(startByte + chunkSize, file.size);
      const chunkData = file.slice(startByte, endByte);
      const buffer = await chunkData.arrayBuffer();
      const checksum = await this.calculateChecksum(buffer);

      chunks.push({
        chunkIndex: i,
        chunkSize: endByte - startByte,
        totalChunks,
        startByte,
        endByte,
        checksum
      });
    }

    return chunks;
  }

  private calculateProgress(session: ChunkedUploadSession): ChunkedUploadProgress {
    const uploadedBytes = session.uploadedChunks.length * session.chunkSize;
    const percentage = Math.round((session.uploadedChunks.length / session.totalChunks) * 100);

    return {
      sessionId: session.sessionId,
      uploadedBytes,
      totalBytes: session.fileSize,
      uploadedChunks: session.uploadedChunks.length,
      totalChunks: session.totalChunks,
      percentage,
      speed: 0, // Would be calculated from actual timing data
      estimatedTimeRemaining: 0, // Would be calculated from current progress and speed
      activeChunks: 0, // Would track currently uploading chunks
      queuedChunks: session.totalChunks - session.uploadedChunks.length,
      failedChunks: 0 // Would track failed chunks
    };
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private validateFile(file: File, category: string): { valid: boolean; error?: string } {
    // Check file size
    const maxSize = (this.config.maxFileSize as any)[category] as number;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size ${this.formatFileSize(file.size)} exceeds ${this.formatFileSize(maxSize)} limit`
      };
    }

    // Check MIME type
    const allowedTypes = (this.config.supportedMimeTypes as any)[category] as string[];
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not supported for ${category} uploads`
      };
    }

    return { valid: true };
  }

  private getOptimalChunkSize(file: File, category: string): number {
    if (category === 'video' && file.size > 50 * 1024 * 1024) {
      return this.config.chunkSize.large;
    }
    if (category === 'image' && file.size < 5 * 1024 * 1024) {
      return this.config.chunkSize.small;
    }
    return this.config.chunkSize.medium;
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  private async processQueue(): Promise<void> {
    while (this.activeUploads.size < this.config.maxConcurrentUploads && this.uploadQueue.length > 0) {
      const queueItem = this.uploadQueue.shift()!;
      const sessionId = crypto.randomUUID();

      this.emit('queue:started', { sessionId });

      const uploadPromise = this.uploadFile(queueItem.file, queueItem.category, {
        ...queueItem.options,
        pitchId: queueItem.pitchId,
        metadata: queueItem.metadata
      })
      .then(result => {
        queueItem.onComplete?.(result);
        return result;
      })
      .catch(error => {
        queueItem.onError?.(error);
        throw error;
      })
      .finally(() => {
        this.activeUploads.delete(sessionId);
        // Continue processing queue
        setTimeout(() => this.processQueue(), 100);
      });

      this.activeUploads.set(sessionId, uploadPromise);
    }

    this.emit('queue:stats', this.getQueueStats());
  }

  private async getResumeInfo(sessionId: string): Promise<SessionResumeInfo> {
    const response = await fetch(`${this.baseUrl}/api/upload/chunked/resume/${sessionId}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to get resume info: ${response.status}`);
    }

    const result = await response.json();
    return result.success ? result.data : { sessionId, canResume: false, uploadedChunks: [], remainingChunks: [], nextChunkIndex: 0 };
  }

  private async abortUploadSession(sessionId: string, reason?: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/upload/chunked/abort`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionId, reason }),
      credentials: 'include'
    });
  }

  private persistSession(session: ChunkedUploadSession): void {
    try {
      const sessions = this.getPersistedSessions();
      sessions[session.sessionId] = session;
      localStorage.setItem('chunked_upload_sessions', JSON.stringify(sessions));
    } catch (error) {
      console.warn('Failed to persist upload session:', error);
    }
  }

  private removePersistedSession(sessionId: string): void {
    try {
      const sessions = this.getPersistedSessions();
      delete sessions[sessionId];
      localStorage.setItem('chunked_upload_sessions', JSON.stringify(sessions));
    } catch (error) {
      console.warn('Failed to remove persisted session:', error);
    }
  }

  private getPersistedSessions(): Record<string, ChunkedUploadSession> {
    try {
      const data = localStorage.getItem('chunked_upload_sessions');
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.warn('Failed to load persisted sessions:', error);
      return {};
    }
  }

  private loadPersistedSessions(): void {
    const sessions = this.getPersistedSessions();
    const now = Date.now();

    Object.values(sessions).forEach(session => {
      // Check if session has expired
      if (new Date(session.expiresAt).getTime() > now) {
        this.activeSessions.set(session.sessionId, session);
      } else {
        this.removePersistedSession(session.sessionId);
      }
    });
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredSessions: string[] = [];

      this.activeSessions.forEach((session, sessionId) => {
        if (new Date(session.expiresAt).getTime() < now || 
            (session.status === 'completed' && 
             new Date(session.updatedAt).getTime() < now - this.config.cleanupInterval)) {
          expiredSessions.push(sessionId);
        }
      });

      expiredSessions.forEach(sessionId => {
        this.activeSessions.delete(sessionId);
        this.removePersistedSession(sessionId);
      });
    }, this.config.cleanupInterval);
  }

  private emit<K extends keyof ChunkedUploadEvents>(event: K, data: ChunkedUploadEvents[K]): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }
}

// Create and export singleton instance
export const chunkedUploadService = new ChunkedUploadService();
export { ChunkedUploadService };

// Re-export types for convenience
export * from '@shared/types/chunked-upload';