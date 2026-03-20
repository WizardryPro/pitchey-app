import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockGetNotificationPreferences = vi.fn()
const mockUpdateNotificationPreferences = vi.fn()
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

// ─── Auth store (STABLE reference) ──────────────────────────────────
const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  userType: 'creator',
}

const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
}

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── UserService ─────────────────────────────────────────────────────
vi.mock('../../services/user.service', () => ({
  UserService: {
    getNotificationPreferences: (...args: any[]) => mockGetNotificationPreferences(...args),
    updateNotificationPreferences: (...args: any[]) => mockUpdateNotificationPreferences(...args),
  },
}))

// ─── react-hot-toast ─────────────────────────────────────────────────
vi.mock('react-hot-toast', () => ({
  default: { success: mockToastSuccess, error: mockToastError, loading: vi.fn() },
  toast: { success: mockToastSuccess, error: mockToastError, loading: vi.fn() },
}))

// ─── Dynamic import ──────────────────────────────────────────────────
let NotificationSettings: React.ComponentType
beforeAll(async () => {
  const mod = await import('../settings/NotificationSettings')
  NotificationSettings = mod.default
})

const renderComponent = () =>
  render(
    <MemoryRouter>
      <NotificationSettings />
    </MemoryRouter>
  )

describe('NotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetNotificationPreferences.mockResolvedValue(null)
    mockUpdateNotificationPreferences.mockResolvedValue(undefined)
  })

  describe('Loading state', () => {
    it('shows loading skeleton while fetching preferences', () => {
      mockGetNotificationPreferences.mockReturnValue(new Promise(() => {}))
      renderComponent()
      // animate-pulse skeleton is present during loading
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })
  })

  describe('Error state', () => {
    it('shows error message when API fails', async () => {
      mockGetNotificationPreferences.mockRejectedValue(new Error('Connection refused'))
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Failed to load notification preferences')).toBeInTheDocument()
      })
      expect(screen.getByText('Connection refused')).toBeInTheDocument()
    })

    it('shows Retry button on error', async () => {
      mockGetNotificationPreferences.mockRejectedValue(new Error('Failed'))
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })
  })

  describe('Layout', () => {
    it('renders the Notification Preferences heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
      })
    })

    it('renders section heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
      })
    })

    it('renders Notification Types section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Notification Types')).toBeInTheDocument()
      })
    })

    it('renders all default notification categories', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pitch Updates')).toBeInTheDocument()
      })
      expect(screen.getByText('Messages & Chat')).toBeInTheDocument()
      expect(screen.getByText('NDA Requests')).toBeInTheDocument()
      expect(screen.getByText('Investment Activity')).toBeInTheDocument()
      expect(screen.getByText('Marketing & Updates')).toBeInTheDocument()
      expect(screen.getByText('Security Alerts')).toBeInTheDocument()
    })

    it('renders channel labels for each category', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Email').length).toBeGreaterThanOrEqual(1)
      })
      expect(screen.getAllByText('In-App').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Push').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('SMS').length).toBeGreaterThanOrEqual(1)
    })

    it('renders Notification Frequency section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Notification Frequency')).toBeInTheDocument()
      })
      expect(screen.getByText('Instant')).toBeInTheDocument()
      expect(screen.getByText('Hourly')).toBeInTheDocument()
      expect(screen.getByText('Daily')).toBeInTheDocument()
      expect(screen.getByText('Weekly')).toBeInTheDocument()
    })

    it('renders Quiet Hours section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Quiet Hours')).toBeInTheDocument()
      })
      expect(screen.getByText('Pause notifications during specific hours')).toBeInTheDocument()
    })

    it('renders action buttons', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })
      expect(screen.getByText('Reset to Defaults')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })
  })

  describe('Save button state', () => {
    it('Save Changes button is disabled when there are no changes', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })
      const saveBtn = screen.getByText('Save Changes').closest('button')
      expect(saveBtn).toBeDisabled()
    })

    it('Save Changes button is enabled after making a change', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Reset to Defaults')).toBeInTheDocument()
      })

      // Click Reset to Defaults — this sets hasChanges=true
      await user.click(screen.getByText('Reset to Defaults'))

      const saveBtn = screen.getByText('Save Changes').closest('button')
      expect(saveBtn).not.toBeDisabled()
    })
  })

  describe('Frequency selection', () => {
    it('Instant frequency is selected by default', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Instant')).toBeInTheDocument()
      })
      const instantBtn = screen.getByText('Instant').closest('button')
      expect(instantBtn?.className).toContain('border-purple-500')
    })

    it('changes frequency selection when a different option is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Daily')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Daily'))

      const dailyBtn = screen.getByText('Daily').closest('button')
      expect(dailyBtn?.className).toContain('border-purple-500')
    })
  })

  describe('Quiet hours', () => {
    it('does not show time inputs when quiet hours is disabled', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Quiet Hours')).toBeInTheDocument()
      })
      expect(screen.queryByText('Start Time')).not.toBeInTheDocument()
    })

    it('shows time inputs after enabling quiet hours', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Quiet Hours')).toBeInTheDocument()
      })

      // The Quiet Hours toggle is the large toggle button next to the "Quiet Hours" heading
      const quietHoursSection = screen.getByText('Quiet Hours').closest('div')
      const toggleBtn = quietHoursSection?.closest('div')?.querySelector('button')
      if (toggleBtn) {
        await user.click(toggleBtn)
        await waitFor(() => {
          expect(screen.getByText('Start Time')).toBeInTheDocument()
        })
        expect(screen.getByText('End Time')).toBeInTheDocument()
        expect(screen.getByText('Timezone')).toBeInTheDocument()
      }
    })
  })

  describe('Save action', () => {
    it('calls updateNotificationPreferences on save', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Reset to Defaults')).toBeInTheDocument()
      })

      // Enable changes first
      await user.click(screen.getByText('Reset to Defaults'))

      const saveBtn = screen.getByText('Save Changes').closest('button')
      await user.click(saveBtn!)

      await waitFor(() => {
        expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith(
          expect.objectContaining({
            categories: expect.any(Object),
            quietHours: expect.any(Object),
            frequency: expect.any(String),
          })
        )
      })
    })

    it('shows success toast after save', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Reset to Defaults')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Reset to Defaults'))
      const saveBtn = screen.getByText('Save Changes').closest('button')
      await user.click(saveBtn!)

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Notification settings updated successfully!')
      })
    })

    it('shows error toast when save fails', async () => {
      mockUpdateNotificationPreferences.mockRejectedValue(new Error('Save failed'))
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Reset to Defaults')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Reset to Defaults'))
      const saveBtn = screen.getByText('Save Changes').closest('button')
      await user.click(saveBtn!)

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Save failed')
      })
    })
  })

  describe('Cancel action', () => {
    it('navigates back when Cancel is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Cancel'))
      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })
  })

  describe('Backend preferences merge', () => {
    it('merges backend preferences with defaults when API returns data', async () => {
      mockGetNotificationPreferences.mockResolvedValue({
        categories: {
          pitchUpdates: { email: false, inApp: false, push: false, sms: false },
        },
        frequency: 'daily',
      })

      renderComponent()

      await waitFor(() => {
        // Daily should be selected due to backend preference
        expect(screen.getByText('Daily')).toBeInTheDocument()
      })
      const dailyBtn = screen.getByText('Daily').closest('button')
      expect(dailyBtn?.className).toContain('border-purple-500')
    })
  })
})
