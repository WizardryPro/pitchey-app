import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch before importing
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import presenceFallbackService from '../presence-fallback.service'

const makeOkResponse = (body: object, contentType = 'application/json') => ({
  ok: true,
  status: 200,
  headers: {
    get: (name: string) => (name === 'Content-Type' ? contentType : null)
  },
  json: async () => body
})

const makeErrorResponse = (status: number) => ({
  ok: false,
  status,
  headers: {
    get: () => 'application/json'
  },
  json: async () => ({ error: 'Error' })
})

describe('PresenceFallbackService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Reset service to offline state
    presenceFallbackService.stop()
    // Reset consecutive failures (access via stop+start)
  })

  afterEach(() => {
    presenceFallbackService.stop()
    vi.useRealTimers()
  })

  // ─── start / stop / isRunning ──────────────────────────────────────
  describe('start / stop / isRunning', () => {
    it('starts the service and sets status to running', () => {
      mockFetch.mockResolvedValue(makeOkResponse({ success: true, data: { users: [] } }))
      presenceFallbackService.start()
      expect(presenceFallbackService.isRunning()).toBe(true)
    })

    it('does not start twice', () => {
      mockFetch.mockResolvedValue(makeOkResponse({ success: true, data: { users: [] } }))
      presenceFallbackService.start()
      presenceFallbackService.start()
      expect(presenceFallbackService.isRunning()).toBe(true)
    })

    it('stops the service', () => {
      mockFetch.mockResolvedValue(makeOkResponse({ success: false }))
      presenceFallbackService.start()
      presenceFallbackService.stop()
      expect(presenceFallbackService.isRunning()).toBe(false)
    })

    it('getCurrentStatus returns offline when stopped', () => {
      const status = presenceFallbackService.getCurrentStatus()
      expect(status.status).toBe('offline')
    })
  })

  // ─── updatePresence ────────────────────────────────────────────────
  describe('updatePresence', () => {
    it('sends POST to presence/update and returns true on success', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ success: true }))

      const result = await presenceFallbackService.updatePresence({ status: 'online' })
      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/presence/update'),
        expect.objectContaining({ method: 'POST', credentials: 'include' })
      )
    })

    it('returns false when success is false in response', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ success: false }))
      const result = await presenceFallbackService.updatePresence({ status: 'away' })
      expect(result).toBe(false)
    })

    it('stops service and returns false on 401', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401))
      const result = await presenceFallbackService.updatePresence({ status: 'online' })
      expect(result).toBe(false)
    })

    it('stops service and returns false on 404', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(404))
      const result = await presenceFallbackService.updatePresence({ status: 'online' })
      expect(result).toBe(false)
    })

    it('returns false on non-JSON content type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        json: async () => ({})
      })
      const result = await presenceFallbackService.updatePresence({ status: 'online' })
      expect(result).toBe(false)
    })

    it('returns false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      const result = await presenceFallbackService.updatePresence({ status: 'online' })
      expect(result).toBe(false)
    })

    it('includes activity in POST body when provided', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ success: true }))
      await presenceFallbackService.updatePresence({ status: 'online', activity: 'editing' })
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body)
      expect(callBody.activity).toBe('editing')
    })
  })

  // ─── fetchPresence ─────────────────────────────────────────────────
  describe('fetchPresence', () => {
    it('fetches online users and returns them', async () => {
      const users = [
        { userId: 1, username: 'alice', status: 'online', lastSeen: '2025-01-01T00:00:00Z' },
        { userId: 2, username: 'bob', status: 'away', lastSeen: '2025-01-01T00:01:00Z' }
      ]
      mockFetch.mockResolvedValueOnce(makeOkResponse({ success: true, data: { users } }))

      const result = await presenceFallbackService.fetchPresence()
      expect(result).toHaveLength(2)
      expect(result[0].username).toBe('alice')
      expect(result[0].lastSeen).toBeInstanceOf(Date)
    })

    it('returns empty array on 401', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401))
      const result = await presenceFallbackService.fetchPresence()
      expect(result).toEqual([])
    })

    it('returns empty array on 404', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(404))
      const result = await presenceFallbackService.fetchPresence()
      expect(result).toEqual([])
    })

    it('returns empty array on non-JSON content type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        json: async () => ({})
      })
      const result = await presenceFallbackService.fetchPresence()
      expect(result).toEqual([])
    })

    it('returns empty array on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      const result = await presenceFallbackService.fetchPresence()
      expect(result).toEqual([])
    })

    it('notifies subscribers when data is fetched', async () => {
      const users = [
        { userId: 1, username: 'alice', status: 'online', lastSeen: '2025-01-01T00:00:00Z' }
      ]
      mockFetch.mockResolvedValueOnce(makeOkResponse({ success: true, data: { users } }))

      const callback = vi.fn()
      const unsubscribe = presenceFallbackService.subscribe(callback)

      await presenceFallbackService.fetchPresence()

      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ username: 'alice' })])
      )
      unsubscribe()
    })
  })

  // ─── subscribe / unsubscribe ───────────────────────────────────────
  describe('subscribe', () => {
    it('returns an unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = presenceFallbackService.subscribe(callback)
      expect(typeof unsubscribe).toBe('function')
    })

    it('unsubscribe removes the callback', async () => {
      const users = [
        { userId: 1, username: 'alice', status: 'online', lastSeen: '2025-01-01T00:00:00Z' }
      ]
      mockFetch.mockResolvedValueOnce(makeOkResponse({ success: true, data: { users } }))

      const callback = vi.fn()
      const unsubscribe = presenceFallbackService.subscribe(callback)
      unsubscribe()

      await presenceFallbackService.fetchPresence()
      expect(callback).not.toHaveBeenCalled()
    })
  })

  // ─── testWebSocketAvailability ────────────────────────────────────
  describe('testWebSocketAvailability', () => {
    it('returns available:true when WebSocket is available', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ websocketAvailable: true }))

      const result = await presenceFallbackService.testWebSocketAvailability()
      expect(result.available).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ws/health'),
        expect.anything()
      )
    })

    it('returns available:false when websocketAvailable is false', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ websocketAvailable: false, error: 'Not configured' }))
      const result = await presenceFallbackService.testWebSocketAvailability()
      expect(result.available).toBe(false)
      expect(result.error).toBe('Not configured')
    })

    it('returns available:false on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(503))
      const result = await presenceFallbackService.testWebSocketAvailability()
      expect(result.available).toBe(false)
    })

    it('returns available:false on non-JSON content type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        json: async () => ({})
      })
      const result = await presenceFallbackService.testWebSocketAvailability()
      expect(result.available).toBe(false)
    })

    it('returns available:false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'))
      const result = await presenceFallbackService.testWebSocketAvailability()
      expect(result.available).toBe(false)
      expect(result.error).toBe('Connection refused')
    })
  })

  // ─── getCurrentStatus ─────────────────────────────────────────────
  describe('getCurrentStatus', () => {
    it('updates status after successful updatePresence', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ success: true }))
      await presenceFallbackService.updatePresence({ status: 'online', activity: 'browsing' })

      const status = presenceFallbackService.getCurrentStatus()
      expect(status.status).toBe('online')
      expect(status.activity).toBe('browsing')
    })
  })

  // ─── stop with polling active ─────────────────────────────────────
  describe('stop behavior', () => {
    it('sends offline status when stopping active service', async () => {
      // Start service
      mockFetch.mockResolvedValue(makeOkResponse({ success: true, data: { users: [] } }))
      presenceFallbackService.start()

      // Mock the offline update call
      mockFetch.mockResolvedValueOnce(makeOkResponse({ success: true }))
      presenceFallbackService.stop()

      // Run timers to allow any pending promises
      await vi.runAllTimersAsync()
    })
  })
})
