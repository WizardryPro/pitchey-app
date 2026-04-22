import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()
const mockApiGet = vi.fn()
const mockGetAnalyticsDashboard = vi.fn()
const mockGetCreditBalance = vi.fn()
const mockGetSubscriptionStatus = vi.fn()
const mockGetIncomingRequests = vi.fn()
const mockGetOutgoingRequests = vi.fn()
const mockGetIncomingSignedNDAs = vi.fn()
const mockGetOutgoingSignedNDAs = vi.fn()
const mockGetFollowingPitches = vi.fn()
const mockGetAllPitches = vi.fn()
const mockReportError = vi.fn()
const mockTrackEvent = vi.fn()
const mockTrackApiError = vi.fn()

// ─── Stable user object ─────────────────────────────────────────────
const stableUser = {
  id: 'prod-1',
  name: 'Test Production',
  email: 'production@test.com',
  userType: 'production',
  username: 'testproduction',
  companyName: 'Test Studios',
}

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
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => ({
    user: stableUser,
    isAuthenticated: true,
    logout: mockLogout,
    checkSession: mockCheckSession,
  }),
}))

// ─── Pitch store ────────────────────────────────────────────────────
vi.mock('@features/pitches/store/pitchStore', () => ({
  usePitchStore: () => ({
    getAllPitches: mockGetAllPitches,
    drafts: [],
  }),
}))

// ─── API client ─────────────────────────────────────────────────────
vi.mock('../../lib/api-client', () => ({
  default: { get: mockApiGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  apiClient: { get: mockApiGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  savedPitchesAPI: {
    savePitch: vi.fn(),
    unsavePitch: vi.fn(),
  },
}))

// ─── lib/api ────────────────────────────────────────────────────────
vi.mock('../../lib/api', () => ({
  pitchAPI: {
    like: vi.fn(),
    unlike: vi.fn(),
  },
}))

// ─── apiServices ────────────────────────────────────────────────────
vi.mock('../../lib/apiServices', () => ({
  ndaAPI: {
    getIncomingRequests: mockGetIncomingRequests,
    getOutgoingRequests: mockGetOutgoingRequests,
    getIncomingSignedNDAs: mockGetIncomingSignedNDAs,
    getOutgoingSignedNDAs: mockGetOutgoingSignedNDAs,
    requestNDA: vi.fn(),
    approveRequest: vi.fn(),
  },
  analyticsAPI: {
    getDashboardAnalytics: mockGetAnalyticsDashboard,
  },
  companyAPI: {
    getProfile: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getVerificationStatus: vi.fn().mockResolvedValue({ success: true, status: 'verified' }),
  },
  paymentsAPI: {
    getCreditBalance: mockGetCreditBalance,
    getSubscriptionStatus: mockGetSubscriptionStatus,
  },
  pitchServicesAPI: {
    getFollowingPitches: mockGetFollowingPitches,
  },
}))

// ─── Components ─────────────────────────────────────────────────────
vi.mock('../../components/Dashboard/NotificationWidget', () => ({
  NotificationWidget: () => <div data-testid="notification-widget" />,
}))

vi.mock('@features/notifications/components/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

vi.mock('@features/browse/components/FollowButton', () => ({
  default: () => <button>Follow</button>,
}))

vi.mock('@features/ndas/components/NDAManagementPanel', () => ({
  default: () => <div data-testid="nda-management-panel" />,
}))

vi.mock('../../components/FormatDisplay', () => ({
  default: ({ format }: any) => <span>{format}</span>,
}))

vi.mock('@features/analytics/components/Analytics/EnhancedProductionAnalytics', () => ({
  EnhancedProductionAnalytics: () => <div data-testid="enhanced-production-analytics" />,
}))

vi.mock('../../components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

// ─── Sentry ─────────────────────────────────────────────────────────
vi.mock('@/shared/hooks/useSentryPortal', () => ({
  useSentryPortal: () => ({
    reportError: mockReportError,
    trackEvent: mockTrackEvent,
    trackApiError: mockTrackApiError,
  }),
}))

// ─── WebSocket ──────────────────────────────────────────────────────
vi.mock('@shared/contexts/WebSocketContext', () => ({
  useWebSocket: () => ({
    isConnected: true,
    connectionQuality: { strength: 'good' },
    isReconnecting: false,
  }),
}))

// ─── Config ─────────────────────────────────────────────────────────
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8787',
  config: { apiUrl: 'http://localhost:8787' },
}))

vi.mock('../../config/subscription-plans', () => ({
  getSubscriptionTier: () => ({ name: 'Basic', credits: 0 }),
  SUBSCRIPTION_TIERS: [],
}))

// ─── Defensive utils ────────────────────────────────────────────────
vi.mock('@shared/utils/defensive', () => ({
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

// ─── Component ──────────────────────────────────────────────────────
let ProductionDashboard: React.ComponentType
beforeAll(async () => {
  const mod = await import('../ProductionDashboard')
  ProductionDashboard = mod.default
})

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ProductionDashboard />
    </MemoryRouter>
  )
}

describe('ProductionDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    mockGetAllPitches.mockReturnValue([])
    mockGetAnalyticsDashboard.mockResolvedValue({
      success: true,
      analytics: {
        totalViews: 200,
        totalLikes: 50,
        totalNDAs: 5,
        viewsChange: 10,
        likesChange: 5,
        ndasChange: 2,
        topPitch: null,
        recentActivity: [],
      },
    })
    mockGetCreditBalance.mockResolvedValue({ credits: 50 })
    mockGetSubscriptionStatus.mockResolvedValue({ tier: 'basic', status: 'active' })
    mockGetIncomingRequests.mockResolvedValue({ success: true, requests: [] })
    mockGetOutgoingRequests.mockResolvedValue({ success: true, requests: [] })
    mockGetIncomingSignedNDAs.mockResolvedValue({ success: true, ndas: [] })
    mockGetOutgoingSignedNDAs.mockResolvedValue({ success: true, ndas: [] })
    mockGetFollowingPitches.mockResolvedValue([])
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/analytics/realtime'))
        return Promise.resolve({ success: true, data: { recentActivity: [] } })
      if (url.includes('/api/follows/following'))
        return Promise.resolve({ success: true, data: { following: [] } })
      return Promise.resolve({ success: true, data: {} })
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  // ─── Loading State ──────────────────────────────────────────────
  describe('Loading State', () => {
    it('shows skeleton loading initially', () => {
      mockCheckSession.mockReturnValue(new Promise(() => {}))
      renderDashboard()
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  // ─── Authentication ─────────────────────────────────────────────
  describe('Authentication', () => {
    it('checks session on mount', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockCheckSession).toHaveBeenCalledTimes(1)
      })
    })

    it('fetches analytics data after session verified', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockGetAnalyticsDashboard).toHaveBeenCalled()
      })
    })

    it('fetches credits and subscription in parallel', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockGetCreditBalance).toHaveBeenCalled()
        expect(mockGetSubscriptionStatus).toHaveBeenCalled()
      })
    })

    it('fetches NDA data after session verified', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(mockGetIncomingRequests).toHaveBeenCalled()
        expect(mockGetOutgoingRequests).toHaveBeenCalled()
      })
    })
  })

  // ─── Dashboard Data Rendering ───────────────────────────────────
  describe('Dashboard Data Rendering', () => {
    it('displays the Production Dashboard title', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Welcome back/i)).toBeInTheDocument()
      })
    })

    it('renders tab navigation', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument()
        expect(screen.getByText('Saved Pitches')).toBeInTheDocument()
        expect(screen.getByText('Following')).toBeInTheDocument()
        expect(screen.getByText('NDAs')).toBeInTheDocument()
      })
    })

    it('renders Create New Pitch button', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Create New Pitch')).toBeInTheDocument()
      })
    })

    it('renders Quick Actions section', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      })
    })

    it('renders Browse Marketplace quick action', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Browse Marketplace')).toBeInTheDocument()
      })
    })

    it('renders Advanced Search quick action', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Advanced Search')).toBeInTheDocument()
      })
    })

    it('renders Manage NDAs quick action', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Manage NDAs')).toBeInTheDocument()
      })
    })

    it('renders Recent Activity section', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Recent Activity')).toBeInTheDocument()
      })
    })

    it('renders enhanced production analytics component', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('enhanced-production-analytics')).toBeInTheDocument()
      })
    })

    it('renders notification widget', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByTestId('notification-widget')).toBeInTheDocument()
      })
    })
  })

  // ─── Per-Section Error Handling ─────────────────────────────────
  describe('Per-Section Error Handling', () => {
    it('shows analytics error when analytics API fails', async () => {
      mockGetAnalyticsDashboard.mockRejectedValue(new Error('Analytics unavailable'))
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics data. Please try again.')).toBeInTheDocument()
      })
    })

    it('shows retry button when analytics API fails', async () => {
      mockGetAnalyticsDashboard.mockRejectedValue(new Error('Analytics unavailable'))
      renderDashboard()
      await waitFor(() => {
        const retryButtons = screen.getAllByText('Retry')
        expect(retryButtons.length).toBeGreaterThan(0)
      })
    })

    it('reports error to Sentry when analytics fetch fails', async () => {
      mockGetAnalyticsDashboard.mockRejectedValue(new Error('Analytics error'))
      renderDashboard()
      await waitFor(() => {
        expect(mockReportError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({ context: 'fetchAnalyticsData' })
        )
      })
    })
  })

  // ─── Connectivity Awareness ─────────────────────────────────────
  describe('Connectivity Awareness', () => {
    it('does NOT show offline banner when online', async () => {
      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Welcome back/i)).toBeInTheDocument()
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

  // ─── Navigation ─────────────────────────────────────────────────
  describe('Navigation', () => {
    it('navigates to marketplace when Browse Marketplace clicked', async () => {
      const { getByText } = renderDashboard()
      await waitFor(() => {
        expect(getByText('Browse Marketplace')).toBeInTheDocument()
      })
      getByText('Browse Marketplace').closest('button')?.click()
      expect(mockNavigate).toHaveBeenCalledWith('/marketplace')
    })

    it('navigates to create pitch when Create New Pitch clicked', async () => {
      const { getByText } = renderDashboard()
      await waitFor(() => {
        expect(getByText('Create New Pitch')).toBeInTheDocument()
      })
      getByText('Create New Pitch').closest('button')?.click()
      expect(mockNavigate).toHaveBeenCalledWith('/production/pitch/new')
    })
  })
})
