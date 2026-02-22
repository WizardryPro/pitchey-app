import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockGetSystemSettings = vi.fn()
const mockUpdateSystemSettings = vi.fn()

vi.mock('../../services/admin.service', () => ({
  adminService: {
    getSystemSettings: (...args: any[]) => mockGetSystemSettings(...args),
    updateSystemSettings: (...args: any[]) => mockUpdateSystemSettings(...args),
  },
}))

// Dynamic import after mocks
let SystemSettings: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Admin/SystemSettings')
  SystemSettings = mod.default
})

const mockSettings = {
  maintenance: {
    enabled: false,
    message: 'System is under maintenance',
    scheduledStart: '',
    scheduledEnd: '',
  },
  features: {
    userRegistration: true,
    pitchSubmission: true,
    payments: true,
    messaging: true,
    ndaWorkflow: true,
    realTimeUpdates: false,
  },
  limits: {
    maxPitchesPerUser: 10,
    maxFileUploadSize: 50,
    maxDocumentsPerPitch: 5,
    sessionTimeout: 60,
  },
  pricing: {
    creditPrices: {
      single: 1.99,
      pack5: 7.99,
      pack10: 14.99,
      pack25: 29.99,
    },
    subscriptionPlans: {
      basic: { monthly: 9.99, yearly: 99.99 },
      premium: { monthly: 29.99, yearly: 299.99 },
      enterprise: { monthly: 99.99, yearly: 999.99 },
    },
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    weeklyDigest: true,
  },
  security: {
    enforceStrongPasswords: true,
    twoFactorRequired: false,
    sessionSecurity: 'normal' as const,
    apiRateLimit: 100,
  },
}

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <SystemSettings />
    </MemoryRouter>
  )
}

describe('SystemSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSystemSettings.mockResolvedValue(mockSettings)
    mockUpdateSystemSettings.mockResolvedValue(undefined)
  })

  describe('Loading', () => {
    it('shows loading skeleton initially', () => {
      mockGetSystemSettings.mockReturnValue(new Promise(() => {}))
      renderComponent()
      const pulseElements = document.querySelectorAll('.animate-pulse')
      expect(pulseElements.length).toBeGreaterThan(0)
    })
  })

  describe('Layout', () => {
    it('renders the page title and subtitle', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('System Settings')).toBeInTheDocument()
      })
      expect(screen.getByText('Configure platform settings and features')).toBeInTheDocument()
    })

    it('renders all tab buttons', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('General')).toBeInTheDocument()
      })
      expect(screen.getByText('Features')).toBeInTheDocument()
      expect(screen.getByText('Limits')).toBeInTheDocument()
      expect(screen.getByText('Pricing')).toBeInTheDocument()
      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByText('Security')).toBeInTheDocument()
    })

    it('renders Save Settings button', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument()
      })
    })
  })

  describe('General Tab', () => {
    it('shows General Settings content by default', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('General Settings')).toBeInTheDocument()
      })
    })

    it('shows Maintenance Mode section', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Maintenance Mode')).toBeInTheDocument()
      })
      expect(screen.getByText('Enable maintenance mode')).toBeInTheDocument()
    })

    it('shows maintenance message textarea', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Maintenance Message')).toBeInTheDocument()
      })
    })

    it('shows scheduled start and end fields', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Scheduled Start')).toBeInTheDocument()
      })
      expect(screen.getByText('Scheduled End')).toBeInTheDocument()
    })
  })

  describe('Features Tab', () => {
    it('shows feature toggles when Features tab is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Features')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Features'))
      await waitFor(() => {
        expect(screen.getByText('Feature Toggles')).toBeInTheDocument()
      })
    })

    it('displays feature names with readable labels', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Features')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Features'))
      await waitFor(() => {
        // camelCase is split into readable text
        expect(screen.getByText(/user Registration/i)).toBeInTheDocument()
      })
      expect(screen.getByText(/pitch Submission/i)).toBeInTheDocument()
      expect(screen.getByText(/payments/i)).toBeInTheDocument()
    })
  })

  describe('Limits Tab', () => {
    it('shows system limits when Limits tab is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Limits')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Limits'))
      await waitFor(() => {
        expect(screen.getByText('System Limits')).toBeInTheDocument()
      })
    })

    it('displays limit fields with values', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Limits')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Limits'))
      await waitFor(() => {
        expect(screen.getByText('Max Pitches Per User')).toBeInTheDocument()
      })
      expect(screen.getByText('Max File Upload Size (MB)')).toBeInTheDocument()
      expect(screen.getByText('Max Documents Per Pitch')).toBeInTheDocument()
      expect(screen.getByText('Session Timeout (minutes)')).toBeInTheDocument()
    })
  })

  describe('Pricing Tab', () => {
    it('shows pricing config when Pricing tab is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pricing')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Pricing'))
      await waitFor(() => {
        expect(screen.getByText('Pricing Configuration')).toBeInTheDocument()
      })
    })

    it('displays credit price fields', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pricing')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Pricing'))
      await waitFor(() => {
        expect(screen.getByText('Credit Prices (USD)')).toBeInTheDocument()
      })
      expect(screen.getByText('Single Credit')).toBeInTheDocument()
      expect(screen.getByText('5-Pack Credits')).toBeInTheDocument()
      expect(screen.getByText('10-Pack Credits')).toBeInTheDocument()
      expect(screen.getByText('25-Pack Credits')).toBeInTheDocument()
    })

    it('displays subscription plan fields', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pricing')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Pricing'))
      await waitFor(() => {
        expect(screen.getByText('Subscription Plans (USD)')).toBeInTheDocument()
      })
      expect(screen.getByText('basic')).toBeInTheDocument()
      expect(screen.getByText('premium')).toBeInTheDocument()
      expect(screen.getByText('enterprise')).toBeInTheDocument()
    })
  })

  describe('Notifications Tab', () => {
    it('shows notification settings when Notifications tab is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Notifications'))
      await waitFor(() => {
        expect(screen.getByText('Notification Settings')).toBeInTheDocument()
      })
    })

    it('displays notification toggle names', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Notifications'))
      await waitFor(() => {
        expect(screen.getByText(/email Enabled/i)).toBeInTheDocument()
      })
      expect(screen.getByText(/sms Enabled/i)).toBeInTheDocument()
      expect(screen.getByText(/push Enabled/i)).toBeInTheDocument()
      expect(screen.getByText(/weekly Digest/i)).toBeInTheDocument()
    })
  })

  describe('Security Tab', () => {
    it('shows security settings when Security tab is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Security')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Security'))
      await waitFor(() => {
        expect(screen.getByText('Security Settings')).toBeInTheDocument()
      })
    })

    it('displays security fields', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Security')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Security'))
      await waitFor(() => {
        expect(screen.getByText('Enforce Strong Passwords')).toBeInTheDocument()
      })
      expect(screen.getByText('Two-Factor Required')).toBeInTheDocument()
      expect(screen.getByText('Session Security Level')).toBeInTheDocument()
      expect(screen.getByText('API Rate Limit (requests/minute)')).toBeInTheDocument()
    })
  })

  describe('Save', () => {
    it('calls updateSystemSettings when Save is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Save Settings'))
      await waitFor(() => {
        expect(mockUpdateSystemSettings).toHaveBeenCalledTimes(1)
      })
    })

    it('shows success message after successful save', async () => {
      const user = userEvent.setup()
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Save Settings'))
      await waitFor(() => {
        expect(screen.getByText('Settings updated successfully')).toBeInTheDocument()
      })
    })

    it('shows Saving... text while saving', async () => {
      const user = userEvent.setup()
      mockUpdateSystemSettings.mockReturnValue(new Promise(() => {}))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Save Settings'))
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument()
      })
    })

    it('shows error message when save fails', async () => {
      const user = userEvent.setup()
      mockUpdateSystemSettings.mockRejectedValue(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Save Settings'))
      await waitFor(() => {
        expect(screen.getByText('Failed to save settings')).toBeInTheDocument()
      })
    })
  })

  describe('Error', () => {
    it('shows error state when settings fail to load', async () => {
      mockGetSystemSettings.mockRejectedValue(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Error Loading Settings')).toBeInTheDocument()
      })
    })

    it('shows retry button on load error', async () => {
      mockGetSystemSettings.mockRejectedValue(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('retries loading when retry button is clicked', async () => {
      mockGetSystemSettings.mockRejectedValueOnce(new Error('Server error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
      mockGetSystemSettings.mockResolvedValue(mockSettings)
      await userEvent.click(screen.getByText('Retry'))
      await waitFor(() => {
        expect(mockGetSystemSettings).toHaveBeenCalledTimes(2)
      })
    })
  })
})
