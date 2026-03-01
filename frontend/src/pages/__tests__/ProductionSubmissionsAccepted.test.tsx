import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Mock config
vi.mock('../../config', () => ({
  config: { apiUrl: '' },
  API_URL: '',
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

const mockSubmissions = [
  {
    id: '1',
    title: 'Feature Film Alpha',
    creator: 'Producer One',
    creatorEmail: 'producer1@test.com',
    submittedDate: '2025-12-01T00:00:00Z',
    acceptedDate: '2026-01-15T00:00:00Z',
    genre: 'Action',
    budget: 10000000,
    status: 'accepted',
    rating: 5,
    synopsis: 'A blockbuster action feature.',
    attachments: 8,
    lastActivity: '2 hours ago',
    reviewNotes: 'Greenlit for Q3 production.',
    productionStatus: 'production' as const,
    productionStartDate: '2026-02-01T00:00:00Z',
    estimatedCompletion: '2026-08-01T00:00:00Z',
    productionProgress: 45,
    contractStatus: 'signed' as const,
    assignedProducer: 'John Producer',
    team: ['Director Smith', 'Writer Jones', 'DP Williams'],
  },
  {
    id: '2',
    title: 'Indie Short Beta',
    creator: 'Creator Two',
    creatorEmail: 'creator2@test.com',
    submittedDate: '2026-01-01T00:00:00Z',
    acceptedDate: '2026-02-01T00:00:00Z',
    genre: 'Drama',
    budget: 500000,
    status: 'accepted',
    rating: 4,
    synopsis: 'A touching indie short film.',
    attachments: 3,
    lastActivity: '1 day ago',
    productionStatus: 'pre-production' as const,
    productionProgress: 10,
    contractStatus: 'pending' as const,
  },
]

let Component: React.ComponentType

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../production/ProductionSubmissionsAccepted')
  Component = mod.default
})

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionSubmissionsAccepted', () => {
  // --- Loading State ---
  it('shows loading spinner while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    renderComponent()

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  // --- Layout ---
  it('renders stats cards', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Total Accepted')).toBeInTheDocument()
    })
    expect(screen.getByText('In Production')).toBeInTheDocument()
    // "Completed" appears in stat card and as sort option, so use getAllByText
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Total Budget')).toBeInTheDocument()
  })

  it('renders search and filter controls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search accepted submissions...')).toBeInTheDocument()
    })
    expect(screen.getByText('All Genres')).toBeInTheDocument()
    expect(screen.getByText('All Production Status')).toBeInTheDocument()
    expect(screen.getByText('All Contract Status')).toBeInTheDocument()
  })

  // --- Data ---
  it('displays accepted submissions from API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Feature Film Alpha')).toBeInTheDocument()
    })
    expect(screen.getByText('Indie Short Beta')).toBeInTheDocument()
    expect(screen.getByText('A blockbuster action feature.')).toBeInTheDocument()
    expect(screen.getByText('Producer One')).toBeInTheDocument()
  })

  it('shows ACCEPTED badge on each submission', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('ACCEPTED')).toHaveLength(2)
    })
  })

  it('shows production status badges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('PRODUCTION')).toBeInTheDocument()
    })
    expect(screen.getByText('PRE PRODUCTION')).toBeInTheDocument()
  })

  it('shows contract status badges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('CONTRACT SIGNED')).toBeInTheDocument()
    })
    expect(screen.getByText('CONTRACT PENDING')).toBeInTheDocument()
  })

  it('shows production progress bars', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      // "Production Progress" label appears on each card plus sort dropdown option
      expect(screen.getAllByText('Production Progress').length).toBeGreaterThanOrEqual(2)
    })
    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
  })

  it('shows assigned producer and team', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('John Producer')).toBeInTheDocument()
    })
    expect(screen.getByText('Production Team')).toBeInTheDocument()
    expect(screen.getByText('Director Smith')).toBeInTheDocument()
    expect(screen.getByText('Writer Jones')).toBeInTheDocument()
    expect(screen.getByText('DP Williams')).toBeInTheDocument()
  })

  it('shows ratings', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('(5/5)')).toBeInTheDocument()
    })
    expect(screen.getByText('(4/5)')).toBeInTheDocument()
  })

  it('shows review notes when present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Greenlit for Q3 production.')).toBeInTheDocument()
    })
  })

  it('shows total budget stat', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      // Total budget = $10.5M
      expect(screen.getByText('$10.5M')).toBeInTheDocument()
    })
  })

  it('renders action buttons', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('View Project')).toHaveLength(2)
    })
    expect(screen.getAllByText('Manage Production')).toHaveLength(2)
    expect(screen.getAllByText('View Contract')).toHaveLength(2)
    expect(screen.getAllByText('Contact Creator')).toHaveLength(2)
  })

  it('navigates to project page on View Project click', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('View Project')).toHaveLength(2)
    })

    fireEvent.click(screen.getAllByText('View Project')[0])
    expect(mockNavigate).toHaveBeenCalledWith('/production/projects/1')
  })

  // --- Empty State ---
  it('shows empty state when no accepted submissions', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: [] } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No accepted submissions found')).toBeInTheDocument()
    })
    expect(screen.getByText(/Submissions that have been approved for production/)).toBeInTheDocument()
  })

  // --- Error State ---
  it('shows empty state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No accepted submissions found')).toBeInTheDocument()
    })
  })

  it('shows empty state when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No accepted submissions found')).toBeInTheDocument()
    })
  })

  // --- URL assertion ---
  it('fetches from correct API endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: [] } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    const calledUrl: string = mockFetch.mock.calls[0][0]
    expect(calledUrl).toContain('/api/production/submissions')
    expect(calledUrl).toContain('status=accepted')
  })
})
