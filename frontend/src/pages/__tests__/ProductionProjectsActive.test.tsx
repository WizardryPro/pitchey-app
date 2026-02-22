import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('../../config', () => ({
  config: {},
  API_URL: 'http://test-api',
}))

let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('../production/ProductionProjectsActive')
  Component = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.fetch = mockFetch
})

const mockProjects = [
  {
    id: '1',
    title: 'Active Film One',
    genre: 'Action',
    status: 'principal-photography',
    budget: 10000000,
    startDate: '2024-01-01',
    expectedWrapDate: '2024-06-01',
    progress: 65,
    team: 45,
    director: 'Chris Director',
    producer: 'Pat Producer',
    cinematographer: 'Sam DP',
    location: 'Los Angeles',
    daysFilmed: 30,
    totalShootingDays: 60,
    currentPhase: 'filming',
    dailyProgress: 85,
    budget_spent: 7500000,
    crew_status: 'full',
  },
  {
    id: '2',
    title: 'Active Film Two',
    genre: 'Drama',
    status: 'pre-production',
    budget: 5000000,
    startDate: '2024-03-01',
    expectedWrapDate: '2024-09-01',
    progress: 25,
    team: 20,
    location: 'New York',
    daysFilmed: 0,
    totalShootingDays: 40,
    currentPhase: 'setup',
    dailyProgress: 0,
    budget_spent: 500000,
    crew_status: 'critical',
  },
]

function renderComponent() {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionProjectsActive', () => {
  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    renderComponent()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders stats and project cards after data loads', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Active Film One')).toBeInTheDocument()
    })
    expect(screen.getByText('Active Productions')).toBeInTheDocument()
    expect(screen.getByText('Currently Filming')).toBeInTheDocument()
    expect(screen.getByText('Active Film Two')).toBeInTheDocument()
  })

  it('shows crew issues count', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Crew Issues')).toBeInTheDocument()
    })
    // 1 project has critical crew status
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
  })

  it('displays director/producer/DP info', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Chris Director')).toBeInTheDocument()
    })
    expect(screen.getByText('Pat Producer')).toBeInTheDocument()
    expect(screen.getByText('Sam DP')).toBeInTheDocument()
  })

  it('shows error state when fetch fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })
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
      expect(screen.getByText('No active productions found')).toBeInTheDocument()
    })
  })

  it('renders filter selects', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('All Status')).toBeInTheDocument()
    })
    expect(screen.getByText('All Phases')).toBeInTheDocument()
    expect(screen.getByText('All Locations')).toBeInTheDocument()
  })
})
