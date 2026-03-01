/**
 * Upload Queue Component
 * Manages and displays the upload queue with controls
 */

import React, { useState, useEffect } from 'react';
import {
  // Queue,
  Play,
  Pause,
  X,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Image,
  Video,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { chunkedUploadService } from '../../services/chunked-upload.service';
import { 
  UploadQueueProps, 
  UploadQueueStats, 
  ChunkedUploadProgress,
  CompletedUploadResult,
  UploadError
} from '@shared/types/chunked-upload';
import UploadProgressBar from './UploadProgressBar';

interface QueuedUpload {
  sessionId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: 'document' | 'image' | 'video' | 'nda';
  status: 'queued' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress?: ChunkedUploadProgress;
  result?: CompletedUploadResult;
  error?: UploadError;
  startTime?: number;
  endTime?: number;
}

const UploadQueue: React.FC<UploadQueueProps> = ({
  maxVisible = 10,
  showCompleted = true,
  allowCancel = true,
  allowPause = true,
  allowRetry = true,
  onClearCompleted,
  className = ''
}) => {
  const [uploads, setUploads] = useState<QueuedUpload[]>([]);
  const [stats, setStats] = useState<UploadQueueStats | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const getFileIcon = (mimeType: string, size: string = 'w-4 h-4') => {
    if (mimeType.startsWith('image/')) return <Image className={`${size} text-green-600`} />;
    if (mimeType.startsWith('video/')) return <Video className={`${size} text-purple-600`} />;
    return <FileText className={`${size} text-blue-600`} />;
  };

  const getStatusIcon = (status: string, size: string = 'w-4 h-4') => {
    switch (status) {
      case 'completed':
        return <CheckCircle className={`${size} text-green-600`} />;
      case 'failed':
        return <AlertCircle className={`${size} text-red-600`} />;
      case 'paused':
        return <Pause className={`${size} text-yellow-600`} />;
      case 'uploading':
        return <Play className={`${size} text-blue-600`} />;
      default:
        return <Clock className={`${size} text-gray-600`} />;
    }
  };

  const getFilteredUploads = () => {
    let filtered = uploads;

    switch (filter) {
      case 'active':
        filtered = uploads.filter(u => ['queued', 'uploading', 'paused'].includes(u.status));
        break;
      case 'completed':
        filtered = uploads.filter(u => u.status === 'completed');
        break;
      case 'failed':
        filtered = uploads.filter(u => u.status === 'failed');
        break;
      default:
        filtered = uploads;
    }

    if (!showCompleted) {
      filtered = filtered.filter(u => u.status !== 'completed');
    }

    return filtered.slice(0, maxVisible);
  };

  const handlePauseUpload = async (sessionId: string) => {
    if (!allowPause) return;
    try {
      await chunkedUploadService.pauseUpload(sessionId);
      setUploads(prev => prev.map(u => 
        u.sessionId === sessionId ? { ...u, status: 'paused' as const } : u
      ));
    } catch (error) {
      console.error('Failed to pause upload:', error);
    }
  };

  const handleResumeUpload = async (sessionId: string) => {
    try {
      await chunkedUploadService.resumeUpload(sessionId);
      setUploads(prev => prev.map(u => 
        u.sessionId === sessionId ? { ...u, status: 'uploading' as const } : u
      ));
    } catch (error) {
      console.error('Failed to resume upload:', error);
      setUploads(prev => prev.map(u => 
        u.sessionId === sessionId ? { 
          ...u, 
          status: 'failed' as const,
          error: error as UploadError 
        } : u
      ));
    }
  };

  const handleCancelUpload = async (sessionId: string) => {
    if (!allowCancel) return;
    try {
      await chunkedUploadService.cancelUpload(sessionId);
      setUploads(prev => prev.filter(u => u.sessionId !== sessionId));
    } catch (error) {
      console.error('Failed to cancel upload:', error);
    }
  };

  const handleRetryUpload = async (upload: QueuedUpload) => {
    if (!allowRetry) return;
    try {
      // Reset the upload state
      setUploads(prev => prev.map(u => 
        u.sessionId === upload.sessionId ? { 
          ...u, 
          status: 'queued' as const,
          error: undefined,
          progress: undefined,
          startTime: Date.now()
        } : u
      ));
      
      // Start new upload (this would need to be implemented properly)
      // For now, just simulate a retry
      setTimeout(() => {
        setUploads(prev => prev.map(u => 
          u.sessionId === upload.sessionId ? { ...u, status: 'uploading' as const } : u
        ));
      }, 1000);
    } catch (error) {
      console.error('Failed to retry upload:', error);
    }
  };

  const handleClearCompleted = () => {
    setUploads(prev => prev.filter(u => u.status !== 'completed'));
    chunkedUploadService.clearCompleted();
    onClearCompleted?.();
  };

  const calculateGlobalProgress = () => {
    const activeUploads = uploads.filter(u => u.status === 'uploading' && u.progress);
    if (activeUploads.length === 0) return null;

    const totalBytes = activeUploads.reduce((sum, u) => sum + u.fileSize, 0);
    const uploadedBytes = activeUploads.reduce((sum, u) => 
      sum + (u.progress?.uploadedBytes || 0), 0
    );
    const averageSpeed = activeUploads.reduce((sum, u) => 
      sum + (u.progress?.speed || 0), 0
    ) / activeUploads.length;

    return {
      percentage: totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0,
      uploadedBytes,
      totalBytes,
      speed: averageSpeed,
      activeCount: activeUploads.length
    };
  };

  const globalProgress = calculateGlobalProgress();

  // Set up event listeners for upload service
  useEffect(() => {
    const handleSessionCreated = (session: any) => {
      setUploads(prev => [...prev, {
        sessionId: session.sessionId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        mimeType: session.mimeType,
        category: session.category || 'document',
        status: 'uploading',
        startTime: Date.now()
      }]);
    };

    const handleSessionProgress = (progress: ChunkedUploadProgress) => {
      setUploads(prev => prev.map(u => 
        u.sessionId === progress.sessionId ? { ...u, progress } : u
      ));
    };

    const handleSessionCompleted = (result: CompletedUploadResult) => {
      setUploads(prev => prev.map(u => 
        u.sessionId === result.sessionId ? { 
          ...u, 
          status: 'completed', 
          result,
          endTime: Date.now()
        } : u
      ));
    };

    const handleSessionFailed = (data: { sessionId: string; error: UploadError }) => {
      setUploads(prev => prev.map(u => 
        u.sessionId === data.sessionId ? { 
          ...u, 
          status: 'failed',
          error: data.error,
          endTime: Date.now()
        } : u
      ));
    };

    const handleQueueStats = (stats: UploadQueueStats) => {
      setStats(stats);
    };

    chunkedUploadService.on('session:created', handleSessionCreated);
    chunkedUploadService.on('session:progress', handleSessionProgress);
    chunkedUploadService.on('session:completed', handleSessionCompleted);
    chunkedUploadService.on('session:failed', handleSessionFailed);
    chunkedUploadService.on('queue:stats', handleQueueStats);

    return () => {
      chunkedUploadService.off('session:created', handleSessionCreated);
      chunkedUploadService.off('session:progress', handleSessionProgress);
      chunkedUploadService.off('session:completed', handleSessionCompleted);
      chunkedUploadService.off('session:failed', handleSessionFailed);
      chunkedUploadService.off('queue:stats', handleQueueStats);
    };
  }, []);

  const filteredUploads = getFilteredUploads();
  const hasUploads = uploads.length > 0;
  const hasCompletedUploads = uploads.some(u => u.status === 'completed');

  if (!hasUploads) {
    return null;
  }

  return (
    <div className={`upload-queue bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-gray-600" />
            <h3 className="text-sm font-medium text-gray-900">Upload Queue</h3>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Filter Buttons */}
            <div className="flex border border-gray-200 rounded-md">
              {(['all', 'active', 'completed', 'failed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-1 text-xs font-medium capitalize ${
                    filter === f
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'text-gray-600 hover:bg-gray-50'
                  } first:rounded-l-md last:rounded-r-md border-r border-gray-200 last:border-r-0`}
                >
                  {f}
                </button>
              ))}
            </div>

            {hasCompletedUploads && (
              <button
                onClick={handleClearCompleted}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"
              >
                Clear Completed
              </button>
            )}
          </div>
        </div>

        {/* Global Progress */}
        {globalProgress && globalProgress.activeCount > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{globalProgress.activeCount} active upload{globalProgress.activeCount > 1 ? 's' : ''}</span>
              <span>
                {formatFileSize(globalProgress.uploadedBytes)} / {formatFileSize(globalProgress.totalBytes)}
                {globalProgress.speed > 0 && (
                  <span className="ml-2">• {formatFileSize(globalProgress.speed)}/s</span>
                )}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${globalProgress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-gray-600">
            <div>Active: {stats.activeUploads}</div>
            <div>Queued: {stats.queuedUploads}</div>
            <div>Completed: {stats.completedUploads}</div>
            <div>Failed: {stats.failedUploads}</div>
          </div>
        )}
      </div>

      {/* Upload List */}
      {isExpanded && (
        <div className="max-h-96 overflow-y-auto">
          {filteredUploads.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No uploads in this category
            </div>
          ) : (
            filteredUploads.map((upload) => (
              <div
                key={upload.sessionId}
                className="px-4 py-3 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {getFileIcon(upload.mimeType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {upload.fileName}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>{formatFileSize(upload.fileSize)}</span>
                        <span>•</span>
                        <span className="capitalize">{upload.category}</span>
                        {upload.startTime && upload.endTime && (
                          <>
                            <span>•</span>
                            <span>{formatDuration(upload.endTime - upload.startTime)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {getStatusIcon(upload.status)}
                    <span className="text-xs font-medium text-gray-700 capitalize">
                      {upload.status}
                    </span>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-1 ml-2">
                      {upload.status === 'uploading' && allowPause && (
                        <button
                          onClick={() => handlePauseUpload(upload.sessionId)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Pause upload"
                        >
                          <Pause className="w-3 h-3 text-gray-600" />
                        </button>
                      )}

                      {upload.status === 'paused' && (
                        <button
                          onClick={() => handleResumeUpload(upload.sessionId)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Resume upload"
                        >
                          <Play className="w-3 h-3 text-blue-600" />
                        </button>
                      )}

                      {upload.status === 'failed' && allowRetry && (
                        <button
                          onClick={() => handleRetryUpload(upload)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Retry upload"
                        >
                          <RotateCcw className="w-3 h-3 text-green-600" />
                        </button>
                      )}

                      {(['queued', 'uploading', 'paused'].includes(upload.status)) && allowCancel && (
                        <button
                          onClick={() => handleCancelUpload(upload.sessionId)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Cancel upload"
                        >
                          <X className="w-3 h-3 text-red-600" />
                        </button>
                      )}

                      {upload.status === 'completed' && (
                        <button
                          onClick={() => setUploads(prev => prev.filter(u => u.sessionId !== upload.sessionId))}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Remove from list"
                        >
                          <Trash2 className="w-3 h-3 text-gray-600" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress for active uploads */}
                {upload.status === 'uploading' && upload.progress && (
                  <div className="mt-2">
                    <UploadProgressBar
                      progress={upload.progress}
                      compact={true}
                      showDetails={false}
                    />
                  </div>
                )}

                {/* Error message for failed uploads */}
                {upload.status === 'failed' && upload.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {upload.error.message}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default UploadQueue;