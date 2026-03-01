import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import ProductionCollaborations from '../production/ProductionCollaborations'

// Mock config
vi.mock('../../config', () => ({
  config: { apiUrl: 'http://localhost:8001' },
  API_URL: 'http://localhost:8001',
}))

// Mock CollaborationService
const mockGetCollaborations = vi.fn()
vi.mock('../../services/collaboration.service', () => ({
  CollaborationService: {
    getCollaborations: (...args: any[]) => mockGetCollaborations(...args),
  },
}))

const mockCollaborations = [
  {
    id: '1',
    title: 'Studio Partnership',
    partnerName: 'Summit Studios',
    partnerType: 'studio',
    status: 'active',
    description: 'Feature film co-production deal',
    partner: { name: 'Summit Studios', type: 'studio' },
    startDate: '2026-01-01',
    projectCount: 3,
    totalValue: 500000,
    contactPerson: 'John Smith',
    contactEmail: 'john@summit.com',
    location: 'Los Angeles',
    rating: 4.5,
    tags: ['film', 'co-production'],
    lastActivity: '2026-02-10',
    documents: [],
    projects: [],
  },
  {
    id: '2',
    title: 'Distribution Deal',
    partnerName: 'Global Distributors',
    partnerType: 'distributor',
    status: 'pending',
    description: 'International distribution agreement',
    partner: { name: 'Global Distributors', type: 'distributor' },
    startDate: '2026-01-15',
    projectCount: 1,
    totalValue: 200000,
    contactPerson: 'Jane Doe',
    contactEmail: 'jane@global.com',
    location: 'New York',
    rating: 4.0,
    tags: ['distribution'],
    lastActivity: '2026-02-05',
    documents: [],
    projects: [],
  },
]

describe('ProductionCollaborations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading spinner while fetching collaborations', () => {
    mockGetCollaborations.mockReturnValue(new Promise(() => {}))

    render(<MemoryRouter><ProductionCollaborations /></MemoryRouter>)

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  // ─── Empty State ──────────────────────────────────────────────────

  it('shows empty state when no collaborations are returned', async () => {
    mockGetCollaborations.mockResolvedValue([])

    render(<MemoryRouter><ProductionCollaborations /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('No collaborations found')).toBeInTheDocument()
    })
    expect(screen.getByText('Start building partnerships with industry professionals')).toBeInTheDocument()
  })

  // ─── Success State ────────────────────────────────────────────────

  it('displays collaboration cards after successful fetch', async () => {
    mockGetCollaborations.mockResolvedValue(mockCollaborations)

    render(<MemoryRouter><ProductionCollaborations /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('Summit Studios')).toBeInTheDocument()
    })
    expect(screen.getByText('Global Distributors')).toBeInTheDocument()
    expect(screen.getByText('Feature film co-production deal')).toBeInTheDocument()
  })

  it('renders page header and New Collaboration button', async () => {
    mockGetCollaborations.mockResolvedValue(mockCollaborations)

    render(<MemoryRouter><ProductionCollaborations /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('Collaborations')).toBeInTheDocument()
    })
    expect(screen.getByText('Manage partnerships and external collaborations')).toBeInTheDocument()
    expect(screen.getByText('New Collaboration')).toBeInTheDocument()
  })

  // ─── Error Handling ───────────────────────────────────────────────

  it('shows empty state when API call fails', async () => {
    mockGetCollaborations.mockRejectedValue(new Error('Network error'))

    render(<MemoryRouter><ProductionCollaborations /></MemoryRouter>)

    await waitFor(() => {
      // On error, collaborations array stays empty, so empty state appears
      expect(screen.getByText('No collaborations found')).toBeInTheDocument()
    })
  })

  // ─── Search Filtering ─────────────────────────────────────────────

  it('filters collaborations by search term', async () => {
    mockGetCollaborations.mockResolvedValue(mockCollaborations)

    render(<MemoryRouter><ProductionCollaborations /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('Summit Studios')).toBeInTheDocument()
      expect(screen.getByText('Global Distributors')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search collaborations, partners, or projects...')
    fireEvent.change(searchInput, { target: { value: 'Summit' } })

    await waitFor(() => {
      expect(screen.getByText('Summit Studios')).toBeInTheDocument()
      expect(screen.queryByText('Global Distributors')).not.toBeInTheDocument()
    })
  })
})
