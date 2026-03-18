import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLogout = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store ─────────────────────────────────────────────────────
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

// ─── paymentsAPI ────────────────────────────────────────────────────
const mockGetSubscriptionStatus = vi.fn()
const mockGetCreditBalance = vi.fn()
const mockGetPaymentHistory = vi.fn()
const mockGetInvoices = vi.fn()
const mockGetPaymentMethods = vi.fn()

vi.mock('../../lib/apiServices', () => ({
  paymentsAPI: {
    getSubscriptionStatus: mockGetSubscriptionStatus,
    getCreditBalance: mockGetCreditBalance,
    getPaymentHistory: mockGetPaymentHistory,
    getInvoices: mockGetInvoices,
    getPaymentMethods: mockGetPaymentMethods,
  },
}))

// ─── Child components ───────────────────────────────────────────────
vi.mock('@features/billing/components/SubscriptionCard', () => ({
  default: ({ subscription }: any) => (
    <div data-testid="subscription-card">
      Subscription: {subscription ? 'active' : 'none'}
    </div>
  ),
}))

vi.mock('@features/billing/components/CreditPurchase', () => ({
  default: ({ credits }: any) => (
    <div data-testid="credit-purchase">
      Credits: {credits?.balance?.credits ?? credits?.credits ?? 0}
    </div>
  ),
}))

vi.mock('@features/billing/components/PaymentHistory', () => ({
  default: ({ payments }: any) => (
    <div data-testid="payment-history">
      Payments: {(payments || []).length}
    </div>
  ),
}))

vi.mock('@features/billing/components/PaymentMethodCard', () => ({
  default: ({ paymentMethods }: any) => (
    <div data-testid="payment-method-card">
      Methods: {(paymentMethods || []).length}
    </div>
  ),
}))

// ─── Subscription plans config ──────────────────────────────────────
vi.mock('../../config/subscription-plans', () => ({
  getSubscriptionTier: (tier: string) => tier ? { name: 'The Filmmaker' } : null,
}))

// ─── Dynamic import ─────────────────────────────────────────────────
let Billing: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Billing')
  Billing = mod.default
})

describe('Billing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('userType', 'creator')

    mockGetSubscriptionStatus.mockResolvedValue({ status: 'active', tier: 'filmmaker' })
    mockGetCreditBalance.mockResolvedValue({ credits: 100, balance: { credits: 100, totalPurchased: 150, totalUsed: 50 } })
    mockGetPaymentHistory.mockResolvedValue({ payments: [] })
    mockGetInvoices.mockResolvedValue({ invoices: [] })
    mockGetPaymentMethods.mockResolvedValue({ paymentMethods: [] })
  })

  const renderComponent = (initialRoute = '/billing') =>
    render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Billing />
      </MemoryRouter>
    )

  it('shows loading spinner initially', () => {
    // Make getSubscriptionStatus never resolve during this test
    mockGetSubscriptionStatus.mockReturnValue(new Promise(() => {}))
    renderComponent()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders Billing & Payments heading after loading', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Billing & Payments')).toBeInTheDocument()
    })
  })

  it('renders Pitchey logo/link', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getAllByText('Pitchey').length).toBeGreaterThan(0)
    })
  })

  it('renders tab navigation', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument()
      expect(screen.getByText('Subscription')).toBeInTheDocument()
      expect(screen.getByText('Credits')).toBeInTheDocument()
      expect(screen.getByText('Payment History')).toBeInTheDocument()
    })
  })

  it('shows credit balance in header when credits are loaded', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('100 Credits')).toBeInTheDocument()
    })
  })

  it('renders Overview tab content by default', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Current Plan')).toBeInTheDocument()
      expect(screen.getByText('Credit Balance')).toBeInTheDocument()
    })
  })

  it('shows "No recent payments" when no payment history', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('No recent payments')).toBeInTheDocument()
    })
  })

  it('navigates to subscription tab when clicked', async () => {
    renderComponent('/billing?tab=subscription')
    await waitFor(() => {
      expect(screen.getByTestId('subscription-card')).toBeInTheDocument()
    })
  })

  it('navigates to credits tab when clicked', async () => {
    renderComponent('/billing?tab=credits')
    await waitFor(() => {
      expect(screen.getByTestId('credit-purchase')).toBeInTheDocument()
    })
  })

  it('navigates to payment methods tab when clicked', async () => {
    renderComponent('/billing?tab=payment-methods')
    await waitFor(() => {
      expect(screen.getByTestId('payment-method-card')).toBeInTheDocument()
    })
  })

  it('renders "Back to Dashboard" button', async () => {
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument()
    })
  })

  it('navigates to a dashboard when Back to Dashboard is clicked', async () => {
    renderComponent()
    await waitFor(() => screen.getByText('Back to Dashboard'))
    fireEvent.click(screen.getByText('Back to Dashboard'))
    // Component reads userType from localStorage; navigates to the appropriate dashboard
    expect(mockNavigate).toHaveBeenCalled()
  })

  it('shows error message when billing data fetch fails', async () => {
    mockGetSubscriptionStatus.mockRejectedValue(new Error('Network error'))
    renderComponent()
    await waitFor(() => {
      // The error message comes from err.message which is 'Network error'
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('renders "Try again" link on error', async () => {
    mockGetSubscriptionStatus.mockRejectedValue(new Error('Network error'))
    renderComponent()
    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument()
    })
  })

  it('calls all billing APIs on mount', async () => {
    renderComponent()
    await waitFor(() => {
      expect(mockGetSubscriptionStatus).toHaveBeenCalled()
      expect(mockGetCreditBalance).toHaveBeenCalled()
      expect(mockGetPaymentHistory).toHaveBeenCalled()
      expect(mockGetInvoices).toHaveBeenCalled()
      expect(mockGetPaymentMethods).toHaveBeenCalled()
    })
  })

  it('shows invoices tab content with no invoices', async () => {
    renderComponent('/billing?tab=invoices')
    await waitFor(() => {
      expect(screen.getByText('No invoices found')).toBeInTheDocument()
    })
  })
})
