import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()
const mockApiGet = vi.fn()
const mockReportError = vi.fn()
const mockTrackEvent = vi.fn()
const mockTrackApiError = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => ({
    user: { id: 1, name: 'Test Investor', email: 'investor@test.com' },
    isAuthenticated: true,
    logout: mockLogout,
    checkSession: mockCheckSession,
  }),
}))

vi.mock('../../lib/api', () => ({
  default: {
    get: mockApiGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@shared/contexts/WebSocketContext', () => ({
  useWebSocket: () => ({
    isConnected: true,
    connectionQuality: { strength: 'good' },
    isReconnecting: false,
  }),
}))

vi.mock('../../hooks/useSentryPortal', () => ({
  useSentryPortal: () => ({
    reportError: mockReportError,
    trackEvent: mockTrackEvent,
    trackApiError: mockTrackApiError,
  }),
}))

vi.mock('@/components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

vi.mock('../../utils/formatters', () => ({
  formatCurrency: (v: number) => `$${v.toLocaleString()}`,
  formatPercentage: (v: number) => `${v}%`,
  formatDate: (v: string) => v,
}))

vi.mock('../../utils/defensive', () => ({
  validatePortfolio: (v: any) => v,
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
  isValidDate: () => true,
  safeExecute: (fn: any) => { try { return fn() } catch { return undefined } },
}))

// Import component after all mocks
let InvestorDashboard: React.ComponentType
beforeAll(async () => {
  const mod = await import('../InvestorDashboard')
  InvestorDashboard = mod.default
})

function renderDashboard() {
  return render(
    <MemoryRouter>
      <InvestorDashboard />
    </MemoryRouter>
  )
}

const mockPortfolio = () => ({
  totalInvested: 500000,
  activeInvestments: 5,
  averageROI: 12.5,
  topPerformer: 'Digital Dreams',
})

describe('InvestorDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('portfolio/summary')) return Promise.resolve({ data: { data: mockPortfolio() } })
      if (url.includes('investments')) return Promise.resolve({ data: { data: [] } })
      if (url.includes('saved-pitches')) return Promise.resolve({ data: { data: [] } })
      if (url.includes('nda/active')) return Promise.resolve({ data: { data: [] } })
      if (url.includes('notifications')) return Promise.resolve({ data: { data: [] } })
      if (url.includes('recommendations')) return Promise.resolve({ data: { data: [] } })
      return Promise.resolve({ data: { data: [] } })
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  // ─── Loading ───────────────────────────────────────────────────────

  describe('Loading State', () => {
    it('shows skeleton loading initially', () => {
      renderDashboard()
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  // ─── Authentication ────────────────────────────────────────────────

  describe('Authentication', () => {
    it('checks session on mount', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockCheckSession).toHaveBeenCalledTimes(1)
      })
    })

    it('fetches dashboard data when authenticated', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/investor/portfolio/summary')
        expect(mockApiGet).toHaveBeenCalledWith('/api/investor/investments')
      })
    })
  })

  // ─── Dashboard Layout ──────────────────────────────────────────────

  describe('Dashboard Layout', () => {
    it('displays the dashboard title', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Investor Dashboard')).toBeInTheDocument()
      })
    })

    it('displays portfolio summary cards', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Total Invested')).toBeInTheDocument()
        expect(screen.getByText('Active Deals')).toBeInTheDocument()
      })
    })
  })

  // ─── Portfolio Data ────────────────────────────────────────────────

  describe('Portfolio Data', () => {
    it('displays portfolio values', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('$500,000')).toBeInTheDocument()
        expect(screen.getByText('12.5%')).toBeInTheDocument()
        expect(screen.getByText('Digital Dreams')).toBeInTheDocument()
      })
    })
  })

  // ─── Error Handling ────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('shows error when portfolio API fails', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('portfolio/summary')) return Promise.reject(new Error('Network error'))
        return Promise.resolve({ data: { data: [] } })
      })

      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Failed to load portfolio data/i)).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('portfolio/summary')) return Promise.reject(new Error('err'))
        return Promise.resolve({ data: { data: [] } })
      })

      renderDashboard()
      await waitFor(() => {
        const retryButtons = screen.getAllByText('Retry')
        expect(retryButtons.length).toBeGreaterThan(0)
      })
    })

    it('tracks API errors with Sentry', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('portfolio/summary')) return Promise.reject(new Error('API failure'))
        return Promise.resolve({ data: { data: [] } })
      })

      renderDashboard()
      await waitFor(() => {
        expect(mockTrackApiError).toHaveBeenCalledWith(
          '/api/investor/portfolio/summary',
          expect.any(Error)
        )
      })
    })
  })

  // ─── Tab Navigation ────────────────────────────────────────────────

  describe('Tab Navigation', () => {
    it('displays tab buttons', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Browse')).toBeInTheDocument()
        expect(screen.getByText('Investments')).toBeInTheDocument()
      })
    })
  })

  // ─── Connectivity ──────────────────────────────────────────────────

  describe('Connectivity', () => {
    it('does not show offline banner when online', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
      })
    })

    it('shows offline banner when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { writable: true, value: false })
      renderDashboard()

      window.dispatchEvent(new Event('offline'))

      await waitFor(() => {
        expect(screen.getByText(/offline/i)).toBeInTheDocument()
      })
    })
  })
})
