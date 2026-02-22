import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
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

// ─── Pitch Service ───────────────────────────────────────────────────
vi.mock('../../services/pitch.service', () => ({
  PitchService: {
    getMyPitches: mockGetMyPitches,
  },
}))

// ─── Config ──────────────────────────────────────────────────────────
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8787',
}))

// ─── Mock data ───────────────────────────────────────────────────────
const mockPublishedPitches = [
  {
    id: 1,
    userId: 1,
    title: 'Space Opera Epic',
    logline: 'An astronaut discovers life beyond the solar system',
    genre: 'scifi',
    format: 'feature',
    status: 'published',
    viewCount: 1200,
    likeCount: 340,
    ndaCount: 8,
    budgetBracket: '5M-20M',
    estimatedBudget: null,
    titleImage: null,
    requireNDA: false,
    visibilitySettings: { showShortSynopsis: true, showCharacters: true, showBudget: true, showMedia: true },
    publishedAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 2,
    userId: 1,
    title: 'Drama Family Film',
    logline: 'A heartwarming story about family bonds',
    genre: 'drama',
    format: 'feature',
    status: 'published',
    viewCount: 450,
    likeCount: 120,
    ndaCount: 2,
    budgetBracket: '1M-5M',
    estimatedBudget: null,
    titleImage: null,
    requireNDA: true,
    visibilitySettings: null,
    publishedAt: '2026-01-20T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
    createdAt: '2026-01-15T00:00:00Z',
  },
]

let CreatorPitchesPublished: React.ComponentType

beforeAll(async () => {
  const mod = await import('../creator/CreatorPitchesPublished')
  CreatorPitchesPublished = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMyPitches.mockResolvedValue(mockPublishedPitches)
})

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
})

describe('CreatorPitchesPublished', () => {
  it('shows loading skeleton initially', () => {
    mockGetMyPitches.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    const pulsingElements = document.querySelectorAll('.animate-pulse')
    expect(pulsingElements.length).toBeGreaterThan(0)
  })

  it('renders page title', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Published Pitches')).toBeInTheDocument()
    })
  })

  it('renders published pitch cards', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Space Opera Epic')).toBeInTheDocument()
    })

    expect(screen.getByText('Drama Family Film')).toBeInTheDocument()
  })

  it('renders summary stat cards', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total Published')).toBeInTheDocument()
    })

    expect(screen.getByText('Total Views')).toBeInTheDocument()
    expect(screen.getByText('Avg. Rating')).toBeInTheDocument()
    expect(screen.getByText('Investment Interest')).toBeInTheDocument()
  })

  it('shows correct total published count', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total Published')).toBeInTheDocument()
    })

    // 2 published pitches
    const twos = screen.getAllByText('2')
    expect(twos.length).toBeGreaterThan(0)
  })

  it('renders search input', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search pitches...')).toBeInTheDocument()
    })
  })

  it('renders filter dropdowns', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('All Status')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('Most Recent')).toBeInTheDocument()
  })

  it('renders Create New Pitch button', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Create New Pitch')).toBeInTheDocument()
    })
  })

  it('renders per-pitch stat labels', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      const viewsLabels = screen.getAllByText('Views')
      expect(viewsLabels.length).toBeGreaterThan(0)
    })

    const likesLabels = screen.getAllByText('Likes')
    expect(likesLabels.length).toBeGreaterThan(0)
  })

  it('renders Edit buttons for each pitch', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit')
      expect(editButtons).toHaveLength(2)
    })
  })

  it('renders Analytics buttons for each pitch', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      const analyticsButtons = screen.getAllByText('Analytics')
      expect(analyticsButtons).toHaveLength(2)
    })
  })

  it('shows empty state when no published pitches', async () => {
    mockGetMyPitches.mockResolvedValue([])

    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No published pitches')).toBeInTheDocument()
    })

    expect(screen.getByText('Publish Your First Pitch')).toBeInTheDocument()
  })

  it('filters out non-published pitches', async () => {
    mockGetMyPitches.mockResolvedValue([
      ...mockPublishedPitches,
      {
        id: 99,
        userId: 1,
        title: 'Draft Pitch',
        logline: 'Unpublished draft',
        genre: 'drama',
        format: 'feature',
        status: 'draft',
        viewCount: 0,
        likeCount: 0,
        updatedAt: '2026-02-20T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ])

    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Space Opera Epic')).toBeInTheDocument()
    })

    // Draft should not appear
    expect(screen.queryByText('Draft Pitch')).not.toBeInTheDocument()
  })

  it('shows error banner when API fails', async () => {
    mockGetMyPitches.mockRejectedValue(new Error('Server error'))

    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to load your pitches. Please try again.')).toBeInTheDocument()
    })

    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('calls getMyPitches on mount', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockGetMyPitches).toHaveBeenCalled()
    })
  })

  it('renders genre names on cards', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesPublished />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Scifi')).toBeInTheDocument()
    })

    expect(screen.getByText('Drama')).toBeInTheDocument()
  })
})
