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
const mockReviewPitches = [
  {
    id: 5,
    userId: 1,
    title: 'Thriller Under Review',
    logline: 'A suspenseful thriller about a detective hunting a serial killer',
    genre: 'thriller',
    format: 'feature',
    status: 'under_review',
    viewCount: 120,
    likeCount: 30,
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 6,
    userId: 1,
    title: 'Comedy Series Pilot',
    logline: 'A quirky comedy about office life in the future',
    genre: 'comedy',
    format: 'tv',
    status: 'under_review',
    viewCount: 80,
    likeCount: 20,
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    createdAt: '2026-01-15T00:00:00Z',
  },
]

let CreatorPitchesReview: React.ComponentType

beforeAll(async () => {
  const mod = await import('../creator/CreatorPitchesReview')
  CreatorPitchesReview = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMyPitches.mockResolvedValue(mockReviewPitches)
})

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
})

describe('CreatorPitchesReview', () => {
  it('shows loading skeleton initially', () => {
    mockGetMyPitches.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    const pulsingElements = document.querySelectorAll('.animate-pulse')
    expect(pulsingElements.length).toBeGreaterThan(0)
  })

  it('renders page title after loading', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Pitch Reviews')).toBeInTheDocument()
    })
  })

  it('renders pitch items under review', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Thriller Under Review')).toBeInTheDocument()
    })

    expect(screen.getByText('Comedy Series Pilot')).toBeInTheDocument()
  })

  it('renders pitch loglines', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('A suspenseful thriller about a detective hunting a serial killer')).toBeInTheDocument()
    })

    expect(screen.getByText('A quirky comedy about office life in the future')).toBeInTheDocument()
  })

  it('shows Under Review badge for each pitch', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      const underReviewBadges = screen.getAllByText('Under Review')
      expect(underReviewBadges).toHaveLength(2)
    })
  })

  it('renders status banner with count', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/2 pitches currently under review/)).toBeInTheDocument()
    })
  })

  it('renders search input', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search pitches under review...')).toBeInTheDocument()
    })
  })

  it('renders View Details button for each pitch', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      const viewDetailsButtons = screen.getAllByText('View Details')
      expect(viewDetailsButtons).toHaveLength(2)
    })
  })

  it('shows empty state when no pitches under review', async () => {
    mockGetMyPitches.mockResolvedValue([])

    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No Pitches Under Review')).toBeInTheDocument()
    })

    expect(screen.getByText('View My Pitches')).toBeInTheDocument()
  })

  it('shows error state when API fails', async () => {
    mockGetMyPitches.mockRejectedValue(new Error('Network failed'))

    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to load pitches')).toBeInTheDocument()
    })

    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('filters out non-review pitches', async () => {
    mockGetMyPitches.mockResolvedValue([
      ...mockReviewPitches,
      {
        id: 99,
        userId: 1,
        title: 'Published Pitch',
        logline: 'This is already published',
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
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Thriller Under Review')).toBeInTheDocument()
    })

    // Published pitch should not appear
    expect(screen.queryByText('Published Pitch')).not.toBeInTheDocument()
  })

  it('renders genre and format metadata', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('thriller')).toBeInTheDocument()
    })

    expect(screen.getByText('feature')).toBeInTheDocument()
  })

  it('renders view count for pitches', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('120 views')).toBeInTheDocument()
    })

    expect(screen.getByText('80 views')).toBeInTheDocument()
  })

  it('calls getMyPitches on mount', async () => {
    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockGetMyPitches).toHaveBeenCalled()
    })
  })

  it('shows singular pitch count in banner for one pitch', async () => {
    mockGetMyPitches.mockResolvedValue([mockReviewPitches[0]])

    render(
      <MemoryRouter>
        <CreatorPitchesReview />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/1 pitch currently under review/)).toBeInTheDocument()
    })
  })
})
