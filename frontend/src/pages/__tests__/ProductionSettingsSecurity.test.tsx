import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

const mockNavigate = vi.fn()
const mockLogout = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockUser = { id: 1, name: 'Production User', email: 'production@test.com', userType: 'production' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: vi.fn().mockResolvedValue(undefined),
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

vi.mock('../../components/DashboardHeader', () => ({
  default: ({ title }: any) => <div data-testid="dashboard-header">{title}</div>,
}))

vi.mock('../../utils/navigation', () => ({
  getDashboardRoute: () => '/production/dashboard',
}))

vi.mock('../../components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}))

vi.mock('../../components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

const mockToast = { success: vi.fn(), error: vi.fn(), loading: vi.fn() }
vi.mock('react-hot-toast', () => ({
  default: mockToast,
  toast: mockToast,
}))

let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('../production/settings/ProductionSettingsSecurity')
  Component = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
})

function renderComponent() {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  )
}

describe('ProductionSettingsSecurity', () => {
  it('renders the page title', () => {
    renderComponent()
    expect(screen.getAllByText('Security Settings').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Manage your account security and access controls')).toBeInTheDocument()
  })

  it('renders tab navigation', () => {
    renderComponent()
    expect(screen.getByText('General Security')).toBeInTheDocument()
    expect(screen.getByText('Two-Factor Auth')).toBeInTheDocument()
    expect(screen.getByText('Active Sessions')).toBeInTheDocument()
    expect(screen.getByText('Security Logs')).toBeInTheDocument()
  })

  it('shows general security tab by default with password change form', () => {
    renderComponent()
    expect(screen.getByText('Change Password')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter current password')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter new password')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Confirm new password')).toBeInTheDocument()
  })

  it('shows security preferences', () => {
    renderComponent()
    expect(screen.getByText('Security Preferences')).toBeInTheDocument()
    expect(screen.getByText('Force Password Update')).toBeInTheDocument()
    expect(screen.getByText('Trust This Device')).toBeInTheDocument()
    expect(screen.getByText('Login Alerts')).toBeInTheDocument()
  })

  it('shows session timeout selector', () => {
    renderComponent()
    expect(screen.getByText('Session Timeout')).toBeInTheDocument()
    expect(screen.getByDisplayValue('24 hours')).toBeInTheDocument()
  })

  it('shows Save Settings and Cancel buttons', () => {
    renderComponent()
    expect(screen.getByText('Save Settings')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('switches to 2FA tab', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Two-Factor Auth'))
    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument()
    expect(screen.getByText(/Two-Factor Authentication is/)).toBeInTheDocument()
  })

  it('shows 2FA enabled state with backup codes options', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Two-Factor Auth'))
    // Default state has twoFactorEnabled: true
    expect(screen.getByText('2FA is Active')).toBeInTheDocument()
    expect(screen.getByText('View Backup Codes')).toBeInTheDocument()
    expect(screen.getByText('Regenerate Codes')).toBeInTheDocument()
    expect(screen.getByText('Disable 2FA')).toBeInTheDocument()
  })

  it('switches to Active Sessions tab', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Active Sessions'))
    expect(screen.getAllByText('Active Sessions').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('MacBook Pro')).toBeInTheDocument()
    expect(screen.getByText('iPhone 15')).toBeInTheDocument()
    expect(screen.getByText('Windows Desktop')).toBeInTheDocument()
  })

  it('switches to Security Logs tab', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Security Logs'))
    expect(screen.getByText('Security Activity')).toBeInTheDocument()
    expect(screen.getByText('Login successful')).toBeInTheDocument()
    expect(screen.getByText('Password changed')).toBeInTheDocument()
    expect(screen.getByText('Failed login attempt')).toBeInTheDocument()
  })

  it('navigates on Cancel click', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Cancel'))
    expect(mockNavigate).toHaveBeenCalledWith('/production/dashboard')
  })
})
