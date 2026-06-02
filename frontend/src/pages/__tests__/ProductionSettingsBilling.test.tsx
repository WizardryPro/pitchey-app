import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
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

// StripePortalCard pulls in the billing/auth/API stack; stub it so this stays a
// focused unit test of the billing page shell.
vi.mock('@features/billing/components/StripePortalCard', () => ({
  default: () => <div data-testid="stripe-portal-card">Stripe portal</div>,
}))

const mockToast = { success: vi.fn(), error: vi.fn(), loading: vi.fn() }
vi.mock('react-hot-toast', () => ({
  default: mockToast,
  toast: mockToast,
}))

let Component: React.ComponentType
beforeAll(async () => {
  const mod = await import('@portals/production/pages/ProductionSettingsBilling')
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

// The page was rewritten to delegate all real billing (cards, invoices, billing
// address, cancellation) to Stripe's hosted Customer Portal via StripePortalCard.
// The old stub tabbed UI (Overview / Payment Methods / Billing Info / Invoices)
// was removed, so the tests now assert the current shell.
describe('ProductionSettingsBilling', () => {
  it('renders the page title and subtitle', () => {
    renderComponent()
    expect(screen.getByText('Billing & Payments')).toBeInTheDocument()
    expect(
      screen.getByText('Manage your subscription, payment methods, and invoices.')
    ).toBeInTheDocument()
  })

  it('renders the Stripe customer portal card', () => {
    renderComponent()
    expect(screen.getByTestId('stripe-portal-card')).toBeInTheDocument()
  })

  it('explains that billing is managed in the secure Stripe portal', () => {
    renderComponent()
    expect(screen.getByText(/managed in the\s+secure billing portal above/i)).toBeInTheDocument()
  })

  it('no longer renders the old stub tabbed UI', () => {
    renderComponent()
    expect(screen.queryByText('Overview')).not.toBeInTheDocument()
    expect(screen.queryByText('Billing Info')).not.toBeInTheDocument()
    expect(screen.queryByText('Add Payment Method')).not.toBeInTheDocument()
    expect(screen.queryByText('Current Plan')).not.toBeInTheDocument()
  })
})
