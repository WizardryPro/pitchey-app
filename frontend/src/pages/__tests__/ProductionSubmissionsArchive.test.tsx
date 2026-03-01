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
    title: 'Archived Feature Film',
    creator: 'Old Creator',
    creatorEmail: 'old@test.com',
    submittedDate: '2025-06-01T00:00:00Z',
    archivedDate: '2026-01-15T00:00:00Z',
    genre: 'Drama',
    budget: 8000000,
    originalStatus: 'accepted',
    finalStatus: 'completed',
    rating: 5,
    synopsis: 'A completed feature that has been archived.',
    attachments: 10,
    lastActivity: '1 month ago',
    archiveReason: 'Project completed and released.',
    notes: 'Box office success. Keep for reference.',
    archivedBy: 'Admin User',
    tags: ['award-winner', 'drama', 'completed'],
    totalViews: 1500,
  },
  {
    id: '2',
    title: 'Cancelled Short',
    creator: 'Another Creator',
    creatorEmail: 'another@test.com',
    submittedDate: '2025-09-01T00:00:00Z',
    archivedDate: '2026-02-01T00:00:00Z',
    genre: 'Comedy',
    budget: 200000,
    originalStatus: 'review',
    finalStatus: 'cancelled',
    rating: 2,
    synopsis: 'A short film that was cancelled.',
    attachments: 2,
    lastActivity: '2 weeks ago',
    archiveReason: 'Funding fell through.',
    archivedBy: 'Producer Z',
  },
]

let Component: React.ComponentType

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../production/ProductionSubmissionsArchive')
  Component = mod.default
})

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionSubmissionsArchive', () => {
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
      expect(screen.getByText('Total Archived')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('This Year')).toBeInTheDocument()
  })

  it('renders search and filter controls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search archived submissions...')).toBeInTheDocument()
    })
    expect(screen.getByText('All Genres')).toBeInTheDocument()
    expect(screen.getByText('All Final Status')).toBeInTheDocument()
    expect(screen.getByText('All Years')).toBeInTheDocument()
  })

  it('renders sort dropdown', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Archived Date')).toBeInTheDocument()
    })
    expect(screen.getByText('Submitted Date')).toBeInTheDocument()
    expect(screen.getByText('Rating')).toBeInTheDocument()
  })

  it('renders archive information banner', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Archive Information')).toBeInTheDocument()
    })
    expect(screen.getByText(/This archive contains historical submission data/)).toBeInTheDocument()
  })

  // --- Data ---
  it('displays archived submissions from API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Archived Feature Film')).toBeInTheDocument()
    })
    expect(screen.getByText('Cancelled Short')).toBeInTheDocument()
    expect(screen.getByText('A completed feature that has been archived.')).toBeInTheDocument()
    expect(screen.getByText('Old Creator')).toBeInTheDocument()
  })

  it('shows ARCHIVED badge on each submission', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('ARCHIVED')).toHaveLength(2)
    })
  })

  it('shows final status badges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    })
    expect(screen.getByText('CANCELLED')).toBeInTheDocument()
  })

  it('shows original status badges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('WAS ACCEPTED')).toBeInTheDocument()
    })
    expect(screen.getByText('WAS REVIEW')).toBeInTheDocument()
  })

  it('shows archive reason', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Project completed and released.')).toBeInTheDocument()
    })
    expect(screen.getByText('Funding fell through.')).toBeInTheDocument()
  })

  it('shows archived by info', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Archived by: Admin User')).toBeInTheDocument()
    })
    expect(screen.getByText('Archived by: Producer Z')).toBeInTheDocument()
  })

  it('shows tags when present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('award-winner')).toBeInTheDocument()
    })
    expect(screen.getByText('completed')).toBeInTheDocument()
  })

  it('shows notes when present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Box office success. Keep for reference.')).toBeInTheDocument()
    })
  })

  it('shows total views when present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('1500 views')).toBeInTheDocument()
    })
  })

  it('shows final ratings', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('(5/5)')).toBeInTheDocument()
    })
    expect(screen.getByText('(2/5)')).toBeInTheDocument()
  })

  it('renders action buttons', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('Restore')).toHaveLength(2)
    })
    expect(screen.getAllByText('Export Data')).toHaveLength(2)
    expect(screen.getAllByText('View Details')).toHaveLength(2)
    expect(screen.getAllByText('Contact Creator')).toHaveLength(2)
    expect(screen.getAllByText('Delete Permanently')).toHaveLength(2)
  })

  // --- Empty State ---
  it('shows empty state when no archived submissions', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: [] } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No archived submissions found')).toBeInTheDocument()
    })
    expect(screen.getByText(/Completed, cancelled, and expired submissions/)).toBeInTheDocument()
  })

  // --- Error State ---
  it('shows empty state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No archived submissions found')).toBeInTheDocument()
    })
  })

  it('shows empty state when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No archived submissions found')).toBeInTheDocument()
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
    expect(calledUrl).toContain('status=archived')
  })
})
