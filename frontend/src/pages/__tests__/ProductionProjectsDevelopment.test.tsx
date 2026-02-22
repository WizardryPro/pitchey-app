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
  const mod = await import('../production/ProductionProjectsDevelopment')
  Component = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.fetch = mockFetch
})

const mockProjects = [
  {
    id: '1',
    title: 'Dev Project Alpha',
    genre: 'Thriller',
    status: 'script-review',
    budget: 3000000,
    estimatedStartDate: '2024-06-01',
    progress: 40,
    team: 12,
    director: 'Dir One',
    producer: 'Prod One',
    scriptwriter: 'Writer One',
    priority: 'urgent',
    phase: 'script',
    lastActivity: '2024-02-15',
    daysInDevelopment: 120,
  },
  {
    id: '2',
    title: 'Dev Project Beta',
    genre: 'Comedy',
    status: 'financing',
    budget: 8000000,
    estimatedStartDate: '2024-09-01',
    progress: 60,
    team: 8,
    priority: 'medium',
    phase: 'planning',
    lastActivity: '2024-02-10',
    daysInDevelopment: 90,
  },
]

function renderComponent() {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionProjectsDevelopment', () => {
  it('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    renderComponent()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders stats and project cards after load', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Dev Project Alpha')).toBeInTheDocument()
    })
    expect(screen.getByText('Total in Development')).toBeInTheDocument()
    expect(screen.getAllByText(/Script Review/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Average Progress')).toBeInTheDocument()
    expect(screen.getByText('Dev Project Beta')).toBeInTheDocument()
  })

  it('displays priority and phase badges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('URGENT')).toBeInTheDocument()
    })
    expect(screen.getByText('MEDIUM')).toBeInTheDocument()
  })

  it('shows team info (director/producer/writer)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Dir One')).toBeInTheDocument()
    })
    expect(screen.getByText('Prod One')).toBeInTheDocument()
    expect(screen.getByText('Writer One')).toBeInTheDocument()
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
      expect(screen.getByText('No development projects found')).toBeInTheDocument()
    })
  })

  it('renders search and filter controls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search projects, genres, directors...')).toBeInTheDocument()
    })
    expect(screen.getByText('All Status')).toBeInTheDocument()
    expect(screen.getByText('All Priority')).toBeInTheDocument()
    expect(screen.getByText('All Phases')).toBeInTheDocument()
  })
})
