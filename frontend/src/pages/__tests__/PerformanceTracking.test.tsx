import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()

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

// ─── config ─────────────────────────────────────────────────────────
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8001',
  config: {
    API_URL: 'http://localhost:8001',
  },
  default: {
    API_URL: 'http://localhost:8001',
  },
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('../../components/ErrorBoundary/PortalErrorBoundary', () => ({
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

const mockPerformanceData = {
  overallROI: 18.5,
  projectedROI: 22,
  roiByProject: [
    {
      investment_id: 1,
      id: 1,
      title: 'The Dark Horizon',
      genre: 'Drama',
      amount: 50000,
      current_value: 59250,
      roi: 18.5,
      status: 'active',
      created_at: '2024-01-15T00:00:00Z',
    },
    {
      investment_id: 2,
      id: 2,
      title: 'Comedy Gold',
      genre: 'Comedy',
      amount: 30000,
      current_value: 34500,
      roi: 15,
      status: 'active',
      created_at: '2023-11-01T00:00:00Z',
    },
  ],
  roiByGenre: [
    { genre: 'Drama', avg_roi: 18.5, count: 1 },
    { genre: 'Comedy', avg_roi: 15, count: 1 },
  ],
  roiTimeline: [
    { month: '2024-01', value: 110000, invested: 100000 },
  ],
}

let PerformanceTracking: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/PerformanceTracking')
  PerformanceTracking = mod.default
})

describe('PerformanceTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPerformanceData),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading spinner initially', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    render(
      <MemoryRouter>
        <PerformanceTracking />
      </MemoryRouter>
    )
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders page heading after load', async () => {
    render(
      <MemoryRouter>
        <PerformanceTracking />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Performance Tracking')).toBeInTheDocument()
    })
  })

  it('renders metrics cards after load', async () => {
    render(
      <MemoryRouter>
        <PerformanceTracking />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Portfolio Value')).toBeInTheDocument()
      expect(screen.getByText('Total ROI')).toBeInTheDocument()
      expect(screen.getByText('Active Projects')).toBeInTheDocument()
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
    })
  })

  it('renders Genres metric card', async () => {
    render(
      <MemoryRouter>
        <PerformanceTracking />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Genres')).toBeInTheDocument()
    })
  })

  it('renders Projected ROI metric card', async () => {
    render(
      <MemoryRouter>
        <PerformanceTracking />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Projected ROI')).toBeInTheDocument()
    })
  })

  it('renders time range selector', async () => {
    render(
      <MemoryRouter>
        <PerformanceTracking />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Last Year')).toBeInTheDocument()
    })
  })

  it('renders Portfolio Performance Over Time chart section', async () => {
    render(
      <MemoryRouter>
        <PerformanceTracking />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Portfolio Performance Over Time')).toBeInTheDocument()
    })
  })

  it('renders Individual Investment Performance table', async () => {
    render(
      <MemoryRouter>
        <PerformanceTracking />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Individual Investment Performance')).toBeInTheDocument()
    })
  })

  it('renders investment names from API data', async () => {
    render(
      <MemoryRouter>
        <PerformanceTracking />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('The Dark Horizon')).toBeInTheDocument()
      expect(screen.getByText('Comedy Gold')).toBeInTheDocument()
    })
  })

  it('renders Export Report button', async () => {
    render(
      <MemoryRouter>
        <PerformanceTracking />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Export Report')).toBeInTheDocument()
    })
  })

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }))
    render(
      <MemoryRouter>
        <PerformanceTracking />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Failed to load performance data')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  it('shows empty table message when no investments', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        overallROI: 0,
        projectedROI: 0,
        roiByProject: [],
        roiByGenre: [],
        roiTimeline: [],
      }),
    }))
    render(
      <MemoryRouter>
        <PerformanceTracking />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/No investments yet/)).toBeInTheDocument()
    })
  })
})
