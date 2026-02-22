import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()
const mockGetMyPitches = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store — STABLE reference ──────────────────────────────────
const mockUser = { id: 1, name: 'Creator User', email: 'creator@test.com', user_type: 'creator' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: mockCheckSession,
}

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Pitch Service ───────────────────────────────────────────────────
vi.mock('../../services/pitch.service', () => ({
  PitchService: {
    getMyPitches: mockGetMyPitches,
  },
}))

// ─── Config (pitch.service imports API_URL from config) ──────────────
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8787',
}))

// ─── Mock data ───────────────────────────────────────────────────────
const mockDraftPitches = [
  {
    id: 10,
    userId: 1,
    title: 'My Draft Sci-Fi',
    logline: 'A futuristic story about exploration',
    genre: 'scifi',
    format: 'feature',
    status: 'draft',
    viewCount: 0,
    likeCount: 0,
    ndaCount: 0,
    shortSynopsis: 'Short synopsis text for the draft pitch',
    longSynopsis: '',
    characters: [{ name: 'Hero', description: 'Main character' }],
    budgetBracket: '1M-5M',
    estimatedBudget: null,
    titleImage: null,
    targetAudience: 'General audiences',
    themes: 'Adventure, discovery',
    productionTimeline: null,
    updatedAt: '2026-02-15T00:00:00Z',
    createdAt: '2026-01-20T00:00:00Z',
    publishedAt: null,
  },
  {
    id: 11,
    userId: 1,
    title: 'Drama Under Review',
    logline: 'A moving drama about family',
    genre: 'drama',
    format: 'tv',
    status: 'under_review',
    viewCount: 50,
    likeCount: 10,
    ndaCount: 0,
    shortSynopsis: 'Synopsis for drama',
    longSynopsis: 'Extended synopsis for drama',
    characters: [],
    budgetBracket: null,
    estimatedBudget: null,
    titleImage: null,
    targetAudience: null,
    themes: null,
    productionTimeline: null,
    updatedAt: '2026-02-18T00:00:00Z',
    createdAt: '2026-01-25T00:00:00Z',
    publishedAt: null,
  },
]

let CreatorPitchesDrafts: React.ComponentType

beforeAll(async () => {
  const mod = await import('../creator/CreatorPitchesDrafts')
  CreatorPitchesDrafts = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckSession.mockResolvedValue(undefined)
  mockGetMyPitches.mockResolvedValue(mockDraftPitches)
})

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
})

describe('CreatorPitchesDrafts', () => {
  it('shows loading spinner initially', () => {
    mockGetMyPitches.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders page title after loading', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Draft Pitches')).toBeInTheDocument()
    })
  })

  it('renders draft pitch cards', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('My Draft Sci-Fi')).toBeInTheDocument()
    })

    expect(screen.getByText('Drama Under Review')).toBeInTheDocument()
  })

  it('renders logline text', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('A futuristic story about exploration')).toBeInTheDocument()
    })
  })

  it('renders search input', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search drafts...')).toBeInTheDocument()
    })
  })

  it('renders filter dropdowns', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('All Status')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('All Genres')).toBeInTheDocument()
    expect(screen.getByDisplayValue('All Progress')).toBeInTheDocument()
    expect(screen.getByDisplayValue('All Time')).toBeInTheDocument()
  })

  it('renders New Pitch button', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('New Pitch')).toBeInTheDocument()
    })
  })

  it('shows results summary count', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Showing 2 of 2 drafts/)).toBeInTheDocument()
    })
  })

  it('renders progress bars for drafts', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('My Draft Sci-Fi')).toBeInTheDocument()
    })

    // Progress percentages are shown
    const progressTexts = screen.getAllByText(/%/)
    expect(progressTexts.length).toBeGreaterThan(0)
  })

  it('shows empty state when no drafts', async () => {
    mockGetMyPitches.mockResolvedValue([])

    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No drafts found')).toBeInTheDocument()
    })

    expect(screen.getByText("You haven't created any pitch drafts yet.")).toBeInTheDocument()
  })

  it('shows only draft and under_review pitches (filters out published)', async () => {
    mockGetMyPitches.mockResolvedValue([
      ...mockDraftPitches,
      {
        id: 99,
        userId: 1,
        title: 'Published Pitch',
        logline: 'This is published',
        genre: 'drama',
        format: 'feature',
        status: 'published',
        viewCount: 500,
        likeCount: 100,
        updatedAt: '2026-02-20T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ])

    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('My Draft Sci-Fi')).toBeInTheDocument()
    })

    // Published pitch should NOT appear
    expect(screen.queryByText('Published Pitch')).not.toBeInTheDocument()
  })

  it('renders completion status section', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Completion Status').length).toBeGreaterThan(0)
    })
  })

  it('renders Edit button for each draft', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit')
      expect(editButtons).toHaveLength(2)
    })
  })

  it('calls getMyPitches on mount', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockGetMyPitches).toHaveBeenCalled()
    })
  })

  it('renders Select all checkbox', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesDrafts />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Select all')).toBeInTheDocument()
    })
  })
})
