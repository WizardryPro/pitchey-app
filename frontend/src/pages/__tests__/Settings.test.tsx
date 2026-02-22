import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockFetch = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store (STABLE reference) ──────────────────────────────────
const mockUser = { id: 1, name: 'Test User', email: 'test@test.com', user_type: 'creator' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: vi.fn(),
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Config ─────────────────────────────────────────────────────────
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8787',
  config: { API_URL: 'http://localhost:8787' },
  getApiUrl: () => 'http://localhost:8787',
}))

// ─── Dynamic import ──────────────────────────────────────────────────
let Settings: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Settings')
  Settings = mod.default
})

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)

    // Default: settings fetch succeeds
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/user/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            notifications: {
              emailNotifications: true,
              pushNotifications: false,
              pitchViews: true,
              newMessages: true,
              projectUpdates: false,
              weeklyDigest: false,
              marketingEmails: false,
            },
            privacy: {
              profileVisibility: 'public',
              showEmail: false,
              showPhone: false,
              allowDirectMessages: true,
              allowPitchRequests: true,
            },
            security: {
              twoFactorEnabled: false,
              sessionTimeout: 30,
              loginNotifications: true,
            },
          }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  it('renders the loading spinner initially', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('renders Account Settings title after loading', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Account Settings')).toBeInTheDocument()
    })
  })

  it('renders all four tabs', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByText('Privacy')).toBeInTheDocument()
      expect(screen.getByText('Security')).toBeInTheDocument()
      expect(screen.getByText('Account')).toBeInTheDocument()
    })
  })

  it('shows notifications tab content by default', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
    })
  })

  it('shows Email Notifications toggle', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Email Notifications')).toBeInTheDocument()
    })
  })

  it('shows Push Notifications toggle', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Push Notifications')).toBeInTheDocument()
    })
  })

  it('shows notification sub-options', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Pitch Views')).toBeInTheDocument()
      expect(screen.getByText('New Messages')).toBeInTheDocument()
      expect(screen.getByText('Project Updates')).toBeInTheDocument()
    })
  })

  it('switches to Privacy tab when clicked', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Privacy')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Privacy'))

    await waitFor(() => {
      expect(screen.getByText('Privacy Settings')).toBeInTheDocument()
    })
  })

  it('shows profile visibility selector in Privacy tab', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      fireEvent.click(screen.getByText('Privacy'))
    })

    await waitFor(() => {
      expect(screen.getByText('Profile Visibility')).toBeInTheDocument()
    })
  })

  it('shows privacy toggle options', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      fireEvent.click(screen.getByText('Privacy'))
    })

    await waitFor(() => {
      expect(screen.getByText('Show Email Address')).toBeInTheDocument()
      expect(screen.getByText('Show Phone Number')).toBeInTheDocument()
      expect(screen.getByText('Allow Direct Messages')).toBeInTheDocument()
    })
  })

  it('switches to Security tab when clicked', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      fireEvent.click(screen.getByText('Security'))
    })

    await waitFor(() => {
      expect(screen.getByText('Security Settings')).toBeInTheDocument()
    })
  })

  it('shows Two-Factor Authentication section in Security tab', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      fireEvent.click(screen.getByText('Security'))
    })

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument()
    })
  })

  it('shows Enable 2FA button when 2FA is disabled', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      fireEvent.click(screen.getByText('Security'))
    })

    await waitFor(() => {
      expect(screen.getByText('Enable 2FA')).toBeInTheDocument()
    })
  })

  it('shows Change Password button in Security tab', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      fireEvent.click(screen.getByText('Security'))
    })

    await waitFor(() => {
      expect(screen.getByText('Change Password')).toBeInTheDocument()
    })
  })

  it('switches to Account tab and shows Delete Account section', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      fireEvent.click(screen.getByText('Account'))
    })

    await waitFor(() => {
      expect(screen.getByText('Account Management')).toBeInTheDocument()
      expect(screen.getAllByText('Delete Account').length).toBeGreaterThan(0)
    })
  })

  it('shows data export option in Account tab', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      fireEvent.click(screen.getByText('Account'))
    })

    await waitFor(() => {
      expect(screen.getByText('Export Your Data')).toBeInTheDocument()
      expect(screen.getByText('Request Data Export')).toBeInTheDocument()
    })
  })

  it('shows delete account confirmation modal when Delete Account is clicked', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      fireEvent.click(screen.getByText('Account'))
    })

    await waitFor(() => {
      expect(screen.getAllByText('Delete Account').length).toBeGreaterThan(0)
    })

    // Click the Delete Account button in the Account tab
    const deleteButtons = screen.getAllByText('Delete Account')
    // Click the button inside the card (not the tab)
    fireEvent.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() => {
      expect(screen.getByText(/Are you absolutely sure/)).toBeInTheDocument()
    })
  })

  it('closes delete modal when Cancel is clicked', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      fireEvent.click(screen.getByText('Account'))
    })

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete Account')
      fireEvent.click(deleteButtons[deleteButtons.length - 1])
    })

    await waitFor(() => {
      expect(screen.getByText(/Are you absolutely sure/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Cancel'))

    await waitFor(() => {
      expect(screen.queryByText(/Are you absolutely sure/)).not.toBeInTheDocument()
    })
  })

  it('renders Save Changes button in header', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })
  })

  it('uses default settings when API fetch fails', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    )

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Account Settings')).toBeInTheDocument()
    })
  })
})
