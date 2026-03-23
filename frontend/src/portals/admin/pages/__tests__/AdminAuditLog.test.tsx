import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockGetAuditLog = vi.fn()
const mockGetAuditLogStats = vi.fn()
const mockExportAuditLog = vi.fn()

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
    getAuditLog: (...args: any[]) => mockGetAuditLog(...args),
    getAuditLogStats: (...args: any[]) => mockGetAuditLogStats(...args),
    exportAuditLog: (...args: any[]) => mockExportAuditLog(...args),
  },
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('@/components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

// ─── Dynamic import after mocks ──────────────────────────────────────
let AdminAuditLog: React.ComponentType
beforeAll(async () => {
  const mod = await import('../AdminAuditLog')
  AdminAuditLog = mod.default
})

// ─── Mock data ───────────────────────────────────────────────────────
const mockStats = {
  totalEvents: 5432,
  today: 87,
  uniqueUsers: 312,
}

const mockLogs = [
  {
    id: 'log-1',
    created_at: '2026-03-20T10:00:00Z',
    user_email: 'admin@pitchey.com',
    action: 'login',
    resource_type: 'session',
    resource_id: '99',
    ip_address: '192.168.1.1',
  },
  {
    id: 'log-2',
    created_at: '2026-03-20T09:30:00Z',
    user_email: 'moderator@pitchey.com',
    action: 'approve',
    resource_type: 'pitch',
    resource_id: '42',
    ip_address: '10.0.0.5',
  },
  {
    id: 'log-3',
    created_at: '2026-03-20T08:00:00Z',
    user_email: 'admin@pitchey.com',
    action: 'delete',
    resource_type: 'user',
    resource_id: '7',
    ip_address: '192.168.1.1',
  },
]

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AdminAuditLog />
    </MemoryRouter>
  )

describe('AdminAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuditLog.mockResolvedValue({ data: mockLogs, total: mockLogs.length })
    mockGetAuditLogStats.mockResolvedValue(mockStats)
    mockExportAuditLog.mockResolvedValue(new Blob(['csv,data'], { type: 'text/csv' }))
  })

  describe('Loading', () => {
    it('shows loading message while fetching', () => {
      mockGetAuditLog.mockReturnValue(new Promise(() => {}))
      mockGetAuditLogStats.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(screen.getByText('Loading audit log...')).toBeInTheDocument()
    })
  })

  describe('Layout', () => {
    it('renders the page title', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Audit Log')).toBeInTheDocument()
      })
    })

    it('renders the Export CSV button', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Export CSV')).toBeInTheDocument()
      })
    })

    it('renders the action filter dropdown', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Filter by action:')).toBeInTheDocument()
      })
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('renders all action filter options', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('All Actions')).toBeInTheDocument()
      })
      expect(screen.getByRole('option', { name: 'Login' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Logout' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Approve' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Delete' })).toBeInTheDocument()
    })

    it('renders table column headers', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Timestamp')).toBeInTheDocument()
      })
      expect(screen.getByText('User')).toBeInTheDocument()
      expect(screen.getByText('Action')).toBeInTheDocument()
      expect(screen.getByText('Resource')).toBeInTheDocument()
      expect(screen.getByText('IP Address')).toBeInTheDocument()
    })
  })

  describe('Stats Cards', () => {
    it('renders stats cards with correct values', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Total Events')).toBeInTheDocument()
      })
      expect(screen.getByText('5,432')).toBeInTheDocument()
      expect(screen.getByText('Today')).toBeInTheDocument()
      expect(screen.getByText('87')).toBeInTheDocument()
      expect(screen.getByText('Unique Users')).toBeInTheDocument()
      expect(screen.getByText('312')).toBeInTheDocument()
    })
  })

  describe('Data', () => {
    it('renders audit log entries from API', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('admin@pitchey.com').length).toBeGreaterThan(0)
      })
      expect(screen.getByText('moderator@pitchey.com')).toBeInTheDocument()
    })

    it('renders action badges for each log entry', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('login')).toBeInTheDocument()
      })
      expect(screen.getByText('approve')).toBeInTheDocument()
      expect(screen.getByText('delete')).toBeInTheDocument()
    })

    it('renders resource type and id', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/session #99/)).toBeInTheDocument()
      })
      expect(screen.getByText(/pitch #42/)).toBeInTheDocument()
    })

    it('renders IP addresses', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('192.168.1.1').length).toBeGreaterThan(0)
      })
      expect(screen.getByText('10.0.0.5')).toBeInTheDocument()
    })

    it('calls getAuditLog and getAuditLogStats on mount', async () => {
      renderComponent()
      await waitFor(() => {
        expect(mockGetAuditLog).toHaveBeenCalledTimes(1)
      })
      expect(mockGetAuditLogStats).toHaveBeenCalledTimes(1)
    })
  })

  describe('Empty State', () => {
    it('shows empty message when no logs returned', async () => {
      mockGetAuditLog.mockResolvedValue({ data: [], total: 0 })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No audit log entries found.')).toBeInTheDocument()
      })
    })
  })

  describe('Error State', () => {
    it('shows error message when API fails', async () => {
      mockGetAuditLog.mockRejectedValue(new Error('Network error'))
      mockGetAuditLogStats.mockRejectedValue(new Error('Network error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Failed to load audit log/)).toBeInTheDocument()
      })
    })

    it('includes error message detail in error display', async () => {
      mockGetAuditLog.mockRejectedValue(new Error('Server timeout'))
      mockGetAuditLogStats.mockRejectedValue(new Error('Server timeout'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Server timeout/)).toBeInTheDocument()
      })
    })
  })

  describe('Pagination', () => {
    it('shows pagination controls when total exceeds page size', async () => {
      mockGetAuditLog.mockResolvedValue({ data: mockLogs, total: 100 })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 4/)).toBeInTheDocument()
      })
    })

    it('does not show pagination when entries fit on one page', async () => {
      mockGetAuditLog.mockResolvedValue({ data: mockLogs, total: 3 })
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('admin@pitchey.com').length).toBeGreaterThan(0)
      })
      expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument()
    })

    it('shows total entry count in pagination', async () => {
      mockGetAuditLog.mockResolvedValue({ data: mockLogs, total: 100 })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/100 entries/)).toBeInTheDocument()
      })
    })
  })

  describe('Action Filter', () => {
    it('refetches with filter when action filter changes', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
      await userEvent.selectOptions(screen.getByRole('combobox'), 'login')
      await waitFor(() => {
        expect(mockGetAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'login' })
        )
      })
    })
  })

  describe('Export CSV', () => {
    it('calls exportAuditLog when Export CSV button is clicked', async () => {
      const mockUrl = 'blob:http://localhost/mock-url'
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue(mockUrl)
      globalThis.URL.revokeObjectURL = vi.fn()
      const mockClick = vi.fn()
      const originalCreateElement = document.createElement.bind(document)
      const mockCreateElement = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return { href: '', download: '', click: mockClick } as any
        }
        return originalCreateElement(tag)
      })

      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Export CSV')).toBeInTheDocument()
      })
      await userEvent.click(screen.getByText('Export CSV'))
      await waitFor(() => {
        expect(mockExportAuditLog).toHaveBeenCalledTimes(1)
      })

      mockCreateElement.mockRestore()
    })
  })
})
