import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()
const mockGetROISummary = vi.fn()
const mockGetROIByCategory = vi.fn()
const mockFetch = vi.fn()

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
    getROISummary: mockGetROISummary,
    getROIByCategory: mockGetROIByCategory,
  },
}))

// ─── recharts ────────────────────────────────────────────────────────
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  Bar: () => null,
  Pie: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
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

const mockROISummary = {
  total_investments: 500000,
  average_roi: 28.5,
  best_roi: 75,
  worst_roi: -10,
  profitable_count: 8,
}

const mockCategoryMetrics = [
  {
    category: 'Drama',
    avg_roi: 35,
    count: 3,
    total_profit: 52500,
  },
  {
    category: 'Action',
    avg_roi: 22,
    count: 2,
    total_profit: 28000,
  },
]

const mockPerfResponse = {
  roiTimeline: [
    { month: '2024-01', value: 110000, invested: 100000 },
    { month: '2024-02', value: 115000, invested: 100000 },
  ],
}

let ROIAnalysis: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/ROIAnalysis')
  ROIAnalysis = mod.default
})

describe('ROIAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    mockGetROISummary.mockResolvedValue({
      success: true,
      data: { summary: mockROISummary },
    })
    mockGetROIByCategory.mockResolvedValue({
      success: true,
      data: { categories: mockCategoryMetrics },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPerfResponse),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading spinner initially', async () => {
    mockGetROISummary.mockReturnValue(new Promise(() => {}))
    mockGetROIByCategory.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <ROIAnalysis />
      </MemoryRouter>
    )
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders page heading after load', async () => {
    render(
      <MemoryRouter>
        <ROIAnalysis />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('ROI Analysis')).toBeInTheDocument()
    })
  })

  it('renders key metric cards', async () => {
    render(
      <MemoryRouter>
        <ROIAnalysis />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Total Invested')).toBeInTheDocument()
      expect(screen.getByText('Total Returns')).toBeInTheDocument()
      expect(screen.getByText('Overall ROI')).toBeInTheDocument()
      expect(screen.getByText('Best Performer')).toBeInTheDocument()
    })
  })

  it('renders time range selector', async () => {
    render(
      <MemoryRouter>
        <ROIAnalysis />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Last Year')).toBeInTheDocument()
      expect(screen.getByText('Last Month')).toBeInTheDocument()
    })
  })

  it('renders ROI trend chart section', async () => {
    render(
      <MemoryRouter>
        <ROIAnalysis />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('ROI Trend Over Time')).toBeInTheDocument()
    })
  })

  it('renders ROI by category chart section', async () => {
    render(
      <MemoryRouter>
        <ROIAnalysis />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('ROI by Category')).toBeInTheDocument()
    })
  })

  it('renders detailed ROI breakdown table', async () => {
    render(
      <MemoryRouter>
        <ROIAnalysis />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Detailed ROI Breakdown')).toBeInTheDocument()
    })
  })

  it('renders category data in table', async () => {
    render(
      <MemoryRouter>
        <ROIAnalysis />
      </MemoryRouter>
    )
    await waitFor(() => {
      // "Drama" may appear in multiple places (Best Performer card + table row)
      expect(screen.getAllByText('Drama').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Action').length).toBeGreaterThan(0)
    })
  })

  it('renders Export Analysis button', async () => {
    render(
      <MemoryRouter>
        <ROIAnalysis />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Export Analysis')).toBeInTheDocument()
    })
  })

  it('shows error state when API fails', async () => {
    mockGetROISummary.mockRejectedValue(new Error('API down'))
    render(
      <MemoryRouter>
        <ROIAnalysis />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Failed to load ROI data')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  it('calls getROISummary and getROIByCategory via investorApi', async () => {
    render(
      <MemoryRouter>
        <ROIAnalysis />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(mockGetROISummary).toHaveBeenCalledTimes(1)
      expect(mockGetROIByCategory).toHaveBeenCalledTimes(1)
    })
  })

  it('calls GET /api/investor/performance for trend data', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPerfResponse),
    })
    vi.stubGlobal('fetch', fetchSpy)
    render(
      <MemoryRouter>
        <ROIAnalysis />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/investor/performance'),
        expect.objectContaining({ credentials: 'include' })
      )
    })
  })
})
