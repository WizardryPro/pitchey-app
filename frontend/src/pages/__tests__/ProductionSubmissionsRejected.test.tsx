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
    title: 'Rejected Pitch A',
    creator: 'Sam Writer',
    creatorEmail: 'sam@test.com',
    submittedDate: '2026-01-01T00:00:00Z',
    rejectedDate: '2026-02-10T00:00:00Z',
    genre: 'Horror',
    budget: 3000000,
    status: 'rejected',
    rating: 2,
    synopsis: 'A horror script that did not meet standards.',
    attachments: 2,
    lastActivity: '3 days ago',
    rejectionReason: 'Budget too high for the concept scope.',
    rejectionCategory: 'budget',
    feedback: 'Consider reducing scope and resubmitting.',
    canResubmit: true,
    rejectedBy: 'Producer X',
  },
  {
    id: '2',
    title: 'Rejected Pitch B',
    creator: 'Lisa Creator',
    creatorEmail: 'lisa@test.com',
    submittedDate: '2026-01-15T00:00:00Z',
    rejectedDate: '2026-02-15T00:00:00Z',
    genre: 'Comedy',
    budget: 1000000,
    status: 'rejected',
    rating: 1,
    synopsis: 'A comedy that missed the mark.',
    attachments: 1,
    lastActivity: '1 day ago',
    rejectionReason: 'Content does not align with brand.',
    rejectionCategory: 'content',
    canResubmit: false,
    rejectedBy: 'Producer Y',
  },
]

let Component: React.ComponentType

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../production/ProductionSubmissionsRejected')
  Component = mod.default
})

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionSubmissionsRejected', () => {
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
      expect(screen.getByText('Total Rejected')).toBeInTheDocument()
    })
    // "Can Resubmit" appears in stat card and filter dropdown option
    expect(screen.getAllByText('Can Resubmit').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('This Month')).toBeInTheDocument()
    expect(screen.getByText('Budget Issues')).toBeInTheDocument()
  })

  it('renders search and filter controls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search rejected submissions...')).toBeInTheDocument()
    })
    expect(screen.getByText('All Genres')).toBeInTheDocument()
    expect(screen.getByText('All Rejection Reasons')).toBeInTheDocument()
    expect(screen.getByText('All Resubmit Status')).toBeInTheDocument()
  })

  it('renders sort dropdown', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Recently Rejected')).toBeInTheDocument()
    })
    expect(screen.getByText('Oldest First')).toBeInTheDocument()
  })

  // --- Data ---
  it('displays rejected submissions from API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Rejected Pitch A')).toBeInTheDocument()
    })
    expect(screen.getByText('Rejected Pitch B')).toBeInTheDocument()
    expect(screen.getByText('A horror script that did not meet standards.')).toBeInTheDocument()
    expect(screen.getByText('Sam Writer')).toBeInTheDocument()
  })

  it('shows REJECTED badge on each submission', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('REJECTED')).toHaveLength(2)
    })
  })

  it('shows rejection category badges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('BUDGET')).toBeInTheDocument()
    })
    expect(screen.getByText('CONTENT')).toBeInTheDocument()
  })

  it('shows CAN RESUBMIT badge when applicable', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('CAN RESUBMIT')).toBeInTheDocument()
    })
  })

  it('shows rejection reasons', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Budget too high for the concept scope.')).toBeInTheDocument()
    })
    expect(screen.getByText('Content does not align with brand.')).toBeInTheDocument()
  })

  it('shows feedback when present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Consider reducing scope and resubmitting.')).toBeInTheDocument()
    })
  })

  it('shows rejected by info', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Rejected by Producer X')).toBeInTheDocument()
    })
    expect(screen.getByText('Rejected by Producer Y')).toBeInTheDocument()
  })

  it('shows final ratings', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('(2/5)')).toBeInTheDocument()
    })
    expect(screen.getByText('(1/5)')).toBeInTheDocument()
  })

  it('renders action buttons', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      // Reconsider only appears for canResubmit=true (1 submission)
      expect(screen.getAllByText('Reconsider')).toHaveLength(1)
    })
    expect(screen.getAllByText('Archive')).toHaveLength(2)
    expect(screen.getAllByText('Send Feedback')).toHaveLength(2)
    expect(screen.getAllByText('View Details')).toHaveLength(2)
    expect(screen.getAllByText('Delete')).toHaveLength(2)
  })

  // --- Empty State ---
  it('shows empty state when no rejected submissions', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: [] } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No rejected submissions found')).toBeInTheDocument()
    })
    expect(screen.getByText(/Submissions that have been rejected/)).toBeInTheDocument()
  })

  // --- Error State ---
  it('shows empty state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No rejected submissions found')).toBeInTheDocument()
    })
  })

  it('shows empty state when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No rejected submissions found')).toBeInTheDocument()
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
    expect(calledUrl).toContain('status=rejected')
  })
})
