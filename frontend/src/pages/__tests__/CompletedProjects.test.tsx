import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()
const mockGetCompletedProjects = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store ─────────────────────────────────────────────────────
const mockUser = { id: 1, name: 'Investor User', email: 'investor@test.com', user_type: 'investor' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: mockCheckSession,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Investor service ────────────────────────────────────────────────
vi.mock('@/services/investor.service', () => ({
  investorApi: {
    getCompletedProjects: mockGetCompletedProjects,
  },
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('@/components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

// ─── Defensive utilities ────────────────────────────────────────────
vi.mock('../../utils/defensive', () => ({
  safeArray: (v: any) => v || [],
  safeMap: (arr: any[], fn: any) => (arr || []).map(fn),
  safeAccess: (obj: any, path: string, def: any) => {
    const keys = path.split('.')
    let cur = obj
    for (const k of keys) {
      if (cur == null) return def
      cur = cur[k]
    }
    return cur ?? def
  },
  safeNumber: (v: any, def: number = 0) => (typeof v === 'number' ? v : def),
  safeString: (v: any, def: string = '') => (typeof v === 'string' ? v : def),
  safeExecute: (fn: any) => { try { return fn() } catch { return undefined } },
}))

const mockProjects = [
  {
    id: 1,
    pitch_id: 10,
    pitch_title: 'Sunset Boulevard Reborn',
    pitch_genre: 'Drama',
    company_name: 'Sunset Films',
    completion_date: '2024-01-15T00:00:00Z',
    investment_amount: 100000,
    final_return: 175000,
    roi_percentage: 75,
    status: 'completed',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  {
    id: 2,
    pitch_id: 11,
    pitch_title: 'Galaxy Quest II',
    pitch_genre: 'Sci-Fi',
    company_name: 'Space Productions',
    completion_date: '2023-11-01T00:00:00Z',
    investment_amount: 200000,
    final_return: 300000,
    roi_percentage: 50,
    status: 'completed',
    created_at: '2022-06-01T00:00:00Z',
    updated_at: '2023-11-01T00:00:00Z',
  },
]

let CompletedProjects: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/CompletedProjects')
  CompletedProjects = mod.default
})

describe('CompletedProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    mockGetCompletedProjects.mockResolvedValue({
      success: true,
      data: { projects: mockProjects },
    })
  })

  it('shows loading spinner initially', async () => {
    mockGetCompletedProjects.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <CompletedProjects />
      </MemoryRouter>
    )
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders page heading after load', async () => {
    render(
      <MemoryRouter>
        <CompletedProjects />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Completed Projects')).toBeInTheDocument()
    })
  })

  it('renders summary stat cards', async () => {
    render(
      <MemoryRouter>
        <CompletedProjects />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Total Invested')).toBeInTheDocument()
      expect(screen.getByText('Total Returns')).toBeInTheDocument()
      expect(screen.getByText('Average ROI')).toBeInTheDocument()
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
    })
  })

  it('renders project cards from API data', async () => {
    render(
      <MemoryRouter>
        <CompletedProjects />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Sunset Boulevard Reborn')).toBeInTheDocument()
      expect(screen.getByText('Galaxy Quest II')).toBeInTheDocument()
    })
  })

  it('renders filter controls', async () => {
    render(
      <MemoryRouter>
        <CompletedProjects />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument()
      expect(screen.getByText('All Status')).toBeInTheDocument()
      expect(screen.getByText('Most Recent')).toBeInTheDocument()
    })
  })

  it('renders Export Report button', async () => {
    render(
      <MemoryRouter>
        <CompletedProjects />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Export Report')).toBeInTheDocument()
    })
  })

  it('shows empty state when no projects', async () => {
    mockGetCompletedProjects.mockResolvedValue({
      success: true,
      data: { projects: [] },
    })
    render(
      <MemoryRouter>
        <CompletedProjects />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No completed projects found')).toBeInTheDocument()
    })
  })

  it('shows empty state on API failure', async () => {
    mockGetCompletedProjects.mockRejectedValue(new Error('API error'))
    render(
      <MemoryRouter>
        <CompletedProjects />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No completed projects found')).toBeInTheDocument()
    })
  })

  it('renders Financial Performance section', async () => {
    render(
      <MemoryRouter>
        <CompletedProjects />
      </MemoryRouter>
    )
    await waitFor(() => {
      const fpSections = screen.getAllByText('Financial Performance')
      expect(fpSections.length).toBeGreaterThan(0)
    })
  })
})
