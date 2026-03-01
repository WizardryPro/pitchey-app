import React, { useState, useRef, useCallback, useMemo } from 'react';
import { 
  Upload, 
  X, 
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Archive,
  CheckCircle,
  AlertCircle,
  Loader,
  Plus,
  Eye,
  Download,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Grid,
  List,
  Maximize
} from 'lucide-react';
import { useToast } from '@shared/components/feedback/ToastProvider';
import { uploadService, UploadResult, UploadProgress } from '../../services/upload.service';

export interface MediaFile {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'archive';
  file: File;
  title: string;
  description?: string;
  uploadProgress?: number;
  uploadStatus?: 'idle' | 'uploading' | 'completed' | 'error' | 'paused' | 'retrying';
  url?: string;
  thumbnailUrl?: string;
  error?: string;
  uploadSpeed?: number;
  estimatedTimeRemaining?: number;
  retryCount?: number;
  order?: number;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    size?: number;
  };
}

interface FileUploadProps {
  files: MediaFile[];
  onChange: (files: MediaFile[]) => void;
  pitchId?: number;
  acceptedTypes?: string[];
  maxFiles?: number;
  maxFileSize?: number; // in MB
  disabled?: boolean;
  showProgress?: boolean;
  enableDragDrop?: boolean;
  showPreview?: boolean;
  enableConcurrentUploads?: boolean;
  maxConcurrentUploads?: number;
  enableRetry?: boolean;
  viewMode?: 'grid' | 'list';
  uploadPath?: string; // Custom upload endpoint path
  className?: string;
  onUploadComplete?: (file: MediaFile) => void;
  onUploadError?: (file: MediaFile, error: string) => void;
  enableThumbnails?: boolean;
  enableMetadataExtraction?: boolean;
}

const FILE_TYPE_CONFIG = {
  image: {
    icon: ImageIcon,
    color: 'blue',
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
    extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']
  },
  video: {
    icon: Video,
    color: 'purple',
    acceptedTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
    extensions: ['.mp4', '.mov', '.avi', '.webm']
  },
  audio: {
    icon: Music,
    color: 'green',
    acceptedTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
    extensions: ['.mp3', '.wav', '.ogg', '.m4a']
  },
  document: {
    icon: FileText,
    color: 'yellow',
    acceptedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.pdf', '.doc', '.docx']
  },
  archive: {
    icon: Archive,
    color: 'gray',
    acceptedTypes: ['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed'],
    extensions: ['.zip', '.rar']
  }
};

const DEFAULT_ACCEPTED_TYPES = Object.values(FILE_TYPE_CONFIG).flatMap(config => config.acceptedTypes);

export default function FileUpload({
  files,
  onChange,
  pitchId,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxFiles = 20,
  maxFileSize = 50, // 50MB default for media files
  disabled = false,
  showProgress = true,
  enableDragDrop = true,
  showPreview = true,
  enableConcurrentUploads = true,
  maxConcurrentUploads = 3,
  enableRetry = true,
  viewMode = 'grid',
  uploadPath = '/api/upload/media',
  className = '',
  onUploadComplete,
  onUploadError,
  enableThumbnails = true,
  enableMetadataExtraction = true
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentViewMode, setCurrentViewMode] = useState<'grid' | 'list'>(viewMode);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [activeUploads, setActiveUploads] = useState<Set<string>>(new Set());
  const [previewModal, setPreviewModal] = useState<{ file: MediaFile; isOpen: boolean }>({ file: null as any, isOpen: false });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const { success, error } = useToast();

  // Calculate upload statistics
  const uploadStatistics = useMemo(() => {
    const total = files.length;
    const completed = files.filter(f => f.uploadStatus === 'completed').length;
    const uploading = files.filter(f => f.uploadStatus === 'uploading').length;
    const failed = files.filter(f => f.uploadStatus === 'error').length;
    const pending = files.filter(f => f.uploadStatus === 'idle').length;
    const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);
    const uploadedSize = files
      .filter(f => f.uploadStatus === 'completed')
      .reduce((sum, f) => sum + f.file.size, 0);
    
    return {
      total,
      completed,
      uploading,
      failed,
      pending,
      totalSize,
      uploadedSize,
      progress: total > 0 ? (completed / total) * 100 : 0,
      sizeProgress: totalSize > 0 ? (uploadedSize / totalSize) * 100 : 0
    };
  }, [files]);

  // Detect file type based on MIME type
  const detectFileType = useCallback((file: File): MediaFile['type'] => {
    const mimeType = file.type;
    
    for (const [type, config] of Object.entries(FILE_TYPE_CONFIG)) {
      if (config.acceptedTypes.includes(mimeType)) {
        return type as MediaFile['type'];
      }
    }
    
    // Fallback to extension-based detection
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    for (const [type, config] of Object.entries(FILE_TYPE_CONFIG)) {
      if (config.extensions.includes(extension)) {
        return type as MediaFile['type'];
      }
    }
    
    return 'document'; // Default fallback
  }, []);

  // Validate file
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not supported.`
      };
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      return {
        valid: false,
        error: `File ${file.name} (${fileSizeMB.toFixed(1)}MB) exceeds the ${maxFileSize}MB limit.`
      };
    }

    // Check for duplicates
    const duplicate = files.find(f => 
      f.file.name === file.name && 
      f.file.size === file.size && 
      f.file.lastModified === file.lastModified
    );
    if (duplicate) {
      return {
        valid: false,
        error: `File ${file.name} has already been added.`
      };
    }

    return { valid: true };
  }, [acceptedTypes, maxFileSize, files]);

  // Extract file metadata
  const extractMetadata = useCallback(async (file: File, type: MediaFile['type']): Promise<MediaFile['metadata']> => {
    if (!enableMetadataExtraction) return {};

    return new Promise((resolve) => {
      if (type === 'image') {
        const img = new Image();
        img.onload = () => {
          resolve({
            width: img.width,
            height: img.height,
            size: file.size
          });
        };
        img.onerror = () => resolve({ size: file.size });
        img.src = URL.createObjectURL(file);
      } else if (type === 'video') {
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          resolve({
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
            size: file.size
          });
        };
        video.onerror = () => resolve({ size: file.size });
        video.src = URL.createObjectURL(file);
      } else if (type === 'audio') {
        const audio = document.createElement('audio');
        audio.onloadedmetadata = () => {
          resolve({
            duration: audio.duration,
            size: file.size
          });
        };
        audio.onerror = () => resolve({ size: file.size });
        audio.src = URL.createObjectURL(file);
      } else {
        resolve({ size: file.size });
      }
    });
  }, [enableMetadataExtraction]);

  // Generate thumbnail for images and videos
  const generateThumbnail = useCallback(async (file: File, type: MediaFile['type']): Promise<string | undefined> => {
    if (!enableThumbnails || (type !== 'image' && type !== 'video')) return undefined;

    return new Promise((resolve) => {
      if (type === 'image') {
        resolve(URL.createObjectURL(file));
      } else if (type === 'video') {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        video.onloadeddata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          video.currentTime = 1; // Seek to 1 second
        };
        
        video.onseeked = () => {
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
              if (blob) {
                resolve(URL.createObjectURL(blob));
              } else {
                resolve(undefined);
              }
            }, 'image/jpeg', 0.7);
          }
        };
        
        video.onerror = () => resolve(undefined);
        video.src = URL.createObjectURL(file);
      }
    });
  }, [enableThumbnails]);

  // Process files for upload
  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const fileArray = Array.from(fileList);
    
    // Check total file limit
    if (files.length + fileArray.length > maxFiles) {
      error('Too many files', `You can only upload up to ${maxFiles} files total.`);
      return;
    }

    const validFiles: MediaFile[] = [];
    const invalidFiles: string[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const validation = validateFile(file);
      
      if (validation.valid) {
        const type = detectFileType(file);
        const metadata = await extractMetadata(file, type);
        const thumbnailUrl = await generateThumbnail(file, type);
        
        validFiles.push({
          id: crypto.randomUUID(),
          type,
          file,
          title: file.name.replace(/\.[^/.]+$/, ""),
          description: '',
          uploadProgress: 0,
          uploadStatus: 'idle',
          retryCount: 0,
          order: files.length + i,
          metadata,
          thumbnailUrl
        });
      } else {
        invalidFiles.push(validation.error!);
      }
    }

    if (invalidFiles.length > 0) {
      invalidFiles.forEach(errorMsg => error('File validation failed', errorMsg));
    }

    if (validFiles.length > 0) {
      const newFiles = [...files, ...validFiles];
      onChange(newFiles);
      success('Files added', `${validFiles.length} file(s) ready for upload.`);
      
      // Auto-start uploads if concurrent uploading is enabled
      if (enableConcurrentUploads) {
        validFiles.forEach(file => {
          setUploadQueue(prev => [...prev, file.id]);
        });
      }
    }
  }, [files, maxFiles, validateFile, detectFileType, extractMetadata, generateThumbnail, onChange, error, success, enableConcurrentUploads]);

  // Handle file input change
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      processFiles(selectedFiles);
    }
    // Reset input value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && enableDragDrop) {
      setIsDragOver(true);
    }
  }, [disabled, enableDragDrop]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || !enableDragDrop) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }
  }, [disabled, enableDragDrop, processFiles]);

  // Update file
  const updateFile = useCallback((id: string, updates: Partial<MediaFile>) => {
    onChange(files.map(file => 
      file.id === id ? { ...file, ...updates } : file
    ));
  }, [files, onChange]);

  // Remove file
  const removeFile = useCallback((id: string) => {
    // Cancel upload if in progress
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
    
    // Remove from active uploads
    setActiveUploads(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    
    // Remove from queue
    setUploadQueue(prev => prev.filter(queueId => queueId !== id));
    
    // Remove from files
    onChange(files.filter(file => file.id !== id));
  }, [files, onChange]);

  // Upload file
  const uploadFile = useCallback(async (file: MediaFile) => {
    const controller = new AbortController();
    abortControllers.current.set(file.id, controller);
    
    setActiveUploads(prev => new Set([...prev, file.id]));
    updateFile(file.id, { 
      uploadStatus: 'uploading', 
      uploadProgress: 0,
      error: undefined
    });
    
    try {
      const result = await uploadService.uploadPitchMedia(
        pitchId || 0,
        file.file,
        file.type === 'image' ? 'image' : file.type === 'video' ? 'video' : 'document',
        {
          signal: controller.signal,
          onProgress: (progress) => {
            updateFile(file.id, { 
              uploadProgress: progress.percentage,
              uploadSpeed: progress.speed,
              estimatedTimeRemaining: progress.estimatedTimeRemaining
            });
          }
        }
      );
      
      updateFile(file.id, { 
        uploadStatus: 'completed', 
        uploadProgress: 100,
        url: result.url,
        uploadSpeed: undefined,
        estimatedTimeRemaining: undefined
      });
      
      success('Upload completed', `${file.title} uploaded successfully.`);
      onUploadComplete?.(file);
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        updateFile(file.id, { 
          uploadStatus: 'idle', 
          uploadProgress: 0,
          error: 'Upload cancelled'
        });
      } else {
        const retryCount = (file.retryCount || 0) + 1;
        updateFile(file.id, { 
          uploadStatus: 'error', 
          uploadProgress: 0,
          error: err.message || 'Upload failed',
          retryCount
        });
        
        error('Upload failed', err.message || `Failed to upload ${file.title}`);
        onUploadError?.(file, err.message || 'Upload failed');
      }
    } finally {
      abortControllers.current.delete(file.id);
      setActiveUploads(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      });
    }
  }, [updateFile, success, error, onUploadComplete, onUploadError]);

  // Utility functions
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  }, []);

  const formatSpeed = useCallback((bytesPerSecond: number): string => {
    if (bytesPerSecond < 1024) return `${Math.round(bytesPerSecond)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }, []);

  // Auto-upload queue management
  React.useEffect(() => {
    if (enableConcurrentUploads && uploadQueue.length > 0 && activeUploads.size < maxConcurrentUploads) {
      const nextUploadId = uploadQueue[0];
      const file = files.find(f => f.id === nextUploadId);
      
      if (file && file.uploadStatus === 'idle') {
        setUploadQueue(prev => prev.slice(1));
        uploadFile(file);
      }
    }
  }, [uploadQueue, activeUploads.size, maxConcurrentUploads, files, uploadFile, enableConcurrentUploads]);

  // Get file type configuration
  const getFileTypeConfig = useCallback((type: MediaFile['type']) => {
    return FILE_TYPE_CONFIG[type] || FILE_TYPE_CONFIG.document;
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Statistics */}
      {files.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Upload Progress</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {uploadStatistics.completed}/{uploadStatistics.total} files completed
              </span>
              <button
                onClick={() => setCurrentViewMode(currentViewMode === 'grid' ? 'list' : 'grid')}
                className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                title={`Switch to ${currentViewMode === 'grid' ? 'list' : 'grid'} view`}
              >
                {currentViewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{uploadStatistics.completed}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">{uploadStatistics.uploading}</div>
              <div className="text-xs text-gray-500">Uploading</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">{uploadStatistics.failed}</div>
              <div className="text-xs text-gray-500">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-600">{uploadStatistics.pending}</div>
              <div className="text-xs text-gray-500">Pending</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{uploadStatistics.progress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadStatistics.progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{formatFileSize(uploadStatistics.uploadedSize)} / {formatFileSize(uploadStatistics.totalSize)}</span>
              <span>Size Progress: {uploadStatistics.sizeProgress.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
          ${isDragOver && !disabled 
            ? 'border-purple-500 bg-purple-50' 
            : 'border-gray-300 hover:border-purple-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="space-y-4">
          <div className="flex justify-center">
            {isDragOver ? (
              <Upload className="w-12 h-12 text-purple-600 animate-bounce" />
            ) : (
              <Upload className="w-12 h-12 text-gray-400" />
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isDragOver ? 'Drop files here' : 'Upload Media Files'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {enableDragDrop 
                ? 'Drag and drop files here, or click to browse'
                : 'Click to browse and select files'
              }
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Supported: Images, Videos, Audio, Documents, Archives</p>
              <p>Max file size: {maxFileSize}MB • Max files: {maxFiles}</p>
              <p>Current: {files.length}/{maxFiles} files</p>
              {enableConcurrentUploads && (
                <p>Concurrent uploads: {activeUploads.size}/{maxConcurrentUploads} active</p>
              )}
            </div>
          </div>
          
          {!disabled && (
            <button
              type="button"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Choose Files
            </button>
          )}
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Media Files ({files.length})
            </h3>
            <div className="flex items-center gap-2">
              {files.some(f => f.uploadStatus === 'idle') && (
                <button
                  onClick={() => {
                    files
                      .filter(f => f.uploadStatus === 'idle')
                      .forEach((file, index) => {
                        if (enableConcurrentUploads) {
                          if (activeUploads.size + index < maxConcurrentUploads) {
                            uploadFile(file);
                          } else {
                            setUploadQueue(prev => [...prev, file.id]);
                          }
                        } else {
                          uploadFile(file);
                        }
                      });
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload All
                </button>
              )}
            </div>
          </div>
          
          <div className={currentViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
            {files.map((file, index) => {
              const typeConfig = getFileTypeConfig(file.type);
              const Icon = typeConfig.icon;
              
              return (
                <div 
                  key={file.id} 
                  className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className={`flex items-start gap-4 ${currentViewMode === 'grid' ? 'flex-col' : ''}`}>
                    {/* File Preview/Icon */}
                    <div className="flex-shrink-0">
                      {file.thumbnailUrl && showPreview ? (
                        <div className="relative">
                          <img 
                            src={file.thumbnailUrl} 
                            alt={file.title}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                          <button
                            onClick={() => setPreviewModal({ file, isOpen: true })}
                            className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 rounded-lg transition-opacity flex items-center justify-center"
                          >
                            <Maximize className="w-6 h-6 text-white opacity-0 hover:opacity-100 transition-opacity" />
                          </button>
                        </div>
                      ) : (
                        <div className={`p-3 rounded-lg bg-${typeConfig.color}-100`}>
                          <Icon className={`w-6 h-6 text-${typeConfig.color}-600`} />
                        </div>
                      )}
                    </div>
                    
                    {/* File Details */}
                    <div className={`flex-1 min-w-0 space-y-2 ${currentViewMode === 'grid' ? 'w-full' : ''}`}>
                      <input
                        type="text"
                        value={file.title}
                        onChange={(e) => updateFile(file.id, { title: e.target.value })}
                        placeholder="File title"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                      />
                      
                      <div className="text-sm text-gray-500">
                        <p className="truncate">{file.file.name} • {formatFileSize(file.file.size)}</p>
                        {file.metadata && (
                          <p className="text-xs">
                            {file.metadata.width && file.metadata.height && 
                              `${file.metadata.width}×${file.metadata.height}`
                            }
                            {file.metadata.duration && 
                              ` • ${formatTime(file.metadata.duration)}`
                            }
                          </p>
                        )}
                      </div>
                      
                      {/* Upload Progress */}
                      {file.uploadStatus === 'uploading' && showProgress && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>{file.uploadProgress?.toFixed(1)}%</span>
                            <div className="flex items-center gap-2">
                              {file.uploadSpeed && <span>{formatSpeed(file.uploadSpeed)}</span>}
                              {file.estimatedTimeRemaining && (
                                <span>ETA: {formatTime(file.estimatedTimeRemaining)}</span>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${file.uploadProgress || 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {file.uploadStatus === 'error' && file.error && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          {file.error}
                        </div>
                      )}
                      
                      {file.uploadStatus === 'completed' && (
                        <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                          Upload completed successfully
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className={`flex items-center gap-1 flex-shrink-0 ${currentViewMode === 'grid' ? 'w-full justify-center' : ''}`}>
                      {file.uploadStatus === 'idle' && (
                        <button
                          type="button"
                          onClick={() => uploadFile(file)}
                          className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded"
                          title="Upload file"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                      )}
                      
                      {showPreview && (file.url || file.thumbnailUrl) && (
                        <button
                          type="button"
                          onClick={() => setPreviewModal({ file, isOpen: true })}
                          className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded"
                          title="Preview file"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      
                      {file.uploadStatus === 'completed' && file.url && (
                        <button
                          type="button"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = file.url!;
                            link.download = file.file.name;
                            link.click();
                          }}
                          className="p-2 text-gray-500 hover:text-green-600 transition-colors rounded"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="p-2 text-gray-500 hover:text-red-600 transition-colors rounded"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {files.length === 0 && (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No media files uploaded yet</h3>
          <p className="text-gray-600 max-w-md mx-auto mb-4">
            Upload images, videos, audio files, and documents to enhance your content.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-lg mx-auto text-xs text-gray-500">
            <span className="bg-gray-50 px-2 py-1 rounded">Images</span>
            <span className="bg-gray-50 px-2 py-1 rounded">Videos</span>
            <span className="bg-gray-50 px-2 py-1 rounded">Audio</span>
            <span className="bg-gray-50 px-2 py-1 rounded">Documents</span>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewModal.isOpen && previewModal.file && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setPreviewModal({ file: null as any, isOpen: false })}>
          <div className="max-w-4xl max-h-4xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <button
                onClick={() => setPreviewModal({ file: null as any, isOpen: false })}
                className="absolute top-2 right-2 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
              
              {previewModal.file.type === 'image' && (
                <img 
                  src={previewModal.file.url || previewModal.file.thumbnailUrl} 
                  alt={previewModal.file.title}
                  className="max-w-full max-h-full object-contain"
                />
              )}
              
              {previewModal.file.type === 'video' && (
                <video 
                  src={previewModal.file.url} 
                  controls
                  className="max-w-full max-h-full"
                >
                  Your browser does not support the video tag.
                </video>
              )}
              
              {previewModal.file.type === 'audio' && (
                <div className="bg-white p-6 rounded-lg">
                  <h3 className="text-lg font-medium mb-4">{previewModal.file.title}</h3>
                  <audio src={previewModal.file.url} controls className="w-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}