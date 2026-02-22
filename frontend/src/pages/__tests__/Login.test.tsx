import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ───────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLoginCreator = vi.fn()
const mockLoginInvestor = vi.fn()
const mockLoginProduction = vi.fn()

// ─── react-router-dom ─────────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store ────────────────────────────────────────────────────────
const mockAuthState = {
  loginCreator: mockLoginCreator,
  loginInvestor: mockLoginInvestor,
  loginProduction: mockLoginProduction,
  loading: false,
  error: null,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Component ─────────────────────────────────────────────────────────
let Login: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Login')
  Login = mod.default
})

function renderLogin(searchParams?: URLSearchParams) {
  // Override useSearchParams for specific tests via the initial url
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthState.loading = false
    mockAuthState.error = null
    mockLoginCreator.mockResolvedValue(undefined)
    mockLoginInvestor.mockResolvedValue(undefined)
    mockLoginProduction.mockResolvedValue(undefined)
  })

  it('renders the portal selection screen by default', () => {
    renderLogin()
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    expect(screen.getByText('Select your portal')).toBeInTheDocument()
    expect(screen.getByText('Creator Portal')).toBeInTheDocument()
    expect(screen.getByText('Investor Portal')).toBeInTheDocument()
    expect(screen.getByText('Production Portal')).toBeInTheDocument()
  })

  it('renders Pitchey brand link', () => {
    renderLogin()
    expect(screen.getByText('Pitchey')).toBeInTheDocument()
  })

  it('renders link to register', () => {
    renderLogin()
    const registerLink = screen.getByText('create a new account')
    expect(registerLink).toBeInTheDocument()
    expect(registerLink.closest('a')).toHaveAttribute('href', '/register')
  })

  it('renders direct portal links at the bottom', () => {
    renderLogin()
    expect(screen.getByText('Direct portal links')).toBeInTheDocument()
    const creatorLink = screen.getByRole('link', { name: 'Creator' })
    const investorLink = screen.getByRole('link', { name: 'Investor' })
    const productionLink = screen.getByRole('link', { name: 'Production' })
    expect(creatorLink).toHaveAttribute('href', '/login/creator')
    expect(investorLink).toHaveAttribute('href', '/login/investor')
    expect(productionLink).toHaveAttribute('href', '/login/production')
  })

  it('shows login form after selecting Creator Portal', () => {
    renderLogin()
    fireEvent.click(screen.getByText('Creator Portal'))
    expect(screen.getByText('Creator Login')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows login form after selecting Investor Portal', () => {
    renderLogin()
    fireEvent.click(screen.getByText('Investor Portal'))
    expect(screen.getByText('Investor Login')).toBeInTheDocument()
  })

  it('shows login form after selecting Production Portal', () => {
    renderLogin()
    fireEvent.click(screen.getByText('Production Portal'))
    expect(screen.getByText('Production Login')).toBeInTheDocument()
  })

  it('allows navigating back to portal selection', () => {
    renderLogin()
    fireEvent.click(screen.getByText('Creator Portal'))
    fireEvent.click(screen.getByText('← Change portal'))
    expect(screen.getByText('Select your portal')).toBeInTheDocument()
  })

  it('shows demo account button when portal is selected', () => {
    renderLogin()
    fireEvent.click(screen.getByText('Investor Portal'))
    expect(screen.getByText('Try our demo account')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /use demo investor account/i })).toBeInTheDocument()
  })

  it('fills demo credentials when demo button clicked', async () => {
    renderLogin()
    fireEvent.click(screen.getByText('Investor Portal'))
    const demoButton = screen.getByRole('button', { name: /use demo investor account/i })
    fireEvent.click(demoButton)
    const emailInput = screen.getByLabelText('Email address') as HTMLInputElement
    expect(emailInput.value).toBe('sarah.investor@demo.com')
  })

  it('submits creator login and navigates to creator dashboard', async () => {
    renderLogin()
    fireEvent.click(screen.getByText('Creator Portal'))

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'alex@test.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLoginCreator).toHaveBeenCalledWith('alex@test.com', 'secret123')
      expect(mockNavigate).toHaveBeenCalledWith('/creator/dashboard')
    })
  })

  it('submits investor login and navigates to investor dashboard', async () => {
    renderLogin()
    fireEvent.click(screen.getByText('Investor Portal'))

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'investor@test.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLoginInvestor).toHaveBeenCalledWith('investor@test.com', 'pass123')
      expect(mockNavigate).toHaveBeenCalledWith('/investor/dashboard')
    })
  })

  it('submits production login and navigates to production dashboard', async () => {
    renderLogin()
    fireEvent.click(screen.getByText('Production Portal'))

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'prod@test.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass456' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLoginProduction).toHaveBeenCalledWith('prod@test.com', 'pass456')
      expect(mockNavigate).toHaveBeenCalledWith('/production/dashboard')
    })
  })

  it('shows error message when error is present', async () => {
    mockAuthState.error = 'Invalid credentials'
    renderLogin()
    fireEvent.click(screen.getByText('Investor Portal'))
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
  })

  it('shows loading spinner when loading', () => {
    mockAuthState.loading = true
    renderLogin()
    fireEvent.click(screen.getByText('Creator Portal'))
    const submitBtn = screen.getByRole('button', { name: '' })
    expect(submitBtn).toBeDisabled()
  })

  it('shows forgot password link when portal is selected', () => {
    renderLogin()
    fireEvent.click(screen.getByText('Creator Portal'))
    const forgotLink = screen.getByRole('link', { name: 'Forgot password?' })
    expect(forgotLink).toHaveAttribute('href', '/forgot-password')
  })

  it('shows remember me checkbox when portal is selected', () => {
    renderLogin()
    fireEvent.click(screen.getByText('Creator Portal'))
    expect(screen.getByLabelText('Remember me')).toBeInTheDocument()
  })
})
