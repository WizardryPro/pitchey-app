import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
const mockGetTeamRoles = vi.fn()

vi.mock('../../services/team.service', () => ({
  TeamService: {
    getTeams: mockGetTeams,
    getTeamRoles: mockGetTeamRoles,
  },
}))

// ─── Dynamic component import ─────────────────────────────────────────
let CreatorTeamRoles: React.ComponentType
beforeAll(async () => {
  const mod = await import('../creator/CreatorTeamRoles')
  CreatorTeamRoles = mod.default
})

const mockTeams = [
  {
    id: 'team-1',
    name: 'My Creative Team',
    ownerId: 'user-1',
    ownerName: 'Creator User',
    memberCount: 3,
    projectCount: 2,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

const mockApiRoles = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full control of the team',
    permissions: {
      canEdit: true,
      canInvite: true,
      canDelete: true,
      canManageRoles: true,
      canViewAnalytics: true,
      canManagePitches: true,
    },
    memberCount: 1,
    isDefault: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'member',
    name: 'Member',
    description: 'Standard team member',
    permissions: {
      canEdit: true,
      canInvite: false,
      canDelete: false,
      canManageRoles: false,
      canViewAnalytics: true,
      canManagePitches: false,
    },
    memberCount: 2,
    isDefault: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'custom-1',
    name: 'Senior Editor',
    description: 'Can edit and manage content',
    permissions: {
      canEdit: true,
      canInvite: false,
      canDelete: false,
      canManageRoles: false,
      canViewAnalytics: false,
      canManagePitches: false,
    },
    memberCount: 0,
    isDefault: false,
    createdAt: '2024-03-01T00:00:00Z',
  },
]

function renderComponent() {
  return render(
    <MemoryRouter>
      <CreatorTeamRoles />
    </MemoryRouter>
  )
}

describe('CreatorTeamRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTeams.mockResolvedValue(mockTeams)
    mockGetTeamRoles.mockResolvedValue(mockApiRoles)
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  describe('Loading state', () => {
    it('shows loading spinner while data is fetching', () => {
      mockGetTeams.mockReturnValue(new Promise(() => {}))
      renderComponent()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Layout and header', () => {
    it('renders page title', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Team Roles & Permissions')).toBeInTheDocument()
      })
    })

    it('renders page description', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Define what team members can do/i)).toBeInTheDocument()
      })
    })

    it('renders View Members button', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view members/i })).toBeInTheDocument()
      })
    })

    it('renders Create Role button', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create role/i })).toBeInTheDocument()
      })
    })

    it('navigates to members page when View Members clicked', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view members/i })).toBeInTheDocument()
      })
      screen.getByRole('button', { name: /view members/i }).click()
      expect(mockNavigate).toHaveBeenCalledWith('/creator/team/members')
    })
  })

  describe('Roles list', () => {
    it('renders Current Roles section heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Current Roles')).toBeInTheDocument()
      })
    })

    it('renders role names from API', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Owner')).toBeInTheDocument()
        expect(screen.getByText('Member')).toBeInTheDocument()
        expect(screen.getByText('Senior Editor')).toBeInTheDocument()
      })
    })

    it('renders role descriptions', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Full control of the team')).toBeInTheDocument()
        expect(screen.getByText('Standard team member')).toBeInTheDocument()
      })
    })

    it('shows Default badge for default role', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Default')).toBeInTheDocument()
      })
    })

    it('shows System badge for system roles', async () => {
      renderComponent()
      await waitFor(() => {
        const systemBadges = screen.getAllByText('System')
        expect(systemBadges.length).toBeGreaterThan(0)
      })
    })

    it('shows member counts per role', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('1 member')).toBeInTheDocument()
        expect(screen.getByText('2 members')).toBeInTheDocument()
      })
    })
  })

  describe('Permission guide sidebar', () => {
    it('shows Permission Guide when no form is open', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Permission Guide')).toBeInTheDocument()
      })
    })

    it('shows View permission description', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/View: See content and data/i)).toBeInTheDocument()
      })
    })
  })

  describe('Create role form', () => {
    it('shows Create New Role form when Create Role button is clicked', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create role/i })).toBeInTheDocument()
      })
      screen.getByRole('button', { name: /create role/i }).click()
      await waitFor(() => {
        expect(screen.getByText('Create New Role')).toBeInTheDocument()
      })
    })

    it('shows role name input in create form', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create role/i })).toBeInTheDocument()
      })
      screen.getByRole('button', { name: /create role/i }).click()
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/e.g., Senior Editor/i)).toBeInTheDocument()
      })
    })

    it('shows Cancel button in create form', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create role/i })).toBeInTheDocument()
      })
      screen.getByRole('button', { name: /create role/i }).click()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      })
    })

    it('hides Permission Guide when form is open', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create role/i })).toBeInTheDocument()
      })
      screen.getByRole('button', { name: /create role/i }).click()
      await waitFor(() => {
        expect(screen.queryByText('Permission Guide')).not.toBeInTheDocument()
      })
    })
  })

  describe('Empty state — no team', () => {
    it('shows empty roles list when no teams exist', async () => {
      mockGetTeams.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        // Roles list should be empty — no role names from API
        expect(screen.queryByText('Owner')).not.toBeInTheDocument()
        expect(screen.getByText('Current Roles')).toBeInTheDocument()
      })
    })
  })

  describe('Error handling', () => {
    it('renders with empty roles on API error', async () => {
      mockGetTeams.mockRejectedValue(new Error('Service error'))
      renderComponent()
      await waitFor(() => {
        // Page still renders without crashing
        expect(screen.getByText('Team Roles & Permissions')).toBeInTheDocument()
      })
    })
  })
})
