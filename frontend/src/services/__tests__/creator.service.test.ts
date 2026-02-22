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
import { CreatorService } from '../creator.service'

const mockApiClient = apiClient as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const defaultStats = {
  totalPitches: 0,
  publishedPitches: 0,
  draftPitches: 0,
  totalViews: 0,
  totalLikes: 0,
  totalNDAs: 0,
  avgEngagementRate: 0,
  monthlyGrowth: 0,
}

describe('CreatorService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDashboard', () => {
    it('returns dashboard data on success', async () => {
      const dashboardData = {
        stats: { ...defaultStats, totalPitches: 5 },
        recentPitches: [{ id: 1, title: 'My Film' }],
        notifications: [],
        activities: [],
      }
      mockApiClient.get.mockResolvedValue({
        success: true,
        data: { dashboard: dashboardData },
      })

      const result = await CreatorService.getDashboard()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/creator/dashboard')
      expect(result.stats.totalPitches).toBe(5)
      expect(result.recentPitches).toHaveLength(1)
    })

    it('returns default data when dashboard is missing', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      const result = await CreatorService.getDashboard()
      expect(result.stats.totalPitches).toBe(0)
      expect(result.recentPitches).toEqual([])
    })

    it('throws on API failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Unauthorized' } })
      await expect(CreatorService.getDashboard()).rejects.toThrow('Unauthorized')
    })
  })

  describe('getStats', () => {
    it('returns creator stats', async () => {
      const stats = { ...defaultStats, totalPitches: 3, publishedPitches: 2 }
      mockApiClient.get.mockResolvedValue({ success: true, data: { stats } })

      const result = await CreatorService.getStats('month')

      const url: string = mockApiClient.get.mock.calls[0][0]
      expect(url).toContain('/api/creator/stats')
      expect(url).toContain('period=month')
      expect(result.totalPitches).toBe(3)
    })

    it('returns default stats when missing from response', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      const result = await CreatorService.getStats()
      expect(result).toEqual(defaultStats)
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(CreatorService.getStats()).rejects.toThrow()
    })
  })

  describe('getAnalytics', () => {
    it('returns analytics data', async () => {
      const analyticsData = {
        topPitches: [{ id: 1, title: 'Top', views: 1000, likes: 50, ndas: 5 }],
        audienceBreakdown: [{ userType: 'investor' as const, count: 10, percentage: 60 }],
      }
      mockApiClient.get.mockResolvedValue({ success: true, data: analyticsData })

      const result = await CreatorService.getAnalytics({ pitchId: 1 })

      const url: string = mockApiClient.get.mock.calls[0][0]
      expect(url).toContain('/api/creator/analytics')
      expect(url).toContain('pitchId=1')
      expect(result.topPitches).toHaveLength(1)
    })

    it('returns default analytics when data is missing', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: null })
      const result = await CreatorService.getAnalytics()
      expect(result.topPitches).toEqual([])
      expect(result.audienceBreakdown).toEqual([])
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Analytics error' } })
      await expect(CreatorService.getAnalytics()).rejects.toThrow('Analytics error')
    })
  })

  describe('getNotifications', () => {
    it('returns notifications list', async () => {
      const notifications = [{ id: 1, type: 'pitch_view' as const, title: 'View', message: 'Someone viewed', isRead: false, createdAt: '' }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { notifications, total: 1, unread: 1 } })

      const result = await CreatorService.getNotifications({ limit: 10 })

      const url: string = mockApiClient.get.mock.calls[0][0]
      expect(url).toContain('/api/creator/notifications')
      expect(url).toContain('limit=10')
      expect(result.notifications).toHaveLength(1)
      expect(result.unread).toBe(1)
    })

    it('returns empty list on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(CreatorService.getNotifications()).rejects.toThrow()
    })
  })

  describe('markNotificationRead', () => {
    it('marks a notification as read', async () => {
      mockApiClient.post.mockResolvedValue({ success: true })
      await expect(CreatorService.markNotificationRead(5)).resolves.toBeUndefined()
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/creator/notifications/5/read', {})
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(CreatorService.markNotificationRead(5)).rejects.toThrow()
    })
  })

  describe('markAllNotificationsRead', () => {
    it('marks all notifications as read', async () => {
      mockApiClient.post.mockResolvedValue({ success: true })
      await expect(CreatorService.markAllNotificationsRead()).resolves.toBeUndefined()
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/creator/notifications/read-all', {})
    })
  })

  describe('getActivityFeed', () => {
    it('returns activity list', async () => {
      const activities = [{ id: 1, type: 'pitch_created' as const, description: 'Created a pitch', createdAt: '' }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { activities, total: 1 } })

      const result = await CreatorService.getActivityFeed({ limit: 20 })

      const url: string = mockApiClient.get.mock.calls[0][0]
      expect(url).toContain('/api/creator/activities')
      expect(result.activities).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('returns empty list when no activities', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      const result = await CreatorService.getActivityFeed()
      expect(result.activities).toEqual([])
      expect(result.total).toBe(0)
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(CreatorService.getActivityFeed()).rejects.toThrow()
    })
  })

  describe('getFollowers', () => {
    it('returns followers list', async () => {
      const followers = [{ id: 1, email: 'follower@test.com', username: 'follower', userType: 'investor', emailVerified: true, isActive: true, createdAt: '', updatedAt: '' }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { followers, total: 1 } })

      const result = await CreatorService.getFollowers({ limit: 10 })

      const url: string = mockApiClient.get.mock.calls[0][0]
      expect(url).toContain('/api/creator/followers')
      expect(result.followers).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('returns empty on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(CreatorService.getFollowers()).rejects.toThrow()
    })
  })

  describe('getEarnings', () => {
    it('returns earnings data', async () => {
      const earnings = { total: 5000, pending: 1000, paid: 4000, transactions: [] }
      mockApiClient.get.mockResolvedValue({ success: true, data: { earnings } })

      const result = await CreatorService.getEarnings('month')

      const url: string = mockApiClient.get.mock.calls[0][0]
      expect(url).toContain('/api/creator/earnings')
      expect(url).toContain('period=month')
      expect(result.total).toBe(5000)
    })

    it('returns default earnings when missing', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      const result = await CreatorService.getEarnings()
      expect(result.total).toBe(0)
      expect(result.transactions).toEqual([])
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(CreatorService.getEarnings()).rejects.toThrow()
    })
  })

  describe('getRecommendedActions', () => {
    it('returns recommended actions', async () => {
      const recommendations = [{ id: 'a1', title: 'Add logo', description: 'Upload a logo', priority: 'high' as const, action: '/profile' }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { recommendations } })

      const result = await CreatorService.getRecommendedActions()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/creator/recommendations')
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Add logo')
    })

    it('returns empty array when no recommendations', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      const result = await CreatorService.getRecommendedActions()
      expect(result).toEqual([])
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(CreatorService.getRecommendedActions()).rejects.toThrow()
    })
  })

  describe('exportData', () => {
    it('exports data as blob via fetch', async () => {
      const blob = new Blob(['csv data'], { type: 'text/csv' })
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) })
      vi.stubGlobal('fetch', mockFetch)

      const result = await CreatorService.exportData('csv')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/creator/export?format=csv'),
        expect.any(Object)
      )
      expect(result).toBeInstanceOf(Blob)

      vi.unstubAllGlobals()
    })

    it('throws on failed export', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
      vi.stubGlobal('fetch', mockFetch)

      await expect(CreatorService.exportData('pdf')).rejects.toThrow('Failed to export data')

      vi.unstubAllGlobals()
    })
  })
})
