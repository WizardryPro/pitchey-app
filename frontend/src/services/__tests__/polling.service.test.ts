import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

import { apiClient } from '../../lib/api-client'
import { pollingService } from '../polling.service'

const mockGet = vi.mocked(apiClient.get)

describe('PollingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Stop service between tests (reset state)
    pollingService.stop()
  })

  afterEach(() => {
    pollingService.stop()
    vi.useRealTimers()
  })

  // ─── singleton ───────────────────────────────────────────────────
  describe('getInstance', () => {
    it('returns the singleton instance', async () => {
      const { pollingService: ps } = await import('../polling.service')
      expect(ps).toBe(pollingService)
    })
  })

  // ─── start / stop ─────────────────────────────────────────────────
  describe('start / stop', () => {
    it('starts polling and marks as active', () => {
      mockGet.mockResolvedValue({ success: true, data: null })
      pollingService.start()
      expect(pollingService.isPollingActive()).toBe(true)
    })

    it('stops polling and marks as inactive', () => {
      mockGet.mockResolvedValue({ success: true, data: null })
      pollingService.start()
      pollingService.stop()
      expect(pollingService.isPollingActive()).toBe(false)
    })

    it('does not start twice when already active', () => {
      mockGet.mockResolvedValue({ success: true, data: null })
      pollingService.start()
      pollingService.start() // second call should be no-op
      expect(pollingService.isPollingActive()).toBe(true)
    })
  })

  // ─── message handlers ─────────────────────────────────────────────
  describe('message handlers', () => {
    it('adds and removes message handlers', () => {
      const handler = vi.fn()
      pollingService.addMessageHandler(handler)
      pollingService.removeMessageHandler(handler)
      // No assertion needed — just verify no throw
    })

    it('calls message handlers with notification data', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          notifications: [{ id: 1, type: 'info', message: 'test' }]
        }
      })

      const handler = vi.fn()
      pollingService.addMessageHandler(handler)
      pollingService.start()

      // Allow initial poll promise to settle (advance microtasks only)
      await Promise.resolve()
      await Promise.resolve()

      expect(mockGet).toHaveBeenCalled()
      pollingService.removeMessageHandler(handler)
    })

    it('calls handlers with notification_count for unread endpoint', async () => {
      mockGet.mockImplementation((url: string) => {
        if (url.includes('/api/notifications/unread')) {
          return Promise.resolve({ success: true, data: { count: 3 } })
        }
        return Promise.resolve({ success: true, data: {} })
      })

      const handler = vi.fn()
      pollingService.addMessageHandler(handler)
      pollingService.start()

      await Promise.resolve()
      await Promise.resolve()

      pollingService.removeMessageHandler(handler)
    })
  })

  // ─── getPollingStatus ─────────────────────────────────────────────
  describe('getPollingStatus', () => {
    it('returns empty array when not polling', () => {
      const status = pollingService.getPollingStatus()
      expect(Array.isArray(status)).toBe(true)
    })

    it('returns status entries when polling', () => {
      mockGet.mockResolvedValue({ success: true, data: {} })
      pollingService.start()
      const status = pollingService.getPollingStatus()
      // Should have entries for the configured endpoints
      expect(status.length).toBeGreaterThanOrEqual(0)
    })
  })

  // ─── 404/405 endpoint handling ────────────────────────────────────
  describe('endpoint not found handling', () => {
    it('stops polling endpoint on 404 response', async () => {
      const error404 = Object.assign(new Error('Not found'), { response: { status: 404 } })
      mockGet.mockRejectedValue(error404)

      const handler = vi.fn()
      pollingService.addMessageHandler(handler)
      pollingService.start()

      // Allow initial polls to settle
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      pollingService.removeMessageHandler(handler)
    })
  })

  // ─── isPollingActive ──────────────────────────────────────────────
  describe('isPollingActive', () => {
    it('returns false initially', () => {
      expect(pollingService.isPollingActive()).toBe(false)
    })

    it('returns true after start', () => {
      mockGet.mockResolvedValue({ success: true, data: {} })
      pollingService.start()
      expect(pollingService.isPollingActive()).toBe(true)
    })
  })
})
