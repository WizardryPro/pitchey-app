/**
 * Upload Progress Bar Component
 * Enhanced progress visualization with speed and time estimates
 */

import React from 'react';
import { Clock, Zap, FileText, AlertTriangle } from 'lucide-react';
import { ProgressBarProps } from '@shared/types/chunked-upload';

const UploadProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showDetails = true,
  showSpeed = true,
  showETA = true,
  compact = false,
  className = ''
}) => {
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

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatFileSize(bytesPerSecond)}/s`;
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  const getProgressColor = (): string => {
    if (progress.percentage === 100) return 'bg-green-500';
    if (progress.failedChunks > 0) return 'bg-yellow-500';
    if (progress.speed === 0) return 'bg-gray-400';
    return 'bg-blue-500';
  };

  const getStatusIcon = () => {
    if (progress.percentage === 100) return <FileText className="w-4 h-4 text-green-600" />;
    if (progress.failedChunks > 0) return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    return <Zap className="w-4 h-4 text-blue-600" />;
  };

  if (compact) {
    return (
      <div className={`upload-progress-compact ${className}`}>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <div className="flex-1 min-w-0">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`${getProgressColor()} h-2 rounded-full transition-all duration-300`}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-gray-900 min-w-0">
            {progress.percentage}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`upload-progress-detailed ${className}`}>
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="text-sm font-medium text-gray-900">
            Upload Progress
          </span>
        </div>
        <span className="text-sm font-bold text-gray-900">
          {progress.percentage}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
        <div
          className={`${getProgressColor()} h-3 rounded-full transition-all duration-300 relative overflow-hidden`}
          style={{ width: `${progress.percentage}%` }}
        >
          {/* Animated stripes for active uploads */}
          {progress.percentage < 100 && progress.speed > 0 && (
            <div className="absolute inset-0 bg-white bg-opacity-20 animate-pulse" />
          )}
        </div>
      </div>

      {/* Progress Details */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 mb-3">
          <div>
            <span className="font-medium">Data:</span>
            <span className="ml-1">
              {formatFileSize(progress.uploadedBytes)} / {formatFileSize(progress.totalBytes)}
            </span>
          </div>
          <div>
            <span className="font-medium">Chunks:</span>
            <span className="ml-1">
              {progress.uploadedChunks} / {progress.totalChunks}
            </span>
          </div>
          {progress.activeChunks > 0 && (
            <div>
              <span className="font-medium">Active:</span>
              <span className="ml-1">{progress.activeChunks} chunks</span>
            </div>
          )}
          {progress.queuedChunks > 0 && (
            <div>
              <span className="font-medium">Queued:</span>
              <span className="ml-1">{progress.queuedChunks} chunks</span>
            </div>
          )}
        </div>
      )}

      {/* Speed and ETA */}
      {(showSpeed || showETA) && progress.percentage < 100 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          {showSpeed && (
            <div className="flex items-center space-x-1">
              <Zap className="w-3 h-3" />
              <span>
                {progress.speed > 0 ? formatSpeed(progress.speed) : 'Calculating...'}
              </span>
            </div>
          )}
          {showETA && progress.estimatedTimeRemaining > 0 && (
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{formatTimeRemaining(progress.estimatedTimeRemaining)} remaining</span>
            </div>
          )}
        </div>
      )}

      {/* Failed Chunks Warning */}
      {progress.failedChunks > 0 && (
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <div className="flex items-center space-x-1 text-yellow-800">
            <AlertTriangle className="w-3 h-3" />
            <span className="font-medium">
              {progress.failedChunks} chunk{progress.failedChunks > 1 ? 's' : ''} failed
            </span>
          </div>
          <p className="text-yellow-700 mt-1">
            These chunks will be retried automatically
          </p>
        </div>
      )}

      {/* Completion Status */}
      {progress.percentage === 100 && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
          <div className="flex items-center space-x-1 text-green-800">
            <FileText className="w-3 h-3" />
            <span className="font-medium">Upload completed successfully</span>
          </div>
          <p className="text-green-700 mt-1">
            File has been uploaded and is ready for use
          </p>
        </div>
      )}
    </div>
  );
};

export default UploadProgressBar;