import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const mockGetAnalytics = vi.fn()

// ─── Admin service ───────────────────────────────────────────────────────────
vi.mock('@/portals/admin/services/admin.service', () => ({
  adminService: {
    getAnalytics: (...args: any[]) => mockGetAnalytics(...args),
  },
}))

// ─── Dynamic import after mocks ──────────────────────────────────────────────
let AdminAnalytics: React.ComponentType
beforeAll(async () => {
  const mod = await import('../AdminAnalytics')
  AdminAnalytics = mod.default
})

const mockAnalyticsData = {
  userGrowth: {
    newUsers: 142,
    growthRate: 8.5,
    creators: 60,
    investors: 50,
    production: 32,
  },
  contentMetrics: {
    newPitches: 73,
    growthRate: 12.3,
  },
  financialMetrics: {
    revenue: 45000,
    revenueGrowthRate: 5.2,
    totalTransactions: 320,
    avgTransaction: 140.625,
  },
  engagementMetrics: {
    activeUsers: 890,
    activityGrowthRate: 3.1,
  },
  topGenres: [
    { name: 'Drama', count: 28 },
    { name: 'Thriller', count: 21 },
    { name: 'Comedy', count: 15 },
  ],
}

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AdminAnalytics />
    </MemoryRouter>
  )

describe('AdminAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)
  })

  describe('Loading state', () => {
    it('shows loading skeleton initially', () => {
      mockGetAnalytics.mockReturnValue(new Promise(() => {}))
      renderComponent()
      const pulseElements = document.querySelectorAll('.animate-pulse')
      expect(pulseElements.length).toBeGreaterThan(0)
    })

    it('renders the Platform Analytics title while loading', () => {
      mockGetAnalytics.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(screen.getByText('Platform Analytics')).toBeInTheDocument()
    })
  })

  describe('Error state', () => {
    it('shows error message when API call fails', async () => {
      mockGetAnalytics.mockRejectedValue(new Error('Network failure'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/failed to load analytics/i)).toBeInTheDocument()
      })
      expect(screen.getByText(/network failure/i)).toBeInTheDocument()
    })

    it('keeps the Platform Analytics heading visible on error', async () => {
      mockGetAnalytics.mockRejectedValue(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/failed to load analytics/i)).toBeInTheDocument()
      })
      expect(screen.getByText('Platform Analytics')).toBeInTheDocument()
    })
  })

  describe('Timeframe selector', () => {
    it('renders all four timeframe buttons', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('142')).toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: '24h' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument()
    })

    it('defaults to 30d timeframe highlighted', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('142')).toBeInTheDocument()
      })
      const btn30d = screen.getByRole('button', { name: '30d' })
      expect(btn30d.className).toContain('bg-white')
    })

    it('re-fetches analytics when timeframe is changed', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('142')).toBeInTheDocument()
      })
      await user.click(screen.getByRole('button', { name: '7d' }))
      await waitFor(() => {
        expect(mockGetAnalytics).toHaveBeenCalledWith('7d')
      })
    })

    it('calls getAnalytics with default timeframe 30d on mount', async () => {
      renderComponent()
      await waitFor(() => {
        expect(mockGetAnalytics).toHaveBeenCalledWith('30d')
      })
    })
  })

  describe('KPI cards', () => {
    it('renders New Users card with correct value', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('New Users')).toBeInTheDocument()
      })
      expect(screen.getByText('142')).toBeInTheDocument()
    })

    it('renders New Pitches card with correct value', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('New Pitches')).toBeInTheDocument()
      })
      expect(screen.getByText('73')).toBeInTheDocument()
    })

    it('renders Revenue card with correct formatted value', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Revenue')).toBeInTheDocument()
      })
      // Revenue value appears in both the KPI card and the Financial Summary section
      expect(screen.getAllByText('$45,000').length).toBeGreaterThanOrEqual(1)
    })

    it('renders Active Users card with correct value', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Active Users')).toBeInTheDocument()
      })
      expect(screen.getByText('890')).toBeInTheDocument()
    })

    it('shows growth rate percentages on KPI cards', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('New Users')).toBeInTheDocument()
      })
      expect(screen.getByText('8.5%')).toBeInTheDocument()
      expect(screen.getByText('12.3%')).toBeInTheDocument()
    })
  })

  describe('User breakdown', () => {
    it('renders User Breakdown section heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('User Breakdown')).toBeInTheDocument()
      })
    })

    it('displays Creators, Investors, and Production labels', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('User Breakdown')).toBeInTheDocument()
      })
      expect(screen.getByText('Creators')).toBeInTheDocument()
      expect(screen.getByText('Investors')).toBeInTheDocument()
      expect(screen.getByText('Production')).toBeInTheDocument()
    })

    it('displays correct user counts per type', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('User Breakdown')).toBeInTheDocument()
      })
      expect(screen.getByText('60')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
      expect(screen.getByText('32')).toBeInTheDocument()
    })
  })

  describe('Top genres', () => {
    it('renders Top Genres section heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Top Genres')).toBeInTheDocument()
      })
    })

    it('displays genre names from the data', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Drama')).toBeInTheDocument()
      })
      expect(screen.getByText('Thriller')).toBeInTheDocument()
      expect(screen.getByText('Comedy')).toBeInTheDocument()
    })

    it('displays pitch counts for genres', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Drama')).toBeInTheDocument()
      })
      expect(screen.getByText('28 pitches')).toBeInTheDocument()
      expect(screen.getByText('21 pitches')).toBeInTheDocument()
    })

    it('shows empty message when no genre data available', async () => {
      mockGetAnalytics.mockResolvedValue({ ...mockAnalyticsData, topGenres: [] })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No genre data available.')).toBeInTheDocument()
      })
    })
  })

  describe('Financial summary', () => {
    it('renders Financial Summary section heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Financial Summary')).toBeInTheDocument()
      })
    })

    it('displays Total Revenue label and value', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Financial Summary')).toBeInTheDocument()
      })
      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
      // Revenue appears in both the KPI card and the financial summary
      expect(screen.getAllByText('$45,000').length).toBeGreaterThan(0)
    })

    it('displays Total Transactions label and value', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Financial Summary')).toBeInTheDocument()
      })
      expect(screen.getByText('Total Transactions')).toBeInTheDocument()
      expect(screen.getByText('320')).toBeInTheDocument()
    })

    it('displays Avg Transaction label and value', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Financial Summary')).toBeInTheDocument()
      })
      expect(screen.getByText('Avg Transaction')).toBeInTheDocument()
      expect(screen.getByText('$140.63')).toBeInTheDocument()
    })
  })
})
