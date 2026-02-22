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

const mockToast = { success: vi.fn(), error: vi.fn(), loading: vi.fn() }
vi.mock('react-hot-toast', () => ({
  default: mockToast,
  toast: mockToast,
}))

let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('../production/settings/ProductionSettingsNotifications')
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

describe('ProductionSettingsNotifications', () => {
  it('renders the page title', () => {
    renderComponent()
    expect(screen.getAllByText('Notification Settings').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Manage how and when you receive notifications')).toBeInTheDocument()
  })

  it('renders email notifications section', () => {
    renderComponent()
    expect(screen.getByText('Email Notifications')).toBeInTheDocument()
    expect(screen.getByText('Enable Email Notifications')).toBeInTheDocument()
  })

  it('renders email notification types when enabled', () => {
    renderComponent()
    expect(screen.getByText('Pitch Submissions')).toBeInTheDocument()
    expect(screen.getByText('Status Updates')).toBeInTheDocument()
    expect(screen.getByText('Payment Updates')).toBeInTheDocument()
  })

  it('renders push notifications section', () => {
    renderComponent()
    expect(screen.getByText('Push Notifications')).toBeInTheDocument()
    expect(screen.getByText('Enable Push Notifications')).toBeInTheDocument()
  })

  it('renders in-app notifications section', () => {
    renderComponent()
    expect(screen.getAllByText('In-App Notifications').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Sound Notifications')).toBeInTheDocument()
    expect(screen.getByText('Notification Badges')).toBeInTheDocument()
  })

  it('renders quiet hours section', () => {
    renderComponent()
    expect(screen.getByText('Quiet Hours')).toBeInTheDocument()
    expect(screen.getByText('Enable Quiet Hours')).toBeInTheDocument()
  })

  it('renders test notification section', () => {
    renderComponent()
    expect(screen.getByText('Test Notifications')).toBeInTheDocument()
    expect(screen.getByText('Send Test Notification')).toBeInTheDocument()
  })

  it('renders Save Settings and Cancel buttons', () => {
    renderComponent()
    expect(screen.getByText('Save Settings')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('navigates on Cancel click', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Cancel'))
    expect(mockNavigate).toHaveBeenCalledWith('/production/dashboard')
  })

  it('shows notification frequency selector', () => {
    renderComponent()
    expect(screen.getByText('Notification Frequency')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Daily Digest')).toBeInTheDocument()
  })
})
