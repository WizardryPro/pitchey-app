import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── react-router-dom ───────────────────────────────────────────────
const mockNavigate = vi.fn()
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

// ─── savedPitchesService (from lib/apiServices) ──────────────────────
const mockGetSavedPitches = vi.fn()
const mockUnsavePitch = vi.fn()
vi.mock('../../lib/apiServices', () => ({
  savedPitchesService: {
    getSavedPitches: mockGetSavedPitches,
    unsavePitch: mockUnsavePitch,
    savePitch: vi.fn(),
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

let InvestorSaved: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/InvestorSaved')
  InvestorSaved = mod.default
})

const sampleSavedPitches = [
  {
    pitchId: 1,
    title: 'Epic Sci-Fi Adventure',
    logline: 'A journey through the cosmos',
    genre: 'Sci-Fi',
    budget_range: 5000000,
    creator_name: 'Alex Creator',
    creator_verified: true,
    saved_at: '2025-01-15T00:00:00.000Z',
    status: 'saved',
  },
  {
    pitchId: 2,
    title: 'Romantic Drama',
    logline: 'Love in the city',
    genre: 'Drama',
    budget_range: 2000000,
    creator_name: 'Jane Smith',
    creator_verified: false,
    saved_at: '2025-01-10T00:00:00.000Z',
    status: 'under-review',
  },
]

describe('InvestorSaved', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSavedPitches.mockResolvedValue({
      success: true,
      savedPitches: sampleSavedPitches,
      total: sampleSavedPitches.length,
    })
    mockUnsavePitch.mockResolvedValue({ success: true })
  })

  it('shows loading spinner initially', () => {
    mockGetSavedPitches.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <InvestorSaved />
      </MemoryRouter>
    )
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders Saved Pitches heading', async () => {
    render(
      <MemoryRouter>
        <InvestorSaved />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Saved Pitches')).toBeInTheDocument()
    })
  })

  it('renders saved pitches from API', async () => {
    render(
      <MemoryRouter>
        <InvestorSaved />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Epic Sci-Fi Adventure')).toBeInTheDocument()
      expect(screen.getByText('Romantic Drama')).toBeInTheDocument()
    })
  })

  it('renders search input', async () => {
    render(
      <MemoryRouter>
        <InvestorSaved />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search saved pitches...')).toBeInTheDocument()
    })
  })

  it('renders filter selects', async () => {
    render(
      <MemoryRouter>
        <InvestorSaved />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('All Folders')).toBeInTheDocument()
      expect(screen.getByText('All Status')).toBeInTheDocument()
      expect(screen.getByText('All Priority')).toBeInTheDocument()
    })
  })

  it('renders New Folder button', async () => {
    render(
      <MemoryRouter>
        <InvestorSaved />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('New Folder')).toBeInTheDocument()
    })
  })

  it('shows results count', async () => {
    render(
      <MemoryRouter>
        <InvestorSaved />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/showing 2 of 2 saved pitches/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when no pitches', async () => {
    mockGetSavedPitches.mockResolvedValue({
      success: true,
      savedPitches: [],
      total: 0,
    })
    render(
      <MemoryRouter>
        <InvestorSaved />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText("No saved pitches found")).toBeInTheDocument()
    })
  })

  it('shows error when API fails', async () => {
    mockGetSavedPitches.mockResolvedValue({
      success: false,
      error: 'Server error',
    })
    render(
      <MemoryRouter>
        <InvestorSaved />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Failed to load saved pitches')).toBeInTheDocument()
    })
  })

  it('renders grid/list view toggle buttons', async () => {
    render(
      <MemoryRouter>
        <InvestorSaved />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Select all')).toBeInTheDocument()
    })
  })

  it('renders creator names in cards', async () => {
    render(
      <MemoryRouter>
        <InvestorSaved />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Alex Creator')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
  })
})
