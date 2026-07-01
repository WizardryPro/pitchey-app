import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock api-client before importing the service
vi.mock('@/lib/api-client', () => {
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

import apiClient from '@/lib/api-client'
import { NotificationsService, type Notification } from '../notifications.service'

const mockGet = vi.mocked(apiClient.get)
const mockPut = vi.mocked(apiClient.put)
const mockPost = vi.mocked(apiClient.post)

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 1,
  userId: 10,
  type: 'info_request',
  title: 'Test Notification',
  message: 'You have a new notification',
  isRead: false,
  createdAt: '2025-01-01T00:00:00Z',
  ...overrides,
})

describe('NotificationsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── getNotifications ─────────────────────────────────────────────
  describe('getNotifications', () => {
    it('returns notifications array on success', async () => {
      const notifications = [makeNotification({ id: 1 }), makeNotification({ id: 2 })]
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { notifications }
      })

      const result = await NotificationsService.getNotifications(20)
      expect(result).toEqual(notifications)
      expect(mockGet).toHaveBeenCalledWith('/api/user/notifications?limit=20')
    })

    it('returns empty array when no notifications in response', async () => {
      mockGet.mockResolvedValueOnce({ success: true, data: {} })
      const result = await NotificationsService.getNotifications()
      expect(result).toEqual([])
    })

    it('returns empty array on error', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'))
      const result = await NotificationsService.getNotifications()
      expect(result).toEqual([])
    })

    it('uses default limit of 20', async () => {
      mockGet.mockResolvedValueOnce({ success: false, data: null })
      await NotificationsService.getNotifications()
      expect(mockGet).toHaveBeenCalledWith('/api/user/notifications?limit=20')
    })
  })

  // ─── getUnreadCount ───────────────────────────────────────────────
  describe('getUnreadCount', () => {
    it('returns count on success', async () => {
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { count: 5 }
      })

      const count = await NotificationsService.getUnreadCount()
      expect(count).toBe(5)
      expect(mockGet).toHaveBeenCalledWith('/api/notifications/unread')
    })

    it('returns 0 when no data', async () => {
      mockGet.mockResolvedValueOnce({ success: true, data: null })
      const count = await NotificationsService.getUnreadCount()
      expect(count).toBe(0)
    })

    it('returns 0 on error', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'))
      const count = await NotificationsService.getUnreadCount()
      expect(count).toBe(0)
    })
  })

  // ─── markAsRead ───────────────────────────────────────────────────
  describe('markAsRead', () => {
    it('marks notification as read and returns true', async () => {
      mockPut.mockResolvedValueOnce({ success: true })

      const result = await NotificationsService.markAsRead(1)
      expect(result).toBe(true)
      expect(mockPut).toHaveBeenCalledWith('/api/notifications/1/read')
    })

    it('returns false on failure', async () => {
      mockPut.mockResolvedValueOnce({ success: false })
      const result = await NotificationsService.markAsRead(1)
      expect(result).toBe(false)
    })

    it('returns false on error', async () => {
      mockPut.mockRejectedValueOnce(new Error('Network error'))
      const result = await NotificationsService.markAsRead(1)
      expect(result).toBe(false)
    })
  })

  // ─── markMultipleAsRead ───────────────────────────────────────────
  describe('markMultipleAsRead', () => {
    it('calls the bulk read endpoint', async () => {
      mockPut.mockResolvedValueOnce({ success: true })

      const result = await NotificationsService.markMultipleAsRead([1, 2, 3])
      expect(result).toBe(true)
      expect(mockPut).toHaveBeenCalledWith('/api/notifications/read-multiple', {
        notificationIds: [1, 2, 3]
      })
    })

    it('returns false on error', async () => {
      mockPut.mockRejectedValueOnce(new Error('Network error'))
      const result = await NotificationsService.markMultipleAsRead([1])
      expect(result).toBe(false)
    })
  })

  // ─── markAllAsRead ────────────────────────────────────────────────
  describe('markAllAsRead', () => {
    it('returns true when there are no unread notifications', async () => {
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { notifications: [makeNotification({ isRead: true })] }
      })

      const result = await NotificationsService.markAllAsRead()
      expect(result).toBe(true)
    })

    it('marks all unread notifications when they exist', async () => {
      const notifications = [
        makeNotification({ id: 1, isRead: false }),
        makeNotification({ id: 2, isRead: true }),
        makeNotification({ id: 3, isRead: false }),
      ]
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { notifications }
      })
      mockPut.mockResolvedValueOnce({ success: true })

      const result = await NotificationsService.markAllAsRead()
      expect(result).toBe(true)
      expect(mockPut).toHaveBeenCalledWith('/api/notifications/read-multiple', {
        notificationIds: [1, 3]
      })
    })

    it('returns true when getNotifications returns empty (error internally caught)', async () => {
      // getNotifications catches its own errors and returns []
      // so markAllAsRead sees [] and returns true (nothing to mark)
      mockGet.mockRejectedValueOnce(new Error('Network error'))
      const result = await NotificationsService.markAllAsRead()
      expect(result).toBe(true)
    })
  })

  // ─── getPreferences ───────────────────────────────────────────────
  describe('getPreferences', () => {
    it('returns preferences on success', async () => {
      const prefs = { email: true, push: false, sms: false, marketing: true }
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { preferences: prefs }
      })

      const result = await NotificationsService.getPreferences()
      expect(result).toEqual(prefs)
    })

    it('returns null on error', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'))
      const result = await NotificationsService.getPreferences()
      expect(result).toBeNull()
    })
  })

  // ─── updatePreferences ────────────────────────────────────────────
  describe('updatePreferences', () => {
    it('updates preferences and returns true', async () => {
      mockPost.mockResolvedValueOnce({ success: true })

      const result = await NotificationsService.updatePreferences({ email: false })
      expect(result).toBe(true)
      // Registered verb is POST, not PUT (PUT 404'd) — see updatePreferences impl.
      expect(mockPost).toHaveBeenCalledWith('/api/notifications/preferences', { email: false })
    })

    it('returns false on error', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network error'))
      const result = await NotificationsService.updatePreferences({ email: true })
      expect(result).toBe(false)
    })
  })

  // ─── convertToFrontendFormat ──────────────────────────────────────
  describe('convertToFrontendFormat', () => {
    it('converts notification to frontend format', () => {
      const notification = makeNotification({
        id: 42,
        type: 'nda_approved',
        title: 'NDA Approved',
        message: 'Your NDA was approved',
        isRead: true,
        createdAt: '2025-01-15T10:30:00Z',
        relatedId: 5,
        relatedType: 'pitch'
      })

      const result = NotificationsService.convertToFrontendFormat(notification)
      expect(result.id).toBe('42')
      expect(result.type).toBe('success')
      expect(result.title).toBe('NDA Approved')
      expect(result.read).toBe(true)
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.metadata.backendId).toBe(42)
      expect(result.metadata.relatedId).toBe(5)
    })

    it('maps nda_rejected to error type', () => {
      const notification = makeNotification({ type: 'nda_rejected' })
      const result = NotificationsService.convertToFrontendFormat(notification)
      expect(result.type).toBe('error')
    })

    it('maps nda_request to warning type', () => {
      const notification = makeNotification({ type: 'nda_request' })
      const result = NotificationsService.convertToFrontendFormat(notification)
      expect(result.type).toBe('warning')
    })

    it('maps unknown type to info', () => {
      const notification = makeNotification({ type: 'unknown_type' })
      const result = NotificationsService.convertToFrontendFormat(notification)
      expect(result.type).toBe('info')
    })

    it('maps follow to success', () => {
      const notification = makeNotification({ type: 'follow' })
      const result = NotificationsService.convertToFrontendFormat(notification)
      expect(result.type).toBe('success')
    })
  })

  // ─── getNotificationActions ───────────────────────────────────────
  describe('getNotificationActions', () => {
    it('returns actions for nda_request type', () => {
      const notification = makeNotification({ type: 'nda_request', data: { pitchId: 10 } })
      const actions = NotificationsService.getNotificationActions(notification)
      expect(actions.length).toBe(2)
      expect(actions[0].label).toBe('View Pitch')
      expect(actions[0].type).toBe('primary')
      expect(actions[1].label).toBe('Manage NDAs')
    })

    it('returns actions for message type', () => {
      const notification = makeNotification({ type: 'message' })
      const actions = NotificationsService.getNotificationActions(notification)
      expect(actions.length).toBe(1)
      expect(actions[0].label).toBe('View Messages')
    })

    it('returns actions for investment type', () => {
      const notification = makeNotification({ type: 'investment' })
      const actions = NotificationsService.getNotificationActions(notification)
      expect(actions.length).toBe(1)
      expect(actions[0].label).toBe('View Investment')
    })

    it('returns actions for follow type', () => {
      const notification = makeNotification({ type: 'follow', data: { userId: 5 } })
      const actions = NotificationsService.getNotificationActions(notification)
      expect(actions.length).toBe(1)
      expect(actions[0].label).toBe('View Profile')
    })

    it('returns empty array for unknown type', () => {
      const notification = makeNotification({ type: 'unknown' })
      const actions = NotificationsService.getNotificationActions(notification)
      expect(actions).toEqual([])
    })

    // Regression: engagement notifications (comment/like/feedback) had NO type-
    // specific action, so the feed offered no route to the target. The backend
    // stores a deep-link in action_url — surface it as a generic 'View' action.
    it('adds a generic View action from actionUrl when no type-specific action exists', () => {
      const notification = makeNotification({ type: 'pitch_comment', actionUrl: '/pitch/213' })
      const actions = NotificationsService.getNotificationActions(notification)
      expect(actions.length).toBe(1)
      expect(actions[0].label).toBe('View')
    })

    it('does not add the generic View action when a type-specific action already exists', () => {
      const notification = makeNotification({ type: 'message', actionUrl: '/pitch/213' })
      const actions = NotificationsService.getNotificationActions(notification)
      expect(actions.length).toBe(1)
      expect(actions[0].label).toBe('View Messages')
    })
  })

  // ─── actor identity + deep-link mapping (the notification-routing bug) ──────
  describe('actor + target mapping', () => {
    it('normalizes backend snake_case actor + action_url onto the notification', async () => {
      mockGet.mockResolvedValueOnce({
        success: true,
        data: {
          notifications: [{
            id: 71, user_id: 10, type: 'pitch_comment',
            title: 'New comment on your pitch', message: 'A comment', is_read: false,
            created_at: '2026-06-30T00:00:00Z',
            related_user_id: 1049, actor_username: 'skyclothfilms',
            actor_name: 'skyclothfilms', actor_avatar: 'https://x/a.png',
            action_url: '/pitch/213', related_pitch_id: 213, target_pitch_title: 'Bob',
          }],
        },
      })
      const [n] = await NotificationsService.getNotifications(20)
      expect(n.actorId).toBe(1049)
      expect(n.actorUsername).toBe('skyclothfilms')
      expect(n.actorName).toBe('skyclothfilms')
      expect(n.actionUrl).toBe('/pitch/213')
      expect(n.relatedId).toBe(213)
      expect(n.targetPitchTitle).toBe('Bob')
    })

    it('falls back to legacy from_user_* actor aliases', async () => {
      mockGet.mockResolvedValueOnce({
        success: true,
        data: {
          notifications: [{
            id: 5, user_id: 10, type: 'follow', title: 'New follower', message: '',
            is_read: false, created_at: '2026-06-30T00:00:00Z',
            from_user_name: 'legacyname', from_user_avatar: 'https://x/l.png',
          }],
        },
      })
      const [n] = await NotificationsService.getNotifications()
      expect(n.actorName).toBe('legacyname')
      expect(n.actorAvatar).toBe('https://x/l.png')
    })

    it('convertToFrontendFormat surfaces actor + actionUrl to the feed item', () => {
      const item = NotificationsService.convertToFrontendFormat(makeNotification({
        actorName: 'skyclothfilms', actorUsername: 'skyclothfilms', actionUrl: '/pitch/213',
      }))
      expect((item as any).actorName).toBe('skyclothfilms')
      expect((item as any).actorUsername).toBe('skyclothfilms')
      expect((item as any).actionUrl).toBe('/pitch/213')
    })
  })
})
