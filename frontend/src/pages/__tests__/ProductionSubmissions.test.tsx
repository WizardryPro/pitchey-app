import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Mock useNavigate and useSearchParams
const mockNavigate = vi.fn()
const mockSearchParams = new URLSearchParams()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  }
})

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

const mockPitches = [
  {
    id: 1,
    title: 'Sci-Fi Blockbuster',
    creator_name: 'John Creator',
    creator_email: 'john@test.com',
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-02-10T00:00:00Z',
    genre: 'Sci-Fi',
    estimated_budget: 5000000,
    status: 'published',
    logline: 'A thrilling sci-fi adventure.',
  },
  {
    id: 2,
    title: 'Drama Film',
    creator_name: 'Jane Director',
    creator_email: 'jane@test.com',
    created_at: '2026-01-20T00:00:00Z',
    updated_at: '2026-02-15T00:00:00Z',
    genre: 'Drama',
    estimated_budget: 2000000,
    status: 'draft',
    logline: 'An emotional drama story.',
  },
]

let Component: React.ComponentType

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../production/ProductionSubmissions')
  Component = mod.default
})

const renderComponent = (initialEntries = ['/production/submissions']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionSubmissions', () => {
  // --- Loading State ---
  it('shows loading spinner while fetching submissions', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    renderComponent()

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  // --- Layout ---
  it('renders stats cards section', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { pitches: mockPitches } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Total Submissions')).toBeInTheDocument()
    })
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('In Review')).toBeInTheDocument()
    expect(screen.getByText('Shortlisted')).toBeInTheDocument()
  })

  it('renders search input', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { pitches: mockPitches } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search submissions...')).toBeInTheDocument()
    })
  })

  // --- Data ---
  it('displays submissions from API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { pitches: mockPitches } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Sci-Fi Blockbuster')).toBeInTheDocument()
    })
    expect(screen.getByText('Drama Film')).toBeInTheDocument()
    expect(screen.getByText('A thrilling sci-fi adventure.')).toBeInTheDocument()
    expect(screen.getByText('John Creator')).toBeInTheDocument()
  })

  it('renders correct stat counts', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { pitches: mockPitches } }),
    })

    renderComponent()

    await waitFor(() => {
      // Total submissions = 2
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('shows genre badges for submissions', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { pitches: mockPitches } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Sci-Fi Blockbuster')).toBeInTheDocument()
    })
    // Genre appears in both filter dropdown and submission cards
    expect(screen.getAllByText('Sci-Fi').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Drama').length).toBeGreaterThanOrEqual(1)
  })

  // --- Empty State ---
  it('shows empty state when no submissions match', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { pitches: [] } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No submissions found')).toBeInTheDocument()
    })
  })

  // --- Error State ---
  it('shows empty state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No submissions found')).toBeInTheDocument()
    })
  })

  it('shows empty state when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No submissions found')).toBeInTheDocument()
    })
  })

  // --- Filters ---
  it('renders status filter buttons', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { pitches: mockPitches } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Sci-Fi Blockbuster')).toBeInTheDocument()
    })

    // Status filter buttons show the status names (may appear in both filter and card)
    expect(screen.getAllByText('new').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('review').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('shortlisted').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('accepted').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('rejected').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('archived').length).toBeGreaterThanOrEqual(1)
  })

  it('renders genre filter dropdown', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { pitches: mockPitches } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('All Genres')).toBeInTheDocument()
    })
  })

  it('renders View Details and Contact buttons for each submission', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { pitches: mockPitches } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Sci-Fi Blockbuster')).toBeInTheDocument()
    })

    expect(screen.getAllByText('View Details')).toHaveLength(2)
    expect(screen.getAllByText('Contact')).toHaveLength(2)
  })

  // --- Search filtering ---
  it('filters submissions by search term', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { pitches: mockPitches } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Sci-Fi Blockbuster')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search submissions...')
    fireEvent.change(searchInput, { target: { value: 'Drama' } })

    await waitFor(() => {
      expect(screen.queryByText('Sci-Fi Blockbuster')).not.toBeInTheDocument()
      expect(screen.getByText('Drama Film')).toBeInTheDocument()
    })
  })
})
