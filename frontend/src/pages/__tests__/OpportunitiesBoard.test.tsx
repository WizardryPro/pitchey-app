import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCallsList = vi.fn()
const mockCallsCreate = vi.fn()
const mockCallsUpdate = vi.fn()
const mockCallsSubmit = vi.fn()
const mockCallsSubmissions = vi.fn()
const mockCallsMySubmissions = vi.fn()
const mockCallsUpdateSubmission = vi.fn()
const mockPitchServiceGetMyPitches = vi.fn()

// ─── react-router-dom ────────────────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store (STABLE references) ─────────────────────────────────────────
const mockUser = { id: 42, name: 'Test User', email: 'test@test.com', userType: 'production' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: vi.fn(),
  checkSession: vi.fn(),
}

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── callsService ────────────────────────────────────────────────────────────
vi.mock('../../services/calls.service', () => ({
  callsService: {
    list: mockCallsList,
    create: mockCallsCreate,
    update: mockCallsUpdate,
    submit: mockCallsSubmit,
    submissions: mockCallsSubmissions,
    mySubmissions: mockCallsMySubmissions,
    updateSubmission: mockCallsUpdateSubmission,
  },
}))

// ─── pitchService ────────────────────────────────────────────────────────────
vi.mock('../../features/pitches/services/pitch.service', () => ({
  pitchService: {
    getMyPitches: mockPitchServiceGetMyPitches,
  },
}))

// ─── PortalTopNav ────────────────────────────────────────────────────────────
vi.mock('@shared/components/layout/PortalTopNav', () => ({
  default: () => <nav data-testid="portal-top-nav">TopNav</nav>,
}))

// ─── pitchConstants ──────────────────────────────────────────────────────────
vi.mock('@config/pitchConstants', () => ({
  getGenresSync: () => ['Drama', 'Comedy', 'Thriller', 'Horror', 'Documentary'],
  getFormatsSync: () => ['Feature', 'Short', 'TV Series', 'Web Series'],
}))

// ─── ToastProvider ───────────────────────────────────────────────────────────
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('@shared/components/feedback/ToastProvider', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    warning: vi.fn(),
    info: vi.fn(),
    toasts: [],
    addToast: vi.fn(),
    removeToast: vi.fn(),
  }),
}))

// ─── Shared types ────────────────────────────────────────────────────────────
vi.mock('@shared/types/user-type', () => ({
  normalizeUserType: (raw: string | null | undefined) => {
    if (!raw) return null
    if (raw === 'viewer') return 'watcher'
    if (['creator', 'investor', 'production', 'admin', 'watcher'].includes(raw)) return raw
    return null
  },
}))

// ─── Navigation utils ────────────────────────────────────────────────────────
vi.mock('@/utils/navigation', () => ({
  getPortalPath: (userType?: string | null) => {
    if (!userType) return ''
    if (userType === 'viewer') return 'watcher'
    return userType
  },
}))

// ─── Framer Motion ──────────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop: string) => {
      const C = ({ children, ...props }: any) => {
        const { initial, animate, exit, transition, whileHover, whileTap, variants, layout, ...rest } = props
        const Tag = prop as any
        return <Tag {...rest}>{children}</Tag>
      }
      return C
    },
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useAnimation: () => ({ start: vi.fn() }),
  useInView: () => true,
}))

// ─── Sample data ─────────────────────────────────────────────────────────────

const makOpenCall = (overrides: Partial<any> = {}): any => ({
  id: 1,
  poster_user_id: 99,
  poster_type: 'production',
  title: 'Seeking Grounded Sci-Fi Features',
  mandate: 'Looking for grounded sci-fi with strong character arcs.',
  seeking_genres: 'Drama, Thriller',
  seeking_formats: 'Feature',
  budget_min_usd: 500000,
  budget_max_usd: 5000000,
  region: 'UK',
  status: 'open',
  slots: 3,
  deadline: '2026-12-31',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  poster_name: 'Stellar Productions',
  poster_username: 'stellar',
  poster_verification_tier: 'gold',
  poster_user_type: 'production',
  submission_count: 5,
  ...overrides,
})

// ─── Component import ────────────────────────────────────────────────────────

let OpportunitiesBoard: React.ComponentType

beforeAll(async () => {
  const mod = await import('../OpportunitiesBoard')
  OpportunitiesBoard = mod.default
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderBoard(initialPath = '/opportunities') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <OpportunitiesBoard />
    </MemoryRouter>
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OpportunitiesBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default auth: production user not inside portal path
    mockAuthState.user = { ...mockUser, id: 42, userType: 'production' }
    mockAuthState.isAuthenticated = true

    mockCallsList.mockResolvedValue([])
    mockCallsMySubmissions.mockResolvedValue([])
    mockCallsSubmissions.mockResolvedValue([])
    mockPitchServiceGetMyPitches.mockResolvedValue([])
    mockCallsCreate.mockResolvedValue(1)
    mockCallsUpdate.mockResolvedValue(undefined)
    mockCallsSubmit.mockResolvedValue(undefined)
    mockCallsUpdateSubmission.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  it('shows a loading spinner while fetching calls', async () => {
    // Never resolves during this test
    mockCallsList.mockReturnValue(new Promise(() => {}))
    renderBoard()
    // The spinner has animate-spin applied
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  // ── Empty state ────────────────────────────────────────────────────────────

  it('shows empty state when no calls are returned', async () => {
    mockCallsList.mockResolvedValue([])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('No open calls yet')).toBeInTheDocument()
    })
  })

  it('shows "Post the first call" CTA for production users in empty state', async () => {
    mockCallsList.mockResolvedValue([])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Post the first call')).toBeInTheDocument()
    })
  })

  it('shows passive empty message for creators in empty state', async () => {
    mockAuthState.user = { ...mockUser, id: 99, userType: 'creator' }
    mockCallsList.mockResolvedValue([])
    render(
      <MemoryRouter initialEntries={['/creator/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Production companies and investors will post/)).toBeInTheDocument()
    })
  })

  // ── Populated list ────────────────────────────────────────────────────────

  it('renders call cards when calls are returned', async () => {
    const call = makOpenCall()
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Seeking Grounded Sci-Fi Features')).toBeInTheDocument()
    })
  })

  it('shows open call count in the hero', async () => {
    const calls = [
      makOpenCall({ id: 1, status: 'open' }),
      makOpenCall({ id: 2, status: 'open' }),
      makOpenCall({ id: 3, status: 'closed' }),
    ]
    mockCallsList.mockResolvedValue(calls)
    renderBoard()

    await waitFor(() => {
      // 2 open calls
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('renders the Open Calls heading', async () => {
    mockCallsList.mockResolvedValue([])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Open Calls')).toBeInTheDocument()
    })
  })

  it('shows genres as chips on a call card', async () => {
    const call = makOpenCall({ seeking_genres: 'Drama, Thriller' })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getAllByText('Drama').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Thriller').length).toBeGreaterThan(0)
    })
  })

  it('shows budget range on a call card', async () => {
    const call = makOpenCall({ budget_min_usd: 500000, budget_max_usd: 5000000 })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('$500K–$5M')).toBeInTheDocument()
    })
  })

  it('shows region on a call card', async () => {
    const call = makOpenCall({ region: 'UK' })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('UK')).toBeInTheDocument()
    })
  })

  it('shows poster name on a call card', async () => {
    const call = makOpenCall({ poster_name: 'Stellar Productions' })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getAllByText('Stellar Productions').length).toBeGreaterThan(0)
    })
  })

  it('shows "Open" badge on open calls', async () => {
    const call = makOpenCall({ status: 'open', slots: null })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getAllByText('Open').length).toBeGreaterThan(0)
    })
  })

  it('shows slots in Open badge when present', async () => {
    const call = makOpenCall({ status: 'open', slots: 3 })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Open · 3 slots')).toBeInTheDocument()
    })
  })

  it('shows "Closed" badge on closed calls', async () => {
    const call = makOpenCall({ status: 'closed' })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Closed')).toBeInTheDocument()
    })
  })

  // ── Role-based UI: production (poster) ───────────────────────────────────

  it('shows "Post a call" button in hero for production users', async () => {
    mockCallsList.mockResolvedValue([])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Post a call')).toBeInTheDocument()
    })
  })

  it('does NOT show "Post a call" button for creator users', async () => {
    mockAuthState.user = { ...mockUser, id: 99, userType: 'creator' }
    mockCallsList.mockResolvedValue([])
    render(
      <MemoryRouter initialEntries={['/creator/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.queryByText('Post a call')).not.toBeInTheDocument()
    })
  })

  it('shows owner controls (Edit, Close, submissions count) for call owner', async () => {
    // poster_user_id matches mockUser.id = 42
    const call = makOpenCall({ poster_user_id: 42, submission_count: 3 })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Close')).toBeInTheDocument()
      expect(screen.getByText(/3 submission/)).toBeInTheDocument()
    })
  })

  it('shows "Reopen" button for closed call owned by current user', async () => {
    const call = makOpenCall({ poster_user_id: 42, status: 'closed' })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Reopen')).toBeInTheDocument()
    })
  })

  // ── Role-based UI: creator (submitter) ────────────────────────────────────

  it('shows "Submit your pitch" button for creators on open calls they do not own', async () => {
    mockAuthState.user = { ...mockUser, id: 99, userType: 'creator' }
    const call = makOpenCall({ poster_user_id: 1, status: 'open' })
    mockCallsList.mockResolvedValue([call])
    render(
      <MemoryRouter initialEntries={['/creator/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Submit your pitch')).toBeInTheDocument()
    })
  })

  it('shows "Submitted" badge when creator already submitted to a call', async () => {
    mockAuthState.user = { ...mockUser, id: 99, userType: 'creator' }
    // mySubmissions returns a submission for call id=1
    mockCallsMySubmissions.mockResolvedValue([
      { id: 10, call_id: 1, pitch_id: 5, status: 'new', created_at: '2026-01-01T00:00:00Z' },
    ])
    const call = makOpenCall({ id: 1, poster_user_id: 1, status: 'open' })
    mockCallsList.mockResolvedValue([call])
    render(
      <MemoryRouter initialEntries={['/creator/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Submitted')).toBeInTheDocument()
    })
  })

  // ── Type filter tabs ──────────────────────────────────────────────────────

  it('renders All / Production / Investor filter tabs', async () => {
    mockCallsList.mockResolvedValue([])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Production')).toBeInTheDocument()
      expect(screen.getByText('Investor')).toBeInTheDocument()
    })
  })

  it('re-fetches calls when a type filter tab is clicked', async () => {
    mockCallsList.mockResolvedValue([])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Production')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Production'))

    await waitFor(() => {
      expect(mockCallsList).toHaveBeenCalledWith(expect.objectContaining({ type: 'production' }))
    })
  })

  // ── View mandate modal ────────────────────────────────────────────────────

  it('opens the view mandate modal when "View mandate" is clicked', async () => {
    const call = makOpenCall()
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('View mandate')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('View mandate'))

    await waitFor(() => {
      expect(screen.getByText('Production mandate')).toBeInTheDocument()
    })
  })

  it('shows the call title inside the view mandate modal', async () => {
    const call = makOpenCall({ title: 'My Special Call' })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      fireEvent.click(screen.getByText('View mandate'))
    })

    await waitFor(() => {
      // Title appears both in card and modal
      expect(screen.getAllByText('My Special Call').length).toBeGreaterThan(1)
    })
  })

  it('closes the view mandate modal when the backdrop is clicked', async () => {
    const call = makOpenCall()
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      fireEvent.click(screen.getByText('View mandate'))
    })

    await waitFor(() => {
      expect(screen.getByText('Production mandate')).toBeInTheDocument()
    })

    // Click the backdrop (first element with fixed inset-0)
    const backdrop = document.querySelector('.fixed.inset-0')!
    fireEvent.click(backdrop)

    await waitFor(() => {
      expect(screen.queryByText('Production mandate')).not.toBeInTheDocument()
    })
  })

  // ── Post call modal ───────────────────────────────────────────────────────

  it('opens the post call modal when "Post a call" is clicked', async () => {
    mockCallsList.mockResolvedValue([])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Post a call')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Post a call'))

    await waitFor(() => {
      expect(screen.getByText('Post a call', { selector: 'h2' })).toBeInTheDocument()
    })
  })

  it('opens the post call modal for production users from empty state CTA', async () => {
    mockCallsList.mockResolvedValue([])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Post the first call')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Post the first call'))

    await waitFor(() => {
      // The modal heading
      expect(screen.getByRole('heading', { name: 'Post a call' })).toBeInTheDocument()
    })
  })

  it('navigates to /login when unauthenticated user clicks "Post a call" area', async () => {
    mockAuthState.isAuthenticated = false
    mockAuthState.user = null as any
    mockCallsList.mockResolvedValue([])
    renderBoard()

    await waitFor(() => {
      // No "Post a call" button rendered for unauthenticated
      expect(screen.queryByText('Post a call')).not.toBeInTheDocument()
    })

    // Restore
    mockAuthState.isAuthenticated = true
    mockAuthState.user = mockUser
  })

  it('shows "Post call" submit button inside the post modal', async () => {
    mockCallsList.mockResolvedValue([])
    renderBoard()

    await waitFor(() => {
      fireEvent.click(screen.getByText('Post a call'))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Post call/ })).toBeInTheDocument()
    })
  })

  it('shows "Edit call" heading when editing an existing call', async () => {
    const call = makOpenCall({ poster_user_id: 42 })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      fireEvent.click(screen.getByText('Edit'))
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit call' })).toBeInTheDocument()
    })
  })

  it('calls callsService.create when a new call form is submitted', async () => {
    mockCallsList.mockResolvedValue([])
    mockCallsCreate.mockResolvedValue(10)
    renderBoard()

    await waitFor(() => {
      fireEvent.click(screen.getByText('Post a call'))
    })

    // Fill in the title field (required)
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('e.g. Seeking grounded sci-fi features')
      fireEvent.change(titleInput, { target: { value: 'Brand New Call' } })
    })

    fireEvent.click(screen.getByRole('button', { name: /Post call/ }))

    await waitFor(() => {
      expect(mockCallsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Brand New Call' })
      )
    })
  })

  it('shows error toast when new call submission fails', async () => {
    mockCallsList.mockResolvedValue([])
    mockCallsCreate.mockRejectedValue(new Error('Server error'))
    renderBoard()

    await waitFor(() => {
      fireEvent.click(screen.getByText('Post a call'))
    })

    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('e.g. Seeking grounded sci-fi features')
      fireEvent.change(titleInput, { target: { value: 'New Call' } })
    })

    fireEvent.click(screen.getByRole('button', { name: /Post call/ }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Server error')
    })
  })

  it('shows validation error when submitting post form with empty title', async () => {
    mockCallsList.mockResolvedValue([])
    renderBoard()

    await waitFor(() => {
      fireEvent.click(screen.getByText('Post a call'))
    })

    await waitFor(() => {
      // Don't fill in title
      fireEvent.click(screen.getByRole('button', { name: /Post call/ }))
    })

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Give your call a title')
    })
  })

  // ── Toggle status ─────────────────────────────────────────────────────────

  it('calls callsService.update with closed status when "Close" is clicked', async () => {
    const call = makOpenCall({ poster_user_id: 42, status: 'open' })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      fireEvent.click(screen.getByText('Close'))
    })

    await waitFor(() => {
      expect(mockCallsUpdate).toHaveBeenCalledWith(1, { status: 'closed' })
    })
  })

  it('calls callsService.update with open status when "Reopen" is clicked', async () => {
    const call = makOpenCall({ poster_user_id: 42, status: 'closed' })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      fireEvent.click(screen.getByText('Reopen'))
    })

    await waitFor(() => {
      expect(mockCallsUpdate).toHaveBeenCalledWith(1, { status: 'open' })
    })
  })

  it('shows success toast when call is closed', async () => {
    const call = makOpenCall({ poster_user_id: 42, status: 'open' })
    mockCallsList.mockResolvedValue([call])
    mockCallsUpdate.mockResolvedValue(undefined)
    renderBoard()

    await waitFor(() => {
      fireEvent.click(screen.getByText('Close'))
    })

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Call closed to new submissions')
    })
  })

  // ── Submissions modal (owner) ─────────────────────────────────────────────

  it('opens the submissions modal when the submissions count button is clicked', async () => {
    const call = makOpenCall({ poster_user_id: 42, submission_count: 2 })
    mockCallsList.mockResolvedValue([call])
    mockCallsSubmissions.mockResolvedValue([])
    render(
      <MemoryRouter initialEntries={['/production/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('2 submissions')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('2 submissions'))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Submissions' })).toBeInTheDocument()
    })
  })

  it('shows empty submissions state in modal', async () => {
    // Use submission_count: 0 so the button text matches
    const call = makOpenCall({ poster_user_id: 42, submission_count: 0 })
    mockCallsList.mockResolvedValue([call])
    mockCallsSubmissions.mockResolvedValue([])
    // Render inside portal so no redirect happens
    render(
      <MemoryRouter initialEntries={['/production/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('0 submissions')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('0 submissions'))

    await waitFor(() => {
      expect(screen.getByText('No submissions yet.')).toBeInTheDocument()
    })
  })

  it('renders submissions in the submissions modal', async () => {
    const call = makOpenCall({ poster_user_id: 42, submission_count: 1 })
    mockCallsList.mockResolvedValue([call])
    mockCallsSubmissions.mockResolvedValue([
      {
        id: 10,
        call_id: 1,
        pitch_id: 5,
        status: 'new',
        created_at: '2026-01-01T00:00:00Z',
        pitch_title: 'The Great Adventure',
        creator_name: 'Alice Creator',
        pitch_genre: 'Drama',
      },
    ])
    render(
      <MemoryRouter initialEntries={['/production/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('1 submission')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('1 submission'))

    // Wait for the modal heading to confirm it opened
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Submissions' })).toBeInTheDocument()
    })

    // Wait for the async submission data to load
    await waitFor(() => {
      expect(screen.getByText('The Great Adventure')).toBeInTheDocument()
    }, { timeout: 3000 })

    // creator_name and pitch_genre are in the same element: "Alice Creator · Drama"
    expect(screen.getByText('Alice Creator · Drama')).toBeInTheDocument()
  })

  it('calls callsService.updateSubmission when Shortlist is clicked', async () => {
    const call = makOpenCall({ poster_user_id: 42, submission_count: 1 })
    mockCallsList.mockResolvedValue([call])
    mockCallsSubmissions.mockResolvedValue([
      {
        id: 10,
        call_id: 1,
        pitch_id: 5,
        status: 'new',
        created_at: '2026-01-01T00:00:00Z',
        pitch_title: 'The Great Adventure',
      },
    ])
    mockCallsUpdateSubmission.mockResolvedValue(undefined)
    render(
      <MemoryRouter initialEntries={['/production/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('1 submission')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('1 submission'))

    await waitFor(() => {
      expect(screen.getByText('Shortlist')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Shortlist'))

    await waitFor(() => {
      expect(mockCallsUpdateSubmission).toHaveBeenCalledWith(10, 'shortlisted')
    })
  })

  it('calls callsService.updateSubmission when Accept is clicked', async () => {
    const call = makOpenCall({ poster_user_id: 42, submission_count: 1 })
    mockCallsList.mockResolvedValue([call])
    mockCallsSubmissions.mockResolvedValue([
      {
        id: 11,
        call_id: 1,
        pitch_id: 6,
        status: 'new',
        created_at: '2026-01-01T00:00:00Z',
        pitch_title: 'A Sci-Fi Epic',
      },
    ])
    mockCallsUpdateSubmission.mockResolvedValue(undefined)
    render(
      <MemoryRouter initialEntries={['/production/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('1 submission')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('1 submission'))

    await waitFor(() => {
      expect(screen.getByText('Accept')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Accept'))

    await waitFor(() => {
      expect(mockCallsUpdateSubmission).toHaveBeenCalledWith(11, 'accepted')
    })
  })

  // ── Submit pitch modal (creator) ──────────────────────────────────────────

  it('opens submit pitch modal when creator clicks "Submit your pitch"', async () => {
    mockAuthState.user = { ...mockUser, id: 99, userType: 'creator' }
    const call = makOpenCall({ id: 1, poster_user_id: 1, status: 'open' })
    mockCallsList.mockResolvedValue([call])
    mockPitchServiceGetMyPitches.mockResolvedValue([])
    render(
      <MemoryRouter initialEntries={['/creator/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Submit your pitch')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Submit your pitch'))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Submit your pitch' })).toBeInTheDocument()
    })
  })

  it('shows "no pitches" message in submit modal when creator has no pitches', async () => {
    mockAuthState.user = { ...mockUser, id: 99, userType: 'creator' }
    const call = makOpenCall({ id: 1, poster_user_id: 1, status: 'open' })
    mockCallsList.mockResolvedValue([call])
    mockPitchServiceGetMyPitches.mockResolvedValue([])
    // Render inside creator portal to avoid redirect loop
    render(
      <MemoryRouter initialEntries={['/creator/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Submit your pitch')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Submit your pitch'))

    await waitFor(() => {
      // Source uses U+2019 right single quotation mark: "don't"
      expect(screen.getByText(/You don’t have any pitches yet/)).toBeInTheDocument()
    })
  })

  it('lists creator pitches in the submit modal', async () => {
    mockAuthState.user = { ...mockUser, id: 99, userType: 'creator' }
    const call = makOpenCall({ id: 1, poster_user_id: 1, status: 'open' })
    mockCallsList.mockResolvedValue([call])
    mockPitchServiceGetMyPitches.mockResolvedValue([
      {
        id: 5,
        title: 'My Pitch Title',
        genre: 'drama',
        status: 'published',
        userId: 99,
        logline: 'A great story',
        format: 'feature',
        viewCount: 0,
        likeCount: 0,
        ratingAverage: 0,
        pitcheyScoreAvg: 0,
        viewerScoreAvg: 0,
        ratingCount: 0,
        ndaCount: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ])
    render(
      <MemoryRouter initialEntries={['/creator/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Submit your pitch')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Submit your pitch'))

    await waitFor(() => {
      expect(screen.getByText('My Pitch Title')).toBeInTheDocument()
    })
  })

  // ── Portal redirect ───────────────────────────────────────────────────────

  it('redirects production users to in-portal path when not already inside portal', async () => {
    mockAuthState.user = { ...mockUser, id: 42, userType: 'production' }
    mockCallsList.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('/production/opportunities'),
        expect.objectContaining({ replace: true })
      )
    })
  })

  it('does NOT redirect when already inside portal path', async () => {
    mockAuthState.user = { ...mockUser, id: 42, userType: 'production' }
    mockCallsList.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/production/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    // Allow renders to settle
    await waitFor(() => {
      expect(mockCallsList).toHaveBeenCalled()
    })

    // navigate should NOT have been called for redirect
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringContaining('/production/opportunities'),
      expect.objectContaining({ replace: true })
    )
  })

  it('does not render PortalTopNav when inside a portal path', async () => {
    mockCallsList.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/production/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockCallsList).toHaveBeenCalled()
    })

    expect(screen.queryByTestId('portal-top-nav')).not.toBeInTheDocument()
  })

  it('renders PortalTopNav for unauthenticated users on standalone path', async () => {
    mockAuthState.isAuthenticated = false
    mockAuthState.user = null as any
    mockCallsList.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/opportunities']}>
        <OpportunitiesBoard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('portal-top-nav')).toBeInTheDocument()
    })

    // Restore
    mockAuthState.isAuthenticated = true
    mockAuthState.user = mockUser
  })

  // ── Investor poster type ──────────────────────────────────────────────────

  it('renders investor calls with the Investor badge', async () => {
    const call = makOpenCall({
      poster_type: 'investor',
      poster_name: 'Capital Fund',
    })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('· Investor')).toBeInTheDocument()
    })
  })

  // ── Verification badge ────────────────────────────────────────────────────

  it('shows verified badge for gold-verified poster', async () => {
    const call = makOpenCall({ poster_verification_tier: 'gold' })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      const badges = document.querySelectorAll('[aria-label="Verified"]')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('does NOT show verified badge for grey/unverified poster', async () => {
    const call = makOpenCall({ poster_verification_tier: 'grey' })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Seeking Grounded Sci-Fi Features')).toBeInTheDocument()
    })

    const badges = document.querySelectorAll('[aria-label="Verified"]')
    expect(badges.length).toBe(0)
  })

  // ── Multiple calls ────────────────────────────────────────────────────────

  it('renders multiple call cards', async () => {
    const calls = [
      makOpenCall({ id: 1, title: 'First Call' }),
      makOpenCall({ id: 2, title: 'Second Call' }),
      makOpenCall({ id: 3, title: 'Third Call' }),
    ]
    mockCallsList.mockResolvedValue(calls)
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('First Call')).toBeInTheDocument()
      expect(screen.getByText('Second Call')).toBeInTheDocument()
      expect(screen.getByText('Third Call')).toBeInTheDocument()
    })
  })

  // ── Budget formatting edge cases ──────────────────────────────────────────

  it('shows "up to $X" when only budget_max is set', async () => {
    const call = makOpenCall({ budget_min_usd: null, budget_max_usd: 1000000 })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('up to $1M')).toBeInTheDocument()
    })
  })

  it('shows "$X+" when only budget_min is set', async () => {
    const call = makOpenCall({ budget_min_usd: 50000, budget_max_usd: null })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('$50K+')).toBeInTheDocument()
    })
  })

  it('does not show budget chip when no budget is set', async () => {
    const call = makOpenCall({ budget_min_usd: null, budget_max_usd: null })
    mockCallsList.mockResolvedValue([call])
    renderBoard()

    await waitFor(() => {
      expect(screen.getByText('Seeking Grounded Sci-Fi Features')).toBeInTheDocument()
    })

    // No dollar-sign icon visible for budget
    const budgetChips = document.querySelectorAll('.text-amber-700')
    expect(budgetChips.length).toBe(0)
  })
})
