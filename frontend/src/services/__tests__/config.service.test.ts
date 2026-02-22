import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock api-client before importing
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
import { configService } from '../config.service'

const mockGet = vi.mocked(apiClient.get)

// Reset the service's internal cache before each test
async function resetServiceState(service: any) {
  service.config = null
  service.isLoading = false
  service.loadPromise = null
}

describe('ConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset cache so tests start fresh
    resetServiceState(configService)
  })

  // ─── getConfiguration ─────────────────────────────────────────────
  describe('getConfiguration', () => {
    it('loads config from API /api/config/all', async () => {
      const apiConfig = {
        genres: ['Action', 'Drama'],
        formats: ['Feature Film'],
        budgetRanges: ['Under $1M'],
        stages: ['Development']
      }
      mockGet.mockResolvedValueOnce({ success: true, data: apiConfig })

      const result = await configService.getConfiguration()
      expect(result.genres).toEqual(['Action', 'Drama'])
      expect(mockGet).toHaveBeenCalledWith('/api/config/all')
    })

    it('falls back to individual endpoints when /all fails', async () => {
      // /all endpoint returns empty data
      mockGet.mockResolvedValueOnce({ success: false, data: null })
      // Individual endpoints
      mockGet.mockResolvedValueOnce({ success: true, data: ['Action', 'Comedy'] })
      mockGet.mockResolvedValueOnce({ success: true, data: ['Feature Film'] })
      mockGet.mockResolvedValueOnce({ success: true, data: ['Under $1M'] })
      mockGet.mockResolvedValueOnce({ success: true, data: ['Development'] })

      const result = await configService.getConfiguration()
      expect(result.genres).toEqual(['Action', 'Comedy'])
    })

    it('uses fallback config when all API calls fail', async () => {
      mockGet.mockRejectedValue(new Error('Network error'))

      const result = await configService.getConfiguration()
      expect(result.genres).toBeDefined()
      expect(result.genres.length).toBeGreaterThan(0)
      expect(result.formats).toContain('Feature Film')
    })

    it('returns cached config on second call without new API request', async () => {
      const apiConfig = {
        genres: ['Thriller'],
        formats: ['Short Film'],
        budgetRanges: ['$1M-$5M'],
        stages: ['Production']
      }
      mockGet.mockResolvedValueOnce({ success: true, data: apiConfig })

      await configService.getConfiguration()
      const result2 = await configService.getConfiguration()

      expect(result2.genres).toEqual(['Thriller'])
      expect(mockGet).toHaveBeenCalledTimes(1) // Only one API call
    })
  })

  // ─── getGenres ────────────────────────────────────────────────────
  describe('getGenres', () => {
    it('returns genres array', async () => {
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { genres: ['Action'], formats: ['Feature Film'], budgetRanges: ['Under $1M'], stages: ['Development'] }
      })

      const genres = await configService.getGenres()
      expect(Array.isArray(genres)).toBe(true)
      expect(genres.length).toBeGreaterThan(0)
    })
  })

  // ─── getFormats ───────────────────────────────────────────────────
  describe('getFormats', () => {
    it('returns formats array', async () => {
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { genres: ['Action'], formats: ['Feature Film', 'Short Film'], budgetRanges: [], stages: [] }
      })

      const formats = await configService.getFormats()
      expect(Array.isArray(formats)).toBe(true)
    })
  })

  // ─── getBudgetRanges ──────────────────────────────────────────────
  describe('getBudgetRanges', () => {
    it('returns budget ranges', async () => {
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { genres: [], formats: [], budgetRanges: ['Under $1M', '$1M-$5M'], stages: [] }
      })

      const ranges = await configService.getBudgetRanges()
      expect(Array.isArray(ranges)).toBe(true)
    })
  })

  // ─── getStages ────────────────────────────────────────────────────
  describe('getStages', () => {
    it('returns stages array', async () => {
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { genres: [], formats: [], budgetRanges: [], stages: ['Development', 'Production'] }
      })

      const stages = await configService.getStages()
      expect(stages).toContain('Development')
    })
  })

  // ─── refreshConfiguration ─────────────────────────────────────────
  describe('refreshConfiguration', () => {
    it('clears cache and reloads from API', async () => {
      // First load
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { genres: ['Action'], formats: [], budgetRanges: [], stages: [] }
      })
      await configService.getConfiguration()

      // Refresh with new data
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { genres: ['Drama', 'Comedy'], formats: ['TV Series'], budgetRanges: [], stages: [] }
      })
      const refreshed = await configService.refreshConfiguration()

      expect(refreshed.genres).toEqual(['Drama', 'Comedy'])
      expect(mockGet).toHaveBeenCalledTimes(2)
    })
  })

  // ─── isConfigLoaded ───────────────────────────────────────────────
  describe('isConfigLoaded', () => {
    it('returns false when config is cleared (reset applied in beforeEach)', () => {
      // beforeEach calls resetServiceState which sets config to null
      expect(configService.isConfigLoaded()).toBe(false)
    })

    it('returns true after config is loaded', async () => {
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { genres: ['Action'], formats: [], budgetRanges: [], stages: [] }
      })
      await configService.getConfiguration()
      expect(configService.isConfigLoaded()).toBe(true)
    })
  })

  // ─── getSyncConfig ────────────────────────────────────────────────
  describe('getSyncConfig', () => {
    it('returns current config synchronously', () => {
      const config = configService.getSyncConfig()
      expect(config).toBeDefined()
      expect(config.genres).toBeDefined()
      expect(config.formats).toBeDefined()
    })

    it('returns fallback when no config loaded', () => {
      resetServiceState(configService)
      const config = configService.getSyncConfig()
      expect(config.genres.length).toBeGreaterThan(0)
      expect(config.formats).toContain('Feature Film')
    })
  })

  // ─── fallback config content ──────────────────────────────────────
  describe('fallback config content', () => {
    it('fallback genres includes common film genres', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'))
      const config = await configService.getConfiguration()
      expect(config.genres).toContain('Action')
      // The fallback uses compound genre names like 'Crime Drama'
      expect(config.genres.some(g => g.includes('Drama'))).toBe(true)
      expect(config.genres).toContain('Comedy')
    })

    it('fallback formats includes standard formats', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'))
      const config = await configService.getConfiguration()
      expect(config.formats).toContain('Feature Film')
      expect(config.formats).toContain('Short Film')
    })

    it('fallback budgetRanges includes standard ranges', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'))
      const config = await configService.getConfiguration()
      expect(config.budgetRanges).toContain('Under $1M')
      expect(config.budgetRanges.length).toBeGreaterThan(0)
    })

    it('fallback stages includes production stages', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'))
      const config = await configService.getConfiguration()
      expect(config.stages).toContain('Development')
      expect(config.stages).toContain('Production')
    })
  })

  // ─── configService singleton ──────────────────────────────────────
  describe('configService singleton', () => {
    it('is defined and has expected methods', () => {
      expect(configService).toBeDefined()
      expect(typeof configService.getConfiguration).toBe('function')
      expect(typeof configService.getGenres).toBe('function')
      expect(typeof configService.getFormats).toBe('function')
      expect(typeof configService.getBudgetRanges).toBe('function')
      expect(typeof configService.getStages).toBe('function')
      expect(typeof configService.refreshConfiguration).toBe('function')
    })
  })
})
