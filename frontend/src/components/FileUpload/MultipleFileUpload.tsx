import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { 
  Upload, 
  X, 
  Image as ImageIcon,
  Video,
  FileText,
  Archive,
  CheckCircle,
  AlertCircle,
  Loader,
  Plus,
  Eye,
  Download,
  Edit3,
  Copy,
  Trash2,
  Play,
  Pause,
  Grid,
  List,
  Filter,
  Search,
  FolderPlus
} from 'lucide-react';
import { useToast } from '@shared/components/feedback/ToastProvider';
import { uploadService, UploadResult, UploadProgress } from '../../services/upload.service';

export interface EnhancedMediaFile {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'archive';
  file: File;
  originalName: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  uploadProgress?: number;
  uploadStatus?: 'idle' | 'uploading' | 'completed' | 'error' | 'paused' | 'queued';
  url?: string;
  thumbnailUrl?: string;
  error?: string;
  uploadSpeed?: number;
  estimatedTimeRemaining?: number;
  retryCount?: number;
  order?: number;
  isRenamed?: boolean;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    size: number;
  };
  folder?: string;
  isPublic?: boolean;
  requiresNda?: boolean;
}

interface MultipleFileUploadProps {
  files: EnhancedMediaFile[];
  onChange: (files: EnhancedMediaFile[]) => void;
  acceptedTypes?: string[];
  maxFiles?: number;
  maxFileSize?: number; // in MB
  disabled?: boolean;
  showProgress?: boolean;
  enableDragDrop?: boolean;
  enableBulkActions?: boolean;
  enableCategorization?: boolean;
  enableRenaming?: boolean;
  enableFiltering?: boolean;
  allowedFolders?: string[];
  defaultFolder?: string;
  viewMode?: 'grid' | 'list';
  onUploadComplete?: (file: EnhancedMediaFile) => void;
  onUploadError?: (file: EnhancedMediaFile, error: string) => void;
  onBulkUpload?: (files: EnhancedMediaFile[]) => void;
  className?: string;
}

const FILE_CATEGORIES = [
  { id: 'script', name: 'Script', icon: FileText, color: 'blue' },
  { id: 'treatment', name: 'Treatment', icon: FileText, color: 'green' },
  { id: 'pitch-deck', name: 'Pitch Deck', icon: FileText, color: 'purple' },
  { id: 'budget', name: 'Budget', icon: FileText, color: 'yellow' },
  { id: 'storyboard', name: 'Storyboard', icon: ImageIcon, color: 'pink' },
  { id: 'mood-board', name: 'Mood Board', icon: ImageIcon, color: 'indigo' },
  { id: 'concept-art', name: 'Concept Art', icon: ImageIcon, color: 'red' },
  { id: 'reference', name: 'Reference', icon: Archive, color: 'gray' },
  { id: 'legal', name: 'Legal Document', icon: FileText, color: 'orange' },
  { id: 'other', name: 'Other', icon: FileText, color: 'slate' }
];

const PREDEFINED_FOLDERS = [
  { id: 'scripts', name: '📄 Scripts', description: 'Final Draft, PDF scripts' },
  { id: 'treatments', name: '📋 Treatments', description: 'Story treatments and outlines' },
  { id: 'pitch-materials', name: '🎯 Pitch Materials', description: 'Pitch decks and presentations' },
  { id: 'visual-assets', name: '🎨 Visual Assets', description: 'Images, artwork, storyboards' },
  { id: 'financial', name: '💰 Financial', description: 'Budgets and financial documents' },
  { id: 'legal', name: '⚖️ Legal', description: 'Contracts, NDAs, legal docs' },
  { id: 'reference', name: '📚 Reference', description: 'Research and reference materials' }
];

export default function MultipleFileUpload({
  files,
  onChange,
  acceptedTypes = ['*/*'],
  maxFiles = 50,
  maxFileSize = 100, // 100MB default
  disabled = false,
  showProgress = true,
  enableDragDrop = true,
  enableBulkActions = true,
  enableCategorization = true,
  enableRenaming = true,
  enableFiltering = true,
  allowedFolders = PREDEFINED_FOLDERS.map(f => f.id),
  defaultFolder = 'reference',
  viewMode = 'grid',
  onUploadComplete,
  onUploadError,
  onBulkUpload,
  className = ''
}: MultipleFileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentViewMode, setCurrentViewMode] = useState(viewMode);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [activeUploads, setActiveUploads] = useState<Map<string, AbortController>>(new Map());
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(defaultFolder);
  const [isUploading, setIsUploading] = useState(false);
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error } = useToast();

  // Filter files based on search and category
  const filteredFiles = useMemo(() => {
    let filtered = files;

    if (searchQuery) {
      filtered = filtered.filter(file => 
        file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.originalName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(file => file.category === filterCategory);
    }

    return filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [files, searchQuery, filterCategory]);

  // Upload statistics
  const uploadStats = useMemo(() => {
    const total = files.length;
    const completed = files.filter(f => f.uploadStatus === 'completed').length;
    const uploading = files.filter(f => f.uploadStatus === 'uploading').length;
    const failed = files.filter(f => f.uploadStatus === 'error').length;
    const pending = files.filter(f => f.uploadStatus === 'idle' || f.uploadStatus === 'queued').length;
    
    return { total, completed, uploading, failed, pending };
  }, [files]);

  // Detect file type
  const detectFileType = useCallback((file: File): EnhancedMediaFile['type'] => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed'].includes(file.type)) {
      return 'archive';
    }
    return 'document';
  }, []);

  // Process dropped/selected files
  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList);
    
    if (files.length + newFiles.length > maxFiles) {
      error('Too Many Files', `Maximum ${maxFiles} files allowed. You're trying to add ${newFiles.length} files to existing ${files.length}.`);
      return;
    }

    const processedFiles: EnhancedMediaFile[] = [];

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      
      // Validate file size
      if (file.size > maxFileSize * 1024 * 1024) {
        error('File Too Large', `${file.name} exceeds ${maxFileSize}MB limit`);
        continue;
      }

      // Check for duplicates
      const isDuplicate = files.some(existingFile => 
        existingFile.originalName === file.name && 
        existingFile.metadata?.size === file.size
      );

      if (isDuplicate) {
        error('Duplicate File', `${file.name} has already been added`);
        continue;
      }

      const fileType = detectFileType(file);
      const enhancedFile: EnhancedMediaFile = {
        id: `file-${Date.now()}-${i}`,
        type: fileType,
        file,
        originalName: file.name,
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        description: '',
        category: 'other', // Default category
        tags: [],
        uploadStatus: 'queued',
        uploadProgress: 0,
        retryCount: 0,
        order: files.length + i,
        isRenamed: false,
        metadata: {
          size: file.size,
          // Additional metadata will be extracted later
        },
        folder: selectedFolder,
        isPublic: false,
        requiresNda: false
      };

      processedFiles.push(enhancedFile);
    }

    if (processedFiles.length > 0) {
      const updatedFiles = [...files, ...processedFiles];
      onChange(updatedFiles);
      success('Files Added', `${processedFiles.length} file(s) ready for upload`);
    }
  }, [files, maxFiles, maxFileSize, selectedFolder, onChange, error, success, detectFileType]);

  // Upload a single file
  const uploadFile = useCallback(async (fileData: EnhancedMediaFile) => {
    const controller = new AbortController();
    setActiveUploads(prev => new Map(prev.set(fileData.id, controller)));
    
    // Update status
    onChange(files.map(f => 
      f.id === fileData.id 
        ? { ...f, uploadStatus: 'uploading', uploadProgress: 0, error: undefined }
        : f
    ));

    try {
      const result = await uploadService.uploadDocument(fileData.file, fileData.category || 'document', {
        folder: fileData.folder,
        isPublic: fileData.isPublic,
        requiresNda: fileData.requiresNda,
        signal: controller.signal,
        onProgress: (progress: UploadProgress) => {
          onChange(files.map(f => 
            f.id === fileData.id 
              ? { 
                  ...f, 
                  uploadProgress: progress.percentage,
                  uploadSpeed: progress.speed,
                  estimatedTimeRemaining: progress.estimatedTimeRemaining
                }
              : f
          ));
        },
        metadata: {
          originalName: fileData.originalName,
          customTitle: fileData.title,
          description: fileData.description,
          category: fileData.category,
          tags: fileData.tags?.join(','),
          isRenamed: fileData.isRenamed
        }
      });

      // Update with successful result
      onChange(files.map(f => 
        f.id === fileData.id 
          ? { 
              ...f, 
              uploadStatus: 'completed', 
              uploadProgress: 100,
              url: result.url,
              uploadSpeed: undefined,
              estimatedTimeRemaining: undefined
            }
          : f
      ));

      onUploadComplete?.(fileData);

    } catch (uploadError: any) {
      if (uploadError.name === 'AbortError') {
        // Upload was cancelled
        onChange(files.map(f => 
          f.id === fileData.id 
            ? { ...f, uploadStatus: 'idle', uploadProgress: 0 }
            : f
        ));
      } else {
        // Upload failed
        const retryCount = (fileData.retryCount || 0) + 1;
        onChange(files.map(f => 
          f.id === fileData.id 
            ? { 
                ...f, 
                uploadStatus: 'error', 
                uploadProgress: 0,
                error: uploadError.message,
                retryCount
              }
            : f
        ));
        
        onUploadError?.(fileData, uploadError.message);
      }
    } finally {
      setActiveUploads(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileData.id);
        return newMap;
      });
    }
  }, [files, onChange, onUploadComplete, onUploadError]);

  // Start bulk upload
  const startBulkUpload = useCallback(async () => {
    const filesToUpload = files.filter(f => 
      f.uploadStatus === 'queued' || f.uploadStatus === 'idle'
    );

    if (filesToUpload.length === 0) {
      error('No Files to Upload', 'All files have already been uploaded');
      return;
    }

    setIsUploading(true);

    try {
      // Upload files in parallel with concurrency limit
      const concurrencyLimit = 3;
      const results = [];
      
      for (let i = 0; i < filesToUpload.length; i += concurrencyLimit) {
        const batch = filesToUpload.slice(i, i + concurrencyLimit);
        const batchPromises = batch.map(file => uploadFile(file));
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
      }

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed === 0) {
        success('Upload Complete', `All ${successful} files uploaded successfully`);
      } else {
        error('Some Uploads Failed', `${successful} succeeded, ${failed} failed`);
      }

      onBulkUpload?.(filesToUpload);

    } catch (err: any) {
      error('Upload Error', err.message || 'Bulk upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [files, uploadFile, success, error, onBulkUpload]);

  // Update file details
  const updateFile = useCallback((id: string, updates: Partial<EnhancedMediaFile>) => {
    onChange(files.map(file => 
      file.id === id ? { ...file, ...updates } : file
    ));
  }, [files, onChange]);

  // Remove file
  const removeFile = useCallback((id: string) => {
    // Cancel upload if in progress
    const controller = activeUploads.get(id);
    if (controller) {
      controller.abort();
      setActiveUploads(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    }
    
    onChange(files.filter(file => file.id !== id));
  }, [files, activeUploads, onChange]);

  // Bulk actions
  const bulkRemove = useCallback(() => {
    const idsToRemove = Array.from(selectedFiles);
    idsToRemove.forEach(id => removeFile(id));
    setSelectedFiles(new Set());
  }, [selectedFiles, removeFile]);

  const bulkUpdateCategory = useCallback((category: string) => {
    const updatedFiles = files.map(file => 
      selectedFiles.has(file.id) ? { ...file, category } : file
    );
    onChange(updatedFiles);
    setSelectedFiles(new Set());
  }, [files, selectedFiles, onChange]);

  // Handle file input
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      processFiles(selectedFiles);
    }
    // Reset input
    e.target.value = '';
  }, [processFiles]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }
  }, [disabled, processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Document Upload</h3>
            <p className="text-sm text-gray-500 mt-1">
              Upload multiple files, organize into folders, and manage your content
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {enableFiltering && (
              <button
                onClick={() => setCurrentViewMode(currentViewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title={`Switch to ${currentViewMode === 'grid' ? 'list' : 'grid'} view`}
              >
                {currentViewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Upload Statistics */}
        {uploadStats.total > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Progress: {uploadStats.completed}/{uploadStats.total} files completed
              </div>
              <div className="flex items-center gap-4 text-sm">
                {uploadStats.uploading > 0 && (
                  <span className="text-blue-600">
                    <Loader className="w-4 h-4 inline animate-spin mr-1" />
                    {uploadStats.uploading} uploading
                  </span>
                )}
                {uploadStats.failed > 0 && (
                  <span className="text-red-600">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    {uploadStats.failed} failed
                  </span>
                )}
              </div>
            </div>
            
            {uploadStats.total > 0 && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadStats.completed / uploadStats.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Folder Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload to Folder
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {PREDEFINED_FOLDERS.filter(folder => allowedFolders.includes(folder.id)).map(folder => (
              <label key={folder.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                <input
                  type="radio"
                  name="folder"
                  value={folder.id}
                  checked={selectedFolder === folder.id}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{folder.name}</div>
                  <div className="text-xs text-gray-500 truncate">{folder.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block">
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  isDragOver
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {isDragOver
                    ? 'Drop files here'
                    : 'Drag & drop files here, or click to browse'
                  }
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Max {maxFileSize}MB per file • Up to {maxFiles} files
                </p>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptedTypes.join(',')}
                onChange={handleFileSelect}
                disabled={disabled}
                className="hidden"
              />
            </label>
          </div>

          {files.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                onClick={startBulkUpload}
                disabled={disabled || isUploading || uploadStats.pending === 0}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  disabled || isUploading || uploadStats.pending === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader className="w-4 h-4 inline animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 inline mr-2" />
                    Upload All ({uploadStats.pending})
                  </>
                )}
              </button>

              {enableBulkActions && selectedFiles.size > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={bulkRemove}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-3 h-3 inline mr-1" />
                    Remove ({selectedFiles.size})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      {files.length > 0 && enableFiltering && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {FILE_CATEGORIES.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* File List */}
      {filteredFiles.length > 0 && (
        <div className="p-6">
          <div className={`${
            currentViewMode === 'grid' 
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-2'
          }`}>
            {filteredFiles.map(file => (
              <FileItem
                key={file.id}
                file={file}
                viewMode={currentViewMode}
                isSelected={selectedFiles.has(file.id)}
                onSelect={(id, selected) => {
                  setSelectedFiles(prev => {
                    const newSet = new Set(prev);
                    if (selected) {
                      newSet.add(id);
                    } else {
                      newSet.delete(id);
                    }
                    return newSet;
                  });
                }}
                onUpdate={(id, updates) => updateFile(id, updates)}
                onRemove={(id) => removeFile(id)}
                onRetry={() => uploadFile(file)}
                enableSelection={enableBulkActions}
                enableRenaming={enableRenaming}
                enableCategorization={enableCategorization}
                categories={FILE_CATEGORIES}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {files.length === 0 && (
        <div className="p-12 text-center text-gray-500">
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">No files uploaded yet</p>
          <p className="text-sm">Upload your first files to get started</p>
        </div>
      )}
    </div>
  );
}

// Individual file item component
interface FileItemProps {
  file: EnhancedMediaFile;
  viewMode: 'grid' | 'list';
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onUpdate: (id: string, updates: Partial<EnhancedMediaFile>) => void;
  onRemove: (id: string) => void;
  onRetry: () => void;
  enableSelection: boolean;
  enableRenaming: boolean;
  enableCategorization: boolean;
  categories: Array<{ id: string; name: string; icon: any; color: string }>;
  disabled: boolean;
}

function FileItem({
  file,
  viewMode,
  isSelected,
  onSelect,
  onUpdate,
  onRemove,
  onRetry,
  enableSelection,
  enableRenaming,
  enableCategorization,
  categories,
  disabled
}: FileItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(file.title);

  const getStatusColor = () => {
    switch (file.uploadStatus) {
      case 'completed': return 'text-green-600';
      case 'uploading': return 'text-blue-600';
      case 'error': return 'text-red-600';
      case 'paused': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (file.uploadStatus) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'uploading': return <Loader className="w-4 h-4 animate-spin" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      default: return null;
    }
  };

  const handleSaveEdit = () => {
    onUpdate(file.id, { 
      title: editedTitle,
      isRenamed: editedTitle !== file.originalName.replace(/\.[^/.]+$/, '')
    });
    setIsEditing(false);
  };

  const category = categories.find(c => c.id === file.category) || categories.find(c => c.id === 'other')!;
  const IconComponent = category.icon;

  if (viewMode === 'list') {
    return (
      <div className={`flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors ${
        isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white'
      }`}>
        {enableSelection && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(file.id, e.target.checked)}
            className="w-4 h-4 text-blue-600"
          />
        )}

        <div className={`w-8 h-8 rounded flex items-center justify-center bg-${category.color}-100`}>
          <IconComponent className={`w-4 h-4 text-${category.color}-600`} />
        </div>

        <div className="flex-1 min-w-0">
          {isEditing && enableRenaming ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                onBlur={handleSaveEdit}
                autoFocus
              />
            </div>
          ) : (
            <div>
              <div className="font-medium text-gray-900 truncate">
                {file.title}
                {file.isRenamed && <span className="text-xs text-blue-600 ml-1">(renamed)</span>}
              </div>
              <div className="text-sm text-gray-500 truncate">{file.originalName}</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-sm ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="hidden sm:inline">
              {file.uploadStatus === 'uploading' && `${file.uploadProgress}%`}
              {file.uploadStatus === 'completed' && 'Done'}
              {file.uploadStatus === 'error' && 'Failed'}
              {file.uploadStatus === 'idle' && 'Ready'}
              {file.uploadStatus === 'queued' && 'Queued'}
            </span>
          </div>

          {enableRenaming && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Rename file"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}

          {file.uploadStatus === 'error' && (
            <button
              onClick={onRetry}
              className="p-1 text-blue-600 hover:text-blue-700"
              title="Retry upload"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onRemove(file.id)}
            disabled={disabled}
            className="p-1 text-red-500 hover:text-red-700"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className={`border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors ${
      isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white'
    }`}>
      {enableSelection && (
        <div className="flex justify-end mb-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(file.id, e.target.checked)}
            className="w-4 h-4 text-blue-600"
          />
        </div>
      )}

      <div className="text-center mb-3">
        <div className={`w-12 h-12 rounded-lg mx-auto mb-2 bg-${category.color}-100 flex items-center justify-center`}>
          <IconComponent className={`w-6 h-6 text-${category.color}-600`} />
        </div>

        {isEditing && enableRenaming ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-center"
            onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
            onBlur={handleSaveEdit}
            autoFocus
          />
        ) : (
          <div>
            <div className="font-medium text-sm text-gray-900 truncate" title={file.title}>
              {file.title}
            </div>
            {file.isRenamed && <div className="text-xs text-blue-600">(renamed)</div>}
          </div>
        )}

        <div className="text-xs text-gray-500 mt-1 truncate" title={file.originalName}>
          {file.originalName}
        </div>
      </div>

      {/* Upload Progress */}
      {file.uploadStatus === 'uploading' && (
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${file.uploadProgress}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 text-center mt-1">
            {file.uploadProgress}% uploaded
          </div>
        </div>
      )}

      {/* Status */}
      <div className={`flex items-center justify-center gap-1 text-xs mb-3 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span>
          {file.uploadStatus === 'completed' && 'Upload Complete'}
          {file.uploadStatus === 'error' && 'Upload Failed'}
          {file.uploadStatus === 'idle' && 'Ready to Upload'}
          {file.uploadStatus === 'queued' && 'Queued'}
        </span>
      </div>

      {/* Error Message */}
      {file.uploadStatus === 'error' && file.error && (
        <div className="text-xs text-red-600 mb-2 text-center">
          {file.error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-1">
        {enableRenaming && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Rename file"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        )}

        {file.uploadStatus === 'error' && (
          <button
            onClick={onRetry}
            className="p-1 text-blue-600 hover:text-blue-700"
            title="Retry upload"
          >
            <Play className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={() => onRemove(file.id)}
          disabled={disabled}
          className="p-1 text-red-500 hover:text-red-700"
          title="Remove file"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}