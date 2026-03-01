import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockNavigate = vi.fn()
const mockGetAnalytics = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => ({
    user: { id: 1, name: 'Test Investor', email: 'investor@test.com' },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}))

vi.mock('../../services/investor.service', () => ({
  InvestorService: {
    getAnalytics: mockGetAnalytics,
  },
}))

vi.mock('../../components/InvestorNavigation', () => ({
  InvestorNavigation: () => <nav data-testid="investor-nav">Nav</nav>,
}))

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => {
  const React = require('react')
  return {
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
    BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => <div />,
    LineChart: ({ children }: any) => <div>{children}</div>,
    Line: () => <div />,
    PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
    Pie: () => <div />,
    Cell: () => <div />,
    RadarChart: ({ children }: any) => <div data-testid="radar-chart">{children}</div>,
    PolarGrid: () => <div />,
    PolarAngleAxis: () => <div />,
    PolarRadiusAxis: () => <div />,
    Radar: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
    Legend: () => <div />,
  }
})

vi.mock('@shared/components/ui/chart', () => ({
  ChartContainer: ({ children }: any) => <div>{children}</div>,
  ChartTooltip: () => <div />,
  ChartTooltipContent: () => <div />,
  ChartLegend: () => <div />,
  ChartLegendContent: () => <div />,
}))

const mockAnalyticsResponse = (overrides: Record<string, any> = {}) => ({
  performance: [
    { date: '2026-01', value: 100000, invested: 80000, returns: 95000 },
    { date: '2026-02', value: 120000, invested: 90000, returns: 110000 },
  ],
  topPerformers: [
    {
      id: 1,
      pitchTitle: 'Sci-Fi Epic',
      genre: 'Sci-Fi',
      amount: 50000,
      currentValue: 75000,
      status: 'active',
      createdAt: '2026-01-01',
    },
    {
      id: 2,
      pitchTitle: 'Drama Feature',
      genre: 'Drama',
      amount: 30000,
      currentValue: 42000,
      status: 'active',
      createdAt: '2026-01-15',
    },
  ],
  riskAnalysis: {
    lowRisk: 45,
    mediumRisk: 35,
    highRisk: 20,
  },
  genrePerformance: [
    { genre: 'Sci-Fi', investments: 5, totalValue: 250000, avgROI: 28 },
    { genre: 'Drama', investments: 3, totalValue: 150000, avgROI: 18 },
    { genre: 'Comedy', investments: 2, totalValue: 80000, avgROI: 12 },
  ],
  ...overrides,
})

let InvestorAnalytics: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/InvestorAnalytics')
  InvestorAnalytics = mod.default
})

function renderPage() {
  return render(
    <MemoryRouter>
      <InvestorAnalytics />
    </MemoryRouter>
  )
}

describe('InvestorAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAnalytics.mockResolvedValue(mockAnalyticsResponse())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --- Loading State ---

  describe('Loading State', () => {
    it('shows loading spinner initially', () => {
      mockGetAnalytics.mockReturnValue(new Promise(() => {}))
      renderPage()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })

    it('hides loading spinner after data loads', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Investment Analytics')).toBeInTheDocument()
      })
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeFalsy()
    })
  })

  // --- Success State ---

  describe('Success State', () => {
    it('renders the Investment Analytics heading', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Investment Analytics')).toBeInTheDocument()
      })
    })

    it('displays metric cards from API data', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Portfolio Growth Rate')).toBeInTheDocument()
        expect(screen.getByText('Investment Velocity')).toBeInTheDocument()
        expect(screen.getByText('Market Opportunities')).toBeInTheDocument()
        expect(screen.getByText('Risk-Adjusted Return')).toBeInTheDocument()
      })
    })

    it('renders sector analysis table with genre data', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Sector Analysis & Recommendations')).toBeInTheDocument()
        // Genre names appear in multiple places (sector table, creator insights, filter dropdown)
        // so use getAllByText to confirm they are present
        expect(screen.getAllByText('Sci-Fi').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Drama').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Comedy').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('renders creator insights table with top performers', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Top Creator Investment Insights')).toBeInTheDocument()
        expect(screen.getByText('Sci-Fi Epic')).toBeInTheDocument()
        expect(screen.getByText('Drama Feature')).toBeInTheDocument()
      })
    })

    it('calls InvestorService.getAnalytics on mount with default period', async () => {
      renderPage()
      await waitFor(() => {
        expect(mockGetAnalytics).toHaveBeenCalledTimes(1)
        expect(mockGetAnalytics).toHaveBeenCalledWith('quarter')
      })
    })
  })

  // --- Error State ---

  describe('Error State', () => {
    it('shows error message when API fails', async () => {
      mockGetAnalytics.mockRejectedValue(new Error('Network error'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics')).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      mockGetAnalytics.mockRejectedValue(new Error('Server error'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument()
      })
    })

    it('retries fetch when retry button is clicked', async () => {
      mockGetAnalytics.mockRejectedValueOnce(new Error('err'))
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics')).toBeInTheDocument()
      })

      // Make it succeed on retry
      mockGetAnalytics.mockResolvedValue(mockAnalyticsResponse())

      const user = userEvent.setup()
      await user.click(screen.getByText('Try Again'))

      await waitFor(() => {
        expect(mockGetAnalytics).toHaveBeenCalledTimes(2)
      })
    })
  })

  // --- Filters ---

  describe('Time Range and Filters', () => {
    it('renders time range dropdown', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByDisplayValue('Last 3 Months')).toBeInTheDocument()
      })
    })

    it('renders filter type dropdown', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByDisplayValue('All Sectors')).toBeInTheDocument()
      })
    })

    it('re-fetches analytics when time range changes', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Investment Analytics')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      const timeSelect = screen.getByDisplayValue('Last 3 Months')
      await user.selectOptions(timeSelect, '1y')

      await waitFor(() => {
        // Initial call + re-fetch after time range change
        expect(mockGetAnalytics).toHaveBeenCalledWith('year')
      })
    })
  })
})
