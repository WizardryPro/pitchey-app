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

// ─── fetch (InvestorStats uses globalThis.fetch directly) ───────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── recharts ───────────────────────────────────────────────────────
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  Bar: () => null,
  Pie: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
}))

// ─── UI Components (Shadcn) ─────────────────────────────────────────
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}))

vi.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children }: any) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
  ChartLegend: () => null,
  ChartLegendContent: () => null,
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('../../components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

let InvestorStats: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/InvestorStats')
  InvestorStats = mod.default
})

const mockSummaryData = {
  portfolioValue: 2500000,
  totalInvested: 2000000,
  activeInvestments: 5,
  averageROI: 25.5,
  completedInvestments: 3,
  totalInvestments: 12,
  monthlyGrowth: 4.2,
  hitRate: 60,
}

describe('InvestorStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockSummaryData }),
    })
  })

  it('shows loading skeleton initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <InvestorStats />
      </MemoryRouter>
    )
    // Loading skeleton has animate-pulse elements
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders Investment Analytics heading', async () => {
    render(
      <MemoryRouter>
        <InvestorStats />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Investment Analytics')).toBeInTheDocument()
    })
  })

  it('renders time range selector', async () => {
    render(
      <MemoryRouter>
        <InvestorStats />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Last 30 Days')).toBeInTheDocument()
    })
  })

  it('renders Export button', async () => {
    render(
      <MemoryRouter>
        <InvestorStats />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument()
    })
  })

  it('renders stat cards after data loads', async () => {
    render(
      <MemoryRouter>
        <InvestorStats />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Portfolio Value')).toBeInTheDocument()
      expect(screen.getAllByText('Total Invested').length).toBeGreaterThan(0)
      expect(screen.getByText('Average ROI')).toBeInTheDocument()
      expect(screen.getAllByText('Active Investments').length).toBeGreaterThan(0)
    })
  })

  it('renders Portfolio Breakdown section', async () => {
    render(
      <MemoryRouter>
        <InvestorStats />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Portfolio Breakdown')).toBeInTheDocument()
    })
  })

  it('renders Investment Activity section', async () => {
    render(
      <MemoryRouter>
        <InvestorStats />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Investment Activity')).toBeInTheDocument()
    })
  })

  it('renders Performance KPIs section', async () => {
    render(
      <MemoryRouter>
        <InvestorStats />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Performance KPIs')).toBeInTheDocument()
    })
  })

  it('renders chart sections', async () => {
    render(
      <MemoryRouter>
        <InvestorStats />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Portfolio Performance')).toBeInTheDocument()
      expect(screen.getByText('Investments by Stage')).toBeInTheDocument()
    })
  })

  it('renders Investment Insights section', async () => {
    render(
      <MemoryRouter>
        <InvestorStats />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Investment Insights')).toBeInTheDocument()
    })
  })

  it('handles fetch failure gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Server error'))
    render(
      <MemoryRouter>
        <InvestorStats />
      </MemoryRouter>
    )
    await waitFor(() => {
      // Still renders the headings even with empty stats
      expect(screen.getByText('Investment Analytics')).toBeInTheDocument()
    })
  })
})
