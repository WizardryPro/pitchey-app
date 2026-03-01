import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks — stable references to prevent infinite re-renders
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()
const mockApiGet = vi.fn()
const mockGetCreditBalance = vi.fn()
const mockGetSubscriptionStatus = vi.fn()
const mockGetCreatorFunding = vi.fn()
const mockReportError = vi.fn()
const mockTrackEvent = vi.fn()
const mockTrackApiError = vi.fn()

// Stable user object — must be the SAME reference across renders to prevent
// infinite useEffect loops (useEffect depends on authUser)
const stableUser = { id: 'user-1', name: 'Test Creator', email: 'creator@test.com', userType: 'creator' }

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
    user: stableUser,
    isAuthenticated: true,
    logout: mockLogout,
    checkSession: mockCheckSession,
  }),
}))

vi.mock('../../lib/api-client', () => ({
  default: { get: mockApiGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  apiClient: { get: mockApiGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

vi.mock('../../lib/apiServices', () => ({
  paymentsAPI: {
    getCreditBalance: mockGetCreditBalance,
    getSubscriptionStatus: mockGetSubscriptionStatus,
  },
}))

vi.mock('../../services/investment.service', () => ({
  InvestmentService: {
    getCreatorFunding: mockGetCreatorFunding,
  },
}))

vi.mock('../../contexts/WebSocketContext', () => ({
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

vi.mock('../../components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

vi.mock('../../components/NDANotifications', () => ({
  NDANotificationBadge: () => <div data-testid="nda-badge" />,
  NDANotificationPanel: () => <div data-testid="nda-panel" />,
}))

vi.mock('../../components/NDA/NDADashboardIntegration', () => ({
  QuickNDAStatus: () => <div data-testid="quick-nda" />,
}))

vi.mock('../../components/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

vi.mock('../../components/Investment/FundingOverview', () => ({
  default: ({ metrics }: any) => <div data-testid="funding-overview">{metrics?.totalFunding}</div>,
}))

vi.mock('../../components/Analytics/EnhancedCreatorAnalytics', () => ({
  EnhancedCreatorAnalytics: () => <div data-testid="enhanced-analytics" />,
}))

vi.mock('../../config/subscription-plans', () => ({
  getSubscriptionTier: () => ({ name: 'The Watcher', credits: 0 }),
  SUBSCRIPTION_TIERS: [],
}))

vi.mock('../../utils/formatters', () => ({
  formatCurrency: (v: number) => `$${v}`,
  formatNumber: (v: any) => String(v ?? 0),
  formatPercentage: (v: number) => `${v}%`,
}))

vi.mock('../../utils/defensive', () => ({
  validateCreatorStats: (v: any) => ({
    total_pitches: v?.total_pitches ?? 0,
    active_pitches: v?.active_pitches ?? 0,
    views_count: v?.views_count ?? 0,
    interest_count: v?.interest_count ?? 0,
    funding_received: v?.funding_received ?? 0,
    success_rate: v?.success_rate ?? 0,
    average_rating: v?.average_rating ?? 0,
  }),
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
  safeReduce: (arr: any[], fn: any, init: any) => (arr || []).reduce(fn, init),
  safeExecute: (fn: any, fallback: any, onError?: any) => {
    try { return fn() } catch (e) { if (onError) onError(e); return fallback }
  },
}))

// Mock dashboard response
const mockDashboardResponse = (overrides: Record<string, any> = {}) => ({
  success: true,
  data: {
    overview: {
      totalPitches: 5,
      totalViews: 150,
      totalFollowers: 10,
      totalInvestments: 3,
      activeDeals: 3,
      pendingActions: 2,
    },
    revenue: {
      totalRevenue: 10000,
    },
    recentPitches: [
      { id: 1, title: 'Pitch A', status: 'published', views: 100, likes: 10, ndaRequests: 1, rating: 4.5 },
      { id: 2, title: 'Pitch B', status: 'draft', views: 50, likes: 5, ndaRequests: 1, rating: 3.5 },
    ],
    recentActivity: {
      investments: [],
      ndaRequests: [],
      notifications: [
        { id: 1, title: 'New view on Pitch A', description: '2 hours ago', color: 'blue', icon: 'eye' },
      ],
    },
    ...overrides,
  },
})

let CreatorDashboard: React.ComponentType
beforeAll(async () => {
  const mod = await import('../CreatorDashboard')
  CreatorDashboard = mod.default
})

function renderDashboard() {
  return render(
    <MemoryRouter>
      <CreatorDashboard />
    </MemoryRouter>
  )
}

describe('CreatorDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/creator/dashboard')) return Promise.resolve(mockDashboardResponse())
      if (url.includes('/api/follows/followers')) return Promise.resolve({ success: true, data: { followers: [{ id: 1 }, { id: 2 }] } })
      if (url.includes('/api/follows/following')) return Promise.resolve({ success: true, data: { following: [{ id: 3 }] } })
      return Promise.resolve({ success: true, data: {} })
    })
    mockGetCreditBalance.mockResolvedValue({ credits: 100 })
    mockGetSubscriptionStatus.mockResolvedValue({ tier: 'watcher', status: 'inactive' })
    mockGetCreatorFunding.mockResolvedValue({
      success: true,
      data: { totalRaised: 25000, fundedPitches: 2, totalInvestors: 3, averageInvestment: 12500, recentInvestments: [] },
    })

    // Ensure localStorage has user data
    const mockStorage: Record<string, string> = {
      user: JSON.stringify({ id: 'user-1', name: 'Test Creator' }),
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => mockStorage[key] ?? null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  // ─── Loading State ──────────────────────────────────────────────────

  describe('Loading State', () => {
    it('shows skeleton loading initially', () => {
      mockCheckSession.mockReturnValue(new Promise(() => {})) // never resolves
      renderDashboard()
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  // ─── Authentication ─────────────────────────────────────────────────

  describe('Authentication', () => {
    it('checks session on mount', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockCheckSession).toHaveBeenCalledTimes(1)
      })
    })

    it('fetches dashboard data after session verified', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/creator/dashboard')
      })
    })

    it('fetches credits and subscription in parallel', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockGetCreditBalance).toHaveBeenCalled()
        expect(mockGetSubscriptionStatus).toHaveBeenCalled()
      })
    })

    it('fetches funding data in parallel', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockGetCreatorFunding).toHaveBeenCalled()
      })
    })

    it('fetches followers and following', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/api/follows/followers'))
        expect(mockApiGet).toHaveBeenCalledWith('/api/follows/following')
      })
    })
  })

  // ─── Dashboard Data Rendering ───────────────────────────────────────

  describe('Dashboard Data Rendering', () => {
    it('displays the dashboard title', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Creator Dashboard')).toBeInTheDocument()
      })
    })

    it('displays welcome message with user name', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Welcome back, Test Creator/i)).toBeInTheDocument()
      })
    })

    it('displays hero KPI cards with API data', async () => {
      renderDashboard()
      await waitFor(() => {
        // Labels and values appear in both hero and KPI sections — use getAllByText
        expect(screen.getAllByText('Active Pitches').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Total Views').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('Pending NDAs')).toBeInTheDocument()
        // Values appear in hero + KPI cards — verify at least one instance
        expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1)   // totalPitches (used for active too)
        expect(screen.getAllByText('150').length).toBeGreaterThanOrEqual(1) // totalViews
        expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1)   // pendingActions
      })
    })

    it('renders pitch cards from API response', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Pitch A')).toBeInTheDocument()
        expect(screen.getByText('Pitch B')).toBeInTheDocument()
      })
    })

    it('renders recent activity from API response', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('New view on Pitch A')).toBeInTheDocument()
      })
    })

    it('renders funding overview component', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('funding-overview')).toBeInTheDocument()
      })
    })

    it('shows empty pitch state when no pitches', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/creator/dashboard')) {
          return Promise.resolve(mockDashboardResponse({ recentPitches: [], overview: { totalPitches: 0, totalViews: 0, totalFollowers: 0, totalInvestments: 0, activeDeals: 0, pendingActions: 0 } }))
        }
        return Promise.resolve({ success: true, data: { followers: [], following: [] } })
      })
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/haven't created any pitches/i)).toBeInTheDocument()
      })
    })
  })

  // ─── Per-Section Error Handling ─────────────────────────────────────

  describe('Per-Section Error Handling', () => {
    it('shows dashboard error when main API fails', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/creator/dashboard')) return Promise.reject(new Error('Server error'))
        return Promise.resolve({ success: true, data: { followers: [], following: [] } })
      })
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Failed to load dashboard data/i)).toBeInTheDocument()
      })
    })

    it('shows retry button when dashboard API fails', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/creator/dashboard')) return Promise.reject(new Error('Server error'))
        return Promise.resolve({ success: true, data: { followers: [], following: [] } })
      })
      renderDashboard()
      await waitFor(() => {
        const retryButtons = screen.getAllByText('Retry')
        expect(retryButtons.length).toBeGreaterThan(0)
      })
    })

    it('tracks API errors with Sentry on dashboard failure', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/creator/dashboard')) return Promise.reject(new Error('API failure'))
        return Promise.resolve({ success: true, data: { followers: [], following: [] } })
      })
      renderDashboard()
      await waitFor(() => {
        expect(mockTrackApiError).toHaveBeenCalledWith(
          '/api/creator/dashboard',
          expect.any(Error)
        )
      })
    })

    it('shows funding error when funding API fails', async () => {
      mockGetCreatorFunding.mockRejectedValue(new Error('Funding unavailable'))
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Funding data unavailable')).toBeInTheDocument()
      })
    })

    it('shows subscription error when subscription API fails', async () => {
      mockGetSubscriptionStatus.mockRejectedValue(new Error('Sub error'))
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Subscription status unavailable')).toBeInTheDocument()
      })
    })

    it('shows follower fallback when followers API fails', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/creator/dashboard')) return Promise.resolve(mockDashboardResponse())
        if (url.includes('/api/follows/followers')) return Promise.reject(new Error('fail'))
        if (url.includes('/api/follows/following')) return Promise.resolve({ success: true, data: { following: [] } })
        return Promise.resolve({ success: true, data: {} })
      })
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Followers')).toBeInTheDocument()
      })
    })

    it('reports error to Sentry when funding fails', async () => {
      mockGetCreatorFunding.mockRejectedValue(new Error('Funding error'))
      renderDashboard()
      await waitFor(() => {
        expect(mockReportError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({ context: 'fetchFundingData' })
        )
      })
    })
  })

  // ─── Connectivity Awareness ─────────────────────────────────────────

  describe('Connectivity Awareness', () => {
    it('does NOT show offline banner when online', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Creator Dashboard')).toBeInTheDocument()
      })
      expect(screen.queryByText(/You are offline/i)).not.toBeInTheDocument()
    })

    it('shows offline banner when navigator.onLine is false', async () => {
      Object.defineProperty(navigator, 'onLine', { writable: true, value: false })
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/You are offline/i)).toBeInTheDocument()
      })
    })
  })

  // ─── Quick Actions ──────────────────────────────────────────────────

  describe('Quick Actions', () => {
    it('renders quick action buttons', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Create Pitch')).toBeInTheDocument()
        expect(screen.getByText('Manage Pitches')).toBeInTheDocument()
        expect(screen.getByText('NDAs')).toBeInTheDocument()
        expect(screen.getByText('Messages')).toBeInTheDocument()
        expect(screen.getByText('Analytics')).toBeInTheDocument()
        expect(screen.getByText('Billing')).toBeInTheDocument()
      })
    })

    it('navigates to create pitch on button click', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Create Pitch')).toBeInTheDocument()
      })
      const user = userEvent.setup()
      await user.click(screen.getByText('Create Pitch'))
      expect(mockNavigate).toHaveBeenCalledWith('/creator/pitch/new')
    })

    it('navigates to manage pitches on button click', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Manage Pitches')).toBeInTheDocument()
      })
      const user = userEvent.setup()
      await user.click(screen.getByText('Manage Pitches'))
      expect(mockNavigate).toHaveBeenCalledWith('/creator/pitches')
    })
  })

  // ─── Milestones ─────────────────────────────────────────────────────

  describe('Milestones', () => {
    it('renders Creator Milestones section', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Creator Milestones')).toBeInTheDocument()
      })
    })

    it('shows completed First Pitch milestone when pitches > 0', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('First Pitch')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()
      })
    })
  })
})
