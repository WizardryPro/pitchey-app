/**
 * Hook for managing pending uploads during pitch creation
 * Coordinates file uploads after pitch is created with the actual pitchId
 */

import { useState, useCallback, useRef } from 'react';
// eslint-disable-next-line import/no-restricted-paths -- intentional: cross-feature service dependency
import { uploadService, UploadResult, UploadProgress } from '@features/uploads/services/upload.service';

export interface PendingUpload {
  id: string;
  file: File;
  type: 'image' | 'video' | 'document';
  documentType?: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  url?: string;
  error?: string;
}

export interface UploadManagerResult {
  successful: UploadResult[];
  failed: Array<{ id: string; error: string }>;
}

export interface UsePitchUploadManagerReturn {
  pendingUploads: PendingUpload[];
  addUpload: (file: File, type: 'image' | 'video' | 'document', documentType?: string) => string;
  setDocumentUploads: (files: File[]) => void;
  removeUpload: (id: string) => void;
  clearUploads: () => void;
  executeUploads: (pitchId: number) => Promise<UploadManagerResult>;
  isUploading: boolean;
  overallProgress: number;
  hasUploads: boolean;
  getUploadsByType: (type: 'image' | 'video' | 'document') => PendingUpload[];
}

export function usePitchUploadManager(): UsePitchUploadManagerReturn {
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Add a file to the pending upload queue
   */
  const addUpload = useCallback((
    file: File,
    type: 'image' | 'video' | 'document',
    documentType?: string
  ): string => {
    const id = crypto.randomUUID();
    const upload: PendingUpload = {
      id,
      file,
      type,
      documentType,
      status: 'pending',
      progress: 0
    };

    setPendingUploads(prev => [...prev, upload]);
    return id;
  }, []);

  /**
   * Replace the full set of pending DOCUMENT uploads with `files` (image/video
   * uploads are left untouched). Use this when the source emits the complete
   * current document list on every change (e.g. DocumentUploadHub) — re-adding
   * with addUpload() in that case duplicates files and double-charges credits.
   * Existing matching entries (same name/size/lastModified) keep their id/status.
   */
  const setDocumentUploads = useCallback((files: File[]) => {
    setPendingUploads(prev => {
      const others = prev.filter(u => u.type !== 'document');
      const existingDocs = prev.filter(u => u.type === 'document');
      const docs: PendingUpload[] = files.map(file => {
        const match = existingDocs.find(u =>
          u.file.name === file.name &&
          u.file.size === file.size &&
          u.file.lastModified === file.lastModified
        );
        return match || {
          id: crypto.randomUUID(),
          file,
          type: 'document' as const,
          status: 'pending' as const,
          progress: 0
        };
      });
      return [...others, ...docs];
    });
  }, []);

  /**
   * Remove a file from the pending upload queue
   */
  const removeUpload = useCallback((id: string) => {
    setPendingUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  /**
   * Clear all pending uploads
   */
  const clearUploads = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setPendingUploads([]);
    setIsUploading(false);
    setOverallProgress(0);
  }, []);

  /**
   * Get uploads filtered by type
   */
  const getUploadsByType = useCallback((type: 'image' | 'video' | 'document') => {
    return pendingUploads.filter(u => u.type === type);
  }, [pendingUploads]);

  /**
   * Execute all pending uploads with the actual pitchId
   */
  const executeUploads = useCallback(async (pitchId: number): Promise<UploadManagerResult> => {
    if (pendingUploads.length === 0) {
      return { successful: [], failed: [] };
    }

    setIsUploading(true);
    setOverallProgress(0);
    abortControllerRef.current = new AbortController();

    const successful: UploadResult[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    const totalFiles = pendingUploads.length;
    let completedFiles = 0;

    // Process uploads sequentially to avoid overwhelming the server
    for (const upload of pendingUploads) {
      if (abortControllerRef.current?.signal.aborted) {
        failed.push({ id: upload.id, error: 'Upload cancelled' });
        continue;
      }

      // Update status to uploading
      setPendingUploads(prev =>
        prev.map(u => u.id === upload.id ? { ...u, status: 'uploading' as const } : u)
      );

      try {
        let result: UploadResult;

        // Handle progress tracking
        const onProgress = (progress: UploadProgress) => {
          setPendingUploads(prev =>
            prev.map(u => u.id === upload.id ? { ...u, progress: progress.percentage } : u)
          );

          // Calculate overall progress
          const fileProgress = progress.percentage / 100;
          const overallProg = ((completedFiles + fileProgress) / totalFiles) * 100;
          setOverallProgress(Math.round(overallProg));
        };

        // Upload based on type
        if (upload.type === 'document') {
          result = await uploadService.uploadDocument(
            upload.file,
            upload.documentType || 'document',
            {
              pitchId,
              onProgress,
              signal: abortControllerRef.current?.signal
            }
          );
        } else {
          // For image/video, use uploadPitchMedia
          result = await uploadService.uploadPitchMedia(
            pitchId,
            upload.file,
            upload.type,
            {
              onProgress,
              signal: abortControllerRef.current?.signal
            }
          );
        }

        // Update status to completed
        setPendingUploads(prev =>
          prev.map(u => u.id === upload.id ? {
            ...u,
            status: 'completed' as const,
            progress: 100,
            url: result.url
          } : u)
        );

        successful.push(result);
        completedFiles++;
        setOverallProgress(Math.round((completedFiles / totalFiles) * 100));

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';

        // Update status to error
        setPendingUploads(prev =>
          prev.map(u => u.id === upload.id ? {
            ...u,
            status: 'error' as const,
            error: errorMessage
          } : u)
        );

        failed.push({ id: upload.id, error: errorMessage });
        completedFiles++;
      }
    }

    setIsUploading(false);
    setOverallProgress(100);
    abortControllerRef.current = null;

    return { successful, failed };
  }, [pendingUploads]);

  return {
    pendingUploads,
    addUpload,
    setDocumentUploads,
    removeUpload,
    clearUploads,
    executeUploads,
    isUploading,
    overallProgress,
    hasUploads: pendingUploads.length > 0,
    getUploadsByType
  };
}

export default usePitchUploadManager;
