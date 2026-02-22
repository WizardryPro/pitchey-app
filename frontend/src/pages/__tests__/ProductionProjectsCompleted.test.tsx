import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('../../config', () => ({
  config: {},
  API_URL: 'http://test-api',
}))

let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('../production/ProductionProjectsCompleted')
  Component = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.fetch = mockFetch
})

const mockProjects = [
  {
    id: '1',
    title: 'Completed Film One',
    genre: 'Action',
    status: 'theatrical-release',
    budget: 5000000,
    finalBudget: 5200000,
    startDate: '2023-01-01',
    wrapDate: '2023-08-01',
    deliveryDate: '2023-10-01',
    releaseDate: '2024-01-15',
    team: 50,
    director: 'Dir Completed',
    producer: 'Prod Completed',
    runtime: 130,
    rating: 'PG-13',
    boxOffice: 25000000,
    streamingViews: 5000000,
    criticsScore: 85,
    audienceScore: 90,
    awards: {
      wins: 3,
      nominations: 7,
      festivals: ['Sundance', 'Cannes'],
    },
    distribution: {
      theatrical: true,
      streaming: ['Netflix'],
    },
    roi: 380,
    profitLoss: 19800000,
    performance: 'excellent',
    lessons: ['Good pacing', 'Strong casting'],
    totalDays: 280,
  },
  {
    id: '2',
    title: 'Completed Film Two',
    genre: 'Drama',
    status: 'streaming-release',
    budget: 2000000,
    finalBudget: 2100000,
    startDate: '2023-03-01',
    wrapDate: '2023-06-01',
    deliveryDate: '2023-09-01',
    team: 25,
    runtime: 95,
    rating: 'R',
    criticsScore: 72,
    audienceScore: 78,
    awards: {
      wins: 0,
      nominations: 2,
      festivals: [],
    },
    distribution: {},
    roi: 50,
    profitLoss: 1000000,
    performance: 'good',
    lessons: [],
    totalDays: 180,
  },
]

function renderComponent() {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionProjectsCompleted', () => {
  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    renderComponent()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders stats after data loads', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Completed Projects')).toBeInTheDocument()
    })
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    expect(screen.getByText('Average ROI')).toBeInTheDocument()
    expect(screen.getByText('Awards Won')).toBeInTheDocument()
  })

  it('renders project cards with titles and runtime', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Completed Film One')).toBeInTheDocument()
    })
    expect(screen.getByText('Completed Film Two')).toBeInTheDocument()
  })

  it('shows ROI and profit/loss figures', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('+380%')).toBeInTheDocument()
    })
    expect(screen.getByText('+50%')).toBeInTheDocument()
  })

  it('displays awards and festivals', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Sundance')).toBeInTheDocument()
    })
    expect(screen.getByText('Cannes')).toBeInTheDocument()
    expect(screen.getByText('3 wins, 7 nominations')).toBeInTheDocument()
  })

  it('shows director and producer info', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Dir Completed')).toBeInTheDocument()
    })
    expect(screen.getByText('Prod Completed')).toBeInTheDocument()
  })

  it('shows error state when fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument()
    })
  })

  it('shows empty state when no projects', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: [] }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No completed projects found')).toBeInTheDocument()
    })
  })
})
