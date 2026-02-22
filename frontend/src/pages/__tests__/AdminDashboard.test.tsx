import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockNavigate = vi.fn()
const mockReportError = vi.fn()
const mockTrackEvent = vi.fn()
const mockTrackApiError = vi.fn()

const mockGetDashboardStats = vi.fn()
const mockGetRecentActivity = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

vi.mock('../../services/admin.service', () => ({
  adminService: {
    getDashboardStats: (...args: any[]) => mockGetDashboardStats(...args),
    getRecentActivity: (...args: any[]) => mockGetRecentActivity(...args),
  },
}))

vi.mock('../../hooks/useSentryPortal', () => ({
  useSentryPortal: () => ({
    reportError: mockReportError,
    trackEvent: mockTrackEvent,
    trackApiError: mockTrackApiError,
  }),
}))

vi.mock('../../components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

// Dynamic import after mocks
let AdminDashboard: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Admin/AdminDashboard')
  AdminDashboard = mod.default
})

const mockStats = {
  totalUsers: 1250,
  totalPitches: 340,
  totalRevenue: 87500,
  pendingNDAs: 12,
  activeUsers: 890,
  recentSignups: 45,
  approvedPitches: 280,
  rejectedPitches: 60,
}

const mockActivity = [
  {
    id: 'act-1',
    type: 'user_signup' as const,
    description: 'New user registered: John Doe',
    timestamp: '2026-02-20T10:00:00Z',
    user: 'John Doe',
  },
  {
    id: 'act-2',
    type: 'pitch_created' as const,
    description: 'New pitch submitted: My Movie',
    timestamp: '2026-02-20T09:00:00Z',
    user: 'Jane Smith',
  },
  {
    id: 'act-3',
    type: 'nda_signed' as const,
    description: 'NDA signed for pitch #42',
    timestamp: '2026-02-20T08:00:00Z',
  },
  {
    id: 'act-4',
    type: 'payment_received' as const,
    description: 'Payment received: $500',
    timestamp: '2026-02-20T07:00:00Z',
    user: 'Bob Investor',
  },
]

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  )
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDashboardStats.mockResolvedValue(mockStats)
    mockGetRecentActivity.mockResolvedValue(mockActivity)
  })

  describe('Loading', () => {
    it('shows loading skeleton initially', () => {
      mockGetDashboardStats.mockReturnValue(new Promise(() => {}))
      mockGetRecentActivity.mockReturnValue(new Promise(() => {}))
      renderComponent()
      const pulseElements = document.querySelectorAll('.animate-pulse')
      expect(pulseElements.length).toBeGreaterThan(0)
    })
  })

  describe('Layout', () => {
    it('renders the dashboard title and subtitle', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
      })
      expect(screen.getByText('Platform overview and management tools')).toBeInTheDocument()
    })

    it('renders all management link cards', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument()
      })
      expect(screen.getByText('Content Moderation')).toBeInTheDocument()
      expect(screen.getByText('Transactions')).toBeInTheDocument()
      expect(screen.getByText('System Settings')).toBeInTheDocument()
      expect(screen.getByText('Analytics')).toBeInTheDocument()
      expect(screen.getByText('System Health')).toBeInTheDocument()
    })

    it('renders management links with correct hrefs', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument()
      })
      const userLink = screen.getByText('User Management').closest('a')
      expect(userLink).toHaveAttribute('href', '/admin/users')
      const contentLink = screen.getByText('Content Moderation').closest('a')
      expect(contentLink).toHaveAttribute('href', '/admin/content')
      const transLink = screen.getByText('Transactions').closest('a')
      expect(transLink).toHaveAttribute('href', '/admin/transactions')
      const settingsLink = screen.getByText('System Settings').closest('a')
      expect(settingsLink).toHaveAttribute('href', '/admin/settings')
    })

    it('renders Recent Activity section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Recent Activity')).toBeInTheDocument()
      })
    })
  })

  describe('Data', () => {
    it('displays stats from API response', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('1,250')).toBeInTheDocument()
      })
      expect(screen.getByText('340')).toBeInTheDocument()
      expect(screen.getByText('12')).toBeInTheDocument()
      expect(screen.getByText('Total Users')).toBeInTheDocument()
      expect(screen.getByText('Total Pitches')).toBeInTheDocument()
      expect(screen.getByText('Pending NDAs')).toBeInTheDocument()
      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    })

    it('displays recent signups count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('+45 this week')).toBeInTheDocument()
      })
    })

    it('displays approved and rejected pitch counts', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('280 approved, 60 rejected')).toBeInTheDocument()
      })
    })

    it('displays active users count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('890 active users')).toBeInTheDocument()
      })
    })

    it('displays recent activity items', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('New user registered: John Doe')).toBeInTheDocument()
      })
      expect(screen.getByText('New pitch submitted: My Movie')).toBeInTheDocument()
      expect(screen.getByText('NDA signed for pitch #42')).toBeInTheDocument()
      expect(screen.getByText('Payment received: $500')).toBeInTheDocument()
    })

    it('calls getDashboardStats and getRecentActivity on mount', async () => {
      renderComponent()
      await waitFor(() => {
        expect(mockGetDashboardStats).toHaveBeenCalledTimes(1)
      })
      expect(mockGetRecentActivity).toHaveBeenCalledTimes(1)
    })

    it('tracks events when dashboard loads', async () => {
      renderComponent()
      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith('admin.dashboard.load', expect.any(Object))
      })
    })
  })

  describe('Error', () => {
    it('shows error state when API fails', async () => {
      mockGetDashboardStats.mockRejectedValue(new Error('Server error'))
      mockGetRecentActivity.mockRejectedValue(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Error Loading Dashboard')).toBeInTheDocument()
      })
      expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument()
    })

    it('shows retry button on error', async () => {
      mockGetDashboardStats.mockRejectedValue(new Error('Server error'))
      mockGetRecentActivity.mockRejectedValue(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('retries loading when retry button is clicked', async () => {
      mockGetDashboardStats.mockRejectedValueOnce(new Error('Server error'))
      mockGetRecentActivity.mockRejectedValueOnce(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
      mockGetDashboardStats.mockResolvedValue(mockStats)
      mockGetRecentActivity.mockResolvedValue(mockActivity)
      await userEvent.click(screen.getByText('Retry'))
      await waitFor(() => {
        expect(mockGetDashboardStats).toHaveBeenCalledTimes(2)
      })
    })

    it('reports error to Sentry on API failure', async () => {
      mockGetDashboardStats.mockRejectedValue(new Error('Server error'))
      mockGetRecentActivity.mockRejectedValue(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(mockReportError).toHaveBeenCalled()
      })
    })
  })

  describe('Empty', () => {
    it('shows empty activity message when no activity data', async () => {
      mockGetRecentActivity.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No recent activity')).toBeInTheDocument()
      })
    })
  })
})
