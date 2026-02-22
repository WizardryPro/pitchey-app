import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Dynamic import ─────────────────────────────────────────────────
let Terms: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Terms')
  Terms = mod.default
})

describe('Terms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <Terms />
      </MemoryRouter>
    )

  it('renders Terms of Service heading', () => {
    renderComponent()
    expect(screen.getByText('Terms of Service')).toBeInTheDocument()
  })

  it('renders effective date', () => {
    renderComponent()
    expect(screen.getByText(/Effective Date/)).toBeInTheDocument()
    expect(screen.getByText(/January 1, 2025/)).toBeInTheDocument()
  })

  it('renders Back to Home button', () => {
    renderComponent()
    expect(screen.getByText('Back to Home')).toBeInTheDocument()
  })

  it('navigates to home when Back to Home is clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Back to Home'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('renders Acceptance of Terms section', () => {
    renderComponent()
    expect(screen.getByText('1. Acceptance of Terms')).toBeInTheDocument()
  })

  it('renders Service Description section', () => {
    renderComponent()
    expect(screen.getByText('2. Service Description')).toBeInTheDocument()
  })

  it('renders User Accounts section', () => {
    renderComponent()
    expect(screen.getByText('3. User Accounts')).toBeInTheDocument()
  })

  it('renders Content Guidelines section', () => {
    renderComponent()
    expect(screen.getByText('4. Content Guidelines')).toBeInTheDocument()
  })

  it('renders Investment Terms section', () => {
    renderComponent()
    expect(screen.getByText('5. Investment Terms')).toBeInTheDocument()
  })

  it('renders Intellectual Property section', () => {
    renderComponent()
    expect(screen.getByText('6. Intellectual Property')).toBeInTheDocument()
  })

  it('renders Limitation of Liability section', () => {
    renderComponent()
    expect(screen.getByText('8. Limitation of Liability')).toBeInTheDocument()
  })

  it('renders Dispute Resolution section', () => {
    renderComponent()
    expect(screen.getByText('9. Dispute Resolution')).toBeInTheDocument()
  })

  it('renders Contact Information section', () => {
    renderComponent()
    expect(screen.getByText('11. Contact Information')).toBeInTheDocument()
  })

  it('renders account types list', () => {
    renderComponent()
    expect(screen.getByText(/Creator accounts/)).toBeInTheDocument()
    expect(screen.getByText(/Investor accounts/)).toBeInTheDocument()
  })

  it('renders the full page without crashing', () => {
    const { container } = renderComponent()
    expect(container).toBeTruthy()
    expect(container.querySelector('.min-h-screen')).toBeTruthy()
  })
})
