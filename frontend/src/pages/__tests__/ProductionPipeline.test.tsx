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

const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
const nearDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()

const mockPipelineData = {
  projects: [
    {
      id: 'proj-1',
      title: 'Midnight Sun',
      genre: 'Drama',
      stage: 'production',
      budget: 5000000,
      progress: 65,
      team: 12,
      director: 'Jane Smith',
      producer: 'Bob Johnson',
      estimatedCompletion: futureDate,
      priority: 'high',
      risk: 'medium',
      daysInStage: 15,
      nextMilestone: 'Complete principal photography',
      blockers: [],
    },
    {
      id: 'proj-2',
      title: 'Dark Waters',
      genre: 'Thriller',
      stage: 'pre-production',
      budget: 3000000,
      progress: 30,
      team: 8,
      director: 'Alice Director',
      producer: null,
      estimatedCompletion: nearDate,
      priority: 'urgent',
      risk: 'high',
      daysInStage: 25,
      nextMilestone: 'Finalize casting',
      blockers: ['Budget approval pending', 'Location permits delayed'],
    },
  ],
  stats: {
    totalProjects: 5,
    totalBudget: 15000000,
    averageProgress: 48,
    projectsByStage: {
      development: 1,
      'pre-production': 2,
      production: 1,
      'post-production': 1,
      delivery: 0,
      release: 0,
    },
    upcomingDeadlines: 3,
    blockedProjects: 1,
    onTrackProjects: 4,
    behindSchedule: 1,
  },
}

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

let Component: React.ComponentType

beforeAll(async () => {
  const mod = await import('../production/ProductionPipeline')
  Component = mod.default
})

describe('ProductionPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = mockFetch
    mockCheckSession.mockResolvedValue(undefined)
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  // ─── Stats Cards ─────────────────────────────────────────────────

  it('renders stats cards after loading', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPipelineData),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total Projects')).toBeInTheDocument()
    })
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('48% avg progress')).toBeInTheDocument()
    expect(screen.getByText('Total Budget')).toBeInTheDocument()
    expect(screen.getByText('$15.0M')).toBeInTheDocument()
    expect(screen.getByText('On Track')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Blocked Projects')).toBeInTheDocument()
  })

  // ─── Pipeline Overview ────────────────────────────────────────────

  it('renders pipeline stage overview', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPipelineData),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Pipeline Overview')).toBeInTheDocument()
    })
    expect(screen.getAllByText('development').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('pre production').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('production').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('post production').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('delivery').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('release').length).toBeGreaterThanOrEqual(1)
  })

  // ─── Project Cards ────────────────────────────────────────────────

  it('renders project cards with details', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPipelineData),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Midnight Sun')).toBeInTheDocument()
    })
    expect(screen.getByText('Dark Waters')).toBeInTheDocument()
    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('renders director and producer info', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPipelineData),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
    expect(screen.getByText('Alice Director')).toBeInTheDocument()
  })

  it('renders blockers section for blocked projects', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPipelineData),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Blockers:')).toBeInTheDocument()
    })
    expect(screen.getByText(/Budget approval pending/)).toBeInTheDocument()
    expect(screen.getByText(/Location permits delayed/)).toBeInTheDocument()
  })

  it('renders next milestone for each project', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPipelineData),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Complete principal photography/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Finalize casting/)).toBeInTheDocument()
  })

  // ─── Filters ──────────────────────────────────────────────────────

  it('renders filter dropdowns', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPipelineData),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Filters:')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('All Stages')).toBeInTheDocument()
    expect(screen.getByDisplayValue('All Priority')).toBeInTheDocument()
    expect(screen.getByDisplayValue('All Risk Levels')).toBeInTheDocument()
  })

  // ─── Empty State ──────────────────────────────────────────────────

  it('shows empty state when no projects', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        projects: [],
        stats: {
          totalProjects: 0,
          totalBudget: 0,
          averageProgress: 0,
          projectsByStage: {},
          upcomingDeadlines: 0,
          blockedProjects: 0,
          onTrackProjects: 0,
          behindSchedule: 0,
        },
      }),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No projects found')).toBeInTheDocument()
    })
    expect(screen.getByText(/Projects will appear in the pipeline/)).toBeInTheDocument()
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
      expect(screen.getByText(/Failed to fetch pipeline data: 500/)).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('shows error when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument()
    })
  })
})
