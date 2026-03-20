import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockGetTeamMembers = vi.fn()
const mockRemoveMember = vi.fn()
const mockUpdateMemberRole = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store (stable reference) ──────────────────────────────────
const mockUser = {
  id: 1,
  name: 'Production User',
  email: 'prod@test.com',
  user_type: 'production',
  userType: 'production',
}
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: vi.fn(),
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── TeamService ─────────────────────────────────────────────────────
vi.mock('../../services/team.service', () => ({
  TeamService: {
    getTeamMembers: (...args: any[]) => mockGetTeamMembers(...args),
    removeMember: (...args: any[]) => mockRemoveMember(...args),
    updateMemberRole: (...args: any[]) => mockUpdateMemberRole(...args),
    getTeams: vi.fn().mockResolvedValue([{ id: 'team-1', name: 'Test Team' }]),
    createTeam: vi.fn(),
  },
}))

// ─── useCurrentTeam ──────────────────────────────────────────────────
vi.mock('@/shared/hooks/useCurrentTeam', () => ({
  useCurrentTeam: () => ({
    team: { id: 'team-1', name: 'Test Team' },
    teamId: 'team-1',
    loading: false,
    error: null,
    refreshTeam: vi.fn(),
    createDefaultTeam: vi.fn(),
  }),
}))

// ─── usePermissions / Permission ─────────────────────────────────────
vi.mock('@features/auth/hooks/usePermissions', () => ({
  Permission: {
    PRODUCTION_CREATE_PROJECT: 'production.create_project',
    PRODUCTION_MANAGE_CREW: 'production.manage_crew',
    PRODUCTION_SCHEDULE: 'production.schedule',
    PRODUCTION_BUDGET: 'production.budget',
    PITCH_EDIT_OWN: 'pitch.edit.own',
    PITCH_DELETE_OWN: 'pitch.delete.own',
    PITCH_VIEW_PUBLIC: 'pitch.view.public',
    DOCUMENT_UPLOAD: 'document.upload',
    DOCUMENT_VIEW_PUBLIC: 'document.view.public',
  },
  usePermissions: () => ({
    hasPermission: () => true,
    permissions: [],
  }),
}))

// ─── Sample data ─────────────────────────────────────────────────────
const sampleMembers = [
  {
    userId: 'user-1',
    id: 'user-1',
    name: 'Alice Producer',
    email: 'alice@example.com',
    role: 'owner',
    status: 'active',
    joinedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    skills: ['Screenwriting', 'Directing'],
  },
  {
    userId: 'user-2',
    id: 'user-2',
    name: 'Bob Editor',
    email: 'bob@example.com',
    role: 'editor',
    status: 'active',
    joinedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    skills: ['Editing'],
  },
  {
    userId: 'user-3',
    id: 'user-3',
    name: 'Carol Viewer',
    email: 'carol@example.com',
    role: 'viewer',
    status: 'pending',
    joinedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    skills: [],
  },
]

let TeamMembers: React.ComponentType

beforeAll(async () => {
  const mod = await import('../team/TeamMembers')
  TeamMembers = mod.default
})

describe('TeamMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTeamMembers.mockResolvedValue(sampleMembers)
    mockRemoveMember.mockResolvedValue(undefined)
    mockUpdateMemberRole.mockResolvedValue(undefined)
  })

  it('renders the page heading with Team Management title', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Team Management/i })).toBeInTheDocument()
    })
  })

  it('shows the page heading', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Team Management')).toBeInTheDocument()
    })
  })

  it('shows loading spinner while fetching members', () => {
    mockGetTeamMembers.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    // Spinner should be visible (animate-spin class)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).not.toBeNull()
  })

  it('displays team members after data loads', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Alice Producer')).toBeInTheDocument()
    })
    expect(screen.getByText('Bob Editor')).toBeInTheDocument()
    expect(screen.getByText('Carol Viewer')).toBeInTheDocument()
  })

  it('displays member emails', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    })
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
  })

  it('shows member roles in the table', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('owner')).toBeInTheDocument()
    })
    expect(screen.getByText('editor')).toBeInTheDocument()
    expect(screen.getByText('viewer')).toBeInTheDocument()
  })

  it('shows member status', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getAllByText('active').length).toBeGreaterThan(0)
    })
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it('renders search input', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search members by name, email, role, or skills...')
      ).toBeInTheDocument()
    })
  })

  it('renders Invite Member button', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Invite Member')).toBeInTheDocument()
    })
  })

  it('renders Export button', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument()
    })
  })

  it('renders Filters button', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument()
    })
  })

  it('shows table column headers', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/Name/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Role/i)).toBeInTheDocument()
    expect(screen.getByText(/Department/i)).toBeInTheDocument()
    expect(screen.getByText(/Status/i)).toBeInTheDocument()
    expect(screen.getByText(/Rating/i)).toBeInTheDocument()
    expect(screen.getByText(/Actions/i)).toBeInTheDocument()
  })

  it('shows member count in subtitle', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/members in your team/)).toBeInTheDocument()
    })
  })

  it('shows empty state when no members exist', async () => {
    mockGetTeamMembers.mockResolvedValue([])
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('No team members yet')).toBeInTheDocument()
    })
  })

  it('calls TeamService.getTeamMembers with teamId', async () => {
    render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(mockGetTeamMembers).toHaveBeenCalledWith('team-1')
    })
  })

  it('navigates to invite page when Invite Member is clicked', async () => {
    const { getByText } = render(
      <MemoryRouter>
        <TeamMembers />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(getByText('Invite Member')).toBeInTheDocument()
    })
    getByText('Invite Member').click()
    expect(mockNavigate).toHaveBeenCalledWith('/production/team/invite')
  })
})
