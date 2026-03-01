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

let PaymentMethods: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/PaymentMethods')
  PaymentMethods = mod.default
})

describe('PaymentMethods', () => {
  it('renders page heading', () => {
    render(
      <MemoryRouter>
        <PaymentMethods />
      </MemoryRouter>
    )
    expect(screen.getByText('Payment Methods')).toBeInTheDocument()
  })

  it('renders subtitle description', () => {
    render(
      <MemoryRouter>
        <PaymentMethods />
      </MemoryRouter>
    )
    expect(screen.getByText('Manage your payment methods for investments and transactions')).toBeInTheDocument()
  })

  it('renders security notice', () => {
    render(
      <MemoryRouter>
        <PaymentMethods />
      </MemoryRouter>
    )
    expect(screen.getByText('Bank-Level Security')).toBeInTheDocument()
  })

  it('renders coming soon message', () => {
    render(
      <MemoryRouter>
        <PaymentMethods />
      </MemoryRouter>
    )
    expect(screen.getByText('Payment integration coming soon')).toBeInTheDocument()
  })

  it('renders Payment Information section', () => {
    render(
      <MemoryRouter>
        <PaymentMethods />
      </MemoryRouter>
    )
    expect(screen.getByText('Payment Information')).toBeInTheDocument()
  })

  it('renders accepted payment methods info', () => {
    render(
      <MemoryRouter>
        <PaymentMethods />
      </MemoryRouter>
    )
    expect(screen.getByText('Accepted Payment Methods')).toBeInTheDocument()
  })

  it('renders processing times section', () => {
    render(
      <MemoryRouter>
        <PaymentMethods />
      </MemoryRouter>
    )
    expect(screen.getByText('Processing Times')).toBeInTheDocument()
  })

  it('renders ACH and wire transfer info', () => {
    render(
      <MemoryRouter>
        <PaymentMethods />
      </MemoryRouter>
    )
    expect(screen.getByText(/ACH Transfers/)).toBeInTheDocument()
    expect(screen.getByText(/Wire Transfers/)).toBeInTheDocument()
  })

  it('renders Stripe integration notice', () => {
    render(
      <MemoryRouter>
        <PaymentMethods />
      </MemoryRouter>
    )
    expect(screen.getByText(/Stripe/i)).toBeInTheDocument()
  })
})
