export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    detectedType: string;
    actualSize: number;
    maxSizeAllowed: number;
    mimeType: string;
    extension: string;
  };
}

export interface SecurityScanResult {
  isSafe: boolean;
  threats: string[];
  scanTime: number;
}

export class FileValidationService {
  // File size limits in bytes
  private static readonly SIZE_LIMITS = {
    image: 10 * 1024 * 1024,      // 10MB
    document: 100 * 1024 * 1024,  // 100MB  
    video: 2 * 1024 * 1024 * 1024, // 2GB
    script: 50 * 1024 * 1024,     // 50MB
  };

  // Allowed MIME types by category
  private static readonly ALLOWED_TYPES = {
    image: [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/rtf',
      'application/rtf'
    ],
    video: [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/ogg',
      'video/3gpp',
      'video/x-ms-wmv'
    ],
    script: [
      'application/pdf',
      'application/vnd.final-draft.fdx',
      'application/x-fdx',
      'text/plain',
      'application/fountain',
      'text/fountain'
    ]
  };

  // File signatures (magic numbers) for validation
  private static readonly FILE_SIGNATURES = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]],
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
    'video/mp4': [[0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]],
    'video/avi': [[0x52, 0x49, 0x46, 0x46]],
    'video/quicktime': [[0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74]]
  };

  // Dangerous file extensions and patterns
  private static readonly DANGEROUS_EXTENSIONS = [
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'vbe', 'js', 'jar',
    'msi', 'dll', 'scf', 'lnk', 'inf', 'reg', 'ps1', 'sh', 'php', 'asp',
    'jsp', 'py', 'pl', 'rb', 'go', 'rs'
  ];

  /**
   * Comprehensive file validation
   */
  static async validateFile(
    file: File, 
    expectedCategory: 'image' | 'document' | 'video' | 'script',
    options: {
      enforceSizeLimit?: boolean;
      validateSignature?: boolean;
      checkSecurity?: boolean;
    } = {}
  ): Promise<FileValidationResult> {
    const {
      enforceSizeLimit = true,
      validateSignature = true,
      checkSecurity = true
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];
    
    const extension = this.getFileExtension(file.name).toLowerCase();
    const maxSize = this.SIZE_LIMITS[expectedCategory];
    
    const metadata = {
      detectedType: expectedCategory,
      actualSize: file.size,
      maxSizeAllowed: maxSize,
      mimeType: file.type,
      extension
    };

    // 1. File size validation
    if (enforceSizeLimit && file.size > maxSize) {
      errors.push(
        `File size (${this.formatFileSize(file.size)}) exceeds limit (${this.formatFileSize(maxSize)}) for ${expectedCategory} files`
      );
    }

    // 2. File extension validation
    if (this.DANGEROUS_EXTENSIONS.includes(extension)) {
      errors.push(`File extension '${extension}' is not allowed for security reasons`);
    }

    // 3. MIME type validation
    const allowedTypes = this.ALLOWED_TYPES[expectedCategory];
    if (!allowedTypes.includes(file.type)) {
      errors.push(`MIME type '${file.type}' is not allowed for ${expectedCategory} files`);
    }

    // 4. File signature validation
    if (validateSignature && file.size > 0) {
      try {
        const isValidSignature = await this.validateFileSignature(file, file.type);
        if (!isValidSignature) {
          errors.push(`File signature does not match declared MIME type '${file.type}'`);
        }
      } catch (error) {
        warnings.push(`Could not validate file signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 5. Filename validation
    if (!this.isValidFilename(file.name)) {
      errors.push('Filename contains invalid characters or patterns');
    }

    // 6. Additional security checks
    if (checkSecurity) {
      const securityResult = await this.performSecurityScan(file);
      if (!securityResult.isSafe) {
        errors.push(...securityResult.threats.map(threat => `Security threat detected: ${threat}`));
      }
    }

    // 7. Category-specific validations
    this.validateCategorySpecific(file, expectedCategory, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata
    };
  }

  /**
   * Validate file signature (magic numbers)
   */
  private static async validateFileSignature(file: File, expectedType: string): Promise<boolean> {
    try {
      const buffer = await file.slice(0, 32).arrayBuffer(); // Read first 32 bytes
      const bytes = new Uint8Array(buffer);
      
      const signatures = this.FILE_SIGNATURES[expectedType as keyof typeof this.FILE_SIGNATURES];
      if (!signatures) {
        return true; // No signature to validate
      }
      
      return signatures.some(signature => 
        signature.every((byte, index) => 
          index < bytes.length && bytes[index] === byte
        )
      );
    } catch {
      return false;
    }
  }

  /**
   * Basic security scanning
   */
  private static async performSecurityScan(file: File): Promise<SecurityScanResult> {
    const startTime = Date.now();
    const threats: string[] = [];

    try {
      // 1. Check file size for zip bombs
      if (file.size > 2 * 1024 * 1024 * 1024) { // 2GB
        threats.push('File size too large - potential zip bomb');
      }

      // 2. Check filename for suspicious patterns
      const suspiciousPatterns = [
        /\.exe\./i,           // Double extension
        /\.(bat|cmd|exe|scr|vbs)$/i, // Executable extensions
        /[<>:"|?*]/,          // Invalid filename characters
        /__MACOSX/,           // Mac system files
        /\.DS_Store/,         // Mac system files
        /thumbs\.db/i,        // Windows system files
        /desktop\.ini/i       // Windows system files
      ];

      if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
        threats.push('Suspicious filename pattern detected');
      }

      // 3. Basic content scanning for text files
      if (file.type.startsWith('text/') || file.type === 'application/pdf') {
        try {
          const text = await file.text();
          const suspiciousContent = [
            /<script\s*>/i,
            /javascript:/i,
            /vbscript:/i,
            /onload\s*=/i,
            /onerror\s*=/i,
            /eval\s*\(/i,
            /document\.write/i
          ];

          if (suspiciousContent.some(pattern => pattern.test(text))) {
            threats.push('Potentially malicious content detected');
          }
        } catch {
          // Can't read as text, skip content check
        }
      }

      return {
        isSafe: threats.length === 0,
        threats,
        scanTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        isSafe: false,
        threats: [`Security scan error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        scanTime: Date.now() - startTime
      };
    }
  }

  /**
   * Category-specific validation
   */
  private static validateCategorySpecific(
    file: File,
    category: 'image' | 'document' | 'video' | 'script',
    errors: string[],
    warnings: string[]
  ): void {
    switch (category) {
      case 'image':
        // Check image dimensions (if possible)
        if (file.size < 100) {
          warnings.push('Image file is very small - may be corrupted');
        }
        break;

      case 'video':
        // Video-specific checks
        if (file.size < 1024 * 1024) { // Less than 1MB
          warnings.push('Video file is very small - may be corrupted or low quality');
        }
        break;

      case 'script':
        // Script-specific checks
        const scriptExtensions = ['pdf', 'fdx', 'fountain', 'txt'];
        const extension = this.getFileExtension(file.name).toLowerCase();
        if (!scriptExtensions.includes(extension)) {
          warnings.push(`Extension '${extension}' is unusual for script files`);
        }
        break;

      case 'document':
        // Document-specific checks
        if (file.size < 1024) { // Less than 1KB
          warnings.push('Document file is very small - may be empty or corrupted');
        }
        break;
    }
  }

  /**
   * Validate filename
   */
  private static isValidFilename(filename: string): boolean {
    // Check for invalid characters
    const invalidChars = /[<>:"|?*\x00-\x1f]/;
    if (invalidChars.test(filename)) {
      return false;
    }

    // Check for reserved Windows names
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
    
    const nameWithoutExt = filename.split('.')[0].toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      return false;
    }

    // Check filename length
    if (filename.length > 255) {
      return false;
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /^\./,                    // Hidden files
      /\.\./, // Directory traversal
      /\s+$/,                   // Trailing whitespace
      /^-/                      // Leading dash
    ];

    return !suspiciousPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Get file extension
   */
  private static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot + 1) : '';
  }

  /**
   * Format file size for display
   */
  private static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Check user quota against database storage tracking.
   * Falls back to permissive defaults if DB unavailable.
   */
  static async checkUserQuota(userId: number, fileSize: number, db?: any): Promise<{
    allowed: boolean;
    currentUsage: number;
    maxQuota: number;
    remainingQuota: number;
  }> {
    // Quota tiers: free=1GB, pro=10GB, enterprise=50GB
    const QUOTA_TIERS: Record<string, number> = {
      free: 1 * 1024 * 1024 * 1024,
      pro: 10 * 1024 * 1024 * 1024,
      enterprise: 50 * 1024 * 1024 * 1024,
      unlimited: Number.MAX_SAFE_INTEGER,
    };

    let currentUsage = 0;
    let tier = 'free';

    if (db) {
      try {
        const [usageResult, userResult] = await Promise.all([
          db.query(
            `SELECT COALESCE(SUM(file_size), 0)::bigint AS total_bytes FROM file_storage WHERE user_id = $1`,
            [userId]
          ).catch(() => [{ total_bytes: '0' }]),
          db.query(
            `SELECT subscription_tier FROM users WHERE id = $1`,
            [userId]
          ).catch(() => []),
        ]);
        currentUsage = Number(usageResult[0]?.total_bytes) || 0;
        tier = userResult[0]?.subscription_tier || 'free';
      } catch {
        // DB unavailable — allow upload with default quota
      }
    }

    const maxQuota = QUOTA_TIERS[tier] ?? QUOTA_TIERS.free;
    const remainingQuota = maxQuota - currentUsage;

    return {
      allowed: currentUsage + fileSize <= maxQuota,
      currentUsage,
      maxQuota,
      remainingQuota,
    };
  }

  /**
   * Sanitize filename for storage
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 200); // Limit length
  }
}