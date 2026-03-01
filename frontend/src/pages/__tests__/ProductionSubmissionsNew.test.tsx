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
    title: 'Action Movie Pitch',
    creator: 'Alex Creator',
    creatorEmail: 'alex@test.com',
    submittedDate: '2026-02-01T00:00:00Z',
    genre: 'Action',
    budget: 3000000,
    status: 'new',
    rating: 0,
    synopsis: 'An explosive action thriller.',
    attachments: 2,
    lastActivity: '2 days ago',
    priority: 'high',
    daysOld: 5,
  },
  {
    id: '2',
    title: 'Comedy Script',
    creator: 'Bob Writer',
    creatorEmail: 'bob@test.com',
    submittedDate: '2026-02-10T00:00:00Z',
    genre: 'Comedy',
    budget: 1000000,
    status: 'new',
    rating: 0,
    synopsis: 'A hilarious comedy about office life.',
    attachments: 1,
    lastActivity: '1 day ago',
    priority: 'low',
    daysOld: 1,
  },
]

let Component: React.ComponentType

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../production/ProductionSubmissionsNew')
  Component = mod.default
})

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionSubmissionsNew', () => {
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
      expect(screen.getByText('Total New')).toBeInTheDocument()
    })
    expect(screen.getByText('Urgent Review')).toBeInTheDocument()
    expect(screen.getByText('High Priority')).toBeInTheDocument()
    expect(screen.getByText('High Budget')).toBeInTheDocument()
  })

  it('renders search input', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search new submissions...')).toBeInTheDocument()
    })
  })

  it('renders sort dropdown options', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Newest First')).toBeInTheDocument()
    })
    expect(screen.getByText('Oldest First')).toBeInTheDocument()
    expect(screen.getByText('Priority')).toBeInTheDocument()
    expect(screen.getByText('Budget')).toBeInTheDocument()
  })

  // --- Data ---
  it('displays submissions from API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Action Movie Pitch')).toBeInTheDocument()
    })
    expect(screen.getByText('Comedy Script')).toBeInTheDocument()
    expect(screen.getByText('An explosive action thriller.')).toBeInTheDocument()
    expect(screen.getByText('Alex Creator')).toBeInTheDocument()
  })

  it('shows NEW badge on each submission', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('NEW')).toHaveLength(2)
    })
  })

  it('shows priority badge for high priority submissions', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('HIGH PRIORITY')).toBeInTheDocument()
    })
    expect(screen.getByText('LOW PRIORITY')).toBeInTheDocument()
  })

  it('shows URGENT badge when daysOld > 3', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('URGENT')).toBeInTheDocument()
    })
  })

  it('renders action buttons for each submission', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('Start Review')).toHaveLength(2)
    })
    expect(screen.getAllByText('Quick Approve')).toHaveLength(2)
    expect(screen.getAllByText('Quick Reject')).toHaveLength(2)
    expect(screen.getAllByText('Contact Creator')).toHaveLength(2)
  })

  // --- Action Banner ---
  it('renders Review Required banner', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Review Required')).toBeInTheDocument()
    })
    expect(screen.getByText('Start Batch Review')).toBeInTheDocument()
  })

  it('navigates to review page when Start Batch Review is clicked', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Start Batch Review')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Start Batch Review'))
    expect(mockNavigate).toHaveBeenCalledWith('/production/submissions/review')
  })

  // --- Stats ---
  it('renders correct stat counts', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      // Total New = 2
      expect(screen.getByText('2')).toBeInTheDocument()
    })
    // Urgent (daysOld > 3) = 1
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
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
    expect(calledUrl).toContain('status=new')
  })

  // --- Empty State ---
  it('shows empty state when no submissions', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: [] } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No new submissions found')).toBeInTheDocument()
    })
    expect(screen.getByText(/New submissions will appear here/)).toBeInTheDocument()
  })

  // --- Error State ---
  it('shows empty state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No new submissions found')).toBeInTheDocument()
    })
  })

  it('shows empty state when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No new submissions found')).toBeInTheDocument()
    })
  })

  // --- Search ---
  it('filters submissions by search term', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Action Movie Pitch')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search new submissions...')
    fireEvent.change(searchInput, { target: { value: 'Comedy' } })

    await waitFor(() => {
      expect(screen.queryByText('Action Movie Pitch')).not.toBeInTheDocument()
      expect(screen.getByText('Comedy Script')).toBeInTheDocument()
    })
  })
})
