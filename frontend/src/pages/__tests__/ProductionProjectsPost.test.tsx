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
  const mod = await import('../production/ProductionProjectsPost')
  Component = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.fetch = mockFetch
})

const mockProjects = [
  {
    id: '1',
    title: 'Post Project One',
    genre: 'Sci-Fi',
    status: 'editing',
    budget: 4000000,
    wrapDate: '2024-01-15',
    expectedDelivery: '2025-06-01',
    progress: 55,
    team: 15,
    editor: 'Ed Editor',
    colorist: 'Col Colorist',
    soundDesigner: 'Sound Person',
    phase: 'fine-cut',
    editingProgress: 80,
    colorProgress: 40,
    soundProgress: 30,
    vfxProgress: 20,
    totalRuntime: 120,
    deliveryFormat: ['DCP', '4K HDR', 'Dolby Atmos'],
    clientApprovals: {
      roughCut: true,
      fineCut: false,
      colorCorrection: false,
      soundMix: false,
      finalDelivery: false,
    },
    priority: 'high',
    budget_spent: 2000000,
    daysInPost: 60,
  },
  {
    id: '2',
    title: 'Post Project Two',
    genre: 'Drama',
    status: 'color-correction',
    budget: 2000000,
    wrapDate: '2024-02-01',
    expectedDelivery: '2025-08-01',
    progress: 75,
    team: 10,
    phase: 'picture-lock',
    editingProgress: 100,
    colorProgress: 60,
    soundProgress: 50,
    vfxProgress: 80,
    totalRuntime: 95,
    deliveryFormat: ['ProRes', 'H.265'],
    clientApprovals: {
      roughCut: true,
      fineCut: true,
      colorCorrection: false,
      soundMix: false,
      finalDelivery: false,
    },
    priority: 'medium',
    budget_spent: 1500000,
    daysInPost: 45,
  },
]

function renderComponent() {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionProjectsPost', () => {
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
      expect(screen.getByText('In Post-Production')).toBeInTheDocument()
    })
    expect(screen.getByText('In Editing')).toBeInTheDocument()
    expect(screen.getByText('Average Progress')).toBeInTheDocument()
    expect(screen.getByText('Urgent Deliveries')).toBeInTheDocument()
  })

  it('renders project cards with titles', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Post Project One')).toBeInTheDocument()
    })
    expect(screen.getByText('Post Project Two')).toBeInTheDocument()
  })

  it('displays team members (editor/colorist/sound)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Ed Editor')).toBeInTheDocument()
    })
    expect(screen.getByText('Col Colorist')).toBeInTheDocument()
    expect(screen.getByText('Sound Person')).toBeInTheDocument()
  })

  it('shows delivery formats', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects }),
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('DCP')).toBeInTheDocument()
    })
    expect(screen.getByText('4K HDR')).toBeInTheDocument()
    expect(screen.getByText('Dolby Atmos')).toBeInTheDocument()
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
      expect(screen.getByText('No post-production projects found')).toBeInTheDocument()
    })
  })

  it('fetches from correct API endpoint with post_production status', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: [] }),
    })
    renderComponent()

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    const calledUrl: string = mockFetch.mock.calls[0][0]
    expect(calledUrl).toContain('/api/production/projects')
    expect(calledUrl).toContain('status=post_production')
  })
})
