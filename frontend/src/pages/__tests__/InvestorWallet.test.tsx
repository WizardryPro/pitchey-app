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

// ─── InvestorService / investorApi ─────────────────────────────────
const mockGetFinancialSummary = vi.fn()
const mockGetRecentTransactions = vi.fn()
const mockGetTransactionStats = vi.fn()
const mockGetAllInvestments = vi.fn()
const mockGetTransactions = vi.fn()

vi.mock('../../services/investor.service', () => ({
  investorApi: {
    getFinancialSummary: mockGetFinancialSummary,
    getRecentTransactions: mockGetRecentTransactions,
    getTransactionStats: mockGetTransactionStats,
    getAllInvestments: mockGetAllInvestments,
    getTransactions: mockGetTransactions,
    getReports: vi.fn(),
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
  },
  InvestorService: {
    getOpportunities: vi.fn(),
    getWatchlist: vi.fn(),
  },
}))

// ─── Also mock from @/services path ────────────────────────────────
vi.mock('@/services/investor.service', () => ({
  investorApi: {
    getFinancialSummary: mockGetFinancialSummary,
    getRecentTransactions: mockGetRecentTransactions,
    getTransactionStats: mockGetTransactionStats,
    getAllInvestments: mockGetAllInvestments,
    getTransactions: mockGetTransactions,
    getReports: vi.fn(),
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
  },
  InvestorService: {
    getOpportunities: vi.fn(),
    getWatchlist: vi.fn(),
  },
}))

// ─── react-hot-toast ────────────────────────────────────────────────
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
  Toaster: () => null,
}))

// ─── UI Components ──────────────────────────────────────────────────
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} {...props} />
  ),
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('../../components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

// ─── WebSocket stub ─────────────────────────────────────────────────
class MockWebSocket {
  onopen: (() => void) | null = null
  onmessage: ((event: any) => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((error: any) => void) | null = null
  close = vi.fn()
  send = vi.fn()
  constructor(url: string) {}
}
vi.stubGlobal('WebSocket', MockWebSocket)

let InvestorWallet: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/InvestorWallet')
  InvestorWallet = mod.default
})

const mockSummaryResponse = {
  success: true,
  data: {
    portfolioValue: 500000,
    totalInvested: 400000,
    pendingInvestments: 10000,
  },
}

const mockTransactionsResponse = {
  success: true,
  data: {
    transactions: [
      {
        id: 1,
        type: 'investment',
        description: 'Investment in Galaxy Quest',
        amount: -50000,
        date: '2025-01-15',
        status: 'completed',
        balance: 450000,
      },
    ],
  },
}

const mockStatsResponse = {
  success: true,
  data: {
    stats: {
      todayVolume: 10000,
      weeklyVolume: 50000,
      failedTransactions: 0,
      pendingTransactions: 2,
    },
  },
}

const mockPaymentMethodsResponse = {
  success: true,
  data: { paymentMethods: [] },
}

describe('InvestorWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetFinancialSummary.mockResolvedValue(mockSummaryResponse)
    mockGetRecentTransactions.mockResolvedValue(mockTransactionsResponse)
    mockGetTransactionStats.mockResolvedValue(mockStatsResponse)
    mockGetAllInvestments.mockResolvedValue(mockPaymentMethodsResponse)
    mockGetTransactions.mockResolvedValue({ success: true, data: { transactions: [] } })
  })

  it('renders Wallet heading', async () => {
    render(
      <MemoryRouter>
        <InvestorWallet />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Wallet')).toBeInTheDocument()
    })
  })

  it('renders balance cards', async () => {
    render(
      <MemoryRouter>
        <InvestorWallet />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Available')).toBeInTheDocument()
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByText('Invested')).toBeInTheDocument()
      expect(screen.getByText('Total Assets')).toBeInTheDocument()
    })
  })

  it('renders Deposit button', async () => {
    render(
      <MemoryRouter>
        <InvestorWallet />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Deposit')).toBeInTheDocument()
    })
  })

  it('renders Withdraw button', async () => {
    render(
      <MemoryRouter>
        <InvestorWallet />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Withdraw')).toBeInTheDocument()
    })
  })

  it('renders tab navigation', async () => {
    render(
      <MemoryRouter>
        <InvestorWallet />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument()
      expect(screen.getByText('Transactions')).toBeInTheDocument()
      expect(screen.getByText('Payment Methods')).toBeInTheDocument()
      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByText('Security')).toBeInTheDocument()
    })
  })

  it('renders Recent Transactions in Overview tab', async () => {
    render(
      <MemoryRouter>
        <InvestorWallet />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
    })
  })

  it('renders Quick Actions in Overview tab', async () => {
    render(
      <MemoryRouter>
        <InvestorWallet />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    })
  })

  it('renders quick action buttons', async () => {
    render(
      <MemoryRouter>
        <InvestorWallet />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Transfer from Bank')).toBeInTheDocument()
      expect(screen.getByText('Transfer to Bank')).toBeInTheDocument()
    })
  })
})
