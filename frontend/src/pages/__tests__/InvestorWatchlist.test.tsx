import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── react-router-dom ───────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store ─────────────────────────────────────────────────────
const mockUser = { id: 1, name: 'Investor User', email: 'investor@test.com', user_type: 'investor' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: vi.fn(),
  checkSession: vi.fn(),
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── InvestorService ─────────────────────────────────────────────────
const mockGetWatchlist = vi.fn()
vi.mock('../../services/investor.service', () => ({
  InvestorService: {
    getWatchlist: mockGetWatchlist,
    getOpportunities: vi.fn(),
  },
  investorApi: {
    getFinancialSummary: vi.fn(),
    getRecentTransactions: vi.fn(),
    getTransactionStats: vi.fn(),
    getAllInvestments: vi.fn(),
    getTransactions: vi.fn(),
    getReports: vi.fn(),
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
  },
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('@/components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

let InvestorWatchlist: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/InvestorWatchlist')
  InvestorWatchlist = mod.default
})

const sampleWatchlistItems = [
  {
    id: '1',
    type: 'project',
    name: 'Galactic Journey',
    description: 'A space exploration film',
    addedAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-01-20T00:00:00.000Z',
    status: 'active',
    alerts: { newPitches: true, milestones: true, funding: false, performance: true },
    metrics: { totalPitches: 3, successRate: 80, averageROI: 25 },
    recentActivity: [
      { type: 'update', description: 'New pitch submitted', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    ],
    trend: 'up',
    trendValue: 12,
  },
  {
    id: '2',
    type: 'creator',
    name: 'Sarah Director',
    description: 'Award-winning filmmaker',
    addedAt: '2025-01-10T00:00:00.000Z',
    updatedAt: '2025-01-18T00:00:00.000Z',
    status: 'active',
    alerts: { newPitches: false, milestones: false, funding: false, performance: false },
    metrics: { totalPitches: 10, successRate: 70 },
    recentActivity: [],
    trend: 'stable',
    trendValue: 0,
  },
]

describe('InvestorWatchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWatchlist.mockResolvedValue(sampleWatchlistItems)
  })

  it('shows loading spinner initially', () => {
    mockGetWatchlist.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders Investment Watchlist heading', async () => {
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Investment Watchlist')).toBeInTheDocument()
    })
  })

  it('renders watchlist items', async () => {
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Galactic Journey')).toBeInTheDocument()
      expect(screen.getByText('Sarah Director')).toBeInTheDocument()
    })
  })

  it('renders type badges', async () => {
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    await waitFor(() => {
      const projectBadges = screen.getAllByText('project')
      expect(projectBadges.length).toBeGreaterThan(0)
    })
  })

  it('renders search input', async () => {
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search watchlist...')).toBeInTheDocument()
    })
  })

  it('renders filter selects', async () => {
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('All Types')).toBeInTheDocument()
      expect(screen.getByText('All Status')).toBeInTheDocument()
      expect(screen.getByText('All Alerts')).toBeInTheDocument()
    })
  })

  it('renders Add to Watchlist button', async () => {
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Add to Watchlist')).toBeInTheDocument()
    })
  })

  it('renders Refresh button', async () => {
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })

  it('shows item count', async () => {
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/showing 2 of 2 watchlist items/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when watchlist is empty', async () => {
    mockGetWatchlist.mockResolvedValue([])
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No watchlist items found')).toBeInTheDocument()
    })
  })

  it('shows error alert on failure', async () => {
    mockGetWatchlist.mockRejectedValue(new Error('Network error'))
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Failed to load watchlist')).toBeInTheDocument()
    })
  })

  it('shows alert settings for watchlist items', async () => {
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getAllByText('Alert Settings').length).toBeGreaterThan(0)
    })
  })

  it('renders recent activity for items', async () => {
    render(
      <MemoryRouter>
        <InvestorWatchlist />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('New pitch submitted')).toBeInTheDocument()
    })
  })
})
