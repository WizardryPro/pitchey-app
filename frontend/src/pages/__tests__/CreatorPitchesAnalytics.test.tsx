import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── CreatorService mock ─────────────────────────────────────────────
const mockGetAnalytics = vi.fn()
vi.mock('../../services/creator.service', () => ({
  CreatorService: {
    getAnalytics: mockGetAnalytics,
  },
}))

// ─── PitchService mock ───────────────────────────────────────────────
const mockGetMyPitches = vi.fn()
vi.mock('../../services/pitch.service', () => ({
  PitchService: {
    getMyPitches: mockGetMyPitches,
  },
}))

// ─── Dynamic component import ─────────────────────────────────────────
let CreatorPitchesAnalytics: React.ComponentType
beforeAll(async () => {
  const mod = await import('../creator/CreatorPitchesAnalytics')
  CreatorPitchesAnalytics = mod.default
})

const mockAnalytics = {
  topPitches: [
    { id: 1, title: 'Top Pitch One', views: 500, likes: 40, ndas: 5 },
    { id: 2, title: 'Top Pitch Two', views: 300, likes: 20, ndas: 2 },
  ],
  audienceBreakdown: [
    { userType: 'investor', count: 80, percentage: 80 },
    { userType: 'production', count: 20, percentage: 20 },
  ],
  engagementByGenre: [
    { genre: 'drama', views: 400, likes: 30, conversionRate: 7.5 },
  ],
}

const mockPitches = [
  {
    id: 1,
    title: 'Published Pitch Alpha',
    genre: 'drama',
    status: 'published',
    viewCount: 200,
    likeCount: 15,
    ndaCount: 3,
    publishedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    title: 'Published Pitch Beta',
    genre: 'comedy',
    status: 'published',
    viewCount: 100,
    likeCount: 8,
    ndaCount: 1,
    publishedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 3,
    title: 'Draft Pitch Gamma',
    genre: 'action',
    status: 'draft',
    viewCount: 0,
    likeCount: 0,
    ndaCount: 0,
  },
]

function renderComponent() {
  return render(
    <MemoryRouter>
      <CreatorPitchesAnalytics />
    </MemoryRouter>
  )
}

describe('CreatorPitchesAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAnalytics.mockResolvedValue(mockAnalytics)
    mockGetMyPitches.mockResolvedValue(mockPitches)
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  describe('Loading state', () => {
    it('shows skeleton/loading state initially', () => {
      // Make the promises hang so we stay in loading state
      mockGetAnalytics.mockReturnValue(new Promise(() => {}))
      mockGetMyPitches.mockReturnValue(new Promise(() => {}))
      renderComponent()
      // Pulse skeleton elements should be present
      const pulseElements = document.querySelectorAll('.animate-pulse')
      expect(pulseElements.length).toBeGreaterThan(0)
    })
  })

  describe('Layout and header', () => {
    it('renders page title after loading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pitch Analytics')).toBeInTheDocument()
      })
    })

    it('renders description text', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Track performance and engagement metrics/i)).toBeInTheDocument()
      })
    })
  })

  describe('Summary cards', () => {
    it('renders all four summary card labels', async () => {
      renderComponent()
      await waitFor(() => {
        // Use getAllByText since some labels may appear multiple times (e.g. in dropdown)
        expect(screen.getAllByText('Total Views').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Total Likes').length).toBeGreaterThan(0)
        expect(screen.getAllByText('NDA Requests').length).toBeGreaterThan(0)
        expect(screen.getByText('Engagement Rate')).toBeInTheDocument()
      })
    })

    it('computes total views from published pitches only', async () => {
      renderComponent()
      // published pitches have 200 + 100 = 300 views
      // "300" appears as the value in the Total Views card
      await waitFor(() => {
        expect(screen.getAllByText('300').length).toBeGreaterThan(0)
      })
    })

    it('computes total likes from published pitches', async () => {
      renderComponent()
      // 15 + 8 = 23 likes
      await waitFor(() => {
        expect(screen.getByText('23')).toBeInTheDocument()
      })
    })

    it('computes total NDA requests from published pitches', async () => {
      renderComponent()
      // 3 + 1 = 4 NDAs
      await waitFor(() => {
        expect(screen.getByText('4')).toBeInTheDocument()
      })
    })
  })

  describe('Top performing pitches section', () => {
    it('renders top performing pitches from analytics data', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Top Performing Pitches')).toBeInTheDocument()
        expect(screen.getByText('Top Pitch One')).toBeInTheDocument()
        expect(screen.getByText('Top Pitch Two')).toBeInTheDocument()
      })
    })
  })

  describe('Audience breakdown section', () => {
    it('renders audience breakdown when data is available', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Audience Breakdown')).toBeInTheDocument()
        expect(screen.getByText(/investors/i)).toBeInTheDocument()
      })
    })
  })

  describe('Per-pitch performance table', () => {
    it('renders the per-pitch section header', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Per-Pitch Performance')).toBeInTheDocument()
      })
    })

    it('shows published pitch count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/2 published pitches/i)).toBeInTheDocument()
      })
    })

    it('renders published pitches in the table', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Published Pitch Alpha')).toBeInTheDocument()
        expect(screen.getByText('Published Pitch Beta')).toBeInTheDocument()
      })
    })

    it('does not render draft pitches in the table', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.queryByText('Draft Pitch Gamma')).not.toBeInTheDocument()
      })
    })

    it('renders sort-by select control', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
    })

    it('shows Views, Likes, and NDA Requests sort options', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Views' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Likes' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'NDA Requests' })).toBeInTheDocument()
      })
    })
  })

  describe('Engagement by genre section', () => {
    it('renders engagement by genre when data is available', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Engagement by Genre')).toBeInTheDocument()
        // "drama" may appear multiple times (in pitch table and genre section)
        expect(screen.getAllByText(/drama/i).length).toBeGreaterThan(0)
      })
    })

    it('shows conversion rate for genre', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/7\.5% conversion/i)).toBeInTheDocument()
      })
    })
  })

  describe('Empty state', () => {
    it('shows empty state when no published pitches exist', async () => {
      mockGetMyPitches.mockResolvedValue([
        { id: 1, title: 'Draft Only', genre: 'drama', status: 'draft', viewCount: 0, likeCount: 0, ndaCount: 0 },
      ])
      mockGetAnalytics.mockResolvedValue({ topPitches: [], audienceBreakdown: [], engagementByGenre: [] })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No published pitches yet')).toBeInTheDocument()
      })
    })

    it('shows empty state message when no pitches at all', async () => {
      mockGetMyPitches.mockResolvedValue([])
      mockGetAnalytics.mockResolvedValue({ topPitches: [], audienceBreakdown: [], engagementByGenre: [] })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Publish a pitch to start seeing analytics/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error state', () => {
    it('shows error message when API fails', async () => {
      mockGetAnalytics.mockRejectedValue(new Error('Network error'))
      mockGetMyPitches.mockRejectedValue(new Error('Network error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics')).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      mockGetAnalytics.mockRejectedValue(new Error('Server error'))
      mockGetMyPitches.mockRejectedValue(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })
  })
})
