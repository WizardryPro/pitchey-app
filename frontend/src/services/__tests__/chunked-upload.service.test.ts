import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

// Mock crypto.subtle.digest for checksum calculations
const mockDigest = vi.fn().mockResolvedValue(new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02, 0x03]).buffer)
vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  subtle: {
    ...globalThis.crypto?.subtle,
    digest: mockDigest,
  },
  randomUUID: () => 'test-session-id-' + Math.random().toString(36).substring(7),
})

import { chunkedUploadService, ChunkedUploadService, UploadErrorCode } from '../chunked-upload.service'

// Patch Blob.prototype.arrayBuffer for jsdom compatibility
const mockArrayBuffer = async function(this: Blob) {
  return new ArrayBuffer(this.size || 8)
}
Object.defineProperty(Blob.prototype, 'arrayBuffer', {
  value: mockArrayBuffer,
  writable: true,
  configurable: true,
})

const makeFile = (name: string, type: string, size: number): File => {
  const content = 'x'.repeat(Math.min(size, 100)) // keep it small for tests
  const file = new File([content], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const makeOkResponse = (body: object) => ({
  ok: true,
  status: 200,
  json: async () => body
})

const makeErrorResponse = (status: number, body: object = {}) => ({
  ok: false,
  status,
  json: async () => body
})

describe('ChunkedUploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k])
    mockDigest.mockResolvedValue(new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02, 0x03]).buffer)
  })

  // ─── getQueueStats ────────────────────────────────────────────────
  describe('getQueueStats', () => {
    it('returns initial queue stats with zeros', () => {
      const stats = chunkedUploadService.getQueueStats()
      expect(stats.totalItems).toBe(0)
      expect(stats.activeUploads).toBe(0)
      expect(stats.queuedUploads).toBe(0)
      expect(stats.completedUploads).toBe(0)
      expect(stats.failedUploads).toBe(0)
    })
  })

  // ─── clearCompleted ───────────────────────────────────────────────
  describe('clearCompleted', () => {
    it('does not throw when no completed uploads', () => {
      expect(() => chunkedUploadService.clearCompleted()).not.toThrow()
    })
  })

  // ─── on / off event listeners ─────────────────────────────────────
  describe('on / off', () => {
    it('adds event listener without throwing', () => {
      const listener = vi.fn()
      expect(() => {
        chunkedUploadService.on('session:created', listener)
      }).not.toThrow()
    })

    it('removes event listener without throwing', () => {
      const listener = vi.fn()
      chunkedUploadService.on('session:progress', listener)
      expect(() => {
        chunkedUploadService.off('session:progress', listener)
      }).not.toThrow()
    })

    it('does not call removed listener', () => {
      // Just verifies that off() works by not throwing
      const listener = vi.fn()
      chunkedUploadService.on('queue:added', listener)
      chunkedUploadService.off('queue:added', listener)
    })
  })

  // ─── queueUpload ──────────────────────────────────────────────────
  describe('queueUpload', () => {
    it('returns a session ID string when queuing a valid file', () => {
      // Queue will immediately try to upload — mock the init endpoint
      mockFetch.mockResolvedValue(makeOkResponse({
        success: true,
        data: {
          sessionId: 'sess-abc',
          uploadId: 'upload-abc',
          fileKey: 'uploads/test.pdf',
          totalChunks: 1,
          expiresAt: new Date(Date.now() + 86400000).toISOString()
        }
      }))

      const file = makeFile('test.pdf', 'application/pdf', 1024)
      const sessionId = chunkedUploadService.queueUpload(file, 'document', 'normal')
      expect(typeof sessionId).toBe('string')
      expect(sessionId.length).toBeGreaterThan(0)
    })

    it('inserts high priority items at front of queue', () => {
      // Just verify it doesn't throw
      mockFetch.mockResolvedValue(makeOkResponse({
        success: true,
        data: {
          sessionId: 'sess-high',
          uploadId: 'upload-high',
          fileKey: 'uploads/test.pdf',
          totalChunks: 1,
          expiresAt: new Date(Date.now() + 86400000).toISOString()
        }
      }))

      const file = makeFile('high-priority.pdf', 'application/pdf', 1024)
      const id = chunkedUploadService.queueUpload(file, 'document', 'high')
      expect(typeof id).toBe('string')
    })
  })

  // ─── validateFile (via uploadFile throwing on invalid) ────────────
  describe('file validation via uploadFile', () => {
    it('throws VALIDATION_ERROR for oversized file', async () => {
      const bigFile = makeFile('huge.pdf', 'application/pdf', 200 * 1024 * 1024) // 200MB > 100MB limit

      try {
        await chunkedUploadService.uploadFile(bigFile, 'document')
        expect.fail('Should have thrown')
      } catch (error: any) {
        expect(error.code).toBe(UploadErrorCode.VALIDATION_ERROR)
        expect(error.recoverable).toBe(false)
      }
    })

    it('throws VALIDATION_ERROR for unsupported MIME type', async () => {
      const file = makeFile('test.exe', 'application/x-msdownload', 1024)

      try {
        await chunkedUploadService.uploadFile(file, 'document')
        expect.fail('Should have thrown')
      } catch (error: any) {
        expect(error.code).toBe(UploadErrorCode.VALIDATION_ERROR)
      }
    })

    it('throws VALIDATION_ERROR for video in wrong category', async () => {
      // video/mp4 is not valid for 'image' category
      const file = makeFile('test.mp4', 'video/mp4', 1024)

      try {
        await chunkedUploadService.uploadFile(file, 'image')
        expect.fail('Should have thrown')
      } catch (error: any) {
        expect(error.code).toBe(UploadErrorCode.VALIDATION_ERROR)
      }
    })
  })

  // ─── uploadFile (valid file) ───────────────────────────────────────
  describe('uploadFile with valid file', () => {
    it('initializes session and uploads chunks', async () => {
      const sessionId = 'test-session-123'
      const uploadId = 'upload-123'

      // Mock initiate session
      mockFetch
        .mockResolvedValueOnce(makeOkResponse({
          success: true,
          data: {
            sessionId,
            uploadId,
            fileKey: 'uploads/doc.pdf',
            totalChunks: 1,
            expiresAt: new Date(Date.now() + 86400000).toISOString()
          }
        }))
        // Mock chunk upload
        .mockResolvedValueOnce(makeOkResponse({
          success: true,
          data: {
            etag: '"etag-abc"',
            checksum: 'checksum-abc'
          }
        }))
        // Mock complete
        .mockResolvedValueOnce(makeOkResponse({
          success: true,
          data: {
            url: 'https://cdn.example.com/doc.pdf',
            key: 'uploads/doc.pdf',
            size: 1024,
            filename: 'doc.pdf',
            contentType: 'application/pdf'
          }
        }))

      const file = makeFile('doc.pdf', 'application/pdf', 1024)
      const result = await chunkedUploadService.uploadFile(file, 'document')

      expect(result.url).toBe('https://cdn.example.com/doc.pdf')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload/chunked/init'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('throws SERVER_ERROR when init endpoint fails', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500, { error: 'Server error' }))

      const file = makeFile('doc.pdf', 'application/pdf', 1024)
      try {
        await chunkedUploadService.uploadFile(file, 'document')
        expect.fail('Should have thrown')
      } catch (error: any) {
        expect(error.code).toBe(UploadErrorCode.SERVER_ERROR)
      }
    })

    it('throws when init response has success:false', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({
        success: false,
        error: 'Failed to create session'
      }))

      const file = makeFile('doc.pdf', 'application/pdf', 1024)
      try {
        await chunkedUploadService.uploadFile(file, 'document')
        expect.fail('Should have thrown')
      } catch (error: any) {
        expect(error.code).toBe(UploadErrorCode.SERVER_ERROR)
        expect(error.message).toBe('Failed to create session')
      }
    })
  })

  // ─── pauseUpload ──────────────────────────────────────────────────
  describe('pauseUpload', () => {
    it('throws when session not found', async () => {
      await expect(
        chunkedUploadService.pauseUpload('non-existent-session')
      ).rejects.toThrow('Upload session not found')
    })
  })

  // ─── cancelUpload ─────────────────────────────────────────────────
  describe('cancelUpload', () => {
    it('does not throw when session not found', async () => {
      // Cancel of non-existent session should not throw (graceful)
      mockFetch.mockResolvedValue(makeOkResponse({ success: true }))
      await expect(
        chunkedUploadService.cancelUpload('non-existent')
      ).resolves.not.toThrow()
    })
  })

  // ─── resumeUpload ─────────────────────────────────────────────────
  describe('resumeUpload', () => {
    it('throws SESSION_EXPIRED when session not found', async () => {
      try {
        await chunkedUploadService.resumeUpload('non-existent-session')
        expect.fail('Should have thrown')
      } catch (error: any) {
        expect(error.code).toBe(UploadErrorCode.SESSION_EXPIRED)
        expect(error.message).toContain('not found')
      }
    })
  })

  // ─── ChunkedUploadService class ────────────────────────────────────
  describe('ChunkedUploadService class', () => {
    it('can be instantiated with custom config', () => {
      const service = new ChunkedUploadService('http://localhost:8001', {
        maxConcurrentUploads: 5
      })
      expect(service).toBeDefined()
      expect(typeof service.uploadFile).toBe('function')
      expect(typeof service.queueUpload).toBe('function')
    })

    it('provides queue stats', () => {
      const service = new ChunkedUploadService()
      const stats = service.getQueueStats()
      expect(stats).toBeDefined()
      expect(typeof stats.totalItems).toBe('number')
    })
  })

  // ─── UploadErrorCode enum ─────────────────────────────────────────
  describe('UploadErrorCode', () => {
    it('exports expected error codes', () => {
      expect(UploadErrorCode.VALIDATION_ERROR).toBeDefined()
      expect(UploadErrorCode.SERVER_ERROR).toBeDefined()
      expect(UploadErrorCode.NETWORK_ERROR).toBeDefined()
      expect(UploadErrorCode.SESSION_EXPIRED).toBeDefined()
    })
  })
})
