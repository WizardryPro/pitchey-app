import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockGetModerationLog = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Admin service ───────────────────────────────────────────────────
vi.mock('@/portals/admin/services/admin.service', () => ({
  adminService: {
    getModerationLog: (...args: any[]) => mockGetModerationLog(...args),
  },
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('@/components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

// ─── Dynamic import after mocks ──────────────────────────────────────
let AdminModerationLog: React.ComponentType
beforeAll(async () => {
  const mod = await import('../AdminModerationLog')
  AdminModerationLog = mod.default
})

// ─── Mock data ───────────────────────────────────────────────────────
const mockLogs = [
  {
    id: 'mod-1',
    action: 'approve',
    description: 'Pitch approved after review',
    moderator: 'admin@pitchey.com',
    target: 'creator@example.com',
    created_at: '2026-03-20T10:00:00Z',
    notes: 'High quality content',
  },
  {
    id: 'mod-2',
    action: 'reject',
    description: 'Pitch rejected due to policy violation',
    moderator: 'mod@pitchey.com',
    target: 'spammer@example.com',
    created_at: '2026-03-20T09:00:00Z',
    notes: 'Duplicate submission',
  },
  {
    id: 'mod-3',
    action: 'flag',
    description: 'Content flagged for further review',
    moderator: 'admin@pitchey.com',
    target: 'user3@example.com',
    created_at: '2026-03-19T15:00:00Z',
  },
  {
    id: 'mod-4',
    action: 'ban',
    description: 'User banned for repeated violations',
    moderator: 'admin@pitchey.com',
    target: 'badactor@example.com',
    created_at: '2026-03-18T12:00:00Z',
    notes: 'Third strike',
  },
]

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AdminModerationLog />
    </MemoryRouter>
  )

describe('AdminModerationLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetModerationLog.mockResolvedValue({ data: mockLogs })
  })

  describe('Loading', () => {
    it('shows loading message while fetching', () => {
      mockGetModerationLog.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(screen.getByText('Loading moderation log...')).toBeInTheDocument()
    })
  })

  describe('Layout', () => {
    it('renders the page title', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Moderation Log')).toBeInTheDocument()
      })
    })

    it('renders the action filter dropdown', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Filter by action:')).toBeInTheDocument()
      })
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('renders All Actions default option', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'All Actions' })).toBeInTheDocument()
      })
    })

    it('renders all available filter action options', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Approve' })).toBeInTheDocument()
      })
      expect(screen.getByRole('option', { name: 'Reject' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Flag' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Ban' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Suspend' })).toBeInTheDocument()
    })
  })

  describe('Data', () => {
    it('renders all moderation log entries', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pitch approved after review')).toBeInTheDocument()
      })
      expect(screen.getByText('Pitch rejected due to policy violation')).toBeInTheDocument()
      expect(screen.getByText('Content flagged for further review')).toBeInTheDocument()
      expect(screen.getByText('User banned for repeated violations')).toBeInTheDocument()
    })

    it('renders action badges with correct text', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('approve')).toBeInTheDocument()
      })
      expect(screen.getByText('reject')).toBeInTheDocument()
      expect(screen.getByText('flag')).toBeInTheDocument()
      expect(screen.getByText('ban')).toBeInTheDocument()
    })

    it('renders approve action with green color class', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('approve')).toBeInTheDocument()
      })
      const approveBadge = screen.getByText('approve')
      expect(approveBadge).toHaveClass('bg-green-100', 'text-green-800')
    })

    it('renders reject action with red color class', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('reject')).toBeInTheDocument()
      })
      const rejectBadge = screen.getByText('reject')
      expect(rejectBadge).toHaveClass('bg-red-100', 'text-red-800')
    })

    it('renders flag action with yellow color class', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('flag')).toBeInTheDocument()
      })
      const flagBadge = screen.getByText('flag')
      expect(flagBadge).toHaveClass('bg-yellow-100', 'text-yellow-800')
    })

    it('renders ban action with red color class', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('ban')).toBeInTheDocument()
      })
      const banBadge = screen.getByText('ban')
      expect(banBadge).toHaveClass('bg-red-100', 'text-red-800')
    })

    it('renders moderator names', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('admin@pitchey.com').length).toBeGreaterThan(0)
      })
      expect(screen.getByText('mod@pitchey.com')).toBeInTheDocument()
    })

    it('renders target user info', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Target:.*creator@example\.com/)).toBeInTheDocument()
      })
      expect(screen.getByText(/Target:.*spammer@example\.com/)).toBeInTheDocument()
    })

    it('renders notes when present', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/"High quality content"/)).toBeInTheDocument()
      })
      expect(screen.getByText(/"Duplicate submission"/)).toBeInTheDocument()
      expect(screen.getByText(/"Third strike"/)).toBeInTheDocument()
    })

    it('calls getModerationLog on mount', async () => {
      renderComponent()
      await waitFor(() => {
        expect(mockGetModerationLog).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Empty State', () => {
    it('shows empty message when no moderation actions found', async () => {
      mockGetModerationLog.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No moderation actions found.')).toBeInTheDocument()
      })
    })
  })

  describe('Error State', () => {
    it('shows error message when API fails', async () => {
      mockGetModerationLog.mockRejectedValue(new Error('Connection refused'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Failed to load moderation log/)).toBeInTheDocument()
      })
    })

    it('includes error detail in error message', async () => {
      mockGetModerationLog.mockRejectedValue(new Error('Connection refused'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Connection refused/)).toBeInTheDocument()
      })
    })
  })

  describe('Action Filter', () => {
    it('refetches with filter param when action filter changes', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
      await userEvent.selectOptions(screen.getByRole('combobox'), 'approve')
      await waitFor(() => {
        expect(mockGetModerationLog).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'approve' })
        )
      })
    })

    it('refetches without filter when All Actions is selected', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
      // First select a filter
      await userEvent.selectOptions(screen.getByRole('combobox'), 'reject')
      await waitFor(() => {
        expect(mockGetModerationLog).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'reject' })
        )
      })
      // Then reset to all
      await userEvent.selectOptions(screen.getByRole('combobox'), '')
      await waitFor(() => {
        expect(mockGetModerationLog).toHaveBeenLastCalledWith({})
      })
    })
  })
})
