// Phase 3: Media Access Handler
// Handles file uploads, downloads, and media management

// Use generic type for Environment to avoid R2Bucket version conflicts
interface Environment {
  MEDIA_STORAGE?: any;
  [key: string]: any;
}

export class MediaAccessHandler {
  constructor(
    private db: any, 
    private env?: Environment
  ) {}

  // Get media file metadata
  async getMediaById(userId: number, mediaId: number) {
    try {
      const media = await this.db.query(
        `SELECT m.*, u.name as owner_name
         FROM media_files m
         LEFT JOIN users u ON u.id = m.uploaded_by
         WHERE m.id = $1 AND (
           m.uploaded_by = $2 OR 
           m.is_public = TRUE OR
           EXISTS (
             SELECT 1 FROM media_permissions mp 
             WHERE mp.media_id = m.id AND mp.user_id = $2
           )
         )`,
        [mediaId, userId]
      );

      if (media.length === 0) {
        return { success: false, error: 'Media not found or access denied' };
      }

      // Track media access
      await this.db.query(
        `INSERT INTO media_access_logs (media_id, user_id, accessed_at)
         VALUES ($1, $2, NOW())`,
        [mediaId, userId]
      );

      return { success: true, data: { media: media[0] } };
    } catch (error) {
      console.error('Get media error:', error);
      return { success: false, error: 'Failed to fetch media' };
    }
  }

  // Get download URL for media
  async getMediaDownloadUrl(userId: number, mediaId: number) {
    try {
      // First check access
      const accessCheck = await this.getMediaById(userId, mediaId);
      if (!accessCheck.success) {
        return accessCheck;
      }

      const media = (accessCheck as any).data.media;
      
      // Generate signed download URL
      const downloadUrl = await this.generateSignedUrl(media.storage_path, media.file_name);
      
      // Update download count
      await this.db.query(
        `UPDATE media_files 
         SET download_count = download_count + 1,
             last_downloaded_at = NOW()
         WHERE id = $1`,
        [mediaId]
      );

      return { 
        success: true, 
        data: { 
          downloadUrl,
          fileName: media.file_name,
          contentType: media.mime_type,
          size: media.file_size
        } 
      };
    } catch (error) {
      console.error('Get download URL error:', error);
      return { success: false, error: 'Failed to generate download URL' };
    }
  }

  // Upload new media with enhanced validation
  async uploadMedia(userId: number, data: any) {
    try {
      const { 
        fileName, 
        fileSize, 
        mimeType, 
        category = 'document',
        pitchId = null,
        isPublic = false,
        metadata = {}
      } = data;

      // Enhanced file validation
      const validation = this.validateFile(fileName, fileSize, mimeType);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Generate storage path
      const storagePath = `uploads/${userId}/${Date.now()}-${fileName}`;
      
      // Create media record
      const media = await this.db.query(
        `INSERT INTO media_files 
         (uploaded_by, pitch_id, file_name, file_size, mime_type, 
          storage_path, category, is_public, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [userId, pitchId, fileName, fileSize, mimeType, 
         storagePath, category, isPublic, JSON.stringify(metadata)]
      );

      // Generate upload URL for direct client upload
      const uploadUrl = await this.generateUploadUrl(storagePath, mimeType);

      return { 
        success: true, 
        data: { 
          media: media[0],
          uploadUrl,
          expiresIn: 3600 // 1 hour
        } 
      };
    } catch (error) {
      console.error('Upload media error:', error);
      return { success: false, error: 'Failed to create media record' };
    }
  }

  // Delete media
  async deleteMedia(userId: number, mediaId: number) {
    try {
      // Check ownership
      const media = await this.db.query(
        `SELECT * FROM media_files 
         WHERE id = $1 AND uploaded_by = $2`,
        [mediaId, userId]
      );

      if (media.length === 0) {
        return { success: false, error: 'Media not found or not authorized' };
      }

      // Soft delete
      await this.db.query(
        `UPDATE media_files 
         SET is_deleted = TRUE, deleted_at = NOW()
         WHERE id = $1`,
        [mediaId]
      );

      return { success: true, data: { message: 'Media deleted successfully' } };
    } catch (error) {
      console.error('Delete media error:', error);
      return { success: false, error: 'Failed to delete media' };
    }
  }

  // Get user's media files
  async getUserMedia(userId: number, targetUserId: number) {
    try {
      // Check if requesting own media or has permission
      const isOwnMedia = userId === targetUserId;
      
      let query;
      let params;
      
      if (isOwnMedia) {
        query = `
          SELECT m.*, 
            COUNT(mal.id) as access_count,
            p.title as pitch_title
          FROM media_files m
          LEFT JOIN media_access_logs mal ON mal.media_id = m.id
          LEFT JOIN pitches p ON p.id = m.pitch_id
          WHERE m.uploaded_by = $1 AND m.is_deleted = FALSE
          GROUP BY m.id, p.title
          ORDER BY m.uploaded_at DESC
          LIMIT 100`;
        params = [targetUserId];
      } else {
        query = `
          SELECT m.*, p.title as pitch_title
          FROM media_files m
          LEFT JOIN pitches p ON p.id = m.pitch_id
          WHERE m.uploaded_by = $1 
            AND m.is_deleted = FALSE
            AND (m.is_public = TRUE OR EXISTS (
              SELECT 1 FROM media_permissions mp 
              WHERE mp.media_id = m.id AND mp.user_id = $2
            ))
          ORDER BY m.uploaded_at DESC
          LIMIT 50`;
        params = [targetUserId, userId];
      }

      const media = await this.db.query(query, params);

      return { 
        success: true, 
        data: { 
          media,
          isOwnMedia,
          totalCount: media.length
        } 
      };
    } catch (error) {
      console.error('Get user media error:', error);
      return { success: true, data: { media: [], isOwnMedia: false, totalCount: 0 } };
    }
  }

  // Helper: Generate access URL for download (serves via worker endpoint)
  public async generateSignedUrl(storagePath: string, fileName: string): Promise<string> {
    const baseUrl = this.env?.BACKEND_URL || 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
    const token = btoa(`${storagePath}:${Date.now()}`);
    return `${baseUrl}/api/media/file/${encodeURIComponent(storagePath)}?token=${token}&filename=${encodeURIComponent(fileName)}`;
  }

  // Helper: Generate upload URL (serves via worker endpoint)
  public async generateUploadUrl(storagePath: string, _mimeType: string): Promise<string> {
    const token = btoa(`upload:${storagePath}:${Date.now()}`);
    return `/api/media/upload/${encodeURIComponent(storagePath)}?token=${token}`;
  }

  // New method: Direct file upload to R2
  async uploadFileToR2(file: File, storagePath: string): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!this.env?.MEDIA_STORAGE) {
      return { success: false, error: 'R2 storage not available' };
    }

    try {
      // Upload file directly to R2
      const uploadResult = await this.env.MEDIA_STORAGE.put(storagePath, file, {
        customMetadata: {
          'original-name': file.name,
          'content-type': file.type,
          'uploaded-at': new Date().toISOString(),
          'file-size': file.size.toString()
        }
      });

      if (uploadResult) {
        // Generate access URL
        const accessUrl = await this.generateSignedUrl(storagePath, file.name);
        return { success: true, url: accessUrl };
      } else {
        return { success: false, error: 'Upload failed' };
      }
    } catch (error) {
      console.error('R2 upload error:', error);
      const e = error instanceof Error ? error : new Error(String(error));
      return { success: false, error: `Upload failed: ${e.message}` };
    }
  }

  // Enhanced validation for file uploads
  public validateFile(fileName: string, fileSize: number, mimeType: string): { valid: boolean; error?: string } {
    // File size validation (50MB limit)
    if (fileSize > 50 * 1024 * 1024) {
      return { valid: false, error: 'File size exceeds 50MB limit' };
    }

    // MIME type validation
    const allowedTypes = [
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      // Videos
      'video/mp4',
      'video/mov',
      'video/avi',
      'video/quicktime',
      // Audio
      'audio/mp3',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg'
    ];

    if (!allowedTypes.includes(mimeType.toLowerCase())) {
      return { valid: false, error: `File type ${mimeType} is not allowed` };
    }

    // File name validation
    if (fileName.length > 255) {
      return { valid: false, error: 'File name is too long (max 255 characters)' };
    }

    // Check for malicious file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js'];
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    if (dangerousExtensions.includes(extension)) {
      return { valid: false, error: 'File type not allowed for security reasons' };
    }

    return { valid: true };
  }
}