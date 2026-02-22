import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mock functions
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockCheckSession = vi.fn()
const mockGetDashboard = vi.fn()
const mockGetAnalytics = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// Auth store - STABLE reference
const mockUser = { id: 1, name: 'Production User', email: 'production@test.com', user_type: 'production' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: mockCheckSession,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

vi.mock('../../services/production.service', () => ({
  ProductionService: {
    getDashboard: (...args: any[]) => mockGetDashboard(...args),
    getAnalytics: (...args: any[]) => mockGetAnalytics(...args),
  },
}))

vi.mock('../../components/charts/RevenueChart', () => ({
  RevenueChart: () => <div data-testid="revenue-chart">Revenue Chart</div>,
}))

vi.mock('../../components/charts/ProjectStatusChart', () => ({
  ProjectStatusChart: () => <div data-testid="project-status-chart">Project Status Chart</div>,
}))

const mockDashboardData = {
  stats: {
    totalProjects: 12,
    activeProjects: 5,
    totalBudget: 8000000,
    pitchesReviewed: 45,
    pitchesContracted: 8,
    ndaSigned: 15,
  },
}

const mockAnalyticsData = {
  dealConversionRate: 18,
  avgProductionTime: '6 months',
  successRate: 85,
  overallScore: 8,
  performanceLevel: 'Excellent',
  topPerformer: 'Midnight Sun',
  improvementArea: 'Marketing',
}

let Component: React.ComponentType

beforeAll(async () => {
  const mod = await import('../production/ProductionStats')
  Component = mod.default
})

describe('ProductionStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading state initially', () => {
    mockGetDashboard.mockReturnValue(new Promise(() => {}))
    mockGetAnalytics.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    expect(screen.getByText('Loading statistics...')).toBeInTheDocument()
  })

  // ─── Layout ───────────────────────────────────────────────────────

  it('renders page title and description after loading', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Overview')).toBeInTheDocument()
    })
    expect(screen.getByText(/Quick insights and key performance indicators/)).toBeInTheDocument()
  })

  // ─── Quick Stats ─────────────────────────────────────────────────

  it('renders quick stats cards from dashboard data', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total Projects')).toBeInTheDocument()
    })
    expect(screen.getByText('Active Projects')).toBeInTheDocument()
    expect(screen.getByText('Total Budget')).toBeInTheDocument()
    expect(screen.getByText('Pitches Reviewed')).toBeInTheDocument()
    expect(screen.getByText('Deals Signed')).toBeInTheDocument()
    expect(screen.getByText('NDAs Signed')).toBeInTheDocument()
  })

  it('renders stat values correctly', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument()
    })
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('$8.0M')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  // ─── KPI Summary ─────────────────────────────────────────────────

  it('renders KPI summary section labels when analytics data is present', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Overall Score')).toBeInTheDocument()
    })
    expect(screen.getByText('Performance Level')).toBeInTheDocument()
    expect(screen.getByText('Top Performer')).toBeInTheDocument()
    expect(screen.getByText('Focus Area')).toBeInTheDocument()
  })

  // ─── Charts ──────────────────────────────────────────────────────

  it('renders revenue and project status charts', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('revenue-chart')).toBeInTheDocument()
    })
    expect(screen.getByTestId('project-status-chart')).toBeInTheDocument()
  })

  // ─── Recent Trends ───────────────────────────────────────────────

  it('renders recent trends section', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Recent Trends')).toBeInTheDocument()
    })
    expect(screen.getByText('Revenue Growth')).toBeInTheDocument()
    expect(screen.getByText('Team Expansion')).toBeInTheDocument()
    expect(screen.getByText('Completion Rate')).toBeInTheDocument()
  })

  // ─── Empty / Error State ───────────────────────────────────────────

  it('renders without KPI section when analytics is null', async () => {
    mockGetDashboard.mockResolvedValue(null)
    mockGetAnalytics.mockResolvedValue(null)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Overview')).toBeInTheDocument()
    })
    // KPI section should not render when analyticsData is null
    expect(screen.queryByText('Overall Score')).not.toBeInTheDocument()
  })

  it('renders without quick stats when dashboard returns no stats', async () => {
    mockGetDashboard.mockResolvedValue({})
    mockGetAnalytics.mockResolvedValue(null)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Overview')).toBeInTheDocument()
    })
    // quickStats array stays empty - no stat cards
    expect(screen.queryByText('Total Projects')).not.toBeInTheDocument()
  })

  // ─── Time Range ──────────────────────────────────────────────────

  it('renders time range selector with correct options', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Overview')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('Last 30 days')).toBeInTheDocument()
  })

  it('renders refresh button', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })
})
