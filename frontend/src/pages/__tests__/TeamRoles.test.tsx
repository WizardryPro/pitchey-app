import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

const mockNavigate = vi.fn()
const mockLogout = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockUser = { id: 1, name: 'Production User', email: 'production@test.com', userType: 'production' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: vi.fn().mockResolvedValue(undefined),
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

vi.mock('../../components/DashboardHeader', () => ({
  default: ({ title }: any) => <div data-testid="dashboard-header">{title}</div>,
}))

const mockGetTeamRoles = vi.fn()
const mockGetTeamMembers = vi.fn()

vi.mock('../../services/team.service', () => ({
  TeamService: {
    getTeamRoles: (...args: any[]) => mockGetTeamRoles(...args),
    getTeamMembers: (...args: any[]) => mockGetTeamMembers(...args),
  },
}))

vi.mock('../../hooks/useCurrentTeam', () => ({
  useCurrentTeam: () => ({
    teamId: 'team-123',
    team: { id: 'team-123', name: 'Test Team' },
    loading: false,
    error: null,
  }),
}))

let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('../production/TeamRoles')
  Component = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
})

const mockRoles = [
  {
    id: 'role-1',
    name: 'Owner',
    description: 'Full access',
    isDefault: false,
    memberCount: 1,
    createdAt: '2024-01-01',
  },
  {
    id: 'role-2',
    name: 'Editor',
    description: 'Can edit projects',
    isDefault: true,
    memberCount: 3,
    createdAt: '2024-01-01',
  },
]

const mockMembers = [
  {
    id: 'mem-1',
    userId: 'u1',
    name: 'Alice Owner',
    email: 'alice@test.com',
    role: 'owner',
    status: 'active',
  },
  {
    id: 'mem-2',
    userId: 'u2',
    name: 'Bob Editor',
    email: 'bob@test.com',
    role: 'editor',
    status: 'active',
  },
]

function renderComponent() {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('TeamRoles', () => {
  it('shows loading spinner initially', () => {
    mockGetTeamRoles.mockReturnValue(new Promise(() => {}))
    mockGetTeamMembers.mockReturnValue(new Promise(() => {}))
    renderComponent()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders header and page title', async () => {
    mockGetTeamRoles.mockResolvedValue(mockRoles)
    mockGetTeamMembers.mockResolvedValue(mockMembers)
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('Roles & Permissions').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByText('Manage team roles and control access permissions')).toBeInTheDocument()
  })

  it('renders role cards after data loads', async () => {
    mockGetTeamRoles.mockResolvedValue(mockRoles)
    mockGetTeamMembers.mockResolvedValue(mockMembers)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument()
    })
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })

  it('shows Back to Team Management link', async () => {
    mockGetTeamRoles.mockResolvedValue(mockRoles)
    mockGetTeamMembers.mockResolvedValue(mockMembers)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Back to Team Management')).toBeInTheDocument()
    })
  })

  it('shows Create Role button', async () => {
    mockGetTeamRoles.mockResolvedValue(mockRoles)
    mockGetTeamMembers.mockResolvedValue(mockMembers)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Create Role')).toBeInTheDocument()
    })
  })

  it('shows error state when API fails', async () => {
    mockGetTeamRoles.mockRejectedValue(new Error('API error'))
    mockGetTeamMembers.mockRejectedValue(new Error('API error'))
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Failed to load roles and team members')).toBeInTheDocument()
    })
  })

  it('shows info banner about local roles', async () => {
    mockGetTeamRoles.mockResolvedValue(mockRoles)
    mockGetTeamMembers.mockResolvedValue(mockMembers)
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Role definitions are loaded from defaults/)).toBeInTheDocument()
    })
  })

  it('displays permissions count for each role', async () => {
    mockGetTeamRoles.mockResolvedValue(mockRoles)
    mockGetTeamMembers.mockResolvedValue(mockMembers)
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('Permissions').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Members').length).toBeGreaterThanOrEqual(1)
  })
})
