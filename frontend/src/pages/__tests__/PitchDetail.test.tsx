import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import React from 'react'
import type { ComponentType } from 'react'

// Hoisted mock objects
const { mockPitchService, mockAuthStore, mockNavigate } = vi.hoisted(() => ({
  mockPitchService: {
    getById: vi.fn(),
    getByIdAuthenticated: vi.fn(),
    trackView: vi.fn(),
    likePitch: vi.fn(),
    unlikePitch: vi.fn(),
  },
  mockAuthStore: {
    isAuthenticated: false,
    user: null as any,
  },
  mockNavigate: vi.fn(),
}))

vi.mock('@features/pitches/services/pitch.service', () => ({
  pitchService: mockPitchService,
}))

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthStore,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../components/BackButton', () => ({
  default: () => <div data-testid="back-button">Back</div>,
}))

vi.mock('@features/ndas/components/NDA/EnhancedNDARequest', () => ({
  default: ({ isOpen, onSuccess }: any) =>
    isOpen ? (
      <div data-testid="nda-modal">
        <button onClick={onSuccess}>Sign NDA</button>
      </div>
    ) : null,
}))

vi.mock('../../components/FormatDisplay', () => ({
  default: ({ format }: any) => <span>{format || 'Feature Film'}</span>,
}))

vi.mock('../../utils/fileDownloads', () => ({
  createDownloadClickHandler: () => vi.fn(),
}))

const createMockPitch = (overrides = {}) => ({
  id: 1,
  title: 'Test Pitch',
  logline: 'A test logline',
  shortSynopsis: 'A test synopsis',
  genre: 'Drama',
  format: 'Feature Film',
  formatCategory: 'Film',
  status: 'published',
  viewCount: 100,
  likeCount: 10,
  isLiked: false,
  userId: 2,
  creator: { id: 2, name: 'Test Creator', username: 'testcreator', userType: 'creator' },
  createdAt: '2026-01-01T00:00:00Z',
  seekingInvestment: false,
  titleImage: null,
  scriptUrl: null,
  trailerUrl: null,
  isOwner: false,
  hasSignedNDA: false,
  hasNDA: false,
  protectedContent: null,
  ...overrides,
})

let PitchDetail: ComponentType

const renderPitchDetail = (pitchId = '1') =>
  render(
    <MemoryRouter initialEntries={[`/pitch/${pitchId}`]}>
      <Routes>
        <Route path="/pitch/:id" element={<PitchDetail />} />
      </Routes>
    </MemoryRouter>
  )

describe('PitchDetail', () => {
  beforeAll(async () => {
    const mod = await import('../PitchDetail')
    PitchDetail = mod.default
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.isAuthenticated = false
    mockAuthStore.user = null
    mockPitchService.getById.mockResolvedValue(createMockPitch())
    mockPitchService.trackView.mockResolvedValue(undefined)
    mockPitchService.likePitch.mockResolvedValue(undefined)
    mockPitchService.unlikePitch.mockResolvedValue(undefined)
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  // ─── Loading ───────────────────────────────────────────────────────

  describe('Loading State', () => {
    it('shows skeleton loading initially', () => {
      mockPitchService.getById.mockReturnValue(new Promise(() => {}))
      renderPitchDetail()

      const skeleton = document.querySelector('.animate-pulse')
      expect(skeleton).toBeTruthy()
    })
  })

  // ─── Unauthenticated ──────────────────────────────────────────────

  describe('Unauthenticated User', () => {
    it('fetches pitch via getById (public)', async () => {
      renderPitchDetail()

      await waitFor(() => {
        expect(mockPitchService.getById).toHaveBeenCalledWith(1)
      })
      expect(mockPitchService.getByIdAuthenticated).not.toHaveBeenCalled()
    })

    it('displays pitch title and metadata', async () => {
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getAllByText('Test Pitch').length).toBeGreaterThan(0)
      })
      expect(screen.getByText('A test logline')).toBeInTheDocument()
      expect(screen.getAllByText('Drama').length).toBeGreaterThan(0)
    })

    it('shows sign in prompt', async () => {
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getAllByText('Sign In to Interact').length).toBeGreaterThan(0)
      })
    })

    it('tracks view for non-owners', async () => {
      renderPitchDetail()

      await waitFor(() => {
        expect(mockPitchService.trackView).toHaveBeenCalledWith(1)
      })
    })

    it('navigates to portals on sign in click', async () => {
      const u = userEvent.setup()
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getAllByText('Sign In to Interact').length).toBeGreaterThan(0)
      })

      await u.click(screen.getAllByText('Sign In to Interact')[0])
      // PitchDetail now carries post-login return path via router state so the
      // user lands back on this pitch after auth (postLoginRedirect.ts).
      expect(mockNavigate).toHaveBeenCalledWith(
        '/portals',
        { state: { from: '/pitch/1' } },
      )
    })
  })

  // ─── Authenticated ─────────────────────────────────────────────────

  describe('Authenticated User', () => {
    beforeEach(() => {
      mockAuthStore.isAuthenticated = true
      mockAuthStore.user = { id: 3, email: 'user@test.com', name: 'User' }
      mockPitchService.getByIdAuthenticated.mockResolvedValue(createMockPitch())
    })

    it('fetches via getByIdAuthenticated', async () => {
      renderPitchDetail()

      await waitFor(() => {
        expect(mockPitchService.getByIdAuthenticated).toHaveBeenCalledWith(1)
      })
      expect(mockPitchService.getById).not.toHaveBeenCalled()
    })

    it('shows Request Enhanced Access button', async () => {
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText('Request Enhanced Access')).toBeInTheDocument()
      })
    })
  })

  // ─── Error Handling ────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('shows 404 error when pitch not found', async () => {
      mockPitchService.getById.mockRejectedValue(new Error('404'))
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText(/Pitch #1 not found/i)).toBeInTheDocument()
      })
    })

    it('shows 403 error for permission denied', async () => {
      mockPitchService.getById.mockRejectedValue(new Error('403'))
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText(/do not have permission/i)).toBeInTheDocument()
      })
    })

    it('shows 401 error for unauthenticated', async () => {
      mockPitchService.getById.mockRejectedValue(new Error('401'))
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText(/log in to view/i)).toBeInTheDocument()
      })
    })

    it('shows generic error for other failures', async () => {
      mockPitchService.getById.mockRejectedValue(new Error('Network error'))
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText(/Failed to load pitch: Network error/i)).toBeInTheDocument()
      })
    })

    it('retry button re-fetches pitch', async () => {
      const u = userEvent.setup()
      mockPitchService.getById.mockRejectedValueOnce(new Error('404'))
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })

      mockPitchService.getById.mockResolvedValue(createMockPitch())
      await u.click(screen.getByText('Retry'))

      await waitFor(() => {
        expect(screen.getAllByText('Test Pitch').length).toBeGreaterThan(0)
      })
    })

    it('Back to Marketplace navigates to /', async () => {
      const u = userEvent.setup()
      mockPitchService.getById.mockRejectedValue(new Error('404'))
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText('Back to Marketplace')).toBeInTheDocument()
      })

      await u.click(screen.getByText('Back to Marketplace'))
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  // ─── Owner Detection ──────────────────────────────────────────────

  describe('Owner Detection', () => {
    it('shows owner actions when isOwner flag is true', async () => {
      mockAuthStore.isAuthenticated = true
      mockAuthStore.user = { id: 2, email: 'owner@test.com' }
      mockPitchService.getByIdAuthenticated.mockResolvedValue(
        createMockPitch({ isOwner: true })
      )

      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText('Edit Pitch')).toBeInTheDocument()
      })
      expect(screen.getByText('View Analytics')).toBeInTheDocument()
    })

    it('detects owner via userId match', async () => {
      mockAuthStore.isAuthenticated = true
      mockAuthStore.user = { id: 2, email: 'owner@test.com' }
      mockPitchService.getByIdAuthenticated.mockResolvedValue(
        createMockPitch({ userId: 2, isOwner: false })
      )

      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText('Edit Pitch')).toBeInTheDocument()
      })
    })

    it('does not show owner actions for non-owner', async () => {
      mockAuthStore.isAuthenticated = true
      mockAuthStore.user = { id: 999, email: 'other@test.com' }
      mockPitchService.getByIdAuthenticated.mockResolvedValue(createMockPitch())

      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getAllByText('Test Pitch').length).toBeGreaterThan(0)
      })
      expect(screen.queryByText('Edit Pitch')).not.toBeInTheDocument()
    })

    it('does not track view for owner', async () => {
      mockAuthStore.isAuthenticated = true
      mockAuthStore.user = { id: 2, email: 'owner@test.com' }
      mockPitchService.getByIdAuthenticated.mockResolvedValue(
        createMockPitch({ isOwner: true })
      )

      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText('Edit Pitch')).toBeInTheDocument()
      })
      expect(mockPitchService.trackView).not.toHaveBeenCalled()
    })
  })

  // ─── Like/Unlike ──────────────────────────────────────────────────

  describe('Like/Unlike', () => {
    it('shows like count', async () => {
      mockAuthStore.isAuthenticated = true
      mockAuthStore.user = { id: 3, email: 'user@test.com' }
      mockPitchService.getByIdAuthenticated.mockResolvedValue(
        createMockPitch({ likeCount: 42 })
      )

      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText('42')).toBeInTheDocument()
      })
    })
  })

  // ─── NDA State ────────────────────────────────────────────────────

  describe('NDA State', () => {
    beforeEach(() => {
      mockAuthStore.isAuthenticated = true
      mockAuthStore.user = { id: 3, email: 'user@test.com' }
    })

    it('shows NDA Signed badge when NDA is signed', async () => {
      mockPitchService.getByIdAuthenticated.mockResolvedValue(
        createMockPitch({ hasSignedNDA: true })
      )

      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getAllByText('NDA Signed').length).toBeGreaterThan(0)
      })
    })

    it('shows protected content when NDA is signed', async () => {
      mockPitchService.getByIdAuthenticated.mockResolvedValue(
        createMockPitch({
          hasSignedNDA: true,
          budget_breakdown: { total: 1000000, production: 500000 },
          production_timeline: 'Q1 2026',
        })
      )

      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText('Enhanced Information')).toBeInTheDocument()
      })
    })

    it('opens NDA modal when Request Access clicked', async () => {
      const u = userEvent.setup()
      mockPitchService.getByIdAuthenticated.mockResolvedValue(
        createMockPitch({ hasSignedNDA: false })
      )

      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText('Request Access')).toBeInTheDocument()
      })

      await u.click(screen.getByText('Request Access'))

      await waitFor(() => {
        expect(screen.getByTestId('nda-modal')).toBeInTheDocument()
      })
    })
  })

  // ─── Online/Offline ───────────────────────────────────────────────

  describe('Online/Offline Detection', () => {
    it('shows offline banner when navigator.onLine is false', async () => {
      Object.defineProperty(navigator, 'onLine', { writable: true, value: false })
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText(/offline/i)).toBeInTheDocument()
      })
    })

    it('hides offline banner when online', async () => {
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getAllByText('Test Pitch').length).toBeGreaterThan(0)
      })
      expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
    })

    it('responds to offline events', async () => {
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getAllByText('Test Pitch').length).toBeGreaterThan(0)
      })

      Object.defineProperty(navigator, 'onLine', { writable: true, value: false })
      window.dispatchEvent(new Event('offline'))

      await waitFor(() => {
        expect(screen.getByText(/offline/i)).toBeInTheDocument()
      })
    })
  })

  // ─── Seeking Investment ───────────────────────────────────────────

  describe('Seeking Investment', () => {
    it('shows badge when seekingInvestment is true', async () => {
      mockPitchService.getById.mockResolvedValue(
        createMockPitch({ seekingInvestment: true })
      )

      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getByText(/Seeking Investment/i)).toBeInTheDocument()
      })
    })

    it('hides badge when seekingInvestment is false', async () => {
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getAllByText('Test Pitch').length).toBeGreaterThan(0)
      })
      expect(screen.queryByText(/Seeking Investment/i)).not.toBeInTheDocument()
    })
  })

  // ─── Genre and Format ─────────────────────────────────────────────

  describe('Genre and Format', () => {
    it('displays genre badge', async () => {
      mockPitchService.getById.mockResolvedValue(createMockPitch({ genre: 'Sci-Fi' }))
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getAllByText('Sci-Fi').length).toBeGreaterThan(0)
      })
    })

    it('displays format via FormatDisplay', async () => {
      mockPitchService.getById.mockResolvedValue(createMockPitch({ format: 'TV Series' }))
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getAllByText('TV Series').length).toBeGreaterThan(0)
      })
    })
  })

  // ─── Creator Navigation ───────────────────────────────────────────

  describe('Creator Navigation', () => {
    it('navigates to creator profile on click', async () => {
      // Creator name is NDA-gated in the PitchDetail markup
      // (PitchDetail.tsx:345 — `hasSignedNDA || isOwner`), so the test needs
      // an authenticated user with a signed NDA before "Test Creator" renders.
      mockAuthStore.isAuthenticated = true
      mockAuthStore.user = { id: 3, email: 'user@test.com', name: 'User' }
      mockPitchService.getByIdAuthenticated.mockResolvedValue(
        createMockPitch({ hasSignedNDA: true })
      )

      const u = userEvent.setup()
      renderPitchDetail()

      await waitFor(() => {
        expect(screen.getAllByText('Test Creator').length).toBeGreaterThan(0)
      })

      await u.click(screen.getAllByText('Test Creator')[0])
      expect(mockNavigate).toHaveBeenCalledWith('/creator/2')
    })
  })
})
