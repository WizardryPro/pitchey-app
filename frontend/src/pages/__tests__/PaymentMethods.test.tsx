import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Error boundary ─────────────────────────────────────────────────
vi.mock('@/components/ErrorBoundary/PortalErrorBoundary', () => ({
  withPortalErrorBoundary: (Component: any) => Component,
}))

// StripePortalCard pulls in the billing stack (auth + API); stub it so this
// stays a focused unit test of the PaymentMethods page shell.
vi.mock('@features/billing/components/StripePortalCard', () => ({
  default: () => <div data-testid="stripe-portal-card">Stripe portal</div>,
}))

let PaymentMethods: React.ComponentType
beforeAll(async () => {
  const mod = await import('@portals/investor/pages/PaymentMethods')
  PaymentMethods = mod.default
})

// The page was rewritten to delegate cards/invoices/billing to Stripe's hosted
// Customer Portal (StripePortalCard); the old ACH/wire/"coming soon" mock UI was
// removed. These tests assert the current shell.
describe('PaymentMethods', () => {
  const renderPage = () =>
    render(
      <MemoryRouter>
        <PaymentMethods />
      </MemoryRouter>
    )

  it('renders page heading', () => {
    renderPage()
    expect(screen.getByText('Payment Methods')).toBeInTheDocument()
  })

  it('renders subtitle description', () => {
    renderPage()
    expect(
      screen.getByText('Manage your payment methods and billing for investments and subscriptions')
    ).toBeInTheDocument()
  })

  it('renders the Stripe customer portal card', () => {
    renderPage()
    expect(screen.getByTestId('stripe-portal-card')).toBeInTheDocument()
  })

  it('renders the security notice about not storing card details', () => {
    renderPage()
    expect(screen.getByText(/We never store sensitive card details/i)).toBeInTheDocument()
  })

  it('explains that billing is handled in the Stripe portal', () => {
    renderPage()
    expect(screen.getByText(/handled in the secure Stripe portal/i)).toBeInTheDocument()
  })
})
