import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock config to avoid lazy-proxy issues ──────────────────────────
vi.mock('../../config', () => ({
  config: { API_URL: 'http://localhost:8001', WS_URL: 'ws://localhost:8001' },
  API_URL: 'http://localhost:8001',
  WS_URL: 'ws://localhost:8001',
}))

// ─── Mock axios ───────────────────────────────────────────────────────
// api.ts uses axios; we mock the create() factory to get control over
// request/response without standing up an HTTP server.
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()
const mockInterceptorAdd = vi.fn()

const mockAxiosInstance = {
  get: mockGet,
  post: mockPost,
  put: mockPut,
  delete: mockDelete,
  interceptors: {
    response: { use: mockInterceptorAdd },
  },
}

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
  },
}))

// ─── Dynamic import (after all vi.mock calls) ─────────────────────────
let api: any
let authAPI: any
let pitchAPI: any
let ndaAPI: any

beforeAll(async () => {
  const mod = await import('../api')
  api = mod.default
  authAPI = mod.authAPI
  pitchAPI = mod.pitchAPI
  ndaAPI = mod.ndaAPI
})

describe('api.ts (axios layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Default export (the axios instance) ──────────────────────────
  describe('default export', () => {
    it('is an object with get/post/put/delete', () => {
      expect(typeof api.get).toBe('function')
      expect(typeof api.post).toBe('function')
      expect(typeof api.put).toBe('function')
      expect(typeof api.delete).toBe('function')
    })
  })

  // ─── authAPI ──────────────────────────────────────────────────────
  describe('authAPI.loginCreator', () => {
    it('calls /api/auth/creator/login and returns user', async () => {
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: { token: 'tok', user: { id: 1, email: 'a@b.com' } } },
      })
      const result = await authAPI.loginCreator('a@b.com', 'pass')
      expect(mockPost).toHaveBeenCalledWith('/api/auth/creator/login', { email: 'a@b.com', password: 'pass' })
      expect(result.data.user).toEqual({ id: 1, email: 'a@b.com' })
    })
  })

  describe('authAPI.loginInvestor', () => {
    it('calls /api/auth/investor/login', async () => {
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: { token: 'tok', user: { id: 2 } } },
      })
      const result = await authAPI.loginInvestor('inv@b.com', 'pass')
      expect(mockPost).toHaveBeenCalledWith('/api/auth/investor/login', expect.any(Object))
      expect(result.data.user).toEqual({ id: 2 })
    })
  })

  describe('authAPI.loginProduction', () => {
    it('calls /api/auth/production/login', async () => {
      mockPost.mockResolvedValueOnce({
        data: { success: true, data: { token: 'tok', user: { id: 3 } } },
      })
      const result = await authAPI.loginProduction('prod@b.com', 'pass')
      expect(mockPost).toHaveBeenCalledWith('/api/auth/production/login', expect.any(Object))
      expect(result.data.user).toEqual({ id: 3 })
    })
  })

  describe('authAPI.logout', () => {
    it('calls /api/auth/logout and clears sessionStorage', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } })
      await authAPI.logout()
      expect(mockPost).toHaveBeenCalledWith('/api/auth/logout', {})
      // sessionStorage.clear is mocked globally in setup.ts
      expect(global.sessionStorage.clear).toHaveBeenCalled()
    })

    it('still clears sessionStorage even when backend throws', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network error'))
      await authAPI.logout()
      expect(global.sessionStorage.clear).toHaveBeenCalled()
    })
  })

  describe('authAPI.requestPasswordReset', () => {
    it('posts email and turnstileToken', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } })
      await authAPI.requestPasswordReset('u@example.com', 'token123')
      expect(mockPost).toHaveBeenCalledWith('/api/auth/forgot-password', {
        email: 'u@example.com',
        turnstileToken: 'token123',
      })
    })
  })

  describe('authAPI.resetPassword', () => {
    it('posts token and newPassword', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } })
      await authAPI.resetPassword('reset-tok', 'newPass123')
      expect(mockPost).toHaveBeenCalledWith('/api/auth/reset-password', {
        token: 'reset-tok',
        newPassword: 'newPass123',
      })
    })
  })

  describe('authAPI.verifyEmail', () => {
    it('posts verification token', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } })
      await authAPI.verifyEmail('verify-tok')
      expect(mockPost).toHaveBeenCalledWith('/api/auth/verify-email', { token: 'verify-tok' })
    })
  })

  describe('authAPI.resendVerificationEmail', () => {
    it('posts email for resend', async () => {
      mockPost.mockResolvedValueOnce({ data: {} })
      await authAPI.resendVerificationEmail('u@example.com')
      expect(mockPost).toHaveBeenCalledWith('/api/auth/resend-verification', { email: 'u@example.com' })
    })
  })

  // ─── pitchAPI ─────────────────────────────────────────────────────
  describe('pitchAPI.getPublic', () => {
    it('returns items from data.items', async () => {
      const items = [{ id: 1, title: 'Test' }]
      mockGet.mockResolvedValueOnce({ data: { items } })
      const result = await pitchAPI.getPublic()
      expect(result).toEqual(items)
    })

    it('returns data.data.pitches as fallback', async () => {
      const pitches = [{ id: 2, title: 'Alt' }]
      mockGet.mockResolvedValueOnce({ data: { data: { pitches } } })
      const result = await pitchAPI.getPublic()
      expect(result).toEqual(pitches)
    })
  })

  describe('pitchAPI.getAll', () => {
    it('returns empty array on exception', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network'))
      const result = await pitchAPI.getAll()
      expect(result).toEqual([])
    })

    it('transforms snake_case to camelCase', async () => {
      const raw = [{
        id: 10,
        title: 'Movie',
        view_count: 5,
        like_count: 2,
        rating_average: '4.5',
        pitchey_score_avg: '3.2',
        viewer_score_avg: '4.0',
        rating_count: '10',
        nda_count: 1,
        creator_name: 'Jane',
        short_synopsis: 'Short',
      }]
      mockGet.mockResolvedValueOnce({ data: { success: true, data: raw } })
      const result = await pitchAPI.getAll()
      expect(result[0].viewCount).toBe(5)
      expect(result[0].likeCount).toBe(2)
      expect(result[0].creatorName).toBe('Jane')
      expect(result[0].shortSynopsis).toBe('Short')
    })
  })

  describe('pitchAPI.browse', () => {
    it('returns structured result with items', async () => {
      const items = [{ id: 1 }, { id: 2 }]
      mockGet.mockResolvedValueOnce({ data: { data: { items, total: 2, page: 1, hasMore: false } } })
      const result = await pitchAPI.browse('trending')
      expect(result.items).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.tab).toBe('trending')
    })

    it('returns empty result on error', async () => {
      mockGet.mockRejectedValueOnce(new Error('fail'))
      const result = await pitchAPI.browse('new')
      expect(result.items).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('pitchAPI.getById', () => {
    it('extracts pitch from nested data.data.pitch', async () => {
      const pitch = { id: 5, title: 'Deep' }
      mockGet.mockResolvedValueOnce({ data: { success: true, data: { pitch } } })
      const result = await pitchAPI.getById(5)
      expect(result.id).toBe(5)
      expect(result.title).toBe('Deep')
    })
  })

  describe('pitchAPI.getTrending', () => {
    it('returns array when data is direct array', async () => {
      const pitches = [{ id: 1 }]
      mockGet.mockResolvedValueOnce({ data: pitches })
      const result = await pitchAPI.getTrending()
      expect(result).toEqual(pitches)
    })

    it('returns empty array on error', async () => {
      mockGet.mockRejectedValueOnce(new Error('fail'))
      const result = await pitchAPI.getTrending()
      expect(result).toEqual([])
    })
  })

  describe('pitchAPI.requestNDA', () => {
    it('posts to /api/ndas/request with pitchId and reason', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } })
      await pitchAPI.requestNDA(10, 'Need to review', 'basic')
      expect(mockPost).toHaveBeenCalledWith('/api/ndas/request', {
        pitchId: 10,
        reason: 'Need to review',
        requestType: 'basic',
      })
    })
  })

  describe('pitchAPI.save / unsave', () => {
    it('save calls POST /api/pitches/:id/save', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } })
      await pitchAPI.save(7)
      expect(mockPost).toHaveBeenCalledWith('/api/pitches/7/save')
    })

    it('unsave calls DELETE /api/pitches/:id/save', async () => {
      mockDelete.mockResolvedValueOnce({ data: { success: true } })
      await pitchAPI.unsave(7)
      expect(mockDelete).toHaveBeenCalledWith('/api/pitches/7/save')
    })
  })

  describe('pitchAPI.share', () => {
    it('posts to share endpoint with platform and message', async () => {
      mockPost.mockResolvedValueOnce({ data: {} })
      await pitchAPI.share(3, 'twitter', 'Check this out!')
      expect(mockPost).toHaveBeenCalledWith('/api/pitches/3/share', {
        platform: 'twitter',
        message: 'Check this out!',
      })
    })
  })

  // ─── ndaAPI ──────────────────────────────────────────────────────
  describe('ndaAPI', () => {
    it('requestNDA posts to /api/ndas/request', async () => {
      mockPost.mockResolvedValueOnce({ data: { id: 1 } })
      await ndaAPI.requestNDA(5, 'terms')
      expect(mockPost).toHaveBeenCalledWith('/api/ndas/request', {
        pitchId: 5,
        reason: 'terms',
      })
    })

    it('signNDA posts to /api/ndas/:id/sign', async () => {
      mockPost.mockResolvedValueOnce({ data: { id: 1, status: 'signed' } })
      await ndaAPI.signNDA(11)
      expect(mockPost).toHaveBeenCalledWith('/api/ndas/11/sign')
    })

    it('getMyNDAs calls GET /api/ndas/signed', async () => {
      mockGet.mockResolvedValueOnce({ data: [] })
      await ndaAPI.getMyNDAs()
      expect(mockGet).toHaveBeenCalledWith('/api/ndas/signed')
    })

    it('getPendingNDAs calls GET /api/ndas/incoming-requests', async () => {
      mockGet.mockResolvedValueOnce({ data: [] })
      await ndaAPI.getPendingNDAs()
      expect(mockGet).toHaveBeenCalledWith('/api/ndas/incoming-requests')
    })
  })
})
