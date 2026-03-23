import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockGetGDPRMetrics = vi.fn()
const mockGetGDPRRequests = vi.fn()
const mockGetConsentMetrics = vi.fn()

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
    getGDPRMetrics: (...args: any[]) => mockGetGDPRMetrics(...args),
    getGDPRRequests: (...args: any[]) => mockGetGDPRRequests(...args),
    getConsentMetrics: (...args: any[]) => mockGetConsentMetrics(...args),
  },
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('@/components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

// ─── Dynamic import after mocks ──────────────────────────────────────
let AdminGDPR: React.ComponentType
beforeAll(async () => {
  const mod = await import('../AdminGDPR')
  AdminGDPR = mod.default
})

// ─── Mock data ───────────────────────────────────────────────────────
const mockMetrics = {
  totalRequests: 48,
  pendingRequests: 5,
  usersWithConsent: 1180,
  complianceRate: 94.3,
}

const mockRequests = [
  {
    id: 'req-1',
    user_email: 'user1@example.com',
    type: 'data_deletion',
    status: 'pending',
    created_at: '2026-03-18T10:00:00Z',
  },
  {
    id: 'req-2',
    user_email: 'user2@example.com',
    type: 'data_export',
    status: 'completed',
    created_at: '2026-03-15T14:30:00Z',
  },
  {
    id: 'req-3',
    user_email: 'user3@example.com',
    type: 'data_correction',
    status: 'pending',
    created_at: '2026-03-10T09:00:00Z',
  },
]

const mockConsent = {
  totalConsented: 1180,
  complianceRate: 94.3,
  preferences: [
    { type: 'Marketing', count: 850, percentage: 72.0 },
    { type: 'Analytics', count: 1100, percentage: 93.2 },
    { type: 'Functional', count: 1180, percentage: 100.0 },
  ],
}

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AdminGDPR />
    </MemoryRouter>
  )

describe('AdminGDPR', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGDPRMetrics.mockResolvedValue(mockMetrics)
    mockGetGDPRRequests.mockResolvedValue(mockRequests)
    mockGetConsentMetrics.mockResolvedValue(mockConsent)
  })

  describe('Loading', () => {
    it('shows loading skeleton with animate-pulse elements', () => {
      mockGetGDPRMetrics.mockReturnValue(new Promise(() => {}))
      mockGetGDPRRequests.mockReturnValue(new Promise(() => {}))
      mockGetConsentMetrics.mockReturnValue(new Promise(() => {}))
      renderComponent()
      const pulseElements = document.querySelectorAll('.animate-pulse')
      expect(pulseElements.length).toBeGreaterThan(0)
    })

    it('shows GDPR Compliance heading during loading', () => {
      mockGetGDPRMetrics.mockReturnValue(new Promise(() => {}))
      mockGetGDPRRequests.mockReturnValue(new Promise(() => {}))
      mockGetConsentMetrics.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(screen.getByText('GDPR Compliance')).toBeInTheDocument()
    })
  })

  describe('Layout', () => {
    it('renders the page title', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('GDPR Compliance')).toBeInTheDocument()
      })
    })

    it('renders the Data Subject Requests section heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Data Subject Requests')).toBeInTheDocument()
      })
    })

    it('renders request table column headers', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Data Subject Requests')).toBeInTheDocument()
      })
      expect(screen.getByRole('columnheader', { name: 'User' })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: 'Submitted' })).toBeInTheDocument()
    })
  })

  describe('KPI Cards', () => {
    it('renders all four KPI card labels', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Total Requests')).toBeInTheDocument()
      })
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByText('Users with Consent')).toBeInTheDocument()
      expect(screen.getByText('Compliance Rate')).toBeInTheDocument()
    })

    it('renders correct KPI values from metrics', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('48')).toBeInTheDocument()
      })
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('1180')).toBeInTheDocument()
      expect(screen.getByText('94.3%')).toBeInTheDocument()
    })
  })

  describe('Consent Preferences', () => {
    it('renders Consent Preferences section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Consent Preferences')).toBeInTheDocument()
      })
    })

    it('renders consent preference types', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Marketing')).toBeInTheDocument()
      })
      expect(screen.getByText('Analytics')).toBeInTheDocument()
      expect(screen.getByText('Functional')).toBeInTheDocument()
    })

    it('renders consent counts', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('850 users')).toBeInTheDocument()
      })
      expect(screen.getByText('1100 users')).toBeInTheDocument()
    })

    it('renders consent percentages', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('72.0% of total')).toBeInTheDocument()
      })
      expect(screen.getByText('93.2% of total')).toBeInTheDocument()
    })
  })

  describe('Data Subject Requests Table', () => {
    it('renders request rows with user emails', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      })
      expect(screen.getByText('user2@example.com')).toBeInTheDocument()
      expect(screen.getByText('user3@example.com')).toBeInTheDocument()
    })

    it('renders request type badges', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('data_deletion')).toBeInTheDocument()
      })
      expect(screen.getByText('data_export')).toBeInTheDocument()
      expect(screen.getByText('data_correction')).toBeInTheDocument()
    })

    it('renders status badges with correct text', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('pending').length).toBeGreaterThan(0)
      })
      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    it('calls all three service methods on mount', async () => {
      renderComponent()
      await waitFor(() => {
        expect(mockGetGDPRMetrics).toHaveBeenCalledTimes(1)
      })
      expect(mockGetGDPRRequests).toHaveBeenCalledTimes(1)
      expect(mockGetConsentMetrics).toHaveBeenCalledTimes(1)
    })
  })

  describe('Empty State', () => {
    it('shows empty message when no requests exist', async () => {
      mockGetGDPRRequests.mockResolvedValue([])
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No GDPR requests found.')).toBeInTheDocument()
      })
    })
  })

  describe('Error State', () => {
    it('shows error state when API fails', async () => {
      mockGetGDPRMetrics.mockRejectedValue(new Error('Fetch failed'))
      mockGetGDPRRequests.mockRejectedValue(new Error('Fetch failed'))
      mockGetConsentMetrics.mockRejectedValue(new Error('Fetch failed'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Failed to load GDPR data/)).toBeInTheDocument()
      })
    })

    it('still shows GDPR Compliance heading in error state', async () => {
      mockGetGDPRMetrics.mockRejectedValue(new Error('Timeout'))
      mockGetGDPRRequests.mockRejectedValue(new Error('Timeout'))
      mockGetConsentMetrics.mockRejectedValue(new Error('Timeout'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('GDPR Compliance')).toBeInTheDocument()
      })
    })

    it('includes error message detail in error display', async () => {
      mockGetGDPRMetrics.mockRejectedValue(new Error('Database unavailable'))
      mockGetGDPRRequests.mockRejectedValue(new Error('Database unavailable'))
      mockGetConsentMetrics.mockRejectedValue(new Error('Database unavailable'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Database unavailable/)).toBeInTheDocument()
      })
    })
  })
})
