import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mock functions
const mockNavigate = vi.fn()
const mockGetSavedPitches = vi.fn()
const mockUnsavePitch = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

vi.mock('../../services/saved-pitches.service', () => ({
  SavedPitchesService: {
    getSavedPitches: (...args: any[]) => mockGetSavedPitches(...args),
    unsavePitch: (...args: any[]) => mockUnsavePitch(...args),
  },
}))

const mockSavedPitchesResponse = {
  savedPitches: [
    {
      pitchId: 1,
      pitch_id: 1,
      title: 'Space Odyssey',
      genre: 'Sci-Fi',
      format: 'Feature Film',
      status: 'Under Review',
      title_image: 'https://example.com/img.jpg',
      view_count: 1200,
      like_count: 80,
      creator_username: 'jane_creator',
      saved_at: '2026-02-10T00:00:00Z',
      notes: 'Promising sci-fi concept',
      pitch: null,
    },
    {
      pitchId: 2,
      pitch_id: 2,
      title: 'Comedy Gold',
      genre: 'Comedy',
      format: 'TV Series',
      status: 'Shortlisted',
      title_image: '',
      view_count: 500,
      like_count: 30,
      creator_username: 'bob_creator',
      saved_at: '2026-02-05T00:00:00Z',
      notes: '',
      pitch: null,
    },
  ],
}

let Component: React.ComponentType

beforeAll(async () => {
  const mod = await import('../production/ProductionSaved')
  Component = mod.default
})

describe('ProductionSaved', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading skeletons while fetching', () => {
    mockGetSavedPitches.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    // Skeleton component renders with the given className
    const skeletons = document.querySelectorAll('[class*="h-48"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  // ─── Layout ───────────────────────────────────────────────────────

  it('renders page header and subtitle', async () => {
    mockGetSavedPitches.mockResolvedValue(mockSavedPitchesResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Saved Pitches')).toBeInTheDocument()
    })
    expect(screen.getByText('Your bookmarked pitches for future consideration')).toBeInTheDocument()
  })

  // ─── Data ─────────────────────────────────────────────────────────

  it('displays saved pitch cards after loading', async () => {
    mockGetSavedPitches.mockResolvedValue(mockSavedPitchesResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Space Odyssey')).toBeInTheDocument()
    })
    expect(screen.getByText('Comedy Gold')).toBeInTheDocument()
    expect(screen.getByText('by jane_creator')).toBeInTheDocument()
    expect(screen.getByText('by bob_creator')).toBeInTheDocument()
  })

  it('shows genre and format badges', async () => {
    mockGetSavedPitches.mockResolvedValue(mockSavedPitchesResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Space Odyssey')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Sci-Fi').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Feature Film').length).toBeGreaterThanOrEqual(1)
  })

  it('shows notes when present', async () => {
    mockGetSavedPitches.mockResolvedValue(mockSavedPitchesResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Promising sci-fi concept/)).toBeInTheDocument()
    })
  })

  it('shows saved pitches count', async () => {
    mockGetSavedPitches.mockResolvedValue(mockSavedPitchesResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('2 saved pitches')).toBeInTheDocument()
    })
  })

  // ─── Empty State ──────────────────────────────────────────────────

  it('shows empty state when no saved pitches', async () => {
    mockGetSavedPitches.mockResolvedValue({ savedPitches: [] })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No saved pitches')).toBeInTheDocument()
    })
    expect(screen.getByText('Start browsing and save pitches you\'re interested in')).toBeInTheDocument()
    expect(screen.getByText('Browse Pitches')).toBeInTheDocument()
  })

  // ─── Error State ──────────────────────────────────────────────────

  it('shows error alert when API fails', async () => {
    mockGetSavedPitches.mockRejectedValue(new Error('Network error'))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Error loading saved pitches')).toBeInTheDocument()
    })
    expect(screen.getByText('Network error')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  // ─── Search / Filter ─────────────────────────────────────────────

  it('filters pitches by search term', async () => {
    mockGetSavedPitches.mockResolvedValue(mockSavedPitchesResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Space Odyssey')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search saved pitches...')
    fireEvent.change(searchInput, { target: { value: 'Space' } })

    await waitFor(() => {
      expect(screen.getByText('Space Odyssey')).toBeInTheDocument()
      expect(screen.queryByText('Comedy Gold')).not.toBeInTheDocument()
    })
  })

  it('renders Saved by Category section when pitches exist', async () => {
    mockGetSavedPitches.mockResolvedValue(mockSavedPitchesResponse)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Saved by Category')).toBeInTheDocument()
    })
  })
})
