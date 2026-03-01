import React, { useState, useEffect } from 'react';
import { useUploadProgress } from '@shared/contexts/WebSocketContext';

interface UploadProgressData {
  uploadId: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface UploadProgressItemProps {
  upload: UploadProgressData;
  onCancel?: (uploadId: string) => void;
  onRetry?: (uploadId: string) => void;
  onDismiss?: (uploadId: string) => void;
  showActions?: boolean;
}

function UploadProgressItem({ 
  upload, 
  onCancel, 
  onRetry, 
  onDismiss,
  showActions = true 
}: UploadProgressItemProps) {
  const getStatusColor = () => {
    switch (upload.status) {
      case 'uploading':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (upload.status) {
      case 'uploading':
        return (
          <svg className="w-4 h-4 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (upload.status) {
      case 'uploading':
        return `Uploading... ${Math.round(upload.progress)}%`;
      case 'completed':
        return 'Upload completed';
      case 'error':
        return upload.error || 'Upload failed';
      default:
        return 'Unknown status';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            {getStatusIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {upload.filename}
            </p>
            <p className={`text-xs mt-1 ${
              upload.status === 'error' ? 'text-red-600' : 'text-gray-500'
            }`}>
              {getStatusText()}
            </p>
          </div>
        </div>
        
        {showActions && (
          <div className="flex items-center space-x-2 ml-4">
            {upload.status === 'uploading' && onCancel && (
              <button
                onClick={() => onCancel(upload.uploadId)}
                className="text-gray-400 hover:text-red-600 transition-colors"
                title="Cancel upload"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            
            {upload.status === 'error' && onRetry && (
              <button
                onClick={() => onRetry(upload.uploadId)}
                className="text-gray-400 hover:text-blue-600 transition-colors"
                title="Retry upload"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            
            {(upload.status === 'completed' || upload.status === 'error') && onDismiss && (
              <button
                onClick={() => onDismiss(upload.uploadId)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Progress Bar */}
      {upload.status === 'uploading' && (
        <div className="mt-3">
          <div className="bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ease-out ${getStatusColor()}`}
              style={{ width: `${Math.max(0, Math.min(100, upload.progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface UploadProgressListProps {
  maxItems?: number;
  onCancel?: (uploadId: string) => void;
  onRetry?: (uploadId: string) => void;
  onDismiss?: (uploadId: string) => void;
  className?: string;
  position?: 'fixed' | 'relative';
}

export function UploadProgressList({ 
  maxItems = 5,
  onCancel,
  onRetry,
  onDismiss,
  className = "",
  position = 'fixed'
}: UploadProgressListProps) {
  const { uploadProgress, subscribeToUploads } = useUploadProgress();
  const [uploads, setUploads] = useState<UploadProgressData[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToUploads((newUploads) => {
      setUploads(newUploads.slice(0, maxItems));
    });

    return unsubscribe;
  }, [subscribeToUploads, maxItems]);

  const activeUploads = uploads.filter(u => u.status === 'uploading');
  const completedUploads = uploads.filter(u => u.status === 'completed');
  const errorUploads = uploads.filter(u => u.status === 'error');

  const handleDismiss = (uploadId: string) => {
    setUploads(prev => prev.filter(u => u.uploadId !== uploadId));
    onDismiss?.(uploadId);
  };

  if (uploads.length === 0) {
    return null;
  }

  const containerClasses = position === 'fixed'
    ? 'fixed bottom-4 right-4 w-80 max-h-96 overflow-y-auto z-50'
    : 'w-full';

  return (
    <div className={`space-y-3 ${containerClasses} ${className}`}>
      {/* Summary Header */}
      {uploads.length > 1 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              Uploads ({uploads.length})
            </span>
            <div className="flex space-x-4 text-xs">
              {activeUploads.length > 0 && (
                <span className="text-blue-600">
                  {activeUploads.length} uploading
                </span>
              )}
              {completedUploads.length > 0 && (
                <span className="text-green-600">
                  {completedUploads.length} completed
                </span>
              )}
              {errorUploads.length > 0 && (
                <span className="text-red-600">
                  {errorUploads.length} failed
                </span>
              )}
            </div>
          </div>
          
          {/* Overall Progress */}
          {activeUploads.length > 0 && (
            <div className="mt-2">
              <div className="bg-gray-300 rounded-full h-1">
                <div
                  className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      activeUploads.reduce((acc, upload) => acc + upload.progress, 0) / activeUploads.length
                    }%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Individual Upload Items */}
      {uploads.map((upload) => (
        <UploadProgressItem
          key={upload.uploadId}
          upload={upload}
          onCancel={onCancel}
          onRetry={onRetry}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}

interface UploadProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel?: (uploadId: string) => void;
  onRetry?: (uploadId: string) => void;
  onDismiss?: (uploadId: string) => void;
}

export function UploadProgressModal({ 
  isOpen, 
  onClose, 
  onCancel, 
  onRetry, 
  onDismiss 
}: UploadProgressModalProps) {
  const { uploadProgress } = useUploadProgress();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 max-h-96">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Upload Progress</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 max-h-80 overflow-y-auto">
          <UploadProgressList
            onCancel={onCancel}
            onRetry={onRetry}
            onDismiss={onDismiss}
            position="relative"
          />
        </div>
      </div>
    </div>
  );
}

interface UploadProgressBadgeProps {
  onClick?: () => void;
  className?: string;
}

export function UploadProgressBadge({ onClick, className = "" }: UploadProgressBadgeProps) {
  const { uploadProgress } = useUploadProgress();
  
  const activeUploads = uploadProgress.filter(u => u.status === 'uploading');
  const errorUploads = uploadProgress.filter(u => u.status === 'error');
  
  if (uploadProgress.length === 0) {
    return null;
  }

  const totalProgress = activeUploads.length > 0
    ? activeUploads.reduce((acc, upload) => acc + upload.progress, 0) / activeUploads.length
    : 100;

  return (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        errorUploads.length > 0
          ? 'bg-red-100 text-red-800 hover:bg-red-200'
          : activeUploads.length > 0
          ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
          : 'bg-green-100 text-green-800 hover:bg-green-200'
      } ${className}`}
    >
      <div className="flex items-center space-x-2">
        {activeUploads.length > 0 ? (
          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : errorUploads.length > 0 ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
        
        <span>
          {activeUploads.length > 0
            ? `Uploading ${activeUploads.length}`
            : errorUploads.length > 0
            ? `${errorUploads.length} failed`
            : `${uploadProgress.length} completed`
          }
        </span>
      </div>
      
      {/* Progress ring for active uploads */}
      {activeUploads.length > 0 && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 36 36">
          <path
            className="text-gray-300"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="text-blue-600"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${totalProgress}, 100`}
            strokeLinecap="round"
            fill="none"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
      )}
    </button>
  );
}

export default UploadProgressList;