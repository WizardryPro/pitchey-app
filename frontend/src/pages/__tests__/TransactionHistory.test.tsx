import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()
const mockGetTransactions = vi.fn()
const mockGetTransactionStats = vi.fn()
const mockExportTransactions = vi.fn()

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
    getTransactions: mockGetTransactions,
    getTransactionStats: mockGetTransactionStats,
    exportTransactions: mockExportTransactions,
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

const mockTransactionItems = [
  {
    id: 1,
    type: 'investment',
    amount: 50000,
    description: 'Investment in The Dark Horizon',
    category: 'drama',
    status: 'completed',
    created_at: '2024-05-01T00:00:00Z',
    pitch_title: 'The Dark Horizon',
  },
  {
    id: 2,
    type: 'return',
    amount: 5000,
    description: 'Return distribution',
    category: 'comedy',
    status: 'completed',
    created_at: '2024-04-01T00:00:00Z',
    pitch_title: 'Comedy Gold',
  },
  {
    id: 3,
    type: 'deposit',
    amount: 100000,
    description: 'Account deposit',
    category: null,
    status: 'pending',
    created_at: '2024-03-01T00:00:00Z',
    pitch_title: null,
  },
]

const mockStats = {
  total_transactions: 3,
  total_in: 105000,
  total_out: 50000,
  categories_used: 2,
}

let TransactionHistory: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/TransactionHistory')
  TransactionHistory = mod.default
})

describe('TransactionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    mockGetTransactions.mockResolvedValue({
      data: { items: mockTransactionItems, total: 3 },
    })
    mockGetTransactionStats.mockResolvedValue({
      data: { stats: mockStats },
    })
    mockExportTransactions.mockResolvedValue({ data: 'csv data' })
  })

  it('renders page heading', async () => {
    render(
      <MemoryRouter>
        <TransactionHistory />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Transaction History')).toBeInTheDocument()
    })
  })

  it('renders search input', async () => {
    render(
      <MemoryRouter>
        <TransactionHistory />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search transactions...')).toBeInTheDocument()
    })
  })

  it('renders stats cards when stats load', async () => {
    render(
      <MemoryRouter>
        <TransactionHistory />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Total Transactions')).toBeInTheDocument()
      expect(screen.getByText('Total Inflow')).toBeInTheDocument()
      expect(screen.getByText('Total Outflow')).toBeInTheDocument()
      expect(screen.getByText('Net Position')).toBeInTheDocument()
    })
  })

  it('renders transaction descriptions from API', async () => {
    render(
      <MemoryRouter>
        <TransactionHistory />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Investment in The Dark Horizon')).toBeInTheDocument()
      expect(screen.getByText('Return distribution')).toBeInTheDocument()
      expect(screen.getByText('Account deposit')).toBeInTheDocument()
    })
  })

  it('renders pitch titles for investments with associated pitches', async () => {
    render(
      <MemoryRouter>
        <TransactionHistory />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('The Dark Horizon')).toBeInTheDocument()
      expect(screen.getByText('Comedy Gold')).toBeInTheDocument()
    })
  })

  it('renders Export CSV button', async () => {
    render(
      <MemoryRouter>
        <TransactionHistory />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument()
    })
  })

  it('renders All Transactions card header', async () => {
    render(
      <MemoryRouter>
        <TransactionHistory />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('All Transactions')).toBeInTheDocument()
    })
  })

  it('shows no transactions message when empty', async () => {
    mockGetTransactions.mockResolvedValue({
      data: { items: [], total: 0 },
    })
    render(
      <MemoryRouter>
        <TransactionHistory />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No transactions found')).toBeInTheDocument()
    })
  })

  it('shows loading state during fetch', async () => {
    mockGetTransactions.mockReturnValue(new Promise(() => {}))
    mockGetTransactionStats.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <TransactionHistory />
      </MemoryRouter>
    )
    // Loading spinner should appear inside the card
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders transaction status badges', async () => {
    render(
      <MemoryRouter>
        <TransactionHistory />
      </MemoryRouter>
    )
    await waitFor(() => {
      const completedBadges = screen.getAllByText('completed')
      expect(completedBadges.length).toBeGreaterThan(0)
      expect(screen.getByText('pending')).toBeInTheDocument()
    })
  })
})
