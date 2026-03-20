import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockGetTeamById = vi.fn()
const mockGetInvitations = vi.fn()

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
    getTeamById: (...args: any[]) => mockGetTeamById(...args),
    getInvitations: (...args: any[]) => mockGetInvitations(...args),
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

// ─── Sample data ─────────────────────────────────────────────────────
const recentJoinDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

const sampleTeamDetail = {
  id: 'team-1',
  name: 'Test Team',
  members: [
    {
      userId: 'user-1',
      name: 'Alice Producer',
      email: 'alice@example.com',
      role: 'owner',
      joinedAt: recentJoinDate,
    },
    {
      userId: 'user-2',
      name: 'Bob Editor',
      email: 'bob@example.com',
      role: 'editor',
      joinedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      userId: 'user-3',
      name: 'Carol Viewer',
      email: 'carol@example.com',
      role: 'viewer',
      joinedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
}

const sampleInvitations = [
  {
    id: 'inv-1',
    teamId: 'team-1',
    email: 'pending1@example.com',
    role: 'editor',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'inv-2',
    teamId: 'team-1',
    email: 'accepted1@example.com',
    role: 'viewer',
    status: 'accepted',
    createdAt: new Date().toISOString(),
  },
]

let TeamOverview: React.ComponentType

beforeAll(async () => {
  const mod = await import('../team/TeamOverview')
  TeamOverview = mod.default
})

describe('TeamOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTeamById.mockResolvedValue(sampleTeamDetail)
    mockGetInvitations.mockResolvedValue(sampleInvitations)
  })

  it('renders the Team Dashboard heading', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Team Dashboard/i })).toBeInTheDocument()
    })
  })

  it('shows the Team Dashboard heading', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Team Dashboard')).toBeInTheDocument()
    })
  })

  it('shows loading spinner initially', () => {
    mockGetTeamById.mockReturnValue(new Promise(() => {}))
    mockGetInvitations.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).not.toBeNull()
  })

  it('renders Team Metrics section', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Team Metrics')).toBeInTheDocument()
    })
  })

  it('displays total members count', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Total Members')).toBeInTheDocument()
    })
    // 3 members in sampleTeamDetail
    const metricValues = screen.getAllByText('3')
    expect(metricValues.length).toBeGreaterThan(0)
  })

  it('displays pending invites count', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Pending Invites')).toBeInTheDocument()
    })
    // 1 pending invitation
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  it('renders Project Overview section', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Project Overview')).toBeInTheDocument()
    })
    expect(screen.getByText('Total Projects')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('renders Recent Activity section', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    })
  })

  it('displays member join activities', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      // Members with joinedAt show up in activity feed
      expect(screen.getByText('Alice Producer')).toBeInTheDocument()
    })
  })

  it('renders Upcoming Events section', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Upcoming Events')).toBeInTheDocument()
    })
  })

  it('renders Quick Actions section', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    })
  })

  it('renders Invite Member button', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getAllByText('Invite Member').length).toBeGreaterThan(0)
    })
  })

  it('renders View All Members button', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('View All Members')).toBeInTheDocument()
    })
  })

  it('renders Manage Invites button', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Manage Invites')).toBeInTheDocument()
    })
  })

  it('renders View Calendar button', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('View Calendar')).toBeInTheDocument()
    })
  })

  it('navigates to /team/invite when Invite Member is clicked', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getAllByText('Invite Member').length).toBeGreaterThan(0)
    })
    screen.getAllByText('Invite Member')[0].click()
    expect(mockNavigate).toHaveBeenCalledWith('/team/invite')
  })

  it('navigates to /team/members when View All Members is clicked', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('View All Members')).toBeInTheDocument()
    })
    screen.getByText('View All Members').click()
    expect(mockNavigate).toHaveBeenCalledWith('/team/members')
  })

  it('calls TeamService.getTeamById and getInvitations on mount', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(mockGetTeamById).toHaveBeenCalledWith('team-1')
      expect(mockGetInvitations).toHaveBeenCalledTimes(1)
    })
  })

  it('handles API failure gracefully', async () => {
    mockGetTeamById.mockRejectedValue(new Error('Network error'))
    mockGetInvitations.mockRejectedValue(new Error('Network error'))
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>
    )
    // Should not crash — still renders page structure
    await waitFor(() => {
      expect(screen.getByText('Team Dashboard')).toBeInTheDocument()
    })
  })
})
