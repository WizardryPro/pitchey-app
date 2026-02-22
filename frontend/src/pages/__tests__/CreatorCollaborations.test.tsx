import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockGetCollaborations = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Collaboration Service ───────────────────────────────────────────
vi.mock('../../services/collaboration.service', () => ({
  CollaborationService: {
    getCollaborations: mockGetCollaborations,
  },
}))

// ─── Mock data ───────────────────────────────────────────────────────
const mockCollaborations = [
  {
    id: 'collab-1',
    title: 'Sci-Fi Thriller Co-Creation',
    type: 'co-creation',
    status: 'active',
    partner: {
      id: 'partner-1',
      name: 'Jane Producer',
      type: 'production',
      company: 'Stellar Studios',
      verified: true,
    },
    project: {
      id: 'proj-1',
      title: 'Space Opera',
      genre: 'scifi',
    },
    description: 'Working together on a sci-fi feature film',
    terms: {
      budget: 500000,
      equity: 20,
      timeline: '12 months',
    },
    proposedDate: '2026-01-01T00:00:00Z',
    startDate: '2026-01-15T00:00:00Z',
    lastUpdate: '2026-02-01T00:00:00Z',
    priority: 'high',
    isPublic: true,
    metrics: {
      rating: 8,
      reviews: 3,
      completionRate: 65,
    },
  },
  {
    id: 'collab-2',
    title: 'Drama Investment Deal',
    type: 'investment',
    status: 'pending',
    partner: {
      id: 'partner-2',
      name: 'Bob Investor',
      type: 'investor',
      company: 'Capital Films LLC',
      verified: false,
    },
    description: 'Investment opportunity for drama series',
    terms: {
      budget: 250000,
      equity: 15,
    },
    proposedDate: '2026-02-01T00:00:00Z',
    lastUpdate: '2026-02-10T00:00:00Z',
    priority: 'medium',
    isPublic: false,
  },
]

let CreatorCollaborations: React.ComponentType

beforeAll(async () => {
  const mod = await import('../creator/CreatorCollaborations')
  CreatorCollaborations = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCollaborations.mockResolvedValue(mockCollaborations)
})

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
})

describe('CreatorCollaborations', () => {
  it('shows loading spinner initially', () => {
    mockGetCollaborations.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    // animate-spin is used for the loading spinner
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders page title after loading', async () => {
    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Collaborations')).toBeInTheDocument()
    })
  })

  it('renders collaboration items', async () => {
    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Sci-Fi Thriller Co-Creation')).toBeInTheDocument()
    })

    expect(screen.getByText('Drama Investment Deal')).toBeInTheDocument()
  })

  it('renders partner names', async () => {
    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Jane Producer')).toBeInTheDocument()
    })

    expect(screen.getByText('Bob Investor')).toBeInTheDocument()
  })

  it('renders collaboration descriptions', async () => {
    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Working together on a sci-fi feature film')).toBeInTheDocument()
    })

    expect(screen.getByText('Investment opportunity for drama series')).toBeInTheDocument()
  })

  it('renders stats overview cards', async () => {
    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument()
    })

    // "Active" appears in both the stats card and the status badge, so use getAllByText
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    // "Pending" appears in both the stats card and the status badge
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
  })

  it('shows correct total count', async () => {
    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Collaborations')).toBeInTheDocument()
    })

    // 2 collaborations total
    const twos = screen.getAllByText('2')
    expect(twos.length).toBeGreaterThan(0)
  })

  it('renders search input', async () => {
    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search collaborations...')).toBeInTheDocument()
    })
  })

  it('renders filter dropdowns', async () => {
    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('All Types')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('All Status')).toBeInTheDocument()
    expect(screen.getByDisplayValue('All Partners')).toBeInTheDocument()
    expect(screen.getByDisplayValue('All Time')).toBeInTheDocument()
  })

  it('renders action buttons', async () => {
    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('New Collaboration')).toBeInTheDocument()
    })

    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('shows empty state when no collaborations', async () => {
    mockGetCollaborations.mockResolvedValue([])

    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No collaborations found')).toBeInTheDocument()
    })

    expect(screen.getByText('Start building partnerships to grow your creative projects.')).toBeInTheDocument()
  })

  it('shows error state when API fails', async () => {
    mockGetCollaborations.mockRejectedValue(new Error('Failed to fetch collaborations'))

    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No collaborations found')).toBeInTheDocument()
    })
  })

  it('shows View Details button for each collaboration', async () => {
    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      const viewButtons = screen.getAllByText('View Details')
      expect(viewButtons).toHaveLength(2)
    })
  })

  it('shows High Priority badge for high priority item', async () => {
    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('High Priority')).toBeInTheDocument()
    })
  })

  it('calls getCollaborations on mount', async () => {
    render(
      <MemoryRouter>
        <CreatorCollaborations />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockGetCollaborations).toHaveBeenCalled()
    })
  })
})
