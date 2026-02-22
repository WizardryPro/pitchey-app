import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()

// ─── investor service mock ──────────────────────────────────────────
const mockGetAllInvestments = vi.fn()

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
    getAllInvestments: mockGetAllInvestments,
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

const mockInvestments = [
  {
    id: 1,
    pitch_id: 10,
    pitch_title: 'The Dark Horizon',
    pitch_genre: 'Thriller',
    creator_name: 'Alice Creator',
    company_name: 'Horizon Films',
    amount: 50000,
    status: 'active',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    current_value: 60000,
    roi_percentage: 20,
    stage: 'production',
    ownership_percentage: 5,
    distribution_received: 0,
    exit_date: null,
  },
  {
    id: 2,
    pitch_id: 20,
    pitch_title: 'Comedy Gold',
    pitch_genre: 'Comedy',
    creator_name: 'Bob Director',
    company_name: 'Gold Productions',
    amount: 30000,
    status: 'completed',
    created_at: '2023-06-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    current_value: 45000,
    roi_percentage: 50,
    stage: 'distribution',
    ownership_percentage: 3,
    distribution_received: 5000,
    exit_date: '2024-01-01T00:00:00Z',
  },
]

let AllInvestments: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/AllInvestments')
  AllInvestments = mod.default
})

describe('AllInvestments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    mockGetAllInvestments.mockResolvedValue({
      success: true,
      data: { investments: mockInvestments },
    })
  })

  it('shows loading spinner initially', async () => {
    // Make the API call hang so we can see the loading state
    mockGetAllInvestments.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <AllInvestments />
      </MemoryRouter>
    )
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders page heading after load', async () => {
    render(
      <MemoryRouter>
        <AllInvestments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('All Investments')).toBeInTheDocument()
    })
  })

  it('renders portfolio summary stat cards', async () => {
    render(
      <MemoryRouter>
        <AllInvestments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Total Invested')).toBeInTheDocument()
      // "Current Value" appears in both stat card and table header
      expect(screen.getAllByText('Current Value').length).toBeGreaterThan(0)
      expect(screen.getByText('Total Returns')).toBeInTheDocument()
      // "Active" appears in both the stat card and the status filter dropdown
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
      expect(screen.getByText('Avg ROI')).toBeInTheDocument()
    })
  })

  it('renders investment rows from API data', async () => {
    render(
      <MemoryRouter>
        <AllInvestments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('The Dark Horizon')).toBeInTheDocument()
      expect(screen.getByText('Comedy Gold')).toBeInTheDocument()
    })
  })

  it('renders filter controls', async () => {
    render(
      <MemoryRouter>
        <AllInvestments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search investments...')).toBeInTheDocument()
      expect(screen.getByText('All Status')).toBeInTheDocument()
      expect(screen.getByText('All Stages')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
    })
  })

  it('renders table column headers', async () => {
    render(
      <MemoryRouter>
        <AllInvestments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Project')).toBeInTheDocument()
      expect(screen.getByText('Investment Details')).toBeInTheDocument()
      // "Current Value" is used in both the stat card label and table header
      expect(screen.getAllByText('Current Value').length).toBeGreaterThan(0)
      expect(screen.getByText('ROI')).toBeInTheDocument()
      // "Status" is used in both the table header and filter dropdown
      expect(screen.getAllByText(/Status/i).length).toBeGreaterThan(0)
    })
  })

  it('shows empty state when no investments returned', async () => {
    mockGetAllInvestments.mockResolvedValue({
      success: true,
      data: { investments: [] },
    })
    render(
      <MemoryRouter>
        <AllInvestments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No investments found')).toBeInTheDocument()
    })
  })

  it('shows empty state when API fails', async () => {
    mockGetAllInvestments.mockRejectedValue(new Error('Network error'))
    render(
      <MemoryRouter>
        <AllInvestments />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No investments found')).toBeInTheDocument()
    })
  })

  it('renders View buttons for investments', async () => {
    render(
      <MemoryRouter>
        <AllInvestments />
      </MemoryRouter>
    )
    await waitFor(() => {
      const viewButtons = screen.getAllByText('View')
      expect(viewButtons.length).toBeGreaterThan(0)
    })
  })
})
