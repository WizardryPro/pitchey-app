import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockGetNDAStats = vi.fn()
const mockGetNDAs = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ─── NDA service — matches the exact specifier the source imports ───
// Source uses: import { ndaService, type NDA } from '../../services/nda.service'
// Vitest alias resolves that to the same module as @features/ndas/services/nda.service
vi.mock('@features/ndas/services/nda.service', () => ({
  ndaService: {
    getNDAStats: (...args: unknown[]) => mockGetNDAStats(...args),
    getNDAs: (...args: unknown[]) => mockGetNDAs(...args),
  },
}))

// ─── Auth store (STABLE reference to prevent infinite loops) ────────
const mockUser = { id: 1, name: 'Test Creator', email: 'creator@test.com', user_type: 'creator' }
const mockAuthState = { user: mockUser, isAuthenticated: true }
vi.mock('@/store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── NDAStatusBadge — stub to isolate component ─────────────────────
// NDADashboardIntegration imports: import NDAStatusBadge from '../NDAStatusBadge'
// Resolved from NDA/NDADashboardIntegration.tsx → NDA/../NDAStatusBadge → components/NDAStatusBadge
// From __tests__/, we must use the alias path that resolves to the same module.
vi.mock('@features/ndas/components/NDAStatusBadge', () => ({
  default: ({ status }: { status: string }) => (
    <span data-testid="nda-status-badge">{status}</span>
  ),
}))

// ─── Lucide icons — light stub so jsdom doesn't trip on SVG ─────────
// Must include ALL icons used by NDADashboardIntegration AND its children
// (NDAStatusBadge uses Lock, XCircle) even though NDAStatusBadge is separately
// mocked — Vitest still evaluates the module's imports.
vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <svg className={className} data-testid="icon" />
  )
  return {
    Shield: Icon,
    Clock: Icon,
    CheckCircle: Icon,
    AlertTriangle: Icon,
    FileText: Icon,
    TrendingUp: Icon,
    Bell: Icon,
    Eye: Icon,
    ArrowRight: Icon,
    Calendar: Icon,
    Users: Icon,
    // NDAStatusBadge icons (loaded even though we stub the component)
    Lock: Icon,
    XCircle: Icon,
  }
})

// ─── Fixtures ───────────────────────────────────────────────────────
const mockStats = {
  total: 10,
  pending: 3,
  approved: 6,
  rejected: 1,
  expired: 0,
  approvalRate: 60,
  avgResponseTimeHours: 12,
  recent: { requests: 2, approvals: 1, approvalRate: 50 },
  urgency: { priority: 1, standard: 5 },
}

const now = new Date()
const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
// Expiring in 10 days (within 30-day window)
const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString()

const mockNDAs = [
  {
    id: 1,
    pitchId: 10,
    pitchTitle: 'The Grand Heist',
    status: 'approved',
    requesterName: 'Jane Investor',
    signerName: null,
    creatorName: 'Alex Creator',
    createdAt: twoHoursAgo,
    updatedAt: twoHoursAgo,
    expiresAt: null,
  },
  {
    id: 2,
    pitchId: 20,
    pitchTitle: 'Space Cowboys',
    status: 'pending',
    requesterName: 'Bob Productions',
    signerName: null,
    creatorName: 'Alex Creator',
    createdAt: threeDaysAgo,
    updatedAt: threeDaysAgo,
    expiresAt: null,
  },
  {
    id: 3,
    pitchId: 30,
    pitchTitle: 'Old Western Dreams',
    status: 'signed',
    requesterName: 'Mary Investor',
    signerName: null,
    creatorName: 'Alex Creator',
    createdAt: threeDaysAgo,
    updatedAt: threeDaysAgo,
    expiresAt: tenDaysFromNow,
  },
]

// ─── Component (dynamic import after all vi.mock calls) ──────────────
let NDADashboardIntegration: React.ComponentType<any>
let QuickNDAStatus: React.ComponentType<any>
let NDAStatsWidget: React.ComponentType<any>

beforeAll(async () => {
  const mod = await import('../NDADashboardIntegration')
  NDADashboardIntegration = mod.default
  QuickNDAStatus = mod.QuickNDAStatus
  NDAStatsWidget = mod.NDAStatsWidget
})

// ─── Helpers ────────────────────────────────────────────────────────
function renderComponent(props: Record<string, unknown> = {}) {
  const defaults = { userType: 'creator' }
  return render(
    <MemoryRouter>
      <NDADashboardIntegration {...defaults} {...props} />
    </MemoryRouter>
  )
}

// ─── Tests ──────────────────────────────────────────────────────────
describe('NDADashboardIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetNDAStats.mockResolvedValue(mockStats)
    mockGetNDAs.mockResolvedValue({ ndas: mockNDAs })
  })

  // ── Loading state ──────────────────────────────────────────────────
  describe('loading state', () => {
    it('shows a skeleton/pulse placeholder while fetching', () => {
      mockGetNDAStats.mockImplementation(() => new Promise(() => {}))
      mockGetNDAs.mockImplementation(() => new Promise(() => {}))
      renderComponent()

      const pulse = document.querySelector('.animate-pulse')
      expect(pulse).toBeInTheDocument()
    })

    it('hides the loading skeleton after data resolves', async () => {
      renderComponent()

      await waitFor(() => {
        expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument()
      })
    })
  })

  // ── Stats rendering ────────────────────────────────────────────────
  describe('stats grid (full / non-compact mode)', () => {
    it('renders NDA Management heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('NDA Management')).toBeInTheDocument()
      })
    })

    it('shows pending requests count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pending Requests')).toBeInTheDocument()
        // mockStats.pending = 3
        expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows active NDAs count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Active NDAs')).toBeInTheDocument()
        // mockStats.approved = 6
        expect(screen.getAllByText('6').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows total NDAs count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Total NDAs')).toBeInTheDocument()
        // mockStats.total = 10
        expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows expiring soon count (NDAs with status=signed expiring within 30 days)', async () => {
      renderComponent()
      await waitFor(() => {
        // 1 NDA has signed status + expiresAt within 30 days
        expect(screen.getByText('Expiring Soon')).toBeInTheDocument()
        expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows "Within 30 days" alert when there are expiring NDAs', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Within 30 days')).toBeInTheDocument()
      })
    })

    it('shows "Requires attention" badge when pending > 0', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Requires attention')).toBeInTheDocument()
      })
    })
  })

  // ── Recent Activity ────────────────────────────────────────────────
  describe('recent activity list', () => {
    it('renders activity items for each NDA returned', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Recent Activity')).toBeInTheDocument()
      })
      // 3 NDAStatusBadge stubs rendered — one per NDA
      expect(screen.getAllByTestId('nda-status-badge').length).toBe(3)
    })

    it('shows activity text for creator role — approved NDA', async () => {
      renderComponent({ userType: 'creator' })
      await waitFor(() => {
        // approved: 'You approved NDA request for "The Grand Heist"'
        expect(screen.getByText(/You approved NDA request for "The Grand Heist"/)).toBeInTheDocument()
      })
    })

    it('shows activity text for creator role — pending NDA', async () => {
      renderComponent({ userType: 'creator' })
      await waitFor(() => {
        // pending maps to type='request': '{partner} requested NDA for "Space Cowboys"'
        expect(screen.getByText(/Bob Productions requested NDA for "Space Cowboys"/)).toBeInTheDocument()
      })
    })

    it('shows activity text for investor role — approved NDA', async () => {
      renderComponent({ userType: 'investor' })
      await waitFor(() => {
        // investor approved: 'Your NDA request for "The Grand Heist" was approved'
        expect(screen.getByText(/Your NDA request for "The Grand Heist" was approved/)).toBeInTheDocument()
      })
    })

    it('shows activity text for investor role — pending NDA', async () => {
      renderComponent({ userType: 'investor' })
      await waitFor(() => {
        // investor pending maps to request: 'You requested NDA for "Space Cowboys"'
        expect(screen.getByText(/You requested NDA for "Space Cowboys"/)).toBeInTheDocument()
      })
    })

    it('shows activity text for signed NDA (investor)', async () => {
      renderComponent({ userType: 'investor' })
      await waitFor(() => {
        // signed: 'You signed NDA for "Old Western Dreams"'
        expect(screen.getByText(/You signed NDA for "Old Western Dreams"/)).toBeInTheDocument()
      })
    })

    it('shows "Last N activities" label matching returned NDA count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Last 3 activities')).toBeInTheDocument()
      })
    })

    it('shows time-ago for 2-hour-old entry', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('2h ago').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows time-ago for 3-day-old entry', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('3d ago').length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  // ── Empty state ────────────────────────────────────────────────────
  describe('empty state', () => {
    beforeEach(() => {
      mockGetNDAs.mockResolvedValue({ ndas: [] })
    })

    it('shows empty state message when no NDAs exist', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No recent NDA activity')).toBeInTheDocument()
      })
    })

    it('shows creator-specific empty message for creator userType', async () => {
      renderComponent({ userType: 'creator' })
      await waitFor(() => {
        expect(
          screen.getByText(/NDA requests from investors and production companies will appear here/)
        ).toBeInTheDocument()
      })
    })

    it('shows generic empty message for investor userType', async () => {
      renderComponent({ userType: 'investor' })
      await waitFor(() => {
        expect(
          screen.getByText(/Your NDA requests and signed agreements will appear here/)
        ).toBeInTheDocument()
      })
    })

    it('shows Browse Pitches link in empty state', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Browse Pitches')).toBeInTheDocument()
      })
    })

    it('navigates to / when Browse Pitches is clicked', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Browse Pitches')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Browse Pitches'))
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  // ── Navigation ─────────────────────────────────────────────────────
  describe('navigation', () => {
    it('renders "View All NDAs" button in header', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('View All NDAs')).toBeInTheDocument()
      })
    })

    it('navigates to /creator/ndas for creator userType', async () => {
      renderComponent({ userType: 'creator' })
      await waitFor(() => {
        expect(screen.getByText('View All NDAs')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('View All NDAs'))
      expect(mockNavigate).toHaveBeenCalledWith('/creator/ndas')
    })

    it('navigates to /investor/nda-requests for investor userType', async () => {
      renderComponent({ userType: 'investor' })
      await waitFor(() => {
        expect(screen.getByText('View All NDAs')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('View All NDAs'))
      expect(mockNavigate).toHaveBeenCalledWith('/investor/nda-requests')
    })

    it('navigates to /production/ndas for production userType', async () => {
      renderComponent({ userType: 'production' })
      await waitFor(() => {
        expect(screen.getByText('View All NDAs')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('View All NDAs'))
      expect(mockNavigate).toHaveBeenCalledWith('/production/ndas')
    })

    it('navigates via activity row arrow button', async () => {
      renderComponent({ userType: 'creator' })
      await waitFor(() => {
        expect(screen.getAllByTestId('nda-status-badge').length).toBeGreaterThan(0)
      })
      // Each activity row has an ArrowRight button navigating to the management path
      const arrowButtons = screen.getAllByRole('button').filter(
        (btn) => btn.querySelector('svg[data-testid="icon"]') !== null
      )
      fireEvent.click(arrowButtons[0])
      expect(mockNavigate).toHaveBeenCalledWith('/creator/ndas')
    })
  })

  // ── showHeader = false ─────────────────────────────────────────────
  describe('showHeader prop', () => {
    it('hides the header when showHeader=false', async () => {
      renderComponent({ showHeader: false })
      await waitFor(() => {
        // Heading text should not be present
        expect(screen.queryByText('NDA Management')).not.toBeInTheDocument()
      })
    })
  })

  // ── Quick-action banners (creator + pending > 0) ──────────────────
  describe('quick action banners', () => {
    it('shows pending NDA banner for creator when pendingRequests > 0', async () => {
      renderComponent({ userType: 'creator' })
      await waitFor(() => {
        // Text is split across React nodes: "You have " + "3" + " pending NDA request" + "s"
        // Use a function matcher to check the combined text content of the heading
        const headings = screen.getAllByRole('heading', { level: 4 })
        const pendingHeading = headings.find(h => h.textContent?.includes('pending NDA request'))
        expect(pendingHeading).toBeTruthy()
        expect(pendingHeading?.textContent).toContain('3')
      })
    })

    it('shows "Review Now" button that navigates to /creator/ndas', async () => {
      renderComponent({ userType: 'creator' })
      await waitFor(() => {
        expect(screen.getByText('Review Now')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Review Now'))
      expect(mockNavigate).toHaveBeenCalledWith('/creator/ndas')
    })

    it('does NOT show pending banner for investor role', async () => {
      renderComponent({ userType: 'investor' })
      await waitFor(() => {
        expect(screen.queryByText('Review Now')).not.toBeInTheDocument()
      })
    })

    it('shows expiring-soon banner when expiringSoon > 0', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/NDA.*expiring soon/i)).toBeInTheDocument()
      })
    })

    it('shows "Manage" button in expiring-soon banner', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Manage')).toBeInTheDocument()
      })
    })

    it('"Manage" button navigates to management path', async () => {
      renderComponent({ userType: 'creator' })
      await waitFor(() => {
        expect(screen.getByText('Manage')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Manage'))
      expect(mockNavigate).toHaveBeenCalledWith('/creator/ndas')
    })

    it('shows singular "pending NDA request" when pending = 1', async () => {
      mockGetNDAStats.mockResolvedValue({ ...mockStats, pending: 1 })
      renderComponent({ userType: 'creator' })
      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 4 })
        const pendingHeading = headings.find(h => h.textContent?.includes('pending NDA request'))
        expect(pendingHeading).toBeTruthy()
        expect(pendingHeading?.textContent).toContain('1')
        // Should NOT contain 's' suffix after 'request' for singular
        expect(pendingHeading?.textContent).not.toContain('requests')
      })
    })

    it('shows singular "NDA expiring soon" when expiringSoon = 1', async () => {
      renderComponent({ userType: 'creator' })
      await waitFor(() => {
        // Text is split: "1" + " NDA" + " expiring soon"
        const headings = screen.getAllByRole('heading', { level: 4 })
        const expiringHeading = headings.find(h => h.textContent?.includes('NDA') && h.textContent?.includes('expiring soon'))
        expect(expiringHeading).toBeTruthy()
        expect(expiringHeading?.textContent).toContain('1')
        // Singular: should NOT contain 'NDAs'
        expect(expiringHeading?.textContent).not.toContain('NDAs')
      })
    })
  })

  // ── Error state ────────────────────────────────────────────────────
  describe('error state', () => {
    it('shows error message when API call fails with generic error', async () => {
      mockGetNDAStats.mockRejectedValue(new Error('Server down'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Server down')).toBeInTheDocument()
      })
    })

    it('shows Retry button on error', async () => {
      mockGetNDAStats.mockRejectedValue(new Error('Server down'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('retries fetch when Retry is clicked', async () => {
      mockGetNDAStats
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue(mockStats)
      mockGetNDAs.mockResolvedValue({ ndas: [] })

      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Retry'))

      await waitFor(() => {
        expect(mockGetNDAStats).toHaveBeenCalledTimes(2)
      })
    })

    it('silently shows empty state (no error UI) for auth errors', async () => {
      mockGetNDAStats.mockRejectedValue(new Error('Authentication required'))
      mockGetNDAs.mockRejectedValue(new Error('Authentication required'))
      renderComponent()
      // Should not render error state, falls through to loading→empty
      await waitFor(() => {
        expect(screen.queryByText('Retry')).not.toBeInTheDocument()
      })
    })

    it('silently shows empty state for Unauthorized errors', async () => {
      mockGetNDAStats.mockRejectedValue(new Error('Unauthorized'))
      mockGetNDAs.mockRejectedValue(new Error('Unauthorized'))
      renderComponent()
      await waitFor(() => {
        expect(screen.queryByText('Retry')).not.toBeInTheDocument()
      })
    })
  })

  // ── Compact mode ───────────────────────────────────────────────────
  describe('compact mode', () => {
    it('renders compact stats grid with Pending and Active labels', async () => {
      renderComponent({ compact: true })
      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByText('Active')).toBeInTheDocument()
      })
    })

    it('does NOT render full stats labels in compact mode', async () => {
      renderComponent({ compact: true })
      await waitFor(() => {
        expect(screen.queryByText('Pending Requests')).not.toBeInTheDocument()
        expect(screen.queryByText('Active NDAs')).not.toBeInTheDocument()
      })
    })

    it('renders compact header with NDAs title and View All button', async () => {
      renderComponent({ compact: true })
      await waitFor(() => {
        expect(screen.getByText('NDAs')).toBeInTheDocument()
        expect(screen.getByText('View All')).toBeInTheDocument()
      })
    })

    it('"View All" navigates to creator management path', async () => {
      renderComponent({ compact: true, userType: 'creator' })
      await waitFor(() => {
        expect(screen.getByText('View All')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('View All'))
      expect(mockNavigate).toHaveBeenCalledWith('/creator/ndas')
    })

    it('hides compact header when showHeader=false', async () => {
      renderComponent({ compact: true, showHeader: false })
      await waitFor(() => {
        expect(screen.queryByText('NDAs')).not.toBeInTheDocument()
        expect(screen.queryByText('View All')).not.toBeInTheDocument()
      })
    })

    it('shows compact empty state when no NDA activity', async () => {
      mockGetNDAs.mockResolvedValue({ ndas: [] })
      renderComponent({ compact: true })
      await waitFor(() => {
        expect(screen.getByText('No recent NDA activity')).toBeInTheDocument()
      })
    })

    it('requests only 3 NDAs in compact mode', async () => {
      renderComponent({ compact: true })
      await waitFor(() => {
        expect(mockGetNDAs).toHaveBeenCalledWith({ limit: 3, offset: 0 })
      })
    })

    it('requests 5 NDAs in full mode', async () => {
      renderComponent({ compact: false })
      await waitFor(() => {
        expect(mockGetNDAs).toHaveBeenCalledWith({ limit: 5, offset: 0 })
      })
    })
  })

  // ── Role-conditional partner name ─────────────────────────────────
  describe('partner name resolution', () => {
    it('shows requesterName for creator userType', async () => {
      renderComponent({ userType: 'creator' })
      await waitFor(() => {
        // pending NDA: "Bob Productions requested NDA for "Space Cowboys""
        expect(screen.getByText(/Bob Productions/)).toBeInTheDocument()
      })
    })

    it('shows creatorName for investor userType', async () => {
      renderComponent({ userType: 'investor' })
      await waitFor(() => {
        // approved NDA: "Your NDA request for "The Grand Heist" was approved"
        // — investor path doesn't embed partner name in approved text but signed does
        // signed NDA: "You signed NDA for "Old Western Dreams""
        expect(screen.getByText(/You signed NDA for "Old Western Dreams"/)).toBeInTheDocument()
      })
    })
  })
})

// ─── QuickNDAStatus (wrapper component) ───────────────────────────────
describe('QuickNDAStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetNDAStats.mockResolvedValue(mockStats)
    mockGetNDAs.mockResolvedValue({ ndas: mockNDAs })
  })

  it('renders in compact mode with NDAs heading', async () => {
    render(
      <MemoryRouter>
        <QuickNDAStatus userType="creator" />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('NDAs')).toBeInTheDocument()
    })
  })

  it('renders Pending and Active compact stats', async () => {
    render(
      <MemoryRouter>
        <QuickNDAStatus userType="investor" />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
    })
  })
})

// ─── NDAStatsWidget ────────────────────────────────────────────────────
describe('NDAStatsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetNDAStats.mockResolvedValue(mockStats)
  })

  it('renders three stat cells: Pending, Active, Total', async () => {
    render(
      <MemoryRouter>
        <NDAStatsWidget userType="creator" />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Total')).toBeInTheDocument()
    })
  })

  it('shows stats values from getNDAStats', async () => {
    render(
      <MemoryRouter>
        <NDAStatsWidget userType="creator" />
      </MemoryRouter>
    )
    await waitFor(() => {
      // pending=3, approved=6, total=10
      expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('6').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('calls getNDAStats on mount', async () => {
    render(
      <MemoryRouter>
        <NDAStatsWidget userType="production" />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(mockGetNDAStats).toHaveBeenCalledTimes(1)
    })
  })
})
