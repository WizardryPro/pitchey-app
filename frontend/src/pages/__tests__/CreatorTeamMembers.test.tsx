import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── TeamService mock ────────────────────────────────────────────────
const mockGetTeams = vi.fn()
const mockGetTeamMembers = vi.fn()
const mockRemoveMember = vi.fn()

vi.mock('../../services/team.service', () => ({
  TeamService: {
    getTeams: mockGetTeams,
    getTeamMembers: mockGetTeamMembers,
    removeMember: mockRemoveMember,
  },
}))

// ─── Dynamic component import ─────────────────────────────────────────
let CreatorTeamMembers: React.ComponentType
beforeAll(async () => {
  const mod = await import('../creator/CreatorTeamMembers')
  CreatorTeamMembers = mod.default
})

const mockTeams = [
  {
    id: 'team-1',
    name: 'My Creative Team',
    description: 'Main team',
    ownerId: 'user-1',
    ownerName: 'Creator User',
    memberCount: 2,
    projectCount: 3,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

const mockMembers = [
  {
    id: 'member-1',
    userId: 'user-2',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    role: 'admin' as const,
    permissions: { canEdit: true, canInvite: true, canDelete: false, canManageRoles: true },
    status: 'active' as const,
    joinedDate: '2024-01-15T00:00:00Z',
    lastActive: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
    invitedBy: 'Creator User',
    projects: ['Project A', 'Project B'],
    bio: 'Experienced film editor',
    skills: ['Editing', 'Color Grading', 'Sound Design'],
    isPublic: true,
    contributionScore: 85,
  },
  {
    id: 'member-2',
    userId: 'user-3',
    name: 'Bob Smith',
    email: 'bob@example.com',
    role: 'member' as const,
    permissions: { canEdit: true, canInvite: false, canDelete: false, canManageRoles: false },
    status: 'pending' as const,
    joinedDate: '2024-02-01T00:00:00Z',
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    projects: [],
    skills: ['Writing', 'Directing'],
    isPublic: false,
    contributionScore: 42,
  },
]

function renderComponent() {
  return render(
    <MemoryRouter>
      <CreatorTeamMembers />
    </MemoryRouter>
  )
}

describe('CreatorTeamMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTeams.mockResolvedValue(mockTeams)
    mockGetTeamMembers.mockResolvedValue(mockMembers)
    mockRemoveMember.mockResolvedValue({})
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  describe('Loading state', () => {
    it('shows loading spinner initially', () => {
      mockGetTeams.mockReturnValue(new Promise(() => {}))
      renderComponent()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Layout and header', () => {
    it('renders Team Members heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Team Members')).toBeInTheDocument()
      })
    })

    it('renders Manage Roles button', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /manage roles/i })).toBeInTheDocument()
      })
    })

    it('renders Invite Member button', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument()
      })
    })

    it('navigates to roles page when Manage Roles is clicked', async () => {
      const { getByRole } = renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /manage roles/i })).toBeInTheDocument()
      })
      getByRole('button', { name: /manage roles/i }).click()
      expect(mockNavigate).toHaveBeenCalledWith('/creator/team/roles')
    })

    it('navigates to invite page when Invite Member is clicked', async () => {
      const { getByRole } = renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument()
      })
      getByRole('button', { name: /invite member/i }).click()
      expect(mockNavigate).toHaveBeenCalledWith('/creator/team/invite')
    })
  })

  describe('Filter controls', () => {
    it('renders search input', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search members...')).toBeInTheDocument()
      })
    })

    it('renders role filter select', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByDisplayValue('All Roles')).toBeInTheDocument()
      })
    })

    it('renders status filter select', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByDisplayValue('All Status')).toBeInTheDocument()
      })
    })

    it('renders permissions filter select', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByDisplayValue('All Permissions')).toBeInTheDocument()
      })
    })
  })

  describe('Member cards', () => {
    it('renders member names after load', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
        expect(screen.getByText('Bob Smith')).toBeInTheDocument()
      })
    })

    it('renders member email addresses', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument()
        expect(screen.getByText('bob@example.com')).toBeInTheDocument()
      })
    })

    it('shows member roles', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument()
        expect(screen.getByText('member')).toBeInTheDocument()
      })
    })

    it('shows member statuses', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument()
        expect(screen.getByText('pending')).toBeInTheDocument()
      })
    })

    it('renders member bio when available', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Experienced film editor')).toBeInTheDocument()
      })
    })

    it('renders skills for members', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Editing')).toBeInTheDocument()
        expect(screen.getByText('Writing')).toBeInTheDocument()
      })
    })

    it('renders contribution scores', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('85/100')).toBeInTheDocument()
        expect(screen.getByText('42/100')).toBeInTheDocument()
      })
    })

    it('shows results summary', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Showing 2 of 2 members/i)).toBeInTheDocument()
      })
    })
  })

  describe('Empty state — no team', () => {
    it('shows empty state when no teams exist', async () => {
      mockGetTeams.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No team members found')).toBeInTheDocument()
        expect(screen.getByText(/Start building your team/i)).toBeInTheDocument()
      })
    })

    it('shows Invite First Member button in empty state', async () => {
      mockGetTeams.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /invite first member/i })).toBeInTheDocument()
      })
    })
  })

  describe('Empty state — no members', () => {
    it('shows empty state when team has no members', async () => {
      mockGetTeamMembers.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No team members found')).toBeInTheDocument()
      })
    })
  })

  describe('Error handling', () => {
    it('still renders after service error (shows empty state)', async () => {
      mockGetTeams.mockRejectedValue(new Error('Service unavailable'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No team members found')).toBeInTheDocument()
      })
    })
  })
})
