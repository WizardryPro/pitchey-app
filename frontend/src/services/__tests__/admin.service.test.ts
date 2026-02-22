import { describe, it, expect, vi, beforeEach } from 'vitest'

// AdminService uses fetch directly (not api-client)
// We stub globalThis.fetch for all tests

import { adminService } from '../admin.service'

describe('AdminService', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const makeOkResponse = (data: unknown) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  })

  const makeErrorResponse = (status: number, message: string) => ({
    ok: false,
    status,
    json: () => Promise.resolve({ message }),
  })

  describe('getDashboardStats', () => {
    it('fetches dashboard stats', async () => {
      const stats = { totalUsers: 100, totalPitches: 50, totalRevenue: 5000, pendingNDAs: 3, activeUsers: 80, recentSignups: 5, approvedPitches: 40, rejectedPitches: 10 }
      mockFetch.mockResolvedValue(makeOkResponse(stats))

      const result = await adminService.getDashboardStats()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/dashboard'),
        expect.objectContaining({ method: 'GET', credentials: 'include' })
      )
      expect(result.totalUsers).toBe(100)
      expect(result.totalPitches).toBe(50)
    })

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(403, 'Forbidden'))
      await expect(adminService.getDashboardStats()).rejects.toThrow('Forbidden')
    })
  })

  describe('getRecentActivity', () => {
    it('fetches recent activity', async () => {
      const activities = [{ id: '1', type: 'user_signup', description: 'New signup', timestamp: '2024-01-01' }]
      mockFetch.mockResolvedValue(makeOkResponse(activities))

      const result = await adminService.getRecentActivity()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/moderation-log'),
        expect.any(Object)
      )
      expect(result).toHaveLength(1)
    })

    it('throws on failure', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500, 'Internal Server Error'))
      await expect(adminService.getRecentActivity()).rejects.toThrow('Internal Server Error')
    })
  })

  describe('getUsers', () => {
    it('fetches users list', async () => {
      const users = [{ id: '1', email: 'a@b.com', name: 'Alice', userType: 'creator', credits: 100, status: 'active', createdAt: '', lastLogin: null, pitchCount: 2, investmentCount: 0 }]
      mockFetch.mockResolvedValue(makeOkResponse(users))

      const result = await adminService.getUsers()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/users'),
        expect.any(Object)
      )
      expect(result).toHaveLength(1)
    })

    it('appends filter params to URL', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([]))

      await adminService.getUsers({ search: 'alice', userType: 'creator', status: 'active' })

      const url: string = mockFetch.mock.calls[0][0]
      expect(url).toContain('search=alice')
      expect(url).toContain('userType=creator')
    })

    it('throws on error', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(401, 'Unauthorized'))
      await expect(adminService.getUsers()).rejects.toThrow('Unauthorized')
    })
  })

  describe('updateUser', () => {
    it('updates a user', async () => {
      const updated = { id: '1', email: 'a@b.com', name: 'Alice', userType: 'creator', credits: 150, status: 'active', createdAt: '', lastLogin: null, pitchCount: 2, investmentCount: 0 }
      mockFetch.mockResolvedValue(makeOkResponse(updated))

      const result = await adminService.updateUser('1', { credits: 150 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/user/1'),
        expect.objectContaining({ method: 'PUT' })
      )
      expect(result.credits).toBe(150)
    })

    it('throws on error', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(404, 'User not found'))
      await expect(adminService.updateUser('999', {})).rejects.toThrow('User not found')
    })
  })

  describe('getPitches', () => {
    it('fetches pitches for moderation', async () => {
      const pitches = [{ id: '1', title: 'Drama Film', synopsis: '', genre: 'drama', budget: 50000, creator: { id: '1', name: 'Bob', email: 'b@c.com' }, status: 'pending', createdAt: '' }]
      mockFetch.mockResolvedValue(makeOkResponse(pitches))

      const result = await adminService.getPitches()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/content'),
        expect.any(Object)
      )
      expect(result).toHaveLength(1)
    })

    it('appends filter params', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([]))
      await adminService.getPitches({ status: 'pending', genre: 'drama' })
      const url: string = mockFetch.mock.calls[0][0]
      expect(url).toContain('status=pending')
      expect(url).toContain('genre=drama')
    })
  })

  describe('approvePitch', () => {
    it('approves a pitch', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}))
      await expect(adminService.approvePitch('1', 'Looks good')).resolves.toBeUndefined()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/content/1/feature'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('throws on error', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(404, 'Pitch not found'))
      await expect(adminService.approvePitch('999')).rejects.toThrow('Pitch not found')
    })
  })

  describe('rejectPitch', () => {
    it('rejects a pitch', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}))
      await expect(adminService.rejectPitch('1', 'Violates guidelines')).resolves.toBeUndefined()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/content/1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('flagPitch', () => {
    it('flags a pitch', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}))
      await expect(adminService.flagPitch('1', ['spam'], 'Spam content')).resolves.toBeUndefined()
    })
  })

  describe('getTransactions', () => {
    it('fetches transactions', async () => {
      const transactions = [{ id: '1', type: 'payment', amount: 100, currency: 'USD', status: 'completed', user: { id: '1', name: 'Bob', email: 'b@c.com', userType: 'investor' }, description: 'Test', createdAt: '', updatedAt: '' }]
      mockFetch.mockResolvedValue(makeOkResponse(transactions))

      const result = await adminService.getTransactions()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/reports'),
        expect.any(Object)
      )
      expect(result).toHaveLength(1)
    })

    it('appends filter params', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([]))
      await adminService.getTransactions({ type: 'payment', status: 'completed' })
      const url: string = mockFetch.mock.calls[0][0]
      expect(url).toContain('type=payment')
      expect(url).toContain('status=completed')
    })
  })

  describe('processRefund', () => {
    it('processes a refund', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}))
      await expect(adminService.processRefund('tx1', 50, 'Customer request')).resolves.toBeUndefined()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/bulk-action'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('getSystemSettings', () => {
    it('returns system settings', async () => {
      const settings = {
        maintenance: { enabled: false, message: '' },
        features: { userRegistration: true, pitchSubmission: true, payments: true, messaging: true, ndaWorkflow: true, realTimeUpdates: true },
        limits: { maxPitchesPerUser: 10, maxFileUploadSize: 10, maxDocumentsPerPitch: 5, sessionTimeout: 3600 },
        pricing: { creditPrices: { single: 1, pack5: 4, pack10: 8, pack25: 18 }, subscriptionPlans: { basic: { monthly: 9, yearly: 90 }, premium: { monthly: 19, yearly: 190 }, enterprise: { monthly: 49, yearly: 490 } } },
        notifications: { emailEnabled: true, smsEnabled: false, pushEnabled: true, weeklyDigest: true },
        security: { enforceStrongPasswords: true, twoFactorRequired: false, sessionSecurity: 'normal' as const, apiRateLimit: 100 },
      }
      mockFetch.mockResolvedValue(makeOkResponse(settings))

      const result = await adminService.getSystemSettings()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/settings'),
        expect.any(Object)
      )
      expect(result.maintenance.enabled).toBe(false)
      expect(result.features.userRegistration).toBe(true)
    })
  })

  describe('updateSystemSettings', () => {
    it('updates system settings', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}))
      const settings = {
        maintenance: { enabled: true, message: 'Under maintenance' },
        features: { userRegistration: false, pitchSubmission: true, payments: true, messaging: true, ndaWorkflow: true, realTimeUpdates: true },
        limits: { maxPitchesPerUser: 5, maxFileUploadSize: 5, maxDocumentsPerPitch: 3, sessionTimeout: 1800 },
        pricing: { creditPrices: { single: 1, pack5: 4, pack10: 8, pack25: 18 }, subscriptionPlans: { basic: { monthly: 9, yearly: 90 }, premium: { monthly: 19, yearly: 190 }, enterprise: { monthly: 49, yearly: 490 } } },
        notifications: { emailEnabled: true, smsEnabled: false, pushEnabled: true, weeklyDigest: false },
        security: { enforceStrongPasswords: true, twoFactorRequired: true, sessionSecurity: 'strict' as const, apiRateLimit: 50 },
      }
      await expect(adminService.updateSystemSettings(settings)).resolves.toBeUndefined()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/settings'),
        expect.objectContaining({ method: 'PUT' })
      )
    })
  })

  describe('getAnalytics', () => {
    it('fetches analytics with timeframe', async () => {
      const analytics = { pageViews: 5000, signups: 200, pitchesCreated: 50 }
      mockFetch.mockResolvedValue(makeOkResponse(analytics))

      const result = await adminService.getAnalytics('7d')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/analytics?period=7d'),
        expect.any(Object)
      )
      expect(result.pageViews).toBe(5000)
    })

    it('defaults to 30d timeframe', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}))
      await adminService.getAnalytics()
      const url: string = mockFetch.mock.calls[0][0]
      expect(url).toContain('period=30d')
    })
  })

  describe('getSystemHealth', () => {
    it('fetches system health status', async () => {
      const health = { database: 'healthy', cache: 'healthy', worker: 'healthy' }
      mockFetch.mockResolvedValue(makeOkResponse(health))

      const result = await adminService.getSystemHealth()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/system/health'),
        expect.any(Object)
      )
      expect(result.database).toBe('healthy')
    })
  })

  describe('bulkUpdateUsers', () => {
    it('bulk updates users', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}))
      await expect(adminService.bulkUpdateUsers(['1', '2'], { status: 'banned' })).resolves.toBeUndefined()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/bulk-action'),
        expect.objectContaining({ method: 'POST' })
      )
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.action).toBe('update_users')
      expect(body.userIds).toEqual(['1', '2'])
    })
  })

  describe('bulkModeratePitches', () => {
    it('bulk approves pitches', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}))
      await expect(adminService.bulkModeratePitches(['p1', 'p2'], 'approve')).resolves.toBeUndefined()

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.action).toBe('moderate_approve')
      expect(body.pitchIds).toEqual(['p1', 'p2'])
    })

    it('bulk rejects pitches with data', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}))
      await adminService.bulkModeratePitches(['p3'], 'reject', { reason: 'policy' })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.action).toBe('moderate_reject')
      expect(body.data.reason).toBe('policy')
    })
  })

  describe('exportUsers', () => {
    it('exports users as blob', async () => {
      const blob = new Blob(['csv'], { type: 'text/csv' })
      mockFetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) })

      const result = await adminService.exportUsers({ userType: 'creator' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/reports/generate'),
        expect.objectContaining({ method: 'POST' })
      )
      expect(result).toBeInstanceOf(Blob)
    })

    it('throws on failure', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 })
      await expect(adminService.exportUsers()).rejects.toThrow('Failed to export users')
    })
  })

  describe('exportTransactions', () => {
    it('exports transactions as blob', async () => {
      const blob = new Blob(['csv'], { type: 'text/csv' })
      mockFetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) })

      const result = await adminService.exportTransactions()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/reports/generate'),
        expect.objectContaining({ method: 'POST' })
      )
      expect(result).toBeInstanceOf(Blob)
    })

    it('throws on failure', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 })
      await expect(adminService.exportTransactions()).rejects.toThrow('Failed to export transactions')
    })
  })
})
