import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock upload.service before importing enhanced-upload
vi.mock('../upload.service', () => ({
  uploadService: {
    uploadDocument: vi.fn(),
    validateFile: vi.fn(),
    getFileUrl: vi.fn(),
    formatFileSize: vi.fn(),
    generateUniqueFilename: vi.fn(),
    calculateFileHash: vi.fn(),
    checkFileExists: vi.fn(),
  },
  UploadService: vi.fn(),
}))

// Mock fetch globally
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

import { enhancedUploadService, EnhancedUploadService } from '../enhanced-upload.service'
import { uploadService } from '../upload.service'

const mockUploadDocument = vi.mocked(uploadService.uploadDocument)

// Patch Blob.prototype.arrayBuffer for jsdom compatibility
Object.defineProperty(Blob.prototype, 'arrayBuffer', {
  value: async function() { return new ArrayBuffer(this.size || 8) },
  writable: true,
  configurable: true,
})

// Stub crypto.subtle.digest
vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  subtle: {
    digest: vi.fn().mockResolvedValue(new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer),
  },
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(7),
})

const makeFile = (name: string, type: string, size: number = 1024): File => {
  const file = new File(['x'.repeat(size)], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const makeOkResponse = (body: object, contentType = 'application/json') => ({
  ok: true,
  status: 200,
  headers: { get: (k: string) => k === 'Content-Type' ? contentType : null },
  json: async () => body,
  text: async () => JSON.stringify(body)
})

describe('EnhancedUploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k])
  })

  // ─── getUploadAnalytics ────────────────────────────────────────────
  describe('getUploadAnalytics', () => {
    it('returns empty array initially', () => {
      const analytics = enhancedUploadService.getUploadAnalytics()
      expect(Array.isArray(analytics)).toBe(true)
    })
  })

  // ─── clearAnalytics ────────────────────────────────────────────────
  describe('clearAnalytics', () => {
    it('clears the analytics array', () => {
      enhancedUploadService.clearAnalytics()
      const analytics = enhancedUploadService.getUploadAnalytics()
      expect(analytics).toHaveLength(0)
    })
  })

  // ─── uploadFileEnhanced — direct strategy ──────────────────────────
  describe('uploadFileEnhanced', () => {
    it('uses direct upload strategy when strategy is "direct"', async () => {
      const uploadResult = {
        url: 'https://cdn.example.com/file.pdf',
        filename: 'test.pdf',
        size: 1024,
        type: 'application/pdf',
        id: 'key-123',
        uploadedAt: '2025-01-01T00:00:00Z'
      }
      mockUploadDocument.mockResolvedValueOnce(uploadResult)

      // Mock deduplication check to return null (no duplicate)
      mockFetch.mockResolvedValueOnce(makeOkResponse({ exists: false, file: null }))

      const file = makeFile('test.pdf', 'application/pdf', 1024)
      const result = await enhancedUploadService.uploadFileEnhanced(file, 'uploads', {
        strategy: 'direct',
        enableDeduplication: true,
        enableCompression: false,
        generateThumbnails: false,
        trackAnalytics: false
      })

      expect(result.url).toBe('https://cdn.example.com/file.pdf')
      expect(result.r2Key).toBeDefined()
      expect(result.cdnUrl).toBe('https://cdn.example.com/file.pdf')
    })

    it('returns deduplicated result when file already exists', async () => {
      const existingFile = {
        url: 'https://cdn.example.com/existing.pdf',
        filename: 'existing.pdf',
        size: 1024,
        type: 'application/pdf',
        id: 'existing-key',
        uploadedAt: '2025-01-01T00:00:00Z'
      }

      // Mock check-duplicate to say file exists
      mockFetch.mockResolvedValueOnce(makeOkResponse({ exists: true, file: existingFile }))

      const file = makeFile('test.pdf', 'application/pdf', 1024)
      // Need to mock calculateFileHash used internally
      mockFetch.mockResolvedValueOnce(makeOkResponse({ exists: true, file: existingFile }))

      const result = await enhancedUploadService.uploadFileEnhanced(file, 'uploads', {
        enableDeduplication: true,
        enableCompression: false,
        generateThumbnails: false,
        trackAnalytics: false,
        strategy: 'direct'
      })

      // Result should be based on the deduplicated file data
      expect(result.storageLocation).toBe('r2-deduplicated')
      expect(result.replicationStatus).toBe('replicated')
    })

    it('uploads without deduplication when disabled', async () => {
      const uploadResult = {
        url: 'https://cdn.example.com/file.pdf',
        filename: 'test.pdf',
        size: 1024,
        type: 'application/pdf',
        id: 'key-123',
        uploadedAt: '2025-01-01T00:00:00Z'
      }
      mockUploadDocument.mockResolvedValueOnce(uploadResult)

      const file = makeFile('test.pdf', 'application/pdf', 1024)
      const result = await enhancedUploadService.uploadFileEnhanced(file, 'uploads', {
        enableDeduplication: false,
        enableCompression: false,
        generateThumbnails: false,
        trackAnalytics: false,
        strategy: 'direct'
      })

      // Should not call deduplication check endpoint
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('check-duplicate'),
        expect.anything()
      )
      expect(result.url).toBeDefined()
    })
  })

  // ─── uploadBatchEnhanced ───────────────────────────────────────────
  describe('uploadBatchEnhanced', () => {
    it('uploads multiple files and returns successful results', async () => {
      const uploadResult = {
        url: 'https://cdn.example.com/file.pdf',
        filename: 'test.pdf',
        size: 1024,
        type: 'application/pdf',
        id: 'key-123',
        uploadedAt: '2025-01-01T00:00:00Z'
      }
      mockUploadDocument.mockResolvedValue(uploadResult)
      mockFetch.mockResolvedValue(makeOkResponse({ exists: false }))

      const files = [
        makeFile('file1.pdf', 'application/pdf', 1024),
        makeFile('file2.pdf', 'application/pdf', 2048),
      ]

      const result = await enhancedUploadService.uploadBatchEnhanced(files, 'uploads', {
        enableDeduplication: false,
        enableCompression: false,
        generateThumbnails: false,
        trackAnalytics: false,
        strategy: 'direct'
      })

      expect(result.successful).toHaveLength(2)
      expect(result.failed).toHaveLength(0)
      expect(result.analytics.totalFiles).toBe(2)
      expect(result.analytics.overallProgress).toBe(100)
    })

    it('tracks failed uploads separately', async () => {
      mockUploadDocument.mockRejectedValue(new Error('Upload failed'))
      mockFetch.mockResolvedValue(makeOkResponse({ exists: false }))

      const files = [makeFile('bad.pdf', 'application/pdf', 1024)]

      const result = await enhancedUploadService.uploadBatchEnhanced(files, 'uploads', {
        enableDeduplication: false,
        enableCompression: false,
        generateThumbnails: false,
        trackAnalytics: false,
        strategy: 'direct',
        failureStrategy: 'continue'
      })

      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].file.name).toBe('bad.pdf')
      expect(result.failed[0].error).toBeDefined()
    })

    it('calls onBatchProgress callback', async () => {
      const uploadResult = {
        url: 'https://cdn.example.com/file.pdf',
        filename: 'test.pdf',
        size: 1024,
        type: 'application/pdf',
        id: 'key-123',
        uploadedAt: '2025-01-01T00:00:00Z'
      }
      mockUploadDocument.mockResolvedValue(uploadResult)
      mockFetch.mockResolvedValue(makeOkResponse({ exists: false }))

      const onBatchProgress = vi.fn()
      const files = [makeFile('file1.pdf', 'application/pdf', 1024)]

      await enhancedUploadService.uploadBatchEnhanced(files, 'uploads', {
        enableDeduplication: false,
        enableCompression: false,
        generateThumbnails: false,
        trackAnalytics: false,
        strategy: 'direct',
        onBatchProgress
      })

      expect(onBatchProgress).toHaveBeenCalled()
    })

    it('calls onFileComplete callback for each successful upload', async () => {
      const uploadResult = {
        url: 'https://cdn.example.com/file.pdf',
        filename: 'test.pdf',
        size: 1024,
        type: 'application/pdf',
        id: 'key-123',
        uploadedAt: '2025-01-01T00:00:00Z'
      }
      mockUploadDocument.mockResolvedValue(uploadResult)
      mockFetch.mockResolvedValue(makeOkResponse({ exists: false }))

      const onFileComplete = vi.fn()
      const files = [makeFile('file1.pdf', 'application/pdf', 1024)]

      await enhancedUploadService.uploadBatchEnhanced(files, 'uploads', {
        enableDeduplication: false,
        enableCompression: false,
        generateThumbnails: false,
        trackAnalytics: false,
        strategy: 'direct',
        onFileComplete
      })

      expect(onFileComplete).toHaveBeenCalledTimes(1)
    })
  })

  // ─── EnhancedUploadService class ──────────────────────────────────
  describe('EnhancedUploadService class', () => {
    it('can be instantiated', () => {
      const service = new EnhancedUploadService()
      expect(service).toBeDefined()
      expect(typeof service.uploadFileEnhanced).toBe('function')
      expect(typeof service.uploadBatchEnhanced).toBe('function')
      expect(typeof service.getUploadAnalytics).toBe('function')
    })

    it('returns analytics as copy', () => {
      const service = new EnhancedUploadService()
      const analytics1 = service.getUploadAnalytics()
      const analytics2 = service.getUploadAnalytics()
      expect(analytics1).not.toBe(analytics2) // Should be a copy
    })
  })
})
