import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import type { ComponentType } from 'react'

// Hoisted mocks
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
const mockWebSocket = {
  isConnected: true,
  connectionQuality: { strength: 'good' as string },
  isReconnecting: false,
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

const mockUser = { id: 1, name: 'Test Creator', email: 'creator@test.com' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: mockCheckSession,
}

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

vi.mock('../../lib/api-client', () => ({
  default: {
    get: mockApiGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
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
  useWebSocket: () => mockWebSocket,
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
  NDANotificationBadge: () => <div data-testid="nda-badge">NDA Badge</div>,
  NDANotificationPanel: () => <div data-testid="nda-panel">NDA Panel</div>,
}))

vi.mock('../../components/NDA/NDADashboardIntegration', () => ({
  QuickNDAStatus: () => <div data-testid="quick-nda-status">NDA Status</div>,
}))

vi.mock('../../components/Investment/FundingOverview', () => ({
  default: ({ metrics }: any) => (
    <div data-testid="funding-overview">
      <span>Total Funding: {metrics?.totalFunding}</span>
    </div>
  ),
}))

vi.mock('../../components/Analytics/EnhancedCreatorAnalytics', () => ({
  EnhancedCreatorAnalytics: () => <div data-testid="creator-analytics">Analytics</div>,
}))

vi.mock('../../components/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Bell</div>,
}))

vi.mock('../../config/subscription-plans', () => ({
  getSubscriptionTier: (tier: string) => ({
    name: tier === 'pro' ? 'The Director' : 'The Watcher',
    credits: tier === 'pro' ? 100 : 0,
  }),
  SUBSCRIPTION_TIERS: {},
}))

vi.mock('../../utils/formatters', () => ({
  formatCurrency: (v: number) => `$${(v || 0).toLocaleString()}`,
  formatNumber: (v: number) => String(v || 0),
  formatPercentage: (v: number) => `${v || 0}%`,
}))

vi.mock('../../utils/defensive', () => ({
  validateCreatorStats: (v: any) => ({
    total_pitches: v?.total_pitches || 0,
    active_pitches: v?.active_pitches || 0,
    views_count: v?.views_count || 0,
    interest_count: v?.interest_count || 0,
    funding_received: v?.funding_received || 0,
    success_rate: v?.success_rate || 0,
    average_rating: v?.average_rating || 0,
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
  safeExecute: (fn: any, def: any) => { try { return fn() } catch { return def } },
}))

let CreatorDashboard: ComponentType

beforeAll(async () => {
  const mod = await import('../../pages/CreatorDashboard')
  CreatorDashboard = mod.default
})

function renderDashboard() {
  return render(
    <MemoryRouter>
      <CreatorDashboard />
    </MemoryRouter>
  )
}

const mockDashboardData = (overrides = {}) => ({
  success: true,
  data: {
    overview: {
      totalPitches: 5,
      totalViews: 250,
      totalFollowers: 10,
      totalInvestments: 3,
      activeDeals: 3,
      pendingActions: 2,
    },
    revenue: {
      totalRevenue: 50000,
    },
    recentPitches: [
      { id: 1, title: 'My First Pitch', status: 'published', views: 120, likes: 15, ndaRequests: 1, rating: 4.5 },
      { id: 2, title: 'Second Pitch', status: 'draft', views: 30, likes: 5, ndaRequests: 0, rating: 3.8 },
    ],
    recentActivity: {
      investments: [
        { id: 1, title: 'New view on My First Pitch', description: 'From investor', icon: 'eye', color: 'blue' },
      ],
      ndaRequests: [
        { id: 2, title: 'NDA request received', description: 'For Second Pitch', icon: 'dollar-sign', color: 'green' },
      ],
      notifications: [],
    },
    ...overrides,
  },
})

describe('CreatorDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)

    // Default successful API responses
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/creator/dashboard')) return Promise.resolve(mockDashboardData())
      if (url.includes('/api/follows/followers')) return Promise.resolve({ success: true, data: { followers: [{ id: 1 }, { id: 2 }] } })
      if (url.includes('/api/follows/following')) return Promise.resolve({ success: true, data: { following: [{ id: 3 }] } })
      return Promise.resolve({ success: true, data: {} })
    })

    mockGetCreditBalance.mockResolvedValue({ credits: 50, monthlyCredits: 100 })
    mockGetSubscriptionStatus.mockResolvedValue({ tier: 'pro', status: 'active' })
    mockGetCreatorFunding.mockResolvedValue({
      success: true,
      data: { totalRaised: 75000, fundedPitches: 3, totalInvestors: 5, averageInvestment: 15000, recentInvestments: [] },
    })

    // Reset WebSocket state
    mockWebSocket.isConnected = true
    mockWebSocket.connectionQuality = { strength: 'good' }
    mockWebSocket.isReconnecting = false
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
  })

  // ─── Dashboard Layout ──────────────────────────────────────────────

  describe('Dashboard Layout', () => {
    it('displays the dashboard title', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Creator Dashboard')).toBeInTheDocument()
      })
    })

    it('displays welcome message with user name', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Welcome back, Test Creator/)).toBeInTheDocument()
      })
    })

    it('displays KPI stat cards', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Total Pitches')).toBeInTheDocument()
        expect(screen.getAllByText('Active Pitches').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Total Views').length).toBeGreaterThan(0)
        expect(screen.getByText('Avg Rating')).toBeInTheDocument()
        expect(screen.getByText('Followers')).toBeInTheDocument()
        expect(screen.getByText('Engagement Rate')).toBeInTheDocument()
      })
    })
  })

  // ─── Quick Actions ─────────────────────────────────────────────────

  describe('Quick Actions', () => {
    it('displays quick action buttons', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument()
        expect(screen.getByText('Create Pitch')).toBeInTheDocument()
        expect(screen.getByText('Manage Pitches')).toBeInTheDocument()
        expect(screen.getByText('NDAs')).toBeInTheDocument()
        expect(screen.getAllByText('Messages').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0)
        expect(screen.getByText('Billing')).toBeInTheDocument()
      })
    })

    it('navigates to create pitch on button click', async () => {
      const u = userEvent.setup()
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Create Pitch')).toBeInTheDocument()
      })

      await u.click(screen.getByText('Create Pitch'))
      expect(mockNavigate).toHaveBeenCalledWith('/creator/pitch/new')
    })

    it('navigates to messages on button click', async () => {
      const u = userEvent.setup()
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText('Messages')).toBeInTheDocument()
      })

      await u.click(screen.getByText('Messages'))
      expect(mockNavigate).toHaveBeenCalledWith('/creator/messages')
    })
  })

  // ─── Pitches Section ───────────────────────────────────────────────

  describe('Pitches Section', () => {
    it('displays My Pitches heading', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('My Pitches')).toBeInTheDocument()
      })
    })

    it('displays pitch cards with titles', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('My First Pitch')).toBeInTheDocument()
        expect(screen.getByText('Second Pitch')).toBeInTheDocument()
      })
    })

    it('shows pitch status badges', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('published')).toBeInTheDocument()
        expect(screen.getByText('draft')).toBeInTheDocument()
      })
    })

    it('shows empty state when no pitches', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/creator/dashboard')) {
          return Promise.resolve(mockDashboardData({ recentPitches: [] }))
        }
        return Promise.resolve({ success: true, data: {} })
      })

      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/haven't created any pitches/)).toBeInTheDocument()
        expect(screen.getByText('Create Your First Pitch')).toBeInTheDocument()
      })
    })

    it('shows View All link', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('View All')).toBeInTheDocument()
      })
    })
  })

  // ─── Recent Activity ───────────────────────────────────────────────

  describe('Recent Activity', () => {
    it('displays Recent Activity heading', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Recent Activity')).toBeInTheDocument()
      })
    })

    it('shows activity items', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('New view on My First Pitch')).toBeInTheDocument()
        expect(screen.getByText('NDA request received')).toBeInTheDocument()
      })
    })

    it('shows empty activity state', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/creator/dashboard')) {
          return Promise.resolve(mockDashboardData({ recentActivity: { investments: [], ndaRequests: [], notifications: [] } }))
        }
        return Promise.resolve({ success: true, data: {} })
      })

      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('No recent activity')).toBeInTheDocument()
      })
    })
  })

  // ─── Creator Milestones ────────────────────────────────────────────

  describe('Creator Milestones', () => {
    it('displays milestone section', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Creator Milestones')).toBeInTheDocument()
      })
    })

    it('shows milestone cards', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('First Pitch')).toBeInTheDocument()
        expect(screen.getByText('100 Views')).toBeInTheDocument()
        expect(screen.getByText('Community Builder')).toBeInTheDocument()
        expect(screen.getByText('Top Rated')).toBeInTheDocument()
      })
    })

    it('shows next goals section', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Your Next Goals')).toBeInTheDocument()
      })
    })
  })

  // ─── Error Handling ────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('shows dashboard error when API fails', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/creator/dashboard')) return Promise.reject(new Error('Network error'))
        return Promise.resolve({ success: true, data: {} })
      })

      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Failed to load dashboard data/i)).toBeInTheDocument()
      })
    })

    it('shows retry button on dashboard error', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/creator/dashboard')) return Promise.reject(new Error('err'))
        return Promise.resolve({ success: true, data: {} })
      })

      renderDashboard()
      await waitFor(() => {
        const retryButtons = screen.getAllByText('Retry')
        expect(retryButtons.length).toBeGreaterThan(0)
      })
    })

    it('shows funding error when funding API fails', async () => {
      mockGetCreatorFunding.mockRejectedValue(new Error('Funding error'))

      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Funding data unavailable')).toBeInTheDocument()
      })
    })

    it('tracks API errors with Sentry', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/api/creator/dashboard')) return Promise.reject(new Error('API failure'))
        return Promise.resolve({ success: true, data: {} })
      })

      renderDashboard()
      await waitFor(() => {
        expect(mockTrackApiError).toHaveBeenCalled()
      })
    })
  })

  // ─── Connectivity ──────────────────────────────────────────────────

  describe('Connectivity', () => {
    it('does not show offline banner when online', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Creator Dashboard')).toBeInTheDocument()
      })
      expect(screen.queryByText(/You are offline/i)).not.toBeInTheDocument()
    })

    it('shows offline banner when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { writable: true, value: false })
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText(/You are offline/i)).toBeInTheDocument()
      })
    })

    it('shows reconnecting banner when reconnecting', async () => {
      mockWebSocket.isReconnecting = true
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText(/Reconnecting to real-time services/i)).toBeInTheDocument()
      })
    })

    it('shows poor connection banner', async () => {
      mockWebSocket.connectionQuality = { strength: 'poor' }
      renderDashboard()

      await waitFor(() => {
        expect(screen.getByText(/Connection quality is poor/i)).toBeInTheDocument()
      })
    })
  })

  // ─── Subscription Section ──────────────────────────────────────────

  describe('Subscription Section', () => {
    it('shows subscription plan name', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Your Plan:/)).toBeInTheDocument()
      })
    })
  })

  // ─── NDA Integration ───────────────────────────────────────────────

  describe('NDA Integration', () => {
    it('renders NDA panel', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('nda-panel')).toBeInTheDocument()
      })
    })

    it('renders Quick NDA Status', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('quick-nda-status')).toBeInTheDocument()
      })
    })
  })

  // ─── Funding Overview ──────────────────────────────────────────────

  describe('Funding Overview', () => {
    it('renders funding overview when data available', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('funding-overview')).toBeInTheDocument()
      })
    })
  })

  // ─── Analytics Section ─────────────────────────────────────────────

  describe('Analytics Section', () => {
    it('renders enhanced analytics component', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('creator-analytics')).toBeInTheDocument()
      })
    })
  })
})
