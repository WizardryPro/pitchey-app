import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mock functions
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockCheckSession = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// Auth store - STABLE reference
const mockUser = { id: 1, name: 'Production User', email: 'production@test.com', user_type: 'production' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: mockCheckSession,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

vi.mock('../../config', () => ({
  config: { API_URL: 'http://localhost:8001' },
  API_URL: 'http://localhost:8001',
}))

const now = new Date()
const recentTimestamp = new Date(now.getTime() - 30 * 60 * 1000).toISOString() // 30 mins ago
const olderTimestamp = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago

const mockActivities = [
  {
    id: 'a1',
    type: 'pitch_view',
    title: 'New Pitch View',
    description: 'Someone viewed your pitch "Space Odyssey"',
    timestamp: recentTimestamp,
    user: { id: 'u1', name: 'Sarah Investor', avatar: null, type: 'investor' },
    project: { id: 'p1', title: 'Space Odyssey', genre: 'Sci-Fi' },
    metadata: { pitchId: '1' },
    isRead: false,
    isImportant: true,
  },
  {
    id: 'a2',
    type: 'nda_signed',
    title: 'NDA Signed',
    description: 'NDA signed for "Dark Waters" project',
    timestamp: olderTimestamp,
    user: { id: 'u2', name: 'Bob Creator', avatar: null, type: 'creator' },
    project: { id: 'p2', title: 'Dark Waters', genre: 'Thriller' },
    metadata: { projectId: '2' },
    isRead: true,
    isImportant: false,
  },
]

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

let Component: React.ComponentType

beforeAll(async () => {
  const mod = await import('../production/ProductionActivity')
  Component = mod.default
})

describe('ProductionActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = mockFetch
    mockCheckSession.mockResolvedValue(undefined)
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    expect(screen.getByText('Loading activity feed...')).toBeInTheDocument()
  })

  // ─── Layout ───────────────────────────────────────────────────────

  it('renders page title and description after loading', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ activities: mockActivities }),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Activity Feed')).toBeInTheDocument()
    })
    expect(screen.getByText(/Real-time updates/)).toBeInTheDocument()
  })

  // ─── Data Rendering ──────────────────────────────────────────────

  it('renders activity items from API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ activities: mockActivities }),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('New Pitch View')).toBeInTheDocument()
    })
    expect(screen.getByText('NDA Signed')).toBeInTheDocument()
    expect(screen.getByText(/Someone viewed your pitch/)).toBeInTheDocument()
  })

  it('renders user and project info on activities', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ activities: mockActivities }),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Sarah Investor')).toBeInTheDocument()
    })
    expect(screen.getByText('Bob Creator')).toBeInTheDocument()
    expect(screen.getByText('Space Odyssey')).toBeInTheDocument()
    expect(screen.getByText('Dark Waters')).toBeInTheDocument()
  })

  it('shows important badge on important activities', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ activities: mockActivities }),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Important')).toBeInTheDocument()
    })
  })

  it('shows unread count', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ activities: mockActivities }),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/1 unread activity/)).toBeInTheDocument()
    })
  })

  // ─── Mark as Read ─────────────────────────────────────────────────

  it('shows Mark Read button for unread activities', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ activities: mockActivities }),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Mark Read')).toBeInTheDocument()
    })
  })

  it('shows Mark All Read button', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ activities: mockActivities }),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Mark All Read')).toBeInTheDocument()
    })
  })

  // ─── Filters ──────────────────────────────────────────────────────

  it('renders filter section', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ activities: mockActivities }),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument()
    })
    expect(screen.getByText('Activity Type')).toBeInTheDocument()
    expect(screen.getByText('Time Range')).toBeInTheDocument()
    expect(screen.getByText('Importance')).toBeInTheDocument()
    expect(screen.getByText('Read Status')).toBeInTheDocument()
  })

  // ─── Empty State ──────────────────────────────────────────────────

  it('shows empty state when no activities', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ activities: [] }),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No activities found')).toBeInTheDocument()
    })
    expect(screen.getByText(/No activities to display/)).toBeInTheDocument()
  })

  // ─── Error State ──────────────────────────────────────────────────

  it('shows error alert when API fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('API Connection Issue')).toBeInTheDocument()
    })
    expect(screen.getByText(/Activity feed API error: 500/)).toBeInTheDocument()
  })

  it('shows error when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('API Connection Issue')).toBeInTheDocument()
    })
    expect(screen.getByText(/Network failure/)).toBeInTheDocument()
  })
})
