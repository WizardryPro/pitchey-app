import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
  const mod = await import('../production/settings/ProductionSettingsBilling')
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

describe('ProductionSettingsBilling', () => {
  it('renders the page title', () => {
    renderComponent()
    expect(screen.getByText('Billing & Payments')).toBeInTheDocument()
    expect(screen.getByText('Manage your subscription, payment methods, and billing information')).toBeInTheDocument()
  })

  it('renders tab navigation', () => {
    renderComponent()
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Payment Methods')).toBeInTheDocument()
    expect(screen.getByText('Billing Info')).toBeInTheDocument()
    expect(screen.getByText('Invoices')).toBeInTheDocument()
  })

  it('shows the overview tab by default with plan info', () => {
    renderComponent()
    expect(screen.getByText('Current Plan')).toBeInTheDocument()
    expect(screen.getByText('Professional Plan')).toBeInTheDocument()
    expect(screen.getByText('per month')).toBeInTheDocument()
  })

  it('displays billing summary cards in overview', () => {
    renderComponent()
    expect(screen.getByText('Current Balance')).toBeInTheDocument()
    expect(screen.getByText('Next Bill Date')).toBeInTheDocument()
    expect(screen.getByText('Next Amount')).toBeInTheDocument()
  })

  it('shows plan features', () => {
    renderComponent()
    expect(screen.getByText('Pitch Submissions')).toBeInTheDocument()
    expect(screen.getByText('Unlimited')).toBeInTheDocument()
    expect(screen.getByText('Team Members')).toBeInTheDocument()
    expect(screen.getByText('Storage')).toBeInTheDocument()
  })

  it('shows Upgrade Plan button', () => {
    renderComponent()
    expect(screen.getByText('Upgrade Plan')).toBeInTheDocument()
    expect(screen.getByText('Change Plan')).toBeInTheDocument()
  })

  it('switches to Payment Methods tab', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Payment Methods'))
    expect(screen.getByText('Add Payment Method')).toBeInTheDocument()
  })

  it('shows payment methods with card info', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Payment Methods'))
    expect(screen.getAllByText(/4242/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/1234/).length).toBeGreaterThanOrEqual(1)
  })

  it('switches to Invoices tab and shows invoice list', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Invoices'))
    expect(screen.getByText('Invoice History')).toBeInTheDocument()
    expect(screen.getByText('INV-2024-001')).toBeInTheDocument()
    expect(screen.getByText('INV-2024-002')).toBeInTheDocument()
    expect(screen.getByText('INV-2024-003')).toBeInTheDocument()
  })

  it('switches to Billing Info tab and shows form fields', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Billing Info'))
    expect(screen.getByText('Billing Information')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Stellar Productions LLC')).toBeInTheDocument()
    expect(screen.getByDisplayValue('billing@stellarproductions.com')).toBeInTheDocument()
  })
})
