/**
 * Enhanced Chunked File Upload Component
 * Complete file upload solution with chunking, progress tracking, and queue management
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  X,
  File,
  Image,
  Video,
  FileText,
  AlertCircle,
  CheckCircle,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Clock,
  Zap
} from 'lucide-react';
import { chunkedUploadService } from '../../services/chunked-upload.service';
import {
  ChunkedUploadProgress,
  CompletedUploadResult,
  UploadError,
  ChunkedFileUploadProps,
  UploadQueueStats
} from '@shared/types/chunked-upload';

interface FileUploadState {
  sessionId: string;
  file: File;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: ChunkedUploadProgress | null;
  result: CompletedUploadResult | null;
  error: UploadError | null;
  startTime: number | null;
  canResume: boolean;
}

const ChunkedFileUpload: React.FC<ChunkedFileUploadProps> = ({
  accept,
  multiple = true,
  maxFiles = 10,
  maxFileSize,
  category = 'document',
  disabled = false,
  className = '',
  children,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  onFilesSelected,
  pitchId,
  metadata,
  uploadOptions = {}
}) => {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [queueStats, setQueueStats] = useState<UploadQueueStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [globalProgress, setGlobalProgress] = useState({
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    totalBytes: 0,
    uploadedBytes: 0,
    averageSpeed: 0
  });

  // Get file size limits based on category
  const getMaxFileSize = useCallback(() => {
    if (maxFileSize) return maxFileSize;
    
    const defaults = {
      document: 100 * 1024 * 1024, // 100MB
      image: 10 * 1024 * 1024,     // 10MB
      video: 500 * 1024 * 1024,    // 500MB
      nda: 50 * 1024 * 1024        // 50MB
    };
    
    return defaults[category];
  }, [category, maxFileSize]);

  // Get accepted file types based on category
  const getAcceptedTypes = useCallback(() => {
    if (accept) return accept.split(',').map(type => type.trim());
    
    const typeMap = {
      document: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      video: ['video/mp4', 'video/quicktime', 'video/webm'],
      nda: ['.pdf']
    };
    
    return typeMap[category] || [];
  }, [accept, category]);

  // Get file icon based on type
  const getFileIcon = useCallback((mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (mimeType.startsWith('video/')) return <Video className="w-5 h-5" />;
    if (mimeType === 'application/pdf') return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  }, []);

  // Format file size
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }, []);

  // Format upload speed
  const formatSpeed = useCallback((bytesPerSecond: number) => {
    return `${formatFileSize(bytesPerSecond)}/s`;
  }, [formatFileSize]);

  // Format time remaining
  const formatTimeRemaining = useCallback((seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  }, []);

  // Validate file before upload
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file size
    const maxSize = getMaxFileSize();
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size ${formatFileSize(file.size)} exceeds ${formatFileSize(maxSize)} limit`
      };
    }

    // Check file type
    const acceptedTypes = getAcceptedTypes();
    if (acceptedTypes.length > 0) {
      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        }
        return file.type === type;
      });

      if (!isAccepted) {
        return {
          valid: false,
          error: `File type not accepted. Allowed: ${acceptedTypes.join(', ')}`
        };
      }
    }

    return { valid: true };
  }, [getMaxFileSize, getAcceptedTypes, formatFileSize]);

  // Handle file selection
  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles || disabled) return;

    const newFiles: File[] = [];
    const totalFiles = files.length + selectedFiles.length;

    if (totalFiles > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate and collect files
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const validation = validateFile(file);
      
      if (validation.valid) {
        newFiles.push(file);
      } else {
        // Show validation error for invalid files
        const errorState: FileUploadState = {
          sessionId: crypto.randomUUID(),
          file,
          status: 'failed',
          progress: null,
          result: null,
          error: {
            code: 'VALIDATION_ERROR' as any,
            message: validation.error!,
            recoverable: false
          },
          startTime: null,
          canResume: false
        };
        
        setFiles(prev => [...prev, errorState]);
      }
    }

    if (newFiles.length > 0) {
      onFilesSelected?.(newFiles);
      
      // Add files to upload queue with pending status
      const pendingStates: FileUploadState[] = newFiles.map(file => ({
        sessionId: crypto.randomUUID(),
        file,
        status: 'pending',
        progress: null,
        result: null,
        error: null,
        startTime: null,
        canResume: false
      }));

      setFiles(prev => [...prev, ...pendingStates]);

      // Start uploads
      pendingStates.forEach(fileState => {
        startFileUpload(fileState);
      });
    }
  }, [files, maxFiles, disabled, validateFile, onFilesSelected]);

  // Start individual file upload
  const startFileUpload = useCallback(async (fileState: FileUploadState) => {
    try {
      fileState.status = 'uploading';
      fileState.startTime = Date.now();
      
      setFiles(prev => prev.map(f => f.sessionId === fileState.sessionId ? { ...fileState } : f));
      
      onUploadStart?.({
        sessionId: fileState.sessionId,
        uploadId: '',
        fileKey: '',
        fileName: fileState.file.name,
        fileSize: fileState.file.size,
        mimeType: fileState.file.type,
        chunkSize: 0,
        totalChunks: 0,
        uploadedChunks: [],
        status: 'uploading',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata
      });

      const result = await chunkedUploadService.uploadFile(
        fileState.file,
        category,
        {
          ...uploadOptions,
          pitchId,
          metadata,
          onProgress: (progress) => {
            fileState.progress = progress;
            setFiles(prev => prev.map(f => f.sessionId === fileState.sessionId ? { ...fileState } : f));
            onUploadProgress?.(progress);
            updateGlobalProgress();
          }
        }
      );

      fileState.status = 'completed';
      fileState.result = result;
      fileState.error = null;
      
      setFiles(prev => prev.map(f => f.sessionId === fileState.sessionId ? { ...fileState } : f));
      
      onUploadComplete?.(result);
      updateGlobalProgress();

    } catch (error) {
      const uploadError = error as UploadError;
      fileState.status = 'failed';
      fileState.error = uploadError;
      fileState.canResume = uploadError.recoverable;
      
      setFiles(prev => prev.map(f => f.sessionId === fileState.sessionId ? { ...fileState } : f));
      
      onUploadError?.(uploadError);
      updateGlobalProgress();
    }
  }, [category, uploadOptions, pitchId, metadata, onUploadStart, onUploadProgress, onUploadComplete, onUploadError]);

  // Pause upload
  const pauseUpload = useCallback(async (sessionId: string) => {
    try {
      await chunkedUploadService.pauseUpload(sessionId);
      setFiles(prev => prev.map(f => 
        f.sessionId === sessionId ? { ...f, status: 'paused' as const } : f
      ));
    } catch (error) {
      console.error('Failed to pause upload:', error);
    }
  }, []);

  // Resume upload
  const resumeUpload = useCallback(async (fileState: FileUploadState) => {
    try {
      fileState.status = 'uploading';
      setFiles(prev => prev.map(f => f.sessionId === fileState.sessionId ? { ...fileState } : f));
      
      const result = await chunkedUploadService.resumeUpload(fileState.sessionId);
      
      fileState.status = 'completed';
      fileState.result = result;
      fileState.error = null;
      
      setFiles(prev => prev.map(f => f.sessionId === fileState.sessionId ? { ...fileState } : f));
      onUploadComplete?.(result);
      updateGlobalProgress();
      
    } catch (error) {
      const uploadError = error as UploadError;
      fileState.status = 'failed';
      fileState.error = uploadError;
      
      setFiles(prev => prev.map(f => f.sessionId === fileState.sessionId ? { ...fileState } : f));
      onUploadError?.(uploadError);
    }
  }, [onUploadComplete, onUploadError]);

  // Cancel upload
  const cancelUpload = useCallback(async (sessionId: string) => {
    try {
      await chunkedUploadService.cancelUpload(sessionId);
      setFiles(prev => prev.filter(f => f.sessionId !== sessionId));
      updateGlobalProgress();
    } catch (error) {
      console.error('Failed to cancel upload:', error);
    }
  }, []);

  // Retry upload
  const retryUpload = useCallback((fileState: FileUploadState) => {
    fileState.status = 'pending';
    fileState.error = null;
    fileState.progress = null;
    fileState.result = null;
    
    setFiles(prev => prev.map(f => f.sessionId === fileState.sessionId ? { ...fileState } : f));
    startFileUpload(fileState);
  }, [startFileUpload]);

  // Remove file from list
  const removeFile = useCallback((sessionId: string) => {
    setFiles(prev => prev.filter(f => f.sessionId !== sessionId));
    updateGlobalProgress();
  }, []);

  // Update global progress statistics
  const updateGlobalProgress = useCallback(() => {
    setGlobalProgress(prev => {
      const totalFiles = files.length;
      const completedFiles = files.filter(f => f.status === 'completed').length;
      const failedFiles = files.filter(f => f.status === 'failed').length;
      const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);
      const uploadedBytes = files
        .filter(f => f.progress)
        .reduce((sum, f) => sum + f.progress!.uploadedBytes, 0);
      
      const activeFiles = files.filter(f => f.status === 'uploading' && f.progress);
      const averageSpeed = activeFiles.length > 0
        ? activeFiles.reduce((sum, f) => sum + f.progress!.speed, 0) / activeFiles.length
        : 0;

      return {
        totalFiles,
        completedFiles,
        failedFiles,
        totalBytes,
        uploadedBytes,
        averageSpeed
      };
    });
  }, [files]);

  // Update global progress when files change
  useEffect(() => {
    updateGlobalProgress();
  }, [files, updateGlobalProgress]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!disabled) handleFileSelect(e.dataTransfer.files);
  }, [disabled, handleFileSelect]);

  const clearCompleted = useCallback(() => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'));
    chunkedUploadService.clearCompleted();
  }, []);

  const hasActiveUploads = files.some(f => 
    f.status === 'uploading' || f.status === 'pending'
  );

  const hasCompletedUploads = files.some(f => f.status === 'completed');

  return (
    <div className={`chunked-file-upload ${className}`}>
      {/* Drop Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-all
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 scale-105' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        {children || (
          <>
            <Upload className={`w-12 h-12 mx-auto mb-4 ${disabled ? 'text-gray-300' : 'text-gray-400'}`} />
            <p className={`text-lg font-medium mb-2 ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
              Drop files here or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Maximum {maxFiles} files, up to {formatFileSize(getMaxFileSize())} each
            </p>
            {category === 'nda' && (
              <p className="text-sm text-yellow-600 mt-2">
                Only PDF files are accepted for NDA documents
              </p>
            )}
          </>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple && category !== 'nda'}
          accept={getAcceptedTypes().join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Global Progress Summary */}
      {files.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium text-gray-900">Upload Progress</h3>
            <div className="flex space-x-2">
              {hasCompletedUploads && (
                <button
                  onClick={clearCompleted}
                  className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                >
                  Clear Completed
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Files:</span>
              <span className="ml-2 font-medium">
                {globalProgress.completedFiles}/{globalProgress.totalFiles}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Size:</span>
              <span className="ml-2 font-medium">
                {formatFileSize(globalProgress.uploadedBytes)}/{formatFileSize(globalProgress.totalBytes)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Speed:</span>
              <span className="ml-2 font-medium">
                {hasActiveUploads ? formatSpeed(globalProgress.averageSpeed) : '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Failed:</span>
              <span className="ml-2 font-medium text-red-600">
                {globalProgress.failedFiles}
              </span>
            </div>
          </div>
          
          {/* Global progress bar */}
          {globalProgress.totalBytes > 0 && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.round((globalProgress.uploadedBytes / globalProgress.totalBytes) * 100)}%` 
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          {files.map((fileState) => (
            <div
              key={fileState.sessionId}
              className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {getFileIcon(fileState.file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {fileState.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(fileState.file.size)}
                    {fileState.startTime && fileState.status === 'completed' && (
                      <span className="ml-2">
                        • {Math.round((Date.now() - fileState.startTime) / 1000)}s
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Progress Section */}
              <div className="flex items-center space-x-4 flex-1 max-w-md">
                {fileState.status === 'uploading' && fileState.progress && (
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{fileState.progress.percentage}%</span>
                      <span>
                        {formatSpeed(fileState.progress.speed)}
                        {fileState.progress.estimatedTimeRemaining > 0 && (
                          <span className="ml-1">
                            • {formatTimeRemaining(fileState.progress.estimatedTimeRemaining)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${fileState.progress.percentage}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {fileState.status === 'completed' && (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-xs font-medium">Completed</span>
                  </div>
                )}
                
                {fileState.status === 'failed' && (
                  <div className="flex items-center space-x-2 text-red-600 max-w-48">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-xs font-medium truncate">
                      {fileState.error?.message || 'Upload failed'}
                    </span>
                  </div>
                )}

                {fileState.status === 'paused' && (
                  <div className="flex items-center space-x-2 text-yellow-600">
                    <Clock className="w-5 h-5" />
                    <span className="text-xs font-medium">Paused</span>
                  </div>
                )}

                {fileState.status === 'pending' && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Zap className="w-5 h-5" />
                    <span className="text-xs font-medium">Pending</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 ml-4">
                {fileState.status === 'uploading' && (
                  <button
                    onClick={() => pauseUpload(fileState.sessionId)}
                    className="p-1 hover:bg-gray-100 rounded text-gray-600"
                    title="Pause upload"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                )}
                
                {fileState.status === 'paused' && (
                  <button
                    onClick={() => resumeUpload(fileState)}
                    className="p-1 hover:bg-gray-100 rounded text-blue-600"
                    title="Resume upload"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                
                {fileState.status === 'failed' && fileState.canResume && (
                  <button
                    onClick={() => retryUpload(fileState)}
                    className="p-1 hover:bg-gray-100 rounded text-green-600"
                    title="Retry upload"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => 
                    fileState.status === 'uploading' 
                      ? cancelUpload(fileState.sessionId)
                      : removeFile(fileState.sessionId)
                  }
                  className="p-1 hover:bg-gray-100 rounded text-red-600"
                  title={fileState.status === 'uploading' ? 'Cancel upload' : 'Remove file'}
                >
                  {fileState.status === 'uploading' ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChunkedFileUpload;