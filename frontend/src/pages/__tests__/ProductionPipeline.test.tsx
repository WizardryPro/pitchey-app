import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mock functions
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

const mockGetProjects = vi.fn()

vi.mock('../../services/production.service', () => ({
  ProductionService: {
    getProjects: (...args: any[]) => mockGetProjects(...args),
  },
}))

const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
const nearDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
const pastStart = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
const pastStart2 = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

const mockProjects = [
  {
    id: 1,
    title: 'Midnight Sun',
    genre: 'Drama',
    stage: 'production',
    budget_allocated: 5000000,
    completion_percentage: 65,
    director: 'Jane Smith',
    producer: 'Bob Johnson',
    target_completion_date: futureDate,
    priority: 'high',
    start_date: pastStart,
    next_milestone: 'Complete principal photography',
  },
  {
    id: 2,
    title: 'Dark Waters',
    genre: 'Thriller',
    stage: 'pre-production',
    budget_allocated: 3000000,
    completion_percentage: 30,
    target_completion_date: nearDate,
    priority: 'urgent',
    start_date: pastStart2,
    next_milestone: 'Finalize casting',
  },
]

let Component: React.ComponentType

beforeAll(async () => {
  const mod = await import('../production/ProductionPipeline')
  Component = mod.default
})

describe('ProductionPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading spinner initially', () => {
    mockGetProjects.mockReturnValue(new Promise(() => {}))

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
    mockGetProjects.mockResolvedValue({ projects: mockProjects, total: 2 })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total Projects')).toBeInTheDocument()
    })
    expect(screen.getByText('Total Budget')).toBeInTheDocument()
    expect(screen.getByText('On Track')).toBeInTheDocument()
    expect(screen.getByText('Blocked Projects')).toBeInTheDocument()
  })

  // ─── Pipeline Overview ────────────────────────────────────────────

  it('renders pipeline stage overview', async () => {
    mockGetProjects.mockResolvedValue({ projects: mockProjects, total: 2 })

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
    mockGetProjects.mockResolvedValue({ projects: mockProjects, total: 2 })

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
    mockGetProjects.mockResolvedValue({ projects: mockProjects, total: 2 })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
  })

  it('renders next milestone for each project', async () => {
    mockGetProjects.mockResolvedValue({ projects: mockProjects, total: 2 })

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
    mockGetProjects.mockResolvedValue({ projects: mockProjects, total: 2 })

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
    mockGetProjects.mockResolvedValue({ projects: [], total: 0 })

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
    mockGetProjects.mockRejectedValue(new Error('Failed to fetch projects'))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch projects/)).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('shows error when fetch throws', async () => {
    mockGetProjects.mockRejectedValue(new Error('Network failure'))

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
