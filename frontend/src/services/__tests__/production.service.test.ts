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
import { ProductionService } from '../production.service'

const mockApiClient = apiClient as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const defaultStats = {
  totalProjects: 0,
  activeProjects: 0,
  completedProjects: 0,
  inDevelopment: 0,
  totalBudget: 0,
  pitchesReviewed: 0,
  pitchesContracted: 0,
  ndaSigned: 0,
}

describe('ProductionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDashboard', () => {
    it('returns dashboard data on success', async () => {
      const stats = { ...defaultStats, totalProjects: 5, activeProjects: 2 }
      const dashboardData = {
        stats,
        activeProjects: [{ id: 1, title: 'Epic Drama' }],
        recentDeals: [],
        upcomingEvents: [],
        recommendedPitches: [],
      }
      mockApiClient.get.mockResolvedValue({ success: true, data: { dashboard: dashboardData } })

      const result = await ProductionService.getDashboard()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/production/dashboard')
      expect(result.stats.totalProjects).toBe(5)
      expect(result.activeProjects).toHaveLength(1)
    })

    it('returns default data when dashboard missing', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      const result = await ProductionService.getDashboard()
      expect(result.stats).toEqual(defaultStats)
      expect(result.activeProjects).toEqual([])
    })

    it('throws on API failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Unauthorized' } })
      await expect(ProductionService.getDashboard()).rejects.toThrow('Unauthorized')
    })
  })

  describe('getProjects', () => {
    it('returns projects list', async () => {
      const projects = [{ id: 1, pitchId: 5, title: 'Drama Project', status: 'production' as const, budget: 100000, spentBudget: 50000, startDate: '2024-01-01', team: [], milestones: [] }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { projects, total: 1 } })

      const result = await ProductionService.getProjects({ status: 'production' })

      const url: string = mockApiClient.get.mock.calls[0][0]
      expect(url).toContain('/api/production/projects')
      expect(url).toContain('status=production')
      expect(result.projects).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('returns empty list when no projects', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { projects: [], total: 0 } })
      const result = await ProductionService.getProjects()
      expect(result.projects).toEqual([])
      expect(result.total).toBe(0)
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(ProductionService.getProjects()).rejects.toThrow()
    })
  })

  describe('createProject', () => {
    it('creates a project from pitch', async () => {
      const project = { id: 1, pitchId: 5, title: 'New Project', status: 'development' as const, budget: 200000, spentBudget: 0, startDate: '2024-01-01', team: [], milestones: [] }
      mockApiClient.post.mockResolvedValue({ success: true, data: { project } })

      const result = await ProductionService.createProject({ pitchId: 5, budget: 200000, startDate: '2024-01-01' })

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/production/projects', expect.objectContaining({ pitchId: 5, budget: 200000 }))
      expect(result.id).toBe(1)
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Pitch not found' } })
      await expect(ProductionService.createProject({ pitchId: 99, budget: 100, startDate: '2024-01-01' })).rejects.toThrow('Pitch not found')
    })

    it('throws when project missing from response', async () => {
      mockApiClient.post.mockResolvedValue({ success: true, data: {} })
      await expect(ProductionService.createProject({ pitchId: 5, budget: 100, startDate: '2024-01-01' })).rejects.toThrow('Failed to create project')
    })
  })

  describe('updateProject', () => {
    it('updates a project', async () => {
      const project = { id: 1, pitchId: 5, title: 'Updated Project', status: 'post-production' as const, budget: 200000, spentBudget: 150000, startDate: '2024-01-01', team: [], milestones: [] }
      mockApiClient.put.mockResolvedValue({ success: true, data: { project } })

      const result = await ProductionService.updateProject(1, { title: 'Updated Project' })

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/production/projects/1', expect.any(Object))
      expect(result.title).toBe('Updated Project')
    })

    it('throws on failure', async () => {
      mockApiClient.put.mockResolvedValue({ success: false, error: { message: 'Not found' } })
      await expect(ProductionService.updateProject(99, {})).rejects.toThrow('Not found')
    })
  })

  describe('getDeals', () => {
    it('returns deals list', async () => {
      const deals = [{ id: 1, pitchId: 5, creatorId: 2, status: 'signed' as const, dealType: 'option' as const, amount: 50000, terms: 'standard' }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { deals, total: 1 } })

      const result = await ProductionService.getDeals({ status: 'signed' })

      const url: string = mockApiClient.get.mock.calls[0][0]
      expect(url).toContain('/api/production/deals')
      expect(url).toContain('status=signed')
      expect(result.deals).toHaveLength(1)
    })

    it('returns empty when no deals', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { deals: [], total: 0 } })
      const result = await ProductionService.getDeals()
      expect(result.deals).toEqual([])
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(ProductionService.getDeals()).rejects.toThrow()
    })
  })

  describe('proposeDeal', () => {
    it('proposes a new deal', async () => {
      const deal = { id: 1, pitchId: 5, creatorId: 2, status: 'negotiating' as const, dealType: 'option' as const, amount: 25000, terms: 'option agreement' }
      mockApiClient.post.mockResolvedValue({ success: true, data: { deal } })

      const result = await ProductionService.proposeDeal({ pitchId: 5, dealType: 'option', amount: 25000, terms: 'option agreement' })

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/production/deals', expect.objectContaining({ pitchId: 5 }))
      expect(result.id).toBe(1)
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(ProductionService.proposeDeal({ pitchId: 5, dealType: 'option', amount: 100, terms: 'x' })).rejects.toThrow()
    })
  })

  describe('searchTalent', () => {
    it('searches talent with filters', async () => {
      const talent = [{ id: 1, userId: 10, name: 'Alice Director', role: 'director' as const, experience: '10 years', availability: 'available' as const }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { talent, total: 1 } })

      const result = await ProductionService.searchTalent({ role: 'director', availability: 'available' })

      const url: string = mockApiClient.get.mock.calls[0][0]
      expect(url).toContain('/api/production/talent/search')
      expect(url).toContain('role=director')
      expect(result.talent).toHaveLength(1)
    })

    it('returns empty on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(ProductionService.searchTalent()).rejects.toThrow()
    })
  })

  describe('getCalendarEvents', () => {
    it('returns calendar events', async () => {
      const events = [{ id: 1, title: 'Pre-production meeting', type: 'meeting' as const, startDate: '2024-01-10', attendees: [] }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { events } })

      const result = await ProductionService.getCalendarEvents({ type: 'meeting' })

      const url: string = mockApiClient.get.mock.calls[0][0]
      expect(url).toContain('/api/production/calendar')
      expect(url).toContain('type=meeting')
      expect(result).toHaveLength(1)
    })

    it('returns empty array when no events', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      const result = await ProductionService.getCalendarEvents()
      expect(result).toEqual([])
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(ProductionService.getCalendarEvents()).rejects.toThrow()
    })
  })

  describe('createCalendarEvent', () => {
    it('creates a calendar event', async () => {
      const event = { id: 1, title: 'Shoot Day', type: 'shoot' as const, startDate: '2024-02-01', attendees: [] }
      mockApiClient.post.mockResolvedValue({ success: true, data: { event } })

      const result = await ProductionService.createCalendarEvent({ title: 'Shoot Day', type: 'shoot', startDate: '2024-02-01', attendees: [] })

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/production/calendar', expect.objectContaining({ title: 'Shoot Day' }))
      expect(result.id).toBe(1)
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(ProductionService.createCalendarEvent({ title: 'x', type: 'meeting', startDate: '2024-01-01', attendees: [] })).rejects.toThrow()
    })
  })

  describe('getBudgetBreakdown', () => {
    it('returns budget breakdown for project', async () => {
      const budget = { total: 200000, spent: 80000, remaining: 120000, categories: [], timeline: [] }
      mockApiClient.get.mockResolvedValue({ success: true, data: { budget } })

      const result = await ProductionService.getBudgetBreakdown(1)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/production/budget/1')
      expect(result.total).toBe(200000)
      expect(result.spent).toBe(80000)
    })

    it('returns default budget when missing', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      const result = await ProductionService.getBudgetBreakdown(1)
      expect(result.total).toBe(0)
      expect(result.categories).toEqual([])
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(ProductionService.getBudgetBreakdown(1)).rejects.toThrow()
    })
  })

  describe('updateMilestone', () => {
    it('updates a milestone', async () => {
      mockApiClient.put.mockResolvedValue({ success: true, data: {} })
      await expect(ProductionService.updateMilestone(1, 5, { completed: true })).resolves.toBeUndefined()

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/production/projects/1/milestones/5', { completed: true })
    })

    it('throws on failure', async () => {
      mockApiClient.put.mockResolvedValue({ success: false, error: { message: 'Not found' } })
      await expect(ProductionService.updateMilestone(1, 99, { completed: true })).rejects.toThrow('Not found')
    })
  })

  describe('getAnalytics', () => {
    it('returns analytics data', async () => {
      const analyticsData = {
        projectPerformance: [{ project: 'Drama', budget: 100000, spent: 80000, progress: 80, onSchedule: true }],
        genreDistribution: [],
        dealConversionRate: 0.3,
        avgProductionTime: 12,
        successRate: 0.85,
      }
      mockApiClient.get.mockResolvedValue({ success: true, data: { analytics: analyticsData } })

      const result = await ProductionService.getAnalytics('quarter')

      const url: string = mockApiClient.get.mock.calls[0][0]
      expect(url).toContain('/api/production/analytics')
      expect(url).toContain('period=quarter')
      expect(result.dealConversionRate).toBe(0.3)
    })

    it('returns default analytics when missing', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      const result = await ProductionService.getAnalytics()
      expect(result.projectPerformance).toEqual([])
      expect(result.dealConversionRate).toBe(0)
    })
  })

  describe('getDistributionChannels', () => {
    it('returns distribution channels', async () => {
      const channels = [{ id: 1, platform: 'Netflix', status: 'live' as const, terms: 'standard', revenue: 50000 }]
      mockApiClient.get.mockResolvedValue({ success: true, data: { channels } })

      const result = await ProductionService.getDistributionChannels(1)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/production/projects/1/distribution')
      expect(result).toHaveLength(1)
    })

    it('returns empty array on missing data', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      const result = await ProductionService.getDistributionChannels(1)
      expect(result).toEqual([])
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(ProductionService.getDistributionChannels(1)).rejects.toThrow()
    })
  })

  describe('getRevenue', () => {
    it('returns revenue data', async () => {
      const revenueData = { total: 500000, breakdown: [] }
      mockApiClient.get.mockResolvedValue({ success: true, data: revenueData })

      const result = await ProductionService.getRevenue()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/production/revenue')
      expect(result).toEqual(revenueData)
    })

    it('returns empty object when data missing', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: null })
      const result = await ProductionService.getRevenue()
      expect(result).toEqual({})
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(ProductionService.getRevenue()).rejects.toThrow()
    })
  })

  describe('generateContract', () => {
    it('generates contract as blob', async () => {
      const blob = new Blob(['PDF'], { type: 'application/pdf' })
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) })
      vi.stubGlobal('fetch', mockFetch)

      const result = await ProductionService.generateContract(1, 'standard')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/production/deals/1/contract'),
        expect.objectContaining({ credentials: 'include' })
      )
      expect(result).toBeInstanceOf(Blob)

      vi.unstubAllGlobals()
    })

    it('throws on failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
      vi.stubGlobal('fetch', mockFetch)

      await expect(ProductionService.generateContract(99)).rejects.toThrow('Failed to generate contract')

      vi.unstubAllGlobals()
    })
  })

  describe('exportProjectData', () => {
    it('exports project data as blob', async () => {
      const blob = new Blob(['data'], { type: 'application/pdf' })
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) })
      vi.stubGlobal('fetch', mockFetch)

      const result = await ProductionService.exportProjectData(1, 'pdf')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/production/projects/1/export'),
        expect.objectContaining({ credentials: 'include' })
      )
      expect(result).toBeInstanceOf(Blob)

      vi.unstubAllGlobals()
    })

    it('throws on failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
      vi.stubGlobal('fetch', mockFetch)

      await expect(ProductionService.exportProjectData(1, 'excel')).rejects.toThrow('Failed to export project data')

      vi.unstubAllGlobals()
    })
  })
})
