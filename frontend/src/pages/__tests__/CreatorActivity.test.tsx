import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockGetActivityFeed = vi.fn()
const mockGetDashboard = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Creator Service ─────────────────────────────────────────────────
vi.mock('../../services/creator.service', () => ({
  CreatorService: {
    getActivityFeed: mockGetActivityFeed,
    getDashboard: mockGetDashboard,
  },
}))

// ─── Mock data ───────────────────────────────────────────────────────
const mockActivities = [
  {
    id: 1,
    type: 'pitch_view',
    description: 'Someone viewed your pitch "Space Opera Epic"',
    metadata: {},
    createdAt: new Date(Date.now() - 60000).toISOString(), // 1 min ago
  },
  {
    id: 2,
    type: 'nda_signed',
    description: 'An investor signed your NDA for "Drama Short"',
    metadata: { status: 'signed' },
    createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
  },
  {
    id: 3,
    type: 'investment',
    description: 'New investment interest in "Thriller Night"',
    metadata: { amount: 50000 },
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
]

const mockDashboardData = {
  stats: {
    totalViews: 1500,
    avgEngagementRate: 22.5,
    totalNDAs: 8,
  },
  notifications: [
    { id: 1, isRead: false, title: 'New view', message: 'Someone viewed your pitch', createdAt: new Date().toISOString() },
    { id: 2, isRead: true, title: 'NDA signed', message: 'NDA was signed', createdAt: new Date().toISOString() },
  ],
  activities: mockActivities,
  recentPitches: [],
}

let CreatorActivity: React.ComponentType

beforeAll(async () => {
  const mod = await import('../creator/CreatorActivity')
  CreatorActivity = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetActivityFeed.mockResolvedValue({ activities: mockActivities })
  mockGetDashboard.mockResolvedValue(mockDashboardData)
})

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
})

describe('CreatorActivity', () => {
  it('renders the page title', async () => {
    render(
      <MemoryRouter>
        <CreatorActivity />
      </MemoryRouter>
    )

    expect(screen.getByText('Activity Feed')).toBeInTheDocument()
  })

  it('shows loading skeleton initially', () => {
    mockGetActivityFeed.mockReturnValue(new Promise(() => {}))
    mockGetDashboard.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <CreatorActivity />
      </MemoryRouter>
    )

    const pulsingElements = document.querySelectorAll('.animate-pulse')
    expect(pulsingElements.length).toBeGreaterThan(0)
  })

  it('renders activity items after data loads', async () => {
    render(
      <MemoryRouter>
        <CreatorActivity />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Someone viewed your pitch "Space Opera Epic"')).toBeInTheDocument()
    })

    expect(screen.getByText('An investor signed your NDA for "Drama Short"')).toBeInTheDocument()
    expect(screen.getByText('New investment interest in "Thriller Night"')).toBeInTheDocument()
  })

  it('renders stats cards', async () => {
    render(
      <MemoryRouter>
        <CreatorActivity />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Unread')).toBeInTheDocument()
    })

    expect(screen.getByText('Total Views')).toBeInTheDocument()
    expect(screen.getByText('New Followers')).toBeInTheDocument()
    expect(screen.getByText('Engagement Rate')).toBeInTheDocument()
  })

  it('renders filter tabs', async () => {
    render(
      <MemoryRouter>
        <CreatorActivity />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('All Activity')).toBeInTheDocument()
    })

    expect(screen.getByText('Views')).toBeInTheDocument()
    expect(screen.getByText('Likes')).toBeInTheDocument()
    expect(screen.getByText('Comments')).toBeInTheDocument()
    expect(screen.getByText('Follows')).toBeInTheDocument()
    expect(screen.getByText('Investments')).toBeInTheDocument()
    expect(screen.getByText('Ndas')).toBeInTheDocument()
    expect(screen.getByText('Milestones')).toBeInTheDocument()
  })

  it('renders Refresh button', async () => {
    render(
      <MemoryRouter>
        <CreatorActivity />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })

  it('shows empty state when no activities', async () => {
    mockGetActivityFeed.mockResolvedValue({ activities: [] })

    render(
      <MemoryRouter>
        <CreatorActivity />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    })

    expect(screen.getByText('Create Your First Pitch')).toBeInTheDocument()
  })

  it('shows error state when activity feed fails', async () => {
    mockGetActivityFeed.mockRejectedValue(new Error('Failed to fetch'))

    render(
      <MemoryRouter>
        <CreatorActivity />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to load activity feed. Please try again.')).toBeInTheDocument()
    })
  })

  it('shows Retry button in error state', async () => {
    mockGetActivityFeed.mockRejectedValue(new Error('Network error'))

    render(
      <MemoryRouter>
        <CreatorActivity />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  it('calls getActivityFeed on mount', async () => {
    render(
      <MemoryRouter>
        <CreatorActivity />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockGetActivityFeed).toHaveBeenCalledWith({ limit: 50 })
    })
  })

  it('calls getDashboard on mount', async () => {
    render(
      <MemoryRouter>
        <CreatorActivity />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockGetDashboard).toHaveBeenCalled()
    })
  })

  it('shows unread count from dashboard notifications', async () => {
    render(
      <MemoryRouter>
        <CreatorActivity />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Unread')).toBeInTheDocument()
    })

    // 1 unread notification from mockDashboardData
    const unreadValue = screen.getAllByText('1')
    expect(unreadValue.length).toBeGreaterThan(0)
  })
})
