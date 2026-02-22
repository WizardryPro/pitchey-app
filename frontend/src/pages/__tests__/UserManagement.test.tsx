import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockGetUsers = vi.fn()
const mockUpdateUser = vi.fn()

vi.mock('../../services/admin.service', () => ({
  adminService: {
    getUsers: (...args: any[]) => mockGetUsers(...args),
    updateUser: (...args: any[]) => mockUpdateUser(...args),
  },
}))

// Dynamic import after mocks
let UserManagement: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Admin/UserManagement')
  UserManagement = mod.default
})

const mockUsers = [
  {
    id: 'user-1',
    email: 'creator@test.com',
    name: 'Alice Creator',
    userType: 'creator' as const,
    credits: 50,
    status: 'active' as const,
    createdAt: '2026-01-15T10:00:00Z',
    lastLogin: '2026-02-20T10:00:00Z',
    pitchCount: 5,
    investmentCount: 0,
  },
  {
    id: 'user-2',
    email: 'investor@test.com',
    name: 'Bob Investor',
    userType: 'investor' as const,
    credits: 100,
    status: 'active' as const,
    createdAt: '2026-01-10T10:00:00Z',
    lastLogin: '2026-02-19T10:00:00Z',
    pitchCount: 0,
    investmentCount: 12,
  },
  {
    id: 'user-3',
    email: 'banned@test.com',
    name: 'Charlie Banned',
    userType: 'production' as const,
    credits: 0,
    status: 'banned' as const,
    createdAt: '2026-01-05T10:00:00Z',
    lastLogin: null,
    pitchCount: 0,
    investmentCount: 0,
  },
]

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <UserManagement />
    </MemoryRouter>
  )
}

describe('UserManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUsers.mockResolvedValue(mockUsers)
    mockUpdateUser.mockResolvedValue({})
  })

  describe('Loading', () => {
    it('shows loading state initially', () => {
      mockGetUsers.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(screen.getByText('Loading users...')).toBeInTheDocument()
    })
  })

  describe('Layout', () => {
    it('renders the page title and subtitle', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument()
      })
      expect(screen.getByText('Manage platform users, credits, and permissions')).toBeInTheDocument()
    })

    it('renders filter controls', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search by name or email...')).toBeInTheDocument()
      })
      expect(screen.getByText('User Type')).toBeInTheDocument()
      expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Sort By')).toBeInTheDocument()
      expect(screen.getByText('Order')).toBeInTheDocument()
    })

    it('renders table headers', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('User')).toBeInTheDocument()
      })
      expect(screen.getAllByText('Type').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Credits').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Activity')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })
  })

  describe('Data', () => {
    it('displays user names and emails', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Alice Creator')).toBeInTheDocument()
      })
      expect(screen.getByText('creator@test.com')).toBeInTheDocument()
      expect(screen.getByText('Bob Investor')).toBeInTheDocument()
      expect(screen.getByText('investor@test.com')).toBeInTheDocument()
      expect(screen.getByText('Charlie Banned')).toBeInTheDocument()
    })

    it('displays user types', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('creator')).toBeInTheDocument()
      })
      expect(screen.getByText('investor')).toBeInTheDocument()
      expect(screen.getByText('production')).toBeInTheDocument()
    })

    it('displays user statuses', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('active').length).toBe(2)
      })
      expect(screen.getByText('banned')).toBeInTheDocument()
    })

    it('displays credit counts', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('50')).toBeInTheDocument()
      })
      expect(screen.getByText('100')).toBeInTheDocument()
    })

    it('displays pitch and investment counts', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pitches: 5')).toBeInTheDocument()
      })
      expect(screen.getByText('Investments: 12')).toBeInTheDocument()
    })

    it('displays "Never" for users without last login', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Last login: Never')).toBeInTheDocument()
      })
    })

    it('displays Manage buttons for each user', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Manage').length).toBe(3)
      })
    })
  })

  describe('Modal', () => {
    it('opens user modal when Manage is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Manage').length).toBe(3)
      })
      await user.click(screen.getAllByText('Manage')[0])
      await waitFor(() => {
        expect(screen.getByText('Manage User')).toBeInTheDocument()
      })
      // Modal should display the selected user's email label
      expect(screen.getByText('Email')).toBeInTheDocument()
    })

    it('shows Ban User button for active users', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Manage').length).toBe(3)
      })
      await user.click(screen.getAllByText('Manage')[0])
      await waitFor(() => {
        expect(screen.getByText('Ban User')).toBeInTheDocument()
      })
    })

    it('shows Unban User button for banned users', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Manage').length).toBe(3)
      })
      await user.click(screen.getAllByText('Manage')[2])
      await waitFor(() => {
        expect(screen.getByText('Unban User')).toBeInTheDocument()
      })
    })

    it('shows Update button for credits', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Manage').length).toBe(3)
      })
      await user.click(screen.getAllByText('Manage')[0])
      await waitFor(() => {
        expect(screen.getByText('Update')).toBeInTheDocument()
      })
    })
  })

  describe('Error', () => {
    it('shows error message when API fails', async () => {
      mockGetUsers.mockRejectedValue(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Failed to load users')).toBeInTheDocument()
      })
    })
  })

  describe('Empty', () => {
    it('shows empty state when no users found', async () => {
      mockGetUsers.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument()
      })
    })
  })
})
