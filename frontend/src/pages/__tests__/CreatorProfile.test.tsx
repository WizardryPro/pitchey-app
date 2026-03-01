import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mocks ───────────────────────────────────────────────────────────
const mockNavigate = vi.fn()
const mockFetch = vi.fn()
const mockIsFollowing = vi.fn()
const mockToggleFollow = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ creatorId: '5' }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

const mockUser = { id: 1, name: 'Viewer', email: 'viewer@test.com', user_type: 'investor' }
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => ({ user: mockUser, isAuthenticated: true }),
}))

vi.mock('../../config', () => ({
  config: { API_URL: 'http://localhost:8787' },
  API_URL: 'http://localhost:8787',
  getApiUrl: () => 'http://localhost:8787',
}))

vi.mock('../../services/follow.service', () => ({
  followService: {
    isFollowing: (...args: any[]) => mockIsFollowing(...args),
    toggleFollow: (...args: any[]) => mockToggleFollow(...args),
  },
}))

vi.mock('../../components/FollowButton', () => ({
  default: ({ creatorId }: any) => (
    <button data-testid="follow-button">Follow {creatorId}</button>
  ),
}))

vi.mock('../../components/FormatDisplay', () => ({
  default: ({ format, formatSubtype }: any) => (
    <span data-testid="format-display">{formatSubtype || format || 'Unknown'}</span>
  ),
}))

// ─── Mock data ───────────────────────────────────────────────────────────────
const mockCreatorResponse = {
  data: {
    id: 5,
    username: 'johncreator',
    first_name: 'John',
    last_name: 'Creator',
    email: 'john@example.com',
    phone: '555-0100',
    bio: 'Award-winning filmmaker',
    location: 'Los Angeles, CA',
    website: 'https://johncreator.com',
    user_type: 'creator',
    created_at: '2025-06-01T00:00:00Z',
    follower_count: 1200,
    following_count: 45,
    pitches_count: 8,
    views_count: 50000,
    verified: true,
    specialties: ['Drama', 'Thriller'],
    awards: ['Best Short Film 2025'],
  },
}

const mockPitchesResponse = {
  data: {
    pitches: [
      {
        id: 10,
        title: 'Midnight Run',
        logline: 'A detective chases a fugitive',
        genre: 'Thriller',
        format: 'Feature Film',
        status: 'published',
        view_count: 3000,
        like_count: 150,
        created_at: '2026-01-15T00:00:00Z',
        nda_required: false,
        user_id: '5',
      },
      {
        id: 11,
        title: 'Other Creator Pitch',
        logline: 'Not by this creator',
        genre: 'Comedy',
        format: 'Short Film',
        status: 'published',
        view_count: 100,
        like_count: 5,
        created_at: '2026-01-20T00:00:00Z',
        nda_required: false,
        user_id: '99',
      },
    ],
  },
}

// ─── Component import ────────────────────────────────────────────────────────
let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('../CreatorProfile')
  Component = mod.default
})

describe('CreatorProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockIsFollowing.mockResolvedValue(false)
    mockToggleFollow.mockResolvedValue({ isFollowing: true })
    vi.stubGlobal('fetch', mockFetch)

    // Default: both API calls succeed
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/users/5')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCreatorResponse),
        })
      }
      if (url.includes('/api/pitches/public/search')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPitchesResponse),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })
  })

  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(<MemoryRouter><Component /></MemoryRouter>)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('calls GET /api/users/:id for creator data', async () => {
    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/5'),
        expect.objectContaining({ credentials: 'include' })
      )
    })
  })

  it('calls GET /api/pitches/public/search for creator pitches', async () => {
    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pitches/public/search'),
        expect.objectContaining({ credentials: 'include' })
      )
    })
  })

  it('renders creator name after loading', async () => {
    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('John Creator')).toBeInTheDocument()
    })
  })

  it('renders creator username', async () => {
    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('@johncreator')).toBeInTheDocument()
    })
  })

  it('renders follower and pitch stats', async () => {
    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('1,200')).toBeInTheDocument()
    })
    expect(screen.getByText('Followers')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('Pitches')).toBeInTheDocument()
  })

  it('shows not-found state when API fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({}),
    })

    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('Creator Not Found')).toBeInTheDocument()
    })
  })

  it('renders pitches tab with filtered pitches', async () => {
    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      // Should show only the pitch by user_id '5', not user_id '99'
      expect(screen.getByText('Midnight Run')).toBeInTheDocument()
    })
    expect(screen.queryByText('Other Creator Pitch')).not.toBeInTheDocument()
  })

  it('renders about tab with specialties', async () => {
    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('John Creator')).toBeInTheDocument()
    })

    // Click About tab
    fireEvent.click(screen.getByText('About'))

    await waitFor(() => {
      expect(screen.getByText('Specialties')).toBeInTheDocument()
    })
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Thriller')).toBeInTheDocument()
    expect(screen.getByText('Best Short Film 2025')).toBeInTheDocument()
  })

  it('renders contact tab with email', async () => {
    render(<MemoryRouter><Component /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('John Creator')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Contact'))

    await waitFor(() => {
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
    })
    expect(screen.getByText('555-0100')).toBeInTheDocument()
  })
})
