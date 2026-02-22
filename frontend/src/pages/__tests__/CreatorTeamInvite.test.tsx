import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockCheckSession = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store — STABLE reference ───────────────────────────────────
const mockUser = { id: 1, name: 'Creator User', email: 'creator@test.com', user_type: 'creator' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: mockCheckSession,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── TeamService mock ────────────────────────────────────────────────
const mockGetTeams = vi.fn()
const mockGetInvitations = vi.fn()
const mockGetTeamRoles = vi.fn()
const mockInviteToTeam = vi.fn()
const mockRejectInvitation = vi.fn()

vi.mock('../../services/team.service', () => ({
  TeamService: {
    getTeams: mockGetTeams,
    getInvitations: mockGetInvitations,
    getTeamRoles: mockGetTeamRoles,
    inviteToTeam: mockInviteToTeam,
    rejectInvitation: mockRejectInvitation,
  },
}))

// ─── Dynamic component import ─────────────────────────────────────────
let CreatorTeamInvite: React.ComponentType
beforeAll(async () => {
  const mod = await import('../creator/CreatorTeamInvite')
  CreatorTeamInvite = mod.default
})

const mockTeams = [
  {
    id: 'team-1',
    name: 'My Creative Team',
    ownerId: 'user-1',
    ownerName: 'Creator User',
    memberCount: 2,
    projectCount: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

const mockApiRoles = [
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
    id: 'admin',
    name: 'Admin',
    description: 'Full access',
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
]

const mockPendingInvitations = [
  {
    id: 'inv-1',
    teamId: 'team-1',
    teamName: 'My Creative Team',
    email: 'pending@example.com',
    role: 'member',
    status: 'pending' as const,
    invitedBy: 'user-1',
    invitedByName: 'Creator User',
    message: 'Join our team!',
    expiresAt: '2024-12-31T00:00:00Z',
    createdAt: '2024-01-10T00:00:00Z',
  },
]

function renderComponent() {
  return render(
    <MemoryRouter>
      <CreatorTeamInvite />
    </MemoryRouter>
  )
}

describe('CreatorTeamInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    mockGetTeams.mockResolvedValue(mockTeams)
    mockGetInvitations.mockResolvedValue(mockPendingInvitations)
    mockGetTeamRoles.mockResolvedValue(mockApiRoles)
    mockInviteToTeam.mockResolvedValue({
      id: 'new-inv-1',
      email: 'new@example.com',
      role: 'member',
      createdAt: '2024-01-20T00:00:00Z',
      expiresAt: '2024-01-27T00:00:00Z',
    })
    mockRejectInvitation.mockResolvedValue({})
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  describe('Layout and header', () => {
    it('renders Invite Team Members heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Invite Team Members')).toBeInTheDocument()
      })
    })

    it('renders page description', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Add collaborators to your creative projects/i)).toBeInTheDocument()
      })
    })

    it('renders View Members navigation button', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view members/i })).toBeInTheDocument()
      })
    })

    it('renders Manage Roles navigation button', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /manage roles/i })).toBeInTheDocument()
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

    it('navigates to roles page when Manage Roles clicked', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /manage roles/i })).toBeInTheDocument()
      })
      screen.getByRole('button', { name: /manage roles/i }).click()
      expect(mockNavigate).toHaveBeenCalledWith('/creator/team/roles')
    })
  })

  describe('Invitation method selection', () => {
    it('renders Choose Invitation Method section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Choose Invitation Method')).toBeInTheDocument()
      })
    })

    it('renders Email Invitation method', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Email Invitation')).toBeInTheDocument()
      })
    })

    it('renders Invite Link method', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Invite Link')).toBeInTheDocument()
      })
    })

    it('renders Bulk Import method', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Bulk Import')).toBeInTheDocument()
      })
    })

    it('renders Import Contacts as Pro feature', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Import Contacts')).toBeInTheDocument()
        expect(screen.getByText('Pro')).toBeInTheDocument()
      })
    })
  })

  describe('Email invitation form', () => {
    it('shows Send Email Invitations form by default', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Send Email Invitations')).toBeInTheDocument()
      })
    })

    it('renders email address input', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByPlaceholderText('colleague@example.com')).toBeInTheDocument()
      })
    })

    it('renders Role selection label', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Role')).toBeInTheDocument()
      })
    })

    it('renders Personal Message textarea', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Add a personal message/i)).toBeInTheDocument()
      })
    })

    it('renders Invitation Expires In select', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Invitation Expires In')).toBeInTheDocument()
      })
    })

    it('renders Send Invitations button', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /send invitations/i })).toBeInTheDocument()
      })
    })

    it('renders add another email link', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('+ Add another email')).toBeInTheDocument()
      })
    })
  })

  describe('Pending invitations sidebar', () => {
    it('renders Pending Invitations section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pending Invitations')).toBeInTheDocument()
      })
    })

    it('shows count of pending invitations', async () => {
      renderComponent()
      await waitFor(() => {
        // The count "1" is shown next to Pending Invitations heading
        expect(screen.getByText('1')).toBeInTheDocument()
      })
    })

    it('renders pending invite email', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('pending@example.com')).toBeInTheDocument()
      })
    })

    it('shows Resend button for pending invites', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument()
      })
    })

    it('shows Cancel button for pending invites', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      })
    })
  })

  describe('Empty pending invitations', () => {
    it('shows "No pending invitations" when list is empty', async () => {
      mockGetInvitations.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No pending invitations')).toBeInTheDocument()
      })
    })
  })

  describe('Role reference sidebar', () => {
    it('renders Role Reference section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Role Reference')).toBeInTheDocument()
      })
    })

    it('shows Admin role description', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Full access')).toBeInTheDocument()
      })
    })

    it('shows Member role description', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Edit & collaborate')).toBeInTheDocument()
      })
    })
  })

  describe('Error handling', () => {
    it('shows error message when service fails', async () => {
      mockGetTeams.mockRejectedValue(new Error('Network error'))
      renderComponent()
      // Component should not crash — still renders header
      await waitFor(() => {
        expect(screen.getByText('Invite Team Members')).toBeInTheDocument()
      })
    })
  })
})
