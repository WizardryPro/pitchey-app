import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock api-client BEFORE importing the service
vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    uploadFile: vi.fn(),
  },
}))

// Mock config for API_URL used in public methods
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8001',
  config: { apiUrl: 'http://localhost:8001' },
}))

import { apiClient } from '../../lib/api-client'
import { PitchService } from '../pitch.service'

const mockApiClient = apiClient as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  uploadFile: ReturnType<typeof vi.fn>
}

describe('PitchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('creates a pitch and returns the pitch data', async () => {
      const mockPitch = { id: 1, title: 'My Film', genre: 'drama', format: 'feature', status: 'draft', viewCount: 0, likeCount: 0, ndaCount: 0, createdAt: '', updatedAt: '' }
      mockApiClient.post.mockResolvedValue({
        success: true,
        data: { pitch: mockPitch },
      })

      const result = await PitchService.create({ title: 'My Film', logline: 'test', genre: 'Drama', format: 'Feature Film' })

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/pitches', expect.objectContaining({ title: 'My Film' }))
      expect(result).toEqual(mockPitch)
    })

    it('maps genre names to backend enum values', async () => {
      const mockPitch = { id: 1, title: 'Test', genre: 'thriller', format: 'feature', status: 'draft', viewCount: 0, likeCount: 0, ndaCount: 0, createdAt: '', updatedAt: '' }
      mockApiClient.post.mockResolvedValue({ success: true, data: { pitch: mockPitch } })

      await PitchService.create({ title: 'Test', logline: 'a', genre: 'Thriller', format: 'Feature Film' })

      const callArg = mockApiClient.post.mock.calls[0][1]
      expect(callArg.genre).toBe('thriller')
      expect(callArg.format).toBe('feature')
    })

    it('throws when API returns success=false', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Validation error' } })
      await expect(PitchService.create({ title: 'x', logline: 'x', genre: 'Drama', format: 'Feature Film' }))
        .rejects.toThrow('Validation error')
    })

    it('returns data directly when nested in data field', async () => {
      const pitch = { id: 2, title: 'x', genre: 'drama', format: 'feature', status: 'draft', viewCount: 0, likeCount: 0, ndaCount: 0, createdAt: '', updatedAt: '' }
      mockApiClient.post.mockResolvedValue({ success: true, data: { data: pitch } })
      const result = await PitchService.create({ title: 'x', logline: 'x', genre: 'Drama', format: 'Feature Film' })
      expect(result.id).toBe(2)
    })
  })

  describe('getById', () => {
    it('fetches a pitch by ID from public endpoint', async () => {
      const rawPitch = { id: 5, title: 'Test', view_count: 100, like_count: 10, nda_count: 2, created_at: '2024-01-01', updated_at: '2024-01-02' }
      mockApiClient.get.mockResolvedValue({ success: true, data: rawPitch })

      const result = await PitchService.getById(5)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/pitches/public/5')
      expect(result.viewCount).toBe(100)
      expect(result.likeCount).toBe(10)
    })

    it('throws on API failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Pitch not found' } })
      await expect(PitchService.getById(99)).rejects.toThrow('Pitch not found')
    })
  })

  describe('getByIdAuthenticated', () => {
    it('fetches authenticated pitch and transforms data', async () => {
      const rawPitch = { id: 3, title: 'Auth Pitch', view_count: 50, like_count: 5, nda_count: 1, created_at: '2024-01-01', updated_at: '2024-01-01' }
      mockApiClient.get.mockResolvedValue({ success: true, data: { pitch: rawPitch } })

      const result = await PitchService.getByIdAuthenticated(3)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/pitches/3')
      expect(result.viewCount).toBe(50)
    })

    it('throws on error', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: 'Unauthorized' })
      await expect(PitchService.getByIdAuthenticated(3)).rejects.toThrow()
    })
  })

  describe('getMyPitches', () => {
    it('returns pitches array', async () => {
      const pitches = [{ id: 1, title: 'P1' }, { id: 2, title: 'P2' }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { data: { pitches } } })

      const result = await PitchService.getMyPitches()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/creator/pitches')
      expect(result).toHaveLength(2)
    })

    it('returns empty array when no pitches', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { pitches: [] } })
      const result = await PitchService.getMyPitches()
      expect(result).toEqual([])
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Forbidden' } })
      await expect(PitchService.getMyPitches()).rejects.toThrow('Forbidden')
    })
  })

  describe('update', () => {
    it('updates a pitch', async () => {
      const updated = { id: 1, title: 'Updated', genre: 'drama', format: 'feature', status: 'draft', viewCount: 0, likeCount: 0, ndaCount: 0, createdAt: '', updatedAt: '' }
      mockApiClient.put.mockResolvedValue({ success: true, data: { pitch: updated } })

      const result = await PitchService.update(1, { title: 'Updated' })

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/creator/pitches/1', expect.objectContaining({ title: 'Updated' }))
      expect(result.title).toBe('Updated')
    })

    it('throws on failure', async () => {
      mockApiClient.put.mockResolvedValue({ success: false, error: { message: 'Not found' } })
      await expect(PitchService.update(1, { title: 'X' })).rejects.toThrow('Not found')
    })
  })

  describe('delete', () => {
    it('deletes a pitch successfully', async () => {
      mockApiClient.delete.mockResolvedValue({ success: true, data: {} })
      await expect(PitchService.delete(1)).resolves.toBeUndefined()
      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/creator/pitches/1')
    })

    it('throws when delete fails', async () => {
      mockApiClient.delete.mockResolvedValue({ success: false, error: { message: 'Cannot delete' } })
      await expect(PitchService.delete(1)).rejects.toThrow('Cannot delete')
    })

    it('rethrows foreign key errors with helpful message', async () => {
      mockApiClient.delete.mockRejectedValue(new Error('foreign key constraint violation'))
      await expect(PitchService.delete(1)).rejects.toThrow('Cannot delete pitch: it has active investments')
    })
  })

  describe('publish', () => {
    it('publishes a pitch', async () => {
      const pitch = { id: 1, status: 'published', title: 'P', genre: 'drama', format: 'feature', viewCount: 0, likeCount: 0, ndaCount: 0, createdAt: '', updatedAt: '' }
      mockApiClient.post.mockResolvedValue({ success: true, data: { pitch } })

      const result = await PitchService.publish(1)

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/creator/pitches/1/publish', {})
      expect(result.status).toBe('published')
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Already published' } })
      await expect(PitchService.publish(1)).rejects.toThrow('Already published')
    })
  })

  describe('archive', () => {
    it('archives a pitch', async () => {
      const pitch = { id: 1, status: 'archived', title: 'P', genre: 'drama', format: 'feature', viewCount: 0, likeCount: 0, ndaCount: 0, createdAt: '', updatedAt: '' }
      mockApiClient.post.mockResolvedValue({ success: true, data: { pitch } })

      const result = await PitchService.archive(1)

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/creator/pitches/1/archive', {})
      expect(result.status).toBe('archived')
    })
  })

  describe('getPublicPitches', () => {
    it('returns pitches and total', async () => {
      const pitches = [{ id: 1 }, { id: 2 }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { data: pitches, total: 2 } })

      const result = await PitchService.getPublicPitches({ genre: 'drama', page: 1, limit: 10 })

      expect(result.pitches).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('returns empty on API failure (swallows error)', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      const result = await PitchService.getPublicPitches()
      expect(result).toEqual({ pitches: [], total: 0 })
    })

    it('returns empty on thrown error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network'))
      const result = await PitchService.getPublicPitches()
      expect(result).toEqual({ pitches: [], total: 0 })
    })
  })

  describe('getTrendingPitches', () => {
    it('returns pitches array', async () => {
      const items = [{ id: 1 }, { id: 2 }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { data: items } })

      const result = await PitchService.getTrendingPitches(5)

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining('limit=5'))
      expect(result).toHaveLength(2)
    })

    it('returns empty array on failure', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network'))
      const result = await PitchService.getTrendingPitches()
      expect(result).toEqual([])
    })
  })

  describe('getPopularPitches', () => {
    it('returns pitches from browse endpoint', async () => {
      const items = [{ id: 1 }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { items } })

      const result = await PitchService.getPopularPitches(5)

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining('/api/browse'))
      expect(result).toHaveLength(1)
    })

    it('returns empty array on error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('fail'))
      const result = await PitchService.getPopularPitches()
      expect(result).toEqual([])
    })
  })

  describe('getNewReleases', () => {
    it('returns new releases', async () => {
      const items = [{ id: 3 }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { data: items } })
      const result = await PitchService.getNewReleases(5)
      expect(result).toHaveLength(1)
    })
  })

  describe('getGeneralBrowse', () => {
    it('returns browse results with pagination', async () => {
      const items = [{ id: 1 }, { id: 2 }]
      mockApiClient.get.mockResolvedValue({
        success: true,
        data: { items, total: 2, page: 1 },
      })

      const result = await PitchService.getGeneralBrowse({ genre: 'drama', limit: 10 })

      expect(result.pitches).toHaveLength(2)
      expect(result.totalCount).toBe(2)
      expect(result.pagination.limit).toBe(10)
    })

    it('returns default result on failure', async () => {
      mockApiClient.get.mockRejectedValue(new Error('fail'))
      const result = await PitchService.getGeneralBrowse()
      expect(result.pitches).toEqual([])
      expect(result.totalCount).toBe(0)
    })
  })

  describe('trackView', () => {
    it('posts to track view endpoint', async () => {
      mockApiClient.post.mockResolvedValue({ success: true })
      await PitchService.trackView(42)
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/views/track', expect.objectContaining({ pitchId: 42 }))
    })

    it('silently fails on error', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Network'))
      await expect(PitchService.trackView(42)).resolves.toBeUndefined()
    })
  })

  describe('likePitch / unlikePitch', () => {
    it('likes a pitch', async () => {
      mockApiClient.post.mockResolvedValue({ success: true })
      await PitchService.likePitch(7)
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/creator/pitches/7/like', {})
    })

    it('unlikes a pitch', async () => {
      mockApiClient.delete.mockResolvedValue({ success: true })
      await PitchService.unlikePitch(7)
      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/creator/pitches/7/like')
    })

    it('throws on like failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Already liked' } })
      await expect(PitchService.likePitch(7)).rejects.toThrow('Already liked')
    })
  })

  describe('requestNDA / signNDA', () => {
    it('requests NDA for a pitch', async () => {
      mockApiClient.post.mockResolvedValue({ success: true })
      await PitchService.requestNDA(5, { fullName: 'Alice', email: 'a@b.com', purpose: 'review' })
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/ndas/request', expect.objectContaining({ pitchId: 5, fullName: 'Alice' }))
    })

    it('signs an NDA', async () => {
      mockApiClient.post.mockResolvedValue({ success: true })
      await PitchService.signNDA(10, 'signed-data')
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/ndas/10/sign', { signature: 'signed-data' })
    })
  })

  describe('getAnalytics', () => {
    it('returns analytics data', async () => {
      const analytics = { views: 100, likes: 20, ndaRequests: 5, investments: 2 }
      mockApiClient.get.mockResolvedValue({ success: true, data: { analytics } })

      const result = await PitchService.getAnalytics(1)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/creator/pitches/1/analytics')
      expect(result.views).toBe(100)
    })

    it('returns defaults when analytics missing', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      const result = await PitchService.getAnalytics(1)
      expect(result).toEqual({ views: 0, likes: 0, ndaRequests: 0, investments: 0 })
    })
  })

  describe('getPublicPitchesEnhanced', () => {
    it('routes trending tab to correct method', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { pitches: [{ id: 1 }] } }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await PitchService.getPublicPitchesEnhanced({ tab: 'trending', limit: 5 })
      expect(result.pitches).toBeDefined()

      vi.unstubAllGlobals()
    })

    it('routes to search when search term provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { pitches: [], total: 0, page: 1, pageSize: 20 } }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await PitchService.getPublicPitchesEnhanced({ search: 'drama film' })
      expect(result).toBeDefined()
      expect(result.pitches).toEqual([])

      vi.unstubAllGlobals()
    })

    it('falls back to getPublicPitches for general browse', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { data: [], total: 0 } })
      const result = await PitchService.getPublicPitchesEnhanced({ genre: 'drama' })
      expect(result).toEqual({ pitches: [], total: 0 })
    })
  })
})
