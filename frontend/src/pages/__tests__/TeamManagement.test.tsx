import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockGetAllTeamCollaborators = vi.fn()
const mockRemoveCollaborator = vi.fn()
const mockResendInvite = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ─── CollaboratorService ────────────────────────────────────────────
vi.mock('../../services/collaborator.service', () => ({
  CollaboratorService: {
    getAllTeamCollaborators: (...args: any[]) => mockGetAllTeamCollaborators(...args),
    removeCollaborator: (...args: any[]) => mockRemoveCollaborator(...args),
    resendInvite: (...args: any[]) => mockResendInvite(...args),
    inviteCollaborator: vi.fn(),
    listCollaborators: vi.fn(),
  },
}))

// ─── InviteCollaboratorWithProjectPicker ────────────────────────────
vi.mock('../../portals/production/components/InviteCollaboratorWithProjectPicker', () => ({
  default: ({ onClose }: any) => (
    <div data-testid="invite-modal">
      <button onClick={onClose}>Close Invite Modal</button>
    </div>
  ),
}))

// ─── react-hot-toast ────────────────────────────────────────────────
vi.mock('react-hot-toast', () => ({
  default: { success: mockToastSuccess, error: mockToastError, loading: vi.fn() },
  toast: { success: mockToastSuccess, error: mockToastError, loading: vi.fn() },
}))

// ─── Mock data ──────────────────────────────────────────────────────
const mockCollaborators = [
  {
    id: 1,
    project_id: 10,
    project_title: 'Project Alpha',
    user_id: 100,
    invited_email: 'alice@studio.com',
    role: 'director',
    custom_role_name: null,
    status: 'active' as const,
    invited_at: '2025-01-15T00:00:00Z',
    accepted_at: '2025-01-16T00:00:00Z',
    user: { name: 'Alice Producer', email: 'alice@studio.com', avatar_url: null },
  },
  {
    id: 2,
    project_id: 10,
    project_title: 'Project Alpha',
    user_id: 101,
    invited_email: 'bob@studio.com',
    role: 'editor',
    custom_role_name: null,
    status: 'active' as const,
    invited_at: '2025-02-01T00:00:00Z',
    accepted_at: '2025-02-02T00:00:00Z',
    user: { name: 'Bob Editor', email: 'bob@studio.com', avatar_url: null },
  },
  {
    id: 3,
    project_id: 11,
    project_title: 'Project Beta',
    user_id: null,
    invited_email: 'charlie@studio.com',
    role: 'dp',
    custom_role_name: null,
    status: 'pending' as const,
    invited_at: '2025-03-01T00:00:00Z',
    accepted_at: null,
    user: null,
  },
]

const mockStats = { total: 3, active: 2, pending: 1, projects: 2 }

const mockSuccessResponse = {
  success: true,
  data: { collaborators: mockCollaborators, stats: mockStats },
}

const mockEmptyResponse = {
  success: true,
  data: { collaborators: [], stats: { total: 0, active: 0, pending: 0, projects: 0 } },
}

// ─── Dynamic import ─────────────────────────────────────────────────
let TeamManagement: React.ComponentType
beforeAll(async () => {
  const mod = await import('../TeamManagement')
  TeamManagement = mod.default
})

const renderComponent = () =>
  render(
    <MemoryRouter>
      <TeamManagement />
    </MemoryRouter>
  )

describe('TeamManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAllTeamCollaborators.mockResolvedValue(mockSuccessResponse)
    mockRemoveCollaborator.mockResolvedValue({ success: true })
    mockResendInvite.mockResolvedValue({ success: true })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  describe('Loading state', () => {
    it('shows loading spinner while fetching data', () => {
      mockGetAllTeamCollaborators.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  describe('Error state', () => {
    it('shows error message when API fails', async () => {
      mockGetAllTeamCollaborators.mockRejectedValue(new Error('Network error'))
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows Retry button in error state', async () => {
      mockGetAllTeamCollaborators.mockRejectedValue(new Error('Failed'))
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })
  })

  describe('Layout', () => {
    it('renders the page heading and description', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Team Management')).toBeInTheDocument()
      })
      expect(screen.getByText('Manage collaborators across your production projects')).toBeInTheDocument()
    })

    it('renders Invite Collaborator button', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Invite Collaborator')).toBeInTheDocument()
      })
    })

    it('renders search input', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search by name or email...')).toBeInTheDocument()
      })
    })
  })

  describe('Stats cards', () => {
    it('renders all stats cards', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Total Collaborators')).toBeInTheDocument()
      })
      // "Active" and "Pending" appear as both stat labels and status badges
      expect(screen.getByText('Total Collaborators')).toBeInTheDocument()
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    it('shows correct total count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Total Collaborators')).toBeInTheDocument()
      })
      const totalEl = screen.getByText('Total Collaborators').closest('div')?.parentElement
      expect(totalEl?.querySelector('.text-2xl')?.textContent).toBe('3')
    })

    it('shows correct active count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Total Collaborators')).toBeInTheDocument()
      })
      // Find the stat card for "Active" — it's the one with the green text
      const activeCount = document.querySelector('.text-green-600.text-2xl')
      expect(activeCount?.textContent).toBe('2')
    })

    it('shows correct pending count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Total Collaborators')).toBeInTheDocument()
      })
      // Find the stat card for "Pending" — it's the one with the yellow text
      const pendingCount = document.querySelector('.text-yellow-600.text-2xl')
      expect(pendingCount?.textContent).toBe('1')
    })

    it('shows correct projects count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Projects')).toBeInTheDocument()
      })
      const projectsEl = screen.getByText('Projects').closest('div')?.parentElement
      expect(projectsEl?.querySelector('.text-2xl')?.textContent).toBe('2')
    })
  })

  describe('Collaborator table', () => {
    it('renders collaborator names', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
      })
      expect(screen.getByText('Bob Editor')).toBeInTheDocument()
    })

    it('renders collaborator emails', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('alice@studio.com')).toBeInTheDocument()
      })
      expect(screen.getByText('bob@studio.com')).toBeInTheDocument()
    })

    it('renders role labels', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Director')).toBeInTheDocument()
      })
      expect(screen.getByText('Editor')).toBeInTheDocument()
      expect(screen.getByText('Director of Photography')).toBeInTheDocument()
    })

    it('renders project titles', async () => {
      renderComponent()
      await waitFor(() => {
        // 2 in table rows + 1 in project filter dropdown = 3
        expect(screen.getAllByText('Project Alpha').length).toBeGreaterThanOrEqual(2)
      })
      expect(screen.getAllByText('Project Beta').length).toBeGreaterThanOrEqual(1)
    })

    it('renders status badges', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('active').length).toBe(2)
      })
      expect(screen.getByText('pending')).toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('shows empty state when no collaborators exist', async () => {
      mockGetAllTeamCollaborators.mockResolvedValue(mockEmptyResponse)
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('No collaborators yet')).toBeInTheDocument()
      })
      expect(screen.getByText('Invite team members to your production projects')).toBeInTheDocument()
    })

    it('shows invite button in empty state', async () => {
      mockGetAllTeamCollaborators.mockResolvedValue(mockEmptyResponse)
      renderComponent()

      await waitFor(() => {
        expect(screen.getAllByText('Invite Collaborator').length).toBeGreaterThanOrEqual(2)
      })
    })
  })

  describe('Search filter', () => {
    it('filters collaborators by name', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search by name or email...')).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText('Search by name or email...'), 'Alice')

      await waitFor(() => {
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
      })
      expect(screen.queryByText('Bob Editor')).not.toBeInTheDocument()
    })

    it('filters collaborators by email', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search by name or email...')).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText('Search by name or email...'), 'bob@')

      await waitFor(() => {
        expect(screen.getByText('Bob Editor')).toBeInTheDocument()
      })
      expect(screen.queryByText('Alice Producer')).not.toBeInTheDocument()
    })
  })

  describe('Invite modal', () => {
    it('opens invite modal when Invite Collaborator is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Invite Collaborator')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Invite Collaborator'))

      await waitFor(() => {
        expect(screen.getByTestId('invite-modal')).toBeInTheDocument()
      })
    })

    it('closes invite modal', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Invite Collaborator')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Invite Collaborator'))

      await waitFor(() => {
        expect(screen.getByTestId('invite-modal')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Close Invite Modal'))

      await waitFor(() => {
        expect(screen.queryByTestId('invite-modal')).not.toBeInTheDocument()
      })
    })
  })

  describe('Remove collaborator', () => {
    it('calls removeCollaborator when trash icon is clicked and confirmed', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByTitle('Remove collaborator')
      await user.click(removeButtons[0])

      await waitFor(() => {
        expect(mockRemoveCollaborator).toHaveBeenCalledWith(10, 1)
      })
    })

    it('shows success toast after removing collaborator', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByTitle('Remove collaborator')
      await user.click(removeButtons[0])

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Collaborator removed')
      })
    })

    it('does not call removeCollaborator when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByTitle('Remove collaborator')
      await user.click(removeButtons[0])

      expect(mockRemoveCollaborator).not.toHaveBeenCalled()
    })
  })

  describe('Resend invite', () => {
    it('shows resend button for pending collaborators', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByTitle('Resend invitation')).toBeInTheDocument()
      })
    })

    it('calls resendInvite when resend button is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByTitle('Resend invitation')).toBeInTheDocument()
      })

      await user.click(screen.getByTitle('Resend invitation'))

      await waitFor(() => {
        expect(mockResendInvite).toHaveBeenCalledWith(11, 3)
      })
    })
  })
})
