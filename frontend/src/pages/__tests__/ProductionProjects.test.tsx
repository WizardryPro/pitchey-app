import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Mock apiClient used by ProductionProjects
const mockApiGet = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockApiGet(...args),
    put: vi.fn(),
  },
}))

// Mock StartProjectModal — it has its own dependencies we don't need here
vi.mock('@portals/production/components/StartProjectModal', () => ({
  default: () => null,
}))

let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('@portals/production/pages/ProductionProjects')
  Component = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
})

const mockProjectsResponse = {
  success: true,
  data: {
    projects: [
      {
        id: 1,
        title: 'Test Movie Alpha',
        stage: 'production',
        status: 'active',
        priority: 'high',
        budget_allocated: 5000000,
        budget_spent: 3500000,
        budget_remaining: 1500000,
        completion_percentage: 70,
        start_date: '2024-01-01',
        target_completion_date: '2024-12-31',
        next_milestone: null,
        milestone_date: null,
        pitch_id: null,
        genre: 'Sci-Fi',
        format: null,
        logline: null,
        notes: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      {
        id: 2,
        title: 'Test Movie Beta',
        stage: 'development',
        status: 'active',
        priority: 'medium',
        budget_allocated: 2000000,
        budget_spent: 1900000,
        budget_remaining: 100000,
        completion_percentage: 95,
        start_date: '2023-06-01',
        target_completion_date: '2024-03-01',
        next_milestone: null,
        milestone_date: null,
        pitch_id: null,
        genre: 'Drama',
        format: null,
        logline: null,
        notes: null,
        created_at: '2023-06-01',
        updated_at: '2024-01-01',
      },
    ],
  },
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
    mockApiGet.mockReturnValue(new Promise(() => {}))
    renderComponent()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders stats and project cards after data loads', async () => {
    mockApiGet.mockResolvedValue(mockProjectsResponse)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Total Projects')).toBeInTheDocument()
    })

    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1) // total count
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Test Movie Alpha')).toBeInTheDocument()
    expect(screen.getByText('Test Movie Beta')).toBeInTheDocument()
  })

  it('renders genre info for projects', async () => {
    mockApiGet.mockResolvedValue(mockProjectsResponse)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Sci-Fi')).toBeInTheDocument()
    })
    expect(screen.getByText('Drama')).toBeInTheDocument()
  })

  it('shows error state when API fails', async () => {
    mockApiGet.mockRejectedValue(new Error('API failure'))
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Failed to load projects. Please try again.')).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('shows empty state when no projects', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: { projects: [] } })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No projects yet')).toBeInTheDocument()
    })
  })

  it('renders filter tabs', async () => {
    mockApiGet.mockResolvedValue(mockProjectsResponse)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
    })
    expect(screen.getAllByText(/development/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/production/i).length).toBeGreaterThanOrEqual(1)
  })

  it('displays project progress bars', async () => {
    mockApiGet.mockResolvedValue(mockProjectsResponse)
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('Progress').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('95%')).toBeInTheDocument()
  })
})
