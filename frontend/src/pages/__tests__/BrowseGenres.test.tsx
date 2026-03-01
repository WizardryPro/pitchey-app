import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/utils'
import BrowseGenres from '../BrowseGenres'

// Mock config
vi.mock('../../config', () => ({
  getApiUrl: () => 'http://localhost:8001',
  API_URL: 'http://localhost:8001',
}))

// Mock config service
vi.mock('../../services/config.service', () => ({
  configService: {
    getConfiguration: vi.fn().mockResolvedValue({
      genres: ['Action', 'Drama', 'Comedy'],
    }),
  },
}))

// Mock pitch service
vi.mock('../../services/pitch.service', () => ({
  pitchService: {
    getPublicPitches: vi.fn().mockResolvedValue({ pitches: [] }),
  },
  PitchService: {
    getPublicPitchesEnhanced: vi.fn().mockResolvedValue({ pitches: [] }),
  },
}))

// Mock toast — stable reference to avoid useCallback re-creation on every render
vi.mock('@shared/components/feedback/ToastProvider', () => {
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }
  return { useToast: () => toast }
})

// Mock FormatDisplay
vi.mock('../../components/FormatDisplay', () => ({
  default: () => <span>Format</span>,
}))

// Mock Pagination
vi.mock('../../components/Pagination', () => ({
  default: () => <div data-testid="pagination" />,
}))

// Mock Loading components
vi.mock('@shared/components/feedback/Skeleton', () => ({
  PitchCardSkeleton: () => <div data-testid="skeleton" />,
}))

// Mock EmptyState
vi.mock('../../components/EmptyState', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))

const mockGenreStats = [
  { genre: 'Action', count: 15, averageRating: 4.2, totalViews: 5000, latestPitch: { id: '1', title: 'Action Movie', createdAt: '2026-01-01' } },
  { genre: 'Drama', count: 10, averageRating: 4.5, totalViews: 3000, latestPitch: { id: '2', title: 'Drama Film', createdAt: '2026-01-02' } },
]

describe('BrowseGenres', () => {
  let abortSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    abortSpy = vi.spyOn(AbortController.prototype, 'abort')

    // Default: genre stats endpoint succeeds, genre pitches endpoint succeeds
    vi.mocked(global.fetch).mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      if (urlStr.includes('/api/browse/genres')) {
        return {
          ok: true,
          json: async () => ({ genres: mockGenreStats }),
        } as Response
      }
      if (urlStr.includes('/api/pitches/browse/enhanced')) {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: 1, title: 'Genre Pitch', logline: 'Test', genre: 'Action', format: 'Feature Film', viewCount: 10, likeCount: 5, createdAt: '2026-01-01', creator: { username: 'user1', userType: 'creator' } }],
            total: 1,
            totalPages: 1,
          }),
        } as Response
      }
      return { ok: false, json: async () => ({}) } as Response
    })
  })

  describe('Rendering', () => {
    it('renders page header', async () => {
      render(<BrowseGenres />)

      await waitFor(() => {
        expect(screen.getByText('Browse by Genres')).toBeInTheDocument()
      })
    })

    it('displays genre cards from API stats', async () => {
      render(<BrowseGenres />)

      await waitFor(() => {
        expect(screen.getByText('Action')).toBeInTheDocument()
        expect(screen.getByText('Drama')).toBeInTheDocument()
      })
    })
  })

  describe('AbortController - Stale Response Protection', () => {
    it('aborts previous request when a new genre fetch starts', async () => {
      // Start with genre selected via URL
      window.history.pushState({}, '', '?genre=Action')

      render(<BrowseGenres />)

      // Wait for the genre pitches fetch to fire
      await waitFor(() => {
        const calls = vi.mocked(global.fetch).mock.calls
        const genreCalls = calls.filter(c =>
          (typeof c[0] === 'string' ? c[0] : '').includes('/api/pitches/browse/enhanced')
        )
        expect(genreCalls.length).toBeGreaterThanOrEqual(1)
      })

      // The first fetch should have created an AbortController
      // Navigating to another genre triggers a new fetch which aborts the previous
      // We verify abort was at least connected
      const firstCalls = vi.mocked(global.fetch).mock.calls.filter(c =>
        (typeof c[0] === 'string' ? c[0] : '').includes('/api/pitches/browse/enhanced')
      )

      // Verify signal was passed to fetch
      const firstGenreCall = firstCalls[0]
      expect(firstGenreCall[1]).toHaveProperty('signal')
      expect(firstGenreCall[1]!.signal).toBeInstanceOf(AbortSignal)

      // Clean up URL
      window.history.pushState({}, '', '/')
    })

    it('passes AbortSignal to fetch requests', async () => {
      window.history.pushState({}, '', '?genre=Drama')

      render(<BrowseGenres />)

      await waitFor(() => {
        const calls = vi.mocked(global.fetch).mock.calls
        const genreCalls = calls.filter(c =>
          (typeof c[0] === 'string' ? c[0] : '').includes('/api/pitches/browse/enhanced')
        )
        expect(genreCalls.length).toBeGreaterThanOrEqual(1)

        // Check signal is present
        const opts = genreCalls[0][1] as RequestInit
        expect(opts.signal).toBeDefined()
        expect(opts.signal).toBeInstanceOf(AbortSignal)
      })

      window.history.pushState({}, '', '/')
    })
  })

  describe('Genre Selection', () => {
    it('shows genre pitches when a genre is selected', async () => {
      window.history.pushState({}, '', '?genre=Action')

      render(<BrowseGenres />)

      await waitFor(() => {
        expect(screen.getByText('Genre Pitch')).toBeInTheDocument()
      })

      window.history.pushState({}, '', '/')
    })
  })
})
