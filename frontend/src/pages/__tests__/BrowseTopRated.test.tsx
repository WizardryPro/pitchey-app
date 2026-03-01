import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/utils'
import BrowseTopRated from '../BrowseTopRated'

// Mock config
vi.mock('../../config', () => ({
  getApiUrl: () => 'http://localhost:8001',
  API_URL: 'http://localhost:8001',
}))

// Mock config service
vi.mock('../../services/config.service', () => ({
  configService: {
    getConfiguration: vi.fn().mockResolvedValue({}),
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

const mockTopRatedPitches = [
  {
    id: 1,
    title: 'Top Rated Pitch',
    logline: 'An amazing pitch',
    genre: 'Sci-Fi',
    format: 'Feature Film',
    viewCount: 500,
    likeCount: 100,
    rating: 4.8,
    createdAt: '2026-01-01',
    creator: { username: 'creator1', userType: 'creator' },
  },
]

describe('BrowseTopRated', () => {
  let abortSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    abortSpy = vi.spyOn(AbortController.prototype, 'abort')

    vi.mocked(global.fetch).mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      if (urlStr.includes('/api/browse/top-rated/stats')) {
        return {
          ok: true,
          json: async () => ({
            stats: {
              totalRated: 50,
              averageRating: 3.8,
              ratingDistribution: { 5: 10, 4: 15, 3: 12, 2: 8, 1: 5 },
            },
          }),
        } as Response
      }
      if (urlStr.includes('/api/browse/top-rated')) {
        return {
          ok: true,
          json: async () => ({
            items: mockTopRatedPitches,
            total: 1,
            totalPages: 1,
          }),
        } as Response
      }
      return { ok: false, json: async () => ({}) } as Response
    })
  })

  describe('Rendering', () => {
    it('renders page header and stats', async () => {
      render(<BrowseTopRated />)

      await waitFor(() => {
        expect(screen.getByText('Top Rated Pitches')).toBeInTheDocument()
      })
    })

    it('displays top rated pitches', async () => {
      render(<BrowseTopRated />)

      await waitFor(() => {
        expect(screen.getByText('Top Rated Pitch')).toBeInTheDocument()
      })
    })

    it('shows rating stats when available', async () => {
      render(<BrowseTopRated />)

      await waitFor(() => {
        expect(screen.getByText('3.8/5.0')).toBeInTheDocument()
        expect(screen.getByText('50')).toBeInTheDocument()
      })
    })
  })

  describe('AbortController - Stale Response Protection', () => {
    it('passes AbortSignal to fetch requests', async () => {
      render(<BrowseTopRated />)

      await waitFor(() => {
        const calls = vi.mocked(global.fetch).mock.calls
        const topRatedCalls = calls.filter(c => {
          const urlStr = typeof c[0] === 'string' ? c[0] : ''
          return urlStr.includes('/api/browse/top-rated') && !urlStr.includes('/stats')
        })
        expect(topRatedCalls.length).toBeGreaterThanOrEqual(1)

        // Verify signal is present
        const opts = topRatedCalls[0][1] as RequestInit
        expect(opts.signal).toBeDefined()
        expect(opts.signal).toBeInstanceOf(AbortSignal)
      })
    })

    it('aborts previous request when filters change', async () => {
      const signals: AbortSignal[] = []

      vi.mocked(global.fetch).mockImplementation(async (url, opts) => {
        const urlStr = typeof url === 'string' ? url : url.toString()
        if (urlStr.includes('/api/browse/top-rated/stats')) {
          return { ok: true, json: async () => ({ stats: null }) } as Response
        }
        if (urlStr.includes('/api/browse/top-rated')) {
          if (opts?.signal) signals.push(opts.signal)
          return {
            ok: true,
            json: async () => ({ items: mockTopRatedPitches, total: 1, totalPages: 1 }),
          } as Response
        }
        return { ok: false, json: async () => ({}) } as Response
      })

      render(<BrowseTopRated />)

      // Wait for initial data to display
      await waitFor(() => {
        expect(screen.getByText('Top Rated Pitch')).toBeInTheDocument()
      })

      expect(signals.length).toBeGreaterThanOrEqual(1)
      const firstSignal = signals[0]
      expect(firstSignal.aborted).toBe(false)

      // Open filters and change sort — triggers a new fetch which aborts previous
      fireEvent.click(screen.getByText('Filters & Sorting'))
      await waitFor(() => expect(screen.getByText('Most Viewed')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Most Viewed'))

      // Wait for the new fetch to be made
      await waitFor(() => {
        expect(signals.length).toBeGreaterThanOrEqual(2)
      })

      // The first signal should now be aborted, the latest should not
      expect(firstSignal.aborted).toBe(true)
      expect(signals[signals.length - 1].aborted).toBe(false)
    })
  })

  describe('Empty State', () => {
    it('shows empty state when no pitches match filters', async () => {
      vi.mocked(global.fetch).mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : url.toString()
        if (urlStr.includes('/api/browse/top-rated/stats')) {
          return { ok: true, json: async () => ({ stats: null }) } as Response
        }
        if (urlStr.includes('/api/browse/top-rated')) {
          return {
            ok: true,
            json: async () => ({ items: [], total: 0, totalPages: 0 }),
          } as Response
        }
        return { ok: false, json: async () => ({}) } as Response
      })

      render(<BrowseTopRated />)

      await waitFor(() => {
        expect(screen.getByText('No top rated pitches found')).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })
})
