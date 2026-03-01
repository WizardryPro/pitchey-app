import React, { useState, useCallback, useEffect } from 'react';
import { 
  Upload, 
  FolderOpen, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  BarChart,
  Settings,
  X,
  Download,
  Eye
} from 'lucide-react';
import { useToast } from '@shared/components/feedback/ToastProvider';
import MultipleFileUpload, { EnhancedMediaFile } from './MultipleFileUpload';
import NDAUploadSection, { NDADocument } from './NDAUploadSection';
import { enhancedUploadService, EnhancedUploadOptions, EnhancedUploadResult, BatchUploadProgress } from '../../services/enhanced-upload.service';
import { useBetterAuthStore } from '../../store/betterAuthStore';

interface DocumentUploadHubProps {
  pitchId?: number;
  onUploadComplete?: (results: EnhancedUploadResult[]) => void;
  onNDAChange?: (nda: NDADocument | null) => void;
  initialFiles?: EnhancedMediaFile[];
  initialNDA?: NDADocument;
  disabled?: boolean;
  className?: string;
  /** When true, files are collected but not uploaded - call onFilesSelected to get them */
  deferUploads?: boolean;
  /** Called when files are selected in deferred mode */
  onFilesSelected?: (files: File[]) => void;
}

interface UploadSession {
  id: string;
  startTime: Date;
  totalFiles: number;
  uploadedFiles: number;
  failedFiles: number;
  totalSize: number;
  uploadedSize: number;
  estimatedTimeRemaining: number;
  isActive: boolean;
}

export default function DocumentUploadHub({
  pitchId,
  onUploadComplete,
  onNDAChange,
  initialFiles = [],
  initialNDA,
  disabled = false,
  className = '',
  deferUploads = false,
  onFilesSelected
}: DocumentUploadHubProps) {
  const [files, setFiles] = useState<EnhancedMediaFile[]>(initialFiles);
  const [ndaDocument, setNDADocument] = useState<NDADocument | undefined>(initialNDA);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSession, setUploadSession] = useState<UploadSession | null>(null);
  const [uploadStats, setUploadStats] = useState<BatchUploadProgress | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [uploadOptions, setUploadOptions] = useState<EnhancedUploadOptions>({
    enableDeduplication: true,
    enableCompression: true,
    generateThumbnails: true,
    strategy: 'presigned',
    trackAnalytics: true,
    autoOrganize: true,
    dateBasedFolder: true,
    imageQuality: 85,
    enableWebP: true
  });

  const { success, error } = useToast();
  const { user } = useBetterAuthStore();

  // Handle NDA changes
  const handleNDAChange = useCallback((nda: NDADocument | null) => {
    setNDADocument(nda || undefined);
    onNDAChange?.(nda);
  }, [onNDAChange]);

  // Handle file changes
  const handleFilesChange = useCallback((updatedFiles: EnhancedMediaFile[]) => {
    setFiles(updatedFiles);

    // In deferred mode, notify parent about selected files
    if (deferUploads && onFilesSelected) {
      const newFiles = updatedFiles
        .filter(f => f.uploadStatus === 'idle' || f.uploadStatus === 'queued')
        .map(f => f.file);
      onFilesSelected(newFiles);
    }
  }, [deferUploads, onFilesSelected]);

  // Start upload session
  const startUploadSession = useCallback(() => {
    const session: UploadSession = {
      id: crypto.randomUUID(),
      startTime: new Date(),
      totalFiles: files.length,
      uploadedFiles: 0,
      failedFiles: 0,
      totalSize: files.reduce((sum, f) => sum + f.file.size, 0),
      uploadedSize: 0,
      estimatedTimeRemaining: 0,
      isActive: true
    };
    
    setUploadSession(session);
    setIsUploading(true);
  }, [files]);

  // Complete upload session
  const completeUploadSession = useCallback((successful: EnhancedUploadResult[], failed: any[]) => {
    if (uploadSession) {
      setUploadSession({
        ...uploadSession,
        uploadedFiles: successful.length,
        failedFiles: failed.length,
        isActive: false
      });
    }
    
    setIsUploading(false);
    onUploadComplete?.(successful);

    if (failed.length === 0) {
      success('Upload Complete', `All ${successful.length} files uploaded successfully`);
    } else if (successful.length > 0) {
      error('Partial Upload', `${successful.length} files uploaded, ${failed.length} failed`);
    } else {
      error('Upload Failed', 'All files failed to upload');
    }
  }, [uploadSession, success, error, onUploadComplete]);

  // Bulk upload handler
  const handleBulkUpload = useCallback(async () => {
    if (files.length === 0) {
      error('No Files', 'Please add files to upload');
      return;
    }

    // In deferred mode, files will be uploaded with pitch creation
    if (deferUploads) {
      const pendingFiles = files
        .filter(f => f.uploadStatus === 'idle' || f.uploadStatus === 'queued')
        .map(f => f.file);

      if (onFilesSelected) {
        onFilesSelected(pendingFiles);
      }

      success('Files Ready', `${pendingFiles.length} files will be uploaded when you create the pitch`);
      return;
    }

    startUploadSession();

    try {
      const filesToUpload = files
        .filter(f => f.uploadStatus === 'idle' || f.uploadStatus === 'queued')
        .map(f => f.file);

      const result = await enhancedUploadService.uploadBatchEnhanced(
        filesToUpload,
        'pitch-documents',
        {
          ...uploadOptions,
          userId: user?.id || 0,
          metadata: {
            ...(uploadOptions.metadata || {}),
            pitchId
          },
          maxConcurrency: 3,
          onBatchProgress: (progress) => {
            setUploadStats(progress);
          },
          onFileComplete: (file, result) => {
            // Update file status in the list
            setFiles(prevFiles => 
              prevFiles.map(f => 
                f.file === file 
                  ? { ...f, uploadStatus: 'completed', url: result.url, uploadProgress: 100 }
                  : f
              )
            );
          },
          onFileError: (file, error) => {
            // Update file status in the list
            setFiles(prevFiles => 
              prevFiles.map(f => 
                f.file === file 
                  ? { ...f, uploadStatus: 'error', error: error.message, uploadProgress: 0 }
                  : f
              )
            );
          }
        }
      );

      completeUploadSession(result.successful, result.failed);

    } catch (uploadError: any) {
      error('Upload Error', uploadError.message || 'Failed to upload files');
      setIsUploading(false);
      
      setUploadSession(prev => prev ? {
        ...prev,
        isActive: false
      } : null);
    }
  }, [files, uploadOptions, pitchId, startUploadSession, completeUploadSession, error, success, deferUploads, onFilesSelected]);

  // Get upload summary
  const getUploadSummary = () => {
    const total = files.length;
    const completed = files.filter(f => f.uploadStatus === 'completed').length;
    const failed = files.filter(f => f.uploadStatus === 'error').length;
    const pending = files.filter(f => f.uploadStatus === 'idle' || f.uploadStatus === 'queued').length;
    
    return { total, completed, failed, pending };
  };

  const summary = getUploadSummary();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Document Upload Hub</h2>
              <p className="text-sm text-gray-500">
                Manage your pitch documents and NDAs with advanced upload features
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              title="Advanced Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            {summary.total > 0 && (
              <div className="text-sm text-gray-600">
                {summary.completed}/{summary.total} uploaded
              </div>
            )}
          </div>
        </div>

        {/* Upload Session Info */}
        {uploadSession && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">
                  Upload Session {uploadSession.isActive ? 'Active' : 'Complete'}
                </span>
              </div>
              <div className="text-sm text-blue-700">
                Started: {uploadSession.startTime.toLocaleTimeString()}
              </div>
            </div>
            
            {uploadStats && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress: {uploadStats.completedFiles}/{uploadStats.totalFiles} files</span>
                  <span>{uploadStats.overallProgress}%</span>
                </div>
                
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadStats.overallProgress}%` }}
                  />
                </div>
                
                {uploadStats.currentFile && (
                  <div className="text-xs text-blue-600">
                    Current: {uploadStats.currentFile}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Advanced Settings */}
      {showAdvancedSettings && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Advanced Upload Settings</h3>
            <button
              onClick={() => setShowAdvancedSettings(false)}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Optimization Settings */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Optimization</h4>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={uploadOptions.enableDeduplication}
                  onChange={(e) => setUploadOptions({
                    ...uploadOptions,
                    enableDeduplication: e.target.checked
                  })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Enable Deduplication</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={uploadOptions.enableCompression}
                  onChange={(e) => setUploadOptions({
                    ...uploadOptions,
                    enableCompression: e.target.checked
                  })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Compress Images</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={uploadOptions.enableWebP}
                  onChange={(e) => setUploadOptions({
                    ...uploadOptions,
                    enableWebP: e.target.checked
                  })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Convert to WebP</span>
              </label>
            </div>

            {/* Upload Strategy */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Upload Strategy</h4>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="strategy"
                    value="presigned"
                    checked={uploadOptions.strategy === 'presigned'}
                    onChange={(e) => setUploadOptions({
                      ...uploadOptions,
                      strategy: e.target.value as any
                    })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Presigned URLs (Recommended)</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="strategy"
                    value="direct"
                    checked={uploadOptions.strategy === 'direct'}
                    onChange={(e) => setUploadOptions({
                      ...uploadOptions,
                      strategy: e.target.value as any
                    })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Direct Upload</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="strategy"
                    value="multipart"
                    checked={uploadOptions.strategy === 'multipart'}
                    onChange={(e) => setUploadOptions({
                      ...uploadOptions,
                      strategy: e.target.value as any
                    })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Multipart (Large Files)</span>
                </label>
              </div>
            </div>

            {/* Additional Features */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Features</h4>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={uploadOptions.generateThumbnails}
                  onChange={(e) => setUploadOptions({
                    ...uploadOptions,
                    generateThumbnails: e.target.checked
                  })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Generate Thumbnails</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={uploadOptions.trackAnalytics}
                  onChange={(e) => setUploadOptions({
                    ...uploadOptions,
                    trackAnalytics: e.target.checked
                  })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Track Analytics</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={uploadOptions.autoOrganize}
                  onChange={(e) => setUploadOptions({
                    ...uploadOptions,
                    autoOrganize: e.target.checked
                  })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Auto-organize Files</span>
              </label>
            </div>

            {/* Quality Settings */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Quality</h4>
              
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Image Quality: {uploadOptions.imageQuality}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={uploadOptions.imageQuality}
                  onChange={(e) => setUploadOptions({
                    ...uploadOptions,
                    imageQuality: parseInt(e.target.value)
                  })}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NDA Upload Section */}
      <NDAUploadSection
        ndaDocument={ndaDocument}
        onChange={handleNDAChange}
        disabled={disabled || isUploading}
        className="border-0 shadow-sm"
      />

      {/* Multiple File Upload */}
      <MultipleFileUpload
        files={files}
        onChange={handleFilesChange}
        disabled={disabled || isUploading}
        maxFiles={50}
        maxFileSize={500} // 500MB for pitch documents
        enableBulkActions={true}
        enableCategorization={true}
        enableRenaming={true}
        enableFiltering={true}
        onBulkUpload={handleBulkUpload}
        className="border-0 shadow-sm"
      />

      {/* Deferred Mode Info Banner */}
      {deferUploads && files.length > 0 && summary.pending > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Upload className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800">
              <strong>{summary.pending} file{summary.pending !== 1 ? 's' : ''}</strong> will upload when you create your pitch.
            </p>
          </div>
        </div>
      )}

      {/* Upload Actions */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <div className="flex items-center gap-4">
                  {summary.completed > 0 && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span>{summary.completed} completed</span>
                    </div>
                  )}

                  {summary.failed > 0 && (
                    <div className="flex items-center gap-1 text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{summary.failed} failed</span>
                    </div>
                  )}

                  {summary.pending > 0 && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Upload className="w-4 h-4" />
                      <span>{summary.pending} pending</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {summary.pending > 0 && !deferUploads && (
                <button
                  onClick={handleBulkUpload}
                  disabled={disabled || isUploading}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    disabled || isUploading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isUploading ? 'Uploading...' : `Upload ${summary.pending} Files`}
                </button>
              )}

              {summary.completed > 0 && (
                <button
                  onClick={() => onUploadComplete?.([])}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Complete ({summary.completed} uploaded)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {files.length > 0 && summary.completed === summary.total && summary.failed === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">All Files Uploaded Successfully!</h3>
              <p className="text-sm text-green-700 mt-1">
                {summary.total} files have been uploaded and are ready to use.
                {ndaDocument && ` NDA settings: ${ndaDocument.ndaType === 'standard' ? 'Standard Platform NDA' : ndaDocument.ndaType === 'custom' ? 'Custom NDA' : 'No NDA Required'}.`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}