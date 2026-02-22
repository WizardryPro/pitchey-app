import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock api-client BEFORE importing the service
vi.mock('../../lib/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import apiClientDefault from '../../lib/api-client'
import { InvestmentService } from '../investment.service'

// The service uses `import apiClient from '../lib/api-client'` (default export)
const mockApiClient = apiClientDefault as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

describe('InvestmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getInvestorPortfolio', () => {
    it('returns portfolio metrics on success', async () => {
      const summary = {
        total_invested: 50000,
        portfolio_value: 65000,
        total_returns: 15000,
        average_roi: 30,
        active_investments: 3,
        completed_investments: 2,
      }
      mockApiClient.get.mockResolvedValue({ success: true, data: { summary } })

      const result = await InvestmentService.getInvestorPortfolio()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/investor/portfolio/summary')
      expect(result.success).toBe(true)
      expect(result.data?.totalInvested).toBe(50000)
      expect(result.data?.currentValue).toBe(65000)
      expect(result.data?.roi).toBe(30)
    })

    it('handles camelCase response', async () => {
      const raw = { totalInvested: 10000, currentValue: 12000, totalReturn: 2000, returnPercentage: 20, activeInvestments: 1, completedInvestments: 0, roi: 20 }
      mockApiClient.get.mockResolvedValue({ success: true, data: raw })

      const result = await InvestmentService.getInvestorPortfolio()
      expect(result.success).toBe(true)
      expect(result.data?.totalInvested).toBe(10000)
    })

    it('returns failure on API error', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, data: null, error: { message: 'Unauthorized' } })

      const result = await InvestmentService.getInvestorPortfolio()
      expect(result.success).toBe(false)
    })

    it('returns failure on thrown error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'))
      const result = await InvestmentService.getInvestorPortfolio()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to fetch portfolio data')
    })
  })

  describe('getInvestmentHistory', () => {
    it('returns transformed investment history', async () => {
      const rawInvestments = [
        {
          id: 1,
          investor_id: 10,
          pitch_id: 20,
          amount: '5000',
          status: 'active',
          current_value: '5500',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          pitch_title: 'Epic Drama',
          genre: 'drama',
          creator_name: 'Alice',
          roi_percentage: '10',
        },
      ]
      mockApiClient.get.mockResolvedValue({
        success: true,
        data: { investments: rawInvestments, total: 1, totalPages: 1, currentPage: 1 },
      })

      const result = await InvestmentService.getInvestmentHistory()

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining('/api/investor/investments'))
      expect(result.success).toBe(true)
      expect(result.data?.investments).toHaveLength(1)
      expect(result.data?.investments[0].investorId).toBe(10)
      expect(result.data?.investments[0].pitchTitle).toBe('Epic Drama')
      expect(result.data?.investments[0].returnPercentage).toBe(10)
    })

    it('passes query params correctly', async () => {
      mockApiClient.get.mockResolvedValue({
        success: true,
        data: { investments: [], total: 0, totalPages: 0, currentPage: 1 },
      })

      await InvestmentService.getInvestmentHistory({ page: 2, limit: 10, status: 'active' })

      const url: string = mockApiClient.get.mock.calls[0][0]
      expect(url).toContain('page=2')
      expect(url).toContain('limit=10')
      expect(url).toContain('status=active')
    })

    it('returns failure on network error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network'))
      const result = await InvestmentService.getInvestmentHistory()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to fetch investment history')
    })
  })

  describe('getInvestmentOpportunities', () => {
    it('returns opportunities list', async () => {
      const opportunities = [{ id: 1, title: 'Great Film', genre: 'drama' }]
      mockApiClient.get.mockResolvedValue({ success: true, data: opportunities })

      const result = await InvestmentService.getInvestmentOpportunities({ limit: 5 })

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining('/api/investor/recommendations'))
      expect(result.success).toBe(true)
    })

    it('returns failure on error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network'))
      const result = await InvestmentService.getInvestmentOpportunities()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to fetch investment opportunities')
    })
  })

  describe('getCreatorFunding', () => {
    it('returns funding metrics', async () => {
      const data = { totalRaised: 100000, fundingGoal: 200000, activeInvestors: 5, averageInvestment: 20000, fundingProgress: 50 }
      mockApiClient.get.mockResolvedValue({ success: true, data })

      const result = await InvestmentService.getCreatorFunding()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/creator/funding/overview')
      expect(result.success).toBe(true)
      expect(result.data?.totalRaised).toBe(100000)
    })

    it('returns failure on error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('fail'))
      const result = await InvestmentService.getCreatorFunding()
      expect(result.success).toBe(false)
    })
  })

  describe('getCreatorInvestors', () => {
    it('returns investor data', async () => {
      const data = { investors: [{ id: 1, name: 'Bob', totalInvested: 5000, investments: [], joinedDate: new Date() }], totalInvestors: 1, totalRaised: 5000 }
      mockApiClient.get.mockResolvedValue({ success: true, data })

      const result = await InvestmentService.getCreatorInvestors()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/creator/investors')
      expect(result.success).toBe(true)
    })

    it('returns failure on error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('fail'))
      const result = await InvestmentService.getCreatorInvestors()
      expect(result.success).toBe(false)
    })
  })

  describe('getProductionInvestments', () => {
    it('calls production investments endpoint', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { totalInvestments: 10 } })
      const result = await InvestmentService.getProductionInvestments()
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/production/investments/overview')
      expect(result.success).toBe(true)
    })

    it('returns failure on error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('fail'))
      const result = await InvestmentService.getProductionInvestments()
      expect(result.success).toBe(false)
    })
  })

  describe('createInvestment', () => {
    it('creates an investment', async () => {
      const investment = { id: 1, investorId: 5, pitchId: 10, amount: 1000, status: 'pending' }
      mockApiClient.post.mockResolvedValue({ success: true, data: investment })

      const result = await InvestmentService.createInvestment({ pitchId: 10, amount: 1000 })

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/investments', { pitchId: 10, amount: 1000 })
      expect(result.success).toBe(true)
    })

    it('returns failure on error', async () => {
      mockApiClient.post.mockRejectedValue(new Error('fail'))
      const result = await InvestmentService.createInvestment({ pitchId: 10, amount: 1000 })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create investment')
    })
  })

  describe('updateInvestment', () => {
    it('updates an investment', async () => {
      const investment = { id: 1, status: 'active' }
      mockApiClient.put.mockResolvedValue({ success: true, data: investment })

      const result = await InvestmentService.updateInvestment(1, { status: 'active' })

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/investor/investments/1', { status: 'active' })
      expect(result.success).toBe(true)
    })

    it('returns failure on error', async () => {
      mockApiClient.put.mockRejectedValue(new Error('fail'))
      const result = await InvestmentService.updateInvestment(1, { status: 'active' })
      expect(result.success).toBe(false)
    })
  })

  describe('getInvestmentDetails', () => {
    it('fetches investment details', async () => {
      const data = { id: 1, amount: 5000, pitch: { title: 'Test', genre: 'drama', creator: { name: 'Alice' } }, documents: [], timeline: [], roi: 10 }
      mockApiClient.get.mockResolvedValue({ success: true, data })

      const result = await InvestmentService.getInvestmentDetails(1)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/investor/investments/1')
      expect(result.success).toBe(true)
    })

    it('returns failure on error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('fail'))
      const result = await InvestmentService.getInvestmentDetails(1)
      expect(result.success).toBe(false)
    })
  })

  describe('getPortfolioAnalytics', () => {
    it('returns analytics data', async () => {
      const data = { totalROI: 15, bestPerforming: {}, worstPerforming: {}, diversification: { byGenre: {}, byStage: {} }, monthlyPerformance: [] }
      mockApiClient.get.mockResolvedValue({ success: true, data })

      const result = await InvestmentService.getPortfolioAnalytics()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/investor/portfolio/performance')
      expect(result.success).toBe(true)
    })

    it('returns failure on error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('fail'))
      const result = await InvestmentService.getPortfolioAnalytics()
      expect(result.success).toBe(false)
    })
  })

  describe('getInvestmentPreferences', () => {
    it('fetches preferences', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { investmentCriteria: {}, investmentHistory: {} } })
      const result = await InvestmentService.getInvestmentPreferences()
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/investor/preferences')
      expect(result.success).toBe(true)
    })

    it('returns failure on error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('fail'))
      const result = await InvestmentService.getInvestmentPreferences()
      expect(result.success).toBe(false)
    })
  })
})
