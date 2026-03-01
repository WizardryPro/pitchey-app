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
    title: 'Top Rated Drama',
    creator: 'Alice Director',
    creatorEmail: 'alice@test.com',
    submittedDate: '2026-01-01T00:00:00Z',
    shortlistedDate: '2026-02-01T00:00:00Z',
    genre: 'Drama',
    budget: 6000000,
    status: 'shortlisted',
    rating: 5,
    synopsis: 'A critically acclaimed drama.',
    attachments: 5,
    lastActivity: '1 day ago',
    shortlistReason: 'Exceptional script quality and market timing.',
    reviewNotes: 'Ready for greenlight.',
    marketPotential: 'high',
    competitionLevel: 'low',
    productionReadiness: 90,
  },
  {
    id: '2',
    title: 'Indie Documentary',
    creator: 'Bob Filmmaker',
    creatorEmail: 'bob@test.com',
    submittedDate: '2026-01-10T00:00:00Z',
    shortlistedDate: '2026-02-05T00:00:00Z',
    genre: 'Documentary',
    budget: 500000,
    status: 'shortlisted',
    rating: 4,
    synopsis: 'An eye-opening documentary.',
    attachments: 3,
    lastActivity: '3 days ago',
    marketPotential: 'medium',
    competitionLevel: 'medium',
    productionReadiness: 65,
  },
]

let Component: React.ComponentType

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../production/ProductionSubmissionsShortlisted')
  Component = mod.default
})

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionSubmissionsShortlisted', () => {
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
      // "Shortlisted" appears in stat card and as badge text, so use getAllByText
      expect(screen.getAllByText(/Shortlisted/i).length).toBeGreaterThanOrEqual(1)
    })
    // "High Potential" appears in stat card and market filter dropdown
    expect(screen.getAllByText('High Potential').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Production Ready')).toBeInTheDocument()
    expect(screen.getByText('Top Rated')).toBeInTheDocument()
  })

  it('renders search and filter controls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search shortlisted submissions...')).toBeInTheDocument()
    })
    expect(screen.getByText('All Genres')).toBeInTheDocument()
    expect(screen.getByText('All Market Potential')).toBeInTheDocument()
  })

  // --- Data ---
  it('displays shortlisted submissions from API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Top Rated Drama')).toBeInTheDocument()
    })
    expect(screen.getByText('Indie Documentary')).toBeInTheDocument()
    expect(screen.getByText('A critically acclaimed drama.')).toBeInTheDocument()
    expect(screen.getByText('Alice Director')).toBeInTheDocument()
  })

  it('shows SHORTLISTED badge on each submission', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('SHORTLISTED')).toHaveLength(2)
    })
  })

  it('shows market potential badges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('HIGH POTENTIAL')).toBeInTheDocument()
    })
    expect(screen.getByText('MEDIUM POTENTIAL')).toBeInTheDocument()
  })

  it('shows market analysis section', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('Market Potential').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Competition').length).toBeGreaterThanOrEqual(1)
  })

  it('shows production readiness progress bars', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      // Production Readiness label appears in both analysis section and progress bar
      expect(screen.getAllByText('Production Readiness').length).toBeGreaterThanOrEqual(2)
    })
    expect(screen.getAllByText('90%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('65%').length).toBeGreaterThanOrEqual(1)
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

  it('shows shortlist reason when present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Exceptional script quality and market timing.')).toBeInTheDocument()
    })
  })

  it('shows review notes when present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Ready for greenlight.')).toBeInTheDocument()
    })
  })

  it('renders action buttons', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: mockSubmissions } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('Approve for Production')).toHaveLength(2)
    })
    expect(screen.getAllByText('Start Production')).toHaveLength(2)
    expect(screen.getAllByText('View Details')).toHaveLength(2)
    expect(screen.getAllByText('Contact')).toHaveLength(2)
    expect(screen.getAllByText('Remove')).toHaveLength(2)
  })

  // --- Empty State ---
  it('shows empty state when no shortlisted submissions', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { submissions: [] } }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No shortlisted submissions found')).toBeInTheDocument()
    })
    expect(screen.getByText(/Submissions that have been shortlisted/)).toBeInTheDocument()
  })

  // --- Error State ---
  it('shows empty state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No shortlisted submissions found')).toBeInTheDocument()
    })
  })

  it('shows empty state when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No shortlisted submissions found')).toBeInTheDocument()
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
    expect(calledUrl).toContain('status=shortlisted')
  })
})
