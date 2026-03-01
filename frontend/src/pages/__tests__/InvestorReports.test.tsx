import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
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

// ─── investorApi ────────────────────────────────────────────────────
const mockGetReports = vi.fn()
vi.mock('../../services/investor.service', () => ({
  investorApi: {
    getReports: mockGetReports,
    getFinancialSummary: vi.fn(),
    getRecentTransactions: vi.fn(),
    getTransactionStats: vi.fn(),
    getAllInvestments: vi.fn(),
    getTransactions: vi.fn(),
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
  },
  InvestorService: {
    getOpportunities: vi.fn(),
    getWatchlist: vi.fn(),
  },
}))

// ─── UI Components ──────────────────────────────────────────────────
vi.mock('@shared/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}))

vi.mock('@shared/components/ui/button', () => ({
  Button: ({ children, onClick, variant, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} {...props}>{children}</button>
  ),
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('@/components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

let InvestorReports: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/InvestorReports')
  InvestorReports = mod.default
})

const sampleReports = [
  {
    id: '1',
    title: 'Q1 2025 Portfolio Performance',
    type: 'quarterly',
    category: 'performance',
    date: '2025-03-31',
    fileSize: '2.4 MB',
    format: 'pdf',
    description: 'Quarterly overview of your portfolio performance and returns',
  },
  {
    id: '2',
    title: 'Annual Investment Summary 2024',
    type: 'annual',
    category: 'portfolio',
    date: '2024-12-31',
    fileSize: '5.1 MB',
    format: 'excel',
    description: 'Complete annual summary of your investment activities',
  },
  {
    id: '3',
    title: 'Tax Documents - Year 2024',
    type: 'annual',
    category: 'tax',
    date: '2025-01-15',
    fileSize: '1.2 MB',
    format: 'pdf',
    description: 'Tax documentation for your investments in 2024',
  },
]

describe('InvestorReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetReports.mockResolvedValue({
      success: true,
      data: { reports: sampleReports },
    })
  })

  it('shows loading spinner initially', () => {
    mockGetReports.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <InvestorReports />
      </MemoryRouter>
    )
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders Investment Reports heading', async () => {
    render(
      <MemoryRouter>
        <InvestorReports />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Investment Reports')).toBeInTheDocument()
    })
  })

  it('renders reports from API', async () => {
    render(
      <MemoryRouter>
        <InvestorReports />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Q1 2025 Portfolio Performance')).toBeInTheDocument()
      expect(screen.getByText('Annual Investment Summary 2024')).toBeInTheDocument()
      expect(screen.getByText('Tax Documents - Year 2024')).toBeInTheDocument()
    })
  })

  it('renders category filter buttons', async () => {
    render(
      <MemoryRouter>
        <InvestorReports />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('All Categories')).toBeInTheDocument()
      expect(screen.getByText('Performance')).toBeInTheDocument()
      expect(screen.getByText('Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Tax Documents')).toBeInTheDocument()
      expect(screen.getByText('Analytics')).toBeInTheDocument()
    })
  })

  it('renders period filter buttons', async () => {
    render(
      <MemoryRouter>
        <InvestorReports />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('All Periods')).toBeInTheDocument()
      expect(screen.getByText('Monthly')).toBeInTheDocument()
      expect(screen.getByText('Quarterly')).toBeInTheDocument()
      expect(screen.getByText('Annual')).toBeInTheDocument()
    })
  })

  it('renders Download Report buttons', async () => {
    render(
      <MemoryRouter>
        <InvestorReports />
      </MemoryRouter>
    )
    await waitFor(() => {
      const downloadButtons = screen.getAllByText('Download Report')
      expect(downloadButtons).toHaveLength(3)
    })
  })

  it('renders format badges', async () => {
    render(
      <MemoryRouter>
        <InvestorReports />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getAllByText('PDF').length).toBeGreaterThan(0)
      expect(screen.getByText('EXCEL')).toBeInTheDocument()
    })
  })

  it('shows empty state when no reports', async () => {
    mockGetReports.mockResolvedValue({
      success: true,
      data: { reports: [] },
    })
    render(
      <MemoryRouter>
        <InvestorReports />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No reports available yet')).toBeInTheDocument()
    })
  })

  it('shows error message on API failure', async () => {
    mockGetReports.mockRejectedValue(new Error('Failed to fetch'))
    render(
      <MemoryRouter>
        <InvestorReports />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/failed to load reports/i)).toBeInTheDocument()
    })
  })

  it('renders report descriptions', async () => {
    render(
      <MemoryRouter>
        <InvestorReports />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Quarterly overview of your portfolio performance and returns')).toBeInTheDocument()
    })
  })

  it('renders file sizes', async () => {
    render(
      <MemoryRouter>
        <InvestorReports />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('2.4 MB')).toBeInTheDocument()
      expect(screen.getByText('5.1 MB')).toBeInTheDocument()
    })
  })
})
