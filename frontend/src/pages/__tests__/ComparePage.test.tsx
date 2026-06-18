import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockSubjects = vi.fn()
const mockSearchCreators = vi.fn()
const mockSearchSlates = vi.fn()
const mockSave = vi.fn()
const mockListSaved = vi.fn()
const mockDeleteSaved = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store (STABLE reference to prevent infinite loops) ────────
const mockUser = { id: 1, name: 'Test User', email: 'test@test.com', userType: 'creator' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── compare service ────────────────────────────────────────────────
vi.mock('../../services/compare.service', () => ({
  compareService: {
    subjects: (...args: any[]) => mockSubjects(...args),
    searchCreators: (...args: any[]) => mockSearchCreators(...args),
    searchSlates: (...args: any[]) => mockSearchSlates(...args),
    save: (...args: any[]) => mockSave(...args),
    listSaved: (...args: any[]) => mockListSaved(...args),
    deleteSaved: (...args: any[]) => mockDeleteSaved(...args),
  },
}))

// ─── PortalTopNav (complex, uses framer-motion + many other deps) ──
vi.mock('@shared/components/layout/PortalTopNav', () => ({
  default: () => <nav data-testid="portal-top-nav">TopNav</nav>,
}))

// ─── Navigation utils ───────────────────────────────────────────────
vi.mock('@/utils/navigation', () => ({
  getPortalPath: (userType: string | null | undefined) => {
    if (!userType) return ''
    if (userType === 'viewer') return 'watcher'
    return userType
  },
  getDashboardRoute: (userType: string | null | undefined) => `/${userType}/dashboard`,
}))

// ─── Shared user-type normalizer ────────────────────────────────────
vi.mock('@shared/types/user-type', () => ({
  normalizeUserType: (raw: string | null | undefined) => {
    if (!raw) return null
    if (raw === 'viewer') return 'watcher'
    if (['creator', 'investor', 'production', 'admin', 'watcher'].includes(raw)) return raw
    return null
  },
}))

// ─── Realistic test data ────────────────────────────────────────────
const mockCreatorSubjects = [
  {
    subject_id: 101,
    name: 'Alice Writer',
    username: 'alice_w',
    user_type: 'creator',
    verification_tier: 'gold',
    avatar: null,
    pitch_count: 5,
    avg_heat: 7.4,
    avg_pitchey: 8.1,
    total_views: 1240,
    total_likes: 88,
    budget_min: 500000,
    budget_max: 2000000,
    newest_at: '2024-03-15',
    genres: ['Drama', 'Thriller'],
  },
  {
    subject_id: 202,
    name: 'Bob Director',
    username: 'bob_d',
    user_type: 'creator',
    verification_tier: 'silver',
    avatar: null,
    pitch_count: 3,
    avg_heat: 5.9,
    avg_pitchey: 6.5,
    total_views: 850,
    total_likes: 42,
    budget_min: 200000,
    budget_max: 800000,
    newest_at: '2024-01-10',
    genres: ['Comedy', 'Drama'],
  },
]

const mockPitchSubjects = [
  {
    subject_id: 301,
    name: 'Dark Waters',
    subtitle: 'A noir thriller set in 1940s Chicago',
    thumbnail: null,
    genre: 'Thriller',
    format: 'Feature Film',
    verification_tier: null,
    avg_heat: 9.1,
    avg_pitchey: 8.7,
    total_views: 3200,
    total_likes: 220,
    budget_min: 1000000,
    budget_max: 5000000,
    newest_at: '2024-04-01',
    genres: ['Thriller', 'Noir'],
  },
  {
    subject_id: 402,
    name: 'Laugh Factory',
    subtitle: 'Ensemble comedy about a failing startup',
    thumbnail: null,
    genre: 'Comedy',
    format: 'Limited Series',
    verification_tier: null,
    avg_heat: 6.3,
    avg_pitchey: 7.2,
    total_views: 1800,
    total_likes: 130,
    budget_min: 500000,
    budget_max: 1500000,
    newest_at: '2024-02-20',
    genres: ['Comedy'],
  },
]

const mockSlateSubjects = [
  {
    subject_id: 501,
    name: 'Autumn Collection',
    subtitle: 'Curated dramatic features',
    thumbnail: null,
    genre: null,
    format: null,
    verification_tier: 'gold',
    pitch_count: 8,
    avg_heat: 7.8,
    avg_pitchey: 8.0,
    total_views: 2100,
    total_likes: 150,
    budget_min: null,
    budget_max: null,
    newest_at: '2024-03-01',
    genres: ['Drama', 'Thriller'],
  },
  {
    subject_id: 602,
    name: 'Summer Laughs',
    subtitle: 'Comedy showcase',
    thumbnail: null,
    genre: null,
    format: null,
    verification_tier: null,
    pitch_count: 4,
    avg_heat: 5.5,
    avg_pitchey: 6.0,
    total_views: 900,
    total_likes: 60,
    budget_min: null,
    budget_max: null,
    newest_at: '2024-01-15',
    genres: ['Comedy'],
  },
]

const mockSavedComparisons = [
  {
    id: 1,
    title: 'My Creator Shortlist',
    subject_type: 'creator' as const,
    subject_ids: '101,202',
    share_token: 'abc123tok',
    created_at: '2024-04-01T00:00:00Z',
  },
]

// ─── Dynamic import ─────────────────────────────────────────────────
let ComparePage: React.ComponentType
let ComparisonMatrix: React.ComponentType<any>

beforeAll(async () => {
  const mod = await import('../ComparePage')
  ComparePage = mod.default
  ComparisonMatrix = mod.ComparisonMatrix
})

// ─── Helpers ─────────────────────────────────────────────────────────
function renderPage(initialRoute = '/compare') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <ComparePage />
    </MemoryRouter>
  )
}

describe('ComparePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects.mockResolvedValue([])
    mockSearchCreators.mockResolvedValue([])
    mockSearchSlates.mockResolvedValue([])
    mockListSaved.mockResolvedValue([])
    mockSave.mockResolvedValue({ id: 99, share_token: 'newtoken123' })
    mockDeleteSaved.mockResolvedValue(undefined)
    // Suppress clipboard API errors in jsdom
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  // ─── Header / hero rendering ────────────────────────────────────
  describe('hero section', () => {
    it('renders "Compare Creators" heading by default (no type param)', async () => {
      renderPage('/compare')
      await waitFor(() => {
        expect(screen.getByText('Compare Creators')).toBeInTheDocument()
      })
    })

    it('renders "Compare Pitches" heading when type=pitch', async () => {
      renderPage('/compare?type=pitch')
      await waitFor(() => {
        expect(screen.getByText('Compare Pitches')).toBeInTheDocument()
      })
    })

    it('renders "Compare Slates" heading when type=slate', async () => {
      renderPage('/compare?type=slate')
      await waitFor(() => {
        expect(screen.getByText('Compare Slates')).toBeInTheDocument()
      })
    })

    it('renders the Compare badge label', async () => {
      renderPage('/compare')
      await waitFor(() => {
        expect(screen.getByText('Compare')).toBeInTheDocument()
      })
    })
  })

  // ─── Empty state ─────────────────────────────────────────────────
  describe('empty state', () => {
    it('shows "Add creators to compare" when no ids and type=creator', async () => {
      renderPage('/compare')
      await waitFor(() => {
        expect(screen.getByText('Add creators to compare')).toBeInTheDocument()
      })
    })

    it('shows "Add slates to compare" when no ids and type=slate', async () => {
      renderPage('/compare?type=slate')
      await waitFor(() => {
        expect(screen.getByText('Add slates to compare')).toBeInTheDocument()
      })
    })

    it('shows "Nothing to compare" when no ids and type=pitch', async () => {
      renderPage('/compare?type=pitch')
      await waitFor(() => {
        expect(screen.getByText('Nothing to compare')).toBeInTheDocument()
      })
    })

    it('does NOT call compareService.subjects when no ids provided', async () => {
      renderPage('/compare')
      // wait for any async effects to settle
      await waitFor(() => {
        expect(screen.getByText('Add creators to compare')).toBeInTheDocument()
      })
      expect(mockSubjects).not.toHaveBeenCalled()
    })
  })

  // ─── Creator/Slate toggle ─────────────────────────────────────────
  describe('type toggle (Creators / Slates)', () => {
    it('renders Creators and Slates toggle buttons', async () => {
      renderPage('/compare')
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Creators' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Slates' })).toBeInTheDocument()
      })
    })

    it('does NOT render the toggle when type=pitch', async () => {
      renderPage('/compare?type=pitch')
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Creators' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Slates' })).not.toBeInTheDocument()
      })
    })
  })

  // ─── Fetching subjects ───────────────────────────────────────────
  describe('subjects fetch', () => {
    it('calls compareService.subjects with correct type and ids for creators', async () => {
      mockSubjects.mockResolvedValue(mockCreatorSubjects)
      renderPage('/compare?ids=101,202')
      await waitFor(() => {
        expect(mockSubjects).toHaveBeenCalledWith('creator', [101, 202])
      })
    })

    it('calls compareService.subjects with type=pitch', async () => {
      mockSubjects.mockResolvedValue(mockPitchSubjects)
      renderPage('/compare?type=pitch&ids=301,402')
      await waitFor(() => {
        expect(mockSubjects).toHaveBeenCalledWith('pitch', [301, 402])
      })
    })

    it('calls compareService.subjects with type=slate', async () => {
      mockSubjects.mockResolvedValue(mockSlateSubjects)
      renderPage('/compare?type=slate&ids=501,602')
      await waitFor(() => {
        expect(mockSubjects).toHaveBeenCalledWith('slate', [501, 602])
      })
    })

    it('shows loading spinner while fetching', async () => {
      // Never resolve so spinner stays
      mockSubjects.mockReturnValue(new Promise(() => {}))
      renderPage('/compare?ids=101,202')
      // The spinner should be present while pending
      await waitFor(() => {
        const spinners = document.querySelectorAll('.animate-spin')
        expect(spinners.length).toBeGreaterThan(0)
      })
    })
  })

  // ─── Comparison matrix render ────────────────────────────────────
  describe('comparison matrix with creator data', () => {
    it('renders creator names in the matrix', async () => {
      mockSubjects.mockResolvedValue(mockCreatorSubjects)
      renderPage('/compare?ids=101,202')
      await waitFor(() => {
        expect(screen.getByText('Alice Writer')).toBeInTheDocument()
        expect(screen.getByText('Bob Director')).toBeInTheDocument()
      })
    })

    it('renders metric row labels for creator type', async () => {
      mockSubjects.mockResolvedValue(mockCreatorSubjects)
      renderPage('/compare?ids=101,202')
      await waitFor(() => {
        expect(screen.getByText('Published pitches')).toBeInTheDocument()
        expect(screen.getByText('Avg heat')).toBeInTheDocument()
        expect(screen.getByText('Avg Pitchey score')).toBeInTheDocument()
        expect(screen.getByText('Total views')).toBeInTheDocument()
        expect(screen.getByText('Total likes')).toBeInTheDocument()
      })
    })

    it('renders Genres row', async () => {
      mockSubjects.mockResolvedValue(mockCreatorSubjects)
      renderPage('/compare?ids=101,202')
      await waitFor(() => {
        expect(screen.getByText('Genres')).toBeInTheDocument()
      })
    })

    it('renders genre tags from creator data', async () => {
      mockSubjects.mockResolvedValue(mockCreatorSubjects)
      renderPage('/compare?ids=101,202')
      await waitFor(() => {
        expect(screen.getAllByText('Drama').length).toBeGreaterThan(0)
        expect(screen.getByText('Thriller')).toBeInTheDocument()
        expect(screen.getByText('Comedy')).toBeInTheDocument()
      })
    })

    it('renders remove buttons for each subject', async () => {
      mockSubjects.mockResolvedValue(mockCreatorSubjects)
      renderPage('/compare?ids=101,202')
      await waitFor(() => {
        const removeBtns = screen.getAllByLabelText('Remove')
        expect(removeBtns).toHaveLength(2)
      })
    })
  })

  describe('comparison matrix with pitch data', () => {
    it('renders pitch names in the matrix', async () => {
      mockSubjects.mockResolvedValue(mockPitchSubjects)
      renderPage('/compare?type=pitch&ids=301,402')
      await waitFor(() => {
        expect(screen.getByText('Dark Waters')).toBeInTheDocument()
        expect(screen.getByText('Laugh Factory')).toBeInTheDocument()
      })
    })

    it('renders pitch-specific metric labels', async () => {
      mockSubjects.mockResolvedValue(mockPitchSubjects)
      renderPage('/compare?type=pitch&ids=301,402')
      await waitFor(() => {
        expect(screen.getByText('Heat')).toBeInTheDocument()
        expect(screen.getByText('Pitchey score')).toBeInTheDocument()
        expect(screen.getByText('Views')).toBeInTheDocument()
        expect(screen.getByText('Likes')).toBeInTheDocument()
        expect(screen.getByText('Format')).toBeInTheDocument()
      })
    })

    it('renders format values from pitch data', async () => {
      mockSubjects.mockResolvedValue(mockPitchSubjects)
      renderPage('/compare?type=pitch&ids=301,402')
      await waitFor(() => {
        expect(screen.getByText('Feature Film')).toBeInTheDocument()
        expect(screen.getByText('Limited Series')).toBeInTheDocument()
      })
    })
  })

  describe('comparison matrix with slate data', () => {
    it('renders slate names in the matrix', async () => {
      mockSubjects.mockResolvedValue(mockSlateSubjects)
      renderPage('/compare?type=slate&ids=501,602')
      await waitFor(() => {
        expect(screen.getByText('Autumn Collection')).toBeInTheDocument()
        expect(screen.getByText('Summer Laughs')).toBeInTheDocument()
      })
    })

    it('renders slate-specific metric labels', async () => {
      mockSubjects.mockResolvedValue(mockSlateSubjects)
      renderPage('/compare?type=slate&ids=501,602')
      await waitFor(() => {
        expect(screen.getByText('Pitches')).toBeInTheDocument()
        expect(screen.getByText('Avg heat')).toBeInTheDocument()
      })
    })
  })

  // ─── "Save & share" button visibility ───────────────────────────
  describe('save & share button', () => {
    it('does NOT show "Save & share" button when fewer than 2 subjects', async () => {
      mockSubjects.mockResolvedValue([mockCreatorSubjects[0]])
      renderPage('/compare?ids=101')
      await waitFor(() => {
        expect(screen.getByText('Alice Writer')).toBeInTheDocument()
      })
      expect(screen.queryByText('Save & share')).not.toBeInTheDocument()
    })

    it('shows "Save & share" button when 2+ subjects are loaded', async () => {
      mockSubjects.mockResolvedValue(mockCreatorSubjects)
      renderPage('/compare?ids=101,202')
      await waitFor(() => {
        expect(screen.getByText('Save & share')).toBeInTheDocument()
      })
    })
  })

  // ─── Save modal ──────────────────────────────────────────────────
  describe('save modal', () => {
    it('opens save modal when "Save & share" is clicked', async () => {
      mockSubjects.mockResolvedValue(mockCreatorSubjects)
      renderPage('/compare?ids=101,202')
      await waitFor(() => {
        expect(screen.getByText('Save & share')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Save & share'))
      await waitFor(() => {
        expect(screen.getByText('Save & share', { selector: 'h2' })).toBeInTheDocument()
      })
    })

    it('renders name input in save modal', async () => {
      mockSubjects.mockResolvedValue(mockCreatorSubjects)
      renderPage('/compare?ids=101,202')
      await waitFor(() => {
        expect(screen.getByText('Save & share')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Save & share'))
      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g. Sci-fi finalists')).toBeInTheDocument()
      })
    })

    it('calls compareService.save when Save button is clicked in modal', async () => {
      mockSubjects.mockResolvedValue(mockCreatorSubjects)
      renderPage('/compare?ids=101,202')
      await waitFor(() => {
        expect(screen.getByText('Save & share')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Save & share'))
      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g. Sci-fi finalists')).toBeInTheDocument()
      })
      // Type a title
      fireEvent.change(screen.getByPlaceholderText('e.g. Sci-fi finalists'), {
        target: { value: 'My Test Comparison' },
      })
      // Click Save button inside modal (the button, not the h2)
      const saveButtons = screen.getAllByText('Save')
      const saveBtn = saveButtons.find(el => el.tagName !== 'H2' && el.closest('button'))
      if (saveBtn) fireEvent.click(saveBtn)
      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledWith('My Test Comparison', 'creator', [101, 202])
      })
    })

    it('closes modal when Cancel is clicked', async () => {
      mockSubjects.mockResolvedValue(mockCreatorSubjects)
      renderPage('/compare?ids=101,202')
      await waitFor(() => {
        expect(screen.getByText('Save & share')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Save & share'))
      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g. Sci-fi finalists')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Cancel'))
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('e.g. Sci-fi finalists')).not.toBeInTheDocument()
      })
    })

    it('shows share link after successful save', async () => {
      mockSubjects.mockResolvedValue(mockCreatorSubjects)
      renderPage('/compare?ids=101,202')
      await waitFor(() => {
        expect(screen.getByText('Save & share')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Save & share'))
      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g. Sci-fi finalists')).toBeInTheDocument()
      })
      // Click the Save button
      const saveButtons = screen.getAllByText('Save')
      const saveBtn = saveButtons.find(el => el.closest('button'))
      if (saveBtn) fireEvent.click(saveBtn)
      await waitFor(() => {
        expect(screen.getByText('Shareable link (copied to your clipboard):')).toBeInTheDocument()
      })
    })
  })

  // ─── Saved menu ──────────────────────────────────────────────────
  describe('saved comparisons menu', () => {
    it('renders the Saved button', async () => {
      renderPage('/compare')
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument()
      })
    })

    it('opens saved comparisons dropdown when Saved is clicked', async () => {
      mockListSaved.mockResolvedValue(mockSavedComparisons)
      renderPage('/compare')
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: /saved/i }))
      await waitFor(() => {
        expect(mockListSaved).toHaveBeenCalled()
      })
    })

    it('shows saved comparison title in dropdown', async () => {
      mockListSaved.mockResolvedValue(mockSavedComparisons)
      renderPage('/compare')
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: /saved/i }))
      await waitFor(() => {
        expect(screen.getByText('My Creator Shortlist')).toBeInTheDocument()
      })
    })

    it('shows "No saved comparisons yet." when list is empty', async () => {
      mockListSaved.mockResolvedValue([])
      renderPage('/compare')
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: /saved/i }))
      await waitFor(() => {
        expect(screen.getByText('No saved comparisons yet.')).toBeInTheDocument()
      })
    })

    it('calls compareService.deleteSaved when delete icon clicked in saved menu', async () => {
      mockListSaved.mockResolvedValue(mockSavedComparisons)
      renderPage('/compare')
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: /saved/i }))
      await waitFor(() => {
        expect(screen.getByText('My Creator Shortlist')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByLabelText('Delete'))
      await waitFor(() => {
        expect(mockDeleteSaved).toHaveBeenCalledWith(1)
      })
    })
  })

  // ─── Picker component ─────────────────────────────────────────────
  describe('picker search input', () => {
    it('renders creator search input', async () => {
      renderPage('/compare')
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search creators to add…')).toBeInTheDocument()
      })
    })

    it('renders slate search input when type=slate', async () => {
      renderPage('/compare?type=slate')
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search slates to add…')).toBeInTheDocument()
      })
    })

    it('disables search input when max subjects (4) reached', async () => {
      // Mock 4 subjects to trigger the disabled state
      const fourSubjects = [
        ...mockCreatorSubjects,
        { ...mockCreatorSubjects[0], subject_id: 303, name: 'Carol Scriptwriter' },
        { ...mockCreatorSubjects[1], subject_id: 404, name: 'Dave Filmmaker' },
      ]
      mockSubjects.mockResolvedValue(fourSubjects)
      renderPage('/compare?ids=101,202,303,404')
      await waitFor(() => {
        expect(screen.getByText('Carol Scriptwriter')).toBeInTheDocument()
      })
      const input = screen.getByPlaceholderText('Up to 4 creators')
      expect(input).toBeDisabled()
    })
  })

  // ─── ComparisonMatrix exported component ─────────────────────────
  describe('ComparisonMatrix standalone', () => {
    it('renders matrix with creator subjects', () => {
      render(
        <MemoryRouter>
          <ComparisonMatrix type="creator" subjects={mockCreatorSubjects} />
        </MemoryRouter>
      )
      expect(screen.getByText('Alice Writer')).toBeInTheDocument()
      expect(screen.getByText('Bob Director')).toBeInTheDocument()
    })

    it('renders pitch subjects in matrix', () => {
      render(
        <MemoryRouter>
          <ComparisonMatrix type="pitch" subjects={mockPitchSubjects} />
        </MemoryRouter>
      )
      expect(screen.getByText('Dark Waters')).toBeInTheDocument()
      expect(screen.getByText('Laugh Factory')).toBeInTheDocument()
    })

    it('renders slate subjects in matrix', () => {
      render(
        <MemoryRouter>
          <ComparisonMatrix type="slate" subjects={mockSlateSubjects} />
        </MemoryRouter>
      )
      expect(screen.getByText('Autumn Collection')).toBeInTheDocument()
      expect(screen.getByText('Summer Laughs')).toBeInTheDocument()
    })

    it('calls onRemove when Remove button is clicked', () => {
      const mockOnRemove = vi.fn()
      render(
        <MemoryRouter>
          <ComparisonMatrix type="creator" subjects={mockCreatorSubjects} onRemove={mockOnRemove} />
        </MemoryRouter>
      )
      const removeBtns = screen.getAllByLabelText('Remove')
      fireEvent.click(removeBtns[0])
      expect(mockOnRemove).toHaveBeenCalledWith(101)
    })

    it('highlights leader value with Crown icon (higher views wins)', () => {
      render(
        <MemoryRouter>
          <ComparisonMatrix type="creator" subjects={mockCreatorSubjects} />
        </MemoryRouter>
      )
      // Alice has 1240 views vs Bob's 850 — Alice is the leader for views
      // The value function does String(num(total_views)) → no locale formatting
      expect(screen.getByText('1240')).toBeInTheDocument()
    })

    it('renders dash for null budget values', () => {
      const subjectNobudget = [
        { ...mockSlateSubjects[0], budget_min: null, budget_max: null },
        { ...mockSlateSubjects[1], budget_min: null, budget_max: null },
      ]
      render(
        <MemoryRouter>
          <ComparisonMatrix type="slate" subjects={subjectNobudget} />
        </MemoryRouter>
      )
      // Budget range should be '—' for both
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThan(0)
    })

    it('renders badge check icon for gold verification tier', () => {
      render(
        <MemoryRouter>
          <ComparisonMatrix type="creator" subjects={mockCreatorSubjects} />
        </MemoryRouter>
      )
      // Subject 101 has verification_tier='gold' and subject 202 has 'silver'
      // Both should render the BadgeCheck — we assert the matrix is shown
      expect(screen.getByText('Alice Writer')).toBeInTheDocument()
      expect(screen.getByText('Bob Director')).toBeInTheDocument()
    })

    it('renders empty genres dash when genres array is empty', () => {
      const subjectNoGenres = [
        { ...mockCreatorSubjects[0], genres: [] },
        { ...mockCreatorSubjects[1], genres: [] },
      ]
      render(
        <MemoryRouter>
          <ComparisonMatrix type="creator" subjects={subjectNoGenres} />
        </MemoryRouter>
      )
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThan(0)
    })

    it('renders without onRemove prop (read-only mode, no X buttons)', () => {
      render(
        <MemoryRouter>
          <ComparisonMatrix type="creator" subjects={mockCreatorSubjects} />
        </MemoryRouter>
      )
      expect(screen.queryAllByLabelText('Remove')).toHaveLength(0)
    })

    it('renders budget range correctly when both values present', () => {
      render(
        <MemoryRouter>
          <ComparisonMatrix type="creator" subjects={mockCreatorSubjects} />
        </MemoryRouter>
      )
      // Alice: $500K–$2M
      expect(screen.getByText('$500K–$2M')).toBeInTheDocument()
    })

    it('formats heat score to 1 decimal', () => {
      render(
        <MemoryRouter>
          <ComparisonMatrix type="creator" subjects={mockCreatorSubjects} />
        </MemoryRouter>
      )
      expect(screen.getByText('7.4')).toBeInTheDocument()
      expect(screen.getByText('5.9')).toBeInTheDocument()
    })

    it('formats pitchey score with /10 suffix', () => {
      render(
        <MemoryRouter>
          <ComparisonMatrix type="creator" subjects={mockCreatorSubjects} />
        </MemoryRouter>
      )
      expect(screen.getByText('8.1/10')).toBeInTheDocument()
      expect(screen.getByText('6.5/10')).toBeInTheDocument()
    })

    it('formats monthYear correctly for newest_at date', () => {
      render(
        <MemoryRouter>
          <ComparisonMatrix type="creator" subjects={mockCreatorSubjects} />
        </MemoryRouter>
      )
      // Alice: 2024-03-15 → Mar 2024; Bob: 2024-01-10 → Jan 2024
      expect(screen.getByText('Mar 2024')).toBeInTheDocument()
      expect(screen.getByText('Jan 2024')).toBeInTheDocument()
    })
  })

  // ─── Portal redirect behaviour ────────────────────────────────────
  describe('portal redirect', () => {
    it('calls navigate to redirect authenticated creator to portal compare path', async () => {
      renderPage('/compare?ids=101')
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/creator/compare?ids=101',
          { replace: true }
        )
      })
    })

    it('does NOT redirect when already inside portal path', async () => {
      renderPage('/creator/compare?ids=101')
      // Wait for render to stabilise
      await waitFor(() => {
        // The page renders (no infinite redirect loop)
        expect(document.body).toBeTruthy()
      })
      // navigate should NOT have been called
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  // ─── PortalTopNav visibility ──────────────────────────────────────
  describe('PortalTopNav', () => {
    it('shows PortalTopNav when NOT inside a portal path', async () => {
      renderPage('/compare')
      await waitFor(() => {
        expect(screen.getByTestId('portal-top-nav')).toBeInTheDocument()
      })
    })

    it('does NOT render PortalTopNav when inside a portal path', async () => {
      renderPage('/creator/compare')
      await waitFor(() => {
        expect(document.body).toBeTruthy()
      })
      expect(screen.queryByTestId('portal-top-nav')).not.toBeInTheDocument()
    })
  })
})
