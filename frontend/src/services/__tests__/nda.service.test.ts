import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock api-client BEFORE importing the service
vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import { apiClient } from '../../lib/api-client'
import { NDAService } from '../nda.service'

const mockApiClient = apiClient as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

describe('NDAService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requestNDA', () => {
    it('requests an NDA and returns NDA object', async () => {
      const responseData = {
        id: 1,
        pitchId: 5,
        requesterId: 10,
        status: 'pending',
        ndaType: 'basic',
        accessGranted: false,
        expiresAt: '2025-01-01',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }
      mockApiClient.post.mockResolvedValue({ success: true, data: responseData })

      const result = await NDAService.requestNDA({ pitchId: 5, message: 'Please review' })

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/ndas/request', { pitchId: 5, message: 'Please review' })
      expect(result.id).toBe(1)
      expect(result.status).toBe('pending')
    })

    it('throws on failure with string error', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: 'Insufficient credits' })
      await expect(NDAService.requestNDA({ pitchId: 5 })).rejects.toThrow('Insufficient credits')
    })

    it('throws on failure with object error', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Already requested' } })
      await expect(NDAService.requestNDA({ pitchId: 5 })).rejects.toThrow('Already requested')
    })

    it('throws when response data is null', async () => {
      mockApiClient.post.mockResolvedValue({ success: true, data: null })
      await expect(NDAService.requestNDA({ pitchId: 5 })).rejects.toThrow('Invalid response from server')
    })
  })

  describe('signNDA', () => {
    it('signs an NDA and returns signed NDA', async () => {
      const nda = { id: 1, status: 'signed', pitchId: 5, createdAt: '', updatedAt: '' }
      mockApiClient.post.mockResolvedValue({ success: true, data: { nda } })

      const result = await NDAService.signNDA({ ndaId: 1, signature: 'sig', fullName: 'Alice', acceptTerms: true })

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/ndas/1/sign', expect.objectContaining({ ndaId: 1 }))
      expect(result.nda.status).toBe('signed')
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Invalid signature' } })
      await expect(NDAService.signNDA({ ndaId: 1, signature: 'sig', fullName: 'Alice', acceptTerms: true }))
        .rejects.toThrow('Invalid signature')
    })
  })

  describe('approveNDA', () => {
    it('approves an NDA', async () => {
      const nda = { id: 1, status: 'approved', pitchId: 5, createdAt: '', updatedAt: '' }
      mockApiClient.post.mockResolvedValue({ success: true, data: { nda } })

      const result = await NDAService.approveNDA(1, 'Approved with conditions')

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/ndas/1/approve', expect.objectContaining({ notes: 'Approved with conditions' }))
      expect(result.status).toBe('approved')
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Not found' } })
      await expect(NDAService.approveNDA(1)).rejects.toThrow('Not found')
    })
  })

  describe('rejectNDA', () => {
    it('rejects an NDA', async () => {
      const nda = { id: 1, status: 'rejected', pitchId: 5, createdAt: '', updatedAt: '' }
      mockApiClient.post.mockResolvedValue({ success: true, data: { nda } })

      const result = await NDAService.rejectNDA(1, 'Not suitable')

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/ndas/1/reject', { reason: 'Not suitable' })
      expect(result.status).toBe('rejected')
    })
  })

  describe('revokeNDA', () => {
    it('revokes an NDA', async () => {
      const nda = { id: 1, status: 'revoked', pitchId: 5, createdAt: '', updatedAt: '' }
      mockApiClient.post.mockResolvedValue({ success: true, data: { nda } })

      const result = await NDAService.revokeNDA(1, 'Terms violated')

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/ndas/1/revoke', { reason: 'Terms violated' })
      expect(result.status).toBe('revoked')
    })
  })

  describe('getNDAById', () => {
    it('returns NDA by ID', async () => {
      const nda = { id: 5, status: 'pending', pitchId: 3, createdAt: '', updatedAt: '' }
      mockApiClient.get.mockResolvedValue({ success: true, data: { nda } })

      const result = await NDAService.getNDAById(5)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/5')
      expect(result.id).toBe(5)
    })

    it('throws on not found', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'NDA not found' } })
      await expect(NDAService.getNDAById(5)).rejects.toThrow('NDA not found')
    })
  })

  describe('getNDAs', () => {
    it('returns ndas list with total', async () => {
      const ndas = [
        { id: 1, pitch_id: 5, status: 'pending', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 2, pitch_id: 6, status: 'approved', created_at: '2024-01-01', updated_at: '2024-01-01' },
      ]
      mockApiClient.get.mockResolvedValue({ success: true, data: { ndas, total: 2 } })

      const result = await NDAService.getNDAs({ status: 'pending' })

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining('/api/ndas'))
      expect(result.ndas).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('transforms snake_case fields to camelCase', async () => {
      const ndas = [
        { id: 1, pitch_id: 5, status: 'pending', created_at: '2024-01-01', updated_at: '2024-01-01', pitch_title: 'My Film' },
      ]
      mockApiClient.get.mockResolvedValue({ success: true, data: { ndas, total: 1 } })

      const result = await NDAService.getNDAs()
      expect(result.ndas[0].pitchId).toBe(5)
      expect(result.ndas[0].pitchTitle).toBe('My Film')
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Forbidden' } })
      await expect(NDAService.getNDAs()).rejects.toThrow('Forbidden')
    })
  })

  describe('getNDAStatus', () => {
    it('returns NDA status for a pitch', async () => {
      mockApiClient.get.mockResolvedValue({
        success: true,
        data: { hasNDA: true, canAccess: true, nda: { id: 1, status: 'approved' } },
      })

      const result = await NDAService.getNDAStatus(5)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/pitch/5/status')
      expect(result.hasNDA).toBe(true)
      expect(result.canAccess).toBe(true)
    })

    it('returns hasNDA=false on 404', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'not found', status: 404 } })
      const result = await NDAService.getNDAStatus(5)
      expect(result.hasNDA).toBe(false)
      expect(result.canAccess).toBe(false)
    })

    it('returns error message on other API failures', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Server error' } })
      const result = await NDAService.getNDAStatus(5)
      expect(result.hasNDA).toBe(false)
      expect(result.error).toBe('Server error')
    })

    it('returns error on thrown exception', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network failure'))
      const result = await NDAService.getNDAStatus(5)
      expect(result.hasNDA).toBe(false)
      expect(result.error).toBe('Network failure')
    })
  })

  describe('getNDAHistory', () => {
    it('returns NDA history for current user', async () => {
      const ndas = [{ id: 1, status: 'approved', pitchId: 3, createdAt: '', updatedAt: '' }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { ndas } })

      const result = await NDAService.getNDAHistory()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/history')
      expect(result).toHaveLength(1)
    })

    it('returns NDA history for specific user', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { ndas: [] } })
      await NDAService.getNDAHistory(42)
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/history/42')
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(NDAService.getNDAHistory()).rejects.toThrow()
    })
  })

  describe('generatePreview', () => {
    it('generates NDA preview', async () => {
      mockApiClient.post.mockResolvedValue({ success: true, data: { preview: '<html>NDA Preview</html>' } })

      const result = await NDAService.generatePreview(5, 1)

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/ndas/preview', { pitchId: 5, templateId: 1 })
      expect(result).toBe('<html>NDA Preview</html>')
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Preview error' } })
      await expect(NDAService.generatePreview(5)).rejects.toThrow('Preview error')
    })
  })

  describe('getNDATemplates', () => {
    it('returns templates list', async () => {
      const templates = [{ id: 1, name: 'Standard', content: 'Template content', createdBy: 1, createdAt: '', updatedAt: '' }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { templates } })

      const result = await NDAService.getNDATemplates()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/templates')
      expect(result.templates).toHaveLength(1)
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(NDAService.getNDATemplates()).rejects.toThrow()
    })
  })

  describe('getTemplates (legacy)', () => {
    it('delegates to getNDATemplates', async () => {
      const templates = [{ id: 1, name: 'Basic', content: 'text', createdBy: 1, createdAt: '', updatedAt: '' }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { templates } })

      const result = await NDAService.getTemplates()
      expect(result).toHaveLength(1)
    })
  })

  describe('getNDATemplate', () => {
    it('returns a single template', async () => {
      const template = { id: 1, name: 'Basic', content: 'text', createdBy: 1, createdAt: '', updatedAt: '' }
      mockApiClient.get.mockResolvedValue({ success: true, data: { template } })

      const result = await NDAService.getNDATemplate(1)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/templates/1')
      expect(result.id).toBe(1)
    })

    it('throws on not found', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Not found' } })
      await expect(NDAService.getNDATemplate(99)).rejects.toThrow('Not found')
    })
  })

  describe('createNDATemplate', () => {
    it('creates a new template', async () => {
      const template = { id: 1, name: 'New', content: 'content', createdBy: 1, createdAt: '', updatedAt: '' }
      mockApiClient.post.mockResolvedValue({ success: true, data: { template } })

      const result = await NDAService.createNDATemplate({ name: 'New', content: 'content' })

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/ndas/templates', { name: 'New', content: 'content' })
      expect(result.name).toBe('New')
    })
  })

  describe('updateNDATemplate', () => {
    it('updates a template', async () => {
      const template = { id: 1, name: 'Updated', content: 'new content', createdBy: 1, createdAt: '', updatedAt: '' }
      mockApiClient.put.mockResolvedValue({ success: true, data: { template } })

      const result = await NDAService.updateNDATemplate(1, { name: 'Updated' })

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/ndas/templates/1', { name: 'Updated' })
      expect(result.name).toBe('Updated')
    })
  })

  describe('deleteNDATemplate', () => {
    it('deletes a template', async () => {
      mockApiClient.delete.mockResolvedValue({ success: true })
      await expect(NDAService.deleteNDATemplate(1)).resolves.toBeUndefined()
      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/ndas/templates/1')
    })

    it('throws on failure', async () => {
      mockApiClient.delete.mockResolvedValue({ success: false, error: { message: 'Not found' } })
      await expect(NDAService.deleteNDATemplate(1)).rejects.toThrow('Not found')
    })
  })

  describe('getNDAStats', () => {
    it('returns NDA stats', async () => {
      const data = { total: 10, pending: 3, approved: 5, rejected: 1, expired: 1, revoked: 0 }
      mockApiClient.get.mockResolvedValue({ success: true, data })

      const result = await NDAService.getNDAStats()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/stats')
      expect(result.total).toBe(10)
    })

    it('returns stats for a specific pitch', async () => {
      const data = { total: 5, pending: 1, approved: 3, rejected: 1, expired: 0, revoked: 0 }
      mockApiClient.get.mockResolvedValue({ success: true, data })

      await NDAService.getNDAStats(42)
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/stats/42')
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' }, data: undefined })
      await expect(NDAService.getNDAStats()).rejects.toThrow()
    })
  })

  describe('getNDAAnalytics', () => {
    it('returns NDA analytics', async () => {
      const data = { totalRequests: 50, approved: 30, rejected: 10, pending: 10 }
      mockApiClient.get.mockResolvedValue({ success: true, data })

      const result = await NDAService.getNDAAnalytics('30d')

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining('/api/ndas/analytics'))
      expect(result.totalRequests).toBe(50)
    })
  })

  describe('canRequestNDA', () => {
    it('returns canRequest=true when eligible', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { canRequest: true } })

      const result = await NDAService.canRequestNDA(5)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/pitch/5/can-request')
      expect(result.canRequest).toBe(true)
    })

    it('returns canRequest=false with reason on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Already requested' } })
      const result = await NDAService.canRequestNDA(5)
      expect(result.canRequest).toBe(false)
      expect(result.reason).toBe('Already requested')
    })

    it('returns canRequest=false on network error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network failure'))
      const result = await NDAService.canRequestNDA(5)
      expect(result.canRequest).toBe(false)
      expect(result.error).toBe('Network failure')
    })
  })

  describe('bulkApprove', () => {
    it('bulk approves NDAs', async () => {
      mockApiClient.post.mockResolvedValue({ success: true, data: { successful: [1, 2], failed: [] } })

      const result = await NDAService.bulkApprove([1, 2])

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/ndas/bulk-approve', { ndaIds: [1, 2] })
      expect(result.successful).toEqual([1, 2])
      expect(result.failed).toEqual([])
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Bulk error' } })
      await expect(NDAService.bulkApprove([1, 2])).rejects.toThrow('Bulk error')
    })
  })

  describe('bulkReject', () => {
    it('bulk rejects NDAs', async () => {
      mockApiClient.post.mockResolvedValue({ success: true, data: { successful: [3], failed: [] } })

      const result = await NDAService.bulkReject([3], 'Not suitable')

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/ndas/bulk-reject', { ndaIds: [3], reason: 'Not suitable' })
      expect(result.successful).toEqual([3])
    })
  })

  describe('sendReminder', () => {
    it('sends a reminder', async () => {
      mockApiClient.post.mockResolvedValue({ success: true })
      await expect(NDAService.sendReminder(1)).resolves.toBeUndefined()
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/ndas/1/remind', {})
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Reminder failed' } })
      await expect(NDAService.sendReminder(1)).rejects.toThrow('Reminder failed')
    })
  })

  describe('verifySignature', () => {
    it('verifies signature and returns result', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { valid: true, signedAt: '2024-01-01' } })

      const result = await NDAService.verifySignature(1)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/1/verify')
      expect(result.valid).toBe(true)
      expect(result.signedAt).toBe('2024-01-01')
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Verify failed' } })
      await expect(NDAService.verifySignature(1)).rejects.toThrow('Verify failed')
    })
  })

  describe('getActiveNDAs', () => {
    it('returns active NDA requests', async () => {
      const ndaRequests = [{ id: 1, pitch_id: 5, status: 'approved', requested_at: '2024-01-01', created_at: '2024-01-01' }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { ndaRequests, total: 1 } })

      const result = await NDAService.getActiveNDAs()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/active')
      expect(result.ndaRequests).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(NDAService.getActiveNDAs()).rejects.toThrow()
    })
  })

  describe('getSignedNDAs', () => {
    it('returns signed NDA requests', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { ndaRequests: [], total: 0 } })
      const result = await NDAService.getSignedNDAs()
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/signed')
      expect(result.ndaRequests).toEqual([])
    })
  })

  describe('getIncomingRequests', () => {
    it('returns incoming NDA requests', async () => {
      const ndaRequests = [{ id: 1, pitch_id: 3, status: 'pending', requested_at: '2024-01-01', created_at: '2024-01-01' }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { ndaRequests, total: 1 } })

      const result = await NDAService.getIncomingRequests()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/incoming-requests')
      expect(result.ndaRequests).toHaveLength(1)
    })
  })

  describe('getOutgoingRequests', () => {
    it('returns outgoing NDA requests', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { ndaRequests: [], total: 0 } })
      const result = await NDAService.getOutgoingRequests()
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/ndas/outgoing-requests')
      expect(result.total).toBe(0)
    })
  })

  describe('downloadNDA', () => {
    it('downloads NDA as blob', async () => {
      const blob = new Blob(['PDF content'], { type: 'application/pdf' })
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(blob),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await NDAService.downloadNDA(1)
      expect(result).toBeInstanceOf(Blob)

      vi.unstubAllGlobals()
    })

    it('downloads signed NDA when signed=true', async () => {
      const blob = new Blob(['Signed PDF'], { type: 'application/pdf' })
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(blob),
      })
      vi.stubGlobal('fetch', mockFetch)

      await NDAService.downloadNDA(1, true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('download-signed'),
        expect.any(Object)
      )

      vi.unstubAllGlobals()
    })

    it('throws on download failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      })
      vi.stubGlobal('fetch', mockFetch)

      await expect(NDAService.downloadNDA(99)).rejects.toThrow('Failed to download NDA document')

      vi.unstubAllGlobals()
    })
  })
})
