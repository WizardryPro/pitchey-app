import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()
const mockGetPendingDeals = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
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
  logout: mockLogout,
  checkSession: mockCheckSession,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Investor service ────────────────────────────────────────────────
vi.mock('@/services/investor.service', () => ({
  investorApi: {
    getPendingDeals: mockGetPendingDeals,
  },
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('@/components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

// ─── Defensive utilities ────────────────────────────────────────────
vi.mock('../../utils/defensive', () => ({
  safeArray: (v: any) => v || [],
  safeMap: (arr: any[], fn: any) => (arr || []).map(fn),
  safeAccess: (obj: any, path: string, def: any) => {
    const keys = path.split('.')
    let cur = obj
    for (const k of keys) {
      if (cur == null) return def
      cur = cur[k]
    }
    return cur ?? def
  },
  safeNumber: (v: any, def: number = 0) => (typeof v === 'number' ? v : def),
  safeString: (v: any, def: string = '') => (typeof v === 'string' ? v : def),
  safeExecute: (fn: any) => { try { return fn() } catch { return undefined } },
}))

const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

const mockDeals = [
  {
    id: 1,
    pitch_id: 5,
    pitch_title: 'Neon Streets',
    pitch_genre: 'Action',
    creator_name: 'Jane Film',
    company_name: 'Neon Studios',
    deal_type: 'equity',
    requested_amount: 200000,
    minimum_investment: 10000,
    status: 'under-review',
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    deadline: futureDate,
    priority: 'high',
    notes: 'Exciting action project',
    projected_roi: 35,
    risk_level: 'medium',
  },
  {
    id: 2,
    pitch_id: 6,
    pitch_title: 'Love in Paris',
    pitch_genre: 'Romance',
    creator_name: 'Pierre Director',
    company_name: 'Paris Films',
    deal_type: 'revenue-share',
    requested_amount: 100000,
    minimum_investment: 5000,
    status: 'negotiating',
    created_at: '2024-04-01T00:00:00Z',
    updated_at: '2024-06-10T00:00:00Z',
    deadline: futureDate,
    priority: 'medium',
    notes: null,
    projected_roi: 20,
    risk_level: 'low',
  },
]

let PendingDeals: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/PendingDeals')
  PendingDeals = mod.default
})

describe('PendingDeals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    mockGetPendingDeals.mockResolvedValue({
      success: true,
      data: { deals: mockDeals },
    })
  })

  it('shows loading spinner initially', async () => {
    mockGetPendingDeals.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <PendingDeals />
      </MemoryRouter>
    )
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders page heading after load', async () => {
    render(
      <MemoryRouter>
        <PendingDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Pending Deals')).toBeInTheDocument()
    })
  })

  it('renders stats cards', async () => {
    render(
      <MemoryRouter>
        <PendingDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Total Pending')).toBeInTheDocument()
      // "Expiring Soon" appears in both stat card and status dropdown option
      expect(screen.getAllByText('Expiring Soon').length).toBeGreaterThan(0)
      // "High Priority" appears in both stat card and priority dropdown option
      expect(screen.getAllByText('High Priority').length).toBeGreaterThan(0)
      expect(screen.getByText('Total Requested')).toBeInTheDocument()
    })
  })

  it('renders deal cards from API data', async () => {
    render(
      <MemoryRouter>
        <PendingDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Neon Streets')).toBeInTheDocument()
      expect(screen.getByText('Love in Paris')).toBeInTheDocument()
    })
  })

  it('renders filter controls', async () => {
    render(
      <MemoryRouter>
        <PendingDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search deals...')).toBeInTheDocument()
      expect(screen.getByText('All Status')).toBeInTheDocument()
      expect(screen.getByText('All Priority')).toBeInTheDocument()
    })
  })

  it('renders action buttons for deals', async () => {
    render(
      <MemoryRouter>
        <PendingDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      const reviewButtons = screen.getAllByText('Review Deal')
      expect(reviewButtons.length).toBeGreaterThan(0)
    })
  })

  it('shows empty state when no deals', async () => {
    mockGetPendingDeals.mockResolvedValue({
      success: true,
      data: { deals: [] },
    })
    render(
      <MemoryRouter>
        <PendingDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No pending deals found')).toBeInTheDocument()
    })
  })

  it('shows empty state on API error', async () => {
    mockGetPendingDeals.mockRejectedValue(new Error('Network error'))
    render(
      <MemoryRouter>
        <PendingDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No pending deals found')).toBeInTheDocument()
    })
  })

  it('displays deal details like genre and status', async () => {
    render(
      <MemoryRouter>
        <PendingDeals />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Action')).toBeInTheDocument()
    })
  })
})
