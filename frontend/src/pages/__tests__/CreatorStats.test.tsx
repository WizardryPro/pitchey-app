import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockGetDashboard = vi.fn()
const mockGetMyPitches = vi.fn()

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
    getDashboard: mockGetDashboard,
  },
}))

// ─── Pitch Service ───────────────────────────────────────────────────
vi.mock('../../services/pitch.service', () => ({
  PitchService: {
    getMyPitches: mockGetMyPitches,
  },
}))

// ─── recharts ───────────────────────────────────────────────────────
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  Bar: () => null,
  Pie: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
}))

// ─── UI chart components (shadcn) ───────────────────────────────────
vi.mock('../../components/ui/chart', () => ({
  ChartContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
  ChartLegend: () => null,
  ChartLegendContent: () => null,
}))

// ─── Mock data ───────────────────────────────────────────────────────
const mockDashboardData = {
  stats: {
    totalPitches: 5,
    publishedPitches: 3,
    draftPitches: 2,
    totalViews: 1200,
    totalLikes: 340,
    totalNDAs: 12,
    avgEngagementRate: 28.3,
    monthlyGrowth: 15,
  },
  notifications: [],
  activities: [],
  recentPitches: [],
}

const mockPitches = [
  {
    id: 1,
    title: 'Space Opera Epic',
    genre: 'scifi',
    status: 'published',
    viewCount: 800,
    likeCount: 200,
    ndaCount: 5,
    updatedAt: '2026-02-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    title: 'Drama Short Film',
    genre: 'drama',
    status: 'draft',
    viewCount: 150,
    likeCount: 40,
    ndaCount: 2,
    updatedAt: '2026-02-10T00:00:00Z',
    createdAt: '2026-01-15T00:00:00Z',
  },
]

let CreatorStats: React.ComponentType

beforeAll(async () => {
  const mod = await import('../creator/CreatorStats')
  CreatorStats = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetDashboard.mockResolvedValue(mockDashboardData)
  mockGetMyPitches.mockResolvedValue(mockPitches)
})

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
})

describe('CreatorStats', () => {
  it('renders the page title', async () => {
    render(
      <MemoryRouter>
        <CreatorStats />
      </MemoryRouter>
    )
    expect(screen.getByText('Quick Stats')).toBeInTheDocument()
  })

  it('shows loading skeleton initially', () => {
    // Don't resolve the promise — keep it pending
    mockGetDashboard.mockReturnValue(new Promise(() => {}))
    mockGetMyPitches.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <CreatorStats />
      </MemoryRouter>
    )

    // The loading skeleton uses animate-pulse
    const pulsingElements = document.querySelectorAll('.animate-pulse')
    expect(pulsingElements.length).toBeGreaterThan(0)
  })

  it('renders stat cards after data loads', async () => {
    render(
      <MemoryRouter>
        <CreatorStats />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total Views')).toBeInTheDocument()
    })

    expect(screen.getByText('Engagement Rate')).toBeInTheDocument()
    expect(screen.getByText('Active Pitches')).toBeInTheDocument()
    expect(screen.getByText('Total Likes')).toBeInTheDocument()
    expect(screen.getByText('Total NDAs')).toBeInTheDocument()
    expect(screen.getByText('Total Pitches')).toBeInTheDocument()
  })

  it('renders the time range selector', async () => {
    render(
      <MemoryRouter>
        <CreatorStats />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total Views')).toBeInTheDocument()
    })

    const select = screen.getByDisplayValue('Last 7 Days')
    expect(select).toBeInTheDocument()
  })

  it('renders chart section headings', async () => {
    render(
      <MemoryRouter>
        <CreatorStats />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Views Over Time')).toBeInTheDocument()
    })

    expect(screen.getByText('Engagement Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Genre Performance')).toBeInTheDocument()
    expect(screen.getByText('Audience Demographics')).toBeInTheDocument()
  })

  it('renders Top Performing Pitches table with data', async () => {
    render(
      <MemoryRouter>
        <CreatorStats />
      </MemoryRouter>
    )

    // Wait for actual pitch data to render (not just the static heading)
    await waitFor(() => {
      expect(screen.getByText('Space Opera Epic')).toBeInTheDocument()
    })

    // Table headers
    expect(screen.getByText('Pitch Title')).toBeInTheDocument()
    expect(screen.getByText('Views')).toBeInTheDocument()
    expect(screen.getByText('Likes')).toBeInTheDocument()

    // Pitch titles appear
    expect(screen.getByText('Drama Short Film')).toBeInTheDocument()
  })

  it('shows empty state when no pitches', async () => {
    mockGetMyPitches.mockResolvedValue([])

    render(
      <MemoryRouter>
        <CreatorStats />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("No pitches yet. Create your first pitch to see stats!")).toBeInTheDocument()
    })
  })

  it('gracefully handles API failures by showing zero stats', async () => {
    // The component catches errors at the promise level (.catch(() => null) / .catch(() => []))
    // so individual service failures don't throw — they just show zero data
    mockGetDashboard.mockRejectedValue(new Error('Network error'))
    mockGetMyPitches.mockRejectedValue(new Error('Network error'))

    render(
      <MemoryRouter>
        <CreatorStats />
      </MemoryRouter>
    )

    await waitFor(() => {
      // Stats still render with zero values since errors are caught per-promise
      expect(screen.getByText('Total Views')).toBeInTheDocument()
    })

    // Total views should be 0 since getMyPitches failed and returned []
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThan(0)
  })

  it('renders Export and Refresh buttons', async () => {
    render(
      <MemoryRouter>
        <CreatorStats />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument()
    })

    // Refresh button (icon-only button)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('calls both services on mount', async () => {
    render(
      <MemoryRouter>
        <CreatorStats />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockGetDashboard).toHaveBeenCalled()
      expect(mockGetMyPitches).toHaveBeenCalled()
    })
  })

  it('calculates total views from pitches', async () => {
    render(
      <MemoryRouter>
        <CreatorStats />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total Views')).toBeInTheDocument()
    })

    // 800 + 150 = 950
    expect(screen.getByText('950')).toBeInTheDocument()
  })
})
