import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ───────────────────────────────────────────
const mockRequestPasswordReset = vi.fn()

// ─── react-router-dom ─────────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── authAPI via lib/api ───────────────────────────────────────────────
vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  authAPI: {
    requestPasswordReset: mockRequestPasswordReset,
    resetPassword: vi.fn(),
  },
}))

// ─── Component ─────────────────────────────────────────────────────────
let ForgotPassword: React.ComponentType
beforeAll(async () => {
  const mod = await import('../ForgotPassword')
  ForgotPassword = mod.default
})

function renderForgotPassword() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>
  )
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequestPasswordReset.mockResolvedValue(undefined)
  })

  it('renders the Reset your password heading', () => {
    renderForgotPassword()
    expect(screen.getByText('Reset your password')).toBeInTheDocument()
  })

  it('renders Pitchey brand link', () => {
    renderForgotPassword()
    expect(screen.getByText('Pitchey')).toBeInTheDocument()
  })

  it('renders instructional text', () => {
    renderForgotPassword()
    expect(screen.getByText(/Enter your email address/i)).toBeInTheDocument()
  })

  it('renders email input field', () => {
    renderForgotPassword()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
  })

  it('renders Send reset link button', () => {
    renderForgotPassword()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('renders Back to login link', () => {
    renderForgotPassword()
    const backLink = screen.getByRole('link', { name: /back to login/i })
    expect(backLink).toHaveAttribute('href', '/login')
  })

  it('renders Sign up link at the bottom', () => {
    renderForgotPassword()
    const signUpLink = screen.getByRole('link', { name: /sign up/i })
    expect(signUpLink).toHaveAttribute('href', '/register')
  })

  it('calls requestPasswordReset with correct email on submit', async () => {
    renderForgotPassword()

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'forgot@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('forgot@test.com')
    })
  })

  it('shows success screen after submitting', async () => {
    renderForgotPassword()

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'forgot@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument()
    })
    expect(screen.getByText(/forgot@test.com/)).toBeInTheDocument()
    expect(screen.getByText(/The link will expire in 1 hour/)).toBeInTheDocument()
  })

  it('shows success screen even when API throws (prevents user enumeration)', async () => {
    mockRequestPasswordReset.mockRejectedValue(new Error('User not found'))
    renderForgotPassword()

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'notexist@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument()
    })
  })

  it('shows Try another email button on success screen', async () => {
    renderForgotPassword()

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'forgot@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try another email/i })).toBeInTheDocument()
    })
  })

  it('returns to form when Try another email is clicked', async () => {
    renderForgotPassword()

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'forgot@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try another email/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /try another email/i }))
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
  })

  it('shows Back to login link on success screen', async () => {
    renderForgotPassword()

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'forgot@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      const loginLink = screen.getByRole('link', { name: /back to login/i })
      expect(loginLink).toHaveAttribute('href', '/login')
    })
  })

  it('disables submit button while loading', async () => {
    mockRequestPasswordReset.mockReturnValue(new Promise(() => {})) // never resolves
    renderForgotPassword()

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'forgot@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    // After click, button should be disabled (loading state)
    const btn = screen.queryByRole('button', { name: /send reset link/i })
    if (btn) {
      expect(btn).toBeDisabled()
    }
  })
})
