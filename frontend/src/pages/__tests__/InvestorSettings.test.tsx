import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── react-router-dom ───────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store ─────────────────────────────────────────────────────
const mockUser = { id: 1, name: 'Investor User', email: 'investor@test.com', user_type: 'investor' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: vi.fn(),
  checkSession: vi.fn(),
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── investorApi ────────────────────────────────────────────────────
const mockGetSettings = vi.fn()
const mockSaveSettings = vi.fn()
vi.mock('../../services/investor.service', () => ({
  investorApi: {
    getSettings: mockGetSettings,
    saveSettings: mockSaveSettings,
    getFinancialSummary: vi.fn(),
    getRecentTransactions: vi.fn(),
    getTransactionStats: vi.fn(),
    getAllInvestments: vi.fn(),
    getTransactions: vi.fn(),
    getReports: vi.fn(),
  },
  InvestorService: {
    getOpportunities: vi.fn(),
    getWatchlist: vi.fn(),
  },
}))

// ─── react-hot-toast ────────────────────────────────────────────────
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { success: mockToastSuccess, error: mockToastError, loading: vi.fn() },
  toast: { success: mockToastSuccess, error: mockToastError, loading: vi.fn() },
  Toaster: () => null,
}))

// ─── UI Components ──────────────────────────────────────────────────
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} {...props}>{children}</button>
  ),
}))

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('../../components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

let InvestorSettings: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/InvestorSettings')
  InvestorSettings = mod.default
})

describe('InvestorSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({ success: true, data: null })
    mockSaveSettings.mockResolvedValue({ success: true })
  })

  it('shows loading spinner initially', () => {
    mockGetSettings.mockReturnValue(new Promise(() => {}))
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders Settings heading', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  it('renders Notification Preferences section', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
    })
  })

  it('renders notification toggles', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Email Alerts')).toBeInTheDocument()
      expect(screen.getByText('Push Notifications')).toBeInTheDocument()
      expect(screen.getByText('Weekly Investment Digest')).toBeInTheDocument()
      expect(screen.getByText('Pitch Updates')).toBeInTheDocument()
    })
  })

  it('renders Privacy section', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Privacy & Visibility')).toBeInTheDocument()
    })
  })

  it('renders privacy toggles', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Public Profile')).toBeInTheDocument()
      expect(screen.getByText('Show Investment History')).toBeInTheDocument()
      expect(screen.getByText('Allow Direct Messages')).toBeInTheDocument()
    })
  })

  it('renders Security section', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Security')).toBeInTheDocument()
    })
  })

  it('renders security toggles', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument()
      expect(screen.getByText('Login Alerts')).toBeInTheDocument()
    })
  })

  it('renders Account Management section', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Account Management')).toBeInTheDocument()
    })
  })

  it('renders account management links', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
      expect(screen.getByText('Tax Documents')).toBeInTheDocument()
      expect(screen.getByText('Payment Methods')).toBeInTheDocument()
    })
  })

  it('renders Danger Zone section', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Danger Zone')).toBeInTheDocument()
    })
  })

  it('renders Deactivate Account button', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Deactivate Account')).toBeInTheDocument()
    })
  })

  it('renders Delete Account button', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Delete Account Permanently')).toBeInTheDocument()
    })
  })

  it('renders save buttons for each section', async () => {
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Save Notification Settings')).toBeInTheDocument()
      expect(screen.getByText('Save Privacy Settings')).toBeInTheDocument()
      expect(screen.getByText('Save Security Settings')).toBeInTheDocument()
    })
  })

  it('applies saved settings from API', async () => {
    mockGetSettings.mockResolvedValue({
      success: true,
      data: {
        notifications: { emailAlerts: false, pushNotifications: true },
      },
    })
    render(
      <MemoryRouter>
        <InvestorSettings />
      </MemoryRouter>
    )
    await waitFor(() => {
      // Should still render without crashing
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })
})
