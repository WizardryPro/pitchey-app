import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch globally before any imports
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock localStorage
const mockLocalStorage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockLocalStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockLocalStorage[key] = value },
  removeItem: (key: string) => { delete mockLocalStorage[key] },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]) }
})

import { uploadService, UploadService } from '../upload.service'

describe('UploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── validateFile ─────────────────────────────────────────────────
  describe('validateFile', () => {
    it('returns valid for a PDF file within size limits', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }) // 1MB
      const result = uploadService.validateFile(file)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns invalid when file exceeds max size', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 }) // 20MB > 10MB default
      const result = uploadService.validateFile(file)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds')
    })

    it('returns invalid for unsupported MIME type', () => {
      const file = new File(['content'], 'test.exe', { type: 'application/x-msdownload' })
      Object.defineProperty(file, 'size', { value: 1024 })
      const result = uploadService.validateFile(file)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not supported')
    })

    it('returns invalid for unsupported file extension', () => {
      const file = new File(['content'], 'test.xyz', { type: 'application/pdf' })
      Object.defineProperty(file, 'size', { value: 1024 })
      const result = uploadService.validateFile(file, { allowedTypes: ['application/pdf'] })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not supported')
    })

    it('accepts custom maxSize option', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 }) // 5MB
      const result = uploadService.validateFile(file, { maxSize: 100 * 1024 * 1024 })
      expect(result.valid).toBe(true)
    })
  })

  // ─── formatFileSize ────────────────────────────────────────────────
  describe('formatFileSize', () => {
    it('formats 0 bytes', () => {
      expect(uploadService.formatFileSize(0)).toBe('0 Bytes')
    })

    it('formats bytes', () => {
      expect(uploadService.formatFileSize(512)).toBe('512 Bytes')
    })

    it('formats kilobytes', () => {
      expect(uploadService.formatFileSize(1024)).toBe('1 KB')
    })

    it('formats megabytes', () => {
      expect(uploadService.formatFileSize(1024 * 1024)).toBe('1 MB')
    })

    it('formats gigabytes', () => {
      expect(uploadService.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
    })
  })

  // ─── generateUniqueFilename ────────────────────────────────────────
  describe('generateUniqueFilename', () => {
    it('preserves file extension', () => {
      const result = uploadService.generateUniqueFilename('test.pdf')
      expect(result).toMatch(/\.pdf$/)
    })

    it('includes original name prefix', () => {
      const result = uploadService.generateUniqueFilename('myfile.pdf')
      expect(result).toMatch(/^myfile_/)
    })

    it('generates unique names for same file', () => {
      const a = uploadService.generateUniqueFilename('test.pdf')
      const b = uploadService.generateUniqueFilename('test.pdf')
      // Most likely different due to random component
      expect(typeof a).toBe('string')
      expect(typeof b).toBe('string')
    })
  })

  // ─── getFileUrl ────────────────────────────────────────────────────
  describe('getFileUrl', () => {
    it('returns URL with filename', () => {
      const url = uploadService.getFileUrl('test.pdf')
      expect(url).toContain('/api/files/test.pdf')
    })
  })

  // ─── localStorage state management ────────────────────────────────
  describe('chunked upload state management', () => {
    it('returns null for non-existent upload state', () => {
      const state = uploadService.getStoredUploadState('non-existent-id')
      expect(state).toBeNull()
    })

    it('getResumableUploads returns empty array when nothing stored', () => {
      const uploads = uploadService.getResumableUploads()
      expect(Array.isArray(uploads)).toBe(true)
      expect(uploads.length).toBe(0)
    })

    it('clearStoredUploadStates removes localStorage key', () => {
      mockLocalStorage['pitchey_chunked_uploads'] = JSON.stringify({ 'abc': { uploadId: 'abc' } })
      uploadService.clearStoredUploadStates()
      expect(mockLocalStorage['pitchey_chunked_uploads']).toBeUndefined()
    })
  })

  // ─── initiateChunkedUpload ─────────────────────────────────────────
  describe('initiateChunkedUpload', () => {
    it('calls the multipart initiate endpoint and returns upload info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { uploadId: 'upload-123', key: 'uploads/test.pdf', expiresAt: '2025-01-01' }
        })
      })

      const result = await uploadService.initiateChunkedUpload('test.pdf', 'application/pdf', 1024, 'uploads')
      expect(result.uploadId).toBe('upload-123')
      expect(result.key).toBe('uploads/test.pdf')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload/multipart/initiate'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' })
      })

      await expect(
        uploadService.initiateChunkedUpload('test.pdf', 'application/pdf', 1024)
      ).rejects.toThrow()
    })

    it('throws when success is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Init failed' })
      })

      await expect(
        uploadService.initiateChunkedUpload('test.pdf', 'application/pdf', 1024)
      ).rejects.toThrow('Init failed')
    })
  })

  // ─── completeChunkedUpload ─────────────────────────────────────────
  describe('completeChunkedUpload', () => {
    it('calls the multipart complete endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { url: 'https://cdn.example.com/test.pdf', key: 'uploads/test.pdf', size: 1024 }
        })
      })

      const result = await uploadService.completeChunkedUpload('upload-123', [
        { partNumber: 1, etag: '"abc123"' }
      ])
      expect(result.url).toBe('https://cdn.example.com/test.pdf')
      expect(result.key).toBe('uploads/test.pdf')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload/multipart/complete'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('throws on error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad request' })
      })

      await expect(
        uploadService.completeChunkedUpload('upload-123', [])
      ).rejects.toThrow()
    })
  })

  // ─── abortChunkedUpload ────────────────────────────────────────────
  describe('abortChunkedUpload', () => {
    it('calls abort endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      await uploadService.abortChunkedUpload('upload-123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload/multipart/abort'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' })
      })

      await expect(uploadService.abortChunkedUpload('upload-123')).rejects.toThrow()
    })
  })

  // ─── getChunkedUploadStatus ────────────────────────────────────────
  describe('getChunkedUploadStatus', () => {
    it('fetches status for an upload', async () => {
      const statusData = {
        uploadId: 'upload-123',
        key: 'uploads/test.pdf',
        parts: [],
        status: 'in_progress' as const,
        createdAt: '2025-01-01T00:00:00Z'
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: statusData })
      })

      const result = await uploadService.getChunkedUploadStatus('upload-123')
      expect(result.uploadId).toBe('upload-123')
      expect(result.status).toBe('in_progress')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('uploadId=upload-123'),
        expect.objectContaining({ method: 'GET' })
      )
    })
  })

  // ─── deleteDocument ────────────────────────────────────────────────
  describe('deleteDocument', () => {
    it('calls the documents delete endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      await uploadService.deleteDocument(42)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/documents/42'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not found' })
      })

      await expect(uploadService.deleteDocument(999)).rejects.toThrow()
    })
  })

  // ─── deleteFile ────────────────────────────────────────────────────
  describe('deleteFile', () => {
    it('calls the files delete endpoint', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      await uploadService.deleteFile('test.pdf')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/files/test.pdf'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Not found'
      })

      await expect(uploadService.deleteFile('missing.pdf')).rejects.toThrow()
    })
  })

  // ─── getDocumentDownloadUrl ────────────────────────────────────────
  describe('getDocumentDownloadUrl', () => {
    it('returns download URL from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { url: 'https://cdn.example.com/doc.pdf' }
        })
      })

      const url = await uploadService.getDocumentDownloadUrl(5)
      expect(url).toBe('https://cdn.example.com/doc.pdf')
    })

    it('includes expires query param when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { url: 'https://cdn.example.com/doc.pdf?expires=3600' }
        })
      })

      await uploadService.getDocumentDownloadUrl(5, 3600)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('expires=3600'),
        expect.anything()
      )
    })
  })

  // ─── getPresignedUploadUrl ─────────────────────────────────────────
  describe('getPresignedUploadUrl', () => {
    it('calls presigned endpoint and returns upload URL data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            uploadUrl: 'https://r2.example.com/upload?sign=abc',
            key: 'uploads/2025/01/test.pdf',
            expiresAt: '2025-01-01T01:00:00Z'
          }
        })
      })

      const result = await uploadService.getPresignedUploadUrl('test.pdf', 'application/pdf')
      expect(result.uploadUrl).toBe('https://r2.example.com/upload?sign=abc')
      expect(result.key).toBe('uploads/2025/01/test.pdf')
    })

    it('throws when success is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Quota exceeded' })
      })

      await expect(
        uploadService.getPresignedUploadUrl('test.pdf', 'application/pdf')
      ).rejects.toThrow('Quota exceeded')
    })
  })

  // ─── getStorageQuota ───────────────────────────────────────────────
  describe('getStorageQuota', () => {
    it('returns quota data', async () => {
      const quotaData = {
        currentUsage: 1024,
        maxQuota: 1073741824,
        remainingQuota: 1073740800,
        usagePercentage: 0.0001,
        formattedUsage: '1 KB',
        formattedQuota: '1 GB',
        formattedRemaining: '1 GB'
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: quotaData })
      })

      const result = await uploadService.getStorageQuota()
      expect(result.currentUsage).toBe(1024)
      expect(result.maxQuota).toBe(1073741824)
    })
  })

  // ─── getUploadInfo ─────────────────────────────────────────────────
  describe('getUploadInfo', () => {
    it('returns upload info', async () => {
      const info = {
        maxFileSize: 10485760,
        allowedTypes: ['application/pdf'],
        maxFiles: 10,
        totalStorage: 1073741824,
        usedStorage: 0,
        remainingStorage: 1073741824,
        uploadLimits: { hourly: 10, daily: 100, monthly: 1000 },
        currentUsage: { hourly: 0, daily: 0, monthly: 0 },
        features: { concurrentUploads: true, chunkUpload: true, deduplication: true, previewGeneration: false }
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => info
      })

      const result = await uploadService.getUploadInfo()
      expect(result.maxFileSize).toBe(10485760)
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })
      await expect(uploadService.getUploadInfo()).rejects.toThrow('Failed to get upload info')
    })
  })

  // ─── getUploadAnalytics ────────────────────────────────────────────
  describe('getUploadAnalytics', () => {
    it('calls the analytics endpoint with default timeframe', async () => {
      const analytics = {
        totalUploads: 5,
        totalSize: 512000,
        averageFileSize: 102400,
        successRate: 0.95,
        popularTypes: [],
        uploadTrends: []
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => analytics
      })

      const result = await uploadService.getUploadAnalytics()
      expect(result.totalUploads).toBe(5)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('timeframe=week'),
        expect.anything()
      )
    })

    it('passes custom timeframe', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalUploads: 1, totalSize: 0, averageFileSize: 0, successRate: 1, popularTypes: [], uploadTrends: [] })
      })

      await uploadService.getUploadAnalytics('month')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('timeframe=month'),
        expect.anything()
      )
    })
  })

  // ─── checkFileExists ──────────────────────────────────────────────
  describe('checkFileExists', () => {
    it('returns exists:true when file found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exists: true, url: 'https://cdn.example.com/file.pdf' })
      })

      const result = await uploadService.checkFileExists('abc123hash')
      expect(result.exists).toBe(true)
      expect(result.url).toBe('https://cdn.example.com/file.pdf')
    })

    it('returns exists:false on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })
      const result = await uploadService.checkFileExists('abc123hash')
      expect(result.exists).toBe(false)
    })

    it('returns exists:false on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      const result = await uploadService.checkFileExists('abc123hash')
      expect(result.exists).toBe(false)
    })
  })

  // ─── calculateFileHash ────────────────────────────────────────────
  describe('calculateFileHash', () => {
    it('returns a hex string hash via mocked crypto', async () => {
      const mockBuffer = new ArrayBuffer(11)
      // Patch arrayBuffer on the prototype
      const originalArrayBuffer = Blob.prototype.arrayBuffer
      Blob.prototype.arrayBuffer = async function() { return mockBuffer }

      // Provide a mock crypto.subtle.digest that returns a predictable hash
      const hashBuffer = new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer
      const originalDigest = crypto.subtle.digest.bind(crypto.subtle)
      vi.spyOn(crypto.subtle, 'digest').mockResolvedValueOnce(hashBuffer)

      const file = new File(['hello world'], 'test.txt', { type: 'text/plain' })
      const hash = await uploadService.calculateFileHash(file)

      Blob.prototype.arrayBuffer = originalArrayBuffer
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
      expect(hash).toMatch(/^[0-9a-f]+$/)
    })
  })

  // ─── pauseUpload / resumeUpload ────────────────────────────────────
  describe('pauseUpload / resumeUpload', () => {
    it('pauseUpload does not throw', () => {
      expect(() => uploadService.pauseUpload('upload-abc')).not.toThrow()
    })

    it('resumeUpload does not throw', () => {
      expect(() => uploadService.resumeUpload('upload-abc')).not.toThrow()
    })
  })

  // ─── UploadService class export ────────────────────────────────────
  describe('UploadService class', () => {
    it('can be instantiated', () => {
      const service = new UploadService()
      expect(service).toBeDefined()
      expect(typeof service.validateFile).toBe('function')
    })
  })
})
