import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()
const mockGetFinancialSummary = vi.fn()
const mockGetRecentTransactions = vi.fn()

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
    getFinancialSummary: mockGetFinancialSummary,
    getRecentTransactions: mockGetRecentTransactions,
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

const mockFinancialData = {
  available_funds: 250000,
  allocated_funds: 750000,
  total_returns: 125000,
  pending_amount: 15000,
  ytd_growth: 12,
}

const mockTransactions = [
  {
    id: 1,
    type: 'investment',
    amount: 50000,
    description: 'Investment in The Dark Horizon',
    created_at: '2024-05-01T00:00:00Z',
    pitch_title: 'The Dark Horizon',
  },
  {
    id: 2,
    type: 'return',
    amount: 5000,
    description: 'Quarterly return from Comedy Gold',
    created_at: '2024-04-15T00:00:00Z',
    pitch_title: 'Comedy Gold',
  },
]

let FinancialOverview: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/FinancialOverview')
  FinancialOverview = mod.default
})

describe('FinancialOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    mockGetFinancialSummary.mockResolvedValue({ data: mockFinancialData })
    mockGetRecentTransactions.mockResolvedValue({ data: { transactions: mockTransactions } })
  })

  it('shows loading spinner initially', async () => {
    mockGetFinancialSummary.mockReturnValue(new Promise(() => {}))
    mockGetRecentTransactions.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <FinancialOverview />
      </MemoryRouter>
    )
    // The loading spinner is a RefreshCw icon with animate-spin
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders page heading after load', async () => {
    render(
      <MemoryRouter>
        <FinancialOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Financial Overview')).toBeInTheDocument()
    })
  })

  it('renders asset metric cards', async () => {
    render(
      <MemoryRouter>
        <FinancialOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Total Assets')).toBeInTheDocument()
      expect(screen.getByText('Available Funds')).toBeInTheDocument()
      expect(screen.getByText('Allocated Funds')).toBeInTheDocument()
      expect(screen.getByText('YTD Growth')).toBeInTheDocument()
    })
  })

  it('renders YTD growth value from API', async () => {
    render(
      <MemoryRouter>
        <FinancialOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('+12%')).toBeInTheDocument()
    })
  })

  it('renders Recent Transactions section', async () => {
    render(
      <MemoryRouter>
        <FinancialOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
    })
  })

  it('renders transaction descriptions', async () => {
    render(
      <MemoryRouter>
        <FinancialOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Investment in The Dark Horizon')).toBeInTheDocument()
      expect(screen.getByText('Quarterly return from Comedy Gold')).toBeInTheDocument()
    })
  })

  it('renders Financial Summary section', async () => {
    render(
      <MemoryRouter>
        <FinancialOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Financial Summary')).toBeInTheDocument()
      expect(screen.getByText('Total Returns')).toBeInTheDocument()
      expect(screen.getByText('Pending Transactions')).toBeInTheDocument()
    })
  })

  it('renders View All Transactions button', async () => {
    render(
      <MemoryRouter>
        <FinancialOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('View All Transactions')).toBeInTheDocument()
    })
  })

  it('renders Export Statement button', async () => {
    render(
      <MemoryRouter>
        <FinancialOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Export Statement')).toBeInTheDocument()
    })
  })

  it('shows no recent transactions message when empty', async () => {
    mockGetRecentTransactions.mockResolvedValue({ data: { transactions: [] } })
    render(
      <MemoryRouter>
        <FinancialOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No recent transactions')).toBeInTheDocument()
    })
  })

  it('shows error state when API fails', async () => {
    mockGetFinancialSummary.mockRejectedValue(new Error('Network error'))
    render(
      <MemoryRouter>
        <FinancialOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Failed to load financial data')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })
})
