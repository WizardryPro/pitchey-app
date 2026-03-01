import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
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
    useSearchParams: () => [new URLSearchParams('tab=featured'), vi.fn()],
    useLocation: () => ({ pathname: '/investor/discover' }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── InvestorService ─────────────────────────────────────────────────
const mockGetOpportunities = vi.fn()
vi.mock('../../services/investor.service', () => ({
  InvestorService: {
    getOpportunities: mockGetOpportunities,
    getWatchlist: vi.fn(),
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

// ─── UI components ──────────────────────────────────────────────────
vi.mock('@shared/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('@/components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

let InvestorDiscover: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/InvestorDiscover')
  InvestorDiscover = mod.default
})

const sampleOpportunities = [
  {
    id: 1,
    title: 'Galaxy Quest 2',
    genre: 'Sci-Fi',
    logline: 'A sequel to the classic adventure',
    minInvestment: 500000,
    targetAmount: 2000000,
    expectedROI: 35,
    status: 'active',
    thumbnailUrl: '/images/test.jpg',
    matchScore: 80,
  },
  {
    id: 2,
    title: 'City Lights',
    genre: 'Drama',
    logline: 'Life in the big city',
    minInvestment: 200000,
    targetAmount: 800000,
    expectedROI: 20,
    status: 'published',
    thumbnailUrl: '/images/test2.jpg',
    matchScore: 60,
  },
]

describe('InvestorDiscover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOpportunities.mockResolvedValue({
      opportunities: sampleOpportunities,
      total: sampleOpportunities.length,
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  it('shows loading skeleton initially', () => {
    mockGetOpportunities.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <InvestorDiscover />
      </MemoryRouter>
    )
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders the page heading', async () => {
    render(
      <MemoryRouter>
        <InvestorDiscover />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Discover Investment Opportunities')).toBeInTheDocument()
    })
  })

  it('renders search input', async () => {
    render(
      <MemoryRouter>
        <InvestorDiscover />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search pitches...')).toBeInTheDocument()
    })
  })

  it('renders tab navigation', async () => {
    render(
      <MemoryRouter>
        <InvestorDiscover />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Featured')).toBeInTheDocument()
      expect(screen.getByText('High Potential')).toBeInTheDocument()
      expect(screen.getByText('Browse by Genre')).toBeInTheDocument()
    })
  })

  it('renders Back to Dashboard link', async () => {
    render(
      <MemoryRouter>
        <InvestorDiscover />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument()
    })
  })

  it('renders pitch cards from API', async () => {
    render(
      <MemoryRouter>
        <InvestorDiscover />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Galaxy Quest 2')).toBeInTheDocument()
      expect(screen.getByText('City Lights')).toBeInTheDocument()
    })
  })

  it('renders ROI values', async () => {
    render(
      <MemoryRouter>
        <InvestorDiscover />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('35%')).toBeInTheDocument()
    })
  })

  it('shows empty state when no pitches match', async () => {
    mockGetOpportunities.mockResolvedValue({ opportunities: [], total: 0 })
    render(
      <MemoryRouter>
        <InvestorDiscover />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No opportunities found')).toBeInTheDocument()
    })
  })

  it('shows error state on failure', async () => {
    mockGetOpportunities.mockRejectedValue(new Error('API error'))
    render(
      <MemoryRouter>
        <InvestorDiscover />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Failed to load opportunities')).toBeInTheDocument()
    })
  })

  it('shows offline banner when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false })
    render(
      <MemoryRouter>
        <InvestorDiscover />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/you are offline/i)).toBeInTheDocument()
    })
  })

  it('renders All Pitches link', async () => {
    render(
      <MemoryRouter>
        <InvestorDiscover />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('All Pitches')).toBeInTheDocument()
    })
  })
})
