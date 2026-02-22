import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mock functions
const mockNavigate = vi.fn()
const mockPitchGetPublicById = vi.fn()
const mockPitchGetById = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '42' }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

vi.mock('../../lib/api', () => ({
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

vi.mock('../../components/FormatDisplay', () => ({
  default: ({ format, formatCategory, formatSubtype, variant }: any) => (
    <span data-testid="format-display">{formatSubtype || format || 'Unknown'}</span>
  ),
}))

vi.mock('../../config/subscription-plans', () => ({
  getCreditCost: (action: string) => action === 'nda_request' ? 10 : 5,
}))

const mockPitch = {
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
  status: 'published',
  visibility: 'public',
  views: 1500,
  likes: 200,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
  hasSignedNDA: false,
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
}

let Component: React.ComponentType

beforeAll(async () => {
  const mod = await import('../production/ProductionPitchView')
  Component = mod.default
})

describe('ProductionPitchView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // ─── Loading State ────────────────────────────────────────────────

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

  // ─── Error State ──────────────────────────────────────────────────

  it('shows error state when API fails', async () => {
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
    mockPitchGetPublicById.mockRejectedValue(new Error('Not found'))
    mockPitchGetById.mockRejectedValue(new Error('Not found'))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Back to Dashboard'))
    expect(mockNavigate).toHaveBeenCalledWith('/production/dashboard')
  })

  // ─── Layout & Data ───────────────────────────────────────────────

  it('renders pitch title and details after loading', async () => {
    mockPitchGetPublicById.mockResolvedValue(mockPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('The Great Adventure')).toBeInTheDocument()
    })
    expect(screen.getByText(/Alex Creator/)).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getAllByText('medium').length).toBeGreaterThanOrEqual(1)
  })

  it('renders logline in overview tab', async () => {
    mockPitchGetPublicById.mockResolvedValue(mockPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/A hero embarks on a journey/)).toBeInTheDocument()
    })
  })

  it('renders characters and locations', async () => {
    mockPitchGetPublicById.mockResolvedValue(mockPitch)

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
    mockPitchGetPublicById.mockResolvedValue(mockPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Indiana Jones, Jurassic Park')).toBeInTheDocument()
    })
  })

  // ─── Header Actions ──────────────────────────────────────────────

  it('renders action buttons in header', async () => {
    mockPitchGetPublicById.mockResolvedValue(mockPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Add to Shortlist')).toBeInTheDocument()
    })
    expect(screen.getByText('Contact Creator')).toBeInTheDocument()
    expect(screen.getByText('Option Rights')).toBeInTheDocument()
  })

  it('navigates when Contact Creator is clicked', async () => {
    mockPitchGetPublicById.mockResolvedValue(mockPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Contact Creator')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Contact Creator'))
    expect(mockNavigate).toHaveBeenCalledWith('/production/messages?recipient=7&pitch=42')
  })

  // ─── Sidebar ─────────────────────────────────────────────────────

  it('shows production requirements sidebar', async () => {
    mockPitchGetPublicById.mockResolvedValue(mockPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Requirements')).toBeInTheDocument()
    })
    expect(screen.getByText('Production Actions')).toBeInTheDocument()
    expect(screen.getByText('Market Analysis')).toBeInTheDocument()
  })

  it('shows production materials section when documents exist', async () => {
    mockPitchGetPublicById.mockResolvedValue(mockPitch)

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
  })

  // ─── Tabs ────────────────────────────────────────────────────────

  it('renders all five tabs', async () => {
    mockPitchGetPublicById.mockResolvedValue(mockPitch)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('overview')).toBeInTheDocument()
    })
    expect(screen.getByText('Feasibility')).toBeInTheDocument()
    expect(screen.getByText('team')).toBeInTheDocument()
    expect(screen.getByText('schedule')).toBeInTheDocument()
    expect(screen.getByText('notes')).toBeInTheDocument()
  })

  it('shows NDA credit cost when NDA not signed', async () => {
    mockPitchGetPublicById.mockResolvedValue({ ...mockPitch, hasSignedNDA: false })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/10 credits/)).toBeInTheDocument()
    })
  })
})
