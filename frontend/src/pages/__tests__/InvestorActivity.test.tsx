import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()

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
  logout: vi.fn(),
  checkSession: vi.fn(),
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── api-client (used by InvestorActivity via apiClient) ────────────
const mockApiClientGet = vi.fn()
vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: mockApiClientGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  default: {
    get: mockApiClientGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

// ─── config ─────────────────────────────────────────────────────────
vi.mock('../../config', () => ({
  config: { API_URL: 'http://localhost:8787' },
  API_URL: 'http://localhost:8787',
  getApiUrl: () => 'http://localhost:8787',
  default: { API_URL: 'http://localhost:8787' },
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

let InvestorActivity: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/InvestorActivity')
  InvestorActivity = mod.default
})

const sampleActivities = [
  {
    id: '1',
    type: 'investment',
    title: 'New Investment Made',
    description: 'Invested in a sci-fi project',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
    isRead: false,
    isImportant: true,
    investment: { amount: 50000, stake: 10 },
  },
  {
    id: '2',
    type: 'pitch_view',
    title: 'Pitch Viewed',
    description: 'Viewed action thriller pitch',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    isRead: true,
    isImportant: false,
    project: { id: 'p1', title: 'Action Thriller', genre: 'Action', budget: 5000000 },
  },
]

describe('InvestorActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiClientGet.mockResolvedValue({
      success: true,
      data: {
        activities: sampleActivities,
        total: sampleActivities.length,
      },
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  it('shows loading spinner initially', () => {
    mockApiClientGet.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    expect(screen.getByText(/loading activity feed/i)).toBeInTheDocument()
  })

  it('renders Activity Feed heading after load', async () => {
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Activity Feed')).toBeInTheDocument()
    })
  })

  it('renders filter controls', async () => {
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument()
    })
    expect(screen.getByText('Activity Type')).toBeInTheDocument()
    expect(screen.getByText('Time Range')).toBeInTheDocument()
  })

  it('renders activities from API', async () => {
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('New Investment Made')).toBeInTheDocument()
      expect(screen.getByText('Pitch Viewed')).toBeInTheDocument()
    })
  })

  it('shows unread count badge', async () => {
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/1 unread activity/i)).toBeInTheDocument()
    })
  })

  it('shows Important badge for important activities', async () => {
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Important')).toBeInTheDocument()
    })
  })

  it('shows Mark All Read button', async () => {
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Mark All Read')).toBeInTheDocument()
    })
  })

  it('shows Refresh button', async () => {
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })

  it('shows empty state when no activities', async () => {
    mockApiClientGet.mockResolvedValue({
      success: true,
      data: { activities: [], total: 0 },
    })
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No activities found')).toBeInTheDocument()
    })
  })

  it('shows error alert on API failure', async () => {
    mockApiClientGet.mockRejectedValue(new Error('Network error'))
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('API Connection Issue')).toBeInTheDocument()
    })
  })

  it('shows project info for pitch_view activities', async () => {
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Action Thriller')).toBeInTheDocument()
    })
  })

  it('shows Mark Read button for unread activities', async () => {
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Mark Read')).toBeInTheDocument()
    })
  })

  it('calls GET /api/investor/activity/feed on mount', async () => {
    render(
      <MemoryRouter>
        <InvestorActivity />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(mockApiClientGet).toHaveBeenCalledWith('/api/investor/activity/feed')
    })
  })
})
