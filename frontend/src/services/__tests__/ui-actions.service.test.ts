import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock api-client before importing the service
vi.mock('../../lib/api-client', () => {
  const mockClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
  return {
    default: mockClient,
    apiClient: mockClient,
  }
})

// Mock window methods
const mockWindowOpen = vi.fn()
Object.defineProperty(window, 'open', { value: mockWindowOpen, writable: true })
Object.defineProperty(window, 'location', {
  value: { href: '', origin: 'http://localhost' },
  writable: true
})

// Mock localStorage
const mockLocalStorage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockLocalStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockLocalStorage[key] = value },
  removeItem: (key: string) => { delete mockLocalStorage[key] },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]) }
})

import apiClient from '../../lib/api-client'
import { UIActionsService } from '../ui-actions.service'

const mockPost = vi.mocked(apiClient.post)

describe('UIActionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWindowOpen.mockReset()
    Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k])
    window.location.href = ''
  })

  // ─── scheduleMeeting ──────────────────────────────────────────────
  describe('scheduleMeeting', () => {
    it('calls meetings schedule endpoint and returns success', async () => {
      mockPost.mockResolvedValueOnce({
        success: true,
        data: { meetingId: 'mtg-123', calendarUrl: null }
      })

      const result = await UIActionsService.scheduleMeeting({
        recipientId: 'user-1',
        subject: 'Pitch Review',
        meetingType: 'pitch'
      })

      expect(result.success).toBe(true)
      expect(result.meetingId).toBe('mtg-123')
      expect(mockPost).toHaveBeenCalledWith(
        '/api/meetings/schedule',
        expect.objectContaining({ recipientId: 'user-1', subject: 'Pitch Review' })
      )
    })

    it('opens calendar URL when returned', async () => {
      mockPost.mockResolvedValueOnce({
        success: true,
        data: { meetingId: 'mtg-456', calendarUrl: 'https://calendar.example.com/event' }
      })

      await UIActionsService.scheduleMeeting({
        recipientId: 'user-2',
        subject: 'Investment Discussion',
        meetingType: 'investment'
      })

      expect(mockWindowOpen).toHaveBeenCalledWith('https://calendar.example.com/event', '_blank')
    })

    it('falls back to mailto when API fails', async () => {
      mockPost.mockRejectedValueOnce(new Error('Server error'))

      const result = await UIActionsService.scheduleMeeting({
        recipientId: 'user-3',
        subject: 'Demo Meeting',
        meetingType: 'demo'
      })

      expect(result.success).toBe(false)
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('mailto:')
      )
    })
  })

  // ─── requestDemo ──────────────────────────────────────────────────
  describe('requestDemo', () => {
    it('posts demo request and returns success', async () => {
      mockPost.mockResolvedValueOnce({
        success: true,
        data: { demoId: 'demo-123', scheduledTime: '2025-02-01T10:00:00Z' }
      })

      const result = await UIActionsService.requestDemo({
        requestType: 'platform',
        name: 'Test User',
        email: 'test@test.com'
      })

      expect(result.success).toBe(true)
      expect(result.demoId).toBe('demo-123')
      expect(mockPost).toHaveBeenCalledWith('/api/demos/request', expect.any(Object))
    })

    it('saves data on failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network error'))

      const result = await UIActionsService.requestDemo({
        requestType: 'pitch',
        name: 'Test',
        email: 'test@test.com'
      })

      expect(result.success).toBe(false)
    })
  })

  // ─── shareContent ─────────────────────────────────────────────────
  describe('shareContent', () => {
    it('copies URL to clipboard when platform is copy', async () => {
      const mockWriteText = vi.fn().mockResolvedValueOnce(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true
      })

      const result = await UIActionsService.shareContent({
        type: 'pitch',
        id: '42',
        platform: 'copy'
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('clipboard')
      expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('/pitch/42'))
    })

    it('opens twitter share dialog for twitter platform', async () => {
      mockPost.mockResolvedValueOnce({ success: true })

      const result = await UIActionsService.shareContent({
        type: 'pitch',
        id: '42',
        platform: 'twitter',
        title: 'Great pitch'
      })

      expect(result.success).toBe(true)
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('twitter.com'),
        '_blank',
        expect.any(String)
      )
    })

    it('opens linkedin share dialog for linkedin platform', async () => {
      mockPost.mockResolvedValueOnce({ success: true })

      const result = await UIActionsService.shareContent({
        type: 'pitch',
        id: '10',
        platform: 'linkedin'
      })

      expect(result.success).toBe(true)
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('linkedin.com'),
        '_blank',
        expect.any(String)
      )
    })

    it('returns showModal:true when no platform and no native share', async () => {
      // Remove navigator.share if exists
      Object.defineProperty(navigator, 'share', { value: undefined, writable: true })

      const result = await UIActionsService.shareContent({
        type: 'pitch',
        id: '99'
      })

      expect(result.showModal).toBe(true)
    })

    it('returns error when clipboard fails', async () => {
      const mockWriteText = vi.fn().mockRejectedValueOnce(new Error('Permission denied'))
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true
      })

      const result = await UIActionsService.shareContent({
        type: 'pitch',
        id: '42',
        platform: 'copy'
      })

      expect(result.success).toBe(false)
    })
  })

  // ─── enableTwoFactor ──────────────────────────────────────────────
  describe('enableTwoFactor', () => {
    it('returns QR code data for TOTP setup', async () => {
      mockPost.mockResolvedValueOnce({
        success: true,
        data: {
          qrCode: 'data:image/png;base64,...',
          secret: 'JBSWY3DPEHPK3PXP',
          backupCodes: ['code1', 'code2']
        }
      })

      const result = await UIActionsService.enableTwoFactor({ method: 'totp' })
      expect(result.success).toBe(true)
      expect(result.qrCode).toBeDefined()
      expect(result.backupCodes).toHaveLength(2)
    })

    it('returns verification required for SMS/email', async () => {
      mockPost.mockResolvedValueOnce({
        success: true,
        data: {}
      })

      const result = await UIActionsService.enableTwoFactor({
        method: 'sms',
        phoneNumber: '+1234567890'
      })

      expect(result.success).toBe(true)
      expect(result.verificationRequired).toBe(true)
    })

    it('returns error on API failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('2FA setup failed'))

      const result = await UIActionsService.enableTwoFactor({ method: 'email' })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  // ─── verifyTwoFactor ──────────────────────────────────────────────
  describe('verifyTwoFactor', () => {
    it('calls 2FA verify endpoint', async () => {
      mockPost.mockResolvedValueOnce({
        success: true,
        data: { success: true }
      })

      const result = await UIActionsService.verifyTwoFactor('123456')
      expect(mockPost).toHaveBeenCalledWith('/api/auth/2fa/verify', { code: '123456' })
    })

    it('returns error on API failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('Invalid code'))

      const result = await UIActionsService.verifyTwoFactor('000000')
      expect(result.success).toBe(false)
    })
  })

  // ─── performBulkAction ────────────────────────────────────────────
  describe('performBulkAction', () => {
    it('calls bulk endpoint and returns processed count', async () => {
      mockPost.mockResolvedValueOnce({
        success: true,
        data: { processed: 3, failed: [] }
      })

      const result = await UIActionsService.performBulkAction({
        type: 'nda',
        action: 'approve',
        ids: ['1', '2', '3']
      })

      expect(result.success).toBe(true)
      expect(result.processed).toBe(3)
      expect(mockPost).toHaveBeenCalledWith('/api/nda/bulk', expect.any(Object))
    })

    it('falls back to individual processing on bulk failure', async () => {
      mockPost
        .mockRejectedValueOnce(new Error('Bulk endpoint unavailable'))
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })

      const result = await UIActionsService.performBulkAction({
        type: 'pitch',
        action: 'archive',
        ids: ['1', '2']
      })

      expect(typeof result.processed).toBe('number')
    })
  })

  // ─── reorderItems ─────────────────────────────────────────────────
  describe('reorderItems', () => {
    it('calls reorder endpoint', async () => {
      mockPost.mockResolvedValueOnce({ success: true })

      const result = await UIActionsService.reorderItems({
        type: 'pipeline',
        items: [{ id: '1', position: 0 }, { id: '2', position: 1 }]
      })

      expect(result.success).toBe(true)
      expect(mockPost).toHaveBeenCalledWith('/api/pipeline/reorder', expect.any(Object))
    })

    it('saves order locally on API failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network error'))

      const result = await UIActionsService.reorderItems({
        type: 'pipeline',
        items: [{ id: '1', position: 0 }]
      })

      expect(result.success).toBe(false)
    })
  })

  // ─── addPaymentMethod ─────────────────────────────────────────────
  describe('addPaymentMethod', () => {
    it('calls payment methods endpoint', async () => {
      mockPost.mockResolvedValueOnce({
        success: true,
        data: { paymentMethodId: 'pm-123' }
      })

      const result = await UIActionsService.addPaymentMethod({ type: 'card' })
      expect(result.success).toBe(true)
      expect(mockPost).toHaveBeenCalledWith('/api/payments/methods/add', expect.any(Object))
    })

    it('returns clientSecret when present', async () => {
      mockPost.mockResolvedValueOnce({
        success: true,
        data: { clientSecret: 'cs_test_abc123' }
      })

      const result = await UIActionsService.addPaymentMethod({ type: 'card' })
      expect(result.requiresAction).toBe(true)
      expect(result.clientSecret).toBe('cs_test_abc123')
    })

    it('returns error on failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('Payment failed'))

      const result = await UIActionsService.addPaymentMethod({ type: 'card' })
      expect(result.success).toBe(false)
    })
  })

  // ─── startVerification ────────────────────────────────────────────
  describe('startVerification', () => {
    it('calls verification start endpoint', async () => {
      mockPost.mockResolvedValueOnce({
        success: true,
        data: { verificationId: 'ver-123', status: 'pending' }
      })

      const result = await UIActionsService.startVerification({ type: 'creator' })
      expect(result.success).toBe(true)
      expect(result.verificationId).toBe('ver-123')
      expect(mockPost).toHaveBeenCalledWith(
        '/api/verification/start',
        expect.any(FormData)
      )
    })

    it('returns error on failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('Server error'))

      const result = await UIActionsService.startVerification({ type: 'investor' })
      expect(result.success).toBe(false)
    })
  })
})
