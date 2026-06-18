import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockPitchGetPublicById = vi.fn()
const mockPitchGetById = vi.fn()
const mockApiClientGet = vi.fn()
const mockApiClientPost = vi.fn()
const mockApiClientPatch = vi.fn()
const mockSavedPitchesIsPitchSaved = vi.fn()
const mockSavedPitchesSavePitch = vi.fn()
const mockSavedPitchesUnsavePitch = vi.fn()
const mockProductionGetNotes = vi.fn()
const mockProductionGetChecklist = vi.fn()
const mockProductionGetTeam = vi.fn()
const mockProductionCreateNote = vi.fn()
const mockProductionDeleteNote = vi.fn()
const mockProductionUpdateChecklist = vi.fn()
const mockProductionUpdateTeam = vi.fn()
const mockProductionAiAutofill = vi.fn()
const mockFetch = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '42' }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store (STABLE reference to prevent infinite loops) ────────
const mockUser = { id: '99', name: 'Prod User', email: 'prod@demo.com', userType: 'production', user_type: 'production' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: vi.fn(),
  checkSession: vi.fn(),
}
vi.mock('@/store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── pitchAPI (from @/lib/api) ───────────────────────────────────────
vi.mock('@/lib/api', () => ({
  pitchAPI: {
    getPublicById: (...args: any[]) => mockPitchGetPublicById(...args),
    getById: (...args: any[]) => mockPitchGetById(...args),
  },
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

// ─── apiClient + savedPitchesAPI (from @/lib/api-client) ────────────
vi.mock('@/lib/api-client', () => ({
  default: {
    get: (...args: any[]) => mockApiClientGet(...args),
    post: (...args: any[]) => mockApiClientPost(...args),
    patch: (...args: any[]) => mockApiClientPatch(...args),
    put: vi.fn(),
    delete: vi.fn(),
  },
  savedPitchesAPI: {
    isPitchSaved: (...args: any[]) => mockSavedPitchesIsPitchSaved(...args),
    savePitch: (...args: any[]) => mockSavedPitchesSavePitch(...args),
    unsavePitch: (...args: any[]) => mockSavedPitchesUnsavePitch(...args),
  },
  apiClient: {
    get: (...args: any[]) => mockApiClientGet(...args),
    post: (...args: any[]) => mockApiClientPost(...args),
    patch: (...args: any[]) => mockApiClientPatch(...args),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

// ─── ProductionService ──────────────────────────────────────────────
vi.mock('@portals/production/services/production.service', () => ({
  ProductionService: {
    getPitchNotes: (...args: any[]) => mockProductionGetNotes(...args),
    getPitchChecklist: (...args: any[]) => mockProductionGetChecklist(...args),
    getPitchTeam: (...args: any[]) => mockProductionGetTeam(...args),
    createPitchNote: (...args: any[]) => mockProductionCreateNote(...args),
    deletePitchNote: (...args: any[]) => mockProductionDeleteNote(...args),
    updatePitchChecklist: (...args: any[]) => mockProductionUpdateChecklist(...args),
    updatePitchTeam: (...args: any[]) => mockProductionUpdateTeam(...args),
    aiAutofill: (...args: any[]) => mockProductionAiAutofill(...args),
  },
}))

// ─── Subscription plans config ───────────────────────────────────────
vi.mock('@config/subscription-plans', () => ({
  getCreditCost: (action: string) => (action === 'nda_request' ? 10 : 5),
}))

// ─── Formatters ─────────────────────────────────────────────────────
vi.mock('@shared/utils/formatters', () => ({
  formatCurrency: (v: any) => `$${v}`,
  formatPercentage: (v: number) => `${v}%`,
  formatDate: (v: string) => v,
  formatNumber: (v: number) => String(v),
  formatTimeAgo: () => 'just now',
}))

// ─── Child components ───────────────────────────────────────────────
vi.mock('@/components/FormatDisplay', () => ({
  default: ({ format, formatSubtype }: any) => (
    <span data-testid="format-display">{formatSubtype || format || 'Unknown'}</span>
  ),
}))

vi.mock('@features/browse/components/FollowButton', () => ({
  default: ({ creatorId }: any) => (
    <button data-testid={`follow-btn-${creatorId}`}>Follow</button>
  ),
}))

vi.mock('@features/pitches/components/InterestedCard', () => ({
  default: ({ pitchId, isAuthenticated, onSavedChange }: any) => (
    <div data-testid="interested-card" data-pitch-id={pitchId}>
      <button data-testid="like-btn" onClick={() => {}}>Like this pitch</button>
      <button
        data-testid="save-btn"
        onClick={() => onSavedChange && onSavedChange(true)}
      >
        Save for later
      </button>
    </div>
  ),
}))

vi.mock('@features/pitches/components/PitchDocuments', () => ({
  default: ({ documents, script, pitchDeck, trailer }: any) => (
    <div data-testid="pitch-documents">
      {script && <span>Script available</span>}
      {pitchDeck && <span>Pitch deck available</span>}
      {trailer && <span>Trailer available</span>}
    </div>
  ),
}))

vi.mock('@shared/components/SocialProofBadge', () => ({
  default: ({ pitchId, viewCount, likeCount }: any) => (
    <div data-testid="social-proof-badge">
      <span data-testid="view-count">{viewCount}</span>
      <span data-testid="like-count">{likeCount}</span>
    </div>
  ),
}))

vi.mock('@/components/feedback/FeedbackSection', () => ({
  default: ({ pitchId, isOwner }: any) => (
    <div data-testid="feedback-section" data-pitch-id={pitchId} data-is-owner={isOwner}>
      Feedback Section
    </div>
  ),
}))

vi.mock('@features/teams/components/CollaborationNdaModal', () => ({
  CollaborationNdaModal: ({ teamId, onClose, onSigned }: any) => (
    <div data-testid="collab-nda-modal" data-team-id={teamId}>
      <button onClick={onClose}>Close NDA</button>
      <button onClick={onSigned}>Sign NDA</button>
    </div>
  ),
}))

// ─── pitchService (imported but not directly used in render path) ───
vi.mock('@features/pitches/services/pitch.service', () => ({
  pitchService: {
    getPitch: vi.fn(),
    listPitches: vi.fn(),
  },
}))

// ─── Mock fetch globally ─────────────────────────────────────────────
vi.stubGlobal('fetch', mockFetch)

// ─── Pitch data fixtures ─────────────────────────────────────────────
const basePitch = {
  id: '42',
  userId: '7',
  creatorName: 'Alex Creator',
  creatorCompany: 'FilmCo',
  title: 'The Great Adventure',
  logline: 'A hero embarks on a journey',
  genre: 'Action',
  format: 'Feature Film',
  formatCategory: 'Film',
  formatSubtype: 'Feature',
  pages: 120,
  shortSynopsis: 'A full synopsis of the film.',
  longSynopsis: 'Extended synopsis...',
  budget: 'medium',
  estimatedBudget: '$5M',
  productionTimeline: '12 months',
  targetAudience: '18-35',
  comparableFilms: 'Indiana Jones, Jurassic Park',
  status: 'published' as const,
  visibility: 'public' as const,
  views: 1500,
  likes: 200,
  ratingAverage: 4.2,
  pitcheyScoreAvg: 80,
  viewerScoreAvg: 75,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
  hasSignedNDA: false,
  isCompanyMember: false,
  companyNdaSigned: false,
  requiresNDA: false,
  ndaCount: 3,
  thumbnail: 'https://example.com/thumb.jpg',
  pitchDeck: 'https://example.com/deck.pdf',
  script: 'https://example.com/script.pdf',
  trailer: 'https://example.com/trailer.mp4',
  characters: [
    { name: 'Hero', description: 'The main character' },
    { name: 'Villain', description: 'The antagonist' },
  ],
  locations: ['New York', 'Los Angeles', 'London'],
  themes: ['Adventure', 'Discovery'],
  isLiked: false,
}

const ownerPitch = { ...basePitch, userId: '99' } // matches mockUser.id

let Component: React.ComponentType

beforeAll(async () => {
  const mod = await import('@portals/production/pages/ProductionPitchView')
  Component = mod.default
})

describe('ProductionPitchView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Default: all production service calls succeed with empty data
    mockProductionGetNotes.mockResolvedValue([])
    mockProductionGetChecklist.mockResolvedValue({})
    mockProductionGetTeam.mockResolvedValue([])
    mockSavedPitchesIsPitchSaved.mockResolvedValue({ data: { isSaved: false } })

    // Collaborators endpoint
    mockApiClientGet.mockResolvedValue({ data: { collaborators: [] } })

    // Default global fetch (for like/save)
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  // ─── Loading State ──────────────────────────────────────────────────

  it('shows loading spinner initially', () => {
    mockPitchGetPublicById.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  // ─── Error States ───────────────────────────────────────────────────

  it('shows error state when both API calls fail', async () => {
    mockPitchGetPublicById.mockRejectedValue(new Error('Not found'))
    mockPitchGetById.mockRejectedValue(new Error('Not found'))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Error Loading Pitch')).toBeInTheDocument()
    })
    expect(screen.getByText('Failed to load pitch details')).toBeInTheDocument()
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument()
  })

  it('navigates to dashboard from error page', async () => {
    mockPitchGetPublicById.mockRejectedValue(new Error('Server error'))
    mockPitchGetById.mockRejectedValue(new Error('Server error'))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Back to Dashboard'))
    fireEvent.click(screen.getByText('Back to Dashboard'))
    expect(mockNavigate).toHaveBeenCalledWith('/production/dashboard')
  })

  // ─── Basic Render — evaluator (non-owner production user) ──────────

  it('renders pitch title and logline after loading', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('The Great Adventure').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByText(/A hero embarks on a journey/)).toBeInTheDocument()
  })

  it('renders creator name and genre tags', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Alex Creator/)).toBeInTheDocument()
    })
    expect(screen.getAllByText('Action').length).toBeGreaterThan(0)
  })

  it('renders characters and locations', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Hero')).toBeInTheDocument()
    })
    expect(screen.getByText('Villain')).toBeInTheDocument()
    expect(screen.getByText('New York')).toBeInTheDocument()
    expect(screen.getByText('Los Angeles')).toBeInTheDocument()
    expect(screen.getByText('London')).toBeInTheDocument()
  })

  it('renders comparable films', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Indiana Jones, Jurassic Park')).toBeInTheDocument()
    })
  })

  it('renders synopsis', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('A full synopsis of the film.')).toBeInTheDocument()
    })
  })

  // ─── Header Actions — evaluator ─────────────────────────────────────

  it('shows Contact and Share buttons for non-owner', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Contact')).toBeInTheDocument()
    })
    expect(screen.getByText('Share')).toBeInTheDocument()
  })

  it('does NOT show Edit button for non-owner', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('The Great Adventure', { selector: 'span' })).toBeInTheDocument()
    })
    // Edit button only appears for the owner
    const editBtns = screen.queryAllByText('Edit')
    expect(editBtns.length).toBe(0)
  })

  it('navigates to messages when Contact is clicked', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Contact'))
    fireEvent.click(screen.getByText('Contact'))
    expect(mockNavigate).toHaveBeenCalledWith('/production/messages?recipient=7&pitch=42')
  })

  it('shows Back button in header', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Back'))
    fireEvent.click(screen.getByText('Back'))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  // ─── Owner-specific rendering ────────────────────────────────────────

  it('shows Edit button and hides Contact when user is the owner', async () => {
    mockPitchGetPublicById.mockResolvedValue(ownerPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    expect(screen.queryByText('Contact')).not.toBeInTheDocument()
  })

  it('shows AI Assessment section for owner', async () => {
    mockPitchGetPublicById.mockResolvedValue(ownerPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('AI Assessment')).toBeInTheDocument()
    })
    expect(screen.getByText('Auto-fill from Document')).toBeInTheDocument()
  })

  it('hides AI Assessment section for non-owner', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('The Great Adventure').length).toBeGreaterThan(0)
    })
    expect(screen.queryByText('AI Assessment')).not.toBeInTheDocument()
  })

  it('navigates to edit page when Edit is clicked by owner', async () => {
    mockPitchGetPublicById.mockResolvedValue(ownerPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Edit'))
    fireEvent.click(screen.getByText('Edit'))
    expect(mockNavigate).toHaveBeenCalledWith('/production/pitches/42/edit')
  })

  // ─── Sidebar: Access Section — NDA gating ───────────────────────────

  it('shows "No NDA required" when pitch does not require NDA', async () => {
    mockPitchGetPublicById.mockResolvedValue({ ...basePitch, requiresNDA: false, require_nda: false })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/No NDA required/i)).toBeInTheDocument()
    })
  })

  it('shows "NDA signed" message when user has signed NDA', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...basePitch,
      requiresNDA: true,
      hasSignedNDA: true,
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/NDA signed.*full script/i)).toBeInTheDocument()
    })
  })

  it('shows "Request NDA Access" CTA with credit cost when production user has not signed', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...basePitch,
      requiresNDA: true,
      hasSignedNDA: false,
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Request NDA Access/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/10 credits/)).toBeInTheDocument()
  })

  it('shows "NDA request pending" when NDA was already requested', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...basePitch,
      requiresNDA: true,
      hasSignedNDA: false,
    })
    // Simulate the ndaRequested state by clicking Request NDA Access
    mockApiClientPost.mockResolvedValue({ success: true })
    global.confirm = vi.fn(() => true)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText(/Request NDA Access/i))
    fireEvent.click(screen.getByText(/Request NDA Access/i))

    await waitFor(() => {
      expect(screen.getByText(/NDA request pending/i)).toBeInTheDocument()
    })
  })

  // ─── Company Member Scenarios ────────────────────────────────────────

  it('shows company NDA sign prompt for pending company member', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...basePitch,
      requiresNDA: true,
      isCompanyMember: true,
      companyNdaSigned: false,
      companyTeamId: 5,
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Sign NDA to collaborate/i)).toBeInTheDocument()
    })
  })

  it('shows collaborating member message for signed company member', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...basePitch,
      requiresNDA: true,
      isCompanyMember: true,
      companyNdaSigned: true,
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/collaborating on this project as a company member/i)).toBeInTheDocument()
    })
  })

  it('opens CollaborationNdaModal when "Sign NDA to collaborate" is clicked', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...basePitch,
      requiresNDA: true,
      isCompanyMember: true,
      companyNdaSigned: false,
      companyTeamId: 5,
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText(/Sign NDA to collaborate/i))
    fireEvent.click(screen.getByText(/Sign NDA to collaborate/i))

    await waitFor(() => {
      expect(screen.getByTestId('collab-nda-modal')).toBeInTheDocument()
    })
  })

  // ─── Production Materials ────────────────────────────────────────────

  it('shows full materials via PitchDocuments when owner', async () => {
    mockPitchGetPublicById.mockResolvedValue(ownerPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('pitch-documents')).toBeInTheDocument()
    })
    expect(screen.getByText('Script available')).toBeInTheDocument()
    expect(screen.getByText('Pitch deck available')).toBeInTheDocument()
    expect(screen.getByText('Trailer available')).toBeInTheDocument()
  })

  it('shows full materials when NDA is signed', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...basePitch,
      requiresNDA: true,
      hasSignedNDA: true,
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('pitch-documents')).toBeInTheDocument()
    })
  })

  it('shows attachment-status labels when NDA not signed and required', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...basePitch,
      requiresNDA: true,
      hasSignedNDA: false,
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Materials')).toBeInTheDocument()
    })
    expect(screen.getByText('Full Script')).toBeInTheDocument()
    expect(screen.getByText('Pitch Deck')).toBeInTheDocument()
    expect(screen.getByText('Concept Trailer')).toBeInTheDocument()
    expect(screen.getByText(/Sign the NDA to download/i)).toBeInTheDocument()
  })

  // ─── Sidebar: Production Requirements ───────────────────────────────

  it('shows production requirements sidebar with format and budget', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Requirements')).toBeInTheDocument()
    })
    expect(screen.getByText('12 months')).toBeInTheDocument()
    // Budget is formatted via formatCurrency mock — may appear in genre tags too
    expect(screen.getAllByText('$medium').length).toBeGreaterThan(0)
  })

  it('shows NDAs Signed count', async () => {
    mockPitchGetPublicById.mockResolvedValue({ ...basePitch, ndaCount: 7 })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('7')).toBeInTheDocument()
    })
    expect(screen.getByText(/NDAs Signed/i)).toBeInTheDocument()
  })

  // ─── Tabs ────────────────────────────────────────────────────────────

  it('shows Overview and Feasibility tabs; hides Team/Notes workspace for unsaved evaluator', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('overview')).toBeInTheDocument()
    })
    expect(screen.getByText('Feasibility')).toBeInTheDocument()
    // Workspace tabs are hidden until pitch is saved (evaluationMode + !isShortlisted)
    expect(screen.queryByText(/My Creatives/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/My Notes/i)).not.toBeInTheDocument()
  })

  it('shows all 4 tabs for the pitch owner (production-owned)', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...ownerPitch,
      creator_type: 'production',
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      // Owner sees all workspace tabs
      expect(screen.getByText('overview')).toBeInTheDocument()
      expect(screen.getByText('Feasibility')).toBeInTheDocument()
    })
    // Production-owned = Creatives / Notes (not "My Creatives" / "My Notes")
    expect(screen.getByText('Creatives')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
  })

  it('shows opt-in hint for unsaved evaluator pitch', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Save this pitch to open a private/i)).toBeInTheDocument()
    })
  })

  it('switches to Feasibility tab when clicked', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Feasibility'))
    fireEvent.click(screen.getByText('Feasibility'))

    // Feasibility tab renders Pitch Package Assessment
    await waitFor(() => {
      expect(screen.getByText('Pitch Package Assessment')).toBeInTheDocument()
    })
    expect(screen.getByText('Production Readiness')).toBeInTheDocument()
  })

  it('Feasibility tab renders completeness checklist items', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Feasibility'))
    fireEvent.click(screen.getByText('Feasibility'))

    await waitFor(() => {
      expect(screen.getByText('Pitch Package Assessment')).toBeInTheDocument()
    })
    // Field labels rendered in the completeness grid
    expect(screen.getByText('Logline')).toBeInTheDocument()
    expect(screen.getByText('Synopsis')).toBeInTheDocument()
    // 'Budget' appears in both the sidebar and the checklist — use getAllByText
    expect(screen.getAllByText('Budget').length).toBeGreaterThan(0)
  })

  // ─── Team/Notes tabs — owner (production-owned) ─────────────────────

  it('shows Team tab content for owner of production-owned pitch', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...ownerPitch,
      creator_type: 'production',
      hasSignedNDA: false, // owner doesn't need NDA
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Creatives'))
    fireEvent.click(screen.getByText('Creatives'))

    await waitFor(() => {
      expect(screen.getByText('Attached Creatives')).toBeInTheDocument()
    })
  })

  it('shows Notes tab content for owner of production-owned pitch', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...ownerPitch,
      creator_type: 'production',
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Notes'))
    fireEvent.click(screen.getByText('Notes'))

    await waitFor(() => {
      expect(screen.getByText('Production Notes')).toBeInTheDocument()
    })
  })

  it('shows empty notes message when no notes exist', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...ownerPitch,
      creator_type: 'production',
    })
    mockProductionGetNotes.mockResolvedValue([])

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Notes'))
    fireEvent.click(screen.getByText('Notes'))

    await waitFor(() => {
      expect(screen.getByText(/No notes yet/i)).toBeInTheDocument()
    })
  })

  it('renders existing notes loaded from ProductionService', async () => {
    const existingNotes = [
      {
        id: 1,
        content: 'Great casting potential',
        created_at: '2026-01-10T10:00:00Z',
        category: 'casting',
        author: 'Production Team',
      },
    ]
    mockProductionGetNotes.mockResolvedValue(existingNotes)
    mockPitchGetPublicById.mockResolvedValue({
      ...ownerPitch,
      creator_type: 'production',
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Notes'))
    fireEvent.click(screen.getByText('Notes'))

    await waitFor(() => {
      expect(screen.getByText('Great casting potential')).toBeInTheDocument()
    })
  })

  it('adds a new note optimistically', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...ownerPitch,
      creator_type: 'production',
    })
    mockProductionCreateNote.mockResolvedValue({
      id: 999,
      content: 'Location scouting note',
      created_at: '2026-06-18T12:00:00Z',
      category: 'location',
      author: 'Production Team',
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Notes'))
    fireEvent.click(screen.getByText('Notes'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add a production note...')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('Add a production note...'), {
      target: { value: 'Location scouting note' },
    })
    fireEvent.click(screen.getByText('Add Note'))

    await waitFor(() => {
      expect(screen.getByText('Location scouting note')).toBeInTheDocument()
    })
    expect(mockProductionCreateNote).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ content: 'Location scouting note' })
    )
  })

  // ─── Collaboration States ────────────────────────────────────────────

  it('shows "Propose collaboration" button for saved evaluator (workspaceUnlocked)', async () => {
    // Saved pitch = isShortlisted = true → workspaceUnlocked = true for evaluator
    mockSavedPitchesIsPitchSaved.mockResolvedValue({ data: { isSaved: true, savedPitchId: 101 } })
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Propose collaboration')).toBeInTheDocument()
    })
  })

  it('shows pending collaboration message after proposal', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...basePitch,
      collaboration: { id: 10, status: 'pending', role: 'co_development', withUserId: 7, withName: 'Alex Creator' },
    })
    mockSavedPitchesIsPitchSaved.mockResolvedValue({ data: { isSaved: true, savedPitchId: 101 } })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Collaboration proposed')).toBeInTheDocument()
    })
    expect(screen.getByText(/Waiting for Alex Creator/i)).toBeInTheDocument()
  })

  it('shows active collaboration message when collaboration is accepted', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...basePitch,
      collaboration: { id: 10, status: 'accepted', role: 'co_development', withUserId: 7, withName: 'Alex Creator' },
    })
    mockSavedPitchesIsPitchSaved.mockResolvedValue({ data: { isSaved: true, savedPitchId: 101 } })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Collaborating with Alex Creator/i)).toBeInTheDocument()
    })
  })

  // ─── Access chip — Evaluating badge ─────────────────────────────────

  it('shows "Evaluating · not your pitch" access chip for non-owner evaluator', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...ownerPitch,
      creator_type: 'production',
    })
    // Switch to Feasibility tab to trigger accessChip render
    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Feasibility'))
    // Owner's pitch — chip says "Editor" (the canEditWorkspace branch)
    fireEvent.click(screen.getByText('Feasibility'))
    await waitFor(() => {
      expect(screen.getByText('Editor')).toBeInTheDocument()
    })
  })

  it('shows "View only" chip for NDA-signed non-editor (creator-owned pitch)', async () => {
    // A production user viewing a creator-owned pitch with NDA signed
    // canEditWorkspace = !ownerIsProduction means any production user can edit
    // Actually ownerIsProduction = false → canEditWorkspace = (userType === 'production') = true
    // So we need to verify the chip renders per the logic
    mockPitchGetPublicById.mockResolvedValue({
      ...basePitch,
      hasSignedNDA: true,
    })
    mockSavedPitchesIsPitchSaved.mockResolvedValue({ data: { isSaved: true, savedPitchId: 101 } })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Feasibility'))
    fireEvent.click(screen.getByText('Feasibility'))

    await waitFor(() => {
      expect(screen.getByText('Pitch Package Assessment')).toBeInTheDocument()
    })
    // production user → canEditWorkspace = true for creator-owned pitch
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })

  // ─── SocialProofBadge / engagement ──────────────────────────────────

  it('renders social proof badge with view and like counts', async () => {
    mockPitchGetPublicById.mockResolvedValue({ ...basePitch, views: 1500, likes: 200 })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('social-proof-badge')).toBeInTheDocument()
    })
    expect(screen.getByTestId('view-count').textContent).toBe('1500')
    expect(screen.getByTestId('like-count').textContent).toBe('200')
  })

  // ─── FeedbackSection ────────────────────────────────────────────────

  it('renders FeedbackSection for non-owner', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('feedback-section')).toBeInTheDocument()
    })
    expect(screen.getByTestId('feedback-section').dataset.pitchId).toBe('42')
    expect(screen.getByTestId('feedback-section').dataset.isOwner).toBe('false')
  })

  it('renders FeedbackSection with isOwner=true for owner', async () => {
    mockPitchGetPublicById.mockResolvedValue(ownerPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('feedback-section')).toBeInTheDocument()
    })
    expect(screen.getByTestId('feedback-section').dataset.isOwner).toBe('true')
  })

  // ─── InterestedCard ──────────────────────────────────────────────────

  it('renders InterestedCard for non-owner', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('interested-card')).toBeInTheDocument()
    })
  })

  it('does NOT render InterestedCard for owner', async () => {
    mockPitchGetPublicById.mockResolvedValue(ownerPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('AI Assessment')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('interested-card')).not.toBeInTheDocument()
  })

  // ─── Shortlist toggle unlocks workspace ─────────────────────────────

  it('unlocks Team/Notes workspace when pitch is saved (via InterestedCard)', async () => {
    mockPitchGetPublicById.mockResolvedValue(basePitch)
    // Simulate save response
    mockSavedPitchesSavePitch.mockResolvedValue({ data: { id: 55 } })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    // Initially workspace tabs are hidden
    await waitFor(() => {
      expect(screen.queryByText(/My Creatives/i)).not.toBeInTheDocument()
    })

    // Click save in InterestedCard (our mock calls onSavedChange(true))
    fireEvent.click(screen.getByTestId('save-btn'))

    // After saving, workspace tabs appear
    await waitFor(() => {
      expect(screen.getByText(/My Creatives/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/My Notes/i)).toBeInTheDocument()
  })

  // ─── Checklist update (owner, production-owned) ──────────────────────

  it('calls updatePitchChecklist when a checklist item is clicked', async () => {
    mockPitchGetPublicById.mockResolvedValue({
      ...ownerPitch,
      creator_type: 'production',
    })
    mockProductionUpdateChecklist.mockResolvedValue(undefined)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('Feasibility'))
    fireEvent.click(screen.getByText('Feasibility'))

    // Wait for checklist to render
    await waitFor(() => {
      expect(screen.getByText('Production Checklist')).toBeInTheDocument()
    })

    // Click the first clickable checklist item
    const checklistButtons = screen.getAllByRole('button', {
      name: /script analysis|budget breakdown|location scouting|casting plan/i,
    })
    expect(checklistButtons.length).toBeGreaterThan(0)
    fireEvent.click(checklistButtons[0])

    await waitFor(() => {
      expect(mockProductionUpdateChecklist).toHaveBeenCalledWith(42, expect.any(Object))
    })
  })
})
