import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Mock config
vi.mock('../../config', () => ({
  config: { apiUrl: '' },
  API_URL: '',
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

const mockSubmissions = [
  {
    id: '1',
    title: 'Thriller Under Review',
    creator: 'Jane Reviewer',
    creatorEmail: 'jane@test.com',
    submittedDate: '2026-01-01T00:00:00Z',
    reviewStartedDate: '2026-01-10T00:00:00Z',
    genre: 'Thriller',
    budget: 4000000,
    status: 'review',
    rating: 4,
    synopsis: 'A gripping psychological thriller.',
    attachments: 3,
    lastActivity: '1 day ago',
    reviewNotes: 'Strong concept, needs script polish.',
    reviewer: 'Producer A',
    reviewProgress: 85,
    timeInReview: 8,
  },
  {
    id: '2',
    title: 'Horror Concept',
    creator: 'Mike Horror',
    creatorEmail: 'mike@test.com',
    submittedDate: '2026-01-05T00:00:00Z',
    reviewStartedDate: '2026-01-15T00:00:00Z',
    genre: 'Horror',
    budget: 1500000,
    status: 'review',
    rating: 3,
    synopsis: 'A terrifying horror experience.',
    attachments: 2,
    lastActivity: '3 days ago',
    reviewer: 'Producer B',
    reviewProgress: 40,
    timeInReview: 3,
  },
]

let Component: React.ComponentType

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../production/ProductionSubmissionsReview')
  Component = mod.default
})

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionSubmissionsReview', () => {
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
      expect(screen.getByText('In Review')).toBeInTheDocument()
    })
    expect(screen.getByText('Near Complete')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('High Rated')).toBeInTheDocument()
  })

  it('renders search and filter controls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search submissions under review...')).toBeInTheDocument()
    })
    expect(screen.getByText('All Genres')).toBeInTheDocument()
    expect(screen.getByText('All Reviewers')).toBeInTheDocument()
    expect(screen.getByText('Time in Review')).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
    expect(screen.getByText('Rating')).toBeInTheDocument()
  })

  // --- Data ---
  it('displays review submissions from API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Thriller Under Review')).toBeInTheDocument()
    })
    expect(screen.getByText('Horror Concept')).toBeInTheDocument()
    expect(screen.getByText('A gripping psychological thriller.')).toBeInTheDocument()
    expect(screen.getByText('Jane Reviewer')).toBeInTheDocument()
  })

  it('shows UNDER REVIEW badge', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('UNDER REVIEW')).toHaveLength(2)
    })
  })

  it('shows review progress bars', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('Review Progress')).toHaveLength(2)
    })
    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('shows time in review badges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('8 DAYS')).toBeInTheDocument()
    })
    expect(screen.getByText('3 DAYS')).toBeInTheDocument()
  })

  it('shows current ratings', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('(4/5)')).toBeInTheDocument()
    })
    expect(screen.getByText('(3/5)')).toBeInTheDocument()
  })

  it('shows review notes when present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Strong concept, needs script polish.')).toBeInTheDocument()
    })
  })

  it('shows reviewer name', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      // Reviewer names appear both in dropdown filter and submission cards
      expect(screen.getAllByText('Producer A').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Producer B').length).toBeGreaterThanOrEqual(1)
  })

  it('renders action buttons', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('Approve')).toHaveLength(2)
    })
    expect(screen.getAllByText('Shortlist')).toHaveLength(2)
    expect(screen.getAllByText('Reject')).toHaveLength(2)
    expect(screen.getAllByText('Add Note')).toHaveLength(2)
    expect(screen.getAllByText('Contact')).toHaveLength(2)
  })

  // --- Stats ---
  it('renders correct stat counts', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      // Total In Review = 2
      expect(screen.getByText('2')).toBeInTheDocument()
    })
    // Near Complete (progress >= 80) = 1
    // Overdue (timeInReview > 7) = 1
    // High Rated (rating >= 4) = 1
  })

  // --- Empty State ---
  it('shows empty state when no submissions under review', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: [] } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No submissions under review')).toBeInTheDocument()
    })
    expect(screen.getByText(/Submissions that are actively being reviewed/)).toBeInTheDocument()
  })

  // --- Error State ---
  it('shows empty state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No submissions under review')).toBeInTheDocument()
    })
  })

  it('shows empty state when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No submissions under review')).toBeInTheDocument()
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
    expect(calledUrl).toContain('status=review')
  })
})
