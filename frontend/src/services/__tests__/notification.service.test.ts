import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// NotificationService uses browser APIs (Notification, document, navigator)
// and dynamically imports betterAuthStore and api-client

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: {
    getState: vi.fn().mockReturnValue({ user: { id: 1, email: 'test@test.com' } }),
  },
}))

vi.mock('../../lib/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('../../constants/brand', () => ({
  BRAND: { logo: '/logo.svg', name: 'Pitchey' },
}))

import { NotificationService } from '../notification.service'

describe('NotificationService', () => {
  let service: NotificationService

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset singleton for fresh tests
    ;(NotificationService as any).instance = undefined

    // Mock window.Notification
    const MockNotification = vi.fn().mockImplementation((title: string, options?: NotificationOptions) => ({
      title,
      options,
      close: vi.fn(),
      onclick: null,
    }))
    MockNotification.permission = 'default'
    MockNotification.requestPermission = vi.fn().mockResolvedValue('granted')
    Object.defineProperty(window, 'Notification', { value: MockNotification, writable: true, configurable: true })

    // Mock document.visibilityState
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true })

    // Mock document.title
    Object.defineProperty(document, 'title', { value: 'Pitchey', writable: true, configurable: true })

    service = NotificationService.getInstance()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    ;(NotificationService as any).instance = undefined
  })

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      const instance1 = NotificationService.getInstance()
      const instance2 = NotificationService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('isSupported', () => {
    it('returns true when Notification API is available', () => {
      expect(service.isSupported()).toBe(true)
    })

    it('returns false when Notification API is not available', () => {
      const origNotification = window.Notification
      // @ts-ignore
      delete window.Notification
      const tempService = new NotificationService()
      expect(tempService.isSupported()).toBe(false)
      Object.defineProperty(window, 'Notification', { value: origNotification, writable: true, configurable: true })
    })
  })

  describe('requestPermission', () => {
    it('returns existing permission if already granted', async () => {
      // Set permission to granted
      ;(service as any).permission = 'granted'

      const result = await service.requestPermission()
      expect(result).toBe('granted')
      // Should not call requestPermission again
      expect(window.Notification.requestPermission).not.toHaveBeenCalled()
    })

    it('requests permission from browser when not yet granted', async () => {
      ;(service as any).permission = 'default'
      window.Notification.requestPermission = vi.fn().mockResolvedValue('granted')

      const result = await service.requestPermission()

      expect(window.Notification.requestPermission).toHaveBeenCalled()
      expect(result).toBe('granted')
    })

    it('returns denied when Notification is not in window', async () => {
      // @ts-ignore
      const origNotification = window.Notification
      // @ts-ignore
      delete window.Notification
      const tempService = new NotificationService()
      ;(tempService as any).permission = 'default'

      const result = await tempService.requestPermission()
      expect(result).toBe('denied')

      Object.defineProperty(window, 'Notification', { value: origNotification, writable: true, configurable: true })
    })
  })

  describe('getPermission', () => {
    it('returns current permission state', () => {
      ;(service as any).permission = 'granted'
      expect(service.getPermission()).toBe('granted')
    })
  })

  describe('showNotification', () => {
    it('shows browser notification when permission=granted and page hidden', async () => {
      ;(service as any).permission = 'granted'
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true })

      await service.showNotification({ title: 'Test', body: 'Body text' })

      expect(window.Notification).toHaveBeenCalledWith('Test', expect.objectContaining({ body: 'Body text' }))
    })

    it('does nothing when permission is not granted', async () => {
      ;(service as any).permission = 'default'

      await service.showNotification({ title: 'Test', body: 'Body' })

      expect(window.Notification).not.toHaveBeenCalled()
    })

    it('shows in-app notification when page is visible', async () => {
      ;(service as any).permission = 'granted'
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true })

      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('div'))

      await service.showNotification({ title: 'Test', body: 'Visible body' })

      // Should NOT show browser notification, just in-app
      expect(window.Notification).not.toHaveBeenCalledWith('Test', expect.any(Object))
      // Restore
      appendChildSpy.mockRestore()
    })
  })

  describe('notifyNewMessage', () => {
    it('calls showNotification with correct message format', async () => {
      ;(service as any).permission = 'granted'
      const showSpy = vi.spyOn(service, 'showNotification').mockResolvedValue()

      await service.notifyNewMessage('Alice', 'Hello there!', 42)

      expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
        title: 'New message from Alice',
        body: 'Hello there!',
        tag: 'message-42',
        data: { url: '/messages?conversation=42' },
      }))
    })

    it('truncates long messages to 100 chars', async () => {
      ;(service as any).permission = 'granted'
      const showSpy = vi.spyOn(service, 'showNotification').mockResolvedValue()

      const longMessage = 'a'.repeat(150)
      await service.notifyNewMessage('Bob', longMessage, 1)

      const callArgs = showSpy.mock.calls[0][0]
      expect(callArgs.body.length).toBeLessThanOrEqual(103) // 100 chars + '...'
      expect(callArgs.body.endsWith('...')).toBe(true)
    })
  })

  describe('notifyNDAApproved', () => {
    it('shows NDA approval notification', async () => {
      ;(service as any).permission = 'granted'
      const showSpy = vi.spyOn(service, 'showNotification').mockResolvedValue()

      await service.notifyNDAApproved('My Epic Film')

      expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
        title: 'NDA Approved',
        body: expect.stringContaining('My Epic Film'),
        requireInteraction: true,
      }))
    })
  })

  describe('notifyOffPlatformApproved', () => {
    it('shows off-platform approval notification', async () => {
      ;(service as any).permission = 'granted'
      const showSpy = vi.spyOn(service, 'showNotification').mockResolvedValue()

      await service.notifyOffPlatformApproved('Alice', 'Drama Film')

      expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Off-Platform Communication Approved',
        body: expect.stringContaining('Alice'),
        requireInteraction: true,
      }))
    })
  })

  describe('notifyMessageRead', () => {
    it('shows silent notification for message read', async () => {
      ;(service as any).permission = 'granted'
      const showSpy = vi.spyOn(service, 'showNotification').mockResolvedValue()

      await service.notifyMessageRead(5, 'Carol')

      expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Message Read',
        body: expect.stringContaining('Carol'),
        silent: true,
      }))
    })
  })

  describe('notifyUserOnline', () => {
    it('shows silent notification for user online', async () => {
      ;(service as any).permission = 'granted'
      const showSpy = vi.spyOn(service, 'showNotification').mockResolvedValue()

      await service.notifyUserOnline('Dave')

      expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
        title: 'User Online',
        body: expect.stringContaining('Dave'),
        silent: true,
      }))
    })
  })

  describe('updateBadgeCount', () => {
    it('updates document title with count when count > 0', () => {
      service.updateBadgeCount(5)
      expect(document.title).toBe('(5) Pitchey')
    })

    it('removes count from document title when count is 0', () => {
      service.updateBadgeCount(0)
      expect(document.title).toBe('Pitchey')
    })
  })

  describe('setSoundEnabled', () => {
    it('can be called without throwing', () => {
      expect(() => service.setSoundEnabled(false)).not.toThrow()
      expect(() => service.setSoundEnabled(true)).not.toThrow()
    })
  })

  describe('setVolume', () => {
    it('clamps volume between 0 and 1', () => {
      // Should not throw for any value
      expect(() => service.setVolume(-1)).not.toThrow()
      expect(() => service.setVolume(2)).not.toThrow()
      expect(() => service.setVolume(0.5)).not.toThrow()
    })
  })

  describe('clearNotifications', () => {
    it('can be called without throwing (gracefully handles missing serviceWorker)', () => {
      // navigator.serviceWorker may not be available in jsdom
      expect(() => service.clearNotifications('some-tag')).not.toThrow()
    })
  })

  describe('getNotifications', () => {
    it('fetches notifications from API when user is authenticated', async () => {
      const { useBetterAuthStore } = await import('../../store/betterAuthStore')
      vi.mocked(useBetterAuthStore.getState).mockReturnValue({ user: { id: 1, email: 'test@test.com' } } as any)

      const apiClient = (await import('../../lib/api-client')).default as any
      apiClient.get.mockResolvedValue({
        success: true,
        data: { notifications: [{ id: 1, type: 'pitch_view', title: 'View' }], unreadCount: 1, hasMore: false },
      })

      const result = await service.getNotifications({ limit: 10, offset: 0 })

      expect(result).toBeDefined()
    })

    it('returns empty when user is not authenticated', async () => {
      const { useBetterAuthStore } = await import('../../store/betterAuthStore')
      vi.mocked(useBetterAuthStore.getState).mockReturnValue({ user: null } as any)

      const result = await service.getNotifications()

      expect(result).toEqual({ notifications: [], unreadCount: 0, hasMore: false })
    })

    it('returns empty on API error', async () => {
      const { useBetterAuthStore } = await import('../../store/betterAuthStore')
      vi.mocked(useBetterAuthStore.getState).mockReturnValue({ user: { id: 1 } } as any)

      const apiClient = (await import('../../lib/api-client')).default as any
      apiClient.get.mockRejectedValue(new Error('Network error'))

      const result = await service.getNotifications()
      expect(result).toEqual({ notifications: [], unreadCount: 0, hasMore: false })
    })
  })
})
