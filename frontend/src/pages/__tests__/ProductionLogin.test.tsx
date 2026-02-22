import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ───────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLoginProduction = vi.fn()

// ─── react-router-dom ─────────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/login/production' }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store ────────────────────────────────────────────────────────
const mockAuthState = {
  loginProduction: mockLoginProduction,
  loading: false,
  error: null,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── BackButton component ──────────────────────────────────────────────
vi.mock('../../components/BackButton', () => ({
  default: ({ variant }: any) => <button data-testid="back-button" data-variant={variant}>Back</button>,
}))

// ─── Component ─────────────────────────────────────────────────────────
let ProductionLogin: React.ComponentType
beforeAll(async () => {
  const mod = await import('../ProductionLogin')
  ProductionLogin = mod.default
})

function renderProductionLogin() {
  return render(
    <MemoryRouter>
      <ProductionLogin />
    </MemoryRouter>
  )
}

describe('ProductionLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthState.loading = false
    mockAuthState.error = null
    mockLoginProduction.mockResolvedValue(undefined)
  })

  it('renders the production portal heading', () => {
    renderProductionLogin()
    expect(screen.getByText('Production Portal')).toBeInTheDocument()
    expect(screen.getByText('Sign in to manage productions')).toBeInTheDocument()
  })

  it('renders email and password fields', () => {
    renderProductionLogin()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('renders sign in button', () => {
    renderProductionLogin()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders demo account section', () => {
    renderProductionLogin()
    expect(screen.getByText('Try our demo account')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /use demo production account/i })).toBeInTheDocument()
  })

  it('renders forgot password link', () => {
    renderProductionLogin()
    const forgotLink = screen.getByRole('link', { name: 'Forgot password?' })
    expect(forgotLink).toHaveAttribute('href', '/forgot-password')
  })

  it('renders links to other portals', () => {
    renderProductionLogin()
    expect(screen.getByText('Try other portals')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Creator Portal' })).toHaveAttribute('href', '/login/creator')
    expect(screen.getByRole('link', { name: 'Investor Portal' })).toHaveAttribute('href', '/login/investor')
  })

  it('renders the back button', () => {
    renderProductionLogin()
    expect(screen.getByTestId('back-button')).toBeInTheDocument()
  })

  it('submits login and navigates to production dashboard on success', async () => {
    renderProductionLogin()

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'prod@test.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLoginProduction).toHaveBeenCalledWith('prod@test.com', 'secret123')
      expect(mockNavigate).toHaveBeenCalledWith('/production/dashboard')
    })
  })

  it('shows error message when error is present', () => {
    mockAuthState.error = 'Invalid credentials'
    renderProductionLogin()
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
  })

  it('disables submit button while loading', () => {
    mockAuthState.loading = true
    renderProductionLogin()
    const submitBtn = screen.getByRole('button', { name: '' })
    expect(submitBtn).toBeDisabled()
  })

  it('calls loginProduction with demo credentials when demo button clicked', async () => {
    renderProductionLogin()
    fireEvent.click(screen.getByRole('button', { name: /use demo production account/i }))

    await waitFor(() => {
      expect(mockLoginProduction).toHaveBeenCalledWith('stellar.production@demo.com', 'Demo123')
    })
  })

  it('fills email field with demo credentials', async () => {
    renderProductionLogin()
    fireEvent.click(screen.getByRole('button', { name: /use demo production account/i }))

    await waitFor(() => {
      const emailInput = screen.getByLabelText('Email address') as HTMLInputElement
      expect(emailInput.value).toBe('stellar.production@demo.com')
    })
  })
})
