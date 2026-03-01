import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Upload,
  FileText,
  File as FileIcon,
  Shield,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Loader,
  Plus,
  Eye,
  Download,
  Pause,
  RotateCcw,
  Trash2,
  FolderOpen,
  ChevronUp,
  ChevronDown,
  Grid,
  List
} from 'lucide-react';
import { useToast } from '@shared/components/feedback/ToastProvider';
import { uploadService } from '../../services/upload.service';

export interface DocumentFile {
  id: string;
  type: 'script' | 'treatment' | 'pitch_deck' | 'nda' | 'supporting_materials' | 'lookbook' | 'budget';
  file: File;
  title: string;
  description?: string;
  uploadProgress?: number;
  uploadStatus?: 'idle' | 'uploading' | 'completed' | 'error' | 'paused' | 'retrying';
  url?: string;
  error?: string;
  uploadSpeed?: number;
  estimatedTimeRemaining?: number;
  retryCount?: number;
  order?: number;
}

interface DocumentUploadProps {
  documents: DocumentFile[];
  onChange: (documents: DocumentFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  allowedTypes?: string[];
  disabled?: boolean;
  showProgress?: boolean;
  enableDragDrop?: boolean;
  showPreview?: boolean;
  className?: string;
  enableConcurrentUploads?: boolean;
  maxConcurrentUploads?: number;
  enableRetry?: boolean;
  showBulkActions?: boolean;
  viewMode?: 'grid' | 'list';
  onUploadComplete?: (document: DocumentFile) => void;
  onUploadError?: (document: DocumentFile, error: string) => void;
}

const DOCUMENT_TYPES = [
  { value: 'script', label: 'Script', icon: FileText, color: 'blue' },
  { value: 'treatment', label: 'Treatment', icon: FileText, color: 'green' },
  { value: 'pitch_deck', label: 'Pitch Deck', icon: FileIcon, color: 'purple' },
  { value: 'lookbook', label: 'Visual Lookbook', icon: ImageIcon, color: 'pink' },
  { value: 'budget', label: 'Budget Breakdown', icon: FileText, color: 'yellow' },
  { value: 'nda', label: 'NDA Document', icon: Shield, color: 'red' },
  { value: 'supporting_materials', label: 'Supporting Materials', icon: FileIcon, color: 'gray' }
] as const;

const DEFAULT_ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'application/zip',
  'application/x-zip-compressed'
];

const FILE_EXTENSIONS = {
  pdf: 'PDF',
  doc: 'Word',
  docx: 'Word',
  ppt: 'PowerPoint',
  pptx: 'PowerPoint',
  txt: 'Text',
  jpg: 'Image',
  jpeg: 'Image',
  png: 'Image',
  webp: 'Image',
  gif: 'Image',
  mp4: 'Video',
  mov: 'Video',
  avi: 'Video',
  zip: 'Archive'
};

export default function DocumentUpload({
  documents,
  onChange,
  maxFiles = 15,
  maxFileSize = 10,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  disabled = false,
  showProgress = true,
  enableDragDrop = true,
  showPreview = true,
  className = '',
  enableConcurrentUploads = true,
  maxConcurrentUploads = 3,
  enableRetry = true,
  showBulkActions = true,
  viewMode = 'list',
  onUploadComplete,
  onUploadError
}: DocumentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [_isUploading, _setIsUploading] = useState(false);
  const [currentViewMode, setCurrentViewMode] = useState<'grid' | 'list'>(viewMode);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [activeUploads, setActiveUploads] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const uploadStats = useRef<Map<string, { startTime: number; lastProgress: number; lastTime: number }>>(new Map());
  const { success, error } = useToast();

  // Calculate upload statistics
  const uploadStatistics = useMemo(() => {
    const total = documents.length;
    const completed = documents.filter(d => d.uploadStatus === 'completed').length;
    const uploading = documents.filter(d => d.uploadStatus === 'uploading').length;
    const failed = documents.filter(d => d.uploadStatus === 'error').length;
    const pending = documents.filter(d => d.uploadStatus === 'idle').length;
    const totalSize = documents.reduce((sum, d) => sum + d.file.size, 0);
    const uploadedSize = documents
      .filter(d => d.uploadStatus === 'completed')
      .reduce((sum, d) => sum + d.file.size, 0);
    
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
  }, [documents]);

  // Validate file type and size
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      const _fileExt = file.name.split('.').pop()?.toLowerCase();
      const supportedExtensions = Object.keys(FILE_EXTENSIONS).join(', ');
      return {
        valid: false,
        error: `File type not supported. Supported formats: ${supportedExtensions.toUpperCase()}`
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

    // Check for duplicate files
    const duplicate = documents.find(d => 
      d.file.name === file.name && 
      d.file.size === file.size && 
      d.file.lastModified === file.lastModified
    );
    if (duplicate) {
      return {
        valid: false,
        error: `File ${file.name} has already been added.`
      };
    }

    return { valid: true };
  }, [allowedTypes, maxFileSize, documents]);

  // Detect document type based on filename
  const detectDocumentType = useCallback((file: File): DocumentFile['type'] => {
    const name = file.name.toLowerCase();
    if (name.includes('script')) return 'script';
    if (name.includes('treatment')) return 'treatment';
    if (name.includes('deck') || name.includes('presentation')) return 'pitch_deck';
    if (name.includes('lookbook') || name.includes('visual')) return 'lookbook';
    if (name.includes('budget') || name.includes('finance')) return 'budget';
    if (name.includes('nda') || name.includes('agreement')) return 'nda';
    return 'supporting_materials';
  }, []);

  // Process files for upload
  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    // Check total file limit
    if (documents.length + fileArray.length > maxFiles) {
      error('Too many files', `You can only upload up to ${maxFiles} files total. Current: ${documents.length}, trying to add: ${fileArray.length}`);
      return;
    }

    const validFiles: DocumentFile[] = [];
    const invalidFiles: string[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const validation = validateFile(file);
      
      if (validation.valid) {
        validFiles.push({
          id: crypto.randomUUID(),
          type: detectDocumentType(file),
          file,
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          description: '',
          uploadProgress: 0,
          uploadStatus: 'idle',
          retryCount: 0,
          order: documents.length + i
        });
      } else {
        invalidFiles.push(validation.error!);
      }
    }

    if (invalidFiles.length > 0) {
      invalidFiles.forEach(errorMsg => error('File validation failed', errorMsg));
    }

    if (validFiles.length > 0) {
      const newDocuments = [...documents, ...validFiles];
      onChange(newDocuments);
      success('Files added', `${validFiles.length} file(s) ready for upload.`);
      
      // Auto-start uploads if concurrent uploading is enabled
      if (enableConcurrentUploads) {
        validFiles.forEach(doc => {
          setUploadQueue(prev => [...prev, doc.id]);
        });
      }
    }
  }, [documents, maxFiles, validateFile, detectDocumentType, onChange, error, success, enableConcurrentUploads]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files !== null && files.length > 0) {
      void processFiles(files);
    }
    // Reset input value to allow selecting the same file again
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

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      void processFiles(files);
    }
  }, [disabled, enableDragDrop, processFiles]);

  // Update document
  const updateDocument = useCallback((id: string, updates: Partial<DocumentFile>) => {
    onChange(documents.map(doc => 
      doc.id === id ? { ...doc, ...updates } : doc
    ));
  }, [documents, onChange]);

  // Remove document
  const removeDocument = useCallback((id: string) => {
    onChange(documents.filter(doc => doc.id !== id));
  }, [documents, onChange]);

  // Get document icon and color
  const getDocumentInfo = useCallback((type: DocumentFile['type']) => {
    const docType = DOCUMENT_TYPES.find(dt => dt.value === type);
    return docType || DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1]; // Default to supporting materials
  }, []);

  // Upload document to server with enhanced features
  const uploadDocument = useCallback(async (document: DocumentFile) => {
    const controller = new AbortController();
    abortControllers.current.set(document.id, controller);
    
    // Initialize upload stats
    uploadStats.current.set(document.id, {
      startTime: Date.now(),
      lastProgress: 0,
      lastTime: Date.now()
    });
    
    setActiveUploads(prev => new Set([...prev, document.id]));
    updateDocument(document.id, { 
      uploadStatus: 'uploading', 
      uploadProgress: 0,
      error: undefined
    });
    
    try {
      const result = await uploadService.uploadDocument(
        document.file,
        document.type,
        {
          signal: controller.signal,
          onProgress: (progress) => {
            const stats = uploadStats.current.get(document.id);
            if (stats) {
              const now = Date.now();
              const timeDiff = (now - stats.lastTime) / 1000; // seconds
              const progressDiff = progress.percentage - stats.lastProgress;
              
              if (timeDiff > 0 && progressDiff > 0) {
                const speed = (progressDiff / 100 * document.file.size) / timeDiff; // bytes per second
                const remainingBytes = document.file.size * (1 - progress.percentage / 100);
                const estimatedTimeRemaining = remainingBytes / speed; // seconds
                
                updateDocument(document.id, { 
                  uploadProgress: progress.percentage,
                  uploadSpeed: speed,
                  estimatedTimeRemaining
                });
                
                stats.lastProgress = progress.percentage;
                stats.lastTime = now;
              } else {
                updateDocument(document.id, { uploadProgress: progress.percentage });
              }
            }
          }
        }
      );
      
      updateDocument(document.id, { 
        uploadStatus: 'completed', 
        uploadProgress: 100,
        url: result.url,
        uploadSpeed: undefined,
        estimatedTimeRemaining: undefined
      });
      
      abortControllers.current.delete(document.id);
      uploadStats.current.delete(document.id);
      setActiveUploads(prev => {
        const newSet = new Set(prev);
        newSet.delete(document.id);
        return newSet;
      });
      
      success('Upload completed', `${document.title} uploaded successfully.`);
      onUploadComplete?.(document);
      
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (e.name === 'AbortError') {
        updateDocument(document.id, {
          uploadStatus: 'idle',
          uploadProgress: 0,
          error: 'Upload cancelled'
        });
      } else {
        const retryCount = (document.retryCount ?? 0) + 1;
        updateDocument(document.id, {
          uploadStatus: 'error',
          uploadProgress: 0,
          error: e.message !== '' ? e.message : 'Upload failed',
          retryCount
        });

        error('Upload failed', e.message !== '' ? e.message : `Failed to upload ${document.title}`);
        onUploadError?.(document, e.message !== '' ? e.message : 'Upload failed');
      }
      
      abortControllers.current.delete(document.id);
      uploadStats.current.delete(document.id);
      setActiveUploads(prev => {
        const newSet = new Set(prev);
        newSet.delete(document.id);
        return newSet;
      });
    }
  }, [updateDocument, success, error, onUploadComplete, onUploadError]);

  // Enhanced file utilities
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

  // Bulk actions
  const selectAllDocuments = useCallback(() => {
    setSelectedDocuments(new Set(documents.map(d => d.id)));
  }, [documents]);

  const clearSelection = useCallback(() => {
    setSelectedDocuments(new Set());
  }, []);

  const bulkUpload = useCallback(() => {
    const selectedDocs = documents.filter(d => 
      selectedDocuments.has(d.id) && d.uploadStatus === 'idle'
    );
    selectedDocs.forEach(doc => {
      if (activeUploads.size < maxConcurrentUploads) {
        void uploadDocument(doc);
      } else {
        setUploadQueue(prev => [...prev, doc.id]);
      }
    });
    clearSelection();
  }, [documents, selectedDocuments, activeUploads.size, maxConcurrentUploads, uploadDocument, clearSelection]);

  const bulkDelete = useCallback(() => {
    onChange(documents.filter(d => !selectedDocuments.has(d.id)));
    clearSelection();
    success('Documents removed', `${selectedDocuments.size} document(s) removed.`);
  }, [documents, selectedDocuments, onChange, clearSelection, success]);

  const pauseUpload = useCallback((documentId: string) => {
    const controller = abortControllers.current.get(documentId);
    if (controller) {
      controller.abort();
      updateDocument(documentId, { uploadStatus: 'paused' });
    }
  }, [updateDocument]);

  const _resumeUpload = useCallback((documentId: string) => {
    const document = documents.find(d => d.id === documentId);
    if (document !== undefined && document.uploadStatus === 'paused') {
      void uploadDocument(document);
    }
  }, [documents, uploadDocument]);

  const retryUpload = useCallback((documentId: string) => {
    const document = documents.find(d => d.id === documentId);
    if (document !== undefined && (document.uploadStatus === 'error' || document.uploadStatus === 'paused')) {
      void uploadDocument(document);
    }
  }, [documents, uploadDocument]);

  const reorderDocument = useCallback((dragIndex: number, hoverIndex: number) => {
    const newDocuments = [...documents];
    const draggedDocument = newDocuments[dragIndex];
    newDocuments.splice(dragIndex, 1);
    newDocuments.splice(hoverIndex, 0, draggedDocument);
    
    // Update order property
    newDocuments.forEach((doc, index) => {
      doc.order = index;
    });
    
    onChange(newDocuments);
  }, [documents, onChange]);

  // Auto-upload queue management
  React.useEffect(() => {
    if (enableConcurrentUploads && uploadQueue.length > 0 && activeUploads.size < maxConcurrentUploads) {
      const nextUploadId = uploadQueue[0];
      const document = documents.find(d => d.id === nextUploadId);
      
      if (document !== undefined && document.uploadStatus === 'idle') {
        setUploadQueue(prev => prev.slice(1));
        void uploadDocument(document);
      }
    }
  }, [uploadQueue, activeUploads.size, maxConcurrentUploads, documents, uploadDocument, enableConcurrentUploads]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Statistics */}
      {documents.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Upload Progress</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {uploadStatistics.completed}/{uploadStatistics.total} files completed
              </span>
              {showBulkActions && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentViewMode(currentViewMode === 'grid' ? 'list' : 'grid')}
                    className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                    title={`Switch to ${currentViewMode === 'grid' ? 'list' : 'grid'} view`}
                  >
                    {currentViewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
                  </button>
                </div>
              )}
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
      {/* Bulk Actions */}
      {showBulkActions && documents.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={selectedDocuments.size === documents.length && documents.length > 0}
                onChange={(e) => e.target.checked ? selectAllDocuments() : clearSelection()}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              Select All ({selectedDocuments.size}/{documents.length})
            </label>
          </div>
          
          {selectedDocuments.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={bulkUpload}
                disabled={!Array.from(selectedDocuments).some(id => 
                  documents.find(d => d.id === id)?.uploadStatus === 'idle'
                )}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload Selected ({Array.from(selectedDocuments).filter(id => 
                  documents.find(d => d.id === id)?.uploadStatus === 'idle'
                ).length})
              </button>
              <button
                onClick={bulkDelete}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                Remove Selected
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
              >
                Clear Selection
              </button>
            </div>
          )}
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
          accept={allowedTypes.join(',')}
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
              {isDragOver ? 'Drop files here' : 'Upload Documents'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {enableDragDrop 
                ? 'Drag and drop files here, or click to browse'
                : 'Click to browse and select files'
              }
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Supported: {Object.entries(FILE_EXTENSIONS).map(([ext, _type]) => ext.toUpperCase()).join(', ')}</p>
              <p>Max file size: {maxFileSize}MB • Max files: {maxFiles}</p>
              <p>Current: {documents.length}/{maxFiles} files</p>
              {enableConcurrentUploads && (
                <p>Concurrent uploads: {activeUploads.size}/{maxConcurrentUploads} active</p>
              )}
            </div>
          </div>
          
          {!disabled && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              <Plus className="w-4 h-4" />
              Choose Files
            </button>
          )}
        </div>
      </div>

      {/* Document Types Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {DOCUMENT_TYPES.map(({ value, label, icon: Icon, color }) => {
          const colorClasses = {
            blue: 'bg-blue-50 border-blue-200 text-blue-600 text-blue-900',
            green: 'bg-green-50 border-green-200 text-green-600 text-green-900',
            purple: 'bg-purple-50 border-purple-200 text-purple-600 text-purple-900',
            pink: 'bg-pink-50 border-pink-200 text-pink-600 text-pink-900',
            yellow: 'bg-yellow-50 border-yellow-200 text-yellow-600 text-yellow-900',
            red: 'bg-red-50 border-red-200 text-red-600 text-red-900',
            gray: 'bg-gray-50 border-gray-200 text-gray-600 text-gray-900'
          };
          
          const classes = colorClasses[color as keyof typeof colorClasses] || colorClasses.gray;
          const [bgClass, borderClass, iconClass, textClass] = classes.split(' ');
          
          return (
            <div 
              key={value}
              className={`p-3 rounded-lg text-center text-sm ${bgClass} border ${borderClass}`}
            >
              <Icon className={`w-5 h-5 mx-auto mb-1 ${iconClass}`} />
              <p className={`font-medium ${textClass}`}>{label}</p>
            </div>
          );
        })}
      </div>

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Documents ({documents.length})
            </h3>
            <div className="flex items-center gap-2">
              {documents.some(doc => doc.uploadStatus === 'idle') && (
                <button
                  onClick={() => {
                    documents
                      .filter(doc => doc.uploadStatus === 'idle')
                      .forEach((doc, index) => {
                        if (enableConcurrentUploads) {
                          if (activeUploads.size + index < maxConcurrentUploads) {
                            void uploadDocument(doc);
                          } else {
                            setUploadQueue(prev => [...prev, doc.id]);
                          }
                        } else {
                          void uploadDocument(doc);
                        }
                      });
                  }}
                  disabled={_isUploading && !enableConcurrentUploads}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload All Pending
                </button>
              )}
              {documents.some(doc => doc.uploadStatus === 'uploading') && (
                <button
                  onClick={() => {
                    documents
                      .filter(doc => doc.uploadStatus === 'uploading')
                      .forEach(doc => pauseUpload(doc.id));
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2"
                >
                  <Pause className="w-4 h-4" />
                  Pause All
                </button>
              )}
              {documents.some(doc => doc.uploadStatus === 'error') && (
                <button
                  onClick={() => {
                    documents
                      .filter(doc => doc.uploadStatus === 'error')
                      .forEach(doc => retryUpload(doc.id));
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry Failed
                </button>
              )}
            </div>
          </div>
          
          <div className={currentViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
            {documents.map((document, index) => {
              const docInfo = getDocumentInfo(document.type);
              const Icon = docInfo.icon;
              const isSelected = selectedDocuments.has(document.id);
              
              const colorClasses = {
                blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
                green: { bg: 'bg-green-100', text: 'text-green-600' },
                purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
                pink: { bg: 'bg-pink-100', text: 'text-pink-600' },
                yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
                red: { bg: 'bg-red-100', text: 'text-red-600' },
                gray: { bg: 'bg-gray-100', text: 'text-gray-600' }
              };
              
              const colors = colorClasses[docInfo.color as keyof typeof colorClasses] || colorClasses.gray;
              
              return (
                <div 
                  key={document.id} 
                  className={`p-4 bg-white border-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
                    isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                  } ${document.uploadStatus === 'uploading' ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
                >
                  <div className={`flex items-start gap-4 ${currentViewMode === 'grid' ? 'flex-col' : ''}`}>
                    {/* Selection and Document Icon */}
                    <div className="flex items-center gap-3">
                      {showBulkActions && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDocuments(prev => new Set([...prev, document.id]));
                            } else {
                              setSelectedDocuments(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(document.id);
                                return newSet;
                              });
                            }
                          }}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      )}
                      <div className={`p-3 rounded-lg ${colors.bg} flex-shrink-0 relative`}>
                        <Icon className={`w-6 h-6 ${colors.text}`} />
                        {/* Status indicator */}
                        <div className="absolute -top-1 -right-1">
                          {document.uploadStatus === 'completed' && (
                            <CheckCircle className="w-5 h-5 text-green-600 bg-white rounded-full" />
                          )}
                          {document.uploadStatus === 'error' && (
                            <AlertCircle className="w-5 h-5 text-red-600 bg-white rounded-full" />
                          )}
                          {document.uploadStatus === 'uploading' && (
                            <Loader className="w-5 h-5 text-blue-600 bg-white rounded-full animate-spin" />
                          )}
                          {document.uploadStatus === 'paused' && (
                            <Pause className="w-5 h-5 text-yellow-600 bg-white rounded-full" />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Document Details */}
                    <div className={`flex-1 min-w-0 space-y-3 ${currentViewMode === 'grid' ? 'w-full' : ''}`}>
                      {/* Title and Type */}
                      <div className={`grid gap-3 ${currentViewMode === 'grid' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                        <input
                          type="text"
                          value={document.title}
                          onChange={(e) => updateDocument(document.id, { title: e.target.value })}
                          placeholder="Document title"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        />
                        <select
                          value={document.type}
                          onChange={(e) => updateDocument(document.id, { 
                            type: e.target.value as DocumentFile['type'] 
                          })}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        >
                          {DOCUMENT_TYPES.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Description (only in list view) */}
                      {currentViewMode === 'list' && (
                        <textarea
                          value={document.description || ''}
                          onChange={(e) => updateDocument(document.id, { description: e.target.value })}
                          placeholder="Brief description (optional)"
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        />
                      )}
                      
                      {/* File Info */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <span className="truncate">{document.file.name}</span>
                          <span>{formatFileSize(document.file.size)}</span>
                        </div>
                        
                        {/* Upload Status Details */}
                        {document.uploadStatus === 'uploading' && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>{document.uploadProgress?.toFixed(1)}%</span>
                              <div className="flex items-center gap-2">
                                {document.uploadSpeed && (
                                  <span>{formatSpeed(document.uploadSpeed)}</span>
                                )}
                                {document.estimatedTimeRemaining && document.estimatedTimeRemaining > 0 && (
                                  <span>ETA: {formatTime(document.estimatedTimeRemaining)}</span>
                                )}
                              </div>
                            </div>
                            {showProgress && (
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${document.uploadProgress || 0}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                        
                        {document.uploadStatus === 'error' && document.error && (
                          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            {document.error}
                            {enableRetry && document.retryCount && document.retryCount > 0 && (
                              <span className="ml-2">(Retry {document.retryCount})</span>
                            )}
                          </div>
                        )}
                        
                        {document.uploadStatus === 'completed' && (
                          <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                            Upload completed successfully
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className={`flex items-center gap-1 flex-shrink-0 ${currentViewMode === 'grid' ? 'w-full justify-center' : ''}`}>
                      {showPreview && document.url && (
                        <button
                          type="button"
                          onClick={() => window.open(document.url, '_blank')}
                          className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded"
                          title="Preview document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      
                      {document.uploadStatus === 'completed' && document.url && (
                        <button
                          type="button"
                          onClick={() => {
                            const link = window.document.createElement('a');
                            link.href = document.url!;
                            link.download = document.file.name;
                            link.click();
                          }}
                          className="p-2 text-gray-500 hover:text-green-600 transition-colors rounded"
                          title="Download document"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      
                      {document.uploadStatus === 'idle' && (
                        <button
                          type="button"
                          onClick={() => { void uploadDocument(document); }}
                          className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded"
                          title="Upload document"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                      )}
                      
                      {document.uploadStatus === 'uploading' && (
                        <button
                          type="button"
                          onClick={() => pauseUpload(document.id)}
                          className="p-2 text-gray-500 hover:text-yellow-600 transition-colors rounded"
                          title="Pause upload"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      
                      {(document.uploadStatus === 'paused' || document.uploadStatus === 'error') && enableRetry && (
                        <button
                          type="button"
                          onClick={() => retryUpload(document.id)}
                          className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded"
                          title="Retry upload"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      
                      {currentViewMode === 'list' && index > 0 && (
                        <button
                          type="button"
                          onClick={() => reorderDocument(index, index - 1)}
                          className="p-2 text-gray-500 hover:text-gray-700 transition-colors rounded"
                          title="Move up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                      )}
                      
                      {currentViewMode === 'list' && index < documents.length - 1 && (
                        <button
                          type="button"
                          onClick={() => reorderDocument(index, index + 1)}
                          className="p-2 text-gray-500 hover:text-gray-700 transition-colors rounded"
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => removeDocument(document.id)}
                        className="p-2 text-gray-500 hover:text-red-600 transition-colors rounded"
                        title="Remove document"
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
      {documents.length === 0 && (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents uploaded yet</h3>
          <p className="text-gray-600 max-w-md mx-auto mb-4">
            Upload scripts, treatments, pitch decks, visual lookbooks, and supporting materials to enhance your pitch presentation.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-lg mx-auto text-xs text-gray-500">
            <span className="bg-gray-50 px-2 py-1 rounded">Scripts</span>
            <span className="bg-gray-50 px-2 py-1 rounded">Treatments</span>
            <span className="bg-gray-50 px-2 py-1 rounded">Pitch Decks</span>
            <span className="bg-gray-50 px-2 py-1 rounded">Lookbooks</span>
          </div>
        </div>
      )}
    </div>
  );
}