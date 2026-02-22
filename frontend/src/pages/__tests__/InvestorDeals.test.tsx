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

// ─── config (for API_URL used in fetch) ─────────────────────────────
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8787',
  config: { API_URL: 'http://localhost:8787' },
  default: { API_URL: 'http://localhost:8787' },
}))

// ─── fetch (InvestorDeals uses globalThis.fetch) ─────────────────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('../../components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

let InvestorDeals: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/InvestorDeals')
  InvestorDeals = mod.default
})

const sampleDeals = [
  {
    id: '1',
    title: 'Galaxy Quest Production Deal',
    type: 'equity',
    status: 'negotiation',
    stage: 'seed',
    creator_name: 'Alex Creator',
    creator_verified: true,
    project_title: 'Galaxy Quest',
    description: 'Sci-fi space adventure',
    genre: ['Sci-Fi'],
    budget: 5000000,
    amount_requested: 1000000,
    equity_percentage: 15,
    risk_score: 'medium',
    priority: 'high',
    created_at: '2025-01-10T00:00:00.000Z',
    updated_at: '2025-01-15T00:00:00.000Z',
    documents: {
      pitchDeck: true,
      businessPlan: true,
      financials: false,
      termSheet: false,
      legalDocs: false,
    },
  },
  {
    id: '2',
    title: 'Romantic Drama Fund',
    type: 'revenue-share',
    status: 'closed',
    stage: 'series-a',
    creator_name: 'Jane Smith',
    creator_verified: false,
    project_title: 'City Love Story',
    description: 'A romantic drama in the city',
    genre: ['Drama', 'Romance'],
    budget: 2000000,
    amount_requested: 500000,
    equity_percentage: 20,
    risk_score: 'low',
    priority: 'medium',
    created_at: '2024-12-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    documents: {
      pitchDeck: true,
      businessPlan: true,
      financials: true,
      termSheet: true,
      legalDocs: true,
    },
  },
]

describe('InvestorDeals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ deals: sampleDeals }),
    })
  })

  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <InvestorDeals />
      </MemoryRouter>
    )
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders Deal Pipeline heading', async () => {
    render(
      <MemoryRouter>
        <InvestorDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Deal Pipeline')).toBeInTheDocument()
    })
  })

  it('renders pipeline overview stats', async () => {
    render(
      <MemoryRouter>
        <InvestorDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Active Pipeline')).toBeInTheDocument()
      expect(screen.getByText('In Negotiation')).toBeInTheDocument()
      expect(screen.getAllByText('Due Diligence').length).toBeGreaterThan(0)
      expect(screen.getByText('Closed Deals')).toBeInTheDocument()
    })
  })

  it('renders deals from API', async () => {
    render(
      <MemoryRouter>
        <InvestorDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Galaxy Quest Production Deal')).toBeInTheDocument()
      expect(screen.getByText('Romantic Drama Fund')).toBeInTheDocument()
    })
  })

  it('renders deal type badges', async () => {
    render(
      <MemoryRouter>
        <InvestorDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('equity')).toBeInTheDocument()
      expect(screen.getByText('revenue share')).toBeInTheDocument()
    })
  })

  it('renders search input', async () => {
    render(
      <MemoryRouter>
        <InvestorDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search deals...')).toBeInTheDocument()
    })
  })

  it('renders filter selects', async () => {
    render(
      <MemoryRouter>
        <InvestorDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('All Status')).toBeInTheDocument()
      expect(screen.getByText('All Types')).toBeInTheDocument()
      expect(screen.getByText('All Stages')).toBeInTheDocument()
    })
  })

  it('renders Export Pipeline button', async () => {
    render(
      <MemoryRouter>
        <InvestorDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Export Pipeline')).toBeInTheDocument()
    })
  })

  it('renders New Deal button', async () => {
    render(
      <MemoryRouter>
        <InvestorDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('New Deal')).toBeInTheDocument()
    })
  })

  it('shows empty state when no deals', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ deals: [] }),
    })
    render(
      <MemoryRouter>
        <InvestorDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No deals found')).toBeInTheDocument()
    })
  })

  it('shows error state on API failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })
    render(
      <MemoryRouter>
        <InvestorDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Failed to load deals')).toBeInTheDocument()
    })
  })

  it('shows creator names for deals', async () => {
    render(
      <MemoryRouter>
        <InvestorDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Alex Creator')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
  })
})
