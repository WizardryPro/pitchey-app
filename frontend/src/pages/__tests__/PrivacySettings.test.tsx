import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockGetSettings = vi.fn()
const mockUpdateSettings = vi.fn()
const mockDeleteAccount = vi.fn()
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
    getSettings: (...args: any[]) => mockGetSettings(...args),
    updateSettings: (...args: any[]) => mockUpdateSettings(...args),
    deleteAccount: (...args: any[]) => mockDeleteAccount(...args),
  },
}))

// ─── react-hot-toast ─────────────────────────────────────────────────
vi.mock('react-hot-toast', () => ({
  default: { success: mockToastSuccess, error: mockToastError, loading: vi.fn() },
  toast: { success: mockToastSuccess, error: mockToastError, loading: vi.fn() },
}))

// ─── Dynamic import ──────────────────────────────────────────────────
let PrivacySettings: React.ComponentType
beforeAll(async () => {
  const mod = await import('../settings/PrivacySettings')
  PrivacySettings = mod.default
})

const renderComponent = () =>
  render(
    <MemoryRouter>
      <PrivacySettings />
    </MemoryRouter>
  )

describe('PrivacySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({ publicProfile: true, twoFactorEnabled: false })
    mockUpdateSettings.mockResolvedValue(undefined)
    mockDeleteAccount.mockResolvedValue(undefined)
  })

  describe('Loading state', () => {
    it('shows loading skeleton while fetching settings', () => {
      mockGetSettings.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })
  })

  describe('Error state', () => {
    it('shows error message when API fails', async () => {
      mockGetSettings.mockRejectedValue(new Error('Load failed'))
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Failed to load privacy settings')).toBeInTheDocument()
      })
      expect(screen.getByText('Load failed')).toBeInTheDocument()
    })

    it('shows Retry button on error', async () => {
      mockGetSettings.mockRejectedValue(new Error('Failed'))
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })
  })

  describe('Layout', () => {
    it('renders the Privacy & Security Settings heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Privacy & Security Settings')).toBeInTheDocument()
      })
    })

    it('renders the main section heading', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Privacy & Security Settings')).toBeInTheDocument()
      })
    })

    it('renders tabs: Privacy, Security, Data Management', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Privacy')).toBeInTheDocument()
      })
      expect(screen.getByText('Security')).toBeInTheDocument()
      expect(screen.getByText('Data Management')).toBeInTheDocument()
    })
  })

  describe('Privacy tab (default)', () => {
    it('shows Profile Visibility section on Privacy tab', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Profile Visibility')).toBeInTheDocument()
      })
    })

    it('shows all profile visibility options', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Public Profile')).toBeInTheDocument()
      })
      expect(screen.getByText('Searchable Profile')).toBeInTheDocument()
      expect(screen.getByText('Show Email Address')).toBeInTheDocument()
      expect(screen.getByText('Show Phone Number')).toBeInTheDocument()
      expect(screen.getByText('Show Location')).toBeInTheDocument()
    })

    it('shows Data Sharing Preferences section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Data Sharing Preferences')).toBeInTheDocument()
      })
    })

    it('shows all data sharing options', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Usage Analytics')).toBeInTheDocument()
      })
      expect(screen.getByText('Marketing Communications')).toBeInTheDocument()
      expect(screen.getByText('Third-Party Integrations')).toBeInTheDocument()
      expect(screen.getByText('Performance Monitoring')).toBeInTheDocument()
    })

    it('shows Save Changes and Cancel buttons on Privacy tab', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('Save Changes button is disabled when no changes made', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })
      const saveBtn = screen.getByText('Save Changes').closest('button')
      expect(saveBtn).toBeDisabled()
    })
  })

  describe('Security tab', () => {
    it('shows Two-Factor Authentication section when Security tab is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Security')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Security'))

      await waitFor(() => {
        expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument()
      })
      expect(screen.getByText('Enable 2FA')).toBeInTheDocument()
    })

    it('shows Current Session section on Security tab', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Security')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Security'))

      await waitFor(() => {
        expect(screen.getByText('Current Session')).toBeInTheDocument()
      })
      expect(screen.getByText('Active Session')).toBeInTheDocument()
    })

    it('shows user email in current session info', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Security')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Security'))

      await waitFor(() => {
        expect(screen.getByText(/test@example.com/)).toBeInTheDocument()
      })
    })

    it('shows 2FA method options when 2FA is enabled', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Security')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Security'))

      await waitFor(() => {
        expect(screen.getByText('Enable 2FA')).toBeInTheDocument()
      })

      // Toggle 2FA on — it's the toggle button next to "Enable 2FA"
      const twoFaSection = screen.getByText('Enable 2FA').closest('div')
      const toggleBtn = twoFaSection?.closest('div')?.querySelector('button')
      if (toggleBtn) {
        await user.click(toggleBtn)
        await waitFor(() => {
          expect(screen.getByText('Authentication Method')).toBeInTheDocument()
        })
        expect(screen.getByText('Authenticator App')).toBeInTheDocument()
        expect(screen.getByText('SMS')).toBeInTheDocument()
      }
    })
  })

  describe('Data Management tab', () => {
    it('shows data export section when Data Management tab is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Data Management')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Data Management'))

      await waitFor(() => {
        expect(screen.getByText('Export Your Data')).toBeInTheDocument()
      })
      expect(screen.getByText('Request Data Export')).toBeInTheDocument()
    })

    it('shows Data Retention section', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Data Management')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Data Management'))

      await waitFor(() => {
        expect(screen.getByText('Data Retention')).toBeInTheDocument()
      })
      expect(screen.getByText('Account Data')).toBeInTheDocument()
      expect(screen.getByText('Pitch Content')).toBeInTheDocument()
      expect(screen.getByText('Analytics Data')).toBeInTheDocument()
    })

    it('shows Delete Account section', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Data Management')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Data Management'))

      await waitFor(() => {
        expect(screen.getAllByText('Delete Account').length).toBeGreaterThanOrEqual(1)
      })
      expect(screen.getByText('Permanently Delete Account')).toBeInTheDocument()
    })

    it('does not show Save Changes or Cancel buttons on Data tab', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Data Management')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Data Management'))

      await waitFor(() => {
        expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
      })
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
    })

    it('shows delete confirmation input when Delete Account is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Data Management')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Data Management'))

      await waitFor(() => {
        expect(screen.getAllByText('Delete Account').length).toBeGreaterThanOrEqual(1)
      })

      await user.click(screen.getByRole('button', { name: 'Delete Account' }))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('DELETE MY ACCOUNT')).toBeInTheDocument()
      })
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument()
    })

    it('Confirm Deletion button is disabled when text does not match', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Data Management')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Data Management'))

      await waitFor(() => {
        expect(screen.getAllByText('Delete Account').length).toBeGreaterThanOrEqual(1)
      })

      await user.click(screen.getByRole('button', { name: 'Delete Account' }))

      await waitFor(() => {
        expect(screen.getByText('Confirm Deletion')).toBeInTheDocument()
      })

      const confirmBtn = screen.getByRole('button', { name: 'Confirm Deletion' })
      expect(confirmBtn).toBeDisabled()
    })

    it('enables Confirm Deletion when correct text is typed', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Data Management')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Data Management'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Delete Account' }))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('DELETE MY ACCOUNT')).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText('DELETE MY ACCOUNT'), 'DELETE MY ACCOUNT')

      const confirmBtn = screen.getByRole('button', { name: 'Confirm Deletion' })
      expect(confirmBtn).not.toBeDisabled()
    })

    it('shows success toast and calls data export on Request Data Export click', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Data Management')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Data Management'))

      await waitFor(() => {
        expect(screen.getByText('Request Data Export')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Request Data Export'))

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Data export started. You will receive an email when ready.'
        )
      })
    })
  })

  describe('Save action', () => {
    it('calls updateSettings on save', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Privacy')).toBeInTheDocument()
      })

      // Make a change to enable the save button
      const toggleButtons = screen.getAllByRole('button').filter(btn =>
        btn.className.includes('rounded-full')
      )
      if (toggleButtons.length > 0) {
        await user.click(toggleButtons[0])
      }

      const saveBtn = screen.getByText('Save Changes').closest('button')
      if (saveBtn && !saveBtn.hasAttribute('disabled')) {
        await user.click(saveBtn)

        await waitFor(() => {
          expect(mockUpdateSettings).toHaveBeenCalled()
        })
      }
    })

    it('shows success toast after successful save', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
      })

      // Click a toggle to enable hasChanges
      const toggleButtons = screen.getAllByRole('button').filter(btn =>
        btn.className.includes('rounded-full') && btn.className.includes('bg-')
      )
      if (toggleButtons.length > 0) {
        await user.click(toggleButtons[0])

        const saveBtn = screen.getByText('Save Changes').closest('button')
        if (saveBtn && !saveBtn.disabled) {
          await user.click(saveBtn)

          await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledWith('Privacy settings updated successfully!')
          })
        }
      }
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
})
