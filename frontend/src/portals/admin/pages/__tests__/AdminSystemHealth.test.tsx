import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const mockGetSystemHealth = vi.fn()

// ─── Admin service ───────────────────────────────────────────────────────────
vi.mock('@/portals/admin/services/admin.service', () => ({
  adminService: {
    getSystemHealth: (...args: any[]) => mockGetSystemHealth(...args),
  },
}))

// ─── Dynamic import after mocks ──────────────────────────────────────────────
let AdminSystemHealth: React.ComponentType
beforeAll(async () => {
  const mod = await import('../AdminSystemHealth')
  AdminSystemHealth = mod.default
})

const mockHealthData = {
  status: 'healthy',
  timestamp: '2026-03-23T10:00:00Z',
  database: { status: 'healthy', responseTime: 12, message: 'Connected' },
  redis: { status: 'healthy', responseTime: 4 },
  stripe: { status: 'healthy', responseTime: 110 },
  resend: { status: 'healthy', responseTime: 95 },
}

const mockHealthDegraded = {
  status: 'degraded',
  timestamp: '2026-03-23T10:00:00Z',
  database: { status: 'healthy', responseTime: 12 },
  redis: { status: 'degraded', responseTime: 800, message: 'High latency' },
  stripe: { status: 'healthy', responseTime: 110 },
  resend: { status: 'unhealthy', message: 'Connection refused' },
}

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AdminSystemHealth />
    </MemoryRouter>
  )

// ─── Tests that use real timers ──────────────────────────────────────────────
describe('AdminSystemHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSystemHealth.mockResolvedValue(mockHealthData)
  })

  describe('Loading state', () => {
    it('shows loading skeleton initially', async () => {
      vi.useFakeTimers()
      try {
        mockGetSystemHealth.mockReturnValue(new Promise(() => {}))
        renderComponent()
        const pulseElements = document.querySelectorAll('.animate-pulse')
        expect(pulseElements.length).toBeGreaterThan(0)
      } finally {
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
      }
    })

    it('renders System Health heading while loading', async () => {
      vi.useFakeTimers()
      try {
        mockGetSystemHealth.mockReturnValue(new Promise(() => {}))
        renderComponent()
        expect(screen.getByText('System Health')).toBeInTheDocument()
      } finally {
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
      }
    })
  })

  describe('Error state', () => {
    it('shows error message when API call fails', async () => {
      mockGetSystemHealth.mockRejectedValue(new Error('Service unavailable'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/failed to load system health/i)).toBeInTheDocument()
      })
      expect(screen.getByText(/service unavailable/i)).toBeInTheDocument()
    })

    it('renders a Retry button on error', async () => {
      mockGetSystemHealth.mockRejectedValue(new Error('Timeout'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })

    it('retries loading when Retry button is clicked', async () => {
      const user = userEvent.setup()
      mockGetSystemHealth.mockRejectedValueOnce(new Error('Timeout'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
      mockGetSystemHealth.mockResolvedValue(mockHealthData)
      await user.click(screen.getByRole('button', { name: /retry/i }))
      await waitFor(() => {
        expect(mockGetSystemHealth).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Overall status display', () => {
    it('shows "System is Operational" when status is healthy', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('System is Operational')).toBeInTheDocument()
      })
    })

    it('shows "System is Degraded" when status is degraded', async () => {
      mockGetSystemHealth.mockResolvedValue(mockHealthDegraded)
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('System is Degraded')).toBeInTheDocument()
      })
    })

    it('shows "System is Experiencing Issues" when status is unhealthy', async () => {
      mockGetSystemHealth.mockResolvedValue({ ...mockHealthData, status: 'unhealthy' })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('System is Experiencing Issues')).toBeInTheDocument()
      })
    })

    it('shows auto-refresh notice in the overall status card', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/auto-refreshes every 30 seconds/i)).toBeInTheDocument()
      })
    })
  })

  describe('Service cards', () => {
    it('renders Database (Neon) service card', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Database (Neon)')).toBeInTheDocument()
      })
    })

    it('renders Cache (Upstash Redis) service card', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Cache (Upstash Redis)')).toBeInTheDocument()
      })
    })

    it('renders Payments (Stripe) service card', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Payments (Stripe)')).toBeInTheDocument()
      })
    })

    it('renders Email (Resend) service card', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Email (Resend)')).toBeInTheDocument()
      })
    })

    it('displays response time for services that have one', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Database (Neon)')).toBeInTheDocument()
      })
      expect(screen.getByText('12ms')).toBeInTheDocument()
      expect(screen.getByText('4ms')).toBeInTheDocument()
    })

    it('displays service status values', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Database (Neon)')).toBeInTheDocument()
      })
      // All four services are healthy — multiple "healthy" labels appear
      const healthyLabels = screen.getAllByText('healthy')
      expect(healthyLabels.length).toBeGreaterThanOrEqual(4)
    })

    it('shows unhealthy status for a down service', async () => {
      mockGetSystemHealth.mockResolvedValue(mockHealthDegraded)
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Email (Resend)')).toBeInTheDocument()
      })
      expect(screen.getByText('unhealthy')).toBeInTheDocument()
    })

    it('shows degraded status for a degraded service', async () => {
      mockGetSystemHealth.mockResolvedValue(mockHealthDegraded)
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Cache (Upstash Redis)')).toBeInTheDocument()
      })
      expect(screen.getByText('degraded')).toBeInTheDocument()
    })

    it('displays service message details when present', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Database (Neon)')).toBeInTheDocument()
      })
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
  })

  describe('Refresh button', () => {
    it('renders the Refresh button after data loads', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
      })
    })

    it('calls getSystemHealth again when Refresh button is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
      })
      await user.click(screen.getByRole('button', { name: /refresh/i }))
      await waitFor(() => {
        // Initial load + manual refresh
        expect(mockGetSystemHealth).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Auto-refresh interval', () => {
    afterEach(() => {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
    })

    it('calls getSystemHealth automatically after 30 seconds', async () => {
      vi.useFakeTimers()
      renderComponent()
      // Allow the initial fetch to resolve
      await act(async () => {
        await Promise.resolve()
      })
      expect(mockGetSystemHealth).toHaveBeenCalledTimes(1)

      await act(async () => {
        vi.advanceTimersByTime(30000)
        await Promise.resolve()
      })
      expect(mockGetSystemHealth).toHaveBeenCalledTimes(2)
    })

    it('calls getSystemHealth twice after 60 seconds', async () => {
      vi.useFakeTimers()
      renderComponent()
      await act(async () => {
        await Promise.resolve()
      })
      expect(mockGetSystemHealth).toHaveBeenCalledTimes(1)

      await act(async () => {
        vi.advanceTimersByTime(60000)
        await Promise.resolve()
      })
      expect(mockGetSystemHealth).toHaveBeenCalledTimes(3)
    })
  })
})
