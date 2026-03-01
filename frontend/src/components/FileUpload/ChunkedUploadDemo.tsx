/**
 * Chunked Upload Demo Component
 * Demonstrates the enhanced chunked upload system with all features
 */

import React, { useState } from 'react';
import ChunkedFileUpload from './ChunkedFileUpload';
import UploadQueue from './UploadQueue';
import UploadProgressBar from './UploadProgressBar';
import {
  ChunkedUploadProgress,
  CompletedUploadResult,
  UploadError,
  ChunkedUploadSession
} from '@shared/types/chunked-upload';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';

const ChunkedUploadDemo: React.FC = () => {
  const [uploadProgress, setUploadProgress] = useState<ChunkedUploadProgress | null>(null);
  const [uploadResults, setUploadResults] = useState<CompletedUploadResult[]>([]);
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);
  const [currentSession, setCurrentSession] = useState<ChunkedUploadSession | null>(null);

  const handleUploadStart = (session: ChunkedUploadSession) => {
    setCurrentSession(session);
  };

  const handleUploadProgress = (progress: ChunkedUploadProgress) => {
    setUploadProgress(progress);
  };

  const handleUploadComplete = (result: CompletedUploadResult) => {
    setUploadResults(prev => [...prev, result]);
    setUploadProgress(null);
    setCurrentSession(null);
  };

  const handleUploadError = (error: UploadError) => {
    console.error('Upload error:', error);
    setUploadErrors(prev => [...prev, error]);
    setUploadProgress(null);
  };

  const handleFilesSelected = (files: File[]) => {
  };

  const handleClearCompleted = () => {
    setUploadResults([]);
    setUploadErrors([]);
  };

  return (
    <div className="chunked-upload-demo space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Enhanced Chunked Upload System
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Upload large files with chunking, resume capability, progress tracking, 
          and queue management. Supports documents up to 100MB, images up to 10MB, 
          and videos up to 500MB.
        </p>
      </div>

      {/* Upload Interface */}
      <Card>
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <ChunkedFileUpload
            category="document"
            maxFiles={5}
            multiple={true}
            onUploadStart={handleUploadStart}
            onUploadProgress={handleUploadProgress}
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            onFilesSelected={handleFilesSelected}
            className="mb-4"
          />
          
          {/* Current Upload Progress */}
          {uploadProgress && (
            <div className="mt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Current Upload</h3>
              <UploadProgressBar
                progress={uploadProgress}
                showDetails={true}
                showSpeed={true}
                showETA={true}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadQueue
            maxVisible={10}
            showCompleted={true}
            allowCancel={true}
            allowPause={true}
            allowRetry={true}
            onClearCompleted={handleClearCompleted}
          />
        </CardContent>
      </Card>

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Uploads ({uploadResults.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-green-800">{result.fileName}</p>
                    <p className="text-sm text-green-600">
                      {(result.fileSize / (1024 * 1024)).toFixed(2)} MB
                      • {Math.round(result.duration / 1000)}s
                      • {(result.averageSpeed / (1024 * 1024)).toFixed(1)} MB/s avg
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-800">Completed</p>
                    <p className="text-xs text-green-600">{result.uploadedAt}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Errors */}
      {uploadErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Errors ({uploadErrors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadErrors.map((error, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-red-800">{error.code}</p>
                    <p className="text-sm text-red-600">{error.message}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-red-800">
                      {error.recoverable ? 'Recoverable' : 'Fatal'}
                    </p>
                    {error.sessionId && (
                      <p className="text-xs text-red-600">
                        Session: {error.sessionId.substring(0, 8)}...
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature Showcase */}
      <Card>
        <CardHeader>
          <CardTitle>Features Demonstrated</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Upload Features</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Chunked upload for large files (2MB chunks)</li>
                <li>• Automatic resume after network interruption</li>
                <li>• Parallel chunk uploads (max 3 concurrent)</li>
                <li>• Real-time progress tracking with speed/ETA</li>
                <li>• File validation (size, type, checksums)</li>
                <li>• Queue management with priority</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">User Experience</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Drag & drop interface</li>
                <li>• Pause/Resume/Cancel controls</li>
                <li>• Visual progress indicators</li>
                <li>• Error handling with retry options</li>
                <li>• Upload speed and time remaining</li>
                <li>• Session persistence across page reloads</li>
              </ul>
            </div>
          </div>

          {/* Technical Info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Technical Implementation</h4>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div>
                <p className="font-medium">Backend</p>
                <p>Cloudflare Workers + R2</p>
                <p>Multipart upload API</p>
                <p>Chunk assembly & validation</p>
              </div>
              <div>
                <p className="font-medium">Storage</p>
                <p>R2 object storage</p>
                <p>Session state in memory</p>
                <p>Automatic cleanup jobs</p>
              </div>
              <div>
                <p className="font-medium">Frontend</p>
                <p>TypeScript service layer</p>
                <p>React components</p>
                <p>LocalStorage persistence</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChunkedUploadDemo;