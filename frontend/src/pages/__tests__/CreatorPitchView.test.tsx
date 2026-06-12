import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'

// Stable user object
const stableUser = { id: 'user-1', name: 'Test Creator', userType: 'creator' }

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock pitchAPI
const mockGetPublicById = vi.fn()
const mockGetById = vi.fn()
const mockGetAnalytics = vi.fn()

vi.mock('../../lib/api', () => ({
  pitchAPI: {
    getPublicById: (...args: any[]) => mockGetPublicById(...args),
    getById: (...args: any[]) => mockGetById(...args),
    getAnalytics: (...args: any[]) => mockGetAnalytics(...args),
    delete: vi.fn(),
    getNDARequests: vi.fn().mockRejectedValue(new Error('not available')),
    updateVisibility: vi.fn(),
    handleNDARequest: vi.fn(),
  },
}))

// Mock FormatDisplay
vi.mock('../../components/FormatDisplay', () => ({
  default: ({ format }: any) => <span>{format || 'Feature Film'}</span>,
}))

// Mock betterAuthStore
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => ({
    user: stableUser,
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}))

const mockPitch = {
  id: '42',
  userId: 'user-1',
  title: 'Test Movie Pitch',
  logline: 'A thrilling adventure story',
  genre: 'Action',
  format: 'Feature Film',
  shortSynopsis: 'An epic tale of courage and discovery.',
  budget: '$5M - $10M',
  status: 'published',
  visibility: 'public',
  views: 1234,
  likes: 56,
  ndaCount: 3,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-15',
}

let CreatorPitchView: React.ComponentType

beforeAll(async () => {
  const mod = await import('@portals/creator/pages/CreatorPitchView')
  CreatorPitchView = mod.default
})

function renderWithRoute() {
  return render(
    <MemoryRouter initialEntries={['/creator/pitches/42']}>
      <Routes>
        <Route path="/creator/pitches/:id" element={<CreatorPitchView />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CreatorPitchView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set up localStorage mock to return user and authToken
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'user') return JSON.stringify(stableUser)
      if (key === 'authToken') return 'test-token'
      return null
    })
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading spinner while fetching pitch data', () => {
    mockGetPublicById.mockReturnValue(new Promise(() => {}))
    renderWithRoute()

    const spinner = document.querySelector('.pitchey-film-anim')
    expect(spinner).toBeInTheDocument()
  })

  // ─── Error State ──────────────────────────────────────────────────

  it('shows error state when pitch fetch fails', async () => {
    mockGetPublicById.mockRejectedValue(new Error('Not found'))
    mockGetById.mockRejectedValue(new Error('Not found'))

    renderWithRoute()

    await waitFor(() => {
      expect(screen.getByText('Error Loading Pitch')).toBeInTheDocument()
    })
    expect(screen.getByText('Failed to load pitch details')).toBeInTheDocument()
  })

  // ─── Success State ────────────────────────────────────────────────

  it('displays pitch title and logline on successful fetch', async () => {
    mockGetPublicById.mockResolvedValue(mockPitch)
    mockGetAnalytics.mockResolvedValue({ totalViews: 1234 })

    renderWithRoute()

    await waitFor(() => {
      expect(screen.getByText('Test Movie Pitch')).toBeInTheDocument()
    })
    expect(screen.getByText(/A thrilling adventure story/)).toBeInTheDocument()
  })

  it('displays synopsis section', async () => {
    mockGetPublicById.mockResolvedValue(mockPitch)
    mockGetAnalytics.mockResolvedValue({ totalViews: 1234 })

    renderWithRoute()

    await waitFor(() => {
      expect(screen.getByText('Synopsis')).toBeInTheDocument()
    })
    expect(screen.getByText('An epic tale of courage and discovery.')).toBeInTheDocument()
  })

  it('displays quick stats sidebar with views, likes, and NDAs', async () => {
    mockGetPublicById.mockResolvedValue(mockPitch)
    mockGetAnalytics.mockResolvedValue({ totalViews: 1234 })

    renderWithRoute()

    await waitFor(() => {
      expect(screen.getByText('Quick Stats')).toBeInTheDocument()
    })
    expect(screen.getByText('1234')).toBeInTheDocument()
    expect(screen.getByText('56')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('displays production details with budget', async () => {
    mockGetPublicById.mockResolvedValue(mockPitch)
    mockGetAnalytics.mockResolvedValue({ totalViews: 1234 })

    renderWithRoute()

    await waitFor(() => {
      expect(screen.getByText('Production Details')).toBeInTheDocument()
    })
    expect(screen.getByText('$5M - $10M')).toBeInTheDocument()
  })
})
