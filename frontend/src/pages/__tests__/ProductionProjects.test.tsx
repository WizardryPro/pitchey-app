import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Mock ProductionService
const mockGetProjects = vi.fn()

vi.mock('../../services/production.service', () => ({
  ProductionService: {
    getProjects: (...args: any[]) => mockGetProjects(...args),
  },
}))

let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('../production/ProductionProjects')
  Component = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
})

const mockProjectsResponse = {
  projects: [
    {
      id: 1,
      pitchId: 10,
      title: 'Test Movie Alpha',
      status: 'production',
      budget: 5000000,
      spentBudget: 3500000,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      team: [
        { role: 'Director', name: 'Jane Smith' },
        { role: 'Producer', name: 'John Doe' },
      ],
      milestones: [],
      pitch: { genre: 'Sci-Fi' },
    },
    {
      id: 2,
      pitchId: 11,
      title: 'Test Movie Beta',
      status: 'completed',
      budget: 2000000,
      spentBudget: 1900000,
      startDate: '2023-06-01',
      endDate: '2024-03-01',
      team: [{ role: 'Director', name: 'Alice' }],
      milestones: [],
      pitch: { genre: 'Drama' },
    },
  ],
}

function renderComponent() {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionProjects', () => {
  it('shows loading spinner initially', () => {
    mockGetProjects.mockReturnValue(new Promise(() => {}))
    renderComponent()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders stats and project cards after data loads', async () => {
    mockGetProjects.mockResolvedValue(mockProjectsResponse)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Total Projects')).toBeInTheDocument()
    })

    expect(screen.getByText('2')).toBeInTheDocument() // total
    expect(screen.getByText('Active Projects')).toBeInTheDocument()
    expect(screen.getByText('Test Movie Alpha')).toBeInTheDocument()
    expect(screen.getByText('Test Movie Beta')).toBeInTheDocument()
  })

  it('shows director and producer info', async () => {
    mockGetProjects.mockResolvedValue(mockProjectsResponse)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('shows error state when API fails', async () => {
    mockGetProjects.mockRejectedValue(new Error('API failure'))
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Failed to load projects. Please try again.')).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('shows empty state when no projects', async () => {
    mockGetProjects.mockResolvedValue({ projects: [] })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No projects found')).toBeInTheDocument()
    })
  })

  it('renders filter tabs', async () => {
    mockGetProjects.mockResolvedValue(mockProjectsResponse)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('all')).toBeInTheDocument()
    })
    expect(screen.getByText('development')).toBeInTheDocument()
    expect(screen.getAllByText('completed').length).toBeGreaterThanOrEqual(1)
  })

  it('displays View Details buttons for each project', async () => {
    mockGetProjects.mockResolvedValue(mockProjectsResponse)
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('View Details')).toHaveLength(2)
    })
  })
})
