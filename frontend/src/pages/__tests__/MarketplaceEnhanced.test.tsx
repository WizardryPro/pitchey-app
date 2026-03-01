import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import MarketplaceEnhanced from '../MarketplaceEnhanced'

// Hoisted mocks
const { mockPitchService, mockPitchAPI, mockNavigate, mockAuthStore } = vi.hoisted(() => ({
  mockPitchService: {
    getPublicPitchesEnhanced: vi.fn(),
    getPublicPitches: vi.fn(),
    getById: vi.fn(),
  },
  mockPitchAPI: {
    browse: vi.fn(),
    search: vi.fn(),
  },
  mockNavigate: vi.fn(),
  mockAuthStore: {
    isAuthenticated: false,
    user: null as any,
  },
}))

vi.mock('../../services/pitch.service', () => ({
  pitchService: mockPitchService,
  PitchService: mockPitchService,
}))

vi.mock('../../lib/api', () => ({
  pitchAPI: mockPitchAPI,
}))

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthStore,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/marketplace', search: '' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

vi.mock('framer-motion', () => {
  const createMotionComponent = (tag: string) => {
    const Component = ({ children, ...props }: any) => {
      // Strip framer-motion-specific props
      const { initial, animate, exit, transition, whileHover, whileTap, variants, layout, ...rest } = props
      const Tag = tag as any
      return <Tag {...rest}>{children}</Tag>
    }
    Component.displayName = `motion.${tag}`
    return Component
  }
  return {
    motion: new Proxy({}, {
      get: (_target, prop: string) => createMotionComponent(prop),
    }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
  }
})

vi.mock('../../components/FollowButton', () => ({
  default: () => <button>Follow</button>,
}))

vi.mock('@shared/components/feedback/Skeleton', () => ({
  PitchCardSkeleton: () => <div data-testid="skeleton">Loading skeleton</div>,
}))

vi.mock('../../components/EmptyState', () => ({
  default: ({ title, description }: any) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{description}</p>
    </div>
  ),
}))

vi.mock('@shared/components/feedback/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

vi.mock('../../components/Pagination', () => ({
  default: () => <div data-testid="pagination">Pagination</div>,
}))

vi.mock('../../components/FormatDisplay', () => ({
  default: ({ format }: any) => <span>{format || 'Feature Film'}</span>,
}))

vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: (val: any) => val,
}))

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}))

vi.mock('../../services/config.service', () => ({
  configService: { getConfiguration: vi.fn().mockResolvedValue({}) },
}))

vi.mock('../../constants/brand', () => ({
  BRAND: { name: 'Pitchey', tagline: 'Your Pitch Platform' },
}))

vi.mock('../../utils/navigation', () => ({
  getDashboardRoute: () => '/dashboard',
}))

const createMockPitch = (id: number, overrides = {}) => ({
  id,
  title: `Test Pitch ${id}`,
  logline: `Logline for pitch ${id}`,
  genre: 'Drama',
  format: 'Feature Film',
  status: 'published',
  viewCount: 100 * id,
  likeCount: 10 * id,
  createdAt: '2026-01-01T00:00:00Z',
  creator: { id: id * 10, name: `Creator ${id}`, username: `creator${id}` },
  titleImage: null,
  hasNDA: false,
  seekingInvestment: false,
  estimatedBudget: '1 million',
  ...overrides,
})

describe('MarketplaceEnhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })

    const defaultPitches = [createMockPitch(1), createMockPitch(2), createMockPitch(3)]
    mockPitchAPI.browse.mockResolvedValue({ items: defaultPitches, total: 3 })
    mockPitchService.getPublicPitchesEnhanced.mockResolvedValue({ pitches: defaultPitches })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  // ─── Initial Render ────────────────────────────────────────────────

  describe('Initial Render', () => {
    it('renders marketplace heading', async () => {
      render(<MarketplaceEnhanced />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /marketplace/i })).toBeInTheDocument()
      })
    })

    it('renders search input', async () => {
      render(<MarketplaceEnhanced />)

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search/i)
        expect(searchInput).toBeInTheDocument()
      })
    })

    it('displays pitches after loading', async () => {
      render(<MarketplaceEnhanced />)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
        expect(screen.getByText('Test Pitch 2')).toBeInTheDocument()
      })
    })
  })

  // ─── Search ────────────────────────────────────────────────────────

  describe('Search', () => {
    it('updates search input value', async () => {
      const u = userEvent.setup()
      render(<MarketplaceEnhanced />)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/search/i)
      await u.type(input, 'action movie')
      expect(input).toHaveValue('action movie')
    })
  })

  // ─── Loading and Error States ──────────────────────────────────────

  describe('Loading and Error States', () => {
    it('shows skeletons while loading', () => {
      mockPitchAPI.browse.mockReturnValue(new Promise(() => {}))
      mockPitchService.getPublicPitchesEnhanced.mockReturnValue(new Promise(() => {}))

      render(<MarketplaceEnhanced />)
      const skeletons = screen.getAllByTestId('skeleton')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('shows pitches after loading', async () => {
      render(<MarketplaceEnhanced />)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
        expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument()
      })
    })
  })

  // ─── Pitch Card Rendering ──────────────────────────────────────────

  describe('Pitch Card Rendering', () => {
    it('renders pitch cards with titles', async () => {
      render(<MarketplaceEnhanced />)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
        expect(screen.getByText('Test Pitch 2')).toBeInTheDocument()
        expect(screen.getByText('Test Pitch 3')).toBeInTheDocument()
      })
    })

    it('shows genre badge on pitch cards', async () => {
      mockPitchAPI.browse.mockResolvedValue({
        items: [createMockPitch(1, { genre: 'Sci-Fi' })],
        total: 1,
      })
      mockPitchService.getPublicPitchesEnhanced.mockResolvedValue({
        pitches: [createMockPitch(1, { genre: 'Sci-Fi' })],
      })

      render(<MarketplaceEnhanced />)

      await waitFor(() => {
        expect(screen.getByText('Sci-Fi')).toBeInTheDocument()
      })
    })

    it('shows NDA badge on NDA-protected pitches', async () => {
      mockPitchAPI.browse.mockResolvedValue({
        items: [createMockPitch(1, { hasNDA: true })],
        total: 1,
      })
      mockPitchService.getPublicPitchesEnhanced.mockResolvedValue({
        pitches: [createMockPitch(1, { hasNDA: true })],
      })

      render(<MarketplaceEnhanced />)

      await waitFor(() => {
        expect(screen.getByText('NDA')).toBeInTheDocument()
      })
    })
  })

  // ─── Connectivity ──────────────────────────────────────────────────

  describe('Connectivity', () => {
    it('shows offline banner when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { writable: true, value: false })
      render(<MarketplaceEnhanced />)

      await waitFor(() => {
        expect(screen.getByText(/offline/i)).toBeInTheDocument()
      })
    })

    it('hides offline banner when online', async () => {
      render(<MarketplaceEnhanced />)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
      })
      expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
    })
  })
})
